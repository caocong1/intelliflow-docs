import type { NodeConfig, OutputDef, SkipBinding } from "@intelliflow/shared";
import { getSkipStrategyTargets } from "../../../../shared/src/types";

export function getConfigurableSkipOutputs(nodeId: string, config: NodeConfig): OutputDef[] {
  return getSkipStrategyTargets(nodeId, config);
}

export function getSkipBinding(config: NodeConfig, outputId: string): SkipBinding | undefined {
  return config.skipStrategy?.bindings?.[outputId];
}
