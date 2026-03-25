import type { SSEEvent } from "@intelliflow/shared";
import type { ModelCallInput, ModelCallResult, ModelCallStrategy } from "./base.strategy";

/** Claude Agent SDK strategy — uses Anthropic Messages API for streaming */
export class ClaudeAgentSDKStrategy implements ModelCallStrategy {
  async execute({
    model,
    resolvedPrompt,
    sendEvent,
  }: {
    model: ModelCallInput;
    resolvedPrompt: string;
    sendEvent: (event: SSEEvent) => void;
  }): Promise<ModelCallResult> {
    let fullContent = "";

    const agentMode = model.agentMode ?? "simple_chat";

    if (agentMode === "autonomous_agent") {
      return this.executeAutonomous({ model, resolvedPrompt, sendEvent });
    }

    // Simple chat mode: use Anthropic Messages API with streaming
    const response = await fetch(`${model.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": model.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: [{ role: "user", content: resolvedPrompt }],
        max_tokens: model.maxTokens ?? 4096,
        stream: true,
        ...(model.temperature != null && { temperature: model.temperature }),
        ...(model.topP != null && { top_p: model.topP }),
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
    }

    if (!response.body) {
      throw new Error("No response body for streaming");
    }

    // Parse Anthropic SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();

        try {
          const parsed = JSON.parse(dataStr) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };

          // Anthropic streaming: content_block_delta with text delta
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            fullContent += parsed.delta.text;
            sendEvent({
              type: "delta",
              modelId: model.id,
              data: parsed.delta.text,
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    return { modelId: model.id, content: fullContent, status: "completed" };
  }

  /** Autonomous agent mode: uses Claude Agent SDK query() */
  private async executeAutonomous({
    model,
    resolvedPrompt,
    sendEvent,
  }: {
    model: ModelCallInput;
    resolvedPrompt: string;
    sendEvent: (event: SSEEvent) => void;
  }): Promise<ModelCallResult> {
    // Dynamic import to avoid loading SDK when not needed
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    let fullContent = "";
    const allowedTools = model.agentAllowedTools ?? ["Read", "Write", "Glob", "Grep"];
    const maxTurns = model.agentMaxTurns ?? 15;
    const maxBudgetUsd = model.agentMaxBudgetUsd ? Number.parseFloat(model.agentMaxBudgetUsd) : 2.0;

    for await (const msg of query({
      prompt: resolvedPrompt,
      options: {
        allowedTools: allowedTools,
        disallowedTools: ["Bash"],
        model: model.modelId,
        env: {
          ANTHROPIC_AUTH_TOKEN: model.apiKey || "",
          ANTHROPIC_BASE_URL: model.baseUrl,
          ANTHROPIC_MODEL: model.modelId,
        },
        maxTurns,
        maxBudgetUsd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    })) {
      const message = msg as Record<string, unknown>;

      // Text output
      if (message.type === "assistant" && message.subtype === "text" && typeof message.content === "string") {
        fullContent += message.content;
        sendEvent({
          type: "delta",
          modelId: model.id,
          data: message.content,
          timestamp: new Date().toISOString(),
        });
      }

      // Tool use status
      if (message.type === "assistant" && message.subtype === "tool_use" && typeof message.tool_name === "string") {
        sendEvent({
          type: "status",
          modelId: model.id,
          data: `thinking:${message.tool_name}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Final result
      if ("result" in message && typeof message.result === "string") {
        if (!fullContent) fullContent = message.result;
      }
    }

    return { modelId: model.id, content: fullContent, status: "completed" };
  }
}
