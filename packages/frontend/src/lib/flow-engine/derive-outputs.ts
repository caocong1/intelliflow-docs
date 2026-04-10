import type { NodeConfig, OutputDef } from "@intelliflow/shared";

function buildModelArtifactSegmentKey(modelId: string, artifactId: string): string {
  return `model__${modelId}__artifact__${artifactId}`;
}

function buildSelectedArtifactSegmentKey(artifactId: string): string {
  return `selected__artifact__${artifactId}`;
}

/**
 * Auto-derive output definitions from a node's config.
 * Uses deterministic IDs so downstream variable references remain stable.
 * Each OutputDef includes a segmentKey for canonical variable path resolution.
 */
export function deriveOutputs(nodeId: string, config: NodeConfig): OutputDef[] {
  switch (config.type) {
    case "input_transform": {
      const outputs: OutputDef[] = [];
      for (const field of config.formFields) {
        if (field.type === "file") {
          // File fields with fileSlotId get their own output
          if (field.fileSlotId) {
            outputs.push({
              id: `${nodeId}-fileslot-${field.fileSlotId}`,
              name: field.fileSlotLabel || field.label || "文件槽位",
              description: `文件槽位: ${field.fileSlotLabel || field.label}`,
              segmentKey: field.fileSlotId,
            });
          }
        } else {
          // Text, textarea, number, date, datetime, select, multiselect fields
          const key = field.machineKey || field.id;
          outputs.push({
            id: `${nodeId}-field-${key}`,
            name: field.label || "未命名",
            description: `用户输入项: ${field.label}`,
            segmentKey: key,
            category: "field",
          });
        }
      }
      // Keep merged file upload output for backward compat
      const hasFileField = config.formFields.some((f) => f.type === "file");
      if (hasFileField) {
        outputs.push({
          id: `${nodeId}-file-upload`,
          name: "文件输出 (合并)",
          description: "所有文件合并文本",
          segmentKey: "text",
          category: "file_slot",
        });
      }
      return outputs;
    }

    case "model_call": {
      const modelIds = config.modelIds ?? [];
      const modelNames = config.modelNames ?? {};
      const outputs: OutputDef[] = [];

      if (config.namedOutputs && config.namedOutputs.length > 0) {
        for (const modelId of modelIds) {
          const modelLabel = modelNames[modelId] ?? modelId;
          for (const namedOutput of config.namedOutputs) {
            outputs.push({
              id: `${nodeId}-model-${modelId}-artifact-${namedOutput.id}`,
              name: `${modelLabel} / ${namedOutput.name}`,
              description: `模型 ${modelLabel} 的产物 ${namedOutput.name}`,
              segmentKey: buildModelArtifactSegmentKey(modelId, namedOutput.id),
              category: "model_artifact",
              groupLabel: modelLabel,
              modelId,
              artifactId: namedOutput.id,
            });
          }
        }

        if (config.enableUserSelectionOutput) {
          for (const namedOutput of config.namedOutputs) {
            outputs.push({
              id: `${nodeId}-selected-artifact-${namedOutput.id}`,
              name: `用户选择 / ${namedOutput.name}`,
              description: `用户选择输出: ${namedOutput.name}`,
              segmentKey: buildSelectedArtifactSegmentKey(namedOutput.id),
              category: "selected_artifact",
              groupLabel: "用户选择输出",
              artifactId: namedOutput.id,
            });
          }
        }

        return outputs;
      }

      for (const modelId of modelIds) {
        outputs.push({
          id: `${nodeId}-model-${modelId}`,
          name: modelNames[modelId] ?? modelId,
          description: "模型生成输出",
          segmentKey: modelId,
          category: "model",
          groupLabel: "模型输出",
          modelId,
        });
      }

      if (config.enableUserSelectionOutput) {
        outputs.push({
          id: `${nodeId}-selected-output`,
          name: "用户选择输出",
          description: "模型生成输出",
          segmentKey: "selected",
          category: "selected",
          groupLabel: "用户选择输出",
        });
      }

      return outputs;
    }

    case "desensitize":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((src) => ({
          id: `${nodeId}-desensitized-${src.outputId}`,
          name: `${src.displayName}.脱敏`,
          description: `脱敏后文本: ${src.displayName}`,
          segmentKey: src.outputId,
          category: "desensitized",
        }));
      }
      // Fallback for legacy configs without inputSources
      return [
        {
          id: `${nodeId}-desensitized`,
          name: "脱敏后文本",
          segmentKey: "desensitized",
          category: "desensitized",
        },
      ];

    case "restore":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((src) => ({
          id: `${nodeId}-restored-${src.sourceNodeId}-${src.outputId}`,
          name: `${src.displayName}.恢复`,
          description: `恢复后文本: ${src.displayName}`,
          segmentKey: `${src.sourceNodeId}.${src.outputId}`,
          category: "restored",
        }));
      }
      return [
        {
          id: `${nodeId}-restored`,
          name: "恢复后文本",
          segmentKey: "restored",
          category: "restored",
        },
      ];

    case "export":
      return [];
  }
}
