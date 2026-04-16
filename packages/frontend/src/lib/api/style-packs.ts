export interface StylePackItem {
  id: string;
  label: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listStylePacks(): Promise<StylePackItem[]> {
  const res = await fetch("/api/runtime/style-packs", {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch style packs: ${res.status}`);
  return res.json();
}
