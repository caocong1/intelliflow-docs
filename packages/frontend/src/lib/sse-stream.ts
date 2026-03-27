/**
 * Shared SSE streaming utility extracted from ModelCallExecutor pattern.
 * Provides a reusable function for consuming Server-Sent Events from the backend.
 *
 * Uses XMLHttpRequest with onprogress for reliable chunked streaming through
 * dev proxies. Fetch + ReadableStream can stall in some proxy configurations.
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

function parseSSEChunks(
  raw: string,
  callbacks: Pick<SSEStreamOptions, "onDelta" | "onComplete" | "onError">,
) {
  const chunks = raw.split("\n\n");
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      try {
        const event = JSON.parse(dataStr) as SSEEvent;
        switch (event.type) {
          case "delta":
            callbacks.onDelta(event.modelId, event.data);
            break;
          case "complete":
            callbacks.onComplete(event.modelId, event.data);
            break;
          case "error":
            callbacks.onError(event.modelId, event.data);
            break;
          // "status" events are informational, no callback needed
        }
      } catch {
        // Skip unparseable data lines
      }
    }
  }
}

/**
 * Stream SSE events from a backend endpoint.
 *
 * Uses XHR with onprogress to reliably receive chunked data through dev proxies.
 * Falls back gracefully when the full response arrives at once (proxy buffering).
 */
export function streamSSE(options: SSEStreamOptions): Promise<void> {
  const { url, method = "GET", body, onDelta, onComplete, onError, signal } = options;
  const token = localStorage.getItem("auth_token");

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processedLength = 0;

    xhr.open(method, url, true);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    if (method === "POST") {
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    // Handle abort signal
    const onAbort = () => {
      xhr.abort();
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });

    xhr.onprogress = () => {
      const newData = xhr.responseText.slice(processedLength);
      if (!newData) return;
      processedLength = xhr.responseText.length;
      parseSSEChunks(newData, { onDelta, onComplete, onError });
    };

    xhr.onload = () => {
      signal.removeEventListener("abort", onAbort);
      if (xhr.status >= 400) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          reject(new Error(parsed.error ?? `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
        }
        return;
      }
      // Process any remaining data not caught by onprogress
      const remaining = xhr.responseText.slice(processedLength);
      if (remaining) {
        parseSSEChunks(remaining, { onDelta, onComplete, onError });
      }
      resolve();
    };

    xhr.onerror = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error("网络请求失败"));
    };

    xhr.onabort = () => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    };

    xhr.send(method === "POST" && body !== undefined ? JSON.stringify(body) : undefined);
  });
}
