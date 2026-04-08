import type {
  DesensitizeOutputData,
  DesensitizeReviewSummaryItem,
  NodeConfig,
  NodeExecution,
  SourceOutput,
} from "@intelliflow/shared";
import { For, Show, createMemo, createSignal } from "solid-js";
import { formatDuration } from "../../../lib/format-utils";
import HighlightedText from "../shared/HighlightedText";
import { getTypeLabel, typeBadgeClass } from "../shared/desensitize-utils";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onFullscreen?: (content: string, title: string) => void;
  onReexecute?: () => void;
}

export default function DesensitizeCompleted(props: Props) {
  const [copied, setCopied] = createSignal(false);

  const od = createMemo(() => (props.node.outputData as DesensitizeOutputData | null) ?? null);

  // Multi-source: check if output has sources field
  const hasSources = createMemo(() => {
    const s = od()?.sources;
    return !!(s && Object.keys(s).length > 0);
  });
  const sourceEntries = createMemo(
    () => Object.entries(od()?.sources ?? {}) as [string, SourceOutput][],
  );

  // Stats computation
  const detectedItems = createMemo(() => od()?.detectedItems ?? []);
  const totalDetected = createMemo(() => detectedItems().length || (od()?.mappingCount ?? 0));
  const desensitizedCount = createMemo(() => detectedItems().filter((i) => i.checked).length);
  const skippedCount = createMemo(() => detectedItems().filter((i) => !i.checked).length);

  // Per-source stats: count placeholders as detected items
  function perSourceStats(src: SourceOutput) {
    if (!src.desensitizedText) return { detected: 0, desensitized: 0, skipped: 0 };
    const matches = src.desensitizedText.match(/\[([A-Z_]+)(\d+)\]/g);
    return { detected: matches?.length ?? 0, desensitized: matches?.length ?? 0, skipped: 0 };
  }

  const previewText = createMemo(() => od()?.text ?? "");
  const duration = createMemo(() => formatDuration(props.node.startedAt, props.node.completedAt));

  function handleCopy() {
    const text = previewText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleFullscreen() {
    props.onFullscreen?.(previewText(), props.node.nodeLabel);
  }

  // Aggregate desensitized text for copy
  const allDesensitizedText = createMemo(() => {
    if (hasSources()) {
      return sourceEntries()
        .map(([, src]) => src.desensitizedText)
        .filter(Boolean)
        .join("\n\n");
    }
    return previewText();
  });

  function handleCopyAll() {
    const text = allDesensitizedText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      class="bg-white rounded-2xl overflow-hidden"
      style={{ "box-shadow": "0 12px 40px rgba(25,28,30,0.06)" }}
    >
      {/* Header */}
      <div class="px-6 pt-6 pb-4">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)" }}
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2.5 flex-wrap">
                <h3 class="font-bold text-[#191c1e] text-base">{props.node.nodeLabel}</h3>
                <span class="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
                  信息脱敏
                </span>
              </div>
              <p class="text-xs text-[#777587] mt-0.5">自动检测并替换敏感信息</p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              审核完成 · 已脱敏 {totalDetected()} 项
            </span>
            <span class="text-xs text-[#777587]">{duration()}</span>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div class="px-6 pb-4 grid grid-cols-3 gap-3">
        <div class="rounded-xl px-4 py-3 bg-[#f7f9fb]">
          <p class="text-[10px] font-medium text-[#777587] uppercase tracking-wide mb-1">
            检测总数
          </p>
          <p class="text-2xl font-bold text-[#191c1e]">{totalDetected()}</p>
        </div>
        <div class="rounded-xl px-4 py-3 bg-emerald-50">
          <p class="text-[10px] font-medium text-emerald-600 uppercase tracking-wide mb-1">
            已脱敏
          </p>
          <p class="text-2xl font-bold text-emerald-700">{desensitizedCount()}</p>
        </div>
        <div class="rounded-xl px-4 py-3 bg-slate-50">
          <p class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">已跳过</p>
          <p class="text-2xl font-bold text-slate-600">{skippedCount()}</p>
        </div>
      </div>

      {/* Content area */}
      <div class="px-6 pb-5">
        <Show
          when={hasSources()}
          fallback={
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold text-[#464555] uppercase tracking-wide">
                  脱敏文本预览
                </h4>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="p-1.5 rounded-lg hover:bg-[#f2f4f6] transition-colors text-[#777587] hover:text-[#191c1e]"
                    title={copied() ? "已复制" : "复制文本"}
                    onClick={handleCopy}
                  >
                    <Show
                      when={!copied()}
                      fallback={
                        <svg
                          class="w-3.5 h-3.5 text-emerald-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                          aria-hidden="true"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      }
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
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </Show>
                  </button>
                  <Show when={props.onFullscreen}>
                    <button
                      type="button"
                      class="p-1.5 rounded-lg hover:bg-[#f2f4f6] transition-colors text-[#777587] hover:text-[#191c1e]"
                      title="全屏查看"
                      onClick={handleFullscreen}
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
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        />
                      </svg>
                    </button>
                  </Show>
                </div>
              </div>
              <Show
                when={previewText()}
                fallback={
                  <div class="rounded-xl border border-[rgba(199,196,216,0.2)] px-4 py-6 text-center text-xs text-[#777587] italic">
                    无脱敏文本
                  </div>
                }
              >
                <div class="rounded-xl border border-[rgba(199,196,216,0.2)] bg-[#f7f9fb] p-4 max-h-60 overflow-y-auto">
                  <p class="text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                    <HighlightedText text={previewText()} />
                  </p>
                </div>
              </Show>
            </div>
          }
        >
          {/* Multi-source: vertical cards */}
          <div class="space-y-4">
            <For each={sourceEntries()}>
              {([_outputId, src]) => {
                const stats = createMemo(() => perSourceStats(src));
                return (
                  <div class="rounded-xl border border-[rgba(199,196,216,0.25)] overflow-hidden">
                    {/* Card header with displayName */}
                    <div class="px-4 py-2.5 bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.15)]">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-medium text-[#464555]">{src.displayName}</span>
                        <span class="text-[10px] text-[#9fa0a8]">检测 {stats().detected} 项</span>
                      </div>
                    </div>

                    {/* Card content */}
                    <div class="p-4 space-y-3">
                      {/* Per-source stats */}
                      <div class="grid grid-cols-3 gap-2">
                        <div class="rounded-lg px-3 py-1.5 bg-[#f7f9fb]">
                          <p class="text-[10px] text-[#777587]">检测</p>
                          <p class="text-base font-bold text-[#191c1e]">{stats().detected}</p>
                        </div>
                        <div class="rounded-lg px-3 py-1.5 bg-emerald-50">
                          <p class="text-[10px] text-emerald-600">已脱敏</p>
                          <p class="text-base font-bold text-emerald-700">{stats().desensitized}</p>
                        </div>
                        <div class="rounded-lg px-3 py-1.5 bg-slate-50">
                          <p class="text-[10px] text-slate-500">跳过</p>
                          <p class="text-base font-bold text-slate-600">{stats().skipped}</p>
                        </div>
                      </div>

                      {/* Desensitized text with HighlightedText */}
                      <Show when={src.desensitizedText}>
                        <div class="bg-[#f7f9fb] rounded-xl p-4 max-h-48 overflow-y-auto">
                          <p class="text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                            <HighlightedText text={src.desensitizedText} />
                          </p>
                        </div>
                      </Show>

                      {/* File sources: sub-cards */}
                      <Show when={src.files && src.files.length > 0}>
                        <div class="space-y-2">
                          <For each={src.files}>
                            {(file) => (
                              <div class="rounded-lg border border-[rgba(199,196,216,0.2)] overflow-hidden">
                                <div class="px-3 py-1.5 bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.15)]">
                                  <span class="text-[10px] font-medium text-[#464555]">
                                    {file.name}
                                  </span>
                                </div>
                                <div class="p-3 bg-white">
                                  <Show when={file.desensitizedText}>
                                    <p class="text-xs text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                                      <HighlightedText text={file.desensitizedText} />
                                    </p>
                                  </Show>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>

            {/* Copy all button for multi-source */}
            <div class="flex justify-end">
              <button
                type="button"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#464555] hover:text-[#191c1e] bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border-0 cursor-pointer"
                onClick={handleCopyAll}
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                复制全部
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Bottom action */}
      <div class="px-6 pb-6 flex justify-end border-t border-[rgba(199,196,216,0.1)] pt-4">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
          onClick={() => props.onReexecute?.()}
        >
          从此节点重新执行
        </button>
      </div>
    </div>
  );
}
