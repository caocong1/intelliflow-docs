import type {
  DesensitizeConfig,
  DocumentRuntimeState,
  ExportConfig,
  InputTransformConfig,
  ModelCallConfig,
  NodeConfig,
  NodeExecution,
  RestoreConfig,
} from "@intelliflow/shared";
import { A, useParams } from "@solidjs/router";
import { For, Match, Show, Switch, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { api } from "../../api/client";
import ActionBar from "../../components/workspace/ActionBar";
import AutoSaveIndicator from "../../components/workspace/AutoSaveIndicator";
import type { SaveStatus } from "../../components/workspace/AutoSaveIndicator";
import InlineEditor from "../../components/workspace/InlineEditor";
import NetworkBanner from "../../components/workspace/NetworkBanner";
import NodeHistoryPanel from "../../components/workspace/NodeHistoryPanel";
import StepperBar from "../../components/workspace/StepperBar";
import DesensitizeExecutor from "../../components/workspace/nodes/DesensitizeExecutor";
import ExportExecutor from "../../components/workspace/nodes/ExportExecutor";
import InputTransformExecutor from "../../components/workspace/nodes/InputTransformExecutor";
import ModelCallExecutor from "../../components/workspace/nodes/ModelCallExecutor";
import RestoreExecutor from "../../components/workspace/nodes/RestoreExecutor";

type ViewMode = "current" | "history";

export default function DocumentWorkspace() {
  const params = useParams<{ documentId: string }>();

  const [state, setState] = createSignal<DocumentRuntimeState | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>("current");
  const [viewIndex, setViewIndex] = createSignal(0);
  const [expandedHistory, setExpandedHistory] = createSignal<string | null>(null);
  const [actionLoading, setActionLoading] = createSignal(false);
  const [showRollbackDialog, setShowRollbackDialog] = createSignal(false);
  const [showReexecDialog, setShowReexecDialog] = createSignal<number | null>(null);
  const [showInlineEditor, setShowInlineEditor] = createSignal(false);
  const [savedIndicator, setSavedIndicator] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>("idle");

  /** Unified 1.5s debounced auto-save for all editable nodes */
  let saveTimeout: ReturnType<typeof setTimeout>;
  const debouncedDraftSave = (data: Record<string, unknown>) => {
    setSaveStatus("idle");
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const node = currentNode();
      if (!node) return;
      setSaveStatus("saving");
      try {
        const token = localStorage.getItem("auth_token");
        await fetch(`/api/runtime/${params.documentId}/nodes/${node.id}/draft`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(data),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    }, 1500);
  };

  onCleanup(() => clearTimeout(saveTimeout));

  onMount(async () => {
    try {
      const res = await (api.api.runtime as any)[params.documentId].init.post();
      if (res.data && !("error" in res.data)) {
        const runtimeState = res.data as unknown as DocumentRuntimeState;
        setState(runtimeState);

        // State recovery on refresh: set currentNodeIndex to first non-completed node
        const firstPendingIdx = runtimeState.nodes.findIndex(
          (n) => n.status !== "completed" && n.status !== "skipped",
        );
        if (firstPendingIdx >= 0 && firstPendingIdx !== runtimeState.currentNodeIndex) {
          setState((prev) => (prev ? { ...prev, currentNodeIndex: firstPendingIdx } : prev));
        }
      } else {
        setError((res.data as any)?.error ?? "加载工作台失败");
      }
    } catch {
      setError("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  });

  /** Look up config from workflowNodes by nodeId */
  const getNodeConfig = (nodeExec: NodeExecution): NodeConfig | undefined => {
    const s = state();
    if (!s?.workflowNodes) return undefined;
    const wfNode = s.workflowNodes.find((n) => n.id === nodeExec.nodeId);
    return wfNode?.config;
  };

  const currentNode = (): NodeExecution | undefined => {
    const s = state();
    if (!s) return undefined;
    return s.nodes[s.currentNodeIndex];
  };

  const viewedNode = (): NodeExecution | undefined => {
    const s = state();
    if (!s) return undefined;
    return s.nodes[viewIndex()];
  };

  const completedNodes = (): NodeExecution[] => {
    const s = state();
    if (!s) return [];
    return s.nodes.filter((n) => n.status === "completed" || n.status === "skipped");
  };

  /** Read-only mode: all nodes completed (no currentNode) */
  const readOnly = createMemo(() => {
    const s = state();
    if (!s) return false;
    return s.nodes.every((n) => n.status === "completed" || n.status === "skipped");
  });

  /** Extract the main text content from node outputData based on node type */
  function getNodeOutputText(node: NodeExecution): string {
    const data = node.outputData as Record<string, unknown> | null;
    if (!data) return "";

    // Model call: selectedContent or text
    if (typeof data.selectedContent === "string") return data.selectedContent;
    if (typeof data.text === "string") return data.text;

    // Restore: restoredText
    if (typeof data.restoredText === "string") return data.restoredText;

    // Input transform: concatenate field values
    if (data.fields && typeof data.fields === "object") {
      return Object.values(data.fields as Record<string, string>).join("\n\n");
    }

    // Fallback
    return "";
  }

  /** Auto-save edited content via PUT /draft endpoint */
  async function handleInlineEditorSave(content: string) {
    const node = currentNode();
    if (!node) return;

    try {
      const token = localStorage.getItem("auth_token");
      await fetch(`/api/runtime/${params.documentId}/nodes/${node.id}/draft`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: content }),
      });

      // Show saved indicator briefly
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 1500);
    } catch {
      // Silent fail for auto-save
    }
  }

  function handleStepperClick(index: number) {
    const s = state();
    if (!s) return;
    const node = s.nodes[index];
    if (node.status === "completed" || node.status === "skipped") {
      setViewMode("history");
      setViewIndex(index);
      setShowInlineEditor(false);
    }
  }

  function handleBackToCurrent() {
    setViewMode("current");
    const s = state();
    if (s) setViewIndex(s.currentNodeIndex);
  }

  async function handleAdvance() {
    const node = currentNode();
    if (!node) return;
    setActionLoading(true);
    setShowInlineEditor(false);
    try {
      const res = await (api.api.runtime as any)[params.documentId].advance[node.id].post();
      if (res.data && !("error" in res.data)) {
        setState(res.data as unknown as DocumentRuntimeState);
        setViewMode("current");
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSkip() {
    const node = currentNode();
    if (!node) return;
    setActionLoading(true);
    setShowInlineEditor(false);
    try {
      const res = await (api.api.runtime as any)[params.documentId].skip[node.id].post();
      if (res.data && !("error" in res.data)) {
        setState(res.data as unknown as DocumentRuntimeState);
        setViewMode("current");
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRollback(targetStepOrder: number) {
    setActionLoading(true);
    setShowRollbackDialog(false);
    setShowReexecDialog(null);
    setShowInlineEditor(false);
    try {
      const res = await (api.api.runtime as any)[params.documentId].rollback.post({
        targetStepOrder,
      });
      if (res.data && !("error" in res.data)) {
        setState(res.data as unknown as DocumentRuntimeState);
        setViewMode("current");
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }

  /** Check if current node type supports inline editing (export nodes do not) */
  function isNodeEditable(): boolean {
    const node = currentNode();
    if (!node) return false;
    if (node.nodeType === "export") return false;
    return true;
  }

  /** Check if current node has output data to edit */
  function hasOutputToEdit(): boolean {
    const node = currentNode();
    if (!node) return false;
    return !!node.outputData && getNodeOutputText(node).length > 0;
  }

  /** Render executor with real config from workflowNodes */
  function renderExecutor(node: NodeExecution) {
    const config = getNodeConfig(node);
    if (!config) {
      return (
        <div
          class="rounded-xl p-8 text-center"
          style={{
            background: "#ffffff",
            "box-shadow": "0 12px 40px rgba(25,28,30,0.06)",
          }}
        >
          <div class="text-sm" style={{ color: "#464555" }}>
            加载节点配置中...
          </div>
        </div>
      );
    }

    const isReadOnly = readOnly();
    const docId = params.documentId;
    const draftSave = (data: unknown) => {
      debouncedDraftSave(data as Record<string, unknown>);
    };

    switch (node.nodeType) {
      case "input_transform":
        return (
          <InputTransformExecutor
            nodeExecution={node}
            config={config as InputTransformConfig}
            documentId={docId}
            onDraftSave={draftSave}
            readOnly={isReadOnly}
          />
        );
      case "desensitize":
        return (
          <DesensitizeExecutor
            nodeExecution={node}
            config={config as DesensitizeConfig}
            documentId={docId}
            onDraftSave={draftSave}
            readOnly={isReadOnly}
          />
        );
      case "model_call":
        return (
          <ModelCallExecutor
            nodeExecution={node}
            config={config as ModelCallConfig}
            documentId={docId}
            onDraftSave={draftSave}
            readOnly={isReadOnly}
          />
        );
      case "restore":
        return (
          <RestoreExecutor
            nodeExecution={node}
            config={config as RestoreConfig}
            documentId={docId}
            onDraftSave={draftSave}
            readOnly={isReadOnly}
          />
        );
      case "export":
        return (
          <ExportExecutor
            nodeExecution={node}
            config={config as ExportConfig}
            documentId={docId}
            onDraftSave={draftSave}
            readOnly={isReadOnly}
          />
        );
      default:
        return (
          <div
            class="rounded-xl p-8 text-center"
            style={{
              background: "#ffffff",
              "box-shadow": "0 12px 40px rgba(25,28,30,0.06)",
            }}
          >
            <div class="text-sm mb-2" style={{ color: "#464555" }}>
              节点执行器
            </div>
            <div class="text-lg font-semibold" style={{ color: "#191c1e" }}>
              {node.nodeLabel}
            </div>
            <div
              class="mt-2 inline-flex px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: "rgba(79,70,229,0.08)",
                color: "#4f46e5",
              }}
            >
              {node.nodeType}
            </div>
          </div>
        );
    }
  }

  const backHref = () => {
    const s = state();
    const projectId = s ? (s as unknown as Record<string, unknown>).projectId : undefined;
    if (projectId) return `/projects/${projectId}`;
    return "/projects";
  };

  return (
    <div class="flex flex-col min-h-screen" style={{ background: "#f7f9fb" }}>
      {/* Network status banner */}
      <NetworkBanner />

      {/* Top navigation bar */}
      <header
        class="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6"
        style={{
          height: "3.5rem",
          background: "#ffffff",
          "box-shadow": "0 1px 0 rgba(199,196,216,0.3), 0 4px 16px rgba(25,28,30,0.04)",
        }}
      >
        {/* Left: back button */}
        <A
          href={backHref()}
          class="flex items-center gap-1.5 text-sm font-medium transition-colors no-underline"
          style={{ color: "#464555" }}
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          返回项目
        </A>

        {/* Center: document title */}
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold" style={{ color: "#191c1e" }}>
            {state()?.workflowName ?? "文档工作台"}
          </span>
          <Show when={state()}>
            <span
              class="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: "rgba(53,37,205,0.08)",
                color: "#3525cd",
              }}
            >
              工作台
            </span>
          </Show>
        </div>

        {/* Right: autosave + label */}
        <div class="flex items-center gap-3">
          <AutoSaveIndicator status={saveStatus()} />
          <span class="text-xs" style={{ color: "#464555" }}>
            {state()?.workflowName ?? ""}
          </span>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div style={{ height: "3.5rem" }} />

      {/* Loading skeleton */}
      <Show when={loading()}>
        <div class="max-w-[960px] mx-auto w-full px-6 py-8 space-y-4">
          <div
            class="h-10 rounded-xl animate-pulse"
            style={{ background: "rgba(199,196,216,0.3)" }}
          />
          <div
            class="h-64 rounded-xl animate-pulse"
            style={{ background: "rgba(199,196,216,0.3)" }}
          />
          <div
            class="h-12 rounded-xl animate-pulse w-48 ml-auto"
            style={{ background: "rgba(199,196,216,0.3)" }}
          />
        </div>
      </Show>

      {/* Error state */}
      <Show when={!loading() && error()}>
        <div class="max-w-[960px] mx-auto w-full px-6 py-8">
          <div class="rounded-xl px-5 py-4 text-sm text-red-600" style={{ background: "#fef2f2" }}>
            {error()}
          </div>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!loading() && !error() && !state()}>
        <div class="max-w-[960px] mx-auto w-full px-6 py-8 text-center">
          <p class="text-sm" style={{ color: "#464555" }}>
            未找到文档
          </p>
        </div>
      </Show>

      {/* Main workspace */}
      <Show when={!loading() && !error() && state()}>
        {(s) => (
          <>
            {/* Stepper bar */}
            <div
              class="sticky z-20 px-6 py-4"
              style={{
                top: "3.5rem",
                background: "#ffffff",
                "box-shadow": "0 1px 0 rgba(199,196,216,0.2)",
              }}
            >
              <div class="max-w-[960px] mx-auto">
                <StepperBar
                  nodes={s().nodes}
                  currentIndex={viewMode() === "current" ? s().currentNodeIndex : viewIndex()}
                  onNodeClick={handleStepperClick}
                />
              </div>
            </div>

            {/* Content area */}
            <div
              class="flex-1 overflow-y-auto px-6 py-6"
              style={{
                /* leave room for the fixed ActionBar when active */
                "padding-bottom": !readOnly() && currentNode() ? "6rem" : "2rem",
              }}
            >
              <div class="max-w-[960px] mx-auto space-y-6">
                <Switch>
                  {/* Viewing completed node history */}
                  <Match when={viewMode() === "history" ? viewedNode() : undefined}>
                    {(viewed) => (
                      <div class="space-y-4">
                        <div class="flex items-center justify-between">
                          <h2 class="text-sm font-medium" style={{ color: "#191c1e" }}>
                            历史记录: {viewed().nodeLabel}
                          </h2>
                          <button
                            type="button"
                            class="text-sm font-medium cursor-pointer bg-transparent border-0 transition-colors"
                            style={{ color: "#4f46e5" }}
                            onClick={handleBackToCurrent}
                          >
                            返回当前节点
                          </button>
                        </div>
                        <NodeHistoryPanel node={viewed()} isExpanded={true} onToggle={() => {}} />
                      </div>
                    )}
                  </Match>

                  {/* Current in-progress node */}
                  <Match when={viewMode() === "current" ? currentNode() : undefined}>
                    {(curNode) => (
                      <div class="space-y-6">
                        {/* Node executor -- route by nodeType with real config */}
                        {renderExecutor(curNode())}

                        {/* Inline editor toggle -- shown when node has editable output */}
                        <Show when={!readOnly() && isNodeEditable() && hasOutputToEdit()}>
                          <div class="space-y-3">
                            <div class="flex items-center gap-3">
                              <button
                                type="button"
                                class="px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer border-0"
                                style={{
                                  background: showInlineEditor()
                                    ? "rgba(79,70,229,0.08)"
                                    : "#e6e8ea",
                                  color: showInlineEditor() ? "#4f46e5" : "#191c1e",
                                }}
                                onClick={() => setShowInlineEditor(!showInlineEditor())}
                              >
                                {showInlineEditor() ? "关闭编辑器" : "编辑输出"}
                              </button>

                              {/* Saved indicator */}
                              <Show when={savedIndicator()}>
                                <span class="text-xs text-green-600 font-medium animate-pulse">
                                  已自动保存
                                </span>
                              </Show>
                            </div>

                            <Show when={showInlineEditor() && currentNode()}>
                              {(node) => (
                                <InlineEditor
                                  content={getNodeOutputText(node())}
                                  onChange={handleInlineEditorSave}
                                  readOnly={false}
                                  placeholder="编辑节点输出内容..."
                                />
                              )}
                            </Show>
                          </div>
                        </Show>

                        {/* Completed node history list */}
                        <Show when={completedNodes().length > 0}>
                          <div class="space-y-2">
                            <h3 class="text-sm font-medium" style={{ color: "#464555" }}>
                              已完成步骤
                            </h3>
                            <For each={completedNodes()}>
                              {(node) => (
                                <NodeHistoryPanel
                                  node={node}
                                  isExpanded={expandedHistory() === node.id}
                                  onToggle={() =>
                                    setExpandedHistory(
                                      expandedHistory() === node.id ? null : node.id,
                                    )
                                  }
                                />
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Match>

                  {/* All nodes completed -- read-only mode */}
                  <Match when={viewMode() === "current" && !currentNode()}>
                    <div class="space-y-6">
                      <div
                        class="rounded-xl p-8 text-center"
                        style={{
                          background: "#f0fdf4",
                          "box-shadow": "0 12px 40px rgba(25,28,30,0.04)",
                        }}
                      >
                        <div class="text-lg font-semibold text-green-700">所有步骤已完成</div>
                        <p class="mt-2 text-sm text-green-600">文档生成流程已结束。</p>
                      </div>

                      {/* Show all completed nodes with re-execute option */}
                      <div class="space-y-2">
                        <h3 class="text-sm font-medium" style={{ color: "#464555" }}>
                          执行记录
                        </h3>
                        <For each={s().nodes}>
                          {(node, index) => (
                            <div
                              class="rounded-xl"
                              style={{
                                background: "#ffffff",
                                "box-shadow": "0 2px 8px rgba(25,28,30,0.04)",
                              }}
                            >
                              <div class="flex items-center justify-between px-5 py-3.5">
                                <div class="flex items-center gap-3">
                                  <span class="text-sm font-medium" style={{ color: "#191c1e" }}>
                                    {node.nodeLabel}
                                  </span>
                                  <span class="text-xs" style={{ color: "#464555" }}>
                                    {node.status === "completed" ? "已完成" : "已跳过"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  class="text-xs font-medium cursor-pointer bg-transparent border-0"
                                  style={{ color: "#4f46e5" }}
                                  onClick={() => setShowReexecDialog(index())}
                                >
                                  从此节点重新执行
                                </button>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Match>
                </Switch>
              </div>
            </div>

            {/* Bottom action bar (fixed, via ActionBar component) */}
            <Show when={!readOnly() && currentNode()}>
              <ActionBar
                loading={actionLoading()}
                canSkip={currentNode()?.nodeType !== "export"}
                canRollback={s().currentNodeIndex > 0}
                isSaving={saveStatus() === "saving"}
                hasSaved={saveStatus() === "saved"}
                onConfirm={handleAdvance}
                onSkip={handleSkip}
                onRollback={() => setShowRollbackDialog(true)}
              />
            </Show>

            {/* Rollback dialog */}
            <Show when={showRollbackDialog()}>
              <div
                class="fixed inset-0 flex items-center justify-center z-50"
                style={{ background: "rgba(25,28,30,0.4)" }}
              >
                <div
                  class="rounded-xl p-6 w-full mx-4"
                  style={{
                    background: "#ffffff",
                    "box-shadow": "0 24px 64px rgba(25,28,30,0.16)",
                    "max-width": "28rem",
                  }}
                >
                  <h3 class="text-lg font-semibold mb-3" style={{ color: "#191c1e" }}>
                    回退到
                  </h3>
                  <p class="text-sm mb-4" style={{ color: "#464555" }}>
                    选择要回退到的步骤。回退后，该步骤之后的所有步骤将需要重新执行。
                  </p>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    <For each={s().nodes.filter((_n, i) => i < s().currentNodeIndex)}>
                      {(node) => (
                        <button
                          type="button"
                          class="w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer border-0"
                          style={{ background: "#f7f9fb", color: "#191c1e" }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              "rgba(79,70,229,0.06)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "#f7f9fb";
                          }}
                          onClick={() => handleRollback(node.stepOrder)}
                        >
                          <span class="text-sm font-medium" style={{ color: "#191c1e" }}>
                            步骤 {node.stepOrder + 1}: {node.nodeLabel}
                          </span>
                          <span class="block text-xs mt-0.5" style={{ color: "#464555" }}>
                            {node.nodeType}
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="mt-4 flex justify-end">
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer border-0"
                      style={{ background: "#e6e8ea", color: "#191c1e" }}
                      onClick={() => setShowRollbackDialog(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            {/* Re-execute confirmation dialog */}
            <Show when={showReexecDialog() !== null}>
              <div
                class="fixed inset-0 flex items-center justify-center z-50"
                style={{ background: "rgba(25,28,30,0.4)" }}
              >
                <div
                  class="rounded-xl p-6 w-full mx-4"
                  style={{
                    background: "#ffffff",
                    "box-shadow": "0 24px 64px rgba(25,28,30,0.16)",
                    "max-width": "28rem",
                  }}
                >
                  <h3 class="text-lg font-semibold mb-3" style={{ color: "#191c1e" }}>
                    确认重新执行
                  </h3>
                  <p class="text-sm mb-4" style={{ color: "#464555" }}>
                    确认重新执行？后续节点状态将被重置。
                  </p>
                  <div class="flex justify-end gap-3">
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer border-0"
                      style={{ background: "#e6e8ea", color: "#191c1e" }}
                      onClick={() => setShowReexecDialog(null)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all cursor-pointer border-0 disabled:opacity-50"
                      style={{
                        background: "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)",
                      }}
                      disabled={actionLoading()}
                      onClick={() => {
                        const idx = showReexecDialog();
                        if (idx !== null) {
                          handleRollback(s().nodes[idx].stepOrder);
                        }
                      }}
                    >
                      确认重新执行
                    </button>
                  </div>
                </div>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
