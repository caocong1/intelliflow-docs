import { count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db";
import { documentTypes } from "../../db/schema";

export type DocumentTypeRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const documentTypeColumns = {
  id: documentTypes.id,
  name: documentTypes.name,
  code: documentTypes.code,
  description: documentTypes.description,
  isActive: documentTypes.isActive,
  createdAt: documentTypes.createdAt,
  updatedAt: documentTypes.updatedAt,
} as const;

export async function listDocumentTypes(
  page: number,
  pageSize: number,
  search?: string,
): Promise<{ data: DocumentTypeRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const searchCondition = search
    ? or(ilike(documentTypes.name, `%${search}%`), ilike(documentTypes.code, `%${search}%`))
    : undefined;

  const [data, totalResult] = await Promise.all([
    db
      .select(documentTypeColumns)
      .from(documentTypes)
      .where(searchCondition)
      .orderBy(desc(documentTypes.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(documentTypes).where(searchCondition),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function createDocumentType(input: {
  name: string;
  code: string;
  description?: string;
}): Promise<DocumentTypeRow> {
  const result = await db
    .insert(documentTypes)
    .values({
      name: input.name,
      code: input.code,
      description: input.description ?? null,
    })
    .returning(documentTypeColumns);

  return result[0];
}

export async function updateDocumentType(
  id: string,
  input: { name?: string; code?: string; description?: string },
): Promise<DocumentTypeRow> {
  const result = await db
    .update(documentTypes)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(documentTypes.id, id))
    .returning(documentTypeColumns);

  if (result.length === 0) {
    throw new Error("DOCUMENT_TYPE_NOT_FOUND");
  }

  return result[0];
}

export async function toggleDocumentTypeStatus(id: string): Promise<DocumentTypeRow> {
  const current = await db
    .select({ id: documentTypes.id, isActive: documentTypes.isActive })
    .from(documentTypes)
    .where(eq(documentTypes.id, id))
    .limit(1);

  if (current.length === 0) {
    throw new Error("DOCUMENT_TYPE_NOT_FOUND");
  }

  const result = await db
    .update(documentTypes)
    .set({
      isActive: !current[0].isActive,
      updatedAt: new Date(),
    })
    .where(eq(documentTypes.id, id))
    .returning(documentTypeColumns);

  return result[0];
}

export async function deleteDocumentType(id: string): Promise<{ success: true }> {
  // TODO: Phase 4 — check for associated documents in the documents table
  // When the documents table exists, query it to see if any documents reference this type.
  // If found, throw new Error("HAS_ASSOCIATED_DOCUMENTS") to block deletion.

  const result = await db
    .delete(documentTypes)
    .where(eq(documentTypes.id, id))
    .returning({ id: documentTypes.id });

  if (result.length === 0) {
    throw new Error("DOCUMENT_TYPE_NOT_FOUND");
  }

  return { success: true };
}
