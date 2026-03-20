import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db";
import { documents, nodeExecutions, workflows } from "../../db/schema";
import { createVersionSnapshot } from "../versions/versions.service";
import type { DocumentRuntimeState, NodeExecution, WorkflowEdgeDef, WorkflowNodeDef } from "@intelliflow/shared";

// ─── Helpers ────────────────────────────────────────────────────────────────

function toNodeExecution(row: typeof nodeExecutions.$inferSelect): NodeExecution {
  return {
    id: row.id,
    documentId: row.documentId,
    nodeId: row.nodeId,
    nodeLabel: row.nodeLabel,
    nodeType: row.nodeType as NodeExecution["nodeType"],
    status: row.status,
    stepOrder: row.stepOrder,
    inputData: row.inputData as Record<string, unknown> | null,
    outputData: row.outputData as Record<string, unknown> | null,
    selectedOutputKey: row.selectedOutputKey,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Topologically sort workflow nodes using edges (BFS from root nodes).
 * Root nodes = nodes with no incoming edges.
 */
function topologicalSort(nodes: WorkflowNodeDef[], edges: WorkflowEdgeDef[]): WorkflowNodeDef[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  // BFS from root nodes (inDegree === 0)
  const queue: string[] = [];
  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) queue.push(nodeId);
  }

  const sorted: WorkflowNodeDef[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const node = nodeMap.get(current);
    if (node) sorted.push(node);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

// ─── Core runtime functions ─────────────────────────────────────────────────

export async function initDocumentExecution(
  documentId: string,
  userId: string,
): Promise<DocumentRuntimeState> {
  // Check if executions already exist (resume case)
  const existing = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId))
    .orderBy(asc(nodeExecutions.stepOrder));

  if (existing.length > 0) {
    // Resume — return existing state
    return buildRuntimeState(documentId, existing);
  }

  // Load document + workflow
  const docRows = await db
    .select({
      id: documents.id,
      workflowId: documents.workflowId,
      status: documents.status,
      workflowName: workflows.name,
      nodes: workflows.nodes,
      edges: workflows.edges,
    })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  const doc = docRows[0];
  if (!doc) throw new Error("Document not found");

  const wfNodes = doc.nodes as WorkflowNodeDef[];
  const wfEdges = doc.edges as WorkflowEdgeDef[];

  // Topologically sort nodes
  const sorted = topologicalSort(wfNodes, wfEdges);

  // Create nodeExecution rows
  const now = new Date();
  const values = sorted.map((node, index) => ({
    documentId,
    nodeId: node.id,
    nodeLabel: node.label,
    nodeType: node.type,
    status: index === 0 ? ("in_progress" as const) : ("pending" as const),
    stepOrder: index,
    startedAt: index === 0 ? now : null,
  }));

  const inserted = await db.insert(nodeExecutions).values(values).returning();

  // Update document status to in_progress if currently draft
  if (doc.status === "draft") {
    await db
      .update(documents)
      .set({ status: "in_progress", updatedAt: now })
      .where(eq(documents.id, documentId));
  }

  return buildRuntimeState(documentId, inserted);
}

export async function getDocumentRuntimeState(
  documentId: string,
): Promise<DocumentRuntimeState | null> {
  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId))
    .orderBy(asc(nodeExecutions.stepOrder));

  if (executions.length === 0) return null;

  return buildRuntimeState(documentId, executions);
}

export async function advanceNode(
  documentId: string,
  nodeExecutionId: string,
  userId: string,
): Promise<DocumentRuntimeState> {
  const now = new Date();

  // Complete current node
  await db
    .update(nodeExecutions)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  // Get completed node info for version snapshot
  const [completedNode] = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (completedNode) {
    // Create version snapshot
    await createVersionSnapshot(
      documentId,
      completedNode.nodeId,
      completedNode.nodeLabel,
      (completedNode.outputData as Record<string, unknown>) ?? {},
      userId,
    );
  }

  // Find next pending node by stepOrder
  const nextNodes = await db
    .select()
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.status, "pending"),
      ),
    )
    .orderBy(asc(nodeExecutions.stepOrder))
    .limit(1);

  if (nextNodes.length > 0) {
    const nextNode = nextNodes[0];
    await db
      .update(nodeExecutions)
      .set({ status: "in_progress", startedAt: now, updatedAt: now })
      .where(eq(nodeExecutions.id, nextNode.id));

    // Check if next node has autoAdvance and is a restore node
    const wfData = await getWorkflowForDocument(documentId);
    if (wfData) {
      const nodeDef = wfData.nodes.find((n: WorkflowNodeDef) => n.id === nextNode.nodeId);
      if (nodeDef?.config?.autoAdvance && nodeDef.type === "restore") {
        // Auto-complete restore node
        await db
          .update(nodeExecutions)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(eq(nodeExecutions.id, nextNode.id));

        // Recursively advance to find the real next node
        return advanceNode(documentId, nextNode.id, userId);
      }
    }
  } else {
    // No next node — document completed
    await db
      .update(documents)
      .set({ status: "completed", updatedAt: now })
      .where(eq(documents.id, documentId));
  }

  // Return updated state
  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId))
    .orderBy(asc(nodeExecutions.stepOrder));

  return buildRuntimeState(documentId, executions);
}

export async function rollbackToNode(
  documentId: string,
  targetStepOrder: number,
  userId: string,
): Promise<DocumentRuntimeState> {
  const now = new Date();

  // Set target node to in_progress
  await db
    .update(nodeExecutions)
    .set({ status: "in_progress", startedAt: now, completedAt: null, updatedAt: now })
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.stepOrder, targetStepOrder),
      ),
    );

  // Set all nodes after target to pending (keep outputData for review)
  await db
    .update(nodeExecutions)
    .set({ status: "pending", startedAt: null, completedAt: null, updatedAt: now })
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        gt(nodeExecutions.stepOrder, targetStepOrder),
      ),
    );

  // Ensure document is in_progress
  await db
    .update(documents)
    .set({ status: "in_progress", updatedAt: now })
    .where(eq(documents.id, documentId));

  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId))
    .orderBy(asc(nodeExecutions.stepOrder));

  return buildRuntimeState(documentId, executions);
}

export async function saveNodeDraft(
  documentId: string,
  nodeExecutionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const now = new Date();
  await db
    .update(nodeExecutions)
    .set({ outputData: data, updatedAt: now })
    .where(eq(nodeExecutions.id, nodeExecutionId));
}

export async function skipNode(
  documentId: string,
  nodeExecutionId: string,
  userId: string,
): Promise<DocumentRuntimeState> {
  // Load node and verify skippable
  const [node] = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!node) throw new Error("Node execution not found");

  // Check workflow config for skippable flag
  const wfData = await getWorkflowForDocument(documentId);
  if (wfData) {
    const nodeDef = wfData.nodes.find((n: WorkflowNodeDef) => n.id === node.nodeId);
    if (!nodeDef?.config?.skippable) {
      throw new Error("This node cannot be skipped");
    }
  }

  const now = new Date();

  // Mark as skipped
  await db
    .update(nodeExecutions)
    .set({ status: "skipped", completedAt: now, updatedAt: now })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  // Advance to next node
  const nextNodes = await db
    .select()
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.status, "pending"),
      ),
    )
    .orderBy(asc(nodeExecutions.stepOrder))
    .limit(1);

  if (nextNodes.length > 0) {
    await db
      .update(nodeExecutions)
      .set({ status: "in_progress", startedAt: now, updatedAt: now })
      .where(eq(nodeExecutions.id, nextNodes[0].id));
  } else {
    // No next node — document completed
    await db
      .update(documents)
      .set({ status: "completed", updatedAt: now })
      .where(eq(documents.id, documentId));
  }

  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId))
    .orderBy(asc(nodeExecutions.stepOrder));

  return buildRuntimeState(documentId, executions);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

async function getWorkflowForDocument(documentId: string) {
  const rows = await db
    .select({
      nodes: workflows.nodes,
      edges: workflows.edges,
    })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  if (rows.length === 0) return null;
  return {
    nodes: rows[0].nodes as WorkflowNodeDef[],
    edges: rows[0].edges as WorkflowEdgeDef[],
  };
}

async function buildRuntimeState(
  documentId: string,
  executions: (typeof nodeExecutions.$inferSelect)[],
): Promise<DocumentRuntimeState> {
  // Get workflow name
  const docRows = await db
    .select({ workflowName: workflows.name })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  const workflowName = docRows[0]?.workflowName ?? "Unknown";

  // Compute currentNodeIndex
  let currentNodeIndex = executions.length - 1;
  for (let i = 0; i < executions.length; i++) {
    if (executions[i].status === "in_progress") {
      currentNodeIndex = i;
      break;
    }
  }

  return {
    documentId,
    workflowName,
    currentNodeIndex,
    nodes: executions.map(toNodeExecution),
  };
}
