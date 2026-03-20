import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { documentTypes, workflows } from "../../db/schema";
import type { WorkflowEdgeDef, WorkflowListItem, WorkflowNodeDef, WorkflowStatus } from "@intelliflow/shared";
import { validateWorkflow } from "./validation";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkflowRow = {
  id: string;
  documentTypeId: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "disabled";
  isDefault: boolean;
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

// ── List ──────────────────────────────────────────────────────────────────────

export async function listWorkflows(params: {
  documentTypeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<{ data: WorkflowListItem[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (params.documentTypeId) {
    conditions.push(eq(workflows.documentTypeId, params.documentTypeId));
  }
  if (params.search) {
    conditions.push(ilike(workflows.name, `%${params.search}%`));
  }
  if (params.status) {
    conditions.push(eq(workflows.status, params.status as "draft" | "active" | "disabled"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: workflows.id,
      documentTypeId: workflows.documentTypeId,
      documentTypeName: documentTypes.name,
      name: workflows.name,
      description: workflows.description,
      status: workflows.status,
      isDefault: workflows.isDefault,
      nodeCount: sql<number>`jsonb_array_length(${workflows.nodes})`,
      createdAt: workflows.createdAt,
      updatedAt: workflows.updatedAt,
    })
    .from(workflows)
    .leftJoin(documentTypes, eq(workflows.documentTypeId, documentTypes.id))
    .where(whereClause)
    .orderBy(desc(workflows.createdAt))
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(workflows)
    .where(whereClause);

  const data: WorkflowListItem[] = rows.map((row) => ({
    id: row.id,
    documentTypeId: row.documentTypeId,
    documentTypeName: row.documentTypeName ?? "",
    name: row.name,
    description: row.description ?? null,
    status: row.status as WorkflowStatus,
    isDefault: row.isDefault,
    nodeCount: Number(row.nodeCount),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return { data, total: Number(countResult[0]?.count ?? 0) };
}

// ── Get single ────────────────────────────────────────────────────────────────

export async function getWorkflow(id: string): Promise<WorkflowRow> {
  const result = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1);

  if (result.length === 0) {
    throw new Error("WORKFLOW_NOT_FOUND");
  }

  return result[0] as WorkflowRow;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createWorkflow(input: {
  documentTypeId: string;
  name: string;
  description?: string | null;
}): Promise<WorkflowRow> {
  // Verify document type exists
  const docType = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(eq(documentTypes.id, input.documentTypeId))
    .limit(1);

  if (docType.length === 0) {
    throw new Error("DOCUMENT_TYPE_NOT_FOUND");
  }

  const result = await db
    .insert(workflows)
    .values({
      documentTypeId: input.documentTypeId,
      name: input.name,
      description: input.description ?? null,
      status: "draft",
      isDefault: false,
      nodes: [],
      edges: [],
      schemaVersion: 1,
    })
    .returning();

  return result[0] as WorkflowRow;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateWorkflow(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    nodes?: WorkflowNodeDef[];
    edges?: WorkflowEdgeDef[];
  },
): Promise<WorkflowRow> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.nodes !== undefined) updateData.nodes = input.nodes;
  if (input.edges !== undefined) updateData.edges = input.edges;

  const result = await db
    .update(workflows)
    .set(updateData)
    .where(eq(workflows.id, id))
    .returning();

  if (result.length === 0) {
    throw new Error("WORKFLOW_NOT_FOUND");
  }

  return result[0] as WorkflowRow;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteWorkflow(id: string): Promise<{ success: true }> {
  const result = await db
    .delete(workflows)
    .where(eq(workflows.id, id))
    .returning({ id: workflows.id });

  if (result.length === 0) {
    throw new Error("WORKFLOW_NOT_FOUND");
  }

  return { success: true };
}

// ── Toggle status ─────────────────────────────────────────────────────────────

export async function toggleWorkflowStatus(
  id: string,
  status: WorkflowStatus,
): Promise<WorkflowRow> {
  const current = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1);

  if (current.length === 0) {
    throw new Error("WORKFLOW_NOT_FOUND");
  }

  const workflow = current[0];

  // If enabling to active, validate first
  if (status === "active") {
    const validationErrors = validateWorkflow(
      (workflow.nodes as WorkflowNodeDef[]) ?? [],
      (workflow.edges as WorkflowEdgeDef[]) ?? [],
    );
    const errorItems = validationErrors.filter((e) => e.severity === "error");
    if (errorItems.length > 0) {
      throw new Error("WORKFLOW_VALIDATION_FAILED");
    }
  }

  const result = await db
    .update(workflows)
    .set({ status, updatedAt: new Date() })
    .where(eq(workflows.id, id))
    .returning();

  return result[0] as WorkflowRow;
}

// ── Copy ──────────────────────────────────────────────────────────────────────

export async function copyWorkflow(
  id: string,
  input: { name: string; targetDocumentTypeId?: string },
): Promise<WorkflowRow> {
  const source = await getWorkflow(id);

  const targetDocumentTypeId = input.targetDocumentTypeId ?? source.documentTypeId;

  // Verify target document type exists if different
  if (targetDocumentTypeId !== source.documentTypeId) {
    const docType = await db
      .select({ id: documentTypes.id })
      .from(documentTypes)
      .where(eq(documentTypes.id, targetDocumentTypeId))
      .limit(1);

    if (docType.length === 0) {
      throw new Error("DOCUMENT_TYPE_NOT_FOUND");
    }
  }

  const result = await db
    .insert(workflows)
    .values({
      documentTypeId: targetDocumentTypeId,
      name: input.name,
      description: source.description,
      status: "draft",
      isDefault: false,
      nodes: source.nodes as WorkflowNodeDef[],
      edges: source.edges as WorkflowEdgeDef[],
      schemaVersion: source.schemaVersion,
    })
    .returning();

  return result[0] as WorkflowRow;
}

// ── Set default ───────────────────────────────────────────────────────────────

export async function setDefaultWorkflow(id: string): Promise<WorkflowRow> {
  const current = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1);

  if (current.length === 0) {
    throw new Error("WORKFLOW_NOT_FOUND");
  }

  const workflow = current[0];

  if (workflow.status !== "active") {
    throw new Error("WORKFLOW_NOT_ACTIVE");
  }

  // Transaction: unset all defaults for this document type, then set this one
  await db.transaction(async (tx) => {
    // Unset all defaults for the same document type
    await tx
      .update(workflows)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(workflows.documentTypeId, workflow.documentTypeId));

    // Set this one as default
    await tx
      .update(workflows)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(workflows.id, id));
  });

  // Fetch fresh result
  const updated = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1);

  return updated[0] as WorkflowRow;
}
