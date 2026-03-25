import type { ModelCallStrategy } from "./base.strategy";
import { OpenAICompatibleStrategy } from "./openai-compatible.strategy";
import { ClaudeAgentSDKStrategy } from "./claude-agent-sdk.strategy";

export type { ModelCallInput, ModelCallResult, ModelCallStrategy } from "./base.strategy";

const openaiStrategy = new OpenAICompatibleStrategy();
const claudeStrategy = new ClaudeAgentSDKStrategy();

export function getStrategy(providerType: string): ModelCallStrategy {
  switch (providerType) {
    case "openai_compatible":
    case "opencode":
    case "ollama":
      return openaiStrategy;
    case "claude_agent_sdk":
      return claudeStrategy;
    default:
      throw new Error(`Unsupported provider type: ${providerType}`);
  }
}
