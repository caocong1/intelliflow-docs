import { useParams } from "@solidjs/router";
import { createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import { api } from "../../api/client";
import StepperBar from "../../components/workspace/StepperBar";
import NodeHistoryPanel from "../../components/workspace/NodeHistoryPanel";
import DesensitizeExecutor from "../../components/workspace/nodes/DesensitizeExecutor";
import ExportExecutor from "../../components/workspace/nodes/ExportExecutor";
import InputTransformExecutor from "../../components/workspace/nodes/InputTransformExecutor";
import type { DesensitizeConfig, ExportConfig, InputTransformConfig, DocumentRuntimeState, NodeExecution } from "@intelliflow/shared";

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

  onMount(async () => {
    try {
      const res = await (api.api.runtime as any)[params.documentId].init.post();
      if (res.data && !("error" in res.data)) {
        setState(res.data as unknown as DocumentRuntimeState);
      } else {
        setError((res.data as any)?.error ?? "Failed to initialize workspace");
      }
    } catch {
      setError("Failed to load workspace");
    } finally {
      setLoading(false);
    }
  });

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

  function handleStepperClick(index: number) {
    const s = state();
    if (!s) return;
    const node = s.nodes[index];
    if (node.status === "completed" || node.status === "skipped") {
      setViewMode("history");
      setViewIndex(index);
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

  return (
    <div class="flex flex-col h-full min-h-0">
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

      {/* Main workspace */}
      <Show when={!loading() && !error() && state()}>
        {(s) => (
          <>
            {/* Header with workflow name */}
            <div class="px-6 pt-4 pb-2">
              <h1 class="text-lg font-bold text-gray-900">{s().workflowName}</h1>
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
                <Match when={viewMode() === "history" && viewedNode()}>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <h2 class="text-sm font-medium text-gray-700">
                        History: {viewedNode()!.nodeLabel}
                      </h2>
                      <button
                        type="button"
                        class="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        onClick={handleBackToCurrent}
                      >
                        Back to current
                      </button>
                    </div>
                    <NodeHistoryPanel
                      node={viewedNode()!}
                      isExpanded={true}
                      onToggle={() => {}}
                    />
                  </div>
                </Match>

                {/* Current in-progress node */}
                <Match when={viewMode() === "current" && currentNode()}>
                  <div class="space-y-6">
                    {/* Node executor — route by nodeType */}
                    <Switch
                      fallback={
                        <div class="bg-white border border-gray-200 rounded-xl p-8 text-center">
                          <div class="text-gray-400 text-sm mb-2">Node Executor</div>
                          <div class="text-lg font-semibold text-gray-700">
                            {currentNode()?.nodeLabel}
                          </div>
                          <div class="mt-2 inline-flex px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                            {currentNode()?.nodeType}
                          </div>
                          <p class="mt-4 text-sm text-gray-400">
                            Node executor for {currentNode()?.nodeType} (placeholder)
                          </p>
                        </div>
                      }
                    >
                      <Match when={currentNode()?.nodeType === "input_transform"}>
                        <InputTransformExecutor
                          nodeExecution={currentNode()!}
                          config={({} as InputTransformConfig)}
                          documentId={params.documentId}
                          onDraftSave={(data) => {
                            /* draft saved via executor */
                          }}
                          readOnly={false}
                        />
                      </Match>
                      <Match when={currentNode()?.nodeType === "desensitize"}>
                        <DesensitizeExecutor
                          nodeExecution={currentNode()!}
                          config={({} as DesensitizeConfig)}
                          documentId={params.documentId}
                          onDraftSave={(data) => {
                            /* draft saved via executor */
                          }}
                          readOnly={false}
                        />
                      </Match>
                      <Match when={currentNode()?.nodeType === "export"}>
                        <ExportExecutor
                          nodeExecution={currentNode()!}
                          config={({} as ExportConfig)}
                          documentId={params.documentId}
                          onDraftSave={(data) => {
                            /* draft saved via executor */
                          }}
                          readOnly={false}
                        />
                      </Match>
                    </Switch>

                    {/* Completed node history list */}
                    <Show when={completedNodes().length > 0}>
                      <div class="space-y-2">
                        <h3 class="text-sm font-medium text-gray-600">Completed Steps</h3>
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
                </Match>

                {/* All nodes completed */}
                <Match when={viewMode() === "current" && !currentNode()}>
                  <div class="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                    <div class="text-green-600 text-lg font-semibold">All steps completed</div>
                    <p class="mt-2 text-sm text-green-500">
                      Document generation workflow has finished.
                    </p>
                  </div>
                </Match>
              </Switch>
            </div>

            {/* Bottom action bar */}
            <div class="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
              {/* Left: rollback */}
              <div>
                <Show when={s().currentNodeIndex > 0 && currentNode()}>
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    disabled={actionLoading()}
                    onClick={() => setShowRollbackDialog(true)}
                  >
                    Rollback
                  </button>
                </Show>
              </div>

              {/* Right: skip + confirm */}
              <div class="flex items-center gap-3">
                <Show when={currentNode()}>
                  {/* Skip button - only show placeholder, real skippable check needs workflow config */}
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    disabled={actionLoading()}
                    onClick={handleSkip}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    disabled={actionLoading()}
                    onClick={handleAdvance}
                  >
                    {actionLoading() ? "Processing..." : "Confirm / Next"}
                  </button>
                </Show>
              </div>
            </div>

            {/* Rollback dialog */}
            <Show when={showRollbackDialog()}>
              <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                  <h3 class="text-lg font-semibold text-gray-900 mb-4">Roll Back To</h3>
                  <p class="text-sm text-gray-500 mb-4">
                    Select a previous step to roll back to. All steps after it will need re-execution.
                  </p>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    <For each={s().nodes.filter((n, i) => i < s().currentNodeIndex)}>
                      {(node) => (
                        <button
                          type="button"
                          class="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                          onClick={() => handleRollback(node.stepOrder)}
                        >
                          <span class="text-sm font-medium text-gray-800">
                            Step {node.stepOrder + 1}: {node.nodeLabel}
                          </span>
                          <span class="block text-xs text-gray-400 mt-0.5">{node.nodeType}</span>
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="mt-4 flex justify-end">
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      onClick={() => setShowRollbackDialog(false)}
                    >
                      Cancel
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
