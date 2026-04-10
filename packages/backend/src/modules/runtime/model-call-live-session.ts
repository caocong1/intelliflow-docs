import type { ModelCallLiveEvent, ModelCallSnapshotPayload, ModelOutput } from "@intelliflow/shared";

type ModelCallSubscriber = (event: ModelCallLiveEvent) => void;
type FlushFn = (models: Record<string, ModelOutput>) => Promise<void>;

export interface ModelCallLiveSession {
  documentId: string;
  nodeExecutionId: string;
  models: Record<string, ModelOutput>;
  subscribers: Set<ModelCallSubscriber>;
  flushTimer: ReturnType<typeof setTimeout> | null;
  flushChain: Promise<void>;
  completed: boolean;
  failed: boolean;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const sessions = new Map<string, ModelCallLiveSession>();

function cloneModels(models: Record<string, ModelOutput>): Record<string, ModelOutput> {
  return Object.fromEntries(
    Object.entries(models).map(([modelId, model]) => [modelId, { ...model }]),
  );
}

function queueFlush(
  session: ModelCallLiveSession,
  flushFn: FlushFn,
  modelsSnapshot: Record<string, ModelOutput>,
): Promise<void> {
  session.flushChain = session.flushChain
    .catch(() => undefined)
    .then(() => flushFn(modelsSnapshot));
  return session.flushChain;
}

export function createSession(params: {
  documentId: string;
  nodeExecutionId: string;
  models: Record<string, ModelOutput>;
}): ModelCallLiveSession {
  const existing = sessions.get(params.nodeExecutionId);
  if (existing?.flushTimer) clearTimeout(existing.flushTimer);
  if (existing?.cleanupTimer) clearTimeout(existing.cleanupTimer);

  const session: ModelCallLiveSession = {
    documentId: params.documentId,
    nodeExecutionId: params.nodeExecutionId,
    models: cloneModels(params.models),
    subscribers: new Set(),
    flushTimer: null,
    flushChain: Promise.resolve(),
    completed: false,
    failed: false,
    cleanupTimer: null,
  };
  sessions.set(params.nodeExecutionId, session);
  return session;
}

export function getSession(nodeExecutionId: string): ModelCallLiveSession | null {
  return sessions.get(nodeExecutionId) ?? null;
}

export function getSessionSnapshot(
  nodeExecutionId: string,
  selectedModelId: string | null = null,
): ModelCallSnapshotPayload | null {
  const session = sessions.get(nodeExecutionId);
  if (!session) return null;

  return {
    models: cloneModels(session.models),
    selectedModelId,
    done: session.completed || session.failed,
  };
}

export function buildSnapshotEvent(
  nodeExecutionId: string,
  selectedModelId: string | null = null,
): ModelCallLiveEvent | null {
  const snapshot = getSessionSnapshot(nodeExecutionId, selectedModelId);
  return snapshot ? { type: "snapshot", data: snapshot } : null;
}

export function subscribe(
  nodeExecutionId: string,
  subscriber: ModelCallSubscriber,
): (() => void) | null {
  const session = sessions.get(nodeExecutionId);
  if (!session) return null;

  session.subscribers.add(subscriber);
  return () => {
    session.subscribers.delete(subscriber);
  };
}

export function broadcast(nodeExecutionId: string, event: ModelCallLiveEvent): void {
  const session = sessions.get(nodeExecutionId);
  if (!session) return;

  for (const subscriber of session.subscribers) {
    try {
      subscriber(event);
    } catch {
      // Ignore failed subscribers so one bad connection does not break others.
    }
  }
}

export function applyDelta(nodeExecutionId: string, modelId: string, delta: string): void {
  const session = sessions.get(nodeExecutionId);
  const existing = session?.models[modelId];
  if (!session || !existing) return;

  session.models[modelId] = {
    ...existing,
    content: `${existing.content}${delta}`,
    status: "streaming",
  };
}

export function setModelStatus(
  nodeExecutionId: string,
  modelId: string,
  status: ModelOutput["status"],
  patch: Partial<Omit<ModelOutput, "modelId" | "status">> = {},
): void {
  const session = sessions.get(nodeExecutionId);
  if (!session) return;

  const existing = session.models[modelId] ?? {
    modelId,
    modelDisplayName: modelId,
    content: "",
    status,
  };

  session.models[modelId] = {
    ...existing,
    ...patch,
    status,
  };
}

export function scheduleFlush(
  nodeExecutionId: string,
  flushFn: FlushFn,
  delayMs = 500,
): void {
  const session = sessions.get(nodeExecutionId);
  if (!session || session.flushTimer) return;

  session.flushTimer = setTimeout(() => {
    session.flushTimer = null;
    const snapshot = cloneModels(session.models);
    void queueFlush(session, flushFn, snapshot);
  }, delayMs);
}

export function flushNow(nodeExecutionId: string, flushFn: FlushFn): Promise<void> {
  const session = sessions.get(nodeExecutionId);
  if (!session) return Promise.resolve();

  if (session.flushTimer) {
    clearTimeout(session.flushTimer);
    session.flushTimer = null;
  }

  const snapshot = cloneModels(session.models);
  return queueFlush(session, flushFn, snapshot);
}

export function markDone(
  nodeExecutionId: string,
  terminalState: "completed" | "failed" = "completed",
): void {
  const session = sessions.get(nodeExecutionId);
  if (!session) return;

  session.completed = terminalState === "completed";
  session.failed = terminalState === "failed";
}

export function disposeSessionLater(nodeExecutionId: string, ttlMs: number): void {
  const session = sessions.get(nodeExecutionId);
  if (!session) return;

  if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
  session.cleanupTimer = setTimeout(() => {
    const current = sessions.get(nodeExecutionId);
    if (current !== session) return;
    sessions.delete(nodeExecutionId);
  }, ttlMs);
}

export function clearLiveSessionsForTest(): void {
  for (const session of sessions.values()) {
    if (session.flushTimer) clearTimeout(session.flushTimer);
    if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
  }
  sessions.clear();
}
