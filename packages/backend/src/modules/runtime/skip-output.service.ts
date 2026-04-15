import type {
  ModelCallConfig,
  ModelCallOutputItem,
  ModelOutput,
  NodeConfig,
  OutputDef,
} from "@intelliflow/shared";
import { getSkipStrategyTargets } from "../../../../shared/src/types";
import { resolveRef } from "./variable-resolution";

type NodeExecutionSnapshot = {
  nodeId: string;
  outputData: Record<string, unknown> | null;
};

function buildSelectedArtifactSegmentKey(artifactId: string): string {
  return `selected__artifact__${artifactId}`;
}

function pickFirstNonEmpty(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

function resolveSkipBindingValue(
  output: OutputDef,
  config: NodeConfig,
  nodeExecs: NodeExecutionSnapshot[],
): string | undefined {
  const outputId = output.segmentKey ?? output.id;
  const binding = config.skipStrategy?.bindings?.[outputId];
  if (!binding || binding.mode === "empty" || !binding.sourceRef) {
    return undefined;
  }
  return resolveRef(binding.sourceRef, nodeExecs);
}

function buildSkippedInputTransformOutputData(
  nodeId: string,
  config: Extract<NodeConfig, { type: "input_transform" }>,
  nodeExecs: NodeExecutionSnapshot[],
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const outputData: Record<string, unknown> = { ...metadata };
  const fieldsByKey: Record<string, string> = {};
  const fields: Record<string, string> = {};
  const fileSlots: Record<string, { text: string }> = {};
  const fileSlotTexts: string[] = [];

  for (const field of config.formFields) {
    if (field.type === "file") {
      const output: OutputDef = {
        id: `${nodeId}-fileslot-${field.fileSlotId ?? field.id}`,
        name: field.fileSlotLabel || field.label || "文件槽位",
        segmentKey: field.fileSlotId ?? field.id,
      };
      const value = resolveSkipBindingValue(output, config, nodeExecs);
      if (value && value.trim()) {
        fileSlots[output.segmentKey ?? output.id] = { text: value };
        fileSlotTexts.push(value);
      }
      continue;
    }

    const key = field.machineKey || field.id;
    const output: OutputDef = {
      id: `${nodeId}-field-${key}`,
      name: field.label || "未命名",
      segmentKey: key,
    };
    const value = resolveSkipBindingValue(output, config, nodeExecs);
    if (!value || !value.trim()) continue;
    fieldsByKey[key] = value;
    fields[field.id] = value;
  }

  const mergedFileOutput = getSkipStrategyTargets(nodeId, config).find(
    (output) => output.segmentKey === "text",
  );
  const mergedText =
    (mergedFileOutput && resolveSkipBindingValue(mergedFileOutput, config, nodeExecs)) ||
    pickFirstNonEmpty(fileSlotTexts);

  if (Object.keys(fieldsByKey).length > 0) outputData.fieldsByKey = fieldsByKey;
  if (Object.keys(fields).length > 0) outputData.fields = fields;
  if (Object.keys(fileSlots).length > 0) outputData.fileSlots = fileSlots;
  if (mergedText && mergedText.trim()) outputData.text = mergedText;

  return outputData;
}

function buildSkippedModelCallOutputData(
  config: ModelCallConfig,
  nodeExecs: NodeExecutionSnapshot[],
  metadata: Record<string, unknown>,
): { outputData: Record<string, unknown>; selectedOutputKey: string | null } {
  const outputData: Record<string, unknown> = {
    ...metadata,
    outputItems: {
      manual_feedback: {
        content: "",
        format: "text",
        kind: "manual_feedback",
      } satisfies ModelCallOutputItem,
    },
    manualFeedback: {
      content: "",
      updatedAt: null,
      appliedAt: null,
    },
  };

  if (config.namedOutputs && config.namedOutputs.length > 0) {
    const namedOutputs: Record<string, { content: string; format: "text" | "json" | "markdown" }> =
      {};
    const outputItems = outputData.outputItems as Record<string, ModelCallOutputItem>;

    for (const namedOutput of config.namedOutputs) {
      const value = resolveSkipBindingValue(
        {
          id: namedOutput.id,
          name: namedOutput.name,
          segmentKey: namedOutput.id,
        },
        config,
        nodeExecs,
      );
      if (!value || !value.trim()) continue;
      namedOutputs[namedOutput.id] = {
        content: value,
        format: namedOutput.format,
      };

      if (config.enableUserSelectionOutput) {
        outputItems[buildSelectedArtifactSegmentKey(namedOutput.id)] = {
          content: value,
          format: namedOutput.format,
          kind: "selected_artifact",
          artifactId: namedOutput.id,
          modelIds: [],
        };
      }
    }

    if (Object.keys(namedOutputs).length > 0) {
      outputData.namedOutputs = namedOutputs;
      const firstValue = pickFirstNonEmpty(
        Object.values(namedOutputs).map((output) => output.content),
      );
      if (firstValue) {
        outputData.text = firstValue;
        outputData.selectedContent = firstValue;
      }
    }

    return { outputData, selectedOutputKey: null };
  }

  const models: Record<string, ModelOutput> = {};
  const outputItems = outputData.outputItems as Record<string, ModelCallOutputItem>;
  for (const modelId of config.modelIds) {
    const value = resolveSkipBindingValue(
      {
        id: modelId,
        name: config.modelNames?.[modelId] ?? modelId,
        segmentKey: modelId,
      },
      config,
      nodeExecs,
    );
    if (!value || !value.trim()) continue;
    models[modelId] = {
      modelId,
      modelDisplayName: config.modelNames?.[modelId] ?? modelId,
      content: value,
      status: "completed",
    };
    outputItems[modelId] = {
      content: value,
      format: config.outputFormat ?? "text",
      kind: "model",
      modelId,
      modelDisplayName: config.modelNames?.[modelId] ?? modelId,
    };
  }

  if (Object.keys(models).length > 0) {
    outputData.models = models;
  }

  const selectedValue = config.enableUserSelectionOutput
    ? resolveSkipBindingValue(
        {
          id: "selected",
          name: "用户选择输出",
          segmentKey: "selected",
        },
        config,
        nodeExecs,
      ) || pickFirstNonEmpty(Object.values(models).map((model) => model.content))
    : pickFirstNonEmpty(Object.values(models).map((model) => model.content));

  if (selectedValue) {
    outputData.selectedContent = selectedValue;
    outputData.text = selectedValue;
    if (config.enableUserSelectionOutput) {
      outputItems.selected = {
        content: selectedValue,
        format: config.outputFormat ?? "text",
        kind: "selected",
        modelIds: [],
      };
    }
  }

  return {
    outputData,
    selectedOutputKey: Object.keys(models)[0] ?? null,
  };
}

function buildSkippedDesensitizeOutputData(
  nodeId: string,
  config: Extract<NodeConfig, { type: "desensitize" }>,
  nodeExecs: NodeExecutionSnapshot[],
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const outputData: Record<string, unknown> = {
    ...metadata,
    mappingCount: 0,
    detectedItems: [],
    confirmedAt: new Date().toISOString(),
  };

  if (config.inputSources && config.inputSources.length > 0) {
    const sources: Record<string, Record<string, unknown>> = {};
    for (const source of config.inputSources) {
      const value = resolveSkipBindingValue(
        {
          id: source.outputId,
          name: source.displayName,
          segmentKey: source.outputId,
        },
        config,
        nodeExecs,
      );
      if (!value || !value.trim()) continue;
      sources[source.outputId] = {
        displayName: source.displayName,
        desensitizedText: value,
        content: value,
      };
    }
    if (Object.keys(sources).length > 0) {
      outputData.sources = sources;
    }
    return outputData;
  }

  const value = resolveSkipBindingValue(
    {
      id: `${nodeId}-desensitized`,
      name: "脱敏后文本",
      segmentKey: "desensitized",
    },
    config,
    nodeExecs,
  );
  if (value && value.trim()) {
    outputData.desensitized = value;
    outputData.desensitizedText = value;
    outputData.text = value;
  }
  return outputData;
}

function buildSkippedRestoreOutputData(
  nodeId: string,
  config: Extract<NodeConfig, { type: "restore" }>,
  nodeExecs: NodeExecutionSnapshot[],
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const outputData: Record<string, unknown> = {
    ...metadata,
    restorations: [],
  };

  if (config.inputSources && config.inputSources.length > 0) {
    const sources: Record<string, Record<string, unknown>> = {};
    const values: string[] = [];
    for (const source of config.inputSources) {
      const segmentKey = `${source.sourceNodeId}.${source.outputId}`;
      const value = resolveSkipBindingValue(
        {
          id: `${nodeId}-restored-${segmentKey}`,
          name: source.displayName,
          segmentKey,
        },
        config,
        nodeExecs,
      );
      if (!value || !value.trim()) continue;
      sources[segmentKey] = {
        displayName: source.displayName,
        restoredText: value,
        content: value,
        originalText: "",
      };
      values.push(value);
    }
    if (Object.keys(sources).length > 0) {
      outputData.sources = sources;
      outputData.restoredText = values.join("\n\n");
    }
    return outputData;
  }

  const value = resolveSkipBindingValue(
    {
      id: `${nodeId}-restored`,
      name: "恢复后文本",
      segmentKey: "restored",
    },
    config,
    nodeExecs,
  );
  if (value && value.trim()) {
    outputData.restored = value;
    outputData.restoredText = value;
  }
  return outputData;
}

export function buildSkippedNodeOutputData(params: {
  nodeId: string;
  config: NodeConfig;
  nodeExecs: NodeExecutionSnapshot[];
  skipReason?: string;
  skipContext: "manual" | "conditional" | "automatic";
}): { outputData: Record<string, unknown>; selectedOutputKey: string | null } {
  const metadata = {
    skipType: params.skipContext,
    skipReason: params.skipReason ?? null,
    skippedAt: new Date().toISOString(),
    skipBindings: params.config.skipStrategy?.bindings ?? {},
  };

  switch (params.config.type) {
    case "input_transform":
      return {
        outputData: buildSkippedInputTransformOutputData(
          params.nodeId,
          params.config,
          params.nodeExecs,
          metadata,
        ),
        selectedOutputKey: null,
      };
    case "model_call":
      return buildSkippedModelCallOutputData(params.config, params.nodeExecs, metadata);
    case "desensitize":
      return {
        outputData: buildSkippedDesensitizeOutputData(
          params.nodeId,
          params.config,
          params.nodeExecs,
          metadata,
        ),
        selectedOutputKey: null,
      };
    case "restore":
      return {
        outputData: buildSkippedRestoreOutputData(
          params.nodeId,
          params.config,
          params.nodeExecs,
          metadata,
        ),
        selectedOutputKey: null,
      };
    case "export":
      return { outputData: metadata, selectedOutputKey: null };
  }
}
