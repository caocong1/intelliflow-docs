import { useParams } from "@solidjs/router";
import { createSignal, For, Match, onCleanup, onMount, Show, Switch, createMemo } from "solid-js";
import { api } from "../../api/client";
import StepperBar from "../../components/workspace/StepperBar";
import NodeHistoryPanel from "../../components/workspace/NodeHistoryPanel";
import InlineEditor from "../../components/workspace/InlineEditor";
import NetworkBanner from "../../components/workspace/NetworkBanner";
import AutoSaveIndicator from "../../components/workspace/AutoSaveIndicator";
import type { SaveStatus } from "../../components/workspace/AutoSaveIndicator";
import DesensitizeExecutor from "../../components/workspace/nodes/DesensitizeExecutor";
import ExportExecutor from "../../components/workspace/nodes/ExportExecutor";
import InputTransformExecutor from "../../components/workspace/nodes/InputTransformExecutor";
import ModelCallExecutor from "../../components/workspace/nodes/ModelCallExecutor";
import RestoreExecutor from "../../components/workspace/nodes/RestoreExecutor";
import type {
  DesensitizeConfig,
  ExportConfig,
  InputTransformConfig,
  ModelCallConfig,
  RestoreConfig,
  NodeConfig,
  DocumentRuntimeState,
  NodeExecution,
} from "@intelliflow/shared";

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
        await fetch(
          `/api/runtime/${params.documentId}/nodes/${node.id}/draft`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(data),
          },
        );
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
          setState((prev) =>
            prev ? { ...prev, currentNodeIndex: firstPendingIdx } : prev,
          );
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
      await fetch(
        `/api/runtime/${params.documentId}/nodes/${node.id}/draft`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text: content }),
        },
      );

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
        <div class="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div class="text-gray-400 text-sm">
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
          <div class="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div class="text-gray-400 text-sm mb-2">节点执行器</div>
            <div class="text-lg font-semibold text-gray-700">{node.nodeLabel}</div>
            <div class="mt-2 inline-flex px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
              {node.nodeType}
            </div>
          </div>
        );
    }
  }

  return (
    <div class="flex flex-col h-full min-h-0">
      {/* Network status banner */}
      <NetworkBanner />

      {/* Loading skeleton */}
      <Show when={loading()}>
        <div class="space-y-4 p-6">
          <div class="h-10 bg-gray-200 rounded animate-pulse w-full" />
          <div class="h-64 bg-gray-200 rounded animate-pulse w-full" />
          <div class="h-12 bg-gray-200 rounded animate-pulse w-48 ml-auto" />
        </div>
      </Show>

      {/* Error state */}
      <Show when={!loading() && error()}>
        <div class="p-6">
          <div class="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error()}</div>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!loading() && !error() && !state()}>
        <div class="p-6 text-center">
          <p class="text-gray-500 text-sm">未找到文档</p>
        </div>
      </Show>

      {/* Main workspace */}
      <Show when={!loading() && !error() && state()}>
        {(s) => (
          <>
            {/* Header with workflow name */}
            <div class="px-6 pt-4 pb-2">
              <div class="flex items-center justify-between">
                <h1 class="text-lg font-bold text-gray-900">{s().workflowName}</h1>
                <div class="flex items-center gap-3">
                  <AutoSaveIndicator status={saveStatus()} />
                  <span class="text-xs text-gray-400">文档工作台</span>
                </div>
              </div>
            </div>

            {/* Stepper bar */}
            <div class="px-6 py-3 border-b border-gray-200 bg-white">
              <StepperBar
                nodes={s().nodes}
                currentIndex={viewMode() === "current" ? s().currentNodeIndex : viewIndex()}
                onNodeClick={handleStepperClick}
              />
            </div>

            {/* Content area */}
            <div class="flex-1 overflow-y-auto p-6">
              <Switch>
                {/* Viewing completed node history */}
                <Match when={viewMode() === "history" ? viewedNode() : undefined}>
                  {(viewed) => (
                    <div class="space-y-4">
                      <div class="flex items-center justify-between">
                        <h2 class="text-sm font-medium text-gray-700">
                          历史记录: {viewed().nodeLabel}
                        </h2>
                        <button
                          type="button"
                          class="text-sm text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                          onClick={handleBackToCurrent}
                        >
                          返回当前节点
                        </button>
                      </div>
                      <NodeHistoryPanel
                        node={viewed()}
                        isExpanded={true}
                        onToggle={() => {}}
                      />
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
                            class={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                              showInlineEditor()
                                ? "text-indigo-700 bg-indigo-100 border border-indigo-300"
                                : "text-gray-600 bg-white border border-gray-300 hover:bg-gray-50"
                            }`}
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
                        <h3 class="text-sm font-medium text-gray-600">已完成步骤</h3>
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
                    <div class="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                      <div class="text-green-600 text-lg font-semibold">所有步骤已完成</div>
                      <p class="mt-2 text-sm text-green-500">
                        文档生成流程已结束。
                      </p>
                    </div>

                    {/* Show all completed nodes with re-execute option */}
                    <div class="space-y-2">
                      <h3 class="text-sm font-medium text-gray-600">执行记录</h3>
                      <For each={s().nodes}>
                        {(node, index) => (
                          <div class="border border-gray-200 rounded-lg bg-white">
                            <div class="flex items-center justify-between px-4 py-3">
                              <div class="flex items-center gap-3">
                                <span class="text-sm font-medium text-gray-800">
                                  {node.nodeLabel}
                                </span>
                                <span class="text-xs text-gray-400">
                                  {node.status === "completed" ? "已完成" : "已跳过"}
                                </span>
                              </div>
                              <button
                                type="button"
                                class="text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
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

            {/* Bottom action bar */}
            <Show when={!readOnly() && currentNode()}>
              <div class="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
                {/* Left: rollback */}
                <div>
                  <Show when={s().currentNodeIndex > 0}>
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                      disabled={actionLoading()}
                      onClick={() => setShowRollbackDialog(true)}
                    >
                      回退
                    </button>
                  </Show>
                </div>

                {/* Right: skip + confirm */}
                <div class="flex items-center gap-3">
                  {/* Skip button -- server validates skippable flag; shown for all non-export nodes */}
                  <Show when={currentNode()?.nodeType !== "export"}>
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                      disabled={actionLoading()}
                      onClick={handleSkip}
                    >
                      跳过此节点
                    </button>
                  </Show>
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
                    disabled={actionLoading()}
                    onClick={handleAdvance}
                  >
                    {actionLoading() ? "处理中..." : "确认并继续"}
                  </button>
                </div>
              </div>
            </Show>

            {/* Rollback dialog */}
            <Show when={showRollbackDialog()}>
              <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                  <h3 class="text-lg font-semibold text-gray-900 mb-4">回退到</h3>
                  <p class="text-sm text-gray-500 mb-4">
                    选择要回退到的步骤。回退后，该步骤之后的所有步骤将需要重新执行。
                  </p>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    <For each={s().nodes.filter((_n, i) => i < s().currentNodeIndex)}>
                      {(node) => (
                        <button
                          type="button"
                          class="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer"
                          onClick={() => handleRollback(node.stepOrder)}
                        >
                          <span class="text-sm font-medium text-gray-800">
                            步骤 {node.stepOrder + 1}: {node.nodeLabel}
                          </span>
                          <span class="block text-xs text-gray-400 mt-0.5">{node.nodeType}</span>
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="mt-4 flex justify-end">
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
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
              <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                  <h3 class="text-lg font-semibold text-gray-900 mb-4">确认重新执行</h3>
                  <p class="text-sm text-gray-500 mb-4">
                    确认重新执行？后续节点状态将被重置。
                  </p>
                  <div class="flex justify-end gap-3">
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => setShowReexecDialog(null)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
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
