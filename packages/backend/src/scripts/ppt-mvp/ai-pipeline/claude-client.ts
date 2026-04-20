/**
 * Minimal Claude API client for CLI scripts.
 *
 * Two modes:
 *  - live (default): calls Anthropic Messages API. Reads ANTHROPIC_BASE_URL,
 *    ANTHROPIC_API_KEY, ANTHROPIC_MODEL from env.  Defaults work with the
 *    project's 火山方舟 endpoint when those env vars are set.
 *  - mock: returns canned responses. Triggered by CLAUDE_MOCK=1 or by
 *    explicitly passing { mock: true }.  The canned-response loader is
 *    plug-in (the orchestrator wires it).
 */

export type ClaudeCallOptions = {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Canned response, used in mock mode. If absent in mock mode, error. */
  mockResponse?: string;
  /** Force mock mode regardless of env. */
  mock?: boolean;
};

export type ClaudeCallResult = {
  content: string;
  durationMs: number;
  mode: "mock" | "live";
};

const DEFAULT_MODEL = "claude-sonnet-4-20250514";  // overridden by env or caller
const DEFAULT_MAX_TOKENS = 4096;

function isMockMode(opts: ClaudeCallOptions): boolean {
  if (opts.mock) return true;
  return process.env.CLAUDE_MOCK === "1" || process.env.CLAUDE_MOCK === "true";
}

export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeCallResult> {
  const t0 = Date.now();

  if (isMockMode(opts)) {
    if (typeof opts.mockResponse !== "string") {
      throw new Error(
        "Claude mock mode active but no mockResponse supplied. " +
          "Either pass mockResponse or unset CLAUDE_MOCK to call live API.",
      );
    }
    return { content: opts.mockResponse, durationMs: Date.now() - t0, mode: "mock" };
  }

  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Live Claude call requires ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN). " +
        "To run without credentials use CLAUDE_MOCK=1.",
    );
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: opts.prompt }],
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(opts.temperature != null && { temperature: opts.temperature }),
      ...(opts.system && { system: opts.system }),
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Claude API HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const body = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  };

  if (body.error?.message) {
    throw new Error(`Claude API error: ${body.error.message}`);
  }

  const content = (body.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text!)
    .join("");

  if (!content.trim()) {
    throw new Error("Claude API returned empty content");
  }

  return { content, durationMs: Date.now() - t0, mode: "live" };
}

/** Extract a fenced code block of given language from a response. */
export function extractFencedCode(text: string, lang: string): string | null {
  const re = new RegExp(`\`\`\`${lang}\\s*\\n([\\s\\S]*?)\`\`\``, "i");
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/** Extract the first JSON object/array from a response, supporting ```json fences. */
export function extractJson<T = unknown>(text: string): T {
  const fenced = extractFencedCode(text, "json");
  const candidate = fenced ?? text;

  // Find start of first JSON value
  const trimmed = candidate.trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const validStarts = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (validStarts.length === 0) {
    throw new Error("No JSON object/array found in response");
  }
  const start = Math.min(...validStarts);

  const attempt = trimmed.slice(start);
  // Fast path: entire remainder is valid JSON
  try {
    return JSON.parse(attempt) as T;
  } catch {
    // continue to shrink-from-end
  }
  // Shrink from end in case there is trailing prose
  for (let cut = attempt.length - 1; cut > 0; cut -= 1) {
    const last = attempt[cut];
    // Only try to parse when we're at a plausible JSON-value terminator
    if (last !== "}" && last !== "]") continue;
    try {
      return JSON.parse(attempt.slice(0, cut + 1)) as T;
    } catch {
      // keep shrinking
    }
  }
  throw new Error("Failed to parse JSON from Claude response");
}
