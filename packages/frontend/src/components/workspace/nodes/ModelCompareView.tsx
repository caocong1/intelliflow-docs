import type { ModelOutput } from "@intelliflow/shared";
import { For, Show, createEffect, createSignal } from "solid-js";
import type { JSX } from "solid-js";

interface Props {
  models: Record<string, ModelOutput>;
  renderMarkdown: (text: string) => JSX.Element;
  onClose: () => void;
  onSelect?: (modelId: string) => void;
}

type CompareViewMode = "markdown" | "source";

const STATUS_CONFIG: Record<string, { label: string; cls: string; pulse: boolean }> = {
  pending: {
    label: "等待中",
    cls: "bg-[#f7f9fb] text-[#464555] ring-1 ring-[rgba(199,196,216,0.4)]",
    pulse: false,
  },
  streaming: {
    label: "生成中",
    cls: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200",
    pulse: true,
  },
  completed: {
    label: "已完成",
    cls: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
    pulse: false,
  },
  failed: {
    label: "失败",
    cls: "bg-red-50 text-red-500 ring-1 ring-red-200",
    pulse: false,
  },
};

export default function ModelCompareView(props: Props) {
  const modelList = () => Object.values(props.models);
  const [viewMode, setViewMode] = createSignal<CompareViewMode>("markdown");
  const scrollers = new Map<string, HTMLDivElement>();

  createEffect(() => {
    const models = modelList();
    for (const model of models) {
      const scroller = scrollers.get(model.modelId);
      if (!scroller) continue;
      if (model.status !== "streaming" && model.status !== "pending") continue;

      const contentKey = `${model.modelId}:${model.content.length}:${model.status}:${viewMode()}`;
      void contentKey;

      requestAnimationFrame(() => {
        const target = scrollers.get(model.modelId);
        if (!target) return;
        target.scrollTop = target.scrollHeight;
      });
    }
  });

  function statusBadge(status: ModelOutput["status"]) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
      <span
        class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${config.cls}`}
      >
        <Show when={config.pulse}>
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
        </Show>
        <Show when={!config.pulse}>
          <span
            class={`w-1.5 h-1.5 rounded-full ${status === "completed" ? "bg-emerald-500" : status === "failed" ? "bg-red-400" : "bg-[#c7c4d8]"}`}
          />
        </Show>
        {config.label}
      </span>
    );
  }

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-r from-[#f2f4f6] to-white px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#e2dfff] flex items-center justify-center flex-shrink-0">
            <svg
              class="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[#191c1e]">模型输出对比</h3>
            <p class="text-xs text-[#464555] mt-0.5">{modelList().length} 个模型并排生成</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          {/* View mode toggle */}
          <div class="flex items-center gap-0.5 bg-[#eceef0] rounded-lg p-0.5">
            <button
              type="button"
              class={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
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
              class={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode() === "source"
                  ? "bg-white text-[#191c1e] shadow-sm"
                  : "text-[#464555] hover:text-[#191c1e]"
              }`}
              onClick={() => setViewMode("source")}
            >
              源码视图
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#464555] border border-[rgba(199,196,216,0.4)] rounded-lg hover:bg-[#f7f9fb] hover:text-[#191c1e] transition-colors"
            onClick={props.onClose}
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            关闭对比
          </button>
        </div>
      </div>

      {/* Columns — horizontal scroll if >2 models */}
      <div class="px-6 py-5">
        <div class="flex gap-4 overflow-x-auto pb-2" style={{ "min-width": "0" }}>
          <For each={modelList()}>
            {(model) => (
              <div
                class="flex-shrink-0 flex flex-col rounded-xl shadow-[0_4px_20px_rgba(25,28,30,0.06)] overflow-hidden"
                style={{
                  "min-width": "320px",
                  "max-width": "50%",
                  flex: modelList().length <= 2 ? "1 1 0%" : "0 0 45%",
                }}
              >
                {/* Column header */}
                <div class="px-4 py-3.5 border-b border-[rgba(199,196,216,0.15)] flex items-center justify-between bg-gradient-to-r from-[#f7f9fb] to-white">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-sm font-semibold text-[#191c1e] truncate">
                      {model.modelDisplayName}
                    </span>
                    {statusBadge(model.status)}
                  </div>
                  <Show when={props.onSelect && model.status === "completed"}>
                    <button
                      type="button"
                      class="ml-2 flex-shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                      onClick={() => props.onSelect?.(model.modelId)}
                    >
                      选择此输出
                    </button>
                  </Show>
                </div>

                {/* Content area */}
                <div
                  ref={(el) => scrollers.set(model.modelId, el)}
                  class="flex-1 p-4 bg-[#f7f9fb] min-h-[300px] max-h-[500px] overflow-y-auto"
                >
                  <Show
                    when={model.content || model.status === "streaming"}
                    fallback={
                      <div class="flex items-center justify-center h-full min-h-[260px]">
                        <Show
                          when={model.status === "pending"}
                          fallback={
                            <span class="text-sm text-[#464555]">
                              {model.status === "failed"
                                ? (model.errorMessage ?? "生成失败")
                                : "等待生成结果..."}
                            </span>
                          }
                        >
                          <div class="flex flex-col items-center gap-2">
                            <div class="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                            <span class="text-sm text-[#464555]">准备中...</span>
                          </div>
                        </Show>
                      </div>
                    }
                  >
                    <Show
                      when={model.status === "failed"}
                      fallback={
                        <>
                          <Show
                            when={viewMode() === "markdown"}
                            fallback={
                              <pre class="text-xs font-mono text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                                {model.content}
                              </pre>
                            }
                          >
                            {props.renderMarkdown(model.content)}
                          </Show>
                          <Show when={model.status === "streaming"}>
                            <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                          </Show>
                        </>
                      }
                    >
                      <div class="bg-[#fef2f2] rounded-xl p-4">
                        <p class="text-sm text-red-600">
                          {model.errorMessage ?? "生成失败，请重试。"}
                        </p>
                      </div>
                    </Show>
                  </Show>
                </div>

                {/* Character count footer */}
                <Show when={model.content}>
                  <div class="px-4 py-2.5 border-t border-[rgba(199,196,216,0.15)] bg-white">
                    <span class="text-xs text-[#464555]">共 {model.content.length} 字符</span>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Summary footer */}
      <Show when={modelList().some((m) => m.status === "completed")}>
        <div class="px-6 py-4 bg-[#f7f9fb] border-t border-[rgba(199,196,216,0.15)]">
          <div class="flex items-center gap-6 flex-wrap">
            <span class="text-xs font-semibold text-[#464555] uppercase tracking-wide">
              对比摘要
            </span>
            <For each={modelList().filter((m) => m.status === "completed")}>
              {(model) => (
                <div class="flex items-center gap-2">
                  <span class="text-xs text-[#464555]">{model.modelDisplayName}</span>
                  <Show when={model.content}>
                    <span class="text-xs font-medium text-[#191c1e]">
                      {model.content.length} 字符
                    </span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
