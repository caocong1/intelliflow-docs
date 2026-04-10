import type { NodeConfig, OutputDef } from "@intelliflow/shared";

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
        });
      }
      return outputs;
    }

    case "model_call":
      if (config.namedOutputs && config.namedOutputs.length > 0) {
        return config.namedOutputs.map((no) => ({
          id: `${nodeId}-namedoutput-${no.id}`,
          name: no.name,
          description: `输出项: ${no.name}`,
          segmentKey: no.id,
        }));
      }
      return config.modelIds.map((modelId) => ({
        id: `${nodeId}-model-${modelId}`,
        name: config.modelNames?.[modelId] ?? modelId,
        description: "模型生成输出",
        segmentKey: modelId,
      }));

    case "desensitize":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((src) => ({
          id: `${nodeId}-desensitized-${src.outputId}`,
          name: `${src.displayName}.脱敏`,
          description: `脱敏后文本: ${src.displayName}`,
          segmentKey: src.outputId,
        }));
      }
      // Fallback for legacy configs without inputSources
      return [{ id: `${nodeId}-desensitized`, name: "脱敏后文本", segmentKey: "desensitized" }];

    case "restore":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((src) => ({
          id: `${nodeId}-restored-${src.sourceNodeId}-${src.outputId}`,
          name: `${src.displayName}.恢复`,
          description: `恢复后文本: ${src.displayName}`,
          segmentKey: `${src.sourceNodeId}.${src.outputId}`,
        }));
      }
      return [{ id: `${nodeId}-restored`, name: "恢复后文本", segmentKey: "restored" }];

    case "export":
      return [];
  }
}
