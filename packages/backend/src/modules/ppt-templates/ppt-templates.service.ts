import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { pptTemplates } from "../../db/schema";

export async function listTemplates(
  page: number,
  limit: number,
  type?: "code_theme" | "native_pptx",
) {
  const offset = (page - 1) * limit;

  const conditions = [eq(pptTemplates.isActive, true)];
  if (type) conditions.push(eq(pptTemplates.type, type));

  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(pptTemplates)
      .where(where)
      .orderBy(desc(pptTemplates.createdAt))
      .offset(offset)
      .limit(limit),
    db
      .select({ count: count() })
      .from(pptTemplates)
      .where(where),
  ]);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: total[0].count,
      totalPages: Math.ceil(total[0].count / limit),
    },
  };
}

export async function getTemplate(id: string) {
  const rows = await db
    .select()
    .from(pptTemplates)
    .where(eq(pptTemplates.id, id))
    .limit(1);

  if (rows.length === 0) throw new Error("TEMPLATE_NOT_FOUND");
  return rows[0];
}

export async function createTemplate(input: {
  name: string;
  description?: string;
  type: "code_theme" | "native_pptx";
  aspectRatio?: string;
  themeConfig?: unknown;
  templateFilePath?: string;
  availableLayouts?: string[];
  createdBy?: string;
}) {
  const result = await db
    .insert(pptTemplates)
    .values({
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      aspectRatio: input.aspectRatio ?? "16:9",
      themeConfig: input.themeConfig ?? null,
      templateFilePath: input.templateFilePath ?? null,
      availableLayouts: input.availableLayouts ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return result[0];
}

export async function updateTemplate(
  id: string,
  input: {
    name?: string;
    description?: string;
    aspectRatio?: string;
    themeConfig?: unknown;
    templateFilePath?: string;
    availableLayouts?: string[];
    isActive?: boolean;
  },
) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.aspectRatio !== undefined) updateData.aspectRatio = input.aspectRatio;
  if (input.themeConfig !== undefined) updateData.themeConfig = input.themeConfig;
  if (input.templateFilePath !== undefined) updateData.templateFilePath = input.templateFilePath;
  if (input.availableLayouts !== undefined) updateData.availableLayouts = input.availableLayouts;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const result = await db
    .update(pptTemplates)
    .set(updateData)
    .where(eq(pptTemplates.id, id))
    .returning();

  if (result.length === 0) throw new Error("TEMPLATE_NOT_FOUND");
  return result[0];
}

export async function deleteTemplate(id: string) {
  const result = await db
    .delete(pptTemplates)
    .where(eq(pptTemplates.id, id))
    .returning({ id: pptTemplates.id });

  if (result.length === 0) throw new Error("TEMPLATE_NOT_FOUND");
  return { success: true as const };
}

export async function getDefaultTemplate() {
  const rows = await db
    .select()
    .from(pptTemplates)
    .where(and(eq(pptTemplates.isDefault, true), eq(pptTemplates.isActive, true)))
    .limit(1);

  return rows[0] ?? null;
}

export async function setDefault(id: string) {
  return await db.transaction(async (tx) => {
    // Verify target exists
    const target = await tx
      .select({ id: pptTemplates.id })
      .from(pptTemplates)
      .where(eq(pptTemplates.id, id))
      .limit(1);

    if (target.length === 0) throw new Error("TEMPLATE_NOT_FOUND");

    // Clear all existing defaults
    await tx
      .update(pptTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(pptTemplates.isDefault, true));

    // Set new default
    const result = await tx
      .update(pptTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(pptTemplates.id, id))
      .returning();

    return result[0];
  });
}
