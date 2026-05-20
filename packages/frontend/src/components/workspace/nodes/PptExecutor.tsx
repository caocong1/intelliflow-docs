import type { NodeExecution, PptConfig } from "@intelliflow/shared";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onMount,
} from "solid-js";
import { advanceNode, generatePpt, getPptPreview } from "../../../api/client";
import { type StylePackItem, listStylePacks } from "../../../lib/api/style-packs";
import { type DownloadProgress, downloadBlobResponse } from "../../../lib/download";
import { DEFAULT_PPT_STYLE_PACK_ID, normalizePptStylePackId } from "../../../lib/ppt-export";

interface Props {
  nodeExecution: NodeExecution;
  config: PptConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  onCompleted?: () => Promise<void> | void;
  readOnly: boolean;
  stepDescription?: string;
}

async function fetchStylePacks(): Promise<StylePackItem[]> {
  return listStylePacks();
}

function withHash(color: string): string {
  return color.startsWith("#") ? color : `#${color}`;
}

function buildStylePackCardBackground(pack: StylePackItem): string {
  const { coverFill, primary, secondary, background, accent } = pack.preview;
  if (coverFill === "gradient") {
    return `linear-gradient(135deg, ${withHash(primary)} 0%, ${withHash(secondary)} 100%)`;
  }
  if (coverFill === "accent_bar") {
    return `linear-gradient(180deg, ${withHash(background)} 0%, ${withHash(background)} 76%, ${withHash(accent)} 76%, ${withHash(accent)} 100%)`;
  }
  return withHash(primary);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PptExecutor(props: Props) {
  const [filename, setFilename] = createSignal("");
  const [previewContent, setPreviewContent] = createSignal("");
  const [previewLoading, setPreviewLoading] = createSignal(true);
  const [generating, setGenerating] = createSignal(false);
  const [downloading, setDownloading] = createSignal(false);
  const [completing, setCompleting] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal<DownloadProgress | null>(null);
  const [selectedStyleId, setSelectedStyleId] = createSignal<string>(
    normalizePptStylePackId(props.config.defaultStyleId),
  );
  const [recommendedStyleId, setRecommendedStyleId] = createSignal(DEFAULT_PPT_STYLE_PACK_ID);
  const [result, setResult] = createSignal<{
    filename: string;
    format: "pptx";
    fileSize: number;
    renderMode: "visual_premium_v1";
    styleId: string;
    warnings: string[];
    compositionSummary?: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [stylePacks] = createResource(fetchStylePacks);

  const styleSelectionMode = () => props.config.styleSelectionMode ?? "runtime_select";
  const canSelectStyle = () => styleSelectionMode() === "runtime_select";

  const stylePackOptions = createMemo<StylePackItem[]>(() => {
    const packs = stylePacks() ?? [];
    if (packs.some((pack) => pack.id === DEFAULT_PPT_STYLE_PACK_ID)) return packs;
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

  const latestResult = createMemo(() => {
    const local = result();
    if (local) return local;
    const output = props.nodeExecution.outputData as Record<string, unknown> | null;
    if (
      output?.format === "pptx" &&
      typeof output.filename === "string" &&
      typeof output.fileSize === "number" &&
      typeof output.renderMode === "string" &&
      typeof output.styleId === "string"
    ) {
      return {
        filename: output.filename,
        format: "pptx" as const,
        fileSize: output.fileSize,
        renderMode: "visual_premium_v1" as const,
        styleId: output.styleId,
        warnings: Array.isArray(output.warnings)
          ? output.warnings.filter((item): item is string => typeof item === "string")
          : [],
        compositionSummary:
          output.compositionSummary && typeof output.compositionSummary === "object"
            ? (output.compositionSummary as Record<string, unknown>)
            : undefined,
      };
    }
    return null;
  });

  createEffect(() => {
    if (styleSelectionMode() === "fixed") {
      setSelectedStyleId(normalizePptStylePackId(props.config.defaultStyleId));
    }
  });

  onMount(async () => {
    try {
      const preview = await getPptPreview(props.documentId, props.nodeExecution.id);
      if (preview && !("error" in preview)) {
        setPreviewContent(preview.content);
        setFilename(preview.defaultFilename);
        setRecommendedStyleId(preview.recommendedStyleId);
        setSelectedStyleId(preview.recommendedStyleId);
      } else {
        setError("PPT 预览加载失败");
      }
    } catch {
      setError("PPT 预览加载失败");
    } finally {
      setPreviewLoading(false);
    }
  });

  async function triggerDownload(downloadName?: string) {
    if (downloading()) return;
    const token = localStorage.getItem("auth_token");
    setDownloading(true);
    setDownloadProgress(null);
    try {
      const res = await fetch(
        `/api/runtime/${props.documentId}/ppt/${props.nodeExecution.id}/download`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) {
        setError("下载失败，请重试");
        return;
      }
      await downloadBlobResponse(res, downloadName ?? filename() ?? "presentation.pptx", {
        onProgress: (progress) => setDownloadProgress(progress),
      });
    } catch {
      setError("下载失败，请重试");
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  }

  async function handleGenerate() {
    if (generating() || downloading()) return;
    setGenerating(true);
    setError(null);

    try {
      const generated = await generatePpt(
        props.documentId,
        props.nodeExecution.id,
        filename(),
        selectedStyleId(),
      );
      if (generated && !("error" in generated)) {
        setResult({
          filename: generated.filename,
          format: generated.format,
          fileSize: generated.fileSize,
          renderMode: generated.renderMode,
          styleId: generated.styleId,
          warnings: generated.warnings ?? [],
          compositionSummary: generated.compositionSummary,
        });
        props.onDraftSave({
          format: generated.format,
          filename: generated.filename,
          storagePath: generated.storagePath,
          fileSize: generated.fileSize,
          renderMode: generated.renderMode,
          styleId: generated.styleId,
          warnings: generated.warnings ?? [],
          compositionSummary: generated.compositionSummary,
        });
        await triggerDownload(generated.filename);
      } else {
        setError("PPT 生成失败，请重试");
      }
    } catch {
      setError("PPT 生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  }

  async function handleComplete() {
    if (completing()) return;
    setCompleting(true);
    setError(null);
    try {
      const advanced = await advanceNode(props.documentId, props.nodeExecution.id);
      if (advanced && !("error" in advanced)) {
        await props.onCompleted?.();
      } else {
        setError("完成 PPT 节点失败，请重试");
      }
    } catch {
      setError("完成 PPT 节点失败，请重试");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      <div class="px-6 py-5 border-b border-[rgba(199,196,216,0.18)] bg-gradient-to-r from-sky-50 to-indigo-50">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-[#1b1b24]">PPT 生成</h3>
            <Show when={props.stepDescription}>
              <p class="mt-1 text-sm text-[#686477]">{props.stepDescription}</p>
            </Show>
          </div>
          <span class="px-2.5 py-1 rounded-full bg-white/80 border border-sky-200 text-xs font-semibold text-sky-700">
            visual_premium_v1
          </span>
        </div>
      </div>

      <Show when={error()}>
        <div class="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error()}
        </div>
      </Show>

      <div class="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5 px-6 py-5">
        <section class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
            <h4 class="text-sm font-semibold text-slate-800">输入内容预览</h4>
            <span class="text-xs text-slate-400">{previewContent().length} 字符</span>
          </div>
          <div class="p-4 h-[360px] overflow-y-auto text-sm leading-6 text-slate-700 whitespace-pre-wrap">
            <Show
              when={!previewLoading()}
              fallback={<span class="text-slate-400">正在加载...</span>}
            >
              {previewContent() || "暂无可用于生成 PPT 的内容"}
            </Show>
          </div>
        </section>

        <section class="space-y-4">
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <label class="block text-sm font-semibold text-slate-800 mb-2" for="ppt-filename">
              文件名
            </label>
            <input
              id="ppt-filename"
              type="text"
              value={filename()}
              onInput={(e) => setFilename(e.currentTarget.value)}
              disabled={props.readOnly || generating()}
              class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-slate-50"
            />
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <h4 class="text-sm font-semibold text-slate-800">演示风格</h4>
                <p class="text-xs text-slate-500 mt-0.5">
                  推荐：{recommendedStyleId()} · 策略：{styleSelectionMode()}
                </p>
              </div>
              <Show when={!canSelectStyle()}>
                <span class="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
                  已锁定
                </span>
              </Show>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <For each={stylePackOptions()}>
                {(pack) => {
                  const selected = () => normalizePptStylePackId(selectedStyleId()) === pack.id;
                  return (
                    <button
                      type="button"
                      disabled={!canSelectStyle() || generating()}
                      onClick={() => setSelectedStyleId(pack.id)}
                      class={`text-left rounded-lg border p-2 transition-all ${
                        selected()
                          ? "border-sky-500 ring-2 ring-sky-100"
                          : "border-slate-200 hover:border-slate-300"
                      } disabled:opacity-70 disabled:cursor-not-allowed`}
                    >
                      <div
                        class="h-12 rounded-md mb-2 border border-black/5"
                        style={{ background: buildStylePackCardBackground(pack) }}
                      />
                      <div class="text-xs font-semibold text-slate-800 truncate">{pack.label}</div>
                      <div class="text-[11px] text-slate-400 font-mono truncate">{pack.id}</div>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          <Show when={latestResult()}>
            {(item) => (
              <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h4 class="text-sm font-semibold text-emerald-900">{item().filename}</h4>
                    <p class="text-xs text-emerald-700 mt-1">
                      {formatFileSize(item().fileSize)} · {item().renderMode} · {item().styleId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerDownload(item().filename)}
                    disabled={downloading()}
                    class="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                  >
                    {downloading() ? "下载中..." : "下载"}
                  </button>
                </div>
                <Show when={item().warnings.length > 0}>
                  <div class="mt-3 rounded-lg bg-white/70 border border-emerald-100 p-3">
                    <div class="text-xs font-semibold text-emerald-900 mb-1">质检信息</div>
                    <ul class="space-y-1">
                      <For each={item().warnings}>
                        {(warning) => (
                          <li class="text-xs text-emerald-800 leading-5">• {warning}</li>
                        )}
                      </For>
                    </ul>
                  </div>
                </Show>
                <Show when={item().compositionSummary}>
                  <div class="mt-3 text-xs text-emerald-800">
                    编排摘要：
                    {JSON.stringify(item().compositionSummary)}
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </section>
      </div>

      <Show when={downloadProgress()}>
        {(progress) => (
          <div class="px-6 pb-3 text-xs text-slate-500">
            正在下载 {formatFileSize(progress().receivedBytes)}
            {progress().totalBytes ? ` / ${formatFileSize(progress().totalBytes ?? 0)}` : ""}
          </div>
        )}
      </Show>

      <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
        <button
          type="button"
          class="px-5 py-2.5 text-sm font-semibold text-sky-700 bg-white border border-sky-200 rounded-xl hover:bg-sky-50 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={completing() || !latestResult()}
          onClick={handleComplete}
        >
          {completing() ? "完成中..." : "完成 PPT 节点"}
        </button>
        <button
          type="button"
          class="px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={
            props.readOnly || generating() || downloading() || previewLoading() || !filename()
          }
          onClick={handleGenerate}
        >
          {generating() ? "正在生成..." : downloading() ? "正在下载..." : "生成并下载 PPT"}
        </button>
      </div>
    </div>
  );
}
