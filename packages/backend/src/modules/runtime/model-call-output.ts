import type { ModelCallConfig, ModelOutput, NamedOutputDef } from "@intelliflow/shared";

type NamedOutputValue = {
  content: string;
  format: string;
  modelId?: string;
  modelDisplayName?: string;
  modelIds?: string[];
};

type OutputItem = {
  content: string;
  format: string;
  kind: "model" | "model_artifact" | "selected" | "selected_artifact";
  modelId?: string;
  modelDisplayName?: string;
  modelIds?: string[];
  artifactId?: string;
};

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

/**
 * Parse named output delimiters from raw model content.
 * Expected format: ===OUTPUT:id===\n...content...\n===END:id===
 * Falls back to storing entire content as _default when delimiters not found.
 */
export function parseNamedOutputs(
  rawContent: string,
  expectedDefs: NamedOutputDef[],
): {
  namedOutputs: Record<string, { content: string; format: string }>;
  fallback: boolean;
} {
  const expectedIds = expectedDefs.map((d) => d.id);
  const formatMap = new Map(expectedDefs.map((d) => [d.id, d.format]));
  const result: Record<string, { content: string; format: string }> = {};

  const regex = /===OUTPUT:(\w+)===\n?([\s\S]*?)===END:\1===/g;
  let match: RegExpExecArray | null;
  match = regex.exec(rawContent);
  while (match !== null) {
    const id = match[1];
    const content = match[2].trim();
    result[id] = {
      content,
      format: formatMap.get(id) ?? "text",
    };
    match = regex.exec(rawContent);
  }

  const allFound = expectedIds.every((id) => id in result);
  if (allFound) {
    return { namedOutputs: result, fallback: false };
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
}): {
  outputData: Record<string, unknown>;
  selectedOutputKey: string | null;
} {
  const namedOutputDefs = params.config?.namedOutputs ?? [];
  const hasNamedOutputs = namedOutputDefs.length > 0;
  const defaultFormat = params.config?.outputFormat ?? "text";
  const enableUserSelection = params.config?.enableUserSelectionOutput ?? false;
  const outputItems: Record<string, OutputItem> = {};
  const outputData: Record<string, unknown> = {
    models: params.models,
    outputItems,
  };

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

  const normalizedSelectedModelIds = normalizeSelectedModelIds(params.selectedModelIds, params.models);
  const fallbackPrimarySelectedModelId =
    params.defaultSelectedModelId && params.models[params.defaultSelectedModelId]
      ? params.defaultSelectedModelId
      : Object.values(params.models).find((model) => isSelectableStatus(model.status))?.modelId ?? null;

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
  });
}
