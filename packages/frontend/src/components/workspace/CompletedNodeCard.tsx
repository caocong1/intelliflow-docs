import type { ModelOutput, NodeConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";
import {
  formatDuration,
  formatFileSize,
  formatShortTime,
  getFileExtColor,
} from "../../lib/format-utils";
import { renderMarkdown } from "../../lib/render-markdown";
import { downloadBlobResponse } from "../../lib/download";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onReexecute: () => void;
  onFullscreen?: (content: string, title: string) => void;
  documentId: string;
}

/** Node type visual config */
const NODE_STYLES: Record<
  string,
  {
    borderColor: string;
    iconBg: string;
    iconColor: string;
    icon: string;
    typeLabel: string;
    typeBg: string;
    typeText: string;
  }
> = {
  input_transform: {
    borderColor: "border-l-[#4f46e5]",
    iconBg: "bg-[rgba(79,70,229,0.05)]",
    iconColor: "text-[#4f46e5]",
    icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M12 18v-6 M9 15h6",
    typeLabel: "输入转换",
    typeBg: "bg-[#e2dfff]",
    typeText: "text-[#3525cd]",
  },
  desensitize: {
    borderColor: "border-l-amber-500",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    typeLabel: "信息脱敏",
    typeBg: "bg-amber-50",
    typeText: "text-amber-700",
  },
  model_call: {
    borderColor: "border-l-indigo-500",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-500",
    icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
    typeLabel: "模型调用",
    typeBg: "bg-[#e3dfff]",
    typeText: "text-[#514f81]",
  },
  restore: {
    borderColor: "border-l-emerald-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    typeLabel: "信息恢复",
    typeBg: "bg-emerald-50",
    typeText: "text-emerald-700",
  },
  export: {
    borderColor: "border-l-teal-500",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
    icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
    typeLabel: "文件导出",
    typeBg: "bg-emerald-50",
    typeText: "text-emerald-700",
  },
};

const DEFAULT_STYLE = NODE_STYLES.input_transform;

function getSkipBadge(node: NodeExecution): {
  label: string;
  bg: string;
  text: string;
  border: string;
} | null {
  if (node.status !== "skipped") return null;

  const skipType = (node.outputData as Record<string, unknown> | null)?.skipType;
  if (skipType === "conditional") {
    return {
      label: "条件跳过",
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    };
  }
  if (skipType === "automatic") {
    return {
      label: "自动跳过",
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    };
  }
  return {
    label: "用户跳过",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  };
}

function getSkipBindingSummary(node: NodeExecution): string | null {
  const skipBindings =
    ((node.outputData as Record<string, unknown> | null)?.skipBindings as
      | Record<string, { mode?: string }>
      | undefined) ?? {};

  const bindings = Object.values(skipBindings);
  if (bindings.length === 0) return null;

  const inheritCount = bindings.filter((binding) => binding?.mode === "inherit").length;
  const emptyCount = bindings.filter((binding) => binding?.mode === "empty").length;
  const parts: string[] = [];
  if (inheritCount > 0) parts.push(`继承 ${inheritCount} 项`);
  if (emptyCount > 0) parts.push(`置空 ${emptyCount} 项`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function getSkipSummary(node: NodeExecution): string {
  const data = node.outputData as Record<string, unknown> | null;
  const skipReason = data?.skipReason;
  if (typeof skipReason === "string" && skipReason.trim()) return skipReason;

  const bindingSummary = getSkipBindingSummary(node);
  if (bindingSummary) return `按预设跳过 · ${bindingSummary}`;

  return "按预设跳过";
}

/** Extract summary preview text for collapsed state */
function getSummaryPreview(node: NodeExecution): string {
  const data = node.outputData as Record<string, unknown> | null;
  if (!data) return "";
  if (node.status === "skipped") return getSkipSummary(node);

  switch (node.nodeType) {
    case "input_transform": {
      const fields = data.fields as Record<string, string> | undefined;
      const files = data.files as Array<unknown> | undefined;
      const fieldCount = fields ? Object.keys(fields).length : 0;
      const fileCount = files?.length ?? 0;
      const parts: string[] = [];
      if (fieldCount > 0) parts.push(`${fieldCount} 个字段`);
      if (fileCount > 0) parts.push(`${fileCount} 个文件`);
      return parts.join(" · ") || "无输入数据";
    }
    case "model_call": {
      const content = (data.selectedContent as string) ?? (data.text as string) ?? "";
      if (!content) return "无生成内容";
      const firstLines = content
        .replace(/^#+\s+/gm, "")
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 2)
        .join(" ");
      return firstLines.length > 100 ? `${firstLines.slice(0, 100)}...` : firstLines;
    }
    case "desensitize": {
      const count = data.mappingCount as number | undefined;
      return count != null ? `已脱敏 ${count} 项` : "脱敏完成";
    }
    case "restore": {
      const restorations = data.restorations as Array<unknown> | undefined;
      return restorations ? `已恢复 ${restorations.length} 处` : "恢复完成";
    }
    case "export": {
      const filename = data.filename as string | undefined;
      const format = data.format as string | undefined;
      const fileSize = data.fileSize as number | undefined;
      const parts = [
        filename,
        format?.toUpperCase(),
        fileSize != null ? formatFileSize(fileSize) : null,
      ].filter(Boolean);
      return parts.join(" · ") || "导出完成";
    }
    default:
      return "";
  }
}

/** Get model display info for model_call nodes */
function getModelInfo(node: NodeExecution): { name: string; charCount: number } | null {
  const data = node.outputData as Record<string, unknown> | null;
  if (!data || node.nodeType !== "model_call") return null;
  const models = data.models as Record<string, ModelOutput> | undefined;
  if (!models) return null;
  const selectedKey = node.selectedOutputKey;
  const selectedModel = selectedKey ? models[selectedKey] : Object.values(models)[0];
  if (!selectedModel) return null;
  return {
    name: selectedModel.modelDisplayName ?? "Unknown",
    charCount: (selectedModel.content ?? "").length,
  };
}

export default function CompletedNodeCard(props: Props) {
  const [copied, setCopied] = createSignal(false);
  const [showParsedFile, setShowParsedFile] = createSignal<string | null>(null);
  const [showRawData, setShowRawData] = createSignal(false);

  const style = () => NODE_STYLES[props.node.nodeType] ?? DEFAULT_STYLE;
  const duration = () => formatDuration(props.node.startedAt, props.node.completedAt);
  const modelInfo = () => getModelInfo(props.node);
  const skipBadge = () => getSkipBadge(props.node);
  const skipBindingSummary = () => getSkipBindingSummary(props.node);
  const isSkipped = () => props.node.status === "skipped";

  function handleCopyContent() {
    const data = props.node.outputData as Record<string, unknown> | null;
    const text = (data?.selectedContent as string) ?? (data?.text as string) ?? "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleFullscreen() {
    const data = props.node.outputData as Record<string, unknown> | null;
    const content = (data?.selectedContent as string) ?? (data?.text as string) ?? "";
    props.onFullscreen?.(content, props.node.nodeLabel);
  }

  return (
    <div
      class={`bg-white rounded-xl overflow-hidden transition-all border-l-4 ${style().borderColor}`}
      style={{
        background: isSkipped() ? "#fffdf7" : "#ffffff",
        "box-shadow": isSkipped()
          ? "0 12px 40px rgba(245,158,11,0.08)"
          : "0 12px 40px rgba(25,28,30,0.06)",
      }}
    >
      {/* Collapsed header */}
      <button
        type="button"
        class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#f7f9fb] transition-colors cursor-pointer group"
        onClick={props.onToggle}
      >
        <div class="flex items-center gap-4 min-w-0 flex-1">
          {/* Icon */}
          <div
            class={`w-12 h-12 rounded-full ${style().iconBg} ${style().iconColor} flex items-center justify-center flex-shrink-0`}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d={style().icon} />
            </svg>
          </div>

          {/* Info */}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2.5 mb-1 flex-wrap">
              <h4 class="font-bold text-[#191c1e] text-sm">{props.node.nodeLabel}</h4>
              <span
                class={`${style().typeBg} ${style().typeText} text-[10px] px-2 py-0.5 rounded font-bold`}
              >
                {style().typeLabel}
              </span>
              <Show when={modelInfo()}>
                {(info) => (
                  <span class="bg-[#191c1e] text-white text-[9px] px-1.5 py-0.5 rounded font-bold tracking-tight">
                    {info().name}
                  </span>
                )}
              </Show>
            </div>
            <div class="flex items-center gap-3 text-xs text-[#464555]">
              <span class="flex items-center gap-1">
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
                {duration()}
              </span>
              <span class="text-[#c7c4d8]">|</span>
              <span
                class={`truncate ${isSkipped() ? "not-italic text-amber-700 font-medium" : "italic"}`}
              >
                {getSummaryPreview(props.node)}
              </span>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div class="flex items-center gap-3 flex-shrink-0 ml-4">
          <Show when={skipBadge()}>
            {(badge) => (
              <span
                class={`${badge().bg} ${badge().text} ${badge().border} hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border`}
              >
                {badge().label}
              </span>
            )}
          </Show>

          {/* Hover actions for model_call */}
          <Show when={props.node.nodeType === "model_call"}>
            <div class="hidden group-hover:flex items-center gap-1">
              <button
                type="button"
                class="p-2 hover:bg-[#e6e8ea] rounded-full transition-colors text-[#4f46e5]"
                title="全屏查看"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFullscreen();
                }}
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
              </button>
              <button
                type="button"
                class="p-2 hover:bg-[#e6e8ea] rounded-full transition-colors text-[#4f46e5]"
                title="重新执行"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onReexecute();
                }}
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          </Show>

          {/* Time range */}
          <span class="text-[11px] font-mono text-[#464555] opacity-60 hidden sm:inline">
            {formatShortTime(props.node.startedAt)} → {formatShortTime(props.node.completedAt)}
          </span>

          {/* Expand arrow */}
          <svg
            class={`w-5 h-5 text-[#464555] group-hover:text-[#4f46e5] transition-all duration-200 ${props.isExpanded ? "rotate-180" : ""}`}
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
        </div>
      </button>

      {/* Expanded content */}
      <Show when={props.isExpanded}>
        <div class="px-5 pb-5 space-y-4">
          <div class="h-px bg-[rgba(199,196,216,0.15)]" />

          <Show when={skipBadge()}>
            {(badge) => (
              <section class={`${badge().bg} ${badge().border} rounded-xl border px-4 py-3`}>
                <div class="flex items-start gap-3">
                  <div
                    class={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${badge().bg} ${badge().text}`}
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12h6m-6 0l2.5-2.5M9 12l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class={`text-sm font-semibold ${badge().text}`}>{badge().label}</p>
                      <Show when={skipBindingSummary()}>
                        <span class="text-xs text-[#7c6a2a]">{skipBindingSummary()}</span>
                      </Show>
                    </div>
                    <p class="mt-1 text-sm text-[#7c6a2a] leading-6">
                      {getSkipSummary(props.node)}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </Show>

          {/* Type-specific expanded content */}
          {renderExpandedContent(
            props,
            copied,
            setCopied,
            handleCopyContent,
            handleFullscreen,
            showParsedFile,
            setShowParsedFile,
          )}

          {/* Raw data toggle (all types) */}
          <div>
            <button
              type="button"
              class="text-xs text-[#777587] hover:text-[#464555] transition-colors"
              onClick={() => setShowRawData(!showRawData())}
            >
              {showRawData() ? "隐藏原始数据" : "查看原始数据"}
            </button>
            <Show when={showRawData()}>
              <pre class="mt-2 text-xs bg-[#f7f9fb] rounded-xl p-3 overflow-x-auto max-h-48 text-[#464555] border border-[rgba(199,196,216,0.15)]">
                {JSON.stringify(props.node.outputData, null, 2)}
              </pre>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

/** Render expanded content based on node type */
function renderExpandedContent(
  props: Props,
  copied: () => boolean,
  _setCopied: (v: boolean) => void,
  handleCopyContent: () => void,
  handleFullscreen: () => void,
  showParsedFile: () => string | null,
  setShowParsedFile: (v: string | null) => void,
) {
  const data = props.node.outputData as Record<string, unknown> | null;
  if (!data) return <div class="text-sm text-[#464555] italic">无输出数据</div>;

  switch (props.node.nodeType) {
    case "input_transform":
      return renderInputTransform(data, showParsedFile, setShowParsedFile);
    case "model_call":
      return renderModelCall(data, props.node, copied, handleCopyContent, handleFullscreen);
    case "desensitize":
      return renderDesensitize(data);
    case "restore":
      return renderRestore(data);
    case "export":
      return renderExport(data, props.documentId, props.node.id);
    default:
      return null;
  }
}

function renderInputTransform(
  data: Record<string, unknown>,
  showParsedFile: () => string | null,
  setShowParsedFile: (v: string | null) => void,
) {
  const fields = data.fields as Record<string, string> | undefined;
  const files = data.files as
    | Array<{ fileId: string; name: string; parsedText: string }>
    | undefined;

  return (
    <div class="space-y-4">
      {/* Form fields */}
      <Show when={fields && Object.keys(fields).length > 0}>
        <div class="space-y-2">
          <h5 class="text-xs font-bold text-[#464555] uppercase tracking-wide">表单数据</h5>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <For each={Object.entries(fields ?? {})}>
              {([key, value]) => (
                <div class="bg-[#f7f9fb] rounded-lg px-4 py-2.5">
                  <span class="text-[10px] font-medium text-[#777587] uppercase">{key}</span>
                  <p class="text-sm text-[#191c1e] mt-0.5">
                    {value || <span class="italic text-[#9fa0a8]">空</span>}
                  </p>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Files */}
      <Show when={files && files.length > 0}>
        <div class="space-y-2">
          <h5 class="text-xs font-bold text-[#464555] uppercase tracking-wide">上传文件</h5>
          <For each={files ?? []}>
            {(file) => {
              const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
              const extLabel = ext.toUpperCase().slice(0, 4) || "?";
              return (
                <div class="bg-[#f7f9fb] rounded-xl px-4 py-3 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${getFileExtColor(ext)}`}
                      >
                        {extLabel}
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-[#191c1e] truncate">{file.name}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="text-xs text-[#4f46e5] hover:text-[#3525cd] font-medium transition-colors"
                      onClick={() =>
                        setShowParsedFile(showParsedFile() === file.fileId ? null : file.fileId)
                      }
                    >
                      {showParsedFile() === file.fileId ? "收起" : "查看解析内容"}
                    </button>
                  </div>
                  <Show when={showParsedFile() === file.fileId}>
                    <pre class="text-xs bg-white rounded-lg p-3 overflow-x-auto max-h-48 text-[#464555] border border-[rgba(199,196,216,0.15)] whitespace-pre-wrap">
                      {file.parsedText || "(无解析内容)"}
                    </pre>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

function renderModelCall(
  data: Record<string, unknown>,
  node: NodeExecution,
  copied: () => boolean,
  handleCopyContent: () => void,
  handleFullscreen: () => void,
) {
  const models = data.models as Record<string, ModelOutput> | undefined;
  const selectedContent = (data.selectedContent as string) ?? (data.text as string) ?? "";
  const selectedKey = node.selectedOutputKey;
  const selectedModel =
    selectedKey && models ? models[selectedKey] : models ? Object.values(models)[0] : null;
  const modelEntries = models ? Object.values(models) : [];
  const isMultiModel = modelEntries.length > 1;

  const [activeModelTab, setActiveModelTab] = createSignal(
    selectedKey ?? modelEntries[0]?.modelId ?? "",
  );

  const activeModel = () => {
    if (!models) return null;
    return models[activeModelTab()] ?? null;
  };

  return (
    <div class="space-y-4">
      {/* Model info + actions bar */}
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <Show when={selectedModel}>
            <span class="text-sm font-medium text-[#191c1e]">
              {selectedModel?.modelDisplayName}
            </span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
              已选择
            </span>
          </Show>
          <span class="text-xs text-[#777587]">{selectedContent.length.toLocaleString()} 字</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#464555] bg-[#f2f4f6] rounded-lg hover:bg-[#e6e8ea] transition-colors"
            onClick={handleCopyContent}
          >
            {copied() ? "已复制" : "复制内容"}
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#4f46e5] bg-[#e2dfff] rounded-lg hover:bg-[#d4d0ff] transition-colors"
            onClick={handleFullscreen}
          >
            全屏查看
          </button>
        </div>
      </div>

      {/* Multi-model tabs */}
      <Show when={isMultiModel}>
        <div class="flex items-center gap-1 border-b border-[rgba(199,196,216,0.2)]">
          <For each={modelEntries}>
            {(model) => (
              <button
                type="button"
                class={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                  activeModelTab() === model.modelId
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-[#464555] hover:text-[#191c1e]"
                }`}
                onClick={() => setActiveModelTab(model.modelId)}
              >
                {model.modelDisplayName}
                <Show when={model.modelId === selectedKey}>
                  <span class="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                    选中
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Content */}
      <div class="bg-[#f7f9fb] rounded-xl p-5 max-h-[500px] overflow-y-auto">
        <Show when={isMultiModel} fallback={renderMarkdown(selectedContent)}>
          {renderMarkdown(activeModel()?.content ?? "")}
        </Show>
      </div>
    </div>
  );
}

function renderDesensitize(data: Record<string, unknown>) {
  const text = data.text as string | undefined;
  const mappingCount = data.mappingCount as number | undefined;

  return (
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
          已脱敏 {mappingCount ?? 0} 项
        </span>
      </div>
      <Show when={text}>
        <div class="bg-[#f7f9fb] rounded-xl p-4 max-h-64 overflow-y-auto">
          <pre class="text-sm text-[#191c1e] whitespace-pre-wrap">{text}</pre>
        </div>
      </Show>
    </div>
  );
}

function renderRestore(data: Record<string, unknown>) {
  const restoredText = data.restoredText as string | undefined;
  const restorations = data.restorations as
    | Array<{ placeholder: string; original: string; success: boolean }>
    | undefined;
  const successCount = restorations?.filter((r) => r.success).length ?? 0;
  const failCount = restorations?.filter((r) => !r.success).length ?? 0;

  return (
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
          成功 {successCount} 处
        </span>
        <Show when={failCount > 0}>
          <span class="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
            失败 {failCount} 处
          </span>
        </Show>
      </div>
      <Show when={restoredText}>
        <div class="bg-[#f7f9fb] rounded-xl p-4 max-h-64 overflow-y-auto">
          <pre class="text-sm text-[#191c1e] whitespace-pre-wrap">{restoredText}</pre>
        </div>
      </Show>
    </div>
  );
}

function renderExport(data: Record<string, unknown>, documentId: string, nodeId: string) {
  const filename = data.filename as string | undefined;
  const format = data.format as string | undefined;
  const fileSize = data.fileSize as number | undefined;

  const FORMAT_ICONS: Record<string, string> = { word: "W", pdf: "P", markdown: "M" };
  const FORMAT_LABELS: Record<string, string> = {
    word: "Word 文档",
    pdf: "PDF 文件",
    markdown: "Markdown 文件",
  };

  async function triggerDownload() {
    const url = `/api/runtime/${documentId}/export/${nodeId}/download`;
    const token = localStorage.getItem("auth_token");
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    await downloadBlobResponse(res, filename || "export");
  }

  return (
    <div class="flex items-center gap-4 p-4 bg-[#f7f9fb] rounded-xl">
      <div
        class="w-10 h-10 rounded-lg bg-[#4f46e5] flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
        style={{ "box-shadow": "0 4px 12px rgba(79,70,229,0.2)" }}
      >
        {FORMAT_ICONS[format ?? "markdown"] ?? "F"}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-[#191c1e] truncate">{filename ?? "未知文件"}</p>
        <p class="text-xs text-[#464555]">
          {FORMAT_LABELS[format ?? ""] ?? format?.toUpperCase() ?? "文件"} ·{" "}
          {fileSize != null ? formatFileSize(fileSize) : ""}
        </p>
      </div>
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium text-[#4f46e5] bg-[#e2dfff] rounded-xl hover:bg-[#d4d0ff] transition-colors flex-shrink-0"
        onClick={triggerDownload}
      >
        下载
      </button>
    </div>
  );
}
