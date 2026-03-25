import type { NodeConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createMemo, createSignal } from "solid-js";
import { formatDuration } from "../../../lib/format-utils";

interface DetectedItem {
  original: string;
  placeholder: string;
  sensitiveType: string;
  checked: boolean;
}

interface DesensitizeOutputData {
  text?: string;
  mappingCount?: number;
  detectedItems?: DetectedItem[];
}

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onFullscreen?: (content: string, title: string) => void;
}

/** Highlight placeholder tokens like [NAME_1] with amber background */
function HighlightedText(props: { text: string }) {
  const parts = createMemo(() => {
    const result: Array<{ type: "text" | "placeholder"; value: string }> = [];
    const regex = /\[([A-Z_]+\d*)\]/g;
    let last = 0;
    let match: RegExpExecArray | null;
    const t = props.text;
    // biome-ignore lint/suspicious/noAssignInExpressions: intentional loop pattern
    while ((match = regex.exec(t)) !== null) {
      if (match.index > last) {
        result.push({ type: "text", value: t.slice(last, match.index) });
      }
      result.push({ type: "placeholder", value: match[0] });
      last = match.index + match[0].length;
    }
    if (last < t.length) {
      result.push({ type: "text", value: t.slice(last) });
    }
    return result;
  });

  return (
    <span>
      <For each={parts()}>
        {(part) =>
          part.type === "placeholder" ? (
            <span class="bg-amber-100 text-amber-800 px-0.5 rounded font-mono text-xs">
              {part.value}
            </span>
          ) : (
            <span>{part.value}</span>
          )
        }
      </For>
    </span>
  );
}

const TYPE_LABEL_MAP: Record<string, string> = {
  NAME: "姓名",
  PHONE: "电话",
  EMAIL: "邮件",
  ID: "证件",
  ADDRESS: "地址",
  ORG: "机构",
  DATE: "日期",
  AMOUNT: "金额",
  BANK: "银行卡",
  IP: "IP地址",
};

function getTypeLabel(sensitiveType: string): string {
  const base = sensitiveType.replace(/_\d+$/, "");
  return TYPE_LABEL_MAP[base] ?? sensitiveType;
}

export default function DesensitizeCompleted(props: Props) {
  const [copied, setCopied] = createSignal(false);

  const od = createMemo(() => (props.node.outputData as DesensitizeOutputData | null) ?? null);

  const detectedItems = createMemo(() => od()?.detectedItems ?? []);
  const totalDetected = createMemo(() => detectedItems().length || (od()?.mappingCount ?? 0));
  const desensitizedCount = createMemo(() => detectedItems().filter((i) => i.checked).length);
  const skippedCount = createMemo(() => detectedItems().filter((i) => !i.checked).length);

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

  return (
    <div
      class="bg-white rounded-2xl overflow-hidden"
      style={{ "box-shadow": "0 12px 40px rgba(25,28,30,0.06)" }}
    >
      {/* Header */}
      <div class="px-6 pt-6 pb-4">
        <div class="flex items-start justify-between gap-4">
          {/* Left: icon + title */}
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              }}
            >
              {/* Shield icon */}
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

          {/* Right: badge + duration */}
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
        {/* Total detected */}
        <div class="rounded-xl px-4 py-3 bg-[#f7f9fb]">
          <p class="text-[10px] font-medium text-[#777587] uppercase tracking-wide mb-1">
            检测总数
          </p>
          <p class="text-2xl font-bold text-[#191c1e]">{totalDetected()}</p>
        </div>
        {/* Desensitized */}
        <div class="rounded-xl px-4 py-3 bg-emerald-50">
          <p class="text-[10px] font-medium text-emerald-600 uppercase tracking-wide mb-1">
            已脱敏
          </p>
          <p class="text-2xl font-bold text-emerald-700">{desensitizedCount()}</p>
        </div>
        {/* Skipped */}
        <div class="rounded-xl px-4 py-3 bg-slate-50">
          <p class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">已跳过</p>
          <p class="text-2xl font-bold text-slate-600">{skippedCount()}</p>
        </div>
      </div>

      {/* Two-column content */}
      <div class="px-6 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: details table */}
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-[#464555] uppercase tracking-wide">脱敏详情</h4>
          <Show
            when={detectedItems().length > 0}
            fallback={
              <div class="rounded-xl border border-[rgba(199,196,216,0.2)] px-4 py-6 text-center text-xs text-[#777587] italic">
                暂无检测记录
              </div>
            }
          >
            <div class="rounded-xl border border-[rgba(199,196,216,0.2)] overflow-hidden">
              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.15)]">
                    <th class="px-3 py-2 text-left font-semibold text-[#777587]">类型</th>
                    <th class="px-3 py-2 text-left font-semibold text-[#777587]">占位符</th>
                    <th class="px-3 py-2 text-center font-semibold text-[#777587]">状态</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={detectedItems()}>
                    {(item) => (
                      <tr class="border-b border-[rgba(199,196,216,0.1)] hover:bg-[#f7f9fb] transition-colors last:border-0">
                        <td class="px-3 py-2">
                          <span class="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium text-[10px]">
                            {getTypeLabel(item.sensitiveType)}
                          </span>
                        </td>
                        <td class="px-3 py-2 font-mono text-[#191c1e] text-[11px]">
                          {item.placeholder}
                        </td>
                        <td class="px-3 py-2 text-center">
                          <Show
                            when={item.checked}
                            fallback={<span class="text-slate-400 text-base leading-none">—</span>}
                          >
                            <svg
                              class="w-4 h-4 text-emerald-500 inline-block"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              stroke-width="2.5"
                              aria-hidden="true"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>

        {/* Right: text preview */}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-[#464555] uppercase tracking-wide">脱敏文本预览</h4>
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
      </div>

      {/* Bottom action */}
      <div class="px-6 pb-6 flex justify-end border-t border-[rgba(199,196,216,0.1)] pt-4">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          从此节点重新执行
        </button>
      </div>
    </div>
  );
}
