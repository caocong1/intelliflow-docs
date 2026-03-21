import { createSignal, For, onMount, Show } from "solid-js";
import { api } from "../../../api/client";
import type { ExportConfig, NodeExecution } from "@intelliflow/shared";

type ExportFormat = "word" | "pdf" | "markdown";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  word: "Word 文档",
  pdf: "PDF 文件",
  markdown: "Markdown 文件",
};

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  word: ".docx",
  pdf: ".pdf",
  markdown: ".md",
};

const FORMAT_ICONS: Record<ExportFormat, string> = {
  word: "W",
  pdf: "P",
  markdown: "M",
};

interface Props {
  nodeExecution: NodeExecution;
  config: ExportConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  readOnly: boolean;
}

export default function ExportExecutor(props: Props) {
  // ─── Null guard ──────────────────────────────────────────────────────────
  if (!props.config) {
    return (
      <div class="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div class="text-gray-400 text-sm">正在加载导出配置...</div>
      </div>
    );
  }

  // Filter out PPT from available formats
  const availableFormats = () =>
    ((props.config?.formats ?? ["word", "pdf", "markdown"]) as string[])
      .filter((f) => f !== "ppt") as ExportFormat[];

  const defaultFormat = () => {
    const configured = props.config?.defaultFormat;
    if (configured && configured !== "ppt" && availableFormats().includes(configured as ExportFormat)) {
      return configured as ExportFormat;
    }
    return availableFormats()[0] ?? "markdown";
  };

  const [format, setFormat] = createSignal<ExportFormat>(defaultFormat());
  const [filename, setFilename] = createSignal("");
  const [previewContent, setPreviewContent] = createSignal("");
  const [previewLoading, setPreviewLoading] = createSignal(true);
  const [exporting, setExporting] = createSignal(false);
  const [exportResult, setExportResult] = createSignal<{
    filename: string;
    format: string;
    fileSize: number;
  } | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // Check if already exported (read-only or re-visit)
  const existingOutput = () => {
    const out = props.nodeExecution.outputData as Record<string, unknown> | null;
    if (out?.filename && out?.format && out?.fileSize) {
      return {
        filename: out.filename as string,
        format: out.format as string,
        fileSize: out.fileSize as number,
      };
    }
    return null;
  };

  onMount(async () => {
    const existing = existingOutput();
    if (existing) {
      setExportResult(existing);
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await (api.api.runtime as any)[props.documentId].export[
        props.nodeExecution.id
      ].preview.get();

      if (res.data && !("error" in res.data)) {
        const data = res.data as { content: string; defaultFilename: string };
        setPreviewContent(data.content);
        setFilename(`${data.defaultFilename}${FORMAT_EXTENSIONS[format()]}`);
      } else {
        setError((res.data as any)?.error ?? "预览加载失败");
      }
    } catch {
      setError("预览加载失败");
    } finally {
      setPreviewLoading(false);
    }
  });

  function handleFormatChange(newFormat: ExportFormat) {
    setFormat(newFormat);
    const currentName = filename();
    const baseName = currentName.replace(/\.[^.]+$/, "");
    setFilename(`${baseName}${FORMAT_EXTENSIONS[newFormat]}`);
  }

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const res = await (api.api.runtime as any)[props.documentId].export[
        props.nodeExecution.id
      ].generate.post({
        format: format(),
        filename: filename(),
      });

      if (res.data && !("error" in res.data)) {
        const data = res.data as {
          filename: string;
          format: string;
          fileSize: number;
          storagePath: string;
        };
        setExportResult({
          filename: data.filename,
          format: data.format,
          fileSize: data.fileSize,
        });
        triggerDownload();
      } else {
        setError((res.data as any)?.error ?? "导出失败，请重试");
      }
    } catch {
      setError("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  }

  function triggerDownload() {
    const url = `/api/runtime/${props.documentId}/export/${props.nodeExecution.id}/download`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Simple markdown to HTML renderer
  function renderMarkdown(md: string): string {
    return md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-5 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^(?!<[hlu])(.*\S.*)$/gm, '<p class="my-1">$1</p>')
      .replace(/\n{2,}/g, '<div class="my-3"></div>');
  }

  // ─── Read-only mode (already exported) ──────────────────────────────────

  if (props.readOnly && existingOutput()) {
    const result = existingOutput()!;
    return (
      <div class="bg-white border border-gray-200 rounded-xl p-6">
        <h2 class="text-sm font-medium text-gray-700 mb-4">导出完成</h2>
        <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div class="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg font-bold">
            {FORMAT_ICONS[result.format as ExportFormat] ?? "F"}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">{result.filename}</p>
            <p class="text-xs text-gray-500">
              {FORMAT_LABELS[result.format as ExportFormat] ?? result.format.toUpperCase()} &middot; {formatFileSize(result.fileSize)}
            </p>
          </div>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            onClick={triggerDownload}
          >
            重新下载
          </button>
        </div>
      </div>
    );
  }

  // ─── Active export mode ─────────────────────────────────────────────────

  return (
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-800">文件导出</h2>
        <div class="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
          导出
        </div>
      </div>

      {/* Format selector + filename */}
      <div class="px-6 py-4 border-b border-gray-100 space-y-4">
        {/* Format selector */}
        <div>
          <span class="block text-xs font-medium text-gray-500 mb-2">导出格式</span>
          <div class="flex gap-2">
            <For each={availableFormats()}>
              {(fmt) => (
                <button
                  type="button"
                  class={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    format() === fmt
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => handleFormatChange(fmt)}
                  disabled={!!exportResult()}
                >
                  {FORMAT_LABELS[fmt]}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Filename input */}
        <div>
          <span class="block text-xs font-medium text-gray-500 mb-1">文件名称</span>
          <div class="flex items-center gap-2">
            <input
              type="text"
              class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={filename()}
              onInput={(e) => setFilename(e.currentTarget.value)}
              disabled={!!exportResult()}
              placeholder="请输入文件名..."
            />
            <span class="text-xs text-gray-400 whitespace-nowrap">
              {FORMAT_EXTENSIONS[format()]}
            </span>
          </div>
        </div>
      </div>

      {/* Preview area */}
      <div class="px-6 py-4 border-b border-gray-100">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-500">文件预览</span>
          <Show when={format() !== "markdown"}>
            <span class="text-xs text-gray-400">
              实际导出格式：{FORMAT_LABELS[format()]}
            </span>
          </Show>
        </div>

        <Show when={previewLoading()}>
          <div class="h-48 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
            <span class="text-sm text-gray-400">正在生成预览...</span>
          </div>
        </Show>

        <Show when={!previewLoading() && previewContent()}>
          <div
            class="prose prose-sm max-w-none max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm leading-relaxed"
            innerHTML={renderMarkdown(previewContent())}
          />
        </Show>

        <Show when={!previewLoading() && !previewContent() && !error()}>
          <div class="h-48 flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-lg">
            暂无可预览内容
          </div>
        </Show>
      </div>

      {/* Error display */}
      <Show when={error()}>
        <div class="px-6 py-3">
          <div class="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error()}</div>
        </div>
      </Show>

      {/* Export result */}
      <Show when={exportResult()}>
        {(result) => (
          <div class="px-6 py-4 border-b border-gray-100">
            <div class="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600 text-lg font-bold">
                {FORMAT_ICONS[result().format as ExportFormat] ?? "F"}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{result().filename}</p>
                <p class="text-xs text-green-600">
                  导出完成 &middot; {FORMAT_LABELS[result().format as ExportFormat] ?? result().format.toUpperCase()} &middot;{" "}
                  {formatFileSize(result().fileSize)}
                </p>
              </div>
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                onClick={triggerDownload}
              >
                下载文件
              </button>
            </div>
          </div>
        )}
      </Show>

      {/* Action buttons */}
      <Show when={!exportResult()}>
        <div class="px-6 py-4 flex justify-end">
          <button
            type="button"
            class="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            disabled={exporting() || previewLoading() || !filename()}
            onClick={handleExport}
          >
            <Show when={!exporting()}>
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </Show>
            {exporting() ? "正在生成..." : "下载文件"}
          </button>
        </div>
      </Show>
    </div>
  );
}
