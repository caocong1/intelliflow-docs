import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db";
import { documentTypes, documents, workflows } from "../../db/schema";

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
  activeOnly?: boolean,
): Promise<{ data: DocumentTypeRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    conditions.push(or(ilike(documentTypes.name, `%${search}%`), ilike(documentTypes.code, `%${search}%`)));
  }
  if (activeOnly) {
    conditions.push(eq(documentTypes.isActive, true));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalResult] = await Promise.all([
    db
      .select(documentTypeColumns)
      .from(documentTypes)
      .where(whereClause)
      .orderBy(desc(documentTypes.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(documentTypes).where(whereClause),
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

export async function getAssociatedWorkflows(
  documentTypeId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: workflows.id, name: workflows.name })
    .from(workflows)
    .where(eq(workflows.documentTypeId, documentTypeId));
  return rows;
}

export async function getAssociatedDocuments(
  documentTypeId: string,
): Promise<{ id: string; title: string }[]> {
  const rows = await db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(and(eq(workflows.documentTypeId, documentTypeId), eq(documents.isDeleted, false)));
  return rows;
}

export async function deleteDocumentType(id: string): Promise<{ success: true }> {
  // Guard: check for associated workflows and documents
  const [associatedWorkflows, associatedDocuments] = await Promise.all([
    getAssociatedWorkflows(id),
    getAssociatedDocuments(id),
  ]);

  if (associatedWorkflows.length > 0 || associatedDocuments.length > 0) {
    const error = new Error("HAS_ASSOCIATIONS") as Error & {
      associations: {
        workflows: { id: string; name: string }[];
        documents: { id: string; title: string }[];
      };
    };
    error.associations = {
      workflows: associatedWorkflows,
      documents: associatedDocuments,
    };
    throw error;
  }

  const result = await db
    .delete(documentTypes)
    .where(eq(documentTypes.id, id))
    .returning({ id: documentTypes.id });

  if (result.length === 0) {
    throw new Error("DOCUMENT_TYPE_NOT_FOUND");
  }

  return { success: true };
}
