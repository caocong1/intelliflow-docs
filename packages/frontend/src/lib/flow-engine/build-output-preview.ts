import type { NamedOutputDef } from "@intelliflow/shared";

/**
 * Build a preview string showing what the system will inject into the final prompt
 * for a given named output. Mirrors the backend merging logic (model-call.service.ts).
 */
export function buildOutputBlockPreview(output: NamedOutputDef): string {
  const parts: string[] = [];

  // 1. Per-output prompt (user-written)
  if (output.outputPrompt?.trim()) {
    parts.push(output.outputPrompt.trim());
  }

  // 2. JSON field structure description (when simpleFields are defined)
  if (output.format === "json" && output.simpleFields?.length) {
    const fieldLines = output.simpleFields
      .map(
        (f) =>
          `- ${f.name} (${f.type}, ${f.required ? "必填" : "可选"})${f.description ? `: ${f.description}` : ""}`,
      )
      .join("\n");
    parts.push(`请输出 JSON 对象，包含以下字段：\n${fieldLines}`);
  }

  // 3. Fallback placeholder
  if (parts.length === 0) {
    parts.push(`[${output.name || "产物"}内容]`);
  }

  return `===OUTPUT:${output.id}===\n${parts.join("\n\n")}\n===END:${output.id}===`;
}
