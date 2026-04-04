import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  documentVersions,
  documentVisibilityMembers,
  documents,
  nodeExecutions,
  users,
  workflows,
} from "../../db/schema";
import { createDocumentWorkspace } from "../files/files.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocumentRow = {
  id: string;
  projectId: string;
  workflowId: string;
  title: string;
  description: string | null;
  status: "draft" | "in_progress" | "completed" | "failed";
  visibility: "self" | "project" | "specific";
  createdBy: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type DocumentListItem = DocumentRow & {
  creatorName: string;
  progressStep?: number;
  totalSteps?: number;
  currentNodeLabel?: string;
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createDocument(
  userId: string,
  body: { projectId: string; workflowId: string; title: string; description?: string },
): Promise<DocumentRow> {
  const [doc] = await db
    .insert(documents)
    .values({
      projectId: body.projectId,
      workflowId: body.workflowId,
      title: body.title,
      description: body.description ?? null,
      status: "draft",
      visibility: "project",
      createdBy: userId,
    })
    .returning();

  // Create workspace directories
  await createDocumentWorkspace(doc.id);

  return doc;
}

export async function listDocuments(
  projectId: string,
  userId: string,
  isOwner: boolean,
  params: { page: number; pageSize: number; search?: string; status?: string; sort?: string },
): Promise<{ data: DocumentListItem[]; total: number }> {
  const offset = (params.page - 1) * params.pageSize;

  // Base conditions
  const conditions = [
    eq(documents.projectId, projectId),
    eq(documents.isDeleted, false),
  ];

  // Search filter
  if (params.search) {
    conditions.push(ilike(documents.title, `%${params.search}%`));
  }

  // Status filter
  if (params.status && ["draft", "in_progress", "completed", "failed"].includes(params.status)) {
    conditions.push(eq(documents.status, params.status as "draft" | "in_progress" | "completed" | "failed"));
  }

  // Visibility filter: owner sees all, others see filtered
  if (!isOwner) {
    // User can see: visibility='project' OR createdBy=userId OR (visibility='specific' AND userId in members)
    const visibleSpecificIds = db
      .select({ documentId: documentVisibilityMembers.documentId })
      .from(documentVisibilityMembers)
      .where(eq(documentVisibilityMembers.userId, userId));

    conditions.push(
      or(
        eq(documents.visibility, "project"),
        eq(documents.createdBy, userId),
        and(
          eq(documents.visibility, "specific"),
          inArray(documents.id, visibleSpecificIds),
        ),
      ) ?? eq(documents.visibility, "project"),
    );
  }

  const whereClause = and(...conditions);

  // Count
  const [{ total }] = await db
    .select({ total: count() })
    .from(documents)
    .where(whereClause);

  // Data with creator name + progress subqueries
  const rows = await db
    .select({
      id: documents.id,
      projectId: documents.projectId,
      workflowId: documents.workflowId,
      title: documents.title,
      description: documents.description,
      status: documents.status,
      visibility: documents.visibility,
      createdBy: documents.createdBy,
      isDeleted: documents.isDeleted,
      deletedAt: documents.deletedAt,
      isArchived: documents.isArchived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      creatorName: users.displayName,
      progressStep: sql<number>`(
        SELECT COUNT(*)::int FROM node_executions ne
        WHERE ne.document_id = ${documents.id}
          AND ne.is_current = true
          AND ne.status IN ('completed', 'skipped')
      )`.as("progress_step"),
      totalSteps: sql<number>`(
        SELECT COUNT(*)::int FROM node_executions ne
        WHERE ne.document_id = ${documents.id}
          AND ne.is_current = true
      )`.as("total_steps"),
      currentNodeLabel: sql<string>`(
        SELECT ne.node_label FROM node_executions ne
        WHERE ne.document_id = ${documents.id}
          AND ne.is_current = true
          AND ne.status = 'in_progress'
        LIMIT 1
      )`.as("current_node_label"),
    })
    .from(documents)
    .innerJoin(users, eq(documents.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(documents.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  return { data: rows as DocumentListItem[], total };
}

export async function getDocument(documentId: string, userId: string, isOwner: boolean) {
  const rows = await db
    .select({
      id: documents.id,
      projectId: documents.projectId,
      workflowId: documents.workflowId,
      title: documents.title,
      description: documents.description,
      status: documents.status,
      visibility: documents.visibility,
      createdBy: documents.createdBy,
      isDeleted: documents.isDeleted,
      deletedAt: documents.deletedAt,
      isArchived: documents.isArchived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      creatorName: users.displayName,
      workflowName: workflows.name,
    })
    .from(documents)
    .innerJoin(users, eq(documents.createdBy, users.id))
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(and(eq(documents.id, documentId), eq(documents.isDeleted, false)))
    .limit(1);

  const doc = rows[0];
  if (!doc) return null;

  // Visibility check
  if (!isOwner && doc.createdBy !== userId) {
    if (doc.visibility === "self") return null;
    if (doc.visibility === "specific") {
      const memberCheck = await db
        .select({ id: documentVisibilityMembers.id })
        .from(documentVisibilityMembers)
        .where(
          and(
            eq(documentVisibilityMembers.documentId, documentId),
            eq(documentVisibilityMembers.userId, userId),
          ),
        )
        .limit(1);
      if (memberCheck.length === 0) return null;
    }
  }

  return doc;
}

export async function updateDocument(
  documentId: string,
  body: { title?: string; description?: string },
) {
  const [updated] = await db
    .update(documents)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId))
    .returning();

  return updated ?? null;
}

export async function deleteDocument(documentId: string) {
  const [deleted] = await db
    .update(documents)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId))
    .returning();

  return deleted ?? null;
}

export async function restoreDocument(documentId: string) {
  const [restored] = await db
    .update(documents)
    .set({
      isDeleted: false,
      deletedAt: null,
      isArchived: false,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId))
    .returning();

  return restored ?? null;
}

export async function permanentDeleteDocument(documentId: string) {
  return await db.transaction(async (tx) => {
    // Delete related rows first
    await tx.delete(documentVisibilityMembers).where(eq(documentVisibilityMembers.documentId, documentId));
    await tx.delete(documentVersions).where(eq(documentVersions.documentId, documentId));
    // Delete the document itself
    const [deleted] = await tx.delete(documents).where(eq(documents.id, documentId)).returning();
    return deleted ?? null;
  });
}

export async function updateVisibility(
  documentId: string,
  userId: string,
  visibility: "self" | "project" | "specific",
  memberIds?: string[],
) {
  return await db.transaction(async (tx) => {
    // Update visibility field
    const [updated] = await tx
      .update(documents)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(documents.id, documentId))
      .returning();

    if (!updated) return null;

    // Replace visibility members if specific
    await tx.delete(documentVisibilityMembers).where(eq(documentVisibilityMembers.documentId, documentId));

    if (visibility === "specific" && memberIds && memberIds.length > 0) {
      await tx.insert(documentVisibilityMembers).values(
        memberIds.map((uid) => ({
          documentId,
          userId: uid,
        })),
      );
    }

    return updated;
  });
}

export async function getDocumentRaw(documentId: string) {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDeletedDocuments(
  projectId: string,
  page: number,
  pageSize: number,
): Promise<{ data: DocumentListItem[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const whereClause = and(
    eq(documents.projectId, projectId),
    eq(documents.isDeleted, true),
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(documents)
    .where(whereClause);

  const rows = await db
    .select({
      id: documents.id,
      projectId: documents.projectId,
      workflowId: documents.workflowId,
      title: documents.title,
      description: documents.description,
      status: documents.status,
      visibility: documents.visibility,
      createdBy: documents.createdBy,
      isDeleted: documents.isDeleted,
      deletedAt: documents.deletedAt,
      isArchived: documents.isArchived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      creatorName: users.displayName,
    })
    .from(documents)
    .innerJoin(users, eq(documents.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(documents.deletedAt))
    .limit(pageSize)
    .offset(offset);

  return { data: rows as DocumentListItem[], total };
}
