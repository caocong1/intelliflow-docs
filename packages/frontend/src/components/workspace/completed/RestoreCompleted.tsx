import type { NodeConfig, NodeExecution, RestoreConfig } from "@intelliflow/shared";
import { For, Show, createMemo, createSignal } from "solid-js";
import { formatDuration } from "../../../lib/format-utils";

interface RestorationItem {
  placeholder: string;
  originalValue: string;
  sensitiveType: string;
  restored: boolean;
}

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onFullscreen?: (content: string, title: string) => void;
}

/** Wrap each originalValue occurrence in the text with a highlight span */
function buildHighlightedSegments(
  text: string,
  restorations: RestorationItem[],
): Array<{ text: string; highlight: boolean }> {
  if (!text || restorations.length === 0) return [{ text, highlight: false }];

  // Collect all successful restorations with non-empty originalValue
  const successfulValues = restorations
    .filter((r) => r.restored && r.originalValue)
    .map((r) => r.originalValue);

  if (successfulValues.length === 0) return [{ text, highlight: false }];

  // Build a regex that matches any of the values (escaped)
  const escaped = successfulValues.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");

  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    parts.push({ text: match[0], highlight: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  return parts;
}

export default function RestoreCompleted(props: Props) {
  const [textExpanded, setTextExpanded] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const od = createMemo(
    () =>
      props.node.outputData as {
        originalText?: string;
        restoredText?: string;
        restorations?: RestorationItem[];
      } | null,
  );

  const _config = () => props.config as RestoreConfig | undefined;

  const restorations = createMemo(() => od()?.restorations ?? []);
  const successCount = createMemo(() => restorations().filter((r) => r.restored).length);
  const failCount = createMemo(() => restorations().filter((r) => !r.restored).length);
  const totalCount = createMemo(() => restorations().length);
  const duration = () => formatDuration(props.node.startedAt, props.node.completedAt);

  const restoredText = createMemo(() => od()?.restoredText ?? "");

  const highlightedSegments = createMemo(() =>
    buildHighlightedSegments(restoredText(), restorations()),
  );

  async function handleCopy() {
    const text = restoredText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  }

  function handleFullscreen() {
    const text = restoredText();
    if (text && props.onFullscreen) {
      props.onFullscreen(text, `${props.node.nodeLabel} — 恢复文本`);
    }
  }

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-b from-[#f2f4f6] to-white px-8 py-6 border-b border-slate-100 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
            }}
          >
            {/* Refresh / sync icon */}
            <svg
              class="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-[#191c1e]">{props.node.nodeLabel}</h2>
            <div class="flex items-center gap-2 mt-1">
              <span class="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full">
                信息恢复
              </span>
              <Show when={totalCount() > 0}>
                <span class="inline-block px-2.5 py-0.5 bg-green-100 text-green-800 text-[11px] font-bold rounded-full">
                  已恢复 {successCount()} 处
                </span>
              </Show>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full">
            <div class="w-2 h-2 rounded-full bg-green-500" />
            <span class="text-green-700 text-xs font-semibold">已完成</span>
          </div>
          <Show when={duration()}>
            <div class="px-3 py-1 bg-slate-100 rounded-full">
              <span class="text-[#464555] text-xs font-medium">耗时 {duration()}</span>
            </div>
          </Show>
        </div>
      </div>

      {/* Body */}
      <div class="p-8 space-y-8">
        {/* Stat cards */}
        <Show when={totalCount() > 0}>
          <div class="grid grid-cols-2 gap-4">
            {/* Success card */}
            <div class="bg-emerald-50 rounded-2xl p-5 flex flex-col gap-1">
              <span class="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                成功恢复
              </span>
              <span class="text-4xl font-black text-emerald-700 leading-none">
                {successCount()}
              </span>
              <span class="text-[12px] text-emerald-600 mt-0.5">处已成功还原</span>
            </div>
            {/* Failure card */}
            <div
              class={`rounded-2xl p-5 flex flex-col gap-1 ${failCount() > 0 ? "bg-red-50" : "bg-slate-50"}`}
            >
              <span
                class={`text-[11px] font-semibold uppercase tracking-wider ${failCount() > 0 ? "text-red-500" : "text-slate-400"}`}
              >
                恢复失败
              </span>
              <span
                class={`text-4xl font-black leading-none ${failCount() > 0 ? "text-red-600" : "text-slate-400"}`}
              >
                {failCount()}
              </span>
              <span
                class={`text-[12px] mt-0.5 ${failCount() > 0 ? "text-red-500" : "text-slate-400"}`}
              >
                处未能还原
              </span>
            </div>
          </div>
        </Show>

        {/* Restoration details table */}
        <Show when={restorations().length > 0}>
          <section>
            <div class="flex items-center gap-3 mb-4">
              <h3 class="text-[13px] font-bold text-[#191c1e] uppercase tracking-wider">
                恢复详情
              </h3>
              <div class="flex-1 h-[1px] bg-slate-100" />
            </div>
            <div class="rounded-xl overflow-hidden border border-slate-100">
              {/* Table header */}
              <div class="grid grid-cols-[2fr_2fr_1fr_80px] bg-[#f2f4f6] px-4 py-2.5">
                <span class="text-[11px] font-bold text-[#464555] uppercase tracking-wider">
                  占位符
                </span>
                <span class="text-[11px] font-bold text-[#464555] uppercase tracking-wider">
                  真实值
                </span>
                <span class="text-[11px] font-bold text-[#464555] uppercase tracking-wider">
                  类型
                </span>
                <span class="text-[11px] font-bold text-[#464555] uppercase tracking-wider text-center">
                  状态
                </span>
              </div>
              {/* Table rows */}
              <For each={restorations()}>
                {(item) => (
                  <div
                    class={`grid grid-cols-[2fr_2fr_1fr_80px] px-4 py-3 border-t border-slate-50 items-center border-l-2 ${
                      item.restored ? "border-l-emerald-500" : "border-l-red-400 bg-red-50/20"
                    }`}
                  >
                    <span class="font-mono text-[12px] text-[#464555] truncate pr-2">
                      {item.placeholder}
                    </span>
                    <span class="text-sm font-semibold text-[#191c1e] truncate pr-2">
                      {item.originalValue}
                    </span>
                    <span>
                      <span class="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-medium rounded-full">
                        {item.sensitiveType}
                      </span>
                    </span>
                    <div class="flex justify-center">
                      <Show
                        when={item.restored}
                        fallback={
                          <div class="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                            <svg
                              class="w-3.5 h-3.5 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2.5"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </div>
                        }
                      >
                        <div class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg
                            class="w-3.5 h-3.5 text-emerald-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2.5"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>

        {/* Restored text preview */}
        <Show when={restoredText()}>
          <section>
            <div class="flex items-center justify-between gap-3 mb-4">
              <div class="flex items-center gap-3">
                <h3 class="text-[13px] font-bold text-[#191c1e] uppercase tracking-wider">
                  恢复后文本
                </h3>
                <div class="flex-1 h-[1px] bg-slate-100 w-8" />
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                {/* Copy button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  class="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#464555] hover:text-[#191c1e] bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border-0 cursor-pointer"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  {copied() ? "已复制" : "复制"}
                </button>
                {/* Fullscreen button */}
                <Show when={props.onFullscreen}>
                  <button
                    type="button"
                    onClick={handleFullscreen}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#464555] hover:text-[#191c1e] bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border-0 cursor-pointer"
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                    全屏
                  </button>
                </Show>
              </div>
            </div>

            {/* Text container with gradient fade + expand */}
            <div class="relative">
              <div
                class={`bg-[#f7f9fb] rounded-xl p-5 overflow-hidden transition-all ${
                  textExpanded() ? "" : "max-h-[300px]"
                }`}
              >
                <p class="text-sm text-[#191c1e] leading-relaxed whitespace-pre-wrap">
                  <For each={highlightedSegments()}>
                    {(segment) => (
                      <Show when={segment.highlight} fallback={<span>{segment.text}</span>}>
                        <mark class="bg-emerald-100 text-emerald-900 rounded px-0.5 not-italic font-medium">
                          {segment.text}
                        </mark>
                      </Show>
                    )}
                  </For>
                </p>
              </div>

              {/* Gradient fade when collapsed */}
              <Show when={!textExpanded()}>
                <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f7f9fb] to-transparent rounded-b-xl pointer-events-none" />
              </Show>
            </div>

            {/* Expand toggle */}
            <div class="mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setTextExpanded((v) => !v)}
                class="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border-0 cursor-pointer"
              >
                {textExpanded() ? "收起" : "展开全文"}
                <svg
                  class={`w-3.5 h-3.5 transition-transform ${textExpanded() ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </section>
        </Show>
      </div>

      {/* Bottom action */}
      <div class="px-8 py-6 bg-slate-50/50 flex justify-center items-center border-t border-slate-100">
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-indigo-600 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all cursor-pointer bg-white"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          从此节点重新执行
        </button>
      </div>
    </div>
  );
}
