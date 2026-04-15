import { count, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { models, modelCallLogs, providers } from "../../db/schema";
import { buildChatCompletionsUrl } from "../runtime/strategies/openai-compatible-url";

export type ProviderRow = {
  id: string;
  name: string;
  type: "openai_compatible" | "opencode" | "claude_agent_sdk" | "ollama";
  deploymentType: "cloud" | "local";
  baseUrl: string;
  apiKeyMasked: string | null;
  username: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length < 10) return "***";
  return `sk-...${key.slice(-6)}`;
}

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function toProviderRow(row: {
  id: string;
  name: string;
  type: "openai_compatible" | "opencode" | "claude_agent_sdk" | "ollama";
  deploymentType: "cloud" | "local";
  baseUrl: string;
  apiKey: string | null;
  username: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProviderRow {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    deploymentType: row.deploymentType,
    baseUrl: row.baseUrl,
    apiKeyMasked: maskApiKey(row.apiKey),
    username: row.username,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const providerColumns = {
  id: providers.id,
  name: providers.name,
  type: providers.type,
  deploymentType: providers.deploymentType,
  baseUrl: providers.baseUrl,
  apiKey: providers.apiKey,
  username: providers.username,
  isActive: providers.isActive,
  createdAt: providers.createdAt,
  updatedAt: providers.updatedAt,
} as const;

export async function listProviders(): Promise<ProviderRow[]> {
  const rows = await db
    .select(providerColumns)
    .from(providers)
    .orderBy(desc(providers.createdAt));

  return rows.map(toProviderRow);
}

export async function createProvider(input: {
  name: string;
  type?: "openai_compatible" | "opencode" | "claude_agent_sdk" | "ollama";
  deploymentType?: "cloud" | "local";
  baseUrl: string;
  apiKey?: string;
  username?: string;
}): Promise<ProviderRow> {
  const result = await db
    .insert(providers)
    .values({
      name: input.name,
      type: input.type ?? "openai_compatible",
      deploymentType: input.deploymentType ?? "cloud",
      baseUrl: stripTrailingSlashes(input.baseUrl),
      apiKey: input.apiKey ?? null,
      username: input.username ?? null,
    })
    .returning(providerColumns);

  return toProviderRow(result[0]);
}

export async function updateProvider(
  id: string,
  input: { name?: string; deploymentType?: "cloud" | "local"; baseUrl?: string; apiKey?: string; username?: string },
): Promise<ProviderRow> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.deploymentType !== undefined) updateData.deploymentType = input.deploymentType;
  if (input.baseUrl !== undefined) updateData.baseUrl = stripTrailingSlashes(input.baseUrl);
  if (input.apiKey !== undefined && input.apiKey !== "") updateData.apiKey = input.apiKey;
  if (input.username !== undefined) updateData.username = input.username;

  const result = await db
    .update(providers)
    .set(updateData)
    .where(eq(providers.id, id))
    .returning(providerColumns);

  if (result.length === 0) {
    throw new Error("PROVIDER_NOT_FOUND");
  }

  return toProviderRow(result[0]);
}

export async function deleteProvider(id: string): Promise<{ success: true }> {
  const modelCount = await db
    .select({ count: count() })
    .from(models)
    .where(eq(models.providerId, id));

  if (modelCount[0]?.count > 0) {
    throw new Error("HAS_MODELS");
  }

  const result = await db
    .delete(providers)
    .where(eq(providers.id, id))
    .returning({ id: providers.id });

  if (result.length === 0) {
    throw new Error("PROVIDER_NOT_FOUND");
  }

  return { success: true };
}

export async function toggleProviderStatus(id: string): Promise<ProviderRow> {
  return await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: providers.id, isActive: providers.isActive })
      .from(providers)
      .where(eq(providers.id, id))
      .limit(1);

    if (current.length === 0) {
      throw new Error("PROVIDER_NOT_FOUND");
    }

    const newIsActive = !current[0].isActive;

    const result = await tx
      .update(providers)
      .set({ isActive: newIsActive, updatedAt: new Date() })
      .where(eq(providers.id, id))
      .returning(providerColumns);

    // Cascade: update isProviderDisabled on all models under this provider
    if (!newIsActive) {
      // Disabling provider -> mark all models as provider-disabled
      await tx
        .update(models)
        .set({ isProviderDisabled: true, updatedAt: new Date() })
        .where(eq(models.providerId, id));
    } else {
      // Enabling provider -> clear provider-disabled flag
      await tx
        .update(models)
        .set({ isProviderDisabled: false, updatedAt: new Date() })
        .where(eq(models.providerId, id));
    }

    return toProviderRow(result[0]);
  });
}

export async function testProviderConnection(
  id: string,
  modelId?: string,
  userId?: string,
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const providerRows = await db
    .select(providerColumns)
    .from(providers)
    .where(eq(providers.id, id))
    .limit(1);

  if (providerRows.length === 0) {
    throw new Error("PROVIDER_NOT_FOUND");
  }

  const provider = providerRows[0];
  const startTime = Date.now();
  const testModelName = modelId || (provider.type === "claude_agent_sdk" ? "doubao-seed-2.0-code" : provider.type === "ollama" ? "llama3" : "doubao-seed-2.0-lite");

  try {
    let response: Response;

    if (provider.type === "claude_agent_sdk") {
      // Anthropic 兼容端点：POST /v1/messages
      response = await fetch(`${provider.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": provider.apiKey || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: testModelName,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } else if (provider.type === "ollama") {
      // Ollama: OpenAI-compatible at /v1/chat/completions, no auth needed
      response = await fetch(buildChatCompletionsUrl(provider.baseUrl, provider.type), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: testModelName,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } else {
      // openai_compatible / opencode: POST /chat/completions
      response = await fetch(buildChatCompletionsUrl(provider.baseUrl, provider.type), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: testModelName,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });
    }

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      // Log successful provider test
      await db.insert(modelCallLogs).values({
        userId: userId ?? null,
        providerId: provider.id,
        providerName: provider.name,
        modelName: testModelName,
        callSource: "provider_test",
        resolvedPrompt: "hi",
        responseStatus: "completed",
        duration: latencyMs,
      });
      return { success: true, message: "连接成功", latencyMs };
    }

    const body = await response.text().catch(() => "");
    const truncated = body.length > 200 ? `${body.slice(0, 200)}...` : body;

    // Log failed provider test
    await db.insert(modelCallLogs).values({
      userId: userId ?? null,
      providerId: provider.id,
      providerName: provider.name,
      modelName: testModelName,
      callSource: "provider_test",
      resolvedPrompt: "hi",
      responseStatus: "failed",
      duration: latencyMs,
      errorMessage: `HTTP ${response.status}: ${truncated}`,
    });

    return {
      success: false,
      message: `HTTP ${response.status}: ${truncated}`,
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    let message: string;
    if (err instanceof DOMException && err.name === "TimeoutError") {
      message = "连接超时（15秒）";
    } else {
      message = err instanceof Error ? err.message : String(err);
    }

    // Log failed provider test
    await db.insert(modelCallLogs).values({
      userId: userId ?? null,
      providerId: provider.id,
      providerName: provider.name,
      modelName: testModelName,
      callSource: "provider_test",
      resolvedPrompt: "hi",
      responseStatus: "failed",
      duration: latencyMs,
      errorMessage: message,
    });

    return { success: false, message, latencyMs };
  }
}
