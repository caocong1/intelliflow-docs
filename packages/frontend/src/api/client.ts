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
