import type { DesensitizeConfig, NodeConfig } from "@intelliflow/shared";

/**
 * Desensitize nodes always mirror their immediate upstream outputs.
 * Restore nodes support two modes:
 * 1. explicit inputSources (legacy/manual mode)
 * 2. implicit whitelist collection during execution when inputSources is empty
 *
 * For restore, only keep syncing when the workflow is already in explicit mode.
 * This avoids overwriting implicit restore workflows after they are opened/saved
 * in the editor.
 */
export function shouldAutoSyncInputSources(
  config: NodeConfig,
): config is DesensitizeConfig {
  if (config.type === "desensitize") return true;
  return false;
}
