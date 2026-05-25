export type PptAgentPublicConfig = {
  name: string;
  providerType: "openai_compatible";
  baseUrl: string;
  apiKeyEnvVar: string;
  textModel: string;
  textEndpoint: string;
  imageModel: string;
  imageEndpoint: string;
  imageAspectRatio: string;
  imageResponseFormat: "base64";
  imagePromptOptimizer: boolean;
  temperature: number;
  maxCompletionTokens: number;
  textTimeoutMs: number;
  imageTimeoutMs: number;
  isActive: boolean;
  apiKeyConfigured: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PptAgentConfigUpdate = Partial<
  Pick<
    PptAgentPublicConfig,
    | "name"
    | "baseUrl"
    | "apiKeyEnvVar"
    | "textModel"
    | "textEndpoint"
    | "imageModel"
    | "imageEndpoint"
    | "imageAspectRatio"
    | "imagePromptOptimizer"
    | "temperature"
    | "maxCompletionTokens"
    | "textTimeoutMs"
    | "imageTimeoutMs"
    | "isActive"
  > & { apiKey: string }
>;

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

export async function getPptAgentConfig(): Promise<PptAgentPublicConfig> {
  const res = await fetch("/api/ppt-agent-config", { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseJsonError(res));
  const payload = (await res.json()) as { data: PptAgentPublicConfig };
  return payload.data;
}

export async function updatePptAgentConfig(
  patch: PptAgentConfigUpdate,
): Promise<PptAgentPublicConfig> {
  const res = await fetch("/api/ppt-agent-config", {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
  const payload = (await res.json()) as { data: PptAgentPublicConfig };
  return payload.data;
}

export async function testPptAgentTextConnection(): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
  model?: string;
  error?: string;
}> {
  const res = await fetch("/api/ppt-agent-config/test", {
    method: "POST",
    headers: authHeaders(),
  });
  const payload = (await res.json()) as {
    success: boolean;
    message?: string;
    latencyMs?: number;
    model?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(payload.error || `请求失败：${res.status}`);
  return {
    success: payload.success,
    message: payload.message || "连接成功",
    latencyMs: payload.latencyMs,
    model: payload.model,
  };
}
