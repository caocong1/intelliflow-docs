import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { models, modelCallLogs, providers } from "../../db/schema";
import { getStrategy } from "../runtime/strategies";
import type { ModelCallInput } from "../runtime/strategies";

export type ModelRow = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  isActive: boolean;
  isProviderDisabled: boolean;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  providerName?: string | null;
  agentMode: "simple_chat" | "autonomous_agent" | null;
  agentMaxTurns: number | null;
  agentMaxBudgetUsd: string | null;
  agentAllowedTools: string[] | null;
  createdAt: Date;
  updatedAt: Date;
};

const modelColumns = {
  id: models.id,
  providerId: models.providerId,
  modelId: models.modelId,
  displayName: models.displayName,
  isActive: models.isActive,
  isProviderDisabled: models.isProviderDisabled,
  temperature: models.temperature,
  maxTokens: models.maxTokens,
  topP: models.topP,
  agentMode: models.agentMode,
  agentMaxTurns: models.agentMaxTurns,
  agentMaxBudgetUsd: models.agentMaxBudgetUsd,
  agentAllowedTools: models.agentAllowedTools,
  createdAt: models.createdAt,
  updatedAt: models.updatedAt,
} as const;

export async function listActiveModels() {
  return db
    .select({
      ...modelColumns,
      providerName: providers.name,
      deploymentType: providers.deploymentType,
    })
    .from(models)
    .leftJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.isActive, true))
    .orderBy(desc(models.createdAt));
}

export async function listModelsByProvider(providerId: string): Promise<ModelRow[]> {
  return db
    .select(modelColumns)
    .from(models)
    .where(eq(models.providerId, providerId))
    .orderBy(desc(models.createdAt));
}

export async function createModel(input: {
  providerId: string;
  modelId: string;
  displayName: string;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  agentMode?: "simple_chat" | "autonomous_agent" | null;
  agentMaxTurns?: number | null;
  agentMaxBudgetUsd?: string | null;
  agentAllowedTools?: string[] | null;
}): Promise<ModelRow> {
  // Verify provider exists
  const provider = await db
    .select({ id: providers.id, isActive: providers.isActive })
    .from(providers)
    .where(eq(providers.id, input.providerId))
    .limit(1);

  if (provider.length === 0) {
    throw new Error("PROVIDER_NOT_FOUND");
  }

  const result = await db
    .insert(models)
    .values({
      providerId: input.providerId,
      modelId: input.modelId,
      displayName: input.displayName,
      isProviderDisabled: !provider[0].isActive,
      temperature: input.temperature ?? null,
      maxTokens: input.maxTokens ?? null,
      topP: input.topP ?? null,
      agentMode: input.agentMode ?? null,
      agentMaxTurns: input.agentMaxTurns ?? null,
      agentMaxBudgetUsd: input.agentMaxBudgetUsd ?? null,
      agentAllowedTools: input.agentAllowedTools ?? null,
    })
    .returning(modelColumns);

  return result[0];
}

export async function updateModel(
  id: string,
  input: {
    modelId?: string;
    displayName?: string;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    agentMode?: "simple_chat" | "autonomous_agent" | null;
    agentMaxTurns?: number | null;
    agentMaxBudgetUsd?: string | null;
    agentAllowedTools?: string[] | null;
  },
): Promise<ModelRow> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.modelId !== undefined) updateData.modelId = input.modelId;
  if (input.displayName !== undefined) updateData.displayName = input.displayName;
  if (input.temperature !== undefined) updateData.temperature = input.temperature;
  if (input.maxTokens !== undefined) updateData.maxTokens = input.maxTokens;
  if (input.topP !== undefined) updateData.topP = input.topP;
  if (input.agentMode !== undefined) updateData.agentMode = input.agentMode;
  if (input.agentMaxTurns !== undefined) updateData.agentMaxTurns = input.agentMaxTurns;
  if (input.agentMaxBudgetUsd !== undefined) updateData.agentMaxBudgetUsd = input.agentMaxBudgetUsd;
  if (input.agentAllowedTools !== undefined) updateData.agentAllowedTools = input.agentAllowedTools;

  const result = await db
    .update(models)
    .set(updateData)
    .where(eq(models.id, id))
    .returning(modelColumns);

  if (result.length === 0) {
    throw new Error("MODEL_NOT_FOUND");
  }

  return result[0];
}

export async function deleteModel(id: string): Promise<{ success: true }> {
  const result = await db
    .delete(models)
    .where(eq(models.id, id))
    .returning({ id: models.id });

  if (result.length === 0) {
    throw new Error("MODEL_NOT_FOUND");
  }

  return { success: true };
}

export async function toggleModelStatus(id: string): Promise<ModelRow> {
  const current = await db
    .select({ id: models.id, isActive: models.isActive })
    .from(models)
    .where(eq(models.id, id))
    .limit(1);

  if (current.length === 0) {
    throw new Error("MODEL_NOT_FOUND");
  }

  const result = await db
    .update(models)
    .set({ isActive: !current[0].isActive, updatedAt: new Date() })
    .where(eq(models.id, id))
    .returning(modelColumns);

  return result[0];
}

/**
 * Test a model by sending a prompt and collecting the response.
 */
export async function testModelPrompt(
  id: string,
  prompt: string,
  userId?: string,
): Promise<{ success: boolean; content: string; latencyMs: number; errorMessage?: string }> {
  // Look up model + provider
  const [row] = await db
    .select({
      id: models.id,
      modelId: models.modelId,
      displayName: models.displayName,
      temperature: models.temperature,
      maxTokens: models.maxTokens,
      topP: models.topP,
      baseUrl: providers.baseUrl,
      apiKey: providers.apiKey,
      providerType: providers.type,
      providerId: providers.id,
      providerName: providers.name,
      agentMode: models.agentMode,
      agentMaxTurns: models.agentMaxTurns,
      agentMaxBudgetUsd: models.agentMaxBudgetUsd,
      agentAllowedTools: models.agentAllowedTools,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.id, id))
    .limit(1);

  if (!row) {
    throw new Error("MODEL_NOT_FOUND");
  }

  const startTime = Date.now();

  try {
    const strategy = getStrategy(row.providerType);
    const strategyInput: ModelCallInput = {
      ...row,
      providerType: row.providerType,
    };

    let content = "";
    const result = await strategy.execute({
      model: strategyInput,
      resolvedPrompt: prompt,
      sendEvent: () => {}, // No SSE needed for test
    });
    content = result.content;
    const latencyMs = Date.now() - startTime;

    // Log the test call
    await db.insert(modelCallLogs).values({
      userId: userId ?? null,
      providerId: row.providerId,
      providerName: row.providerName,
      modelId: row.id,
      modelName: row.displayName,
      callSource: "model_test",
      resolvedPrompt: prompt,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      responseStatus: result.status === "failed" ? "failed" : "completed",
      responseContent: content || null,
      contentLength: content.length || null,
      duration: latencyMs,
      errorMessage: result.status === "failed" ? (result.errorMessage ?? null) : null,
    });

    if (result.status === "failed") {
      return { success: false, content, latencyMs, errorMessage: result.errorMessage };
    }

    if (!content.trim()) {
      return { success: false, content: "", latencyMs, errorMessage: "模型未返回任何内容" };
    }

    return { success: true, content, latencyMs };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Log the failed test call
    await db.insert(modelCallLogs).values({
      userId: userId ?? null,
      providerId: row.providerId,
      providerName: row.providerName,
      modelId: row.id,
      modelName: row.displayName,
      callSource: "model_test",
      resolvedPrompt: prompt,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      responseStatus: "failed",
      duration: latencyMs,
      errorMessage,
    });

    return { success: false, content: "", latencyMs, errorMessage };
  }
}
