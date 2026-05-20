import { treaty } from "@elysiajs/eden";
import type { App } from "@intelliflow/backend";

export const api = treaty<App>(window.location.origin, {
  fetch: {
    credentials: "omit",
  },
  headers: () => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

/** Fetch notifications list */
export async function getNotifications(
  opts?: { limit?: number; offset?: number },
): Promise<{ notifications: unknown[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`/api/notifications?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

/** Fetch unread notification count */
export async function getUnreadCount(): Promise<number> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch("/api/notifications/unread-count", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch unread count");
  const data = await res.json();
  return data.count;
}

/** Mark a single notification as read */
export async function markNotificationRead(id: string): Promise<void> {
  const token = localStorage.getItem("auth_token");
  await fetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Mark all notifications as read */
export async function markAllNotificationsRead(): Promise<void> {
  const token = localStorage.getItem("auth_token");
  await fetch("/api/notifications/read-all", {
    method: "PATCH",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Fetch all background tasks for current user across all projects */
export async function getMyTasks(opts?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`/api/runtime/my-tasks${qs ? `?${qs}` : ""}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

import type { DocumentRuntimeState, VersionDiffResult } from "@intelliflow/shared";

/** Eden Treaty response wrapper type */
type EdenResponse<T = unknown> = { data: T } | { error: string };

/** Runtime route object returned by Eden Treaty for /runtime/:documentId/* endpoints */
interface RuntimeRoute {
  get: () => Promise<EdenResponse<DocumentRuntimeState>>;
  init: { post: (body?: unknown) => Promise<EdenResponse<DocumentRuntimeState>> };
  rollback: { post: (body: { targetStepOrder: number }) => Promise<EdenResponse<DocumentRuntimeState>> };
  advance: Record<string, { post: (body?: unknown) => Promise<EdenResponse<DocumentRuntimeState>> }>;
  skip: Record<string, { post: (body?: unknown) => Promise<EdenResponse<DocumentRuntimeState>> }>;
  export: Record<string, { preview: { get: () => Promise<EdenResponse<{ content: string; defaultFilename: string }>> }; generate: { post: (body: unknown) => Promise<EdenResponse<{ filename: string; format: string; fileSize: number; storagePath: string }>> } }>;
  ppt: Record<string, {
    preview: {
      get: () => Promise<EdenResponse<{
        content: string;
        defaultFilename: string;
        styleSelectionMode: "auto" | "runtime_select" | "fixed";
        recommendedStyleId: string;
        defaultStyleId?: string;
      }>>;
    };
    generate: {
      post: (body: unknown) => Promise<EdenResponse<{
        filename: string;
        format: "pptx";
        fileSize: number;
        storagePath: string;
        renderMode: "visual_premium_v1";
        styleId: string;
        warnings: string[];
        compositionSummary?: Record<string, unknown>;
      }>>;
    };
  }>;
  "start-background": { post: (body?: unknown) => Promise<EdenResponse<{ status: string }>> };
}

/** Wrapper result with error message when backend returns an error */
export type WrapperResult<T> = T | { data?: never; error: string } | null;

/** Helper to access a runtime route by documentId */
function runtimeOf(documentId: string): RuntimeRoute {
  return (api.api.runtime as unknown as Record<string, RuntimeRoute>)[documentId];
}

/** GET /runtime/:documentId → DocumentRuntimeState | WrapperResult */
export async function getRuntimeState(documentId: string): Promise<WrapperResult<DocumentRuntimeState>> {
  const res = await runtimeOf(documentId).get();
  if ("data" in res) return res.data;
  return { error: (res as { error: string }).error };
}

/** POST /runtime/:documentId/init → DocumentRuntimeState | WrapperResult */
export async function initRuntime(documentId: string): Promise<WrapperResult<DocumentRuntimeState>> {
  const res = await runtimeOf(documentId).init.post();
  if ("data" in res) return res.data;
  return { error: (res as { error: string }).error };
}

/** POST /runtime/:documentId/start-background → { status: string } | WrapperResult */
export async function startBackgroundExecution(
  documentId: string,
): Promise<WrapperResult<{ status: string }>> {
  const res = await runtimeOf(documentId)["start-background"].post();
  if ("data" in res) return res.data;
  return { error: (res as { error: string }).error };
}

/** POST /runtime/:documentId/advance/:nodeExecutionId → DocumentRuntimeState | WrapperResult */
export async function advanceNode(
  documentId: string,
  nodeExecutionId: string,
): Promise<WrapperResult<DocumentRuntimeState>> {
  const res = await runtimeOf(documentId).advance[nodeExecutionId].post();
  if ("data" in res) return res.data;
  return { error: (res as { error: string }).error };
}

/** POST /runtime/:documentId/skip/:nodeExecutionId → DocumentRuntimeState | WrapperResult */
export async function skipNode(
  documentId: string,
  nodeExecutionId: string,
): Promise<WrapperResult<DocumentRuntimeState>> {
  const res = await runtimeOf(documentId).skip[nodeExecutionId].post();
  if ("data" in res) return res.data;
  return { error: (res as { error: string }).error };
}

/** POST /runtime/:documentId/rollback → DocumentRuntimeState | WrapperResult */
export async function rollbackNode(
  documentId: string,
  targetStepOrder: number,
): Promise<WrapperResult<DocumentRuntimeState>> {
  const res = await runtimeOf(documentId).rollback.post({ targetStepOrder });
  if ("data" in res) return res.data;
  return { error: (res as { error: string }).error };
}

/** GET /runtime/:documentId/export/:nodeExecutionId/preview → { content, defaultFilename } | null */
export async function getExportPreview(
  documentId: string,
  nodeExecutionId: string,
): Promise<{ content: string; defaultFilename: string } | null> {
  const res = await runtimeOf(documentId).export[nodeExecutionId].preview.get();
  if ("data" in res) return res.data;
  return null;
}

/** POST /runtime/:documentId/export/:nodeExecutionId/generate → export result | null */
export async function generateExport(
  documentId: string,
  nodeExecutionId: string,
  format: string,
  filename: string,
  templateId?: string | null,
  stylePackId?: string | null,
): Promise<{
  filename: string;
  format: string;
  fileSize: number;
  storagePath: string;
  templateId?: string | null;
  stylePackId?: string;
  renderMode?: string;
  warnings?: string[];
  compositionSummary?: Record<string, unknown>;
} | null> {
  const res = await runtimeOf(documentId).export[nodeExecutionId].generate.post({
    format,
    filename,
    templateId,
    stylePackId,
  });
  if ("data" in res) return res.data;
  return null;
}

export async function getPptPreview(
  documentId: string,
  nodeExecutionId: string,
): Promise<{
  content: string;
  defaultFilename: string;
  styleSelectionMode: "auto" | "runtime_select" | "fixed";
  recommendedStyleId: string;
  defaultStyleId?: string;
} | null> {
  const res = await runtimeOf(documentId).ppt[nodeExecutionId].preview.get();
  if ("data" in res) return res.data;
  return null;
}

export async function generatePpt(
  documentId: string,
  nodeExecutionId: string,
  filename: string,
  styleId?: string | null,
): Promise<{
  filename: string;
  format: "pptx";
  fileSize: number;
  storagePath: string;
  renderMode: "visual_premium_v1";
  styleId: string;
  warnings: string[];
  compositionSummary?: Record<string, unknown>;
} | null> {
  const res = await runtimeOf(documentId).ppt[nodeExecutionId].generate.post({
    filename,
    styleId,
  });
  if ("data" in res) return res.data;
  return null;
}

/** GET /versions/:id/diff?idB=… → VersionDiffResult | null */
export async function getVersionDiff(
  versionAId: string,
  versionBId: string,
): Promise<VersionDiffResult | null> {
  const res = await api.api.versions({ id: versionAId }).diff({ idB: versionBId }).get();
  if (res.data && "versionA" in res.data) {
    return res.data as VersionDiffResult;
  }
  return null;
}

/** PUT /runtime/:documentId/restore/:nodeExecutionId/source — per-source restored text update */
export async function updateRestoreSource(
  documentId: string,
  nodeExecutionId: string,
  sourceId: string,
  restoredText: string,
): Promise<unknown> {
  // biome-ignore lint/suspicious/noExplicitAny: eden treaty dynamic path
  const runtimeApi = api.api.runtime as any;
  const res = await runtimeApi[documentId].restore[nodeExecutionId].source.put({
    sourceId,
    restoredText,
  });
  if (res.data && !("error" in res.data)) return res.data;
  throw new Error((res.data as Record<string, string>)?.error ?? "更新恢复文本失败");
}

/** POST /runtime/:documentId/restore/:nodeExecutionId/confirm — confirm restore results */
export async function confirmRestore(
  documentId: string,
  nodeExecutionId: string,
): Promise<unknown> {
  // biome-ignore lint/suspicious/noExplicitAny: eden treaty dynamic path
  const runtimeApi = api.api.runtime as any;
  const res = await runtimeApi[documentId].restore[nodeExecutionId].confirm.post();
  if (res.data && !("error" in res.data)) return res.data;
  throw new Error((res.data as Record<string, string>)?.error ?? "确认恢复失败");
}

/** Alias for backward compatibility */
export { getRuntimeState as fetchDocumentRuntimeState };
