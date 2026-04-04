import type { OutputDef } from "@intelliflow/shared";

/**
 * Resolve the canonical segmentKey for an OutputDef.
 *
 * Comparison rules:
 * - Prefer OutputDef.segmentKey if present (Phase 24+ canonical identifier)
 * - Fall back to OutputDef.id when segmentKey is absent (backward compatibility)
 *
 * This matters because VariableRef.outputId always stores the segmentKey,
 * so comparison must use the same resolution strategy on both sides.
 *
 * Key distinction:
 * - OutputDef.id — the stable output slot identifier, assigned at node config time
 * - OutputDef.segmentKey — the canonical path identifier for variable resolution
 *
 * When matching VariableRef.outputId against OutputDef fields, always resolve
 * to segmentKey (or id as fallback) on the OutputDef side.
 */
export function resolveOutputSegmentKey(outputDef: OutputDef): string {
  return outputDef.segmentKey ?? outputDef.id;
}

/**
 * Match a VariableRef.outputId against an OutputDef.
 *
 * Returns true if the variable's outputId refers to the given output definition.
 * Uses the same segmentKey resolution strategy on both sides.
 */
export function matchOutputRef(
  variableOutputId: string,
  outputDef: OutputDef,
): boolean {
  return resolveOutputSegmentKey(outputDef) === variableOutputId;
}
