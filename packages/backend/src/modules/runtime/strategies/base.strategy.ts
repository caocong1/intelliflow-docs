import type { SSEEvent } from "@intelliflow/shared";

/** Model row data passed to strategies */
export interface ModelCallInput {
  id: string;
  modelId: string;
  displayName: string;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  baseUrl: string;
  apiKey: string | null;
  /** Provider type — strategies are dispatched by this */
  providerType: "openai_compatible" | "opencode" | "claude_agent_sdk" | "ollama";
  /** Agent SDK specific fields */
  agentMode?: string | null;
  agentMaxTurns?: number | null;
  agentMaxBudgetUsd?: string | null;
  agentAllowedTools?: string[] | null;
}

export interface ModelCallResult {
  modelId: string;
  content: string;
  status: "completed" | "failed";
  errorMessage?: string;
}

/** Strategy interface for model call execution */
export interface ModelCallStrategy {
  execute(params: {
    model: ModelCallInput;
    resolvedPrompt: string;
    resolvedSystemPrompt?: string;
    sendEvent: (event: SSEEvent) => void;
  }): Promise<ModelCallResult>;
}
