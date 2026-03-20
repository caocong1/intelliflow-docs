import { createSignal, For, Match, Show, Switch, onCleanup } from "solid-js";
import type { ModelCallConfig, ModelOutput, NodeExecution, SSEEvent } from "@intelliflow/shared";
import ModelCompareView from "./ModelCompareView";

interface Props {
  nodeExecution: NodeExecution;
  config: ModelCallConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  readOnly: boolean;
}

type ExecutionPhase = "idle" | "streaming" | "done";

// RECV-03: Cancel AI generation deferred to v2 per user decision

export default function ModelCallExecutor(props: Props) {
  // Determine initial state from existing outputData
  const existingModels = (): Record<string, ModelOutput> => {
    const od = props.nodeExecution.outputData as Record<string, unknown> | null;
    return (od?.models as Record<string, ModelOutput>) ?? {};
  };

  const hasExistingOutput = () => Object.keys(existingModels()).length > 0;
  const isMultiModel = () => {
    const ids = props.config.modelIds ?? [];
    return ids.length > 1;
  };

  const [phase, setPhase] = createSignal<ExecutionPhase>(
    hasExistingOutput() ? "done" : "idle",
  );
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

  let abortController: AbortController | null = null;

  onCleanup(() => {
    abortController?.abort();
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
      setError(message);
    }

    setPhase("done");
  }

  function handleSSEEvent(event: SSEEvent) {
    setModelOutputs((prev) => {
      const current = { ...prev };
      const existing = current[event.modelId] ?? {
        modelId: event.modelId,
        modelDisplayName: event.modelId,
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

  // ─── Actions ──────────────────────────────────────────────────────────────

  function handleStartGeneration() {
    setPhase("streaming");
    setError(null);
    setModelOutputs({});
    const url = `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/execute`;
    startStreaming(url);
  }

  function handleRetry(modelId: string) {
    setError(null);
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
    return outputs.length > 0 && outputs.every((m) => m.status === "completed" || m.status === "failed");
  }

  function hasAnyCompleted(): boolean {
    return modelList().some((m) => m.status === "completed");
  }

  function statusBadge(status: ModelOutput["status"]) {
    switch (status) {
      case "pending":
        return <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">等待中</span>;
      case "streaming":
        return <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 animate-pulse">生成中</span>;
      case "completed":
        return <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">完成</span>;
      case "failed":
        return <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">失败</span>;
    }
  }

  /** Simple markdown to HTML: headers, bold, italic, lists, paragraphs */
  function renderMarkdown(text: string) {
    if (!text) return <div class="text-gray-400 text-sm italic">No content</div>;

    const lines = text.split("\n");
    const elements: Array<{ type: string; content: string; level?: number }> = [];

    for (const line of lines) {
      // Headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        elements.push({ type: "header", content: headerMatch[2], level: headerMatch[1].length });
        continue;
      }

      // Unordered list
      if (line.match(/^\s*[-*]\s+/)) {
        elements.push({ type: "li", content: line.replace(/^\s*[-*]\s+/, "") });
        continue;
      }

      // Ordered list
      if (line.match(/^\s*\d+\.\s+/)) {
        elements.push({ type: "oli", content: line.replace(/^\s*\d+\.\s+/, "") });
        continue;
      }

      // Empty line
      if (line.trim() === "") {
        elements.push({ type: "br", content: "" });
        continue;
      }

      // Regular paragraph
      elements.push({ type: "p", content: line });
    }

    function inlineFormat(text: string) {
      // Bold
      let result = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      // Italic
      result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
      // Code
      result = result.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono">$1</code>');
      return result;
    }

    return (
      <div class="prose prose-sm max-w-none">
        <For each={elements}>
          {(el) => (
            <Switch fallback={<p class="text-sm text-gray-800 leading-relaxed" innerHTML={inlineFormat(el.content)} />}>
              <Match when={el.type === "header" && el.level === 1}>
                <h1 class="text-xl font-bold text-gray-900 mt-4 mb-2" innerHTML={inlineFormat(el.content)} />
              </Match>
              <Match when={el.type === "header" && el.level === 2}>
                <h2 class="text-lg font-semibold text-gray-900 mt-3 mb-1.5" innerHTML={inlineFormat(el.content)} />
              </Match>
              <Match when={el.type === "header" && (el.level ?? 3) >= 3}>
                <h3 class="text-base font-medium text-gray-800 mt-2 mb-1" innerHTML={inlineFormat(el.content)} />
              </Match>
              <Match when={el.type === "li"}>
                <div class="flex gap-2 ml-4 text-sm text-gray-800">
                  <span class="text-gray-400 select-none">-</span>
                  <span innerHTML={inlineFormat(el.content)} />
                </div>
              </Match>
              <Match when={el.type === "oli"}>
                <div class="flex gap-2 ml-4 text-sm text-gray-800">
                  <span innerHTML={inlineFormat(el.content)} />
                </div>
              </Match>
              <Match when={el.type === "br"}>
                <div class="h-2" />
              </Match>
            </Switch>
          )}
        </For>
      </div>
    );
  }

  // ─── Read-only mode ──────────────────────────────────────────────────────

  if (props.readOnly) {
    const selected = selectedModelId();
    const output = existingModels()[selected];
    const content = output?.content
      ?? ((props.nodeExecution.outputData as Record<string, unknown>)?.selectedContent as string)
      ?? "";

    return (
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-gray-700">Model Output</h3>
          <Show when={output}>
            <span class="text-xs text-gray-500">({output!.modelDisplayName})</span>
          </Show>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          {renderMarkdown(content)}
        </div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div class="space-y-4">
      {/* Error */}
      <Show when={error()}>
        <div class="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error()}</div>
      </Show>

      {/* Idle — start button */}
      <Show when={phase() === "idle"}>
        <div class="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div class="text-lg font-semibold text-gray-700 mb-2">
            {props.config.displayName ?? "Model Call"}
          </div>
          <p class="text-sm text-gray-500 mb-4">
            {isMultiModel()
              ? `Will call ${props.config.modelIds.length} models in parallel`
              : "Ready to generate content"}
          </p>
          <button
            type="button"
            class="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            onClick={handleStartGeneration}
          >
            Start Generation
          </button>
        </div>
      </Show>

      {/* Streaming / Done */}
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
                      <h3 class="text-sm font-semibold text-gray-700">
                        {model()?.modelDisplayName}
                      </h3>
                      {statusBadge(model()?.status ?? "pending")}
                    </div>

                    <Show when={model()?.status === "failed"}>
                      <div class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                        <span class="text-sm text-red-600">{model()?.errorMessage}</span>
                        <button
                          type="button"
                          class="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                          onClick={() => handleRetry(model()!.modelId)}
                        >
                          Retry
                        </button>
                      </div>
                    </Show>

                    <div class="bg-white border border-gray-200 rounded-lg p-4 min-h-[200px] max-h-[500px] overflow-y-auto">
                      {renderMarkdown(model()?.content ?? "")}
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
              <div class="flex items-center gap-1 border-b border-gray-200">
                <For each={modelList()}>
                  {(model) => (
                    <button
                      type="button"
                      class={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab() === model.modelId
                          ? "border-indigo-600 text-indigo-700"
                          : "border-transparent text-gray-500 hover:text-gray-700"
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
                    Compare
                  </button>
                </Show>
              </div>

              {/* Active tab content */}
              <Show when={modelOutputs()[activeTab()]}>
                {(model) => (
                  <div class="space-y-3">
                    <Show when={model().status === "failed"}>
                      <div class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                        <span class="text-sm text-red-600">{model().errorMessage}</span>
                        <button
                          type="button"
                          class="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                          onClick={() => handleRetry(model().modelId)}
                        >
                          Retry
                        </button>
                      </div>
                    </Show>

                    <div class="bg-white border border-gray-200 rounded-lg p-4 min-h-[200px] max-h-[500px] overflow-y-auto">
                      {renderMarkdown(model().content)}
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
          <div class="border-t border-gray-200 pt-4 space-y-3">
            <h4 class="text-sm font-medium text-gray-700">Select Output</h4>
            <div class="space-y-2">
              <For each={modelList().filter((m) => m.status === "completed")}>
                {(model) => (
                  <label
                    class={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedModelId() === model.modelId
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="model-output-select"
                      checked={selectedModelId() === model.modelId}
                      onChange={() => handleSelect(model.modelId)}
                      disabled={selectLoading()}
                      class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <div class="flex-1">
                      <span class="text-sm font-medium text-gray-800">
                        {model.modelDisplayName}
                      </span>
                      <span class="ml-2 text-xs text-gray-400">
                        {model.content.length} chars
                      </span>
                    </div>
                    <Show when={selectedModelId() === model.modelId}>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                        Selected
                      </span>
                    </Show>
                  </label>
                )}
              </For>
            </div>

            {/* Auto-select for single model */}
            <Show when={!isMultiModel() && hasAnyCompleted() && !selectedModelId()}>
              {(() => {
                // Auto-select the only completed model
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
  );
}
