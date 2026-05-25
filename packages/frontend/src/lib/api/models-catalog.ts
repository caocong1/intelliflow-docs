export type ActiveModelOption = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  providerName?: string | null;
  deploymentType?: "cloud" | "local";
};

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJsonError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `请求失败：${res.status}`;
  } catch {
    return `请求失败：${res.status}`;
  }
}

export async function listActiveModelOptions(): Promise<ActiveModelOption[]> {
  const res = await fetch("/api/models", { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseJsonError(res));
  const payload = (await res.json()) as { data: ActiveModelOption[] };
  return payload.data ?? [];
}
