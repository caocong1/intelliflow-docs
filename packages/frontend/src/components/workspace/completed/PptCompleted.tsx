import type { NodeConfig, NodeExecution, PptConfig } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";
import { type DownloadProgress, downloadBlobResponse } from "../../../lib/download";
import { formatDuration, formatFileSize, formatTime } from "../../../lib/format-utils";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
}

export default function PptCompleted(props: Props) {
  const [downloading, setDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal<DownloadProgress | null>(null);

  const result = () =>
    props.node.outputData as {
      filename: string;
      format: "pptx";
      fileSize: number;
      renderMode?: string;
      styleId?: string;
      warnings?: string[];
      compositionSummary?: Record<string, unknown> | null;
    } | null;

  const config = () => props.config as PptConfig | undefined;
  const duration = () => formatDuration(props.node.startedAt, props.node.completedAt);

  async function handleDownload() {
    const r = result();
    if (!r || downloading()) return;
    const token = localStorage.getItem("auth_token");
    try {
      setDownloading(true);
      setDownloadProgress(null);
      const res = await fetch(`/api/runtime/${props.documentId}/ppt/${props.node.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      await downloadBlobResponse(res, r.filename, {
        onProgress: (progress) => setDownloadProgress(progress),
      });
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  }

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      <div class="bg-gradient-to-b from-sky-50 to-white px-8 py-6 border-b border-slate-100 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full flex items-center justify-center bg-sky-600 shadow-lg">
            <span class="text-white text-sm font-bold">PPT</span>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-[#1b1b24]">PPT 已生成</h3>
            <p class="text-sm text-[#686477] mt-0.5">
              {formatTime(props.node.completedAt)} 完成 · 耗时 {duration()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!result() || downloading()}
          class="px-4 py-2 rounded-xl text-sm font-semibold bg-sky-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {downloading() ? "下载中..." : "下载 PPT"}
        </button>
      </div>

      <div class="p-8 space-y-5">
        <Show
          when={result()}
          fallback={<div class="text-sm text-slate-500">未找到 PPT 输出数据。</div>}
        >
          {(item) => (
            <>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCard label="文件名" value={item().filename} />
                <InfoCard label="大小" value={formatFileSize(item().fileSize)} />
                <InfoCard label="渲染模式" value={item().renderMode ?? "visual_premium_v1"} />
                <InfoCard label="风格" value={item().styleId ?? config()?.defaultStyleId ?? "-"} />
              </div>

              <Show when={item().warnings && item().warnings.length > 0}>
                <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h4 class="text-sm font-semibold text-amber-900 mb-2">质检信息</h4>
                  <ul class="space-y-1">
                    <For each={item().warnings}>
                      {(warning) => <li class="text-sm text-amber-800 leading-6">• {warning}</li>}
                    </For>
                  </ul>
                </div>
              </Show>

              <Show when={item().compositionSummary}>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 class="text-sm font-semibold text-slate-800 mb-2">编排摘要</h4>
                  <pre class="text-xs text-slate-600 whitespace-pre-wrap break-words">
                    {JSON.stringify(item().compositionSummary, null, 2)}
                  </pre>
                </div>
              </Show>
            </>
          )}
        </Show>

        <Show when={downloadProgress()}>
          {(progress) => (
            <div class="text-xs text-slate-500">
              正在下载 {formatFileSize(progress().receivedBytes)}
              {progress().totalBytes ? ` / ${formatFileSize(progress().totalBytes ?? 0)}` : ""}
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

function InfoCard(props: { label: string; value: string }) {
  return (
    <div class="rounded-xl border border-slate-200 bg-white p-4 min-w-0">
      <div class="text-xs text-slate-500 mb-1">{props.label}</div>
      <div class="text-sm font-semibold text-slate-900 truncate" title={props.value}>
        {props.value}
      </div>
    </div>
  );
}
