import type { ModelCallConfig, ModelOutput, NamedOutputDef, NodeExecution, SSEEvent } from "@intelliflow/shared";
import { For, Match, Show, Switch, createEffect, createSignal, onCleanup } from "solid-js";
import { renderMarkdown } from "../../../lib/render-markdown";
import { streamSSE } from "../../../lib/sse-stream";
import ModelCompareView from "./ModelCompareView";
import NamedOutputCard from "./NamedOutputCard";

interface Props {
  nodeExecution: NodeExecution;
  config: ModelCallConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  readOnly: boolean;
}

type ExecutionPhase = "idle" | "streaming" | "polling" | "done";

type ViewMode = "markdown" | "source";

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  streaming: "生成中",
  completed: "已完成",
  failed: "失败",
  format_error: "格式错误",
};

const ERROR_MESSAGES: Record<string, string> = {
  timeout: "网络超时，请重试",
  api_error: "API 调用失败",
  unavailable: "模型不可用",
};

// RECV-03: Cancel AI generation deferred to v2 per user decision

export default function ModelCallExecutor(props: Props) {
  // ─── Existing output detection ──────────────────────────────────────────────

  const existingModels = (): Record<string, ModelOutput> => {
    const od = props.nodeExecution.outputData as Record<string, unknown> | null;
    return (od?.models as Record<string, ModelOutput>) ?? {};
  };

  const hasExistingOutput = () => Object.keys(existingModels()).length > 0;
  const isMultiModel = () => {
    const ids = props.config.modelIds ?? [];
    return ids.length > 1;
  };
  const hasConfiguredModels = () => {
    const ids = props.config.modelIds ?? [];
    return ids.length > 0;
  };

  // ─── Determine initial phase from existing outputData ────────────────────────
  // NEVER re-trigger model call if models already exist in outputData

  function computeInitialPhase(): ExecutionPhase {
    const models = existingModels();
    const entries = Object.values(models);
    if (entries.length === 0) return "idle";

    // If any model is still streaming, poll for status (reconnect safety)
    const hasStreaming = entries.some((m) => m.status === "streaming");
    if (hasStreaming) return "polling";

    return "done";
  }

  const [phase, setPhase] = createSignal<ExecutionPhase>(computeInitialPhase());
  const [modelOutputs, setModelOutputs] = createSignal<Record<string, ModelOutput>>(
    existingModels(),
  );
  const [activeTab, setActiveTab] = createSignal<string>("");
  const [showCompare, setShowCompare] = createSignal(false);
  const [selectedModelId, setSelectedModelId] = createSignal<string>(
    props.nodeExecution.selectedOutputKey ?? "",
  );
  const [error, setError] = createSignal<string | null>(null);
  const [selectLoading, setSelectLoading] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>("markdown");

  // ─── Format error + AI fix state ──────────────────────────────────────────
  const [editedContent, setEditedContent] = createSignal<Record<string, string>>({});
  const [revalidating, setRevalidating] = createSignal<string | null>(null);
  const [aiFixModelId, setAiFixModelId] = createSignal<string | null>(null);
  const [aiFixStreaming, setAiFixStreaming] = createSignal(false);
  const [aiFixContent, setAiFixContent] = createSignal("");
  let aiFixAbort: AbortController | null = null;

  // ─── Named outputs from outputData ────────────────────────────────────────
  const namedOutputs = () => {
    const od = props.nodeExecution.outputData as Record<string, unknown> | null;
    return (od?.namedOutputs as Record<string, { content: string; format: string; modelId: string }>) ?? null;
  };

  const fallbackWarning = () => {
    const od = props.nodeExecution.outputData as Record<string, unknown> | null;
    return (od?.fallbackWarning as boolean) ?? false;
  };

  const hasNamedOutputs = () => {
    const no = namedOutputs();
    return no !== null && Object.keys(no).length > 0;
  };

  const namedOutputDefs = (): NamedOutputDef[] => {
    return props.config.namedOutputs ?? [];
  };

  let abortController: AbortController | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  onCleanup(() => {
    abortController?.abort();
    if (pollTimer) clearInterval(pollTimer);
  });

  // ─── SSE Reconnect Safety: Poll /status instead of re-triggering ────────────

  function startStatusPolling() {
    if (pollTimer) clearInterval(pollTimer);

    pollTimer = setInterval(async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(
          `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/status`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );

        if (!res.ok) return;

        const data = (await res.json()) as {
          models: Record<string, { status: string; content?: string; errorMessage?: string }>;
        };

        // Update model outputs from polled status
        setModelOutputs((prev) => {
          const updated = { ...prev };
          for (const [modelId, info] of Object.entries(data.models)) {
            const existing = updated[modelId];
            if (existing) {
              updated[modelId] = {
                ...existing,
                status: info.status as ModelOutput["status"],
                content: info.content ?? existing.content,
                errorMessage: info.errorMessage,
              };
            }
          }
          return updated;
        });

        // Check if all models are done
        const allDone = Object.values(data.models).every(
          (m) => m.status === "completed" || m.status === "failed" || m.status === "format_error",
        );
        if (allDone) {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          setPhase("done");
        }
      } catch {
        // Polling errors are non-fatal, will retry on next interval
      }
    }, 3000);
  }

  // Start polling if initial phase is "polling" (reconnect scenario)
  createEffect(() => {
    if (phase() === "polling") {
      startStatusPolling();
    }
  });

  // Set initial active tab
  createEffect(() => {
    if (!activeTab()) {
      const keys = Object.keys(modelOutputs());
      if (keys.length > 0) {
        setActiveTab(keys[0]);
      }
    }
  });

  // ─── SSE Streaming ─────────────────────────────────────────────────────────

  async function startStreaming(url: string) {
    const token = localStorage.getItem("auth_token");
    abortController = new AbortController();

    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: abortController.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        try {
          const parsed = JSON.parse(body);
          throw new Error(parsed.error ?? `HTTP ${response.status}`);
        } catch {
          throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
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
              handleSSEEvent(event);
            } catch {
              // Skip unparseable
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      setError(localizeError(message));
    }

    setPhase("done");
  }

  function handleSSEEvent(event: SSEEvent) {
    setModelOutputs((prev) => {
      const current = { ...prev };
      const existing = current[event.modelId] ?? {
        modelId: event.modelId,
        modelDisplayName: props.config.modelNames?.[event.modelId] ?? event.modelId,
        content: "",
        status: "pending" as const,
      };

      switch (event.type) {
        case "status":
          current[event.modelId] = { ...existing, status: "streaming" };
          break;
        case "delta":
          current[event.modelId] = {
            ...existing,
            content: existing.content + event.data,
            status: "streaming",
          };
          break;
        case "complete":
          current[event.modelId] = {
            ...existing,
            content: event.data,
            status: "completed",
          };
          break;
        case "error":
          current[event.modelId] = {
            ...existing,
            status: "failed",
            errorMessage: event.data,
          };
          break;
      }

      return current;
    });

    // Set first tab if not set
    if (!activeTab()) {
      setActiveTab(event.modelId);
    }
  }

  // ─── Error localization ─────────────────────────────────────────────────────

  function localizeError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return ERROR_MESSAGES.timeout;
    }
    if (lower.includes("unavailable") || lower.includes("not found")) {
      return ERROR_MESSAGES.unavailable;
    }
    if (lower.includes("api") || lower.includes("http")) {
      return `${ERROR_MESSAGES.api_error}: ${message}`;
    }
    return message;
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  function handleStartGeneration() {
    // NEVER call execute if models already exist in outputData
    if (hasExistingOutput()) return;

    setPhase("streaming");
    setError(null);
    setModelOutputs({});
    const url = `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/execute`;
    startStreaming(url);
  }

  function handleRetry(modelId: string) {
    setError(null);
    setPhase("streaming");
    // Reset this model to streaming
    setModelOutputs((prev) => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        content: "",
        status: "streaming" as const,
        errorMessage: undefined,
      },
    }));

    const url = `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/retry/${modelId}`;
    startStreaming(url);
  }

  async function handleSelect(modelId: string) {
    setSelectLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/select`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ selectedModelId: modelId }),
        },
      );

      if (res.ok) {
        setSelectedModelId(modelId);
        const selected = modelOutputs()[modelId];
        if (selected) {
          props.onDraftSave({
            models: modelOutputs(),
            selectedContent: selected.content,
            text: selected.content,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setSelectLoading(false);
    }
  }

  // ─── Format error: Revalidate & AI Fix ──────────────────────────────────

  async function handleRevalidate(modelId: string) {
    setRevalidating(modelId);
    try {
      const token = localStorage.getItem("auth_token");
      const content = editedContent()[modelId] ?? modelOutputs()[modelId]?.content ?? "";
      const res = await fetch(
        `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/models/${modelId}/revalidate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { status: string; errors?: string[] };
        setModelOutputs((prev) => ({
          ...prev,
          [modelId]: {
            ...prev[modelId],
            content,
            status: data.status as ModelOutput["status"],
            formatErrors: data.errors,
          },
        }));
        if (data.status === "completed") {
          // Clear edited content on success
          setEditedContent((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setRevalidating(null);
    }
  }

  async function handleAiFix(modelId: string) {
    setAiFixModelId(modelId);
    setAiFixStreaming(true);
    setAiFixContent("");

    const controller = new AbortController();
    aiFixAbort = controller;

    try {
      await streamSSE({
        url: `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/models/${modelId}/ai-fix`,
        method: "POST",
        onDelta: (_mid, data) => {
          setAiFixContent((prev) => prev + data);
        },
        onComplete: (_mid, data) => {
          setAiFixContent(data);
          setAiFixStreaming(false);
        },
        onError: (_mid, _data) => {
          setAiFixStreaming(false);
          setAiFixModelId(null);
        },
        signal: controller.signal,
      });
    } catch {
      setAiFixStreaming(false);
      setAiFixModelId(null);
    }
  }

  function handleAdoptFix(modelId: string) {
    const fixed = aiFixContent();
    setEditedContent((prev) => ({ ...prev, [modelId]: fixed }));
    setAiFixModelId(null);
    setAiFixContent("");
    // Auto-revalidate with fixed content
    handleRevalidate(modelId);
  }

  function handleCancelFix() {
    aiFixAbort?.abort();
    aiFixAbort = null;
    setAiFixModelId(null);
    setAiFixStreaming(false);
    setAiFixContent("");
  }

  function handleNamedOutputChange(artifactId: string, newContent: string) {
    // Update outputData namedOutputs via draft save
    const od = props.nodeExecution.outputData as Record<string, unknown> | null;
    const currentNamedOutputs = (od?.namedOutputs as Record<string, { content: string; format: string; modelId: string }>) ?? {};
    const updated = {
      ...currentNamedOutputs,
      [artifactId]: { ...currentNamedOutputs[artifactId], content: newContent },
    };
    props.onDraftSave({
      ...od,
      namedOutputs: updated,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function modelList(): ModelOutput[] {
    return Object.values(modelOutputs());
  }

  function allCompleted(): boolean {
    const outputs = modelList();
    return (
      outputs.length > 0 && outputs.every((m) => m.status === "completed" || m.status === "failed" || m.status === "format_error")
    );
  }

  function hasAnyCompleted(): boolean {
    return modelList().some((m) => m.status === "completed");
  }

  function statusBadge(status: ModelOutput["status"]) {
    const label = STATUS_LABELS[status] ?? status;
    switch (status) {
      case "pending":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f7f9fb] text-[#464555] ring-1 ring-[rgba(199,196,216,0.4)]">
            <span class="w-1.5 h-1.5 rounded-full bg-[#c7c4d8]" />
            {label}
          </span>
        );
      case "streaming":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            {label}
          </span>
        );
      case "completed":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <svg
              class="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {label}
          </span>
        );
      case "failed":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500 ring-1 ring-red-200">
            <svg
              class="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {label}
          </span>
        );
      case "format_error":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 ring-1 ring-orange-200">
            <svg
              class="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            {label}
          </span>
        );
    }
  }

  // ─── Format error rendering helper ───────────────────────────────────────

  function renderFormatError(model: ModelOutput) {
    const mid = model.modelId;
    const currentContent = () => editedContent()[mid] ?? model.content;

    return (
      <div class="space-y-3">
        {/* Error box */}
        <div class="border border-red-300 bg-red-50 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <span class="text-sm font-medium text-red-700">JSON 格式验证失败</span>
          </div>
          <Show when={model.formatErrors && model.formatErrors.length > 0}>
            <ul class="list-disc list-inside space-y-1">
              <For each={model.formatErrors}>
                {(err) => (
                  <li class="text-xs text-red-600">{err}</li>
                )}
              </For>
            </ul>
          </Show>
        </div>

        {/* Editable textarea */}
        <div class="border border-red-200 rounded-xl overflow-hidden">
          <textarea
            value={currentContent()}
            onInput={(e) => setEditedContent((prev) => ({ ...prev, [mid]: e.currentTarget.value }))}
            class="w-full min-h-[200px] max-h-[500px] p-4 text-sm font-mono text-[#191c1e] bg-[#fffbfb] border-0 focus:outline-none focus:ring-0 resize-y"
          />
        </div>

        {/* Action buttons */}
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            onClick={() => handleRevalidate(mid)}
            disabled={revalidating() === mid}
          >
            {revalidating() === mid ? "验证中..." : "重新验证"}
          </button>
          <button
            type="button"
            class="px-4 py-2 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
            onClick={() => handleAiFix(mid)}
            disabled={aiFixModelId() !== null}
          >
            AI 修复
          </button>
        </div>

        {/* AI Fix streaming preview */}
        <Show when={aiFixModelId() === mid}>
          <div class="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
            <div class="flex items-center gap-2">
              <Show when={aiFixStreaming()}>
                <span class="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              </Show>
              <span class="text-sm font-medium text-blue-700">
                {aiFixStreaming() ? "AI 修复中..." : "修复完成"}
              </span>
            </div>
            <pre class="text-sm font-mono text-[#191c1e] whitespace-pre-wrap bg-white rounded-lg p-3 max-h-[300px] overflow-y-auto border border-blue-100">
              {aiFixContent() || "..."}
            </pre>
            <Show when={!aiFixStreaming()}>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                  onClick={() => handleAdoptFix(mid)}
                >
                  采用修复
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-medium text-[#464555] border border-[rgba(199,196,216,0.3)] rounded-lg hover:bg-[#f7f9fb] transition-colors"
                  onClick={handleCancelFix}
                >
                  取消
                </button>
              </div>
            </Show>
            <Show when={aiFixStreaming()}>
              <button
                type="button"
                class="px-4 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                onClick={handleCancelFix}
              >
                取消修复
              </button>
            </Show>
          </div>
        </Show>
      </div>
    );
  }

  // renderMarkdown is imported from lib/render-markdown.tsx

  // ─── Read-only mode ──────────────────────────────────────────────────────

  if (props.readOnly) {
    const selected = selectedModelId();
    const output = existingModels()[selected];
    const content =
      output?.content ??
      ((props.nodeExecution.outputData as Record<string, unknown>)?.selectedContent as string) ??
      "";

    return (
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-[#191c1e]">模型输出</h3>
          <Show when={output}>
            <span class="text-xs text-[#464555]">({output?.modelDisplayName})</span>
          </Show>
        </div>
        <div class="bg-[#f7f9fb] rounded-xl p-4">{renderMarkdown(content)}</div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-r from-[#f2f4f6] to-white px-6 py-5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#e2dfff] flex items-center justify-center flex-shrink-0">
            <svg
              class="w-5 h-5 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[#191c1e]">
              {props.config.displayName ?? "模型调用"}
            </h3>
            <p class="text-xs text-[#464555] mt-0.5">
              {isMultiModel() ? "多模型对比模式" : "单模型模式"}
            </p>
          </div>
        </div>

        {/* View toggle (Markdown / source) */}
        <Show when={phase() !== "idle" && modelList().length > 0}>
          <div class="flex items-center gap-1 bg-[#eceef0] rounded-lg p-0.5">
            <button
              type="button"
              class={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode() === "markdown"
                  ? "bg-white text-[#191c1e] shadow-sm"
                  : "text-[#464555] hover:text-[#191c1e]"
              }`}
              onClick={() => setViewMode("markdown")}
            >
              Markdown 视图
            </button>
            <button
              type="button"
              class={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode() === "source"
                  ? "bg-white text-[#191c1e] shadow-sm"
                  : "text-[#464555] hover:text-[#191c1e]"
              }`}
              onClick={() => setViewMode("source")}
            >
              源码视图
            </button>
          </div>
        </Show>
      </div>

      <div class="px-6 py-5 space-y-4">
        {/* Error */}
        <Show when={error()}>
          <div class="bg-[#fef2f2] text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            {error()}
          </div>
        </Show>

        {/* No models configured */}
        <Show when={!hasConfiguredModels()}>
          <div class="bg-[#fffbeb] rounded-xl p-6 text-center">
            <div class="text-amber-600 text-sm font-medium">未配置模型</div>
            <p class="text-xs text-amber-500 mt-1">请在工作流编辑器中为此节点配置模型</p>
          </div>
        </Show>

        {/* Idle — start button */}
        <Show when={phase() === "idle" && hasConfiguredModels()}>
          <div class="flex flex-col items-center gap-4 py-6">
            <div class="w-16 h-16 rounded-2xl bg-[#f7f9fb] flex items-center justify-center">
              <svg
                class="w-8 h-8 text-[#464555]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                />
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-medium text-[#191c1e]">尚未开始生成</p>
              <p class="text-xs text-[#464555] mt-1">
                {isMultiModel()
                  ? `将并行调用 ${props.config.modelIds.length} 个模型`
                  : "点击下方按钮开始调用模型"}
              </p>
            </div>
            <button
              type="button"
              class="px-6 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-br from-[#3525cd] to-[#4f46e5] hover:opacity-90 transition-opacity shadow-sm"
              onClick={handleStartGeneration}
            >
              开始生成
            </button>
          </div>
        </Show>

        {/* Polling state (reconnect) */}
        <Show when={phase() === "polling"}>
          <div class="bg-indigo-50 rounded-xl px-4 py-3 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            <span class="text-sm text-indigo-700">模型生成中，正在获取最新状态...</span>
          </div>
        </Show>

        {/* Streaming / Polling / Done */}
        <Show when={phase() !== "idle"}>
          <Switch>
            {/* Compare view */}
            <Match when={showCompare() && isMultiModel()}>
              <ModelCompareView
                models={modelOutputs()}
                renderMarkdown={renderMarkdown}
                onClose={() => setShowCompare(false)}
              />
            </Match>

            {/* Single model mode */}
            <Match when={!isMultiModel()}>
              <Show when={modelList().length > 0}>
                {(() => {
                  const model = () => modelList()[0];
                  return (
                    <div class="space-y-3">
                      <div class="flex items-center gap-2">
                        <h4 class="text-sm font-medium text-[#191c1e]">
                          {model()?.modelDisplayName}
                        </h4>
                        {statusBadge(model()?.status ?? "pending")}
                      </div>

                      <Show when={model()?.status === "failed"}>
                        <div class="bg-[#fef2f2] rounded-xl p-3 flex items-center justify-between">
                          <span class="text-sm text-red-600">
                            {model()?.errorMessage
                              ? localizeError(model()?.errorMessage ?? "")
                              : "生成失败"}
                          </span>
                          <button
                            type="button"
                            class="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                            onClick={() => {
                              const m = model();
                              if (m) handleRetry(m.modelId);
                            }}
                          >
                            重试
                          </button>
                        </div>
                      </Show>

                      {/* format_error display */}
                      <Show when={model()?.status === "format_error" ? model() : undefined}>
                        {(errorModel) => renderFormatError(errorModel())}
                      </Show>

                      {/* Normal content (not format_error) */}
                      <Show when={model()?.status !== "format_error"}>
                        <div class="bg-[#f7f9fb] rounded-xl p-4 min-h-[200px] max-h-[500px] overflow-y-auto">
                          <Show
                            when={viewMode() === "markdown"}
                            fallback={
                              <pre class="text-sm text-[#191c1e] whitespace-pre-wrap font-mono leading-relaxed">
                                {model()?.content ?? ""}
                              </pre>
                            }
                          >
                            {renderMarkdown(model()?.content ?? "")}
                          </Show>
                          <Show when={model()?.status === "streaming"}>
                            <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                          </Show>
                        </div>
                      </Show>
                    </div>
                  );
                })()}
              </Show>
            </Match>

            {/* Multi-model tab mode */}
            <Match when={isMultiModel() && !showCompare()}>
              <div class="space-y-3">
                {/* Tab bar */}
                <div class="flex items-center gap-1 border-b border-[rgba(199,196,216,0.2)]">
                  <For each={modelList()}>
                    {(model) => (
                      <button
                        type="button"
                        class={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                          activeTab() === model.modelId
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-[#464555] hover:text-[#191c1e]"
                        }`}
                        onClick={() => setActiveTab(model.modelId)}
                      >
                        <span class="mr-1.5">{model.modelDisplayName}</span>
                        {statusBadge(model.status)}
                      </button>
                    )}
                  </For>

                  {/* Compare button */}
                  <Show when={modelList().length >= 2}>
                    <button
                      type="button"
                      class="ml-auto px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                      onClick={() => setShowCompare(true)}
                    >
                      多模型对比
                    </button>
                  </Show>
                </div>

                {/* Active tab content */}
                <Show when={modelOutputs()[activeTab()]}>
                  {(model) => (
                    <div class="space-y-3">
                      <Show when={model().status === "failed"}>
                        <div class="bg-[#fef2f2] rounded-xl p-3 flex items-center justify-between">
                          <span class="text-sm text-red-600">
                            {model().errorMessage
                              ? localizeError(model().errorMessage ?? "")
                              : "生成失败"}
                          </span>
                          <button
                            type="button"
                            class="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                            onClick={() => handleRetry(model().modelId)}
                          >
                            重试
                          </button>
                        </div>
                      </Show>

                      {/* format_error display */}
                      <Show when={model().status === "format_error"}>
                        {renderFormatError(model())}
                      </Show>

                      {/* Normal content (not format_error) */}
                      <Show when={model().status !== "format_error"}>
                        <div class="bg-[#f7f9fb] rounded-xl p-4 min-h-[200px] max-h-[500px] overflow-y-auto">
                          <Show
                            when={viewMode() === "markdown"}
                            fallback={
                              <pre class="text-sm text-[#191c1e] whitespace-pre-wrap font-mono leading-relaxed">
                                {model().content}
                              </pre>
                            }
                          >
                            {renderMarkdown(model().content)}
                          </Show>
                          <Show when={model().status === "streaming"}>
                            <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                          </Show>
                        </div>
                      </Show>
                    </div>
                  )}
                </Show>
              </div>
            </Match>
          </Switch>

          {/* Fallback warning */}
          <Show when={fallbackWarning() && phase() === "done"}>
            <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              <span class="text-sm text-amber-700">模型未按预期格式输出，已合并为单个产物</span>
            </div>
          </Show>

          {/* Named output cards */}
          <Show when={hasNamedOutputs() && phase() === "done"}>
            <div class="space-y-3">
              <Show when={isMultiModel()}>
                {/* Multi-model: group by model */}
                <For each={modelList().filter((m) => m.status === "completed" || m.status === "format_error")}>
                  {(model) => {
                    const modelArtifacts = () => {
                      const no = namedOutputs();
                      if (!no) return [];
                      return Object.entries(no).filter(([_, v]) => v.modelId === model.modelId);
                    };
                    return (
                      <Show when={modelArtifacts().length > 0}>
                        <div class="space-y-2">
                          <h4 class="text-sm font-semibold text-[#191c1e]">{model.modelDisplayName}</h4>
                          <div class="space-y-2">
                            <For each={modelArtifacts()}>
                              {([artifactId, artifact]) => {
                                const def = namedOutputDefs().find((d) => d.id === artifactId);
                                return (
                                  <NamedOutputCard
                                    artifactId={artifactId}
                                    artifactName={def?.name ?? artifactId}
                                    content={artifact.content}
                                    format={artifact.format}
                                    modelId={artifact.modelId}
                                    onContentChange={handleNamedOutputChange}
                                    readonly={props.readOnly}
                                  />
                                );
                              }}
                            </For>
                          </div>
                        </div>
                      </Show>
                    );
                  }}
                </For>
              </Show>

              <Show when={!isMultiModel()}>
                {/* Single model: render cards directly */}
                <For each={Object.entries(namedOutputs() ?? {})}>
                  {([artifactId, artifact]) => {
                    const def = namedOutputDefs().find((d) => d.id === artifactId);
                    return (
                      <NamedOutputCard
                        artifactId={artifactId}
                        artifactName={def?.name ?? artifactId}
                        content={artifact.content}
                        format={artifact.format}
                        modelId={artifact.modelId}
                        onContentChange={handleNamedOutputChange}
                        readonly={props.readOnly}
                      />
                    );
                  }}
                </For>
              </Show>
            </div>
          </Show>

          {/* Output selection — show after at least one model completed */}
          <Show when={hasAnyCompleted() && !showCompare()}>
            <div class="bg-[#f7f9fb] rounded-xl px-5 py-4 space-y-3">
              <p class="text-xs font-semibold text-[#464555] uppercase tracking-wide">选择输出</p>
              <div class="space-y-2">
                <For each={modelList().filter((m) => m.status === "completed")}>
                  {(model) => (
                    <div
                      class={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        selectedModelId() === model.modelId
                          ? "bg-[#e2dfff] border border-[rgba(79,70,229,0.3)]"
                          : "bg-white border border-[rgba(199,196,216,0.15)] hover:bg-[#f7f9fb]"
                      }`}
                    >
                      <div
                        class={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedModelId() === model.modelId
                            ? "border-indigo-500 bg-indigo-500"
                            : "border-[rgba(199,196,216,0.6)]"
                        }`}
                      >
                        <Show when={selectedModelId() === model.modelId}>
                          <div class="w-1.5 h-1.5 rounded-full bg-white" />
                        </Show>
                      </div>
                      <div class="flex-1">
                        <span class="text-sm font-medium text-[#191c1e]">
                          {model.modelDisplayName}
                        </span>
                        <span class="ml-2 text-xs text-[#464555]">{model.content.length} 字符</span>
                      </div>
                      <Show when={selectedModelId() === model.modelId}>
                        <span class="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                          已选择
                        </span>
                      </Show>
                      <Show when={selectedModelId() !== model.modelId}>
                        <button
                          type="button"
                          class="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          onClick={() => handleSelect(model.modelId)}
                          disabled={selectLoading()}
                        >
                          选择此输出
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>

              {/* Auto-select for single model */}
              <Show when={!isMultiModel() && hasAnyCompleted() && !selectedModelId()}>
                {(() => {
                  const completed = modelList().find((m) => m.status === "completed");
                  if (completed) {
                    handleSelect(completed.modelId);
                  }
                  return null;
                })()}
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
