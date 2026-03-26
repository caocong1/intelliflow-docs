export interface SearchResultGroup<T> {
  items: T[];
  total: number;
}

export interface SearchResponse {
  projects: SearchResultGroup<{
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
  }>;
  documents: SearchResultGroup<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    projectId: string;
    createdAt: string;
  }>;
  workflows: SearchResultGroup<{
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
  }>;
}

async function authFetch<T>(path: string): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(path, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Search API error: ${res.status}`);
  return res.json();
}

export function globalSearch(
  query: string,
  limit?: number,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (limit != null) params.set("limit", String(limit));
  return authFetch<SearchResponse>(`/api/search?${params.toString()}`);
}
