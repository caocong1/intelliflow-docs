const CHAT_COMPLETIONS_SUFFIX = "/chat/completions";

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function hasChatCompletionsPath(url: string): boolean {
  return /\/(?:v1\/)?chat\/completions$/.test(url);
}

function hasV1Segment(url: string): boolean {
  return /\/v1(?:\/|$)/.test(url);
}

export function buildChatCompletionsUrl(
  baseUrl: string,
  providerType: "openai_compatible" | "opencode" | "ollama",
): string {
  const normalized = stripTrailingSlashes(baseUrl);

  if (hasChatCompletionsPath(normalized)) {
    return normalized;
  }

  if (providerType === "ollama" && !hasV1Segment(normalized)) {
    return `${normalized}/v1${CHAT_COMPLETIONS_SUFFIX}`;
  }

  return `${normalized}${CHAT_COMPLETIONS_SUFFIX}`;
}
