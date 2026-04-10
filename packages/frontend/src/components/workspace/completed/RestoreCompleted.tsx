import type { NodeConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createMemo, createSignal } from "solid-js";
import { formatDuration } from "../../../lib/format-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestorationItem {
  placeholder: string;
  originalValue: string;
  sensitiveType: string;
  restored: boolean;
}

interface RestoreSourceData {
  displayName: string;
  originalText: string;
  restoredText: string;
}

interface RestoreOutputData {
  originalText?: string;
  restoredText?: string;
  restorations?: RestorationItem[];
  sources?: Record<string, RestoreSourceData>;
  confirmedAt?: string;
}

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onFullscreen?: (content: string, title: string) => void;
  onReexecute?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Highlight restored originalValue occurrences in text */
function buildHighlightedSegments(
  text: string,
  restorations: RestorationItem[],
): Array<{ text: string; highlight: boolean }> {
  if (!text || restorations.length === 0) return [{ text, highlight: false }];

  const successfulValues = restorations
    .filter((r) => r.restored && r.originalValue)
    .map((r) => r.originalValue);

  if (successfulValues.length === 0) return [{ text, highlight: false }];

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function RestoreCompleted(props: Props) {
  const [copied, setCopied] = createSignal(false);
  const [detailsOpen, setDetailsOpen] = createSignal(false);

  const od = createMemo(() => (props.node.outputData as RestoreOutputData | null) ?? null);

  const hasSources = createMemo(() => {
    const s = od()?.sources;
    return !!s && Object.keys(s).length > 0;
  });

  const sourceEntries = createMemo(
    () => Object.entries(od()?.sources ?? {}) as [string, RestoreSourceData][],
  );

  const restorations = createMemo(() => od()?.restorations ?? []);
  const successCount = createMemo(() => restorations().filter((r) => r.restored).length);
  const failCount = createMemo(() => restorations().filter((r) => !r.restored).length);
  const totalCount = createMemo(() => restorations().length);
  const duration = () => formatDuration(props.node.startedAt, props.node.completedAt);

  /** Get restorations relevant to a specific source */
  function getSourceItems(src: RestoreSourceData): RestorationItem[] {
    if (!src.originalText) return restorations();
    return restorations().filter((r) => src.originalText.includes(r.placeholder));
  }

  async function handleCopy(text: string) {
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
    const text = hasSources()
      ? sourceEntries()
          .map(([, src]) => src.restoredText)
          .filter(Boolean)
          .join("\n\n")
      : (od()?.restoredText ?? "");
    if (text && props.onFullscreen) {
      props.onFullscreen(text, `${props.node.nodeLabel} — 恢复文本`);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-b from-[#f2f4f6] to-white px-8 py-6 border-b border-slate-100 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
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
            <div class="bg-emerald-50 rounded-2xl p-5 flex flex-col gap-1">
              <span class="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                成功恢复
              </span>
              <span class="text-4xl font-black text-emerald-700 leading-none">
                {successCount()}
              </span>
              <span class="text-[12px] text-emerald-600 mt-0.5">处已成功还原</span>
            </div>
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

        {/* Content: source cards or fallback */}
        <Show
          when={hasSources()}
          fallback={
            <Show when={od()?.restoredText}>
              <section>
                <div class="flex items-center justify-between gap-3 mb-4">
                  <div class="flex items-center gap-3">
                    <h3 class="text-[13px] font-bold text-[#191c1e] uppercase tracking-wider">
                      恢复后文本
                    </h3>
                    <div class="flex-1 h-[1px] bg-slate-100 w-8" />
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(od()?.restoredText ?? "")}
                      class="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#464555] hover:text-[#191c1e] bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border-0 cursor-pointer"
                    >
                      {copied() ? "已复制" : "复制"}
                    </button>
                    <Show when={props.onFullscreen}>
                      <button
                        type="button"
                        onClick={handleFullscreen}
                        class="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#464555] hover:text-[#191c1e] bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border-0 cursor-pointer"
                      >
                        全屏
                      </button>
                    </Show>
                  </div>
                </div>
                <div class="bg-[#f7f9fb] rounded-xl p-5 max-h-[300px] overflow-y-auto">
                  <p class="text-sm text-[#191c1e] leading-relaxed whitespace-pre-wrap">
                    <For each={buildHighlightedSegments(od()?.restoredText ?? "", restorations())}>
                      {(seg) => (
                        <Show when={seg.highlight} fallback={<span>{seg.text}</span>}>
                          <mark class="bg-emerald-100 text-emerald-900 rounded px-0.5 not-italic font-medium">
                            {seg.text}
                          </mark>
                        </Show>
                      )}
                    </For>
                  </p>
                </div>
              </section>
            </Show>
          }
        >
          {/* Multi-source: vertical cards */}
          <div class="space-y-4">
            <For each={sourceEntries()}>
              {([_outputId, src]) => {
                const srcItems = createMemo(() => getSourceItems(src));
                const srcSuccess = createMemo(() => srcItems().filter((r) => r.restored).length);
                const srcFail = createMemo(() => srcItems().filter((r) => !r.restored).length);
                const segments = createMemo(() =>
                  buildHighlightedSegments(src.restoredText, srcItems()),
                );

                return (
                  <div class="rounded-xl border border-[rgba(199,196,216,0.25)] overflow-hidden">
                    {/* Card header */}
                    <div class="px-4 py-2.5 bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.15)]">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-medium text-[#464555]">
                          {src.displayName}
                        </span>
                        <Show when={srcSuccess() > 0 || srcFail() > 0}>
                          <span class="text-[10px] text-[#9fa0a8]">
                            恢复 {srcSuccess()} 处
                            <Show when={srcFail() > 0}>
                              <span> · 失败 {srcFail()} 处</span>
                            </Show>
                          </span>
                        </Show>
                      </div>
                    </div>

                    {/* Card body */}
                    <div class="p-4">
                      <Show
                        when={src.restoredText}
                        fallback={
                          <div class="text-xs text-[#777587] italic">无恢复文本</div>
                        }
                      >
                        <div class="bg-[#f7f9fb] rounded-xl p-4 max-h-48 overflow-y-auto">
                          <p class="text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                            <For each={segments()}>
                              {(seg) => (
                                <Show
                                  when={seg.highlight}
                                  fallback={<span>{seg.text}</span>}
                                >
                                  <mark class="bg-emerald-100 text-emerald-900 rounded px-0.5 not-italic font-medium">
                                    {seg.text}
                                  </mark>
                                </Show>
                              )}
                            </For>
                          </p>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>

            {/* Copy all + fullscreen */}
            <div class="flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    sourceEntries()
                      .map(([, s]) => s.restoredText)
                      .filter(Boolean)
                      .join("\n\n"),
                  )
                }
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#464555] hover:text-[#191c1e] bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border-0 cursor-pointer"
              >
                {copied() ? "已复制" : "复制全部"}
              </button>
              <Show when={props.onFullscreen}>
                <button
                  type="button"
                  onClick={handleFullscreen}
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#464555] hover:text-[#191c1e] bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border-0 cursor-pointer"
                >
                  全屏
                </button>
              </Show>
            </div>
          </div>
        </Show>

        {/* Restoration details (collapsible) */}
        <Show when={restorations().length > 0}>
          <section>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              class="flex items-center gap-3 w-full text-left mb-3 cursor-pointer border-0 bg-transparent p-0"
            >
              <h3 class="text-[13px] font-bold text-[#191c1e] uppercase tracking-wider">
                恢复详情
              </h3>
              <div class="flex-1 h-[1px] bg-slate-100" />
              <svg
                class={`w-4 h-4 text-[#464555] transition-transform ${detailsOpen() ? "rotate-180" : ""}`}
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
            <Show when={detailsOpen()}>
              <div class="rounded-xl overflow-hidden border border-slate-100">
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
                <For each={restorations()}>
                  {(item) => (
                    <div
                      class={`grid grid-cols-[2fr_2fr_1fr_80px] px-4 py-3 border-t border-slate-50 items-center border-l-2 ${
                        item.restored
                          ? "border-l-emerald-500"
                          : "border-l-red-400 bg-red-50/20"
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
            </Show>
          </section>
        </Show>
      </div>

      {/* Bottom action */}
      <div class="px-8 py-6 bg-slate-50/50 flex justify-center items-center border-t border-slate-100">
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-indigo-600 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all cursor-pointer bg-white"
          onClick={() => props.onReexecute?.()}
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
