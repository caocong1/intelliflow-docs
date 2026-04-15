import type {
  DocumentRuntimeState,
  ModelCallConfig,
  ModelCallLiveEvent,
  ModelCallManualFeedback,
  ModelCallNamedOutputValue,
  ModelCallOutputData,
  ModelOutput,
  NamedOutputDef,
  NodeExecution,
} from "@intelliflow/shared";
import { For, Index, Match, Show, Switch, createEffect, createSignal, onCleanup } from "solid-js";
import { renderMarkdown } from "../../../lib/render-markdown";
import { streamSSE } from "../../../lib/sse-stream";
import ModelCompareView from "./ModelCompareView";
import NamedOutputCard from "./NamedOutputCard";

interface Props {
  nodeExecution: NodeExecution;
  config: ModelCallConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  readOnly: boolean;
  backgroundMode?: boolean;
  registerConfirmAction?: (action: (() => Promise<boolean>) | null) => void;
}

type ExecutionPhase = "idle" | "streaming" | "polling" | "done";

type ViewMode = "markdown" | "source";

type ModelCallNamedOutput = ModelCallNamedOutputValue;

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  streaming: "生成中",
  completed: "已完成",
  failed: "失败",
  format_error: "格式错误",
};

const ERROR_MESSAGES: Record<string, string> = {
  timeout: "网络超时，请重试",
  api_error: "API 调用失败",
  unavailable: "模型不可用",
};

function cloneModelOutputs(models: Record<string, ModelOutput>): Record<string, ModelOutput> {
  return Object.fromEntries(
    Object.entries(models).map(([modelId, model]) => [modelId, { ...model }]),
  );
}

function stringArraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function modelOutputEquals(a: ModelOutput, b: ModelOutput): boolean {
  return (
    a.modelId === b.modelId &&
    a.modelDisplayName === b.modelDisplayName &&
    a.content === b.content &&
    a.status === b.status &&
    a.errorMessage === b.errorMessage &&
    a.tokenCount === b.tokenCount &&
    stringArraysEqual(a.formatErrors, b.formatErrors)
  );
}

/**
 * Merge incoming model outputs into prev, preserving object references for
 * models whose fields are unchanged. This is critical for keeping SolidJS
 * `<For>` reconciliation stable during live polling / SSE snapshot refreshes:
 * without it, every poll tick replaces every model reference, which tears down
 * and re-creates all tab buttons and content containers — breaking mid-click
 * tab switches and causing visible UI flicker.
 *
 * Returns the prev reference untouched when nothing changed, so signal
 * subscribers are not notified.
 */
export function mergeModelOutputs(
  prev: Record<string, ModelOutput>,
  incoming: Record<string, ModelOutput>,
): Record<string, ModelOutput> {
  const incomingKeys = Object.keys(incoming);
  const prevKeys = Object.keys(prev);

  let structureChanged = incomingKeys.length !== prevKeys.length;
  if (!structureChanged) {
    for (const key of incomingKeys) {
      if (!(key in prev)) {
        structureChanged = true;
        break;
      }
    }
  }

  let anyChanged = structureChanged;
  const next: Record<string, ModelOutput> = {};

  for (const key of incomingKeys) {
    const prevModel = prev[key];
    const incomingModel = incoming[key];

    if (prevModel && modelOutputEquals(prevModel, incomingModel)) {
      // Unchanged — reuse previous reference so <For> keeps the same DOM node
      next[key] = prevModel;
    } else {
      next[key] = { ...incomingModel };
      anyChanged = true;
    }
  }

  return anyChanged ? next : prev;
}

function normalizeModelOutputsForReview(
  outputData: Record<string, unknown> | null,
  models: Record<string, ModelOutput>,
): Record<string, ModelOutput> {
  if (!outputData) return cloneModelOutputs(models);

  const hasFinalOutput =
    typeof outputData.selectedContent === "string" || typeof outputData.text === "string";
  if (!hasFinalOutput) return cloneModelOutputs(models);

  return Object.fromEntries(
    Object.entries(models).map(([modelId, model]) => {
      if (model.status === "pending" || model.status === "streaming") {
        return [
          modelId,
          {
            ...model,
            status: "completed" as const,
            errorMessage: undefined,
          },
        ];
      }

      return [modelId, { ...model }];
    }),
  );
}

function getSelectedModelIdsFromOutputData(
  outputData: Record<string, unknown> | null,
  fallbackSelectedKey?: string | null,
): string[] {
  const selectedModelIds = outputData?.selectedModelIds;
  if (Array.isArray(selectedModelIds)) {
    return selectedModelIds.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  }

  if (fallbackSelectedKey) {
    return [fallbackSelectedKey];
  }

  return [];
}

function getManualFeedback(
  outputData: Record<string, unknown> | null,
): ModelCallManualFeedback | null {
  const raw = outputData?.manualFeedback;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const feedback = raw as Record<string, unknown>;
  return {
    content: typeof feedback.content === "string" ? feedback.content : "",
    updatedAt: typeof feedback.updatedAt === "string" ? feedback.updatedAt : null,
    appliedAt: typeof feedback.appliedAt === "string" ? feedback.appliedAt : null,
  };
}

function hasPendingManualFeedback(outputData: Record<string, unknown> | null): boolean {
  const feedback = getManualFeedback(outputData);
  if (!feedback?.content.trim()) return false;
  if (!feedback.updatedAt) return true;
  return feedback.appliedAt !== feedback.updatedAt;
}

export function hasInProgressModelOutputs(models: Record<string, ModelOutput>): boolean {
  return Object.values(models).some(
    (model) => model.status === "pending" || model.status === "streaming",
  );
}

export function deriveModelCallExecutionPhase(params: {
  models: Record<string, ModelOutput>;
  nodeStatus: NodeExecution["status"];
  backgroundMode?: boolean;
}): ExecutionPhase {
  const entries = Object.values(params.models);

  if (entries.length === 0) {
    return params.backgroundMode && params.nodeStatus === "in_progress" ? "polling" : "idle";
  }

  if (hasInProgressModelOutputs(params.models)) {
    return "polling";
  }

  return "done";
}

export function applyModelCallStreamEvent(
  prev: Record<string, ModelOutput>,
  event: ModelCallLiveEvent,
  modelNames?: Record<string, string>,
): Record<string, ModelOutput> {
  if (event.type === "snapshot") {
    return mergeModelOutputs(prev, event.data.models);
  }

  const current = { ...prev };
  const existing = current[event.modelId] ?? {
    modelId: event.modelId,
    modelDisplayName: modelNames?.[event.modelId] ?? event.modelId,
    content: "",
    status: "pending" as const,
  };

  switch (event.type) {
    case "status":
      current[event.modelId] = { ...existing, status: "streaming" };
      break;
    case "delta":
      current[event.modelId] = {
        ...existing,
        content: existing.content + event.data,
        status: "streaming",
      };
      break;
    case "complete":
      current[event.modelId] = {
        ...existing,
        content: event.data,
        status: "completed",
      };
      break;
    case "error":
      current[event.modelId] = {
        ...existing,
        status: "failed",
        errorMessage: event.data,
      };
      break;
  }

  return current;
}

// RECV-03: Cancel AI generation deferred to v2 per user decision

export default function ModelCallExecutor(props: Props) {
  // ─── Existing output detection ──────────────────────────────────────────────

  const [localOutputData, setLocalOutputData] = createSignal<Record<string, unknown> | null>(
    (props.nodeExecution.outputData as Record<string, unknown> | null) ?? null,
  );
  const currentOutputData = () => localOutputData();

  const existingModels = (): Record<string, ModelOutput> => {
    const od = currentOutputData();
    const models = (od?.models as Record<string, ModelOutput>) ?? {};
    return normalizeModelOutputsForReview(od, models);
  };

  const hasExistingOutput = () => Object.keys(existingModels()).length > 0;
  const isMultiModel = () => {
    const ids = props.config.modelIds ?? [];
    return ids.length > 1;
  };
  const hasConfiguredModels = () => {
    const ids = props.config.modelIds ?? [];
    return ids.length > 0;
  };

  // ─── Determine initial phase from existing outputData ────────────────────────
  // NEVER re-trigger model call if models already exist in outputData

  function computeInitialPhase(): ExecutionPhase {
    return deriveModelCallExecutionPhase({
      models: existingModels(),
      nodeStatus: props.nodeExecution.status,
      backgroundMode: props.backgroundMode,
    });
  }

  const [phase, setPhase] = createSignal<ExecutionPhase>(computeInitialPhase());
  const [modelOutputs, setModelOutputs] = createSignal<Record<string, ModelOutput>>(
    existingModels(),
  );
  const [activeTab, setActiveTab] = createSignal<string>("");
  const [showCompare, setShowCompare] = createSignal(false);
  const [selectedModelIds, setSelectedModelIds] = createSignal<string[]>(
    getSelectedModelIdsFromOutputData(currentOutputData(), props.nodeExecution.selectedOutputKey),
  );
  const [selectedModelId, setSelectedModelId] = createSignal<string>(
    getSelectedModelIdsFromOutputData(
      currentOutputData(),
      props.nodeExecution.selectedOutputKey,
    )[0] ??
      props.nodeExecution.selectedOutputKey ??
      "",
  );
  const [error, setError] = createSignal<string | null>(null);
  const [selectLoading, setSelectLoading] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>("markdown");
  const [manualFeedbackRegenerating, setManualFeedbackRegenerating] = createSignal(false);

  // ─── Format error + AI fix state ──────────────────────────────────────────
  const [editedContent, setEditedContent] = createSignal<Record<string, string>>({});
  const [revalidating, setRevalidating] = createSignal<string | null>(null);
  const [aiFixModelId, setAiFixModelId] = createSignal<string | null>(null);
  const [aiFixStreaming, setAiFixStreaming] = createSignal(false);
  const [aiFixContent, setAiFixContent] = createSignal("");
  let aiFixAbort: AbortController | null = null;

  // ─── Named outputs from outputData ────────────────────────────────────────
  const namedOutputs = () => {
    const od = currentOutputData() as ModelCallOutputData | null;
    return (od?.namedOutputs as Record<string, ModelCallNamedOutput>) ?? null;
  };

  const namedOutputsByModel = () => {
    const od = currentOutputData() as ModelCallOutputData | null;
    return (od?.namedOutputsByModel as Record<string, Record<string, ModelCallNamedOutput>>) ?? {};
  };

  const fallbackWarning = () => {
    const od = currentOutputData() as ModelCallOutputData | null;
    return (od?.fallbackWarning as boolean) ?? false;
  };

  const manualFeedback = () => getManualFeedback(currentOutputData());
  const manualFeedbackContent = () => manualFeedback()?.content ?? "";
  const manualFeedbackPending = () => hasPendingManualFeedback(currentOutputData());

  const hasNamedOutputs = () => {
    return (
      Object.keys(namedOutputs() ?? {}).length > 0 || Object.keys(namedOutputsByModel()).length > 0
    );
  };

  const namedOutputDefs = (): NamedOutputDef[] => {
    return props.config.namedOutputs ?? [];
  };

  const selectionEnabled = () => props.config.enableUserSelectionOutput ?? false;

  let abortController: AbortController | null = null;
  let liveAbortController: AbortController | null = null;
  let liveReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let singleModelScroller: HTMLDivElement | undefined;
  let activeTabScroller: HTMLDivElement | undefined;
  const [liveSubscribed, setLiveSubscribed] = createSignal(false);

  onCleanup(() => {
    props.registerConfirmAction?.(null);
    abortController?.abort();
    liveAbortController?.abort();
    if (liveReconnectTimer) clearTimeout(liveReconnectTimer);
    if (pollTimer) clearInterval(pollTimer);
  });

  // ─── SSE Reconnect Safety: Poll /status instead of re-triggering ────────────

  function stopStatusPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startStatusPolling() {
    stopStatusPolling();

    pollTimer = setInterval(async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(
          `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/status`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );

        if (!res.ok) return;

        const data = (await res.json()) as { models: Record<string, ModelOutput> };
        setModelOutputs((prev) => mergeModelOutputs(prev, data.models));

        // Check if all models are done (empty = still waiting for backend to write)
        const modelEntries = Object.values(data.models);
        const allDone =
          modelEntries.length > 0 &&
          modelEntries.every(
            (m) => m.status === "completed" || m.status === "failed" || m.status === "format_error",
          );
        if (allDone) {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          setPhase("done");
        }
      } catch {
        // Polling errors are non-fatal, will retry on next interval
      }
    }, 3000);
  }

  function syncActiveTab(
    models: Record<string, ModelOutput>,
    preferredModelId?: string | null,
    force?: boolean,
  ) {
    const keys = Object.keys(models);
    if (keys.length === 0) return;
    // Only override user selection when explicitly forced (e.g. snapshot with selectedModelId)
    // or when current tab is invalid
    if (force && preferredModelId && models[preferredModelId]) {
      setActiveTab(preferredModelId);
      return;
    }
    if (!activeTab() || !models[activeTab()]) {
      // Try preferredModelId as fallback before defaulting to first
      if (preferredModelId && models[preferredModelId]) {
        setActiveTab(preferredModelId);
      } else {
        setActiveTab(keys[0]);
      }
    }
  }

  function applyLiveEvent(event: ModelCallLiveEvent) {
    setModelOutputs((prev) => applyModelCallStreamEvent(prev, event, props.config.modelNames));

    if (event.type === "snapshot") {
      const nextSelectedIds =
        event.data.selectedModelIds && event.data.selectedModelIds.length > 0
          ? event.data.selectedModelIds
          : event.data.selectedModelId
            ? [event.data.selectedModelId]
            : [];
      setSelectedModelIds(nextSelectedIds);
      setSelectedModelId(nextSelectedIds[0] ?? event.data.selectedModelId ?? "");
      // Only force-switch tab on snapshot if no active tab is set yet
      syncActiveTab(event.data.models, event.data.selectedModelId, !activeTab());
      setPhase(event.data.done ? "done" : "streaming");
      return;
    }

    if (!activeTab() || !modelOutputs()[activeTab()]) {
      setActiveTab(event.modelId);
    }

    if (event.type === "status" || event.type === "delta") {
      setPhase("streaming");
    }
  }

  function clearLiveReconnectTimer() {
    if (liveReconnectTimer) {
      clearTimeout(liveReconnectTimer);
      liveReconnectTimer = null;
    }
  }

  function shouldUseLiveStream() {
    const outputs = modelOutputs();
    return (
      Boolean(props.backgroundMode) &&
      Object.keys(outputs).length > 0 &&
      hasInProgressModelOutputs(outputs)
    );
  }

  function scheduleLiveReconnect() {
    clearLiveReconnectTimer();
    liveReconnectTimer = setTimeout(() => {
      liveReconnectTimer = null;
      if (shouldUseLiveStream() && !liveAbortController) {
        void startLiveStream();
      }
    }, 1000);
  }

  async function startLiveStream() {
    if (liveAbortController || !shouldUseLiveStream()) return;

    clearLiveReconnectTimer();
    stopStatusPolling();
    setLiveSubscribed(true);

    const controller = new AbortController();
    liveAbortController = controller;

    try {
      await streamSSE({
        url: `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/stream`,
        onSnapshot: (snapshot) => {
          applyLiveEvent({ type: "snapshot", data: snapshot });
        },
        onStatus: (modelId, data) => {
          applyLiveEvent({
            type: "status",
            modelId,
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onDelta: (modelId, data) => {
          applyLiveEvent({
            type: "delta",
            modelId,
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onComplete: (modelId, data) => {
          applyLiveEvent({
            type: "complete",
            modelId,
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onError: (modelId, data) => {
          applyLiveEvent({
            type: "error",
            modelId,
            data,
            timestamp: new Date().toISOString(),
          });
        },
        signal: controller.signal,
      });
    } catch {
      // Fall back to polling + reconnect; background live stream errors should not hard-fail the UI.
    } finally {
      if (liveAbortController === controller) {
        liveAbortController = null;
      }
      setLiveSubscribed(false);

      if (!controller.signal.aborted && shouldUseLiveStream()) {
        setPhase("polling");
        scheduleLiveReconnect();
      }
    }
  }

  // Start polling only when live stream is not available.
  createEffect(() => {
    if (phase() === "polling" && !liveSubscribed()) {
      startStatusPolling();
    } else {
      stopStatusPolling();
    }
  });

  createEffect(() => {
    const nextOutputData =
      (props.nodeExecution.outputData as Record<string, unknown> | null) ?? null;
    setLocalOutputData(nextOutputData);
  });

  createEffect(() => {
    props.registerConfirmAction?.(async () => {
      if (selectionEnabled() && selectedModelIds().length === 0) {
        setError("请至少选择一个模型输出后再继续。");
        return false;
      }

      if (manualFeedbackPending()) {
        setError("已填写人工意见，请先按意见重生成当前节点后再继续。");
        return false;
      }

      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(
          `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/validate-selection`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        );

        if (res.ok) {
          setError(null);
          return true;
        }

        const data = (await res.json()) as { error?: string; errors?: string[] };
        setError(data.errors?.join("\n") ?? data.error ?? "当前输出校验失败，请检查后再继续。");
        return false;
      } catch {
        setError("当前输出校验失败，请检查网络后重试。");
        return false;
      }
    });
  });

  createEffect(() => {
    if (liveSubscribed()) return;

    const incomingModels = existingModels();
    if (Object.keys(incomingModels).length === 0) return;

    setModelOutputs((prev) => mergeModelOutputs(prev, incomingModels));
    // Don't override user's active tab selection — only sync if current tab is invalid
    syncActiveTab(incomingModels, props.nodeExecution.selectedOutputKey);
    const nextSelectedIds = getSelectedModelIdsFromOutputData(
      currentOutputData(),
      props.nodeExecution.selectedOutputKey,
    );
    setSelectedModelIds(nextSelectedIds);
    setSelectedModelId(nextSelectedIds[0] ?? props.nodeExecution.selectedOutputKey ?? "");
    setPhase(
      deriveModelCallExecutionPhase({
        models: incomingModels,
        nodeStatus: props.nodeExecution.status,
        backgroundMode: props.backgroundMode,
      }),
    );
  });

  createEffect(() => {
    if (shouldUseLiveStream()) {
      void startLiveStream();
      return;
    }

    clearLiveReconnectTimer();
    if (liveAbortController) {
      liveAbortController.abort();
      liveAbortController = null;
    }
    setLiveSubscribed(false);
  });

  // Set initial active tab
  createEffect(() => {
    if (!activeTab()) {
      syncActiveTab(modelOutputs(), selectedModelId());
    }
  });

  createEffect(() => {
    const activeModel = isMultiModel() ? modelOutputs()[activeTab()] : modelList()[0];
    const scroller = isMultiModel() ? activeTabScroller : singleModelScroller;

    if (!activeModel || !scroller) return;
    if (activeModel.status !== "streaming" && activeModel.status !== "pending") return;

    const contentKey = `${activeModel.modelId}:${activeModel.content.length}:${activeModel.status}:${viewMode()}`;
    void contentKey;

    requestAnimationFrame(() => {
      if (!scroller) return;
      scroller.scrollTop = scroller.scrollHeight;
    });
  });

  // ─── SSE Streaming ─────────────────────────────────────────────────────────

  async function refreshCurrentNodeOutputData() {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/runtime/${props.documentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return;

      const runtime = (await res.json()) as DocumentRuntimeState;
      const refreshedNode = runtime.nodes.find((node) => node.id === props.nodeExecution.id);
      if (!refreshedNode) return;

      const nextOutputData =
        (refreshedNode.outputData as Record<string, unknown> | null) ?? currentOutputData();
      setLocalOutputData(nextOutputData);

      const nextSelectedIds = getSelectedModelIdsFromOutputData(
        nextOutputData,
        refreshedNode.selectedOutputKey,
      );
      setSelectedModelIds(nextSelectedIds);
      setSelectedModelId(nextSelectedIds[0] ?? refreshedNode.selectedOutputKey ?? "");
    } catch {
      // Ignore runtime refresh failures; streaming output is still visible locally.
    }
  }

  async function startStreaming(options: {
    url: string;
    method?: "GET" | "POST";
    body?: unknown;
  }) {
    abortController?.abort();
    abortController = new AbortController();

    try {
      await streamSSE({
        url: options.url,
        method: options.method,
        body: options.body,
        onStatus: (modelId, data) => {
          applyLiveEvent({
            type: "status",
            modelId,
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onDelta: (modelId, data) => {
          applyLiveEvent({
            type: "delta",
            modelId,
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onComplete: (modelId, data) => {
          applyLiveEvent({
            type: "complete",
            modelId,
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onError: (modelId, data) => {
          applyLiveEvent({
            type: "error",
            modelId,
            data,
            timestamp: new Date().toISOString(),
          });
        },
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      setError(localizeError(message));
    }

    setPhase("done");
    await refreshCurrentNodeOutputData();
  }

  // ─── Error localization ─────────────────────────────────────────────────────

  function localizeError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return ERROR_MESSAGES.timeout;
    }
    if (lower.includes("unavailable") || lower.includes("not found")) {
      return ERROR_MESSAGES.unavailable;
    }
    if (lower.includes("api") || lower.includes("http")) {
      return `${ERROR_MESSAGES.api_error}: ${message}`;
    }
    return message;
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  function handleManualFeedbackChange(content: string) {
    const od = (currentOutputData() as ModelCallOutputData | null) ?? {};
    const previousFeedback = getManualFeedback(currentOutputData());
    const nextManualFeedback: ModelCallManualFeedback =
      previousFeedback?.content === content
        ? previousFeedback
        : {
            content,
            updatedAt: new Date().toISOString(),
            appliedAt: null,
          };

    const nextOutputData: ModelCallOutputData = {
      ...od,
      manualFeedback: nextManualFeedback,
      outputItems: {
        ...(od.outputItems ?? {}),
        manual_feedback: {
          content,
          format: "text",
          kind: "manual_feedback",
        },
      },
    };

    setLocalOutputData(nextOutputData);
    props.onDraftSave(nextOutputData);
  }

  async function handleRegenerateWithFeedback() {
    const feedback = manualFeedbackContent();
    if (!feedback.trim()) {
      setError("请先填写人工意见，再按意见重生成。");
      return;
    }

    setManualFeedbackRegenerating(true);
    setError(null);
    setPhase("streaming");
    setModelOutputs({});

    try {
      await startStreaming({
        url: `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/regenerate`,
        method: "POST",
        body: { manualFeedback: feedback },
      });
    } finally {
      setManualFeedbackRegenerating(false);
    }
  }

  function handleStartGeneration() {
    // NEVER call execute if models already exist or backend is already running
    if (hasExistingOutput()) return;
    if (
      props.backgroundMode &&
      props.nodeExecution.status === "in_progress" &&
      phase() === "polling"
    )
      return;

    setPhase("streaming");
    setError(null);
    setModelOutputs({});
    const url = `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/execute`;
    void startStreaming({ url });
  }

  function handleRetry(modelId: string) {
    setError(null);
    setPhase("streaming");
    // Reset this model to streaming
    setModelOutputs((prev) => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        content: "",
        status: "streaming" as const,
        errorMessage: undefined,
      },
    }));

    const url = `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/retry/${modelId}`;
    void startStreaming({ url });
  }

  async function handleSelect(modelId: string) {
    const nextSelectedIds = selectionEnabled()
      ? selectedModelIds().includes(modelId)
        ? selectedModelIds().filter((id) => id !== modelId)
        : [...selectedModelIds(), modelId]
      : [modelId];

    setSelectLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/select`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            selectedModelId: nextSelectedIds[0],
            selectedModelIds: nextSelectedIds,
          }),
        },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          outputData?: Record<string, unknown>;
          selectedOutputKey?: string | null;
        };
        setSelectedModelIds(nextSelectedIds);
        setSelectedModelId(data.selectedOutputKey ?? nextSelectedIds[0] ?? "");
        if (data.outputData) {
          setLocalOutputData(data.outputData);
          props.onDraftSave(data.outputData);
        }
        setError(null);
      }
    } catch {
      setError("保存所选输出失败，请重试。");
    } finally {
      setSelectLoading(false);
    }
  }

  // ─── Format error: Revalidate & AI Fix ──────────────────────────────────

  async function handleRevalidate(modelId: string) {
    setRevalidating(modelId);
    try {
      const token = localStorage.getItem("auth_token");
      const content = editedContent()[modelId] ?? modelOutputs()[modelId]?.content ?? "";
      const res = await fetch(
        `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/models/${modelId}/revalidate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { status: string; errors?: string[] };
        setModelOutputs((prev) => ({
          ...prev,
          [modelId]: {
            ...prev[modelId],
            content,
            status: data.status as ModelOutput["status"],
            formatErrors: data.errors,
          },
        }));
        if (data.status === "completed") {
          // Clear edited content on success
          setEditedContent((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setRevalidating(null);
    }
  }

  async function handleAiFix(modelId: string) {
    setAiFixModelId(modelId);
    setAiFixStreaming(true);
    setAiFixContent("");

    const controller = new AbortController();
    aiFixAbort = controller;

    try {
      await streamSSE({
        url: `/api/runtime/${props.documentId}/model-call/${props.nodeExecution.id}/models/${modelId}/ai-fix`,
        method: "POST",
        onDelta: (_mid, data) => {
          setAiFixContent((prev) => prev + data);
        },
        onComplete: (_mid, data) => {
          setAiFixContent(data);
          setAiFixStreaming(false);
        },
        onError: (_mid, _data) => {
          setAiFixStreaming(false);
          setAiFixModelId(null);
        },
        signal: controller.signal,
      });
    } catch {
      setAiFixStreaming(false);
      setAiFixModelId(null);
    }
  }

  function handleAdoptFix(modelId: string) {
    const fixed = aiFixContent();
    setEditedContent((prev) => ({ ...prev, [modelId]: fixed }));
    setAiFixModelId(null);
    setAiFixContent("");
    // Auto-revalidate with fixed content
    handleRevalidate(modelId);
  }

  function handleCancelFix() {
    aiFixAbort?.abort();
    aiFixAbort = null;
    setAiFixModelId(null);
    setAiFixStreaming(false);
    setAiFixContent("");
  }

  function handleNamedOutputChange(artifactId: string, newContent: string) {
    // Update outputData namedOutputs via draft save
    const od = currentOutputData();
    const currentNamedOutputs = (od?.namedOutputs as Record<string, ModelCallNamedOutput>) ?? {};
    const currentOutputItems = (od?.outputItems as Record<string, Record<string, unknown>>) ?? {};
    const updated = {
      ...currentNamedOutputs,
      [artifactId]: { ...currentNamedOutputs[artifactId], content: newContent },
    };
    const selectedArtifactKey = `selected__artifact__${artifactId}`;
    const updatedOutputItems = currentOutputItems[selectedArtifactKey]
      ? {
          ...currentOutputItems,
          [selectedArtifactKey]: {
            ...currentOutputItems[selectedArtifactKey],
            content: newContent,
          },
        }
      : currentOutputItems;
    const nextOutputData = {
      ...od,
      namedOutputs: updated,
      outputItems: updatedOutputItems,
    };
    setLocalOutputData(nextOutputData);
    props.onDraftSave(nextOutputData);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function modelList(): ModelOutput[] {
    return Object.values(modelOutputs());
  }

  function allCompleted(): boolean {
    const outputs = modelList();
    return (
      outputs.length > 0 &&
      outputs.every(
        (m) => m.status === "completed" || m.status === "failed" || m.status === "format_error",
      )
    );
  }

  function hasAnyCompleted(): boolean {
    return modelList().some((m) => m.status === "completed");
  }

  function isModelSelected(modelId: string): boolean {
    return selectedModelIds().includes(modelId);
  }

  function statusBadge(status: ModelOutput["status"]) {
    const label = STATUS_LABELS[status] ?? status;
    switch (status) {
      case "pending":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f7f9fb] text-[#464555] ring-1 ring-[rgba(199,196,216,0.4)]">
            <span class="w-1.5 h-1.5 rounded-full bg-[#c7c4d8]" />
            {label}
          </span>
        );
      case "streaming":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            {label}
          </span>
        );
      case "completed":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <svg
              class="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {label}
          </span>
        );
      case "failed":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500 ring-1 ring-red-200">
            <svg
              class="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {label}
          </span>
        );
      case "format_error":
        return (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 ring-1 ring-orange-200">
            <svg
              class="w-3 h-3"
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
            {label}
          </span>
        );
    }
  }

  // ─── Format error rendering helper ───────────────────────────────────────

  function renderFormatError(model: ModelOutput) {
    const mid = model.modelId;
    const currentContent = () => editedContent()[mid] ?? model.content;

    return (
      <div class="space-y-3">
        {/* Error box */}
        <div class="border border-red-300 bg-red-50 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <svg
              class="w-4 h-4 text-red-500 flex-shrink-0"
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
            <span class="text-sm font-medium text-red-700">JSON 格式验证失败</span>
          </div>
          <Show when={model.formatErrors && model.formatErrors.length > 0}>
            <ul class="list-disc list-inside space-y-1">
              <For each={model.formatErrors}>
                {(err) => <li class="text-xs text-red-600">{err}</li>}
              </For>
            </ul>
          </Show>
        </div>

        {/* Editable textarea */}
        <div class="border border-red-200 rounded-xl overflow-hidden">
          <textarea
            value={currentContent()}
            onInput={(e) => setEditedContent((prev) => ({ ...prev, [mid]: e.currentTarget.value }))}
            class="w-full min-h-[200px] max-h-[500px] p-4 text-sm font-mono text-[#191c1e] bg-[#fffbfb] border-0 focus:outline-none focus:ring-0 resize-y"
          />
        </div>

        {/* Action buttons */}
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            onClick={() => handleRevalidate(mid)}
            disabled={revalidating() === mid}
          >
            {revalidating() === mid ? "验证中..." : "重新验证"}
          </button>
          <button
            type="button"
            class="px-4 py-2 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
            onClick={() => handleAiFix(mid)}
            disabled={aiFixModelId() !== null}
          >
            AI 修复
          </button>
        </div>

        {/* AI Fix streaming preview */}
        <Show when={aiFixModelId() === mid}>
          <div class="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
            <div class="flex items-center gap-2">
              <Show when={aiFixStreaming()}>
                <span class="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              </Show>
              <span class="text-sm font-medium text-blue-700">
                {aiFixStreaming() ? "AI 修复中..." : "修复完成"}
              </span>
            </div>
            <pre class="text-sm font-mono text-[#191c1e] whitespace-pre-wrap bg-white rounded-lg p-3 max-h-[300px] overflow-y-auto border border-blue-100">
              {aiFixContent() || "..."}
            </pre>
            <Show when={!aiFixStreaming()}>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                  onClick={() => handleAdoptFix(mid)}
                >
                  采用修复
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-medium text-[#464555] border border-[rgba(199,196,216,0.3)] rounded-lg hover:bg-[#f7f9fb] transition-colors"
                  onClick={handleCancelFix}
                >
                  取消
                </button>
              </div>
            </Show>
            <Show when={aiFixStreaming()}>
              <button
                type="button"
                class="px-4 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                onClick={handleCancelFix}
              >
                取消修复
              </button>
            </Show>
          </div>
        </Show>
      </div>
    );
  }

  // renderMarkdown is imported from lib/render-markdown.tsx

  // ─── Read-only mode ──────────────────────────────────────────────────────

  if (props.readOnly) {
    const selected = selectedModelId();
    const output = existingModels()[selected];
    const content =
      output?.content ??
      ((currentOutputData() as Record<string, unknown> | null)?.selectedContent as string) ??
      "";

    return (
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-[#191c1e]">模型输出</h3>
          <Show when={output}>
            <span class="text-xs text-[#464555]">({output?.modelDisplayName})</span>
          </Show>
        </div>
        <div class="bg-[#f7f9fb] rounded-xl p-4">{renderMarkdown(content)}</div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-r from-[#f2f4f6] to-white px-6 py-5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#e2dfff] flex items-center justify-center flex-shrink-0">
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
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[#191c1e]">
              {props.config.displayName ?? "模型调用"}
            </h3>
            <p class="text-xs text-[#464555] mt-0.5">
              {isMultiModel() ? "多模型对比模式" : "单模型模式"}
            </p>
          </div>
        </div>

        {/* View toggle (Markdown / source) */}
        <Show when={phase() !== "idle" && modelList().length > 0}>
          <div class="flex items-center gap-1 bg-[#eceef0] rounded-lg p-0.5">
            <button
              type="button"
              class={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode() === "markdown"
                  ? "bg-white text-[#191c1e] shadow-sm"
                  : "text-[#464555] hover:text-[#191c1e]"
              }`}
              onClick={() => setViewMode("markdown")}
            >
              Markdown 视图
            </button>
            <button
              type="button"
              class={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode() === "source"
                  ? "bg-white text-[#191c1e] shadow-sm"
                  : "text-[#464555] hover:text-[#191c1e]"
              }`}
              onClick={() => setViewMode("source")}
            >
              源码视图
            </button>
          </div>
        </Show>
      </div>

      <div class="px-6 py-5 space-y-4">
        {/* Error */}
        <Show when={error()}>
          <div class="bg-[#fef2f2] text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            {error()}
          </div>
        </Show>

        {/* No models configured */}
        <Show when={!hasConfiguredModels()}>
          <div class="bg-[#fffbeb] rounded-xl p-6 text-center">
            <div class="text-amber-600 text-sm font-medium">未配置模型</div>
            <p class="text-xs text-amber-500 mt-1">请在工作流编辑器中为此节点配置模型</p>
          </div>
        </Show>

        {/* Idle — start button */}
        <Show when={phase() === "idle" && hasConfiguredModels()}>
          <div class="flex flex-col items-center gap-4 py-6">
            <div class="w-16 h-16 rounded-2xl bg-[#f7f9fb] flex items-center justify-center">
              <svg
                class="w-8 h-8 text-[#464555]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                />
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-medium text-[#191c1e]">尚未开始生成</p>
              <p class="text-xs text-[#464555] mt-1">
                {isMultiModel()
                  ? `将并行调用 ${props.config.modelIds.length} 个模型`
                  : "点击下方按钮开始调用模型"}
              </p>
            </div>
            <button
              type="button"
              class="px-6 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-br from-[#3525cd] to-[#4f46e5] hover:opacity-90 transition-opacity shadow-sm"
              onClick={handleStartGeneration}
            >
              开始生成
            </button>
          </div>
        </Show>

        {/* Streaming/Polling — waiting for first model response */}
        <Show when={(phase() === "streaming" || phase() === "polling") && modelList().length === 0}>
          <div class="bg-[#f7f9fb] rounded-xl p-4 min-h-[200px] flex items-center justify-center">
            <div class="flex flex-col items-center gap-3">
              <span class="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <span class="text-sm text-[#464555]">
                {phase() === "polling" ? "正在获取生成状态..." : "模型正在准备响应..."}
              </span>
            </div>
          </div>
        </Show>

        {/* Streaming / Polling / Done — model content */}
        <Show when={phase() !== "idle" && modelList().length > 0}>
          <Switch>
            {/* Compare view */}
            <Match when={showCompare() && isMultiModel()}>
              <ModelCompareView
                models={modelOutputs()}
                renderMarkdown={renderMarkdown}
                viewMode={viewMode()}
                onClose={() => setShowCompare(false)}
              />
            </Match>

            {/* Single model mode */}
            <Match when={!isMultiModel()}>
              <Show when={modelList().length > 0}>
                {(() => {
                  const model = () => modelList()[0];
                  return (
                    <div class="space-y-3">
                      <div class="flex items-center gap-2">
                        <h4 class="text-sm font-medium text-[#191c1e]">
                          {model()?.modelDisplayName}
                        </h4>
                        {statusBadge(model()?.status ?? "pending")}
                      </div>

                      <Show when={model()?.status === "failed"}>
                        <div class="bg-[#fef2f2] rounded-xl p-3 flex items-center justify-between">
                          <span class="text-sm text-red-600">
                            {model()?.errorMessage
                              ? localizeError(model()?.errorMessage ?? "")
                              : "生成失败"}
                          </span>
                          <button
                            type="button"
                            class="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                            onClick={() => {
                              const m = model();
                              if (m) handleRetry(m.modelId);
                            }}
                          >
                            重试
                          </button>
                        </div>
                      </Show>

                      {/* format_error display */}
                      <Show when={model()?.status === "format_error" ? model() : undefined}>
                        {(errorModel) => renderFormatError(errorModel())}
                      </Show>

                      {/* Normal content (not format_error) */}
                      <Show when={model()?.status !== "format_error"}>
                        <div
                          ref={singleModelScroller}
                          class="bg-[#f7f9fb] rounded-xl p-4 min-h-[200px] max-h-[500px] overflow-y-auto"
                        >
                          <Show
                            when={model()?.content}
                            fallback={
                              <Show
                                when={
                                  model()?.status === "streaming" || model()?.status === "pending"
                                }
                              >
                                <div class="flex items-center gap-2.5 py-2">
                                  <span class="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin flex-shrink-0" />
                                  <span class="text-sm text-[#464555]">正在生成中...</span>
                                </div>
                              </Show>
                            }
                          >
                            <Show
                              when={viewMode() === "markdown"}
                              fallback={
                                <pre class="text-sm text-[#191c1e] whitespace-pre-wrap font-mono leading-relaxed">
                                  {model()?.content ?? ""}
                                </pre>
                              }
                            >
                              {renderMarkdown(model()?.content ?? "")}
                            </Show>
                            <Show when={model()?.status === "streaming"}>
                              <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                            </Show>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  );
                })()}
              </Show>
            </Match>

            {/* Multi-model tab mode */}
            <Match when={isMultiModel() && !showCompare()}>
              <div class="space-y-3">
                {/* Tab bar — use <Index> so button DOM stays stable across
                    polling/streaming re-renders. <For> would rebuild every
                    button on each content delta (because model refs change),
                    which swallows user clicks mid-render. */}
                <div class="flex items-center gap-1 border-b border-[rgba(199,196,216,0.2)]">
                  <Index each={modelList()}>
                    {(model) => (
                      <button
                        type="button"
                        class={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                          activeTab() === model().modelId
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-[#464555] hover:text-[#191c1e]"
                        }`}
                        onClick={() => setActiveTab(model().modelId)}
                      >
                        <span class="mr-1.5">{model().modelDisplayName}</span>
                        {statusBadge(model().status)}
                      </button>
                    )}
                  </Index>

                  {/* Compare button */}
                  <Show when={modelList().length >= 2}>
                    <button
                      type="button"
                      class="ml-auto px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                      onClick={() => setShowCompare(true)}
                    >
                      多模型对比
                    </button>
                  </Show>
                </div>

                {/* Active tab content */}
                <Show when={modelOutputs()[activeTab()]}>
                  {(model) => (
                    <div class="space-y-3">
                      <Show when={model().status === "failed"}>
                        <div class="bg-[#fef2f2] rounded-xl p-3 flex items-center justify-between">
                          <span class="text-sm text-red-600">
                            {model().errorMessage
                              ? localizeError(model().errorMessage ?? "")
                              : "生成失败"}
                          </span>
                          <button
                            type="button"
                            class="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                            onClick={() => handleRetry(model().modelId)}
                          >
                            重试
                          </button>
                        </div>
                      </Show>

                      {/* format_error display */}
                      <Show when={model().status === "format_error"}>
                        {renderFormatError(model())}
                      </Show>

                      {/* Normal content (not format_error) */}
                      <Show when={model().status !== "format_error"}>
                        <div
                          ref={activeTabScroller}
                          class="bg-[#f7f9fb] rounded-xl p-4 min-h-[200px] max-h-[500px] overflow-y-auto"
                        >
                          <Show
                            when={model().content}
                            fallback={
                              <Show
                                when={
                                  model().status === "streaming" || model().status === "pending"
                                }
                              >
                                <div class="flex items-center gap-2.5 py-2">
                                  <span class="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin flex-shrink-0" />
                                  <span class="text-sm text-[#464555]">正在生成中...</span>
                                </div>
                              </Show>
                            }
                          >
                            <Show
                              when={viewMode() === "markdown"}
                              fallback={
                                <pre class="text-sm text-[#191c1e] whitespace-pre-wrap font-mono leading-relaxed">
                                  {model().content}
                                </pre>
                              }
                            >
                              {renderMarkdown(model().content)}
                            </Show>
                            <Show when={model().status === "streaming"}>
                              <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                            </Show>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  )}
                </Show>
              </div>
            </Match>
          </Switch>

          {/* Fallback warning */}
          <Show when={fallbackWarning() && phase() === "done"}>
            <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg
                class="w-4 h-4 text-amber-500 flex-shrink-0"
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

          <Show when={phase() === "done" && modelList().length > 0}>
            <div class="border border-[rgba(199,196,216,0.35)] rounded-2xl p-4 space-y-3 bg-[#fcfcfe]">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-semibold text-[#191c1e]">人工意见</h4>
                    <Show when={manualFeedbackPending()}>
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        待重生成
                      </span>
                    </Show>
                    <Show when={!manualFeedbackPending() && manualFeedbackContent().trim()}>
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        已应用
                      </span>
                    </Show>
                  </div>
                  <p class="text-xs text-[#6b6a78]">
                    在这里描述你希望模型如何修改当前节点输出。保存后，点击“按意见重生成”让当前
                    节点按最新意见重新生成；未应用的意见不能直接继续。
                  </p>
                </div>
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={manualFeedbackRegenerating() || !manualFeedbackContent().trim()}
                  onClick={() => void handleRegenerateWithFeedback()}
                >
                  {manualFeedbackRegenerating() ? "重生成中..." : "按意见重生成"}
                </button>
              </div>

              <textarea
                value={manualFeedbackContent()}
                onInput={(e) => handleManualFeedbackChange(e.currentTarget.value)}
                placeholder="例如：保留整体结构，但把结论写得更保守；补充风险假设；统一术语；重新生成所有命名产物。"
                class="w-full min-h-[120px] rounded-xl border border-[rgba(199,196,216,0.35)] bg-white px-4 py-3 text-sm text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
              />
            </div>
          </Show>

          {/* Named output cards */}
          <Show when={hasNamedOutputs() && phase() === "done"}>
            <div class="space-y-3">
              <Show when={selectionEnabled() && Object.keys(namedOutputs() ?? {}).length > 0}>
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-semibold text-[#191c1e]">用户选择输出</h4>
                    <span class="text-xs text-[#464555]">
                      已选 {selectedModelIds().length} 个模型
                    </span>
                  </div>
                  <div class="space-y-2">
                    <For each={Object.entries(namedOutputs() ?? {})}>
                      {([artifactId, artifact]) => {
                        const def = namedOutputDefs().find((d) => d.id === artifactId);
                        return (
                          <NamedOutputCard
                            artifactId={artifactId}
                            artifactName={def?.name ?? artifactId}
                            content={artifact.content}
                            format={artifact.format}
                            modelId="selected"
                            onContentChange={handleNamedOutputChange}
                            readonly={props.readOnly}
                          />
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={Object.keys(namedOutputsByModel()).length > 0}>
                <For
                  each={modelList().filter(
                    (m) => m.status === "completed" || m.status === "format_error",
                  )}
                >
                  {(model) => {
                    const modelArtifacts = () => {
                      const artifacts = namedOutputsByModel()[model.modelId];
                      if (!artifacts) return [];
                      return Object.entries(artifacts).filter(
                        ([artifactId]) => artifactId !== "_default",
                      );
                    };

                    return (
                      <Show when={modelArtifacts().length > 0}>
                        <div class="space-y-2">
                          <div class="flex items-center gap-2">
                            <h4 class="text-sm font-semibold text-[#191c1e]">
                              {model.modelDisplayName}
                            </h4>
                            <Show when={selectionEnabled() && isModelSelected(model.modelId)}>
                              <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                                已加入用户选择
                              </span>
                            </Show>
                          </div>
                          <div class="space-y-2">
                            <For each={modelArtifacts()}>
                              {([artifactId, artifact]) => {
                                const def = namedOutputDefs().find((d) => d.id === artifactId);
                                return (
                                  <NamedOutputCard
                                    artifactId={artifactId}
                                    artifactName={def?.name ?? artifactId}
                                    content={artifact.content}
                                    format={artifact.format}
                                    modelId={artifact.modelId ?? model.modelId}
                                    onContentChange={handleNamedOutputChange}
                                    readonly={props.readOnly || isMultiModel()}
                                  />
                                );
                              }}
                            </For>
                          </div>
                        </div>
                      </Show>
                    );
                  }}
                </For>
              </Show>

              <Show
                when={
                  Object.keys(namedOutputsByModel()).length === 0 &&
                  Object.keys(namedOutputs() ?? {}).length > 0
                }
              >
                <For each={Object.entries(namedOutputs() ?? {})}>
                  {([artifactId, artifact]) => {
                    const def = namedOutputDefs().find((d) => d.id === artifactId);
                    return (
                      <NamedOutputCard
                        artifactId={artifactId}
                        artifactName={def?.name ?? artifactId}
                        content={artifact.content}
                        format={artifact.format}
                        modelId={artifact.modelId ?? "selected"}
                        onContentChange={handleNamedOutputChange}
                        readonly={props.readOnly}
                      />
                    );
                  }}
                </For>
              </Show>
            </div>
          </Show>

          {/* Output selection — only when user-selection output is enabled */}
          <Show when={selectionEnabled() && hasAnyCompleted() && !showCompare()}>
            <div class="bg-[#f7f9fb] rounded-xl px-5 py-4 space-y-3">
              <p class="text-xs font-semibold text-[#464555] uppercase tracking-wide">选择输出</p>
              <p class="text-xs text-[#6b6a78]">
                选择一个或多个模型结果，系统会生成对应的“用户选择输出”供下游节点引用。
              </p>
              <div class="space-y-2">
                <For each={modelList().filter((m) => m.status === "completed")}>
                  {(model) => (
                    <div
                      class={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        isModelSelected(model.modelId)
                          ? "bg-[#e2dfff] border border-[rgba(79,70,229,0.3)]"
                          : "bg-white border border-[rgba(199,196,216,0.15)] hover:bg-[#f7f9fb]"
                      }`}
                    >
                      <div
                        class={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isModelSelected(model.modelId)
                            ? "border-indigo-500 bg-indigo-500"
                            : "border-[rgba(199,196,216,0.6)]"
                        }`}
                      >
                        <Show when={isModelSelected(model.modelId)}>
                          <div class="w-1.5 h-1.5 rounded-full bg-white" />
                        </Show>
                      </div>
                      <div class="flex-1">
                        <span class="text-sm font-medium text-[#191c1e]">
                          {model.modelDisplayName}
                        </span>
                        <span class="ml-2 text-xs text-[#464555]">{model.content.length} 字符</span>
                      </div>
                      <Show when={isModelSelected(model.modelId)}>
                        <span class="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                          已选择
                        </span>
                      </Show>
                      <Show when={!isModelSelected(model.modelId)}>
                        <button
                          type="button"
                          class="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          onClick={() => handleSelect(model.modelId)}
                          disabled={selectLoading()}
                        >
                          加入选择
                        </button>
                      </Show>
                      <Show when={isModelSelected(model.modelId)}>
                        <button
                          type="button"
                          class="px-3 py-1.5 text-xs font-medium text-[#464555] border border-[rgba(199,196,216,0.4)] rounded-lg hover:bg-white transition-colors"
                          onClick={() => handleSelect(model.modelId)}
                          disabled={selectLoading()}
                        >
                          取消
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
              <Show when={selectedModelIds().length === 0}>
                <div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  继续前至少选择 1 个模型输出。
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
