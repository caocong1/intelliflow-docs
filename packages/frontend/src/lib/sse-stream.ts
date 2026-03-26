/**
 * Shared SSE streaming utility extracted from ModelCallExecutor pattern.
 * Provides a reusable function for consuming Server-Sent Events from the backend.
 */

export interface SSEEvent {
  type: "delta" | "complete" | "error" | "status";
  modelId: string;
  data: string;
}

export interface SSEStreamOptions {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  onDelta: (modelId: string, data: string) => void;
  onComplete: (modelId: string, data: string) => void;
  onError: (modelId: string, data: string) => void;
  signal: AbortSignal;
}

/**
 * Stream SSE events from a backend endpoint.
 *
 * Follows the exact pattern from ModelCallExecutor.tsx:
 * - Gets auth token from localStorage
 * - Uses fetch with Authorization header and abort signal
 * - POST method: includes Content-Type application/json and stringified body
 * - Reads response body with ReadableStream reader
 * - Splits buffer on "\n\n", parses "data:" lines as JSON SSEEvent objects
 * - Calls appropriate callback based on event.type
 * - Handles AbortError silently
 */
export async function streamSSE(options: SSEStreamOptions): Promise<void> {
  const { url, method = "GET", body, onDelta, onComplete, onError, signal } = options;
  const token = localStorage.getItem("auth_token");

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      try {
        const parsed = JSON.parse(text);
        throw new Error(parsed.error ?? `HTTP ${response.status}`);
      } catch {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();

          try {
            const event = JSON.parse(dataStr) as SSEEvent;
            switch (event.type) {
              case "delta":
                onDelta(event.modelId, event.data);
                break;
              case "complete":
                onComplete(event.modelId, event.data);
                break;
              case "error":
                onError(event.modelId, event.data);
                break;
              // "status" events are informational, no callback needed
            }
          } catch {
            // Skip unparseable data lines
          }
        }
      }
    }
  } catch (err: unknown) {
    // Handle AbortError silently -- this is expected when user cancels
    if (err instanceof DOMException && err.name === "AbortError") return;
    throw err;
  }
}
