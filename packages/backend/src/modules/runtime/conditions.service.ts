import type { NodeCondition, NodeExecutionRule } from "@intelliflow/shared";
import { resolveRef } from "./model-call.service";

/**
 * Evaluate a single NodeCondition against a resolved variable value.
 */
export function evaluateCondition(cond: NodeCondition, resolvedValue: string | undefined): boolean {
  switch (cond.operator) {
    case "exists":
      return resolvedValue !== undefined && resolvedValue !== "";
    case "not_exists":
      return resolvedValue === undefined || resolvedValue === "";
    case "equals":
      return resolvedValue === cond.value;
    case "not_equals":
      return resolvedValue !== cond.value;
    case "contains":
      return resolvedValue !== undefined && resolvedValue.includes(cond.value ?? "");
    default:
      return false;
  }
}

/**
 * Evaluate a NodeExecutionRule against current node executions.
 * Returns { triggered, reason } where triggered=true means the rule action should fire.
 */
export function evaluateExecutionRule(
  rule: NodeExecutionRule,
  nodeExecs: Array<{ nodeId: string; outputData: Record<string, unknown> | null }>,
): { triggered: boolean; reason: string } {
  // Evaluate each condition
  const results: Array<{ cond: NodeCondition; passed: boolean; value: string | undefined }> = [];

  for (const cond of rule.conditions) {
    const resolvedValue = resolveRef(
      { nodeId: cond.sourceRef.nodeId, outputId: cond.sourceRef.outputId, fieldPath: cond.sourceRef.fieldPath },
      nodeExecs,
    );
    const passed = evaluateCondition(cond, resolvedValue);
    results.push({ cond, passed, value: resolvedValue });
  }

  // Combine based on logic
  const triggered = rule.logic === "and"
    ? results.every((r) => r.passed)
    : results.some((r) => r.passed);

  // Build reason string from met conditions
  const metConditions = results
    .filter((r) => r.passed)
    .map((r) => {
      const val = r.value !== undefined ? `"${r.value}"` : "(空)";
      switch (r.cond.operator) {
        case "exists": return `${r.cond.sourceRef.variableName} 存在`;
        case "not_exists": return `${r.cond.sourceRef.variableName} 不存在`;
        case "equals": return `${r.cond.sourceRef.variableName} == "${r.cond.value}" (当前值: ${val})`;
        case "not_equals": return `${r.cond.sourceRef.variableName} != "${r.cond.value}" (当前值: ${val})`;
        case "contains": return `${r.cond.sourceRef.variableName} 包含 "${r.cond.value}"`;
        default: return `${r.cond.sourceRef.variableName} ${r.cond.operator} ${r.cond.value ?? ""}`;
      }
    });

  const reason = metConditions.join(rule.logic === "and" ? " AND " : " OR ");
  return { triggered, reason };
}
