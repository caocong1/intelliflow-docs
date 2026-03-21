import { createSignal, For, Show } from "solid-js";
import type { ModelOutput } from "@intelliflow/shared";
import type { JSX } from "solid-js";

interface Props {
  models: Record<string, ModelOutput>;
  renderMarkdown: (text: string) => JSX.Element;
  onClose: () => void;
  onSelect?: (modelId: string) => void;
}

type CompareViewMode = "markdown" | "source";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: "等待中", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  streaming: { label: "生成中", bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  completed: { label: "已完成", bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  failed: { label: "失败", bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

export default function ModelCompareView(props: Props) {
  const modelList = () => Object.values(props.models);
  const [viewMode, setViewMode] = createSignal<CompareViewMode>("markdown");

  function statusBadge(status: ModelOutput["status"]) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
      <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <span class={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === "streaming" ? "animate-ping" : ""}`} />
        {config.label}
      </span>
    );
  }

  return (
    <div class="space-y-3">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-gray-700">模型输出对比</h3>
          <span class="text-xs text-gray-400">{modelList().length} 个模型</span>
        </div>
        <div class="flex items-center gap-2">
          {/* View mode toggle */}
          <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              class={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode() === "markdown"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setViewMode("markdown")}
            >
              Markdown 视图
            </button>
            <button
              type="button"
              class={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode() === "source"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setViewMode("source")}
            >
              源码视图
            </button>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={props.onClose}
          >
            关闭对比
          </button>
        </div>
      </div>

      {/* Columns — horizontal scroll if >2 models */}
      <div
        class="flex gap-4 overflow-x-auto pb-2"
        style={{ "min-width": "0" }}
      >
        <For each={modelList()}>
          {(model) => (
            <div
              class="flex-shrink-0 space-y-2"
              style={{ "min-width": "320px", "max-width": "50%", flex: modelList().length <= 2 ? "1 1 0%" : "0 0 45%" }}
            >
              {/* Column header: model name + status */}
              <div class="flex items-center justify-between px-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-800">{model.modelDisplayName}</span>
                  {statusBadge(model.status)}
                </div>
                <Show when={props.onSelect && model.status === "completed"}>
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                    onClick={() => props.onSelect?.(model.modelId)}
                  >
                    选择此输出
                  </button>
                </Show>
              </div>

              {/* Content area */}
              <div class="bg-white border border-gray-200 rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
                <Show
                  when={model.content || model.status === "streaming"}
                  fallback={
                    <div class="flex items-center justify-center h-full min-h-[200px]">
                      <span class="text-sm text-gray-400">
                        {model.status === "failed" ? (model.errorMessage ?? "生成失败") : "等待生成结果..."}
                      </span>
                    </div>
                  }
                >
                  <Show
                    when={viewMode() === "markdown"}
                    fallback={
                      <pre class="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                        {model.content}
                      </pre>
                    }
                  >
                    {props.renderMarkdown(model.content)}
                  </Show>
                  <Show when={model.status === "streaming"}>
                    <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                  </Show>
                </Show>
              </div>

              {/* Character count footer */}
              <Show when={model.content}>
                <div class="text-xs text-gray-400 text-right px-1">
                  {model.content.length} 字符
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
