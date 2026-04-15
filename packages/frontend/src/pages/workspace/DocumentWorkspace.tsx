import type {
  DesensitizeConfig,
  DocumentRuntimeState,
  ExportConfig,
  InputTransformConfig,
  ModelCallConfig,
  NodeConfig,
  NodeExecution,
  NodeExecutionRule,
  RestoreConfig,
} from "@intelliflow/shared";
import { A, useParams } from "@solidjs/router";
import {
  For,
  Match,
  Show,
  Switch,
  type JSX,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";
import {
  advanceNode,
  api,
  getRuntimeState,
  initRuntime,
  rollbackNode,
  skipNode,
  startBackgroundExecution,
} from "../../api/client";
import FavoriteButton from "../../components/favorites/FavoriteButton";
import { showToast } from "../../components/ui/Toast";
import ActionBar from "../../components/workspace/ActionBar";
import AutoSaveIndicator from "../../components/workspace/AutoSaveIndicator";
import type { SaveStatus } from "../../components/workspace/AutoSaveIndicator";
import CompletedNodeCard from "../../components/workspace/CompletedNodeCard";
import ContentPreviewModal from "../../components/workspace/ContentPreviewModal";
import InlineEditor from "../../components/workspace/InlineEditor";
import NetworkBanner from "../../components/workspace/NetworkBanner";
import StepperBar, { nodeTypeLabels } from "../../components/workspace/StepperBar";
import CompletedViewRouter from "../../components/workspace/completed/CompletedViewRouter";
import BlockedNodeCard from "../../components/workspace/nodes/BlockedNodeCard";
import DesensitizeExecutor from "../../components/workspace/nodes/DesensitizeExecutor";
import ExportExecutor from "../../components/workspace/nodes/ExportExecutor";
import InputTransformExecutor from "../../components/workspace/nodes/InputTransformExecutor";
import ModelCallExecutor from "../../components/workspace/nodes/ModelCallExecutor";
import RestoreExecutor from "../../components/workspace/nodes/RestoreExecutor";
import { checkFavorites, recordAccess } from "../../lib/api/user-activity";
import { formatDuration, formatFileSize } from "../../lib/format-utils";
import { renderMarkdown } from "../../lib/render-markdown";

type ViewMode = "current" | "history";

/** Polling interval for workspace during active generation (seconds) */
const WORKSPACE_POLL_INTERVAL = 3;

const DEFAULT_NODE_STEP_DESCRIPTIONS: Partial<Record<NodeConfig["type"], string>> = {
  input_transform: "补充当前步骤需要的输入内容；如果节点允许跳过且暂无意见，可以直接跳过。",
  desensitize: "确认或调整脱敏结果，确保后续模型仅基于安全内容继续执行。",
  restore: "确认恢复结果是否可用，再继续进入后续步骤。",
  export: "确认导出条件已满足后，选择格式生成最终文件。",
};

export default function DocumentWorkspace() {
  const params = useParams<{ documentId: string }>();

  const [state, setState] = createSignal<DocumentRuntimeState | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>("current");
  const [viewIndex, setViewIndex] = createSignal(0);

  const [actionLoading, setActionLoading] = createSignal(false);
  const [showRollbackDialog, setShowRollbackDialog] = createSignal(false);
  const [showReexecDialog, setShowReexecDialog] = createSignal<number | null>(null);
  const [showInlineEditor, setShowInlineEditor] = createSignal(false);
  const [savedIndicator, setSavedIndicator] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>("idle");
  const [expandedCompletedNode, setExpandedCompletedNode] = createSignal<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = createSignal(false);
  const [fullscreenContent, setFullscreenContent] = createSignal<{
    content: string;
    title: string;
  } | null>(null);
  const [copiedFullText, setCopiedFullText] = createSignal(false);
  const [manualConfirmAction, setManualConfirmAction] = createSignal<
    null | (() => Promise<boolean>)
  >(null);

  function handleManualConfirmRegistration(action: (() => Promise<boolean>) | null) {
    setManualConfirmAction(() => action);
  }

  // Background execution polling state
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [countdown, setCountdown] = createSignal(WORKSPACE_POLL_INTERVAL);

  // AI inline editing: available models
  const [availableModels, setAvailableModels] = createSignal<
    Array<{ id: string; name: string; deploymentType: "cloud" | "local" }>
  >([]);

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
          body: JSON.stringify({ data }),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    }, 1500);
  };

  onCleanup(() => clearTimeout(saveTimeout));

  /** Check if any node is actively executing (generation active).
   *  Excludes user-input nodes (input_transform, desensitize) at the current step
   *  since those require manual interaction, not background generation. */
  function isGenerationActive(runtimeState: DocumentRuntimeState): boolean {
    if (!runtimeState.backgroundTaskActive) return false;

    const currentIdx = runtimeState.currentNodeIndex;
    return runtimeState.nodes.some((n, i) => {
      if (n.status !== "in_progress") return false;
      if (i !== currentIdx) return true; // non-current in_progress = background work
      // Current node: check if it's waiting for user interaction
      if (n.nodeType === "input_transform" || n.nodeType === "desensitize") return false;
      if (n.nodeType === "export" || n.nodeType === "restore") return false;
      if (n.nodeType === "model_call") {
        // model_call with final output = waiting for user review/edit, not generating
        const od = n.outputData as Record<string, unknown> | null;
        return !(od?.text || od?.selectedContent);
      }
      return true;
    });
  }

  /** Fetch current runtime state from backend (used for polling and state recovery) */
  async function fetchRuntimeState() {
    try {
      const runtimeState = await getRuntimeState(params.documentId);
      if (runtimeState && !("error" in runtimeState)) {
        const wasGenerating = isGenerating();
        setState(runtimeState);

        // Update generation status based on node states
        if (!isGenerationActive(runtimeState)) {
          setIsGenerating(false);

          // Detect state transition: generation just finished
          if (wasGenerating) {
            const hasFailed = runtimeState.nodes.some((n) => n.status === "failed");
            const allDone = runtimeState.nodes.every(
              (n) => n.status === "completed" || n.status === "skipped",
            );
            const docUrl = `/projects/${runtimeState.projectId ?? ""}/documents/${params.documentId}/workspace`;
            if (hasFailed) {
              showToast("文档生成失败", "error", {
                label: "查看详情",
                href: docUrl,
              });
            } else if (allDone) {
              showToast("文档生成完成", "success", {
                label: "查看文档",
                href: docUrl,
              });
            }
            // Pipeline paused at interactive node — no toast needed
          }
        }
      }
    } catch {
      // Silent fail for polling — network hiccups should not break the UI
    }
  }

  /** Start background execution — fires and forgets, then starts polling */
  async function handleStartBackground() {
    setActionLoading(true);
    try {
      const res = await startBackgroundExecution(params.documentId);
      if (res && !("error" in res)) {
        setIsGenerating(true);
        // Short delay before first poll — give the backend pipeline time to
        // update node statuses (fire-and-forget race condition)
        setCountdown(1);
      } else if (res && "error" in res) {
        showToast(res.error, "error");
      }
    } catch {
      setError("启动后台生成失败，请重试");
    } finally {
      setActionLoading(false);
    }
  }

  /** Retry failed generation — restart background execution from failed node */
  async function handleRetryGeneration() {
    await handleStartBackground();
  }

  /** Manual refresh — immediately poll and reset countdown */
  function handleManualRefresh() {
    fetchRuntimeState();
    setCountdown(WORKSPACE_POLL_INTERVAL);
  }

  // Polling timer: tick every 1s, fetch on countdown expiry
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  createEffect(() => {
    if (isGenerating()) {
      // Start polling
      pollTimer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            fetchRuntimeState();
            return WORKSPACE_POLL_INTERVAL;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Stop polling
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    }
  });

  onCleanup(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  // Favorite state for this document
  const [docFavorited, setDocFavorited] = createSignal(false);

  onMount(async () => {
    // Record recent access (fire-and-forget)
    if (params.documentId) {
      recordAccess("document", params.documentId).catch(() => {});
    }

    // Check favorite status for this document
    if (params.documentId) {
      checkFavorites([{ targetType: "document", targetId: params.documentId }])
        .then((favKeys) => {
          setDocFavorited(favKeys.includes(`document:${params.documentId}`));
        })
        .catch(() => {});
    }

    // Fetch available models for AI inline editing (fire-and-forget)
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/models", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data: Array<{
            id: string;
            displayName: string;
            deploymentType?: string;
            isActive: boolean;
            isProviderDisabled: boolean;
          }>;
        };
        const active = json.data
          .filter((m) => m.isActive && !m.isProviderDisabled)
          .map((m) => ({
            id: m.id,
            name: m.displayName,
            deploymentType: (m.deploymentType ?? "cloud") as "cloud" | "local",
          }));
        setAvailableModels(active);
      } catch {
        // Non-critical — AI editing just won't have model options
      }
    })();

    try {
      const result = await initRuntime(params.documentId);
      if (result && !("error" in result)) {
        const runtimeState = result;
        setState(runtimeState);

        // State recovery on refresh: set currentNodeIndex to first non-completed node
        const firstPendingIdx = runtimeState.nodes.findIndex(
          (n) => n.status !== "completed" && n.status !== "skipped",
        );
        if (firstPendingIdx >= 0 && firstPendingIdx !== runtimeState.currentNodeIndex) {
          setState((prev) => (prev ? { ...prev, currentNodeIndex: firstPendingIdx } : prev));
        }

        // If generation is active (nodes in_progress/pending), start polling automatically
        if (isGenerationActive(runtimeState)) {
          setIsGenerating(true);
          setCountdown(WORKSPACE_POLL_INTERVAL);
        }
      } else {
        setError(result && "error" in result ? result.error : "加载工作台失败");
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

  /** Default model ID from current node's model config (first modelId) */
  const defaultModelId = (): string | undefined => {
    const node = currentNode();
    if (!node) return undefined;
    const s = state();
    if (!s?.workflowNodes) return undefined;
    const wfNode = s.workflowNodes.find((wn) => wn.id === node.nodeId);
    if (!wfNode || wfNode.config.type !== "model_call") return undefined;
    return (wfNode.config as ModelCallConfig).modelIds?.[0];
  };

  const viewedNode = (): NodeExecution | undefined => {
    const s = state();
    if (!s) return undefined;
    return s.nodes[viewIndex()];
  };

  const historyReexecuteIndex = createMemo(() => {
    if (viewMode() !== "history") return null;

    const node = viewedNode();
    const s = state();
    if (!node || !s || node.nodeType === "export") return null;

    const index = s.nodes.findIndex((item) => item.id === node.id);
    return index >= 0 ? index : null;
  });

  /** Read-only mode: all nodes completed (no currentNode) */
  const readOnly = createMemo(() => {
    const s = state();
    if (!s) return false;
    return s.nodes.every((n) => n.status === "completed" || n.status === "skipped");
  });

  /** Check if any node has failed */
  const hasFailedNodes = createMemo(() => {
    const s = state();
    if (!s) return false;
    return s.nodes.some((n) => n.status === "failed");
  });

  /** Check if any node is blocked by a conditional execution rule */
  const hasBlockedNodes = createMemo(() => {
    const s = state();
    if (!s) return false;
    return s.nodes.some((n) => n.status === "blocked");
  });

  /**
   * Roll back to the earliest upstream source node referenced by the blocked node's
   * executionRule.conditions. Target is computed here (not in BlockedNodeCard) by
   * looking up the workflowNodes config, finding executionRule.conditions, extracting
   * all sourceRef.nodeId values, and selecting the earliest by stepOrder.
   */
  async function handleBlockedRollback(blockedNodeId: string) {
    const s = state();
    if (!s) return;

    const wfNode = s.workflowNodes.find((wn) => wn.id === blockedNodeId);
    const executionRule = (wfNode?.config as unknown as Record<string, unknown>)?.executionRule as
      | NodeExecutionRule
      | undefined;

    if (!executionRule?.conditions?.length) return;

    const sourceNodeIds = executionRule.conditions.map((c) => c.sourceRef.nodeId);

    const sourceExecs = s.nodes
      .filter((n) => sourceNodeIds.includes(n.nodeId))
      .sort((a, b) => a.stepOrder - b.stepOrder);

    const targetNodeId = sourceExecs[0]?.nodeId;
    if (!targetNodeId) return;

    const targetExec = s.nodes.find((n) => n.nodeId === targetNodeId);
    const targetStepOrder = targetExec?.stepOrder;
    if (!targetStepOrder) return;

    const token = localStorage.getItem("auth_token");
    const res = await fetch(`/api/runtime/${params.documentId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetStepOrder }),
    });
    if (res.ok) {
      fetchRuntimeState();
    }
  }

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
        body: JSON.stringify({ data: { text: content } }),
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
    // Virtual result step clicked (index === nodes.length)
    if (index === s.nodes.length) {
      setViewMode("current");
      setShowInlineEditor(false);
      return;
    }
    const node = s.nodes[index];
    if (node.status === "completed" || node.status === "skipped") {
      setViewMode("history");
      setViewIndex(index);
      setShowInlineEditor(false);
    } else if (node.status === "failed") {
      setViewMode("history");
      setViewIndex(index);
      setShowInlineEditor(false);
    } else if (node.status === "in_progress") {
      // Clicking the in-progress node returns to current view
      setViewMode("current");
      setViewIndex(index);
      setShowInlineEditor(false);
    }
  }

  async function handleAdvance() {
    const node = currentNode();
    if (!node) return;
    setActionLoading(true);
    setShowInlineEditor(false);
    try {
      // Advance the current node to completed before starting background execution.
      // All interactive nodes (input_transform, desensitize, model_call) pause the pipeline
      // in in_progress state for user review — must be explicitly advanced here.
      if (node.status === "in_progress") {
        const result = await advanceNode(params.documentId, node.id);
        if (result && !("error" in result)) {
          setState(result);
        }
      }
      // Use background execution: submit to backend and start polling
      await handleStartBackground();
      setViewMode("current");
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePrimaryConfirm() {
    const node = currentNode();
    if (!node) return;

    if (
      node.nodeType === "input_transform" ||
      node.nodeType === "desensitize" ||
      node.nodeType === "restore" ||
      node.nodeType === "model_call"
    ) {
      const confirmAction = manualConfirmAction();
      if (confirmAction) {
        try {
          const shouldAdvance = await confirmAction();
          if (shouldAdvance === false) return;
        } catch {
          return;
        }
      }
    }

    await handleAdvance();
  }

  function canSkipCurrentNode(): boolean {
    const node = currentNode();
    if (!node || node.nodeType === "export") return false;
    return !!getNodeConfig(node)?.skippable;
  }

  async function handleSkip() {
    const node = currentNode();
    if (!node) return;
    setActionLoading(true);
    setShowInlineEditor(false);
    try {
      const result = await skipNode(params.documentId, node.id);
      if (result && !("error" in result)) {
        setState(result);
        setViewMode("current");
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRollback(targetStepOrder: number, autoExecute = false) {
    setActionLoading(true);
    setShowRollbackDialog(false);
    setShowReexecDialog(null);
    setShowInlineEditor(false);
    try {
      const result = await rollbackNode(params.documentId, targetStepOrder);
      if (result && !("error" in result)) {
        setState(result);
        setViewMode("current");
        if (autoExecute) {
          await handleStartBackground();
        }
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
  function getNodeStepDescription(nodeExecution: NodeExecution): string | undefined {
    const config = getNodeConfig(nodeExecution) as
      | (NodeConfig & { stepDescription?: string })
      | undefined;
    let baseDescription =
      config?.stepDescription ?? DEFAULT_NODE_STEP_DESCRIPTIONS[nodeExecution.nodeType];

    if (config?.type === "model_call" && config.enableUserSelectionOutput === true) {
      const selectionHint = "本步骤完成后需要先选择一个合适的模型结果，再继续后续流程。";
      if (!baseDescription) {
        baseDescription = selectionHint;
      } else if (!baseDescription.includes(selectionHint)) {
        baseDescription = `${baseDescription} ${selectionHint}`;
      }
    }

    if (config?.skippable) {
      const skipHint =
        "如果选择跳过，系统会按流程预设自动继承上游输出或置空，不需要你手动处理映射。";
      if (!baseDescription) return skipHint;
      if (!baseDescription.includes(skipHint)) {
        return `${baseDescription} ${skipHint}`;
      }
    }

    return baseDescription;
  }

  function renderSkippedHistoryBanner(node: NodeExecution) {
    if (node.status !== "skipped") return null;
    const outputData = (node.outputData as Record<string, unknown> | null) ?? null;
    const skipType = outputData?.skipType;
    const skipReason =
      typeof outputData?.skipReason === "string" && outputData.skipReason.trim()
        ? outputData.skipReason
        : "该节点已按流程预设跳过。";
    const skipBindings =
      (outputData?.skipBindings as Record<string, { mode?: string }> | undefined) ?? {};
    const bindings = Object.values(skipBindings);
    const inheritCount = bindings.filter((binding) => binding?.mode === "inherit").length;
    const emptyCount = bindings.filter((binding) => binding?.mode === "empty").length;
    const bindingSummary = [
      inheritCount > 0 ? `继承 ${inheritCount} 项` : null,
      emptyCount > 0 ? `置空 ${emptyCount} 项` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const title =
      skipType === "conditional" ? "条件跳过" : skipType === "automatic" ? "自动跳过" : "用户跳过";

    return (
      <section
        class="rounded-xl px-5 py-4"
        style={{
          background: "#fffbeb",
          border: "1px solid rgba(245,158,11,0.22)",
        }}
      >
        <div class="flex items-start gap-3">
          <div class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
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
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-amber-800">{title}</p>
              <Show when={bindingSummary}>
                <span class="text-xs text-amber-700">{bindingSummary}</span>
              </Show>
            </div>
            <p class="mt-1 text-sm leading-6 text-amber-700">{skipReason}</p>
          </div>
        </div>
      </section>
    );
  }

  /**
   * Build the executor for the given node.
   *
   * Takes an *accessor* (not a plain node) so executor component instances
   * stay mounted across polling updates. Internally wrapped in `untrack` so
   * the function call at the JSX site does not create reactive dependencies
   * that would re-invoke renderExecutor on every poll — which would
   * re-instantiate the executor and wipe its internal state (e.g. the
   * currently-selected model tab inside ModelCallExecutor).
   *
   * JSX props like `nodeExecution={nodeAccessor()}` are compiled by Solid
   * into reactive getters: the component is created once, but reads of
   * `props.nodeExecution` inside it always return the latest value.
   */
  function renderExecutor(nodeAccessor: () => NodeExecution) {
    return untrack(() => {
      const initialNode = nodeAccessor();
      const initialConfig = getNodeConfig(initialNode);
      const stepDescription = getNodeStepDescription(initialNode);
      if (!initialConfig) {
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

      const docId = params.documentId;
      const draftSave = (data: unknown) => {
        debouncedDraftSave(data as Record<string, unknown>);
      };

      let executor: JSX.Element;

      switch (initialNode.nodeType) {
        case "input_transform":
          executor = (
            <InputTransformExecutor
              nodeExecution={nodeAccessor()}
              config={getNodeConfig(nodeAccessor()) as InputTransformConfig}
              documentId={docId}
              onDraftSave={draftSave}
              readOnly={readOnly()}
              registerConfirmAction={handleManualConfirmRegistration}
            />
          );
          break;
        case "desensitize":
          executor = (
            <DesensitizeExecutor
              nodeExecution={nodeAccessor()}
              config={getNodeConfig(nodeAccessor()) as DesensitizeConfig}
              documentId={docId}
              onDraftSave={draftSave}
              readOnly={readOnly()}
              registerConfirmAction={handleManualConfirmRegistration}
            />
          );
          break;
        case "model_call":
          executor = (
            <ModelCallExecutor
              nodeExecution={nodeAccessor()}
              config={getNodeConfig(nodeAccessor()) as ModelCallConfig}
              documentId={docId}
              onDraftSave={draftSave}
              readOnly={readOnly()}
              backgroundMode={isGenerating()}
              registerConfirmAction={handleManualConfirmRegistration}
            />
          );
          break;
        case "restore":
          executor = (
            <RestoreExecutor
              nodeExecution={nodeAccessor()}
              config={getNodeConfig(nodeAccessor()) as RestoreConfig}
              documentId={docId}
              onDraftSave={draftSave}
              readOnly={readOnly()}
              registerConfirmAction={handleManualConfirmRegistration}
              onAdvanceAfterConfirm={handleAdvance}
            />
          );
          break;
        case "export":
          executor = (
            <ExportExecutor
              nodeExecution={nodeAccessor()}
              config={getNodeConfig(nodeAccessor()) as ExportConfig}
              documentId={docId}
              onDraftSave={draftSave}
              onExported={fetchRuntimeState}
              readOnly={readOnly()}
            />
          );
          break;
        default:
          executor = (
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
                {nodeAccessor().nodeLabel}
              </div>
              <div
                class="mt-2 inline-flex px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(79,70,229,0.08)",
                  color: "#4f46e5",
                }}
              >
                {nodeAccessor().nodeType}
              </div>
            </div>
          );
          break;
      }

      return (
        <div class="space-y-4">
          <Show when={stepDescription}>
            <section
              class="rounded-xl px-5 py-4"
              style={{
                background: "rgba(79,70,229,0.05)",
                border: "1px solid rgba(79,70,229,0.12)",
              }}
            >
              <div class="flex items-start gap-3">
                <div
                  class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(79,70,229,0.12)", color: "#4f46e5" }}
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
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div class="min-w-0">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#4f46e5" }}
                  >
                    当前步骤说明
                  </p>
                  <p class="mt-1 text-sm leading-6" style={{ color: "#3525cd" }}>
                    {stepDescription}
                  </p>
                </div>
              </div>
            </section>
          </Show>
          {executor}
        </div>
      );
    });
  }

  const backHref = () => {
    const s = state();
    if (s?.projectId) return `/projects/${s.projectId}`;
    return "/projects";
  };

  return (
    <div class="flex flex-col h-full min-h-0">
      {/* Network status banner */}
      <NetworkBanner />

      {/* Loading skeleton */}
      <Show when={loading()}>
        <div class="w-full w-full px-6 py-8 space-y-4">
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
        <div class="w-full w-full px-6 py-8">
          <div class="rounded-xl px-5 py-4 text-sm text-red-600" style={{ background: "#fef2f2" }}>
            {error()}
          </div>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!loading() && !error() && !state()}>
        <div class="w-full w-full px-6 py-8 text-center">
          <p class="text-sm" style={{ color: "#464555" }}>
            未找到文档
          </p>
        </div>
      </Show>

      {/* Main workspace */}
      <Show when={!loading() && !error() && state()}>
        {(s) => (
          <>
            {/* Breadcrumb + Document info */}
            <div
              class="sticky top-0 z-20 px-6 pt-4 pb-3"
              style={{
                background: "#f7f9fb",
                "box-shadow": "0 1px 0 rgba(199,196,216,0.2)",
              }}
            >
              <div class="space-y-3">
                {/* Breadcrumb + auto-save */}
                <div class="flex items-center justify-between">
                  <A
                    href={backHref()}
                    class="flex items-center gap-1.5 text-sm font-medium transition-colors no-underline hover:opacity-80"
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
                    返回文档列表
                  </A>
                  <AutoSaveIndicator status={saveStatus()} />
                </div>

                {/* Document title + metadata */}
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="flex flex-col min-w-0">
                      <h1
                        class="text-lg font-bold leading-tight truncate"
                        style={{ color: "#191c1e" }}
                        title={s().documentTitle ?? "文档工作台"}
                      >
                        {s().documentTitle ?? "文档工作台"}
                      </h1>
                      <span
                        class="text-[11px] leading-tight truncate"
                        style={{ color: "#8b8a99" }}
                        title={s().workflowName}
                      >
                        {s().workflowName}
                      </span>
                    </div>
                    <FavoriteButton
                      targetType="document"
                      targetId={params.documentId}
                      initialFavorited={docFavorited()}
                    />
                    <span
                      class="text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1"
                      style={{
                        background: hasFailedNodes()
                          ? "rgba(220,38,38,0.08)"
                          : isGenerating()
                            ? "rgba(245,158,11,0.08)"
                            : readOnly()
                              ? "rgba(16,185,129,0.08)"
                              : "rgba(53,37,205,0.08)",
                        color: hasFailedNodes()
                          ? "#dc2626"
                          : isGenerating()
                            ? "#d97706"
                            : readOnly()
                              ? "#059669"
                              : "#3525cd",
                      }}
                    >
                      <Show when={isGenerating()}>
                        <svg
                          class="w-3 h-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      </Show>
                      {hasFailedNodes()
                        ? "生成失败"
                        : isGenerating()
                          ? "生成中"
                          : readOnly()
                            ? "已完成"
                            : "进行中"}
                    </span>
                  </div>
                  <div class="flex items-center gap-4 text-xs" style={{ color: "#464555" }}>
                    <span>
                      {readOnly()
                        ? `全部 ${s().nodes.length} 个节点已完成`
                        : `步骤 ${s().currentNodeIndex + 1}/${s().nodes.length}`}
                    </span>
                    {/* Polling countdown + manual refresh during active generation */}
                    <Show when={isGenerating()}>
                      <span
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: "rgba(79,70,229,0.08)", color: "#4f46e5" }}
                      >
                        <svg
                          class="w-3 h-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        {countdown()}秒后自动刷新
                        <button
                          type="button"
                          class="ml-1 p-0.5 rounded hover:bg-white/50 transition-colors cursor-pointer border-0 bg-transparent"
                          style={{ color: "#4f46e5" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleManualRefresh();
                          }}
                          title="立即刷新"
                        >
                          <svg
                            class="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            </div>

            {/* Content + Sidebar layout */}
            <div class="flex flex-1 min-h-0">
              {/* Content area */}
              <div class="flex-1 overflow-y-auto px-6 py-6" style={{ "padding-bottom": "2rem" }}>
                <div class="space-y-6">
                  <Switch>
                    {/* Viewing completed node history */}
                    <Match when={viewMode() === "history" ? viewedNode() : undefined}>
                      {(viewed) => (
                        <div class="space-y-4">
                          <Show when={!readOnly()}>
                            <h2 class="text-sm font-medium" style={{ color: "#191c1e" }}>
                              {viewed().status === "failed" ? "失败节点" : "历史记录"}:{" "}
                              {viewed().nodeLabel}
                            </h2>
                          </Show>
                          <Show
                            when={
                              viewed().status === "failed" && viewed().nodeType === "model_call"
                            }
                            fallback={
                              <div class="space-y-4">
                                {renderSkippedHistoryBanner(viewed())}
                                <CompletedViewRouter
                                  node={viewed()}
                                  config={getNodeConfig(viewed())}
                                  documentId={params.documentId}
                                  onFullscreen={(content, title) =>
                                    setFullscreenContent({ content, title })
                                  }
                                  onReexecute={() => {
                                    const idx = s().nodes.findIndex((n) => n.id === viewed().id);
                                    if (idx >= 0) setShowReexecDialog(idx);
                                  }}
                                />
                              </div>
                            }
                          >
                            {renderExecutor(viewed)}
                          </Show>
                        </div>
                      )}
                    </Match>

                    {/* Failed node summary with retry — shown when generation failed */}
                    <Match when={viewMode() === "current" && hasFailedNodes() && !isGenerating()}>
                      <div class="space-y-6">
                        {/* Failed banner */}
                        <section
                          class="rounded-xl p-6"
                          style={{
                            background: "#fef2f2",
                            border: "1px solid rgba(220,38,38,0.15)",
                          }}
                        >
                          <div class="flex items-start gap-4">
                            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                              <svg
                                class="w-5 h-5 text-red-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                                />
                              </svg>
                            </div>
                            <div class="flex-1">
                              <h3 class="text-lg font-bold" style={{ color: "#991b1b" }}>
                                文档生成失败
                              </h3>
                              <p class="text-sm mt-1" style={{ color: "#b91c1c" }}>
                                部分节点执行出错，请查看下方详情后重试。
                              </p>
                            </div>
                            <button
                              type="button"
                              class="px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all cursor-pointer border-0 flex items-center gap-2"
                              style={{
                                background: "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)",
                                "box-shadow": "0 4px 12px rgba(79,70,229,0.2)",
                              }}
                              disabled={actionLoading()}
                              onClick={handleRetryGeneration}
                            >
                              <svg
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              重新生成
                            </button>
                          </div>
                        </section>

                        {/* Failed node details */}
                        <For each={s().nodes.filter((n) => n.status === "failed")}>
                          {(node) => (
                            <div
                              class="rounded-xl p-5"
                              style={{
                                background: "#ffffff",
                                border: "1px solid rgba(220,38,38,0.2)",
                                "box-shadow": "0 2px 8px rgba(220,38,38,0.06)",
                              }}
                            >
                              <div class="flex items-center gap-3 mb-3">
                                <span
                                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}
                                >
                                  失败
                                </span>
                                <span class="text-sm font-semibold" style={{ color: "#191c1e" }}>
                                  步骤 {node.stepOrder + 1}: {node.nodeLabel}
                                </span>
                                <span class="text-xs" style={{ color: "#464555" }}>
                                  ({node.nodeType})
                                </span>
                              </div>
                              <Show when={node.errorMessage}>
                                <div
                                  class="rounded-lg px-4 py-3 text-sm"
                                  style={{ background: "#fef2f2", color: "#991b1b" }}
                                >
                                  {node.errorMessage}
                                </div>
                              </Show>
                            </div>
                          )}
                        </For>

                        {/* Completed nodes before failure */}
                        <Show when={s().nodes.some((n) => n.status === "completed")}>
                          <div class="space-y-4">
                            <h3 class="text-sm font-medium" style={{ color: "#464555" }}>
                              已完成的节点
                            </h3>
                            <For each={s().nodes.filter((n) => n.status === "completed")}>
                              {(node) => (
                                <CompletedNodeCard
                                  node={node}
                                  config={getNodeConfig(node)}
                                  isExpanded={expandedCompletedNode() === node.id}
                                  onToggle={() =>
                                    setExpandedCompletedNode(
                                      expandedCompletedNode() === node.id ? null : node.id,
                                    )
                                  }
                                  onReexecute={() => {
                                    const idx = s().nodes.findIndex((n) => n.id === node.id);
                                    if (idx >= 0) setShowReexecDialog(idx);
                                  }}
                                  onFullscreen={(content, title) =>
                                    setFullscreenContent({ content, title })
                                  }
                                  documentId={params.documentId}
                                />
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </Match>

                    {/* Background generation in progress — show in-progress node executor */}
                    <Match when={viewMode() === "current" && isGenerating()}>
                      {(() => {
                        const inProgressNode = () =>
                          s().nodes.find((n) => n.status === "in_progress");
                        return (
                          <Show
                            when={inProgressNode()}
                            fallback={
                              <div class="bg-[#f7f9fb] rounded-xl p-4 min-h-[120px] flex items-center justify-center">
                                <div class="flex items-center gap-3">
                                  <span class="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                  <span class="text-sm text-[#464555]">正在准备下一步...</span>
                                </div>
                              </div>
                            }
                          >
                            {(node) => <div class="space-y-6">{renderExecutor(node)}</div>}
                          </Show>
                        );
                      })()}
                    </Match>

                    {/* Blocked node — condition triggered, show block card with rollback */}
                    <Match when={viewMode() === "current" && hasBlockedNodes() && !isGenerating()}>
                      <div class="space-y-6">
                        <For each={s().nodes.filter((n) => n.status === "blocked")}>
                          {(node) => (
                            <BlockedNodeCard
                              node={node}
                              onRollback={() => handleBlockedRollback(node.nodeId)}
                            />
                          )}
                        </For>
                      </div>
                    </Match>

                    {/* Current in-progress node (manual step-by-step mode) */}
                    <Match
                      when={
                        viewMode() === "current" &&
                        !readOnly() &&
                        !isGenerating() &&
                        !hasFailedNodes() &&
                        !hasBlockedNodes()
                          ? currentNode()
                          : undefined
                      }
                    >
                      {(curNode) => (
                        <div class="space-y-6">
                          {/* Node executor -- route by nodeType with real config */}
                          {renderExecutor(curNode)}

                          {/* (Inline editor removed) */}

                          {/* Completed node history removed — stepper bar already shows progress */}
                        </div>
                      )}
                    </Match>

                    {/* All nodes completed -- read-only results dashboard */}
                    <Match when={viewMode() === "current" && readOnly()}>
                      {(() => {
                        const nodes = s().nodes;
                        const totalDuration = () =>
                          formatDuration(nodes[0]?.startedAt, nodes[nodes.length - 1]?.completedAt);
                        const exportNode = () => nodes.find((n) => n.nodeType === "export");
                        const modelCallNode = () =>
                          [...nodes].reverse().find((n) => n.nodeType === "model_call");
                        const modelCallData = () =>
                          modelCallNode()?.outputData as Record<string, unknown> | null;
                        const selectedContent = () =>
                          (modelCallData()?.selectedContent as string) ??
                          (modelCallData()?.text as string) ??
                          "";

                        return (
                          <div class="space-y-8">
                            {/* HERO RESULTS CARD */}
                            <section
                              class="bg-white rounded-xl p-8"
                              style={{ "box-shadow": "0 12px 40px rgba(25,28,30,0.06)" }}
                            >
                              <div class="flex items-start gap-5 mb-6">
                                <div class="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                  <svg
                                    class="w-7 h-7 text-emerald-600"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 class="text-2xl font-extrabold text-[#191c1e] mb-1">
                                    文档生成完成
                                  </h3>
                                  <p class="text-[#464555]">
                                    所有 {nodes.length} 个节点已成功执行，文档已准备就绪。
                                  </p>
                                </div>
                              </div>

                              {/* Stats pills */}
                              <div class="flex flex-wrap gap-3 mb-6">
                                <div class="bg-[#f2f4f6] px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-[#191c1e]">
                                  <svg
                                    class="w-4 h-4 text-[#464555]"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  总耗时 {totalDuration()}
                                </div>
                                <div class="bg-[#f2f4f6] px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-[#191c1e]">
                                  <svg
                                    class="w-4 h-4 text-[#464555]"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                    />
                                  </svg>
                                  节点数 {nodes.length}/{nodes.length}
                                </div>
                              </div>

                              {/* Divider */}
                              <div class="h-px bg-[rgba(199,196,216,0.2)] mb-6" />

                              {/* Export hint — click stepper to access export */}
                              <Show when={exportNode()}>
                                <button
                                  type="button"
                                  class="w-full bg-[#f7f9fb] p-4 rounded-xl flex items-center justify-between hover:bg-[#eeebff] transition-colors group"
                                  onClick={() => {
                                    const idx = nodes.findIndex((n) => n.nodeType === "export");
                                    if (idx >= 0) handleStepperClick(idx);
                                  }}
                                >
                                  <div class="flex items-center gap-3">
                                    <svg
                                      class="w-5 h-5 text-[#4f46e5]"
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
                                    <span class="text-sm font-medium text-[#191c1e]">
                                      选择格式并导出文档
                                    </span>
                                  </div>
                                  <svg
                                    class="w-4 h-4 text-[#464555] group-hover:translate-x-0.5 transition-transform"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </button>
                              </Show>
                            </section>

                            {/* CONTENT PREVIEW CARD */}
                            <Show when={selectedContent()}>
                              <section
                                class="bg-white rounded-xl overflow-hidden"
                                style={{ "box-shadow": "0 12px 40px rgba(25,28,30,0.06)" }}
                              >
                                <div class="px-8 py-5 flex items-center justify-between bg-[rgba(242,244,246,0.3)]">
                                  <h3 class="text-lg font-bold text-[#191c1e] flex items-center gap-2">
                                    <svg
                                      class="w-5 h-5 text-[#4f46e5]"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      aria-hidden="true"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                      />
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                      />
                                    </svg>
                                    生成内容预览
                                  </h3>
                                  <button
                                    type="button"
                                    class="text-[#4f46e5] text-sm font-bold flex items-center gap-1 hover:underline"
                                    onClick={() =>
                                      setFullscreenContent({
                                        content: selectedContent(),
                                        title: "生成内容预览",
                                      })
                                    }
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
                                    全屏查看
                                  </button>
                                </div>
                                <div class="px-8 py-6 relative">
                                  <div
                                    class={`overflow-hidden ${previewExpanded() ? "" : "max-h-[360px]"}`}
                                  >
                                    {renderMarkdown(selectedContent())}
                                  </div>
                                  <Show when={!previewExpanded()}>
                                    <div
                                      class="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-center pb-6"
                                      style={{
                                        background:
                                          "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        class="text-[#4f46e5] font-bold text-sm bg-white px-6 py-2 rounded-full border border-[rgba(79,70,229,0.2)]"
                                        style={{ "box-shadow": "0 2px 8px rgba(25,28,30,0.06)" }}
                                        onClick={() => setPreviewExpanded(true)}
                                      >
                                        展开查看全部
                                      </button>
                                    </div>
                                  </Show>
                                  <Show when={previewExpanded()}>
                                    <div class="text-center mt-4">
                                      <button
                                        type="button"
                                        class="text-[#464555] text-sm hover:text-[#191c1e] transition-colors"
                                        onClick={() => setPreviewExpanded(false)}
                                      >
                                        收起
                                      </button>
                                    </div>
                                  </Show>
                                </div>
                              </section>
                            </Show>

                            {/* EXECUTION DETAILS */}
                            <section class="space-y-4">
                              <div class="flex items-center gap-3">
                                <h3 class="text-xl font-bold text-[#191c1e]">执行详情</h3>
                                <span class="text-xs font-bold bg-[#e0e3e5] px-3 py-1 rounded-full text-[#464555]">
                                  {nodes.length} 个节点
                                </span>
                              </div>
                              <div class="space-y-4">
                                <For each={nodes}>
                                  {(node, index) => (
                                    <CompletedNodeCard
                                      node={node}
                                      config={getNodeConfig(node)}
                                      isExpanded={expandedCompletedNode() === node.id}
                                      onToggle={() =>
                                        setExpandedCompletedNode(
                                          expandedCompletedNode() === node.id ? null : node.id,
                                        )
                                      }
                                      onReexecute={() => setShowReexecDialog(index())}
                                      onFullscreen={(content, title) =>
                                        setFullscreenContent({ content, title })
                                      }
                                      documentId={params.documentId}
                                    />
                                  )}
                                </For>
                              </div>
                            </section>
                          </div>
                        );
                      })()}
                    </Match>
                  </Switch>
                </div>
              </div>

              {/* Right sidebar — Process Tracker + Actions */}
              <div
                class="flex-shrink-0 flex flex-col border-l"
                style={{
                  width: "12rem",
                  background: "#fafbfc",
                  "border-color": "rgba(199,196,216,0.2)",
                }}
              >
                <div
                  class="px-2 pt-3 pb-1 flex-shrink-0"
                  style={{ "border-bottom": "1px solid rgba(199,196,216,0.15)" }}
                >
                  <span
                    class="text-[11px] font-semibold tracking-wide"
                    style={{ color: "#8b8a99" }}
                  >
                    流程进度
                  </span>
                </div>
                <div class="flex-1 overflow-y-auto">
                  <StepperBar
                    nodes={s().nodes}
                    currentIndex={
                      viewMode() === "current"
                        ? readOnly()
                          ? s().nodes.length
                          : s().currentNodeIndex
                        : viewIndex()
                    }
                    onNodeClick={handleStepperClick}
                    showResultStep={readOnly()}
                    onResultClick={() => {
                      setViewMode("current");
                      setShowInlineEditor(false);
                    }}
                    vertical
                  />
                </div>

                <Show when={historyReexecuteIndex() !== null}>
                  <div
                    class="flex-shrink-0 px-3 py-3"
                    style={{
                      background: "linear-gradient(180deg, rgba(247,249,251,0) 0%, #f7f9fb 24%)",
                      "border-top": "1px solid rgba(199,196,216,0.2)",
                    }}
                  >
                    <div
                      class="mb-2 text-center text-[11px] font-medium"
                      style={{ color: "#8b8a99" }}
                    >
                      当前查看步骤
                    </div>
                    <button
                      type="button"
                      class="flex w-full items-center justify-center gap-1.5 rounded-[0.875rem] border-0 px-3 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                      style={{
                        background: actionLoading()
                          ? "#a5b4fc"
                          : "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)",
                        "box-shadow": actionLoading() ? "none" : "0 4px 12px rgba(53,37,205,0.18)",
                      }}
                      disabled={actionLoading()}
                      onClick={() => setShowReexecDialog(historyReexecuteIndex())}
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      重新执行当前步骤
                    </button>
                  </div>
                </Show>

                {/* Sidebar action area — replaces former bottom ActionBar */}
                <Show
                  when={
                    !readOnly() &&
                    currentNode() &&
                    viewMode() === "current" &&
                    currentNode()?.nodeType !== "export"
                  }
                >
                  <div class="flex-shrink-0">
                    <ActionBar
                      vertical
                      loading={
                        actionLoading() ||
                        isGenerating() ||
                        ((currentNode()?.nodeType === "desensitize" ||
                          currentNode()?.nodeType === "restore") &&
                          !manualConfirmAction() &&
                          !currentNode()?.outputData)
                      }
                      canSkip={canSkipCurrentNode()}
                      canRollback={s().currentNodeIndex > 0}
                      isSaving={saveStatus() === "saving"}
                      hasSaved={saveStatus() === "saved"}
                      onConfirm={handlePrimaryConfirm}
                      onSkip={handleSkip}
                      onRollback={() => setShowRollbackDialog(true)}
                    />
                  </div>
                </Show>
              </div>
            </div>

            {/* Action bar removed — actions moved to right sidebar */}

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
                            {node.nodeLabel}
                          </span>
                          <span class="block text-xs mt-0.5" style={{ color: "#8b8a99" }}>
                            {nodeTypeLabels[node.nodeType] ?? node.nodeType}
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
                          handleRollback(s().nodes[idx].stepOrder, true);
                        }
                      }}
                    >
                      确认重新执行
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            {/* Fullscreen content preview modal */}
            <Show when={fullscreenContent()}>
              {(fc) => (
                <ContentPreviewModal
                  content={fc().content}
                  title={fc().title}
                  onClose={() => setFullscreenContent(null)}
                />
              )}
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
