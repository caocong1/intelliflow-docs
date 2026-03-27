import type { SSEEvent } from "@intelliflow/shared";
import type { ModelCallInput, ModelCallResult, ModelCallStrategy } from "./base.strategy";

/** OpenAI-compatible API strategy (also used for opencode type) */
export class OpenAICompatibleStrategy implements ModelCallStrategy {
  async execute({
    model,
    resolvedPrompt,
    resolvedSystemPrompt,
    sendEvent,
  }: {
    model: ModelCallInput;
    resolvedPrompt: string;
    resolvedSystemPrompt?: string;
    sendEvent: (event: SSEEvent) => void;
  }): Promise<ModelCallResult> {
    let fullContent = "";

    const messages: Array<{ role: string; content: string }> = [];
    if (resolvedSystemPrompt) {
      messages.push({ role: "system", content: resolvedSystemPrompt });
    }
    messages.push({ role: "user", content: resolvedPrompt });

    const body: Record<string, unknown> = {
      model: model.modelId,
      messages,
      stream: true,
    };

    if (model.temperature != null) body.temperature = model.temperature;
    if (model.maxTokens != null) body.max_tokens = model.maxTokens;
    if (model.topP != null) body.top_p = model.topP;

    const isOllama = model.providerType === "ollama";
    const url = isOllama
      ? `${model.baseUrl}/v1/chat/completions`
      : `${model.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!isOllama && model.apiKey) {
      headers.Authorization = `Bearer ${model.apiKey}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
    }

    if (!response.body) {
      throw new Error("No response body for streaming");
    }

    // Read SSE stream from provider
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
        if (dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            sendEvent({
              type: "delta",
              modelId: model.id,
              data: delta,
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
}
