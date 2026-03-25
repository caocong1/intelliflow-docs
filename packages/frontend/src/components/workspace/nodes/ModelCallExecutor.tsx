import type { ModelCallConfig, ModelOutput, NodeExecution, SSEEvent } from "@intelliflow/shared";
import { For, Match, Show, Switch, createEffect, createSignal, onCleanup } from "solid-js";
import { renderMarkdown } from "../../../lib/render-markdown";
import ModelCompareView from "./ModelCompareView";

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
          (m) => m.status === "completed" || m.status === "failed",
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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function modelList(): ModelOutput[] {
    return Object.values(modelOutputs());
  }

  function allCompleted(): boolean {
    const outputs = modelList();
    return (
      outputs.length > 0 && outputs.every((m) => m.status === "completed" || m.status === "failed")
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
    }
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
                    </div>
                  )}
                </Show>
              </div>
            </Match>
          </Switch>

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
