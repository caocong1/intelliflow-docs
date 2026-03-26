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
import { showToast } from "../../components/ui/Toast";
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { api } from "../../api/client";
import FavoriteButton from "../../components/favorites/FavoriteButton";
import { checkFavorites, recordAccess } from "../../lib/api/user-activity";
import ActionBar from "../../components/workspace/ActionBar";
import AutoSaveIndicator from "../../components/workspace/AutoSaveIndicator";
import type { SaveStatus } from "../../components/workspace/AutoSaveIndicator";
import CompletedNodeCard from "../../components/workspace/CompletedNodeCard";
import ContentPreviewModal from "../../components/workspace/ContentPreviewModal";
import InlineEditor from "../../components/workspace/InlineEditor";
import NetworkBanner from "../../components/workspace/NetworkBanner";
import StepperBar from "../../components/workspace/StepperBar";
import CompletedViewRouter from "../../components/workspace/completed/CompletedViewRouter";
import DesensitizeExecutor from "../../components/workspace/nodes/DesensitizeExecutor";
import ExportExecutor from "../../components/workspace/nodes/ExportExecutor";
import InputTransformExecutor from "../../components/workspace/nodes/InputTransformExecutor";
import ModelCallExecutor from "../../components/workspace/nodes/ModelCallExecutor";
import RestoreExecutor from "../../components/workspace/nodes/RestoreExecutor";
import { formatDuration, formatFileSize } from "../../lib/format-utils";
import { renderMarkdown } from "../../lib/render-markdown";

type ViewMode = "current" | "history";

/** Polling interval for workspace during active generation (seconds) */
const WORKSPACE_POLL_INTERVAL = 3;

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

  // Background execution polling state
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [countdown, setCountdown] = createSignal(WORKSPACE_POLL_INTERVAL);

  // AI inline editing: available models
  const [availableModels, setAvailableModels] = createSignal<Array<{ id: string; name: string; deploymentType: "cloud" | "local" }>>([]);

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

  /** Check if any node is still running or pending (generation active) */
  function isGenerationActive(runtimeState: DocumentRuntimeState): boolean {
    return runtimeState.nodes.some(
      (n) => n.status === "in_progress" || n.status === "pending",
    );
  }

  /** Fetch current runtime state from backend (used for polling and state recovery) */
  async function fetchRuntimeState() {
    try {
      const res = await (api.api.runtime as any)[params.documentId].get();
      if (res.data && !("error" in res.data)) {
        const runtimeState = res.data as unknown as DocumentRuntimeState;
        const wasGenerating = isGenerating();
        setState(runtimeState);

        // Update generation status based on node states
        if (!isGenerationActive(runtimeState)) {
          setIsGenerating(false);

          // Detect state transition: generation just finished
          if (wasGenerating) {
            const hasFailed = runtimeState.nodes.some((n) => n.status === "failed");
            const docUrl = `/projects/${(runtimeState as any).projectId ?? ""}/documents/${params.documentId}/workspace`;
            if (hasFailed) {
              showToast("文档生成失败", "error", {
                label: "查看详情",
                href: docUrl,
              });
            } else {
              showToast("文档生成完成", "success", {
                label: "查看文档",
                href: docUrl,
              });
            }
          }
        }
      }
    } catch {
      // Silent fail for polling — network hiccups should not break the UI
    }
  }

  /** Start background execution — fires and forgets, then starts polling */
  async function startBackgroundExecution() {
    setActionLoading(true);
    try {
      const res = await (api.api.runtime as any)[params.documentId]["start-background"].post();
      if (res.data && !("error" in res.data)) {
        setIsGenerating(true);
        setCountdown(WORKSPACE_POLL_INTERVAL);
        // Immediately fetch to get the latest state
        await fetchRuntimeState();
      }
    } catch {
      setError("启动后台生成失败，请重试");
    } finally {
      setActionLoading(false);
    }
  }

  /** Retry failed generation — restart background execution from failed node */
  async function handleRetryGeneration() {
    await startBackgroundExecution();
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
          data: Array<{ id: string; displayName: string; deploymentType?: string; isActive: boolean; isProviderDisabled: boolean }>;
        };
        const active = json.data
          .filter((m) => m.isActive && !m.isProviderDisabled)
          .map((m) => ({ id: m.id, name: m.displayName, deploymentType: (m.deploymentType ?? "cloud") as "cloud" | "local" }));
        setAvailableModels(active);
      } catch {
        // Non-critical — AI editing just won't have model options
      }
    })();

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

        // If generation is active (nodes in_progress/pending), start polling automatically
        if (isGenerationActive(runtimeState)) {
          setIsGenerating(true);
          setCountdown(WORKSPACE_POLL_INTERVAL);
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
      // For input_transform nodes, advance first to complete them before background execution
      if (node.nodeType === "input_transform" && node.status !== "completed") {
        const advRes = await (api.api.runtime as any)[params.documentId].advance[node.id].post();
        if (advRes.data && !("error" in advRes.data)) {
          setState(advRes.data as unknown as DocumentRuntimeState);
        }
      }
      // Use background execution: submit to backend and start polling
      await startBackgroundExecution();
      setViewMode("current");
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
            {/* Breadcrumb + Document info + Stepper */}
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
                    返回项目
                  </A>
                  <AutoSaveIndicator status={saveStatus()} />
                </div>

                {/* Document title + metadata */}
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <h1 class="text-lg font-bold" style={{ color: "#191c1e" }}>
                      {s().workflowName ?? "文档工作台"}
                    </h1>
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
                        <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </Show>
                      {hasFailedNodes() ? "生成失败" : isGenerating() ? "生成中" : readOnly() ? "已完成" : "进行中"}
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
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </span>
                    </Show>
                  </div>
                </div>

                {/* Stepper */}
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
                />
              </div>
            </div>

            {/* Content area */}
            <div
              class="flex-1 overflow-y-auto px-6 py-6"
              style={{
                "padding-bottom": "2rem",
              }}
            >
              <div class="space-y-6">
                <Switch>
                  {/* Viewing completed node history */}
                  <Match when={viewMode() === "history" ? viewedNode() : undefined}>
                    {(viewed) => (
                      <div class="space-y-4">
                        <Show when={!readOnly()}>
                          <div class="flex items-center justify-between">
                            <h2 class="text-sm font-medium" style={{ color: "#191c1e" }}>
                              历史记录: {viewed().nodeLabel}
                            </h2>
                            <button
                              type="button"
                              class="text-sm font-medium cursor-pointer bg-transparent border-0 transition-colors flex items-center gap-1"
                              style={{ color: "#4f46e5" }}
                              onClick={handleBackToCurrent}
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
                                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                />
                              </svg>
                              返回当前节点
                            </button>
                          </div>
                        </Show>
                        <CompletedViewRouter
                          node={viewed()}
                          config={getNodeConfig(viewed())}
                          documentId={params.documentId}
                          onFullscreen={(content, title) =>
                            setFullscreenContent({ content, title })
                          }
                        />
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
                            <svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
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
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                                onReexecute={() => {}}
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

                  {/* Background generation in progress — show node progress */}
                  <Match when={viewMode() === "current" && isGenerating()}>
                    <div class="space-y-4">
                      <For each={s().nodes}>
                        {(node) => (
                          <div
                            class="rounded-xl p-5"
                            style={{
                              background: "#ffffff",
                              border: node.status === "in_progress"
                                ? "2px solid rgba(79,70,229,0.4)"
                                : "1px solid rgba(199,196,216,0.2)",
                              "box-shadow": node.status === "in_progress"
                                ? "0 4px 16px rgba(79,70,229,0.08)"
                                : "0 2px 8px rgba(25,28,30,0.04)",
                            }}
                          >
                            <div class="flex items-center gap-3">
                              {/* Status icon */}
                              <Switch>
                                <Match when={node.status === "completed"}>
                                  <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                    </svg>
                                  </div>
                                </Match>
                                <Match when={node.status === "in_progress"}>
                                  <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-4 h-4 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                  </div>
                                </Match>
                                <Match when={node.status === "failed"}>
                                  <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </div>
                                </Match>
                                <Match when={node.status === "pending"}>
                                  <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <div class="w-2 h-2 rounded-full bg-slate-300" />
                                  </div>
                                </Match>
                                <Match when={node.status === "skipped"}>
                                  <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </Match>
                              </Switch>

                              {/* Node info */}
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="text-sm font-semibold" style={{ color: "#191c1e" }}>
                                    步骤 {node.stepOrder + 1}: {node.nodeLabel}
                                  </span>
                                  <span
                                    class="text-xs px-2 py-0.5 rounded-full"
                                    style={{ background: "rgba(79,70,229,0.06)", color: "#4f46e5" }}
                                  >
                                    {node.nodeType}
                                  </span>
                                </div>
                                <Show when={node.status === "in_progress"}>
                                  <p class="text-xs mt-1" style={{ color: "#4f46e5" }}>
                                    正在执行...
                                  </p>
                                </Show>
                                <Show when={node.status === "completed" && node.completedAt}>
                                  <p class="text-xs mt-1" style={{ color: "#059669" }}>
                                    已完成
                                  </p>
                                </Show>
                                <Show when={node.status === "failed" && node.errorMessage}>
                                  <p class="text-xs mt-1" style={{ color: "#dc2626" }}>
                                    {node.errorMessage}
                                  </p>
                                </Show>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Match>

                  {/* Current in-progress node (manual step-by-step mode) */}
                  <Match when={viewMode() === "current" && !readOnly() && !isGenerating() && !hasFailedNodes() ? currentNode() : undefined}>
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
                                  documentId={params.documentId}
                                  nodeExecutionId={node().id}
                                  nodes={state()?.nodes}
                                  currentNodeIndex={state()?.currentNodeIndex}
                                  availableModels={availableModels()}
                                  defaultModelId={defaultModelId()}
                                />
                              )}
                            </Show>
                          </div>
                        </Show>

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
                      const exportData = () =>
                        exportNode()?.outputData as Record<string, unknown> | null;
                      const modelCallNode = () =>
                        [...nodes].reverse().find((n) => n.nodeType === "model_call");
                      const modelCallData = () =>
                        modelCallNode()?.outputData as Record<string, unknown> | null;
                      const selectedContent = () =>
                        (modelCallData()?.selectedContent as string) ??
                        (modelCallData()?.text as string) ??
                        "";

                      const FORMAT_ICONS: Record<string, string> = {
                        word: "W",
                        pdf: "P",
                        markdown: "M",
                      };
                      const FORMAT_LABELS: Record<string, string> = {
                        word: "Word 文档",
                        pdf: "PDF 文件",
                        markdown: "Markdown 文件",
                      };

                      async function triggerDownload() {
                        const eNode = exportNode();
                        if (!eNode) return;
                        const url = `/api/runtime/${params.documentId}/export/${eNode.id}/download`;
                        const token = localStorage.getItem("auth_token");
                        const res = await fetch(url, {
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                        });
                        if (!res.ok) return;
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = blobUrl;
                        link.download = (exportData()?.filename as string) || "export";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(blobUrl);
                      }

                      function copyFullText() {
                        const text = selectedContent();
                        if (!text) return;
                        navigator.clipboard.writeText(text).then(() => {
                          setCopiedFullText(true);
                          setTimeout(() => setCopiedFullText(false), 2000);
                        });
                      }

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
                              <Show when={exportData()?.format}>
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
                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                  导出格式{" "}
                                  {FORMAT_LABELS[exportData()?.format as string] ??
                                    (exportData()?.format as string)?.toUpperCase() ??
                                    ""}
                                </div>
                              </Show>
                            </div>

                            {/* Divider */}
                            <div class="h-px bg-[rgba(199,196,216,0.2)] mb-6" />

                            {/* Export file card */}
                            <Show when={exportData()}>
                              <div class="bg-[#f7f9fb] p-5 rounded-xl flex items-center justify-between">
                                <div class="flex items-center gap-4">
                                  <div
                                    class="w-12 h-12 rounded-lg bg-[#4f46e5] flex items-center justify-center text-white font-black text-xl flex-shrink-0"
                                    style={{ "box-shadow": "0 4px 12px rgba(79,70,229,0.2)" }}
                                  >
                                    {FORMAT_ICONS[(exportData()?.format as string) ?? "markdown"] ??
                                      "F"}
                                  </div>
                                  <div>
                                    <h4 class="font-bold text-[#191c1e]">
                                      {exportData()?.filename as string}
                                    </h4>
                                    <p class="text-xs text-[#464555]">
                                      {FORMAT_LABELS[(exportData()?.format as string) ?? ""] ?? ""}{" "}
                                      · {formatFileSize((exportData()?.fileSize as number) ?? 0)}
                                    </p>
                                  </div>
                                </div>
                                <div class="flex items-center gap-3">
                                  <button
                                    type="button"
                                    class="bg-[#e0e3e5] px-5 py-2.5 rounded-lg text-sm font-bold text-[#464555] hover:bg-[#d8dadc] transition-colors"
                                    onClick={copyFullText}
                                  >
                                    {copiedFullText() ? "已复制" : "复制全文"}
                                  </button>
                                  <button
                                    type="button"
                                    class="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all flex items-center gap-2"
                                    style={{
                                      background:
                                        "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)",
                                      "box-shadow": "0 4px 12px rgba(79,70,229,0.2)",
                                    }}
                                    onClick={triggerDownload}
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
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                      />
                                    </svg>
                                    下载文件
                                  </button>
                                </div>
                              </div>
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
