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

/** Start background document generation — fires and forgets, backend runs pipeline async */
export async function startBackgroundExecution(
  documentId: string,
): Promise<{ status: string } | null> {
  const res = await (api.api.runtime as Record<string, unknown> as any)[documentId][
    "start-background"
  ].post();
  if (res.data && !("error" in res.data)) {
    return res.data as { status: string };
  }
  return null;
}

/** Fetch current document runtime state (for polling) */
export async function fetchDocumentRuntimeState(documentId: string): Promise<unknown | null> {
  const res = await (api.api.runtime as Record<string, unknown> as any)[documentId].get();
  if (res.data && !("error" in res.data)) {
    return res.data;
  }
  return null;
}
