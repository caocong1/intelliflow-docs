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
  targetType: "project" | "document" | "workflow";
  name: string;
  accessedAt: string;
};

export type RecentAccessResponse = RecentAccessItem[];

async function authFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`User activity API error: ${res.status}`);
  return res.json();
}

export function fetchFavorites(): Promise<FavoritesResponse> {
  return authFetch<FavoritesResponse>("/api/user-activity/favorites");
}

export function fetchRecentAccess(
  limit?: number,
): Promise<RecentAccessResponse> {
  const params = limit != null ? `?limit=${limit}` : "";
  return authFetch<RecentAccessResponse>(
    `/api/user-activity/recent-access${params}`,
  );
}

export function toggleFavorite(
  targetType: string,
  targetId: string,
): Promise<{ favorited: boolean }> {
  return authFetch<{ favorited: boolean }>(
    "/api/user-activity/favorites/toggle",
    {
      method: "POST",
      body: JSON.stringify({ targetType, targetId }),
    },
  );
}

export function checkFavorites(
  items: Array<{ targetType: string; targetId: string }>,
): Promise<string[]> {
  return authFetch<string[]>("/api/user-activity/favorites/check", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function recordAccess(
  targetType: string,
  targetId: string,
): Promise<{ ok: true }> {
  return authFetch<{ ok: true }>("/api/user-activity/recent-access", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId }),
  });
}
