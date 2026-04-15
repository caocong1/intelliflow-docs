import type {
  ModelCallConfig,
  NamedOutputDef,
  NodeConfig,
  NodeExecution,
} from "@intelliflow/shared";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { formatDuration, formatShortTime } from "../../../lib/format-utils";
import { renderMarkdown } from "../../../lib/render-markdown";
import NamedOutputsBrowser, {
  type NamedOutputBrowserSelection,
  type NamedOutputBrowserSource,
} from "../shared/NamedOutputsBrowser";

interface ModelOutput {
  content: string;
  modelId: string;
  modelDisplayName: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  tokenUsage?: { input: number; output: number };
}

type ContentScope = "artifacts" | "responses";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onReexecute?: () => void;
  onFullscreen?: (content: string, title: string) => void;
}

export default function ModelCallCompleted(props: Props) {
  const cfg = () => props.config as ModelCallConfig | undefined;

  const od = () =>
    props.node.outputData as {
      models?: Record<string, ModelOutput>;
      selectedContent?: string;
      selectedModelId?: string;
      selectedModelIds?: string[];
      namedOutputs?: Record<
        string,
        { content: string; format: string; modelId?: string; modelIds?: string[] }
      >;
      namedOutputsByModel?: Record<
        string,
        Record<string, { content: string; format: string; modelId?: string }>
      >;
      fallbackWarning?: boolean;
    } | null;

  const modelEntries = () => {
    const models = od()?.models;
    if (!models) return [];
    return Object.entries(models).map(([key, val]) => ({ key, ...val }));
  };

  const initialModelId = () => {
    const entries = modelEntries();
    const selectedKey = props.node.selectedOutputKey;
    if (selectedKey && od()?.models?.[selectedKey]) return selectedKey;
    return entries[0]?.key ?? "";
  };

  const hasNamedOutputs = () => {
    return (
      Object.keys(od()?.namedOutputs ?? {}).length > 0 ||
      Object.keys(od()?.namedOutputsByModel ?? {}).length > 0
    );
  };

  const namedOutputDefs = (): NamedOutputDef[] => cfg()?.namedOutputs ?? [];
  const fallbackWarning = () => od()?.fallbackWarning ?? false;
  const singleSelectedModelId = createMemo(() => {
    if (!(cfg()?.enableUserSelectionOutput ?? false)) return null;

    const ids = (od()?.selectedModelIds ?? []).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    if (ids.length === 1) return ids[0];
    if (ids.length === 0 && props.node.selectedOutputKey) return props.node.selectedOutputKey;
    return null;
  });
  const mergeSelectedSourceIntoModel = createMemo(() => {
    const modelId = singleSelectedModelId();
    if (!modelId) return false;

    const selectedArtifacts = Object.entries(od()?.namedOutputs ?? {}).filter(
      ([artifactId]) => artifactId !== "_default",
    );
    if (selectedArtifacts.length === 0) return false;

    const modelArtifacts = Object.entries(od()?.namedOutputsByModel?.[modelId] ?? {}).filter(
      ([artifactId]) => artifactId !== "_default",
    );
    if (modelArtifacts.length === 0) return false;

    const modelArtifactIds = new Set(modelArtifacts.map(([artifactId]) => artifactId));
    return selectedArtifacts.every(([artifactId]) => modelArtifactIds.has(artifactId));
  });
  const initialArtifactSourceId = createMemo(() => {
    if (mergeSelectedSourceIntoModel() && singleSelectedModelId()) {
      return `model:${singleSelectedModelId()}`;
    }

    const selectedArtifacts = Object.entries(od()?.namedOutputs ?? {}).filter(
      ([artifactId]) => artifactId !== "_default",
    );
    if ((cfg()?.enableUserSelectionOutput ?? false) && selectedArtifacts.length > 0) {
      return "selected";
    }

    const selectedKey = props.node.selectedOutputKey;
    if (selectedKey) {
      return `model:${selectedKey}`;
    }

    return undefined;
  });

  const [viewMode, setViewMode] = createSignal<"markdown" | "source">("markdown");
  const [selectedModelId, setSelectedModelId] = createSignal(initialModelId());
  const [contentScope, setContentScope] = createSignal<ContentScope>(
    hasNamedOutputs() ? "artifacts" : "responses",
  );
  const [activeArtifactSelection, setActiveArtifactSelection] =
    createSignal<NamedOutputBrowserSelection | null>(null);

  createEffect(() => {
    const nodeId = props.node.id;
    void nodeId;
    setSelectedModelId(initialModelId());
    setContentScope(hasNamedOutputs() ? "artifacts" : "responses");
    setActiveArtifactSelection(null);
  });

  const activeModel = () => {
    const models = od()?.models;
    if (!models) return null;
    return models[selectedModelId()] ?? null;
  };

  const responseContent = () => activeModel()?.content ?? od()?.selectedContent ?? "";

  const artifactSources = createMemo<NamedOutputBrowserSource[]>(() => {
    const defs = new Map(namedOutputDefs().map((def) => [def.id, def]));
    const selectedArtifacts = Object.entries(od()?.namedOutputs ?? {}).filter(
      ([artifactId]) => artifactId !== "_default",
    );
    const sources: NamedOutputBrowserSource[] = [];

    const appendSource = (
      id: string,
      label: string,
      artifacts: Array<[string, { content: string; format: string; modelId?: string }]>,
      options?: { meta?: string; tone?: "default" | "selected"; fallbackModelId?: string },
    ) => {
      if (artifacts.length === 0) return;
      sources.push({
        id,
        label,
        meta: options?.meta,
        tone: options?.tone,
        artifacts: artifacts.map(([artifactId, artifact]) => ({
          artifactId,
          artifactName: defs.get(artifactId)?.name ?? artifactId,
          content: artifact.content,
          format: artifact.format,
          modelId: artifact.modelId ?? options?.fallbackModelId ?? "selected",
          readonly: true,
        })),
      });
    };

    if (
      (cfg()?.enableUserSelectionOutput ?? false) &&
      selectedArtifacts.length > 0 &&
      !mergeSelectedSourceIntoModel()
    ) {
      appendSource("selected", "用户选择输出", selectedArtifacts, {
        meta: `已选 ${(od()?.selectedModelIds ?? []).length} 个模型`,
        tone: "selected",
        fallbackModelId: "selected",
      });
    }

    const outputsByModel = od()?.namedOutputsByModel ?? {};
    for (const model of modelEntries()) {
      const modelArtifacts = Object.entries(outputsByModel[model.key] ?? {}).filter(
        ([artifactId]) => artifactId !== "_default",
      );
      const mergedSelectedModel =
        mergeSelectedSourceIntoModel() && model.key === singleSelectedModelId();
      appendSource(`model:${model.key}`, model.modelDisplayName, modelArtifacts, {
        meta: mergedSelectedModel
          ? "当前采用输出"
          : model.key === props.node.selectedOutputKey
            ? "当前选中模型"
            : undefined,
        fallbackModelId: model.key,
      });
    }

    if (sources.length === 0 && selectedArtifacts.length > 0) {
      appendSource("default", "输出物", selectedArtifacts, {
        tone: "selected",
        fallbackModelId: props.node.selectedOutputKey ?? "selected",
      });
    }

    return sources;
  });

  const showArtifactBrowser = () => hasNamedOutputs() && contentScope() === "artifacts";
  const activeContent = () => {
    if (showArtifactBrowser()) {
      return activeArtifactSelection()?.content ?? "";
    }
    return responseContent();
  };
  const activeTitle = () => {
    const selection = activeArtifactSelection();
    if (showArtifactBrowser() && selection) {
      return `${title()} · ${selection.artifactName}`;
    }
    return title();
  };

  const charCount = () => activeContent().length;
  const duration = () => formatDuration(props.node.startedAt, props.node.completedAt);
  const completionTime = () => formatShortTime(props.node.completedAt);

  const displayName = () => {
    if (showArtifactBrowser()) {
      return activeArtifactSelection()?.sourceLabel ?? "输出物";
    }
    const model = activeModel();
    if (model?.modelDisplayName) return model.modelDisplayName;
    if (cfg()?.displayName) return cfg()?.displayName;
    return "模型调用";
  };

  const title = () => props.node.nodeLabel || "模型调用";

  function handleFullscreen() {
    props.onFullscreen?.(activeContent(), activeTitle());
  }

  return (
    <div class="rounded-2xl overflow-hidden bg-white shadow-[0_12px_40px_rgba(25,28,30,0.06)]">
      <div
        class="relative flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)" }}
      >
        <div class="px-8 pt-8 pb-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.15)", "backdrop-filter": "blur(4px)" }}
              >
                <svg
                  class="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>

              <div>
                <h3 class="text-xl font-bold leading-tight text-white">{title()}</h3>
                <div class="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                  >
                    模型调用
                  </span>
                  <span
                    class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(52,211,153,0.25)", color: "#6effd4" }}
                  >
                    <span
                      class="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: "#6effd4" }}
                    />
                    已完成
                  </span>
                  <span class="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {duration()}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-2">
              <Show when={hasNamedOutputs()}>
                <div
                  class="flex items-center rounded-lg p-0.5"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                    style={
                      contentScope() === "artifacts"
                        ? { background: "white", color: "#3525cd" }
                        : { background: "transparent", color: "rgba(255,255,255,0.75)" }
                    }
                    onClick={() => setContentScope("artifacts")}
                  >
                    输出物
                  </button>
                  <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                    style={
                      contentScope() === "responses"
                        ? { background: "white", color: "#3525cd" }
                        : { background: "transparent", color: "rgba(255,255,255,0.75)" }
                    }
                    onClick={() => setContentScope("responses")}
                  >
                    模型响应
                  </button>
                </div>
              </Show>

              <Show when={!showArtifactBrowser()}>
                <div
                  class="flex items-center rounded-lg p-0.5"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                    style={
                      viewMode() === "markdown"
                        ? { background: "white", color: "#3525cd" }
                        : { background: "transparent", color: "rgba(255,255,255,0.75)" }
                    }
                    onClick={() => setViewMode("markdown")}
                  >
                    渲染
                  </button>
                  <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                    style={
                      viewMode() === "source"
                        ? { background: "white", color: "#3525cd" }
                        : { background: "transparent", color: "rgba(255,255,255,0.75)" }
                    }
                    onClick={() => setViewMode("source")}
                  >
                    源码
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center gap-4 px-8 py-3"
          style={{
            background: "rgba(0,0,0,0.12)",
            "border-top": "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            class="rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "rgba(255,255,255,0.18)", color: "white" }}
          >
            {displayName()}
          </span>

          <span
            class="flex items-center gap-1.5 text-xs"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {charCount().toLocaleString()} 字符
          </span>

          <span
            class="flex items-center gap-1.5 text-xs"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            完成于 {completionTime()}
          </span>
        </div>

        <Show when={modelEntries().length > 1 && !showArtifactBrowser()}>
          <div
            class="flex items-center gap-1 overflow-x-auto px-8"
            style={{ "border-top": "1px solid rgba(255,255,255,0.08)" }}
          >
            <For each={modelEntries()}>
              {(model) => (
                <button
                  type="button"
                  class="flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-medium transition-all"
                  style={
                    selectedModelId() === model.key
                      ? { "border-color": "white", color: "white" }
                      : { "border-color": "transparent", color: "rgba(255,255,255,0.55)" }
                  }
                  onClick={() => setSelectedModelId(model.key)}
                >
                  {model.modelDisplayName}
                  <Show when={model.key === props.node.selectedOutputKey}>
                    <span
                      class="rounded px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ background: "rgba(52,211,153,0.3)", color: "#6effd4" }}
                    >
                      选中
                    </span>
                  </Show>
                  <Show when={model.status === "format_error"}>
                    <span
                      class="rounded px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ background: "rgba(239,68,68,0.3)", color: "#fca5a5" }}
                    >
                      格式错误
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div>
        <div class="mx-auto max-w-5xl space-y-4 px-8 py-8">
          <Show when={fallbackWarning()}>
            <div class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <svg
                class="h-4 w-4 flex-shrink-0 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
                />
              </svg>
              <span class="text-sm text-amber-700">模型未按预期格式输出，已合并为单个产物</span>
            </div>
          </Show>

          <Show when={showArtifactBrowser()}>
            <div class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 class="text-sm font-semibold text-[#191c1e]">输出物浏览</h4>
                  <p class="mt-1 text-xs text-[#6b6a78]">
                    切换来源和输出物，只保留一个主预览窗口。
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Show when={artifactSources().length > 0}>
                    <span class="rounded-full bg-[rgba(79,70,229,0.08)] px-3 py-1 text-xs font-medium text-[#4f46e5]">
                      {artifactSources().length} 个来源
                    </span>
                  </Show>
                  <Show when={props.onFullscreen}>
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(79,70,229,0.18)] bg-white px-3 py-2 text-xs font-medium text-[#4f46e5] transition-colors hover:bg-[rgba(79,70,229,0.04)]"
                      onClick={handleFullscreen}
                    >
                      <svg
                        class="h-3.5 w-3.5"
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
                      全屏查看
                    </button>
                  </Show>
                </div>
              </div>

              <NamedOutputsBrowser
                sources={artifactSources()}
                initialSourceId={initialArtifactSourceId()}
                emptyMessage="暂无可展示的输出物"
                onSelectionChange={setActiveArtifactSelection}
              />
            </div>
          </Show>

          <Show when={!showArtifactBrowser()}>
            <div class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 class="text-sm font-semibold text-[#191c1e]">模型响应预览</h4>
                  <p class="mt-1 text-xs text-[#6b6a78]">
                    当前展示 {viewMode() === "markdown" ? "渲染内容" : "源码内容"}。
                  </p>
                </div>
                <Show when={props.onFullscreen}>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(79,70,229,0.18)] bg-white px-3 py-2 text-xs font-medium text-[#4f46e5] transition-colors hover:bg-[rgba(79,70,229,0.04)]"
                    onClick={handleFullscreen}
                  >
                    <svg
                      class="h-3.5 w-3.5"
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
                    全屏查看
                  </button>
                </Show>
              </div>

              <Show
                when={viewMode() === "markdown"}
                fallback={
                  <pre class="overflow-x-auto rounded-xl bg-[#f7f9fb] p-6 font-mono text-sm leading-relaxed text-[#464555] whitespace-pre-wrap">
                    {responseContent() || "(无内容)"}
                  </pre>
                }
              >
                <div class="prose-editorial rounded-2xl bg-white p-2">
                  {renderMarkdown(responseContent())}
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
