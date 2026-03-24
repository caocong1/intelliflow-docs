import type { NodeConfig, OutputDef } from "@intelliflow/shared";

/**
 * Auto-derive output definitions from a node's config.
 * Uses deterministic IDs so downstream variable references remain stable.
 */
export function deriveOutputs(nodeId: string, config: NodeConfig): OutputDef[] {
  switch (config.type) {
    case "input_transform": {
      const outputs: OutputDef[] = [];
      for (const field of config.formFields) {
        if (field.type === "text" || field.type === "textarea") {
          outputs.push({
            id: `${nodeId}-field-${field.id}`,
            name: field.label || "未命名",
            description: `用户输入项: ${field.label}`,
          });
        }
      }
      const hasFileField = config.formFields.some((f) => f.type === "file");
      if (hasFileField) {
        outputs.push({
          id: `${nodeId}-file-upload`,
          name: "文件输出 (动态)",
          description: "运行时按实际上传数量展开",
        });
      }
      return outputs;
    }

    case "model_call":
      return config.modelIds.map((modelId) => ({
        id: `${nodeId}-model-${modelId}`,
        name: config.modelNames?.[modelId] ?? modelId,
        description: "模型生成输出",
      }));

    case "desensitize":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((src) => ({
          id: `${nodeId}-desensitized-${src.outputId}`,
          name: `${src.displayName}.脱敏`,
          description: `脱敏后文本: ${src.displayName}`,
        }));
      }
      // Fallback for legacy configs without inputSources
      return [{ id: `${nodeId}-desensitized`, name: "脱敏后文本" }];

    case "restore":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((src) => ({
          id: `${nodeId}-restored-${src.outputId}`,
          name: `${src.displayName}.恢复`,
          description: `恢复后文本: ${src.displayName}`,
        }));
      }
      return [{ id: `${nodeId}-restored`, name: "恢复后文本" }];

    case "export":
      return [];
  }
}
