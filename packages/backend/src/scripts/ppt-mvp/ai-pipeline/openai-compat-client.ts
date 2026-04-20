/**
 * OpenAI-compatible LLM client for CLI scripts. Used when the dev
 * endpoint speaks standard /v1/chat/completions instead of Anthropic's
 * /v1/messages — e.g. 阿里百炼 (DashScope), 火山方舟 generic endpoint,
 * OpenAI itself, Ollama, etc.
 *
 * Two modes (same shape as ai-pipeline/claude-client.ts):
 *  - live: reads OPENAI_COMPAT_BASE_URL + OPENAI_COMPAT_API_KEY +
 *    OPENAI_COMPAT_MODEL from env
 *  - mock: CLAUDE_MOCK=1 or { mock: true }
 *
 * Exposes extractJson for response parsing (re-exported from the
 * claude-client to keep one source of truth).
 */
export type OpenAICompatCallOptions = {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  mockResponse?: string;
  mock?: boolean;
};

export type OpenAICompatCallResult = {
  content: string;
  durationMs: number;
  mode: "mock" | "live";
};

function isMockMode(opts: OpenAICompatCallOptions): boolean {
  if (opts.mock) return true;
  return process.env.CLAUDE_MOCK === "1" || process.env.CLAUDE_MOCK === "true";
}

export async function callOpenAICompat(
  opts: OpenAICompatCallOptions,
): Promise<OpenAICompatCallResult> {
  const t0 = Date.now();
  if (isMockMode(opts)) {
    if (typeof opts.mockResponse !== "string") {
      throw new Error(
        "OpenAI-compat mock mode active but no mockResponse supplied.",
      );
    }
    return { content: opts.mockResponse, durationMs: Date.now() - t0, mode: "mock" };
  }

  const baseUrl = process.env.OPENAI_COMPAT_BASE_URL;
  const apiKey = process.env.OPENAI_COMPAT_API_KEY;
  const model = process.env.OPENAI_COMPAT_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error(
      "Live OpenAI-compat call requires OPENAI_COMPAT_BASE_URL + OPENAI_COMPAT_API_KEY + OPENAI_COMPAT_MODEL env vars.",
    );
  }

  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.temperature != null && { temperature: opts.temperature }),
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI-compat HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
    error?: { message?: string };
  };

  if (body.error?.message) {
    throw new Error(`OpenAI-compat API error: ${body.error.message}`);
  }

  const content = (body.choices ?? [])
    .map((c) => c.message?.content ?? "")
    .join("");

  if (!content.trim()) {
    throw new Error(`OpenAI-compat API returned empty content: ${JSON.stringify(body).slice(0, 300)}`);
  }

  return { content, durationMs: Date.now() - t0, mode: "live" };
}
