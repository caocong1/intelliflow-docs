import type {
  ModelCallConfig,
  ModelCallManualFeedback,
  ModelCallNamedOutputValue,
  ModelCallOutputData,
  ModelCallOutputItem,
  ModelOutput,
  NamedOutputDef,
} from "@intelliflow/shared";

type NamedOutputValue = ModelCallNamedOutputValue;
type OutputItem = ModelCallOutputItem;

export const MODEL_CALL_MANUAL_FEEDBACK_SEGMENT_KEY = "manual_feedback";

function normalizeManualFeedback(value: unknown): ModelCallManualFeedback | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  return {
    content: typeof raw.content === "string" ? raw.content : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    appliedAt: typeof raw.appliedAt === "string" ? raw.appliedAt : null,
  };
}

export function getModelCallManualFeedback(
  outputData: Record<string, unknown> | null | undefined,
): ModelCallManualFeedback | null {
  return normalizeManualFeedback(outputData?.manualFeedback);
}

export function hasPendingModelCallManualFeedback(
  outputData: Record<string, unknown> | null | undefined,
): boolean {
  const feedback = getModelCallManualFeedback(outputData);
  if (!feedback?.content.trim()) return false;
  if (!feedback.updatedAt) return true;
  return feedback.appliedAt !== feedback.updatedAt;
}

export function getModelCallManualFeedbackValidationError(
  outputData: Record<string, unknown> | null | undefined,
): string | null {
  if (!hasPendingModelCallManualFeedback(outputData)) {
    return null;
  }

  return "已填写人工意见，请先按意见重生成当前节点后再继续。";
}

function applyManualFeedbackToOutputData(params: {
  outputData: ModelCallOutputData;
  outputItems: Record<string, OutputItem>;
  previousOutputData?: Record<string, unknown> | null;
  markApplied?: boolean;
}) {
  const manualFeedback = getModelCallManualFeedback(params.previousOutputData);
  if (!manualFeedback) return;

  const nextManualFeedback: ModelCallManualFeedback =
    params.markApplied && manualFeedback.updatedAt
      ? {
          ...manualFeedback,
          appliedAt: manualFeedback.updatedAt,
        }
      : manualFeedback;

  params.outputData.manualFeedback = nextManualFeedback;
  params.outputItems[MODEL_CALL_MANUAL_FEEDBACK_SEGMENT_KEY] = {
    content: nextManualFeedback.content,
    format: "text",
    kind: "manual_feedback",
  };
}

export function upsertModelCallManualFeedbackInOutputData(params: {
  outputData: Record<string, unknown> | null | undefined;
  content: string;
  updatedAt: string;
}): Record<string, unknown> {
  const previousFeedback = getModelCallManualFeedback(params.outputData);
  const nextManualFeedback: ModelCallManualFeedback = {
    content: params.content,
    updatedAt: params.updatedAt,
    appliedAt:
      params.content.trim().length > 0 && previousFeedback?.content === params.content
        ? (previousFeedback.appliedAt ?? null)
        : null,
  };

  const currentOutputItems =
    (params.outputData?.outputItems as Record<string, OutputItem> | undefined) ?? {};

  return {
    ...(params.outputData ?? {}),
    manualFeedback: nextManualFeedback,
    outputItems: {
      ...currentOutputItems,
      [MODEL_CALL_MANUAL_FEEDBACK_SEGMENT_KEY]: {
        content: nextManualFeedback.content,
        format: "text",
        kind: "manual_feedback",
      },
    },
  };
}

function isSelectableStatus(status: ModelOutput["status"]): boolean {
  return status === "completed" || status === "format_error";
}

function normalizeSelectedModelIds(
  modelIds: string[] | undefined,
  modelsMap: Record<string, ModelOutput>,
): string[] {
  if (!modelIds || modelIds.length === 0) return [];

  const seen = new Set<string>();
  const next: string[] = [];
  for (const modelId of modelIds) {
    if (seen.has(modelId)) continue;
    const model = modelsMap[modelId];
    if (!model || !isSelectableStatus(model.status)) continue;
    seen.add(modelId);
    next.push(modelId);
  }
  return next;
}

function parseJsonSafely(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function combineSelectedContents(
  entries: Array<{
    content: string;
    format: string;
    modelId: string;
    modelDisplayName: string;
  }>,
  fallbackFormat: string,
): string {
  if (entries.length === 0) return "";
  if (entries.length === 1) return entries[0].content;

  const format = entries[0]?.format ?? fallbackFormat;
  if (format === "json") {
    return JSON.stringify(
      entries.map((entry) => ({
        modelId: entry.modelId,
        modelDisplayName: entry.modelDisplayName,
        value: parseJsonSafely(entry.content) ?? entry.content,
      })),
      null,
      2,
    );
  }

  const separator = format === "markdown" ? "\n\n---\n\n" : "\n\n====================\n\n";
  return entries
    .map((entry) => {
      const title =
        format === "markdown"
          ? `### ${entry.modelDisplayName || entry.modelId}`
          : `【${entry.modelDisplayName || entry.modelId}】`;
      return `${title}\n\n${entry.content}`;
    })
    .join(separator);
}

function buildModelNamedOutputs(
  modelsMap: Record<string, ModelOutput>,
  namedOutputDefs: NamedOutputDef[],
) {
  const namedOutputsByModel: Record<string, Record<string, NamedOutputValue>> = {};
  const fallbackModelIds = new Set<string>();

  for (const model of Object.values(modelsMap)) {
    if (!model.content.trim()) continue;

    const parsed = parseNamedOutputs(model.content, namedOutputDefs);
    namedOutputsByModel[model.modelId] = Object.fromEntries(
      Object.entries(parsed.namedOutputs).map(([artifactId, value]) => [
        artifactId,
        {
          ...value,
          modelId: model.modelId,
          modelDisplayName: model.modelDisplayName,
        },
      ]),
    );

    if (parsed.fallback) {
      fallbackModelIds.add(model.modelId);
    }
  }

  return { namedOutputsByModel, fallbackModelIds };
}

export function buildModelArtifactSegmentKey(modelId: string, artifactId: string): string {
  return `model__${modelId}__artifact__${artifactId}`;
}

export function buildSelectedArtifactSegmentKey(artifactId: string): string {
  return `selected__artifact__${artifactId}`;
}

/** Strategy 1: standard paired ===OUTPUT:id===…===END:id=== extraction. */
function parsePairedDelimiters(
  rawContent: string,
  formatMap: Map<string, NamedOutputDef["format"]>,
): Record<string, { content: string; format: NamedOutputDef["format"] }> {
  const result: Record<string, { content: string; format: NamedOutputDef["format"] }> = {};
  const regex = /===OUTPUT:(\w+)===\n?([\s\S]*?)===END:\1===/g;
  let match = regex.exec(rawContent);
  while (match !== null) {
    result[match[1]] = { content: match[2].trim(), format: formatMap.get(match[1]) ?? "text" };
    match = regex.exec(rawContent);
  }
  return result;
}

/**
 * Strategy 2: split by ===OUTPUT:id=== markers, strip any ===END:xxx=== tags.
 * Handles models that group all END tags at the bottom or omit some of them.
 */
function parseByOutputMarkers(
  rawContent: string,
  formatMap: Map<string, NamedOutputDef["format"]>,
): Record<string, { content: string; format: NamedOutputDef["format"] }> {
  const markerRegex = /===OUTPUT:(\w+)===/g;
  const markers: Array<{ id: string; start: number; contentStart: number }> = [];
  let m = markerRegex.exec(rawContent);
  while (m !== null) {
    markers.push({ id: m[1], start: m.index, contentStart: m.index + m[0].length });
    m = markerRegex.exec(rawContent);
  }
  if (markers.length === 0) return {};

  const result: Record<string, { content: string; format: NamedOutputDef["format"] }> = {};
  for (let i = 0; i < markers.length; i++) {
    const { id, contentStart } = markers[i];
    const sectionEnd = i + 1 < markers.length ? markers[i + 1].start : rawContent.length;
    const content = rawContent
      .slice(contentStart, sectionEnd)
      .replace(/===END:\w+===/g, "")
      .trim();
    result[id] = { content, format: formatMap.get(id) ?? "text" };
  }
  return result;
}

/**
 * Parse named output delimiters from raw model content.
 * Expected format: ===OUTPUT:id===\n...content...\n===END:id===
 *
 * Two strategies are tried in order:
 * 1. Paired delimiters (strict OUTPUT+END regex)
 * 2. OUTPUT-marker splitting (tolerates grouped/missing END tags)
 *
 * Falls back to storing entire content as _default when no delimiters found.
 */
export function parseNamedOutputs(
  rawContent: string,
  expectedDefs: NamedOutputDef[],
): {
  namedOutputs: Record<string, { content: string; format: NamedOutputDef["format"] }>;
  fallback: boolean;
} {
  const expectedIds = expectedDefs.map((d) => d.id);
  const formatMap = new Map(expectedDefs.map((d) => [d.id, d.format]));

  // Strategy 1: strict paired delimiters
  const paired = parsePairedDelimiters(rawContent, formatMap);
  const pairedCount = expectedIds.filter((id) => id in paired).length;
  if (pairedCount === expectedIds.length) {
    return { namedOutputs: paired, fallback: false };
  }

  // Strategy 2: split by OUTPUT markers (tolerates grouped/missing END tags)
  const marker = parseByOutputMarkers(rawContent, formatMap);
  const markerCount = expectedIds.filter((id) => id in marker).length;

  // Pick whichever strategy recovered more expected outputs
  const best = markerCount > pairedCount ? marker : paired;
  const bestCount = Math.max(markerCount, pairedCount);

  if (bestCount > 0) {
    return { namedOutputs: best, fallback: bestCount < expectedIds.length };
  }

  return {
    namedOutputs: { _default: { content: rawContent, format: "text" } },
    fallback: true,
  };
}

export function buildModelCallOutputData(params: {
  models: Record<string, ModelOutput>;
  config?: Pick<ModelCallConfig, "namedOutputs" | "outputFormat" | "enableUserSelectionOutput">;
  selectedModelIds?: string[];
  defaultSelectedModelId?: string | null;
  previousOutputData?: Record<string, unknown> | null;
  markManualFeedbackApplied?: boolean;
}): {
  outputData: Record<string, unknown>;
  selectedOutputKey: string | null;
} {
  const namedOutputDefs = params.config?.namedOutputs ?? [];
  const hasNamedOutputs = namedOutputDefs.length > 0;
  const defaultFormat = params.config?.outputFormat ?? "text";
  const enableUserSelection = params.config?.enableUserSelectionOutput ?? false;
  const outputItems: Record<string, OutputItem> = {};
  const outputData: ModelCallOutputData = {
    models: params.models,
    outputItems,
  };

  applyManualFeedbackToOutputData({
    outputData,
    outputItems,
    previousOutputData: params.previousOutputData,
    markApplied: params.markManualFeedbackApplied,
  });

  for (const model of Object.values(params.models)) {
    outputItems[model.modelId] = {
      content: model.content,
      format: defaultFormat,
      kind: "model",
      modelId: model.modelId,
      modelDisplayName: model.modelDisplayName,
    };
  }

  let namedOutputsByModel: Record<string, Record<string, NamedOutputValue>> | undefined;
  let fallbackModelIds = new Set<string>();

  if (hasNamedOutputs) {
    const builtNamedOutputs = buildModelNamedOutputs(params.models, namedOutputDefs);
    namedOutputsByModel = builtNamedOutputs.namedOutputsByModel;
    fallbackModelIds = builtNamedOutputs.fallbackModelIds;

    if (Object.keys(namedOutputsByModel).length > 0) {
      outputData.namedOutputsByModel = namedOutputsByModel;
    }

    for (const [modelId, artifacts] of Object.entries(namedOutputsByModel)) {
      for (const [artifactId, value] of Object.entries(artifacts)) {
        if (artifactId === "_default") continue;
        outputItems[buildModelArtifactSegmentKey(modelId, artifactId)] = {
          content: value.content,
          format: value.format,
          kind: "model_artifact",
          modelId,
          modelDisplayName: value.modelDisplayName,
          artifactId,
        };
      }
    }
  }

  const normalizedSelectedModelIds = normalizeSelectedModelIds(
    params.selectedModelIds,
    params.models,
  );
  const fallbackPrimarySelectedModelId =
    params.defaultSelectedModelId && params.models[params.defaultSelectedModelId]
      ? params.defaultSelectedModelId
      : (Object.values(params.models).find((model) => isSelectableStatus(model.status))?.modelId ??
        null);

  if (enableUserSelection) {
    outputData.selectedModelIds = normalizedSelectedModelIds;

    if (normalizedSelectedModelIds.length > 0) {
      const selectedModels = normalizedSelectedModelIds
        .map((modelId) => params.models[modelId])
        .filter((model): model is ModelOutput => Boolean(model));

      const selectedContent = combineSelectedContents(
        selectedModels.map((model) => ({
          content: model.content,
          format: defaultFormat,
          modelId: model.modelId,
          modelDisplayName: model.modelDisplayName,
        })),
        defaultFormat,
      );

      outputData.selectedContent = selectedContent;
      outputData.text = selectedContent;

      if (hasNamedOutputs && namedOutputsByModel) {
        const selectedNamedOutputs: Record<string, NamedOutputValue> = {};

        for (const namedOutput of namedOutputDefs) {
          const selectedArtifacts = normalizedSelectedModelIds
            .map((modelId) => namedOutputsByModel?.[modelId]?.[namedOutput.id])
            .filter((value): value is NamedOutputValue => Boolean(value));

          if (selectedArtifacts.length === 0) continue;

          const content = combineSelectedContents(
            selectedArtifacts.map((artifact) => ({
              content: artifact.content,
              format: artifact.format,
              modelId: artifact.modelId ?? "",
              modelDisplayName: artifact.modelDisplayName ?? artifact.modelId ?? "",
            })),
            namedOutput.format,
          );

          selectedNamedOutputs[namedOutput.id] = {
            content,
            format: namedOutput.format,
            modelIds: normalizedSelectedModelIds,
          };
          outputItems[buildSelectedArtifactSegmentKey(namedOutput.id)] = {
            content,
            format: namedOutput.format,
            kind: "selected_artifact",
            modelIds: normalizedSelectedModelIds,
            artifactId: namedOutput.id,
          };
        }

        if (Object.keys(selectedNamedOutputs).length > 0) {
          outputData.namedOutputs = selectedNamedOutputs;
        }
      } else {
        outputItems.selected = {
          content: selectedContent,
          format: defaultFormat,
          kind: "selected",
          modelIds: normalizedSelectedModelIds,
        };
      }

      if (normalizedSelectedModelIds.some((modelId) => fallbackModelIds.has(modelId))) {
        outputData.fallbackWarning = true;
      }
    }

    return {
      outputData,
      selectedOutputKey: normalizedSelectedModelIds[0] ?? null,
    };
  }

  const selectedOutputKey = fallbackPrimarySelectedModelId;
  if (!selectedOutputKey) {
    return { outputData, selectedOutputKey: null };
  }

  const selected = params.models[selectedOutputKey];
  outputData.selectedContent = selected.content;
  outputData.text = selected.content;

  if (hasNamedOutputs && namedOutputsByModel?.[selectedOutputKey]) {
    const selectedNamedOutputs = Object.fromEntries(
      Object.entries(namedOutputsByModel[selectedOutputKey])
        .filter(([artifactId]) => artifactId !== "_default")
        .map(([artifactId, value]) => [artifactId, value]),
    );

    if (Object.keys(selectedNamedOutputs).length > 0) {
      outputData.namedOutputs = selectedNamedOutputs;
    }

    if (fallbackModelIds.has(selectedOutputKey)) {
      outputData.fallbackWarning = true;
    }
  }

  return {
    outputData,
    selectedOutputKey,
  };
}

export function buildSelectedModelOutputData(
  outputData: Record<string, unknown>,
  selectedModelIds: string[],
  config?: Pick<ModelCallConfig, "namedOutputs" | "outputFormat" | "enableUserSelectionOutput">,
): {
  outputData: Record<string, unknown>;
  selectedOutputKey: string | null;
} {
  const modelsMap = (outputData.models as Record<string, ModelOutput>) ?? {};
  if (Object.keys(modelsMap).length === 0) {
    throw new Error("Selected model output not found");
  }

  return buildModelCallOutputData({
    models: modelsMap,
    config,
    selectedModelIds,
    defaultSelectedModelId: selectedModelIds[0] ?? null,
    previousOutputData: outputData,
  });
}
