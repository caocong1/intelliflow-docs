import type { ExportConfig, NodeConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";
import { downloadBlobResponse, type DownloadProgress } from "../../../lib/download";
import { formatDuration, formatFileSize, formatTime } from "../../../lib/format-utils";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
}

const FORMAT_LABELS: Record<string, string> = {
  word: "Word 文档",
  pdf: "PDF 文件",
  markdown: "Markdown 文件",
  pptx: "PPT 演示文稿",
};

const FORMAT_ICONS: Record<string, string> = {
  word: "W",
  pdf: "P",
  markdown: "M",
  pptx: "S",
};

const FORMAT_COLORS: Record<string, string> = {
  word: "bg-blue-100 text-blue-600",
  pdf: "bg-red-100 text-red-600",
  markdown: "bg-indigo-100 text-indigo-600",
  pptx: "bg-orange-100 text-orange-600",
};

export default function ExportCompleted(props: Props) {
  const [configExpanded, setConfigExpanded] = createSignal(false);
  const [downloading, setDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal<DownloadProgress | null>(null);

  const result = () =>
    props.node.outputData as {
      filename: string;
      format: string;
      fileSize: number;
      filePath?: string;
      templateId?: string | null;
      renderMode?: string;
      warnings?: string[];
      compositionSummary?: Record<string, unknown> | null;
    } | null;

  const config = () => props.config as ExportConfig | undefined;

  const duration = () => formatDuration(props.node.startedAt, props.node.completedAt);

  const formatLabel = () => FORMAT_LABELS[result()?.format ?? ""] ?? result()?.format ?? "";

  const formatIcon = () =>
    FORMAT_ICONS[result()?.format ?? ""] ?? result()?.format?.[0]?.toUpperCase() ?? "?";

  const formatColor = () => FORMAT_COLORS[result()?.format ?? ""] ?? "bg-gray-100 text-gray-600";

  async function handleDownload() {
    const r = result();
    if (!r || downloading()) return;
    const downloadUrl = `/api/runtime/${props.documentId}/export/${props.node.id}/download`;
    const token = localStorage.getItem("auth_token");
    try {
      setDownloading(true);
      setDownloadProgress(null);
      const res = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      await downloadBlobResponse(res, r.filename, {
        onProgress: (progress) => setDownloadProgress(progress),
      });
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  }

  async function handleCopyAll() {
    const r = result();
    if (!r?.filename) return;
    const token = localStorage.getItem("auth_token");
    try {
      const resp = await fetch(`/api/runtime/${props.documentId}/export/${props.node.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await resp.text();
      await navigator.clipboard.writeText(text);
    } catch {
      // silently fail
    }
  }

  const configEntries = () => {
    const c = config();
    if (!c) return [];
    const entries: Array<{ label: string; value: string }> = [];
    if (c.formats?.length) {
      entries.push({
        label: "允许格式",
        value: c.formats.map((f) => FORMAT_LABELS[f] ?? f).join("、"),
      });
    }
    if (c.templateId) {
      entries.push({ label: "模板 ID", value: c.templateId });
    }
    return entries;
  };

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-b from-[#f2f4f6] to-white px-8 py-6 border-b border-slate-100 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)" }}
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-[#191c1e]">{props.node.nodeLabel}</h2>
            <span class="inline-block mt-1 px-2.5 py-0.5 bg-teal-50 text-teal-700 text-[11px] font-bold rounded-full">
              文件导出
            </span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full">
            <div class="w-2 h-2 rounded-full bg-green-500" />
            <span class="text-green-700 text-xs font-semibold">导出成功</span>
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
        <Show when={result()}>
          {(r) => (
            <>
              {/* File Card */}
              <div class="flex flex-col items-center gap-6">
                <div class="w-full max-w-sm bg-[#f2f4f6] rounded-2xl p-6 flex flex-col items-center gap-4 shadow-[0_4px_20px_rgba(25,28,30,0.06)]">
                  {/* Format icon */}
                  <div
                    class={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${formatColor()}`}
                  >
                    {formatIcon()}
                  </div>
                  {/* Filename */}
                  <div class="text-center">
                    <p class="text-sm font-semibold text-[#191c1e] break-all">{r().filename}</p>
                    <p class="text-[12px] text-[#464555] mt-1">
                      {formatLabel()}
                      <Show when={r().fileSize}>
                        {" · "}
                        {formatFileSize(r().fileSize)}
                      </Show>
                    </p>
                  </div>
                  {/* Timestamp */}
                  <Show when={props.node.completedAt}>
                    <p class="text-[11px] text-[#777587]">{formatTime(props.node.completedAt)}</p>
                  </Show>
                </div>

                {/* Action buttons */}
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    class="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer border-0 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)" }}
                    disabled={downloading()}
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {downloading() ? "下载中..." : "下载文件"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    class="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-[#3525cd] rounded-xl border border-[#3525cd]/30 hover:bg-[#3525cd]/5 active:scale-95 transition-all cursor-pointer bg-white"
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    复制全文
                  </button>
                </div>

                <Show when={downloading() && downloadProgress()}>
                  {(progress) => (
                    <div class="w-full max-w-sm rounded-xl border border-[rgba(79,70,229,0.12)] bg-indigo-50 px-4 py-3">
                      <div class="flex items-center justify-between gap-4 text-xs text-[#4f46e5]">
                        <span class="font-medium">
                          {progress().percent != null
                            ? `正在下载 ${progress().percent}%`
                            : "正在下载文件..."}
                        </span>
                        <span class="tabular-nums">
                          {formatFileSize(progress().receivedBytes)}
                          <Show when={progress().totalBytes != null}>
                            {` / ${formatFileSize(progress().totalBytes ?? 0)}`}
                          </Show>
                        </span>
                      </div>
                      <div class="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(79,70,229,0.12)]">
                        <div
                          class={`h-full rounded-full bg-[#4f46e5] transition-[width] duration-200 ${
                            progress().percent == null ? "animate-pulse w-1/3" : ""
                          }`}
                          style={
                            progress().percent != null
                              ? { width: `${progress().percent}%` }
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  )}
                </Show>

                <Show when={r().format === "pptx" && (r().renderMode || r().warnings?.length || r().compositionSummary)}>
                  <div class="w-full max-w-2xl rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                    <Show when={r().renderMode}>
                      <p class="text-xs text-slate-600">
                        <span class="font-medium text-slate-700">渲染模式：</span>
                        {r().renderMode}
                      </p>
                    </Show>
                    <Show when={r().compositionSummary}>
                      <p class="text-xs text-slate-600">
                        <span class="font-medium text-slate-700">编排摘要：</span>
                        来源 {(r().compositionSummary?.source as string) ?? "-"}
                        {" · "}
                        页数 {(r().compositionSummary?.totalSlides as number) ?? "-"}
                        <Show when={typeof r().compositionSummary?.matchedSlides === "number"}>
                          {` · 模板命中 ${r().compositionSummary?.matchedSlides as number}`}
                        </Show>
                      </p>
                    </Show>
                    <Show when={r().warnings && r().warnings!.length > 0}>
                      <div class="space-y-1">
                        <For each={r().warnings}>
                          {(warning) => (
                            <div class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                              {warning}
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </>
          )}
        </Show>

        {/* Export Config (collapsible) */}
        <Show when={configEntries().length > 0}>
          <section>
            <button
              type="button"
              onClick={() => setConfigExpanded((v) => !v)}
              class="flex items-center gap-3 w-full text-left mb-0 bg-transparent border-0 cursor-pointer p-0 group"
            >
              <h3 class="text-[13px] font-bold text-[#191c1e] uppercase tracking-wider">
                导出配置
              </h3>
              <div class="flex-1 h-[1px] bg-slate-100" />
              <svg
                class={`w-4 h-4 text-[#464555] transition-transform flex-shrink-0 ${configExpanded() ? "rotate-180" : ""}`}
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
            <Show when={configExpanded()}>
              <div class="mt-4">
                <For each={configEntries()}>
                  {(entry) => (
                    <div class="flex py-3 border-b border-slate-50 items-start hover:bg-slate-50/50 transition-colors px-2 -mx-2 rounded-md">
                      <span class="text-sm text-[#464555] w-[160px] flex-shrink-0">
                        {entry.label}
                      </span>
                      <span class="text-sm text-[#191c1e] font-medium">{entry.value}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>
        </Show>
      </div>
    </div>
  );
}
