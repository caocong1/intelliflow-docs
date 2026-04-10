import type { ModelCallConfig, NamedOutputDef, NodeConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";
import { formatDuration, formatShortTime } from "../../../lib/format-utils";
import { renderMarkdown } from "../../../lib/render-markdown";
import NamedOutputCard from "../nodes/NamedOutputCard";

interface ModelOutput {
  content: string;
  modelId: string;
  modelDisplayName: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  tokenUsage?: { input: number; output: number };
}

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onReexecute?: () => void;
  onFullscreen?: (content: string, title: string) => void;
}

export default function ModelCallCompleted(props: Props) {
  const cfg = () => props.config as ModelCallConfig | undefined;

  const od = () =>
    props.node.outputData as {
      models?: Record<string, ModelOutput>;
      selectedContent?: string;
      selectedModelId?: string;
      namedOutputs?: Record<string, { content: string; format: string; modelId: string }>;
      fallbackWarning?: boolean;
    } | null;

  const modelEntries = () => {
    const models = od()?.models;
    if (!models) return [];
    return Object.entries(models).map(([key, val]) => ({ key, ...val }));
  };

  const initialModelId = () => {
    const entries = modelEntries();
    const selectedKey = props.node.selectedOutputKey;
    if (selectedKey && od()?.models?.[selectedKey]) return selectedKey;
    return entries[0]?.key ?? "";
  };

  const hasNamedOutputs = () => {
    const no = od()?.namedOutputs;
    return no !== undefined && no !== null && Object.keys(no).length > 0;
  };

  const namedOutputDefs = (): NamedOutputDef[] => {
    return (cfg() as ModelCallConfig | undefined)?.namedOutputs ?? [];
  };

  const fallbackWarning = () => od()?.fallbackWarning ?? false;

  const [viewMode, setViewMode] = createSignal<"markdown" | "source">("markdown");
  const [selectedModelId, setSelectedModelId] = createSignal(initialModelId());
  const [copied, setCopied] = createSignal(false);

  const activeModel = () => {
    const models = od()?.models;
    if (!models) return null;
    return models[selectedModelId()] ?? null;
  };

  const content = () => activeModel()?.content ?? od()?.selectedContent ?? "";

  const charCount = () => content().length;

  const duration = () => formatDuration(props.node.startedAt, props.node.completedAt);

  const completionTime = () => formatShortTime(props.node.completedAt);

  const displayName = () => {
    const model = activeModel();
    if (model?.modelDisplayName) return model.modelDisplayName;
    const cfgVal = cfg();
    if (cfgVal?.displayName) return cfgVal.displayName;
    return "模型调用";
  };

  const title = () => props.node.nodeLabel || "模型调用";

  function handleCopy() {
    navigator.clipboard.writeText(content()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleFullscreen() {
    props.onFullscreen?.(content(), title());
  }

  return (
    <div class="rounded-2xl overflow-hidden bg-white shadow-[0_12px_40px_rgba(25,28,30,0.06)]">
      {/* Purple gradient header */}
      <div
        class="relative flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)" }}
      >
        <div class="px-8 pt-8 pb-6">
          <div class="flex items-start justify-between gap-4">
            {/* Left: icon + title info */}
            <div class="flex items-center gap-4">
              {/* Sparkles icon in frosted circle */}
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.15)", "backdrop-filter": "blur(4px)" }}
              >
                <svg
                  class="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>

              <div>
                <h3 class="text-white font-bold text-xl leading-tight">{title()}</h3>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  {/* 模型调用 badge */}
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                  >
                    模型调用
                  </span>
                  {/* 已完成 status */}
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(52,211,153,0.25)", color: "#6effd4" }}
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: "#6effd4" }}
                    />
                    已完成
                  </span>
                  {/* Duration */}
                  <span class="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {duration()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: 渲染/源码 segmented control */}
            <div
              class="flex items-center rounded-lg p-0.5 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={
                  viewMode() === "markdown"
                    ? { background: "white", color: "#3525cd" }
                    : { background: "transparent", color: "rgba(255,255,255,0.75)" }
                }
                onClick={() => setViewMode("markdown")}
              >
                渲染
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={
                  viewMode() === "source"
                    ? { background: "white", color: "#3525cd" }
                    : { background: "transparent", color: "rgba(255,255,255,0.75)" }
                }
                onClick={() => setViewMode("source")}
              >
                源码
              </button>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div
          class="px-8 py-3 flex items-center gap-4 flex-wrap"
          style={{
            background: "rgba(0,0,0,0.12)",
            "border-top": "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Model name pill */}
          <span
            class="text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.18)", color: "white" }}
          >
            {displayName()}
          </span>

          {/* Character count */}
          <span
            class="flex items-center gap-1.5 text-xs"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {charCount().toLocaleString()} 字符
          </span>

          {/* Completion time */}
          <span
            class="flex items-center gap-1.5 text-xs"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            完成于 {completionTime()}
          </span>
        </div>

        {/* Multi-model tabs (inside header area) */}
        <Show when={modelEntries().length > 1}>
          <div
            class="px-8 flex items-center gap-1 overflow-x-auto"
            style={{ "border-top": "1px solid rgba(255,255,255,0.08)" }}
          >
            <For each={modelEntries()}>
              {(model) => (
                <button
                  type="button"
                  class="px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5"
                  style={
                    selectedModelId() === model.key
                      ? {
                          "border-color": "white",
                          color: "white",
                        }
                      : {
                          "border-color": "transparent",
                          color: "rgba(255,255,255,0.55)",
                        }
                  }
                  onClick={() => setSelectedModelId(model.key)}
                >
                  {model.modelDisplayName}
                  <Show when={model.key === props.node.selectedOutputKey}>
                    <span
                      class="text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: "rgba(52,211,153,0.3)", color: "#6effd4" }}
                    >
                      选中
                    </span>
                  </Show>
                  <Show when={model.status === "format_error"}>
                    <span
                      class="text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: "rgba(239,68,68,0.3)", color: "#fca5a5" }}
                    >
                      格式错误
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Content area */}
      <div>
        <div class="max-w-4xl mx-auto px-12 py-10 space-y-4">
          {/* Fallback warning */}
          <Show when={fallbackWarning()}>
            <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              <span class="text-sm text-amber-700">模型未按预期格式输出，已合并为单个产物</span>
            </div>
          </Show>

          {/* Named output cards mode */}
          <Show when={hasNamedOutputs()}>
            <div class="space-y-3">
              <Show when={modelEntries().length > 1}>
                {/* Multi-model: show cards for active model tab */}
                <For each={Object.entries(od()?.namedOutputs ?? {}).filter(([_, v]) => v.modelId === selectedModelId())}>
                  {([artifactId, artifact]) => {
                    const def = namedOutputDefs().find((d) => d.id === artifactId);
                    return (
                      <NamedOutputCard
                        artifactId={artifactId}
                        artifactName={def?.name ?? artifactId}
                        content={artifact.content}
                        format={artifact.format}
                        modelId={artifact.modelId}
                        readonly={true}
                      />
                    );
                  }}
                </For>
              </Show>

              <Show when={modelEntries().length <= 1}>
                {/* Single model: show all named output cards */}
                <For each={Object.entries(od()?.namedOutputs ?? {})}>
                  {([artifactId, artifact]) => {
                    const def = namedOutputDefs().find((d) => d.id === artifactId);
                    return (
                      <NamedOutputCard
                        artifactId={artifactId}
                        artifactName={def?.name ?? artifactId}
                        content={artifact.content}
                        format={artifact.format}
                        modelId={artifact.modelId}
                        readonly={true}
                      />
                    );
                  }}
                </For>
              </Show>
            </div>
          </Show>

          {/* Standard content (when no named outputs) */}
          <Show when={!hasNamedOutputs()}>
            <Show
              when={viewMode() === "markdown"}
              fallback={
                <pre class="text-sm font-mono text-[#464555] whitespace-pre-wrap leading-relaxed bg-[#f7f9fb] rounded-xl p-6 overflow-x-auto">
                  {content() || "(无内容)"}
                </pre>
              }
            >
              <div class="prose-editorial">{renderMarkdown(content())}</div>
            </Show>
          </Show>
        </div>
      </div>

      {/* Floating action bar */}
      <div class="fixed bottom-10 right-12 z-50">
        <div
          class="flex items-center gap-1 bg-white rounded-2xl px-2 py-2"
          style={{ "box-shadow": "0 12px 40px rgba(25,28,30,0.14)" }}
        >
          {/* Copy */}
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#464555] rounded-xl hover:bg-[#f2f4f6] transition-colors"
            onClick={handleCopy}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {copied() ? "已复制" : "复制"}
          </button>

          <div class="w-px h-5 bg-[#e6e8ea]" />

          {/* Fullscreen */}
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#464555] rounded-xl hover:bg-[#f2f4f6] transition-colors"
            onClick={handleFullscreen}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
            全屏
          </button>

          <div class="w-px h-5 bg-[#e6e8ea]" />

          {/* Re-execute */}
          <button
            type="button"
            class="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)" }}
            onClick={() => props.onReexecute?.()}
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            重新执行
          </button>
        </div>
      </div>
    </div>
  );
}
