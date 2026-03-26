// ─── User Activity API client (favorites + recent access) ───────────────────

type TargetType = "project" | "document" | "workflow";

export interface FavoritesResponse {
  projects: Array<{
    id: string;
    targetId: string;
    name: string;
    createdAt: string;
  }>;
  documents: Array<{
    id: string;
    targetId: string;
    name: string;
    createdAt: string;
  }>;
  workflows: Array<{
    id: string;
    targetId: string;
    name: string;
    createdAt: string;
  }>;
}

export type RecentAccessItem = {
  id: string;
  targetId: string;
  targetType: TargetType;
  name: string;
  accessedAt: string;
};

export type RecentAccessResponse = RecentAccessItem[];

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch all favorites grouped by type.
 */
export async function fetchFavorites(): Promise<FavoritesResponse> {
  const res = await fetch("/api/user-activity/favorites", {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchFavorites failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch recent access history.
 */
export async function fetchRecentAccess(
  limit?: number,
): Promise<RecentAccessResponse> {
  const params = limit != null ? `?limit=${limit}` : "";
  const res = await fetch(`/api/user-activity/recent-access${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchRecentAccess failed: ${res.status}`);
  return res.json();
}

/**
 * Toggle favorite status for a target.
 * Returns the new favorited state.
 */
export async function toggleFavorite(
  targetType: TargetType,
  targetId: string,
): Promise<{ favorited: boolean }> {
  const res = await fetch("/api/user-activity/favorites/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ targetType, targetId }),
  });
  if (!res.ok) throw new Error(`toggleFavorite failed: ${res.status}`);
  return res.json();
}

/**
 * Batch-check which items are favorited by the current user.
 * Returns an array of "targetType:targetId" strings that are favorited.
 */
export async function checkFavorites(
  items: Array<{ targetType: string; targetId: string }>,
): Promise<string[]> {
  const res = await fetch("/api/user-activity/favorites/check", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`checkFavorites failed: ${res.status}`);
  return res.json();
}

/**
 * Record a recent access event (fire-and-forget friendly).
 */
export async function recordAccess(
  targetType: TargetType,
  targetId: string,
): Promise<void> {
  const res = await fetch("/api/user-activity/recent-access", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ targetType, targetId }),
  });
  if (!res.ok) throw new Error(`recordAccess failed: ${res.status}`);
}
