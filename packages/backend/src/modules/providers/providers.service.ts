import { count, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { models, providers } from "../../db/schema";

export type ProviderRow = {
  id: string;
  name: string;
  type: "openai_compatible" | "opencode";
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
  type: "openai_compatible" | "opencode";
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
  type?: "openai_compatible" | "opencode";
  baseUrl: string;
  apiKey?: string;
  username?: string;
}): Promise<ProviderRow> {
  const result = await db
    .insert(providers)
    .values({
      name: input.name,
      type: input.type ?? "openai_compatible",
      baseUrl: stripTrailingSlashes(input.baseUrl),
      apiKey: input.apiKey ?? null,
      username: input.username ?? null,
    })
    .returning(providerColumns);

  return toProviderRow(result[0]);
}

export async function updateProvider(
  id: string,
  input: { name?: string; baseUrl?: string; apiKey?: string; username?: string },
): Promise<ProviderRow> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
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

  try {
    let response: Response;

    if (provider.type === "openai_compatible") {
      response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: modelId || "doubao-seed-2.0-lite",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } else {
      // opencode: GET /global/health
      const headers: Record<string, string> = {};
      if (provider.apiKey) {
        const username = provider.username || "opencode";
        headers.Authorization = `Basic ${btoa(`${username}:${provider.apiKey}`)}`;
      }
      response = await fetch(`${provider.baseUrl}/global/health`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15000),
      });
    }

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      if (provider.type === "opencode") {
        const body = await response.json();
        if (body.healthy === true) {
          return { success: true, message: "连接成功", latencyMs };
        }
        return { success: false, message: "服务未就绪: healthy !== true", latencyMs };
      }
      return { success: true, message: "连接成功", latencyMs };
    }

    const body = await response.text().catch(() => "");
    const truncated = body.length > 200 ? `${body.slice(0, 200)}...` : body;
    return {
      success: false,
      message: `HTTP ${response.status}: ${truncated}`,
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { success: false, message: "连接超时（15秒）", latencyMs };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message, latencyMs };
  }
}
