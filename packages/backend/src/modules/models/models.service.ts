import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { models, providers } from "../../db/schema";

export type ModelRow = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  isActive: boolean;
  isProviderDisabled: boolean;
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
  createdAt: models.createdAt,
  updatedAt: models.updatedAt,
} as const;

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
    })
    .returning(modelColumns);

  return result[0];
}

export async function updateModel(
  id: string,
  input: { modelId?: string; displayName?: string },
): Promise<ModelRow> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.modelId !== undefined) updateData.modelId = input.modelId;
  if (input.displayName !== undefined) updateData.displayName = input.displayName;

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
