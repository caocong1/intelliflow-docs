import type { ExportConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { advanceNode, generateExport, getExportPreview } from "../../../api/client";
import { downloadBlobResponse, type DownloadProgress } from "../../../lib/download";
import { listStylePacks, type StylePackItem } from "../../../lib/api/style-packs";
import {
  DEFAULT_PPT_STYLE_PACK_ID,
  isPptExportResultStale as getIsPptExportResultStale,
  normalizePptStylePackId,
} from "../../../lib/ppt-export";
import { sanitizeHtml } from "../../../lib/sanitize";

type ExportFormat = "word" | "pdf" | "markdown" | "pptx";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  word: "Word 文档",
  pdf: "PDF 文件",
  markdown: "Markdown 文件",
  pptx: "PPT 演示文稿",
};

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  word: ".docx",
  pdf: ".pdf",
  markdown: ".md",
  pptx: ".pptx",
};

const FORMAT_ICONS: Record<ExportFormat, string> = {
  word: "W",
  pdf: "P",
  markdown: "M",
  pptx: "S",
};

const PPT_EXPORT_STAGES = ["内容编排中", "风格渲染中", "导出生成中"] as const;

interface Props {
  nodeExecution: NodeExecution;
  config: ExportConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  onCompleted?: () => Promise<void> | void;
  readOnly: boolean;
}

async function fetchStylePacks(): Promise<StylePackItem[]> {
  return listStylePacks();
}

function withHash(color: string): string {
  return color.startsWith("#") ? color : `#${color}`;
}

function buildStylePackCardBackground(pack: StylePackItem): string {
  const { coverFill, primary, secondary, background } = pack.preview;
  if (coverFill === "gradient") {
    return `linear-gradient(135deg, ${withHash(primary)} 0%, ${withHash(secondary)} 100%)`;
  }
  if (coverFill === "accent_bar") {
    return `linear-gradient(180deg, ${withHash(background)} 0%, ${withHash(background)} 76%, ${withHash(pack.preview.accent)} 76%, ${withHash(pack.preview.accent)} 100%)`;
  }
  return withHash(primary);
}

function getStylePackPreviewTags(pack: StylePackItem): string[] {
  const tags: string[] = [];
  tags.push(
    pack.preview.coverFill === "gradient"
      ? "渐变封面"
      : pack.preview.coverFill === "accent_bar"
        ? "强调条封面"
        : "纯色封面",
  );
  tags.push(pack.preview.titleAlign === "center" ? "标题居中" : "标题左对齐");
  if (pack.preview.cardShadow) tags.push("卡片投影");
  if (pack.preview.cornerRadius > 0.09) tags.push("圆角更强");
  else if (pack.preview.cornerRadius === 0) tags.push("锐角理性");
  if (pack.preview.dividerStyle === "dot") tags.push("点状分隔");
  if (pack.preview.dividerStyle === "none") tags.push("弱化分隔");
  return tags.slice(0, 3);
}

export default function ExportExecutor(props: Props) {
  // ─── Null guard ──────────────────────────────────────────────────────────
  if (!props.config) {
    return (
      <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] p-8 text-center">
        <div class="text-[#464555] text-sm">正在加载导出配置...</div>
      </div>
    );
  }

  // Use configured formats, fallback to all non-PPT formats for backward compatibility
  const FORMAT_ALIASES: Record<string, ExportFormat> = {
    docx: "word",
    doc: "word",
    md: "markdown",
  };
  const availableFormats = (): ExportFormat[] => {
    const configured = props.config?.formats;
    if (configured && configured.length > 0) {
      return configured.map((f) => FORMAT_ALIASES[f] ?? f) as ExportFormat[];
    }
    // Backward compat: single format field
    const legacy = props.config?.format;
    if (legacy) {
      const mapped = FORMAT_ALIASES[legacy] ?? legacy;
      return [mapped as ExportFormat];
    }
    return ["word", "pdf", "markdown"];
  };

  const defaultFormat = (): ExportFormat => {
    const formats = availableFormats();
    return formats[0] ?? "markdown";
  };

  const [format, setFormat] = createSignal<ExportFormat>(defaultFormat());
  const [filename, setFilename] = createSignal("");
  const [previewContent, setPreviewContent] = createSignal("");
  const [previewLoading, setPreviewLoading] = createSignal(true);
  const [exporting, setExporting] = createSignal(false);
  const [completing, setCompleting] = createSignal(false);
  const [downloading, setDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal<DownloadProgress | null>(null);
  const [selectedStylePackId, setSelectedStylePackId] = createSignal<string>(DEFAULT_PPT_STYLE_PACK_ID);
  const [pptExportStageIndex, setPptExportStageIndex] = createSignal(0);
  const [exportResult, setExportResult] = createSignal<{
    filename: string;
    format: string;
    fileSize: number;
    templateId?: string | null;
    stylePackId?: string;
    renderMode?: string;
    warnings?: string[];
    compositionSummary?: Record<string, unknown> | null;
  } | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [stylePacks] = createResource(fetchStylePacks);
  let pptStageTimer: ReturnType<typeof setInterval> | undefined;
  const stylePackOptions = createMemo<StylePackItem[]>(() => {
    const packs = stylePacks() ?? [];
    if (packs.some((pack) => pack.id === DEFAULT_PPT_STYLE_PACK_ID)) {
      return packs;
    }
    return [
      {
        id: DEFAULT_PPT_STYLE_PACK_ID,
        label: "商务深蓝",
        preview: {
          primary: "1E3A5F",
          secondary: "3B82F6",
          accent: "F59E0B",
          background: "FFFFFF",
          surface: "F8FAFC",
          text: "1F2937",
          coverFill: "gradient",
          titleAlign: "center",
          cornerRadius: 0.08,
          cardShadow: true,
          dividerStyle: "line",
        },
      },
      ...packs,
    ];
  });
  const latestExportResult = createMemo(() => {
    const local = exportResult();
    if (local) return local;
    const output = props.nodeExecution.outputData as Record<string, unknown> | null;
    if (
      output &&
      typeof output.filename === "string" &&
      typeof output.format === "string" &&
      typeof output.fileSize === "number"
    ) {
      return {
        filename: output.filename,
        format: output.format,
        fileSize: output.fileSize,
        templateId: typeof output.templateId === "string" ? output.templateId : null,
        stylePackId: typeof output.stylePackId === "string" ? output.stylePackId : undefined,
        renderMode: typeof output.renderMode === "string" ? output.renderMode : undefined,
        warnings: Array.isArray(output.warnings)
          ? output.warnings.filter((item): item is string => typeof item === "string")
          : undefined,
        compositionSummary:
          output.compositionSummary && typeof output.compositionSummary === "object"
            ? (output.compositionSummary as Record<string, unknown>)
            : null,
      };
    }
    return null;
  });
  const isPptExportResultStale = createMemo(() => {
    if (format() !== "pptx") return false;
    const result = latestExportResult();
    if (!result || result.format !== "pptx") return false;
    return getIsPptExportResultStale(selectedStylePackId(), result.stylePackId ?? null);
  });

  createEffect(() => {
    if (format() === "pptx") {
      selectedStylePackId();
      setExportResult(null);
    }
  });

  onMount(async () => {
    try {
      const result = await getExportPreview(props.documentId, props.nodeExecution.id);
      if (result && !("error" in result)) {
        setPreviewContent(result.content);
        setFilename(`${result.defaultFilename}${FORMAT_EXTENSIONS[format()]}`);
      } else {
        const errMsg =
          typeof result === "object" && result !== null && "error" in result
            ? (result as { error: string }).error
            : "预览加载失败";
        setError(errMsg);
      }
    } catch {
      setError("预览加载失败");
    } finally {
      setPreviewLoading(false);
    }
  });

  onCleanup(() => {
    stopPptExportStages();
  });

  function handleFormatChange(newFormat: ExportFormat) {
    setFormat(newFormat);
    const currentName = filename();
    const baseName = currentName.replace(/\.[^.]+$/, "");
    setFilename(`${baseName}${FORMAT_EXTENSIONS[newFormat]}`);
    setExportResult(null);
  }

  function startPptExportStages() {
    setPptExportStageIndex(0);
    if (pptStageTimer) clearInterval(pptStageTimer);
    pptStageTimer = setInterval(() => {
      setPptExportStageIndex((current) => Math.min(current + 1, PPT_EXPORT_STAGES.length - 1));
    }, 900);
  }

  function stopPptExportStages() {
    if (pptStageTimer) {
      clearInterval(pptStageTimer);
      pptStageTimer = undefined;
    }
  }

  async function handleExport() {
    if (exporting() || downloading()) return;
    setExporting(true);
    setError(null);
    if (format() === "pptx") {
      startPptExportStages();
    }

    try {
      const runtimeStylePackId =
        format() === "pptx"
          ? normalizePptStylePackId(selectedStylePackId())
          : undefined;
      const result = await generateExport(
        props.documentId,
        props.nodeExecution.id,
        format(),
        filename(),
        undefined,
        runtimeStylePackId,
      );

      if (result && !("error" in result)) {
        setExportResult({
          filename: result.filename,
          format: result.format,
          fileSize: result.fileSize,
          templateId: result.templateId ?? null,
          stylePackId: result.stylePackId ?? runtimeStylePackId ?? undefined,
          renderMode: result.renderMode,
          warnings: result.warnings,
          compositionSummary:
            result.compositionSummary && typeof result.compositionSummary === "object"
              ? result.compositionSummary
              : null,
        });
        setExporting(false);
        await triggerDownload();
      } else {
        const errMsg =
          typeof result === "object" && result !== null && "error" in result
            ? (result as { error: string }).error
            : "导出失败，请重试";
        setError(errMsg);
      }
    } catch {
      setError("导出失败，请重试");
    } finally {
      stopPptExportStages();
      setExporting(false);
    }
  }

  async function handleComplete() {
    if (completing()) return;
    setCompleting(true);
    setError(null);

    try {
      const result = await advanceNode(props.documentId, props.nodeExecution.id);
      if (result && !("error" in result)) {
        await props.onCompleted?.();
      } else {
        setError("完成导出失败，请重试");
      }
    } catch {
      setError("完成导出失败，请重试");
    } finally {
      setCompleting(false);
    }
  }

  async function triggerDownload() {
    if (downloading()) return;
    const url = `/api/runtime/${props.documentId}/export/${props.nodeExecution.id}/download`;
    const token = localStorage.getItem("auth_token");
    setDownloading(true);
    setDownloadProgress(null);

    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setError("下载失败，请重试");
        return;
      }
      await downloadBlobResponse(res, filename() || exportResult()?.filename || "export", {
        onProgress: (progress) => setDownloadProgress(progress),
      });
    } catch {
      setError("下载失败，请重试");
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inlineFmt(s: string): string {
    return s
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(
        /`(.+?)`/g,
        '<code class="px-1 py-0.5 bg-[#f1f3f5] rounded text-xs font-mono">$1</code>',
      )
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#4f46e5] underline">$1</a>');
  }

  function renderTableBlock(tableLines: string[]): string {
    const parseRow = (line: string) =>
      line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());
    const isSep = (line: string) => /^\|?[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|?$/.test(line.trim());

    const hasSep = tableLines.length >= 2 && isSep(tableLines[1]);
    const headers = hasSep ? parseRow(tableLines[0]) : [];
    const dataLines = hasSep ? tableLines.slice(2) : tableLines;
    const rows = dataLines.filter((l) => !isSep(l)).map(parseRow);

    let html =
      '<div class="overflow-x-auto my-3"><table class="w-full text-sm border-collapse border border-[rgba(199,196,216,0.3)]">';
    if (headers.length > 0) {
      html += "<thead><tr>";
      for (const h of headers) {
        html += `<th class="px-3 py-2 text-left font-semibold bg-[#f1f3f5] border border-[rgba(199,196,216,0.3)]">${inlineFmt(esc(h))}</th>`;
      }
      html += "</tr></thead>";
    }
    html += "<tbody>";
    for (const row of rows) {
      html += "<tr>";
      for (const cell of row) {
        html += `<td class="px-3 py-2 border border-[rgba(199,196,216,0.3)]">${inlineFmt(esc(cell))}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table></div>";
    return html;
  }

  function renderLine(raw: string): string {
    // Blockquote — check before escaping since > becomes &gt;
    const bq = raw.match(/^>\s(.*)/);
    if (bq)
      return `<blockquote class="pl-3 border-l-4 border-[rgba(199,196,216,0.4)] text-[#464555] my-1">${inlineFmt(esc(bq[1]))}</blockquote>`;

    const s = esc(raw);
    // Headers h1–h6
    const hMatch = s.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = [
        "text-xl font-bold mt-6 mb-2",
        "text-lg font-semibold mt-5 mb-2",
        "text-base font-semibold mt-4 mb-1",
        "text-sm font-semibold mt-3 mb-1",
        "text-sm font-medium mt-2 mb-1",
        "text-sm font-medium mt-2 mb-0.5",
      ][level - 1];
      return `<h${level} class="${cls}">${inlineFmt(hMatch[2])}</h${level}>`;
    }
    const li = s.match(/^[-*]\s+(.+)$/);
    if (li) return `<li class="ml-4 list-disc">${inlineFmt(li[1])}</li>`;
    const oli = s.match(/^\d+\.\s+(.+)$/);
    if (oli) return `<li class="ml-4 list-decimal">${inlineFmt(oli[1])}</li>`;
    return `<p class="my-1">${inlineFmt(s)}</p>`;
  }

  function renderMarkdown(md: string): string {
    const lines = md.split("\n");
    const parts: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Table block
      if (line.trim().startsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        parts.push(renderTableBlock(tableLines));
        continue;
      }

      // Code block
      if (line.trim().startsWith("```")) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        parts.push(
          `<pre class="bg-[#f1f3f5] rounded-lg p-3 my-2 overflow-x-auto"><code class="text-sm font-mono">${esc(codeLines.join("\n"))}</code></pre>`,
        );
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(line.trim())) {
        parts.push('<hr class="my-4 border-[rgba(199,196,216,0.3)]" />');
        i++;
        continue;
      }

      // Empty line
      if (line.trim() === "") {
        parts.push('<div class="my-3"></div>');
        i++;
        continue;
      }

      parts.push(renderLine(line));
      i++;
    }

    return parts.join("\n");
  }

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="px-6 py-4 border-b border-[rgba(199,196,216,0.15)] flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg
              class="w-5 h-5 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <div class="w-1 h-4 bg-[#4f46e5] rounded-full" />
              <h2 class="text-sm font-semibold text-[#191c1e]">文件导出</h2>
            </div>
            <p class="text-xs text-[#464555] mt-0.5">选择导出格式并下载文档</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50">
          <div class="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span class="text-xs text-indigo-600 font-medium">导出</span>
        </div>
      </div>

      {/* Format selector + filename */}
      <div class="px-6 py-4 border-b border-[rgba(199,196,216,0.15)] space-y-4">
        {/* Format selector */}
        <div>
          <div class="flex items-center gap-2 mb-2">
            <div class="w-1 h-4 bg-[#4f46e5] rounded-full" />
            <span class="text-xs font-medium text-[#191c1e]">导出格式</span>
          </div>
          <div class="flex gap-2">
            <For each={availableFormats()}>
              {(fmt) => (
                <button
                  type="button"
                  class={`px-4 py-2 text-sm font-medium rounded-xl border transition-all ${
                    format() === fmt
                      ? "bg-[#e2dfff] text-[#3525cd] border-[#4f46e5] ring-2 ring-[#4f46e5]"
                      : "bg-[#f7f9fb] text-[#464555] border-[rgba(199,196,216,0.3)] hover:bg-[#eeebff] hover:border-[#c3c0ff]"
                  }`}
                  onClick={() => handleFormatChange(fmt)}
                >
                  {FORMAT_LABELS[fmt]}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Filename input */}
        <div>
          <span class="block text-xs font-medium text-[#464555] mb-1">文件名称</span>
          <div class="flex items-center gap-2">
            <input
              type="text"
              class="flex-1 px-3 py-2 text-sm border border-[rgba(199,196,216,0.3)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c3c0ff] focus:border-[#4f46e5] bg-[#f7f9fb] text-[#191c1e] placeholder:text-[rgba(70,69,85,0.4)]"
              value={filename()}
              onInput={(e) => setFilename(e.currentTarget.value)}
              placeholder="请输入文件名..."
            />
            <span class="text-xs text-[#464555] opacity-60 whitespace-nowrap">
              {FORMAT_EXTENSIONS[format()]}
            </span>
          </div>
        </div>

        <Show when={format() === "pptx"}>
          <div>
            <div class="flex items-center justify-between gap-3 mb-2">
              <span class="block text-xs font-medium text-[#464555]">演示风格</span>
              <span class="text-[11px] text-[#6b7280]">
                选择一种风格后直接导出；无需再编辑模板。
              </span>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <For each={stylePackOptions()}>
                {(pack) => {
                  const selected = () => selectedStylePackId() === pack.id;
                  const tags = () => getStylePackPreviewTags(pack);
                  const background = () => buildStylePackCardBackground(pack);
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedStylePackId(normalizePptStylePackId(pack.id))}
                      class="group overflow-hidden rounded-2xl border text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-2"
                      classList={{
                        "border-[#4f46e5] bg-white shadow-[0_16px_36px_rgba(79,70,229,0.16)] -translate-y-0.5": selected(),
                        "border-[rgba(199,196,216,0.35)] bg-white hover:border-[#c3c0ff] hover:shadow-[0_14px_30px_rgba(25,28,30,0.08)]": !selected(),
                      }}
                    >
                      <div class="relative h-28 border-b border-white/10 px-4 py-3" style={{ background: background() }}>
                        <div class="flex items-start justify-between gap-3">
                          <div class="max-w-[75%]">
                            <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                              {pack.id === DEFAULT_PPT_STYLE_PACK_ID ? "Default" : "Style Pack"}
                            </div>
                            <div class="mt-2 text-base font-semibold text-white">{pack.label}</div>
                          </div>
                          <div class="flex items-center gap-1 rounded-full bg-white/16 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                            <Show when={pack.id === DEFAULT_PPT_STYLE_PACK_ID}>
                              <span>默认</span>
                            </Show>
                            <Show when={selected()}>
                              <span>{pack.id === DEFAULT_PPT_STYLE_PACK_ID ? "已选" : "选中"}</span>
                            </Show>
                          </div>
                        </div>
                        <div class="absolute inset-x-4 bottom-3 flex items-center gap-2">
                          <span class="h-3 w-3 rounded-full border border-white/40" style={{ background: withHash(pack.preview.primary) }} />
                          <span class="h-3 w-3 rounded-full border border-white/40" style={{ background: withHash(pack.preview.secondary) }} />
                          <span class="h-3 w-3 rounded-full border border-white/40" style={{ background: withHash(pack.preview.accent) }} />
                        </div>
                      </div>

                      <div class="space-y-3 px-4 py-3">
                        <div
                          class="rounded-xl border p-3"
                          style={{
                            background: withHash(pack.preview.background),
                            borderColor: `${withHash(pack.preview.surface)}80`,
                          }}
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div
                              class="text-xs font-semibold"
                              style={{ color: withHash(pack.preview.text), "text-align": pack.preview.titleAlign }}
                            >
                              季度业务回顾
                            </div>
                            <div
                              class="h-2.5 w-2.5 rounded-full"
                              style={{ background: withHash(pack.preview.accent) }}
                            />
                          </div>
                          <div class="mt-2 flex items-center gap-2">
                            <div class="h-2 flex-1 rounded-full" style={{ background: withHash(pack.preview.surface) }} />
                            <div class="h-2 w-14 rounded-full" style={{ background: withHash(pack.preview.secondary) }} />
                          </div>
                          <div class="mt-2 grid grid-cols-3 gap-2">
                            <div class="h-9 rounded-lg" style={{ background: withHash(pack.preview.surface) }} />
                            <div class="h-9 rounded-lg" style={{ background: `${withHash(pack.preview.secondary)}1A` }} />
                            <div class="h-9 rounded-lg" style={{ background: `${withHash(pack.preview.accent)}1A` }} />
                          </div>
                        </div>

                        <div class="flex flex-wrap gap-2">
                          <For each={tags()}>
                            {(tag) => (
                              <span class="rounded-full bg-[#f7f9fb] px-2.5 py-1 text-[11px] font-medium text-[#5b5a6b]">
                                {tag}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </button>
                  );
                }}
              </For>
            </div>
            <p class="mt-2 text-xs text-[#6b7280]">
              导出会把所选 style-pack 写入结果 metadata；切换风格后重新导出即可比较效果。
            </p>
          </div>
        </Show>
      </div>

      {/* Preview area */}
      <div class="px-6 py-4 border-b border-[rgba(199,196,216,0.15)]">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-1 h-4 bg-[#4f46e5] rounded-full" />
            <span class="text-xs font-medium text-[#464555]">文件预览</span>
          </div>
          <Show when={format() !== "markdown"}>
            <span class="text-xs text-[#464555] opacity-60">
              实际导出格式：{FORMAT_LABELS[format()]}
            </span>
          </Show>
        </div>

        <Show when={previewLoading()}>
          <div class="h-48 bg-[#f7f9fb] rounded-xl animate-pulse flex items-center justify-center">
            <span class="text-sm text-[#464555] opacity-60">正在生成预览...</span>
          </div>
        </Show>

        <Show when={!previewLoading() && previewContent()}>
          <div
            class="prose prose-sm max-w-none max-h-96 overflow-y-auto p-4 bg-[#f7f9fb] rounded-xl border border-[rgba(199,196,216,0.15)] text-sm leading-relaxed"
            innerHTML={sanitizeHtml(renderMarkdown(previewContent()))}
          />
        </Show>

        <Show when={!previewLoading() && !previewContent() && !error()}>
          <div class="h-48 flex items-center justify-center text-sm text-[#464555] opacity-60 bg-[#f7f9fb] rounded-xl">
            暂无可预览内容
          </div>
        </Show>
      </div>

      {/* Error display */}
      <Show when={error()}>
        <div class="px-6 py-3">
          <div class="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm">{error()}</div>
        </div>
      </Show>

      <Show when={format() === "pptx" && exporting()}>
        <div class="px-6 py-4 border-b border-[rgba(199,196,216,0.15)]">
          <div class="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-4">
            <p class="text-sm font-medium text-[#3525cd]">
              {PPT_EXPORT_STAGES[pptExportStageIndex()]}
            </p>
            <div class="mt-3 grid gap-2 md:grid-cols-3">
              <For each={PPT_EXPORT_STAGES}>
                {(stage, index) => (
                  <div
                    class={`rounded-lg border px-3 py-2 text-xs ${
                      index() <= pptExportStageIndex()
                        ? "border-indigo-200 bg-white text-[#3525cd]"
                        : "border-transparent bg-[rgba(79,70,229,0.06)] text-[#6b7280]"
                    }`}
                  >
                    {stage}
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      {/* Export result */}
      <Show when={latestExportResult()}>
        {(result) => (
          <Show when={!isPptExportResultStale()}>
            <div class="px-6 py-4 border-b border-[rgba(199,196,216,0.15)]">
              <div class="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-[rgba(199,196,216,0.15)]">
                <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600 text-lg font-bold">
                  {FORMAT_ICONS[result().format as ExportFormat] ?? "F"}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[#191c1e] truncate">{result().filename}</p>
                  <p class="text-xs text-green-600">
                    导出完成 &middot;{" "}
                    {FORMAT_LABELS[result().format as ExportFormat] ??
                      result().format.toUpperCase()}{" "}
                    &middot; {formatFileSize(result().fileSize)}
                  </p>
                  <Show when={result().renderMode}>
                    <p class="mt-1 text-[11px] text-slate-500">
                      渲染模式：{result().renderMode}
                    </p>
                  </Show>
                </div>
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium text-[#4f46e5] bg-[#e2dfff] rounded-xl hover:bg-[#d4d0ff] transition-colors"
                  onClick={triggerDownload}
                  disabled={downloading()}
                >
                  {downloading() ? "下载中..." : "下载文件"}
                </button>
              </div>
              <Show when={downloading() && downloadProgress()}>
                {(progress) => (
                  <div class="mt-3 rounded-xl border border-[rgba(79,70,229,0.12)] bg-indigo-50 px-4 py-3">
                    <div class="flex items-center justify-between gap-4 text-xs text-[#4f46e5]">
                      <span class="font-medium">
                        {progress().percent != null
                          ? `正在下载文件 ${progress().percent}%`
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
              <Show when={result().format === "pptx" && (result().warnings?.length || result().compositionSummary)}>
                <div class="mt-3 space-y-2 rounded-xl border border-[rgba(199,196,216,0.2)] bg-[#f7f9fb] px-4 py-3">
                  <Show when={result().compositionSummary}>
                    <div class="text-xs text-slate-600">
                      <span class="font-medium text-slate-700">编排摘要：</span>
                      来源 {(result().compositionSummary?.source as string) ?? "-"}
                      {" · "}
                      页数 {(result().compositionSummary?.totalSlides as number) ?? "-"}
                      <Show when={typeof result().compositionSummary?.matchedSlides === "number"}>
                        {` · 模板命中 ${result().compositionSummary?.matchedSlides as number}`}
                      </Show>
                    </div>
                  </Show>
                  <Show when={result().warnings && result().warnings!.length > 0}>
                    <div class="space-y-1">
                      <For each={result().warnings}>
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
          </Show>
        )}
      </Show>

      <Show when={isPptExportResultStale()}>
        <div class="px-6 py-4 border-b border-[rgba(199,196,216,0.15)]">
          <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            当前已切换演示风格，请重新点击「导出并下载」生成新文件。下面不会再显示旧风格导出的结果。
          </div>
        </div>
      </Show>

      {/* Action buttons */}
      <div class="px-6 py-4 flex justify-end gap-3">
        <button
          type="button"
          class="px-5 py-2.5 text-sm font-semibold text-[#3525cd] bg-white border border-[#c3c0ff] rounded-xl hover:bg-[#f8f7ff] transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          disabled={completing() || !latestExportResult()}
          onClick={handleComplete}
        >
          {completing() ? "完成中..." : "完成导出"}
        </button>
        <button
          type="button"
          class="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#3525cd] to-[#4f46e5] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          disabled={exporting() || downloading() || previewLoading() || !filename()}
          onClick={handleExport}
        >
          <Show when={!exporting() && !downloading()}>
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </Show>
          {exporting() ? "正在生成..." : downloading() ? "正在下载..." : "导出并下载"}
        </button>
      </div>
    </div>
  );
}
