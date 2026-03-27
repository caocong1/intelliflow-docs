import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, eq, gt, max, sql } from "drizzle-orm";
import { db } from "../../db";
import { documents, nodeExecutions, workflows } from "../../db/schema";
import { createVersionSnapshot } from "../versions/versions.service";
import { evaluateExecutionRule } from "./conditions.service";
import type { DocumentRuntimeState, InputSource, NodeExecution, WorkflowEdgeDef, WorkflowNodeDef, NodeConfig } from "@intelliflow/shared";

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
    executionRound: row.executionRound,
    isCurrent: row.isCurrent,
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
    .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
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

  // Create working directory on disk
  const workDir = join(process.cwd(), "data", "workspaces", documentId);
  await mkdir(join(workDir, "input"), { recursive: true });
  await mkdir(join(workDir, "output"), { recursive: true });
  await mkdir(join(workDir, "export"), { recursive: true });

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
    .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
    .orderBy(asc(nodeExecutions.stepOrder));

  if (executions.length === 0) return null;

  return buildRuntimeState(documentId, executions);
}

export async function advanceNode(
  documentId: string,
  nodeExecutionId: string,
  userId: string,
  depth: number = 0,
): Promise<DocumentRuntimeState> {
  // Prevent infinite loops from misconfigured conditions
  if (depth > 50) {
    throw new Error("advanceNode recursion depth exceeded 50 — possible circular condition configuration");
  }
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
    // Auto-generate text field for input_transform if missing (confirm may have been skipped)
    if (completedNode.nodeType === "input_transform") {
      const od = completedNode.outputData as Record<string, unknown> | null;
      if (od?.fields && !od.text) {
        const fields = od.fields as Record<string, string>;
        const textParts: string[] = [];
        for (const [key, value] of Object.entries(fields)) {
          if (value) textParts.push(`[${key}]\n${value}`);
        }
        const files = od.files as Array<{ name?: string; parsedText?: string }> | undefined;
        if (files) {
          for (const f of files) {
            if (f.parsedText) textParts.push(`[${f.name}]\n${f.parsedText}`);
          }
        }
        od.text = textParts.join("\n\n---\n\n");
        od.confirmedAt = od.confirmedAt ?? new Date().toISOString();
        await db
          .update(nodeExecutions)
          .set({ outputData: od, updatedAt: now })
          .where(eq(nodeExecutions.id, nodeExecutionId));
        // Re-read after update
        const [updated] = await db.select().from(nodeExecutions).where(eq(nodeExecutions.id, nodeExecutionId)).limit(1);
        if (updated) Object.assign(completedNode, updated);
      }
    }

    // Create version snapshot
    await createVersionSnapshot(
      documentId,
      completedNode.nodeId,
      completedNode.nodeLabel,
      (completedNode.outputData as Record<string, unknown>) ?? {},
      userId,
    );
  }

  // Find next pending node by stepOrder (only current)
  const nextNodes = await db
    .select()
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.status, "pending"),
        eq(nodeExecutions.isCurrent, true),
      ),
    )
    .orderBy(asc(nodeExecutions.stepOrder))
    .limit(1);

  if (nextNodes.length > 0) {
    const nextNode = nextNodes[0];

    // Build inputData for the next node based on upstream outputData
    let nextInputData: Record<string, unknown> | null = null;
    const wfData = await getWorkflowForDocument(documentId);
    if (wfData && completedNode) {
      const nextNodeDef = wfData.nodes.find((n: WorkflowNodeDef) => n.id === nextNode.nodeId);
      const nextConfig = nextNodeDef?.config as { type: string; inputSources?: InputSource[] } | undefined;
      const inputSources = nextConfig?.inputSources;

      if (
        (nextConfig?.type === "desensitize" || nextConfig?.type === "restore") &&
        inputSources &&
        inputSources.length > 0
      ) {
        // Build multi-source inputData from upstream node's outputData
        const upstreamOutput = completedNode.outputData as Record<string, unknown> | null;
        const sources: Record<string, { displayName: string; text: string }> = {};

        for (const src of inputSources) {
          // Try to find the text content from upstream outputData
          let text = "";
          if (upstreamOutput) {
            // Check if upstream has sources structure (another desensitize/restore)
            const upstreamSources = upstreamOutput.sources as Record<string, { text?: string; desensitizedText?: string; restoredText?: string }> | undefined;
            if (upstreamSources?.[src.outputId]) {
              const s = upstreamSources[src.outputId];
              text = s.restoredText ?? s.desensitizedText ?? s.text ?? "";
            } else {
              // Try field-level lookup: strip "{nodeId}-field-" prefix from outputId to get fields key
              // e.g. "n1-field-f1" -> "f1", then look up upstreamOutput.fields["f1"]
              const fieldKeyMatch = src.outputId.match(/^.+-field-(.+)$/);
              const fieldKey = fieldKeyMatch?.[1];
              const fields = upstreamOutput.fields as Record<string, string> | undefined;
              if (fieldKey && fields?.[fieldKey]) {
                text = fields[fieldKey];
              } else {
                // Fall back to combined text or model output content
                text = (upstreamOutput.text as string) ?? (upstreamOutput.content as string) ?? "";
              }
            }
          }
          sources[src.outputId] = { displayName: src.displayName, text };
        }

        nextInputData = { sources };
      } else if (completedNode.outputData) {
        // Legacy single-input: pass text directly
        nextInputData = completedNode.outputData as Record<string, unknown>;
      }
    }

    // ── Conditional node execution: evaluate executionRule before entering node ──
    const nextNodeDef = wfData?.nodes.find((n: WorkflowNodeDef) => n.id === nextNode.nodeId);
    const executionRule = (nextNodeDef?.config as NodeConfig | undefined)?.executionRule;

    if (executionRule) {
      // Query fresh node executions for condition evaluation
      const freshExecs = await db
        .select()
        .from(nodeExecutions)
        .where(
          and(
            eq(nodeExecutions.documentId, documentId),
            eq(nodeExecutions.isCurrent, true),
          ),
        )
        .orderBy(asc(nodeExecutions.stepOrder));

      const { triggered, reason } = evaluateExecutionRule(
        executionRule,
        freshExecs.map((e) => ({ nodeId: e.nodeId, outputData: e.outputData as Record<string, unknown> | null })),
      );

      if (triggered) {
        if (executionRule.action === "skip") {
          // Mark as skipped with conditional skip metadata
          await db
            .update(nodeExecutions)
            .set({
              status: "skipped",
              outputData: { skipReason: reason, skipType: "conditional" },
              completedAt: now,
              updatedAt: now,
            })
            .where(eq(nodeExecutions.id, nextNode.id));

          // Recursively advance to find the real next node
          return advanceNode(documentId, nextNode.id, userId, (depth ?? 0) + 1);
        } else if (executionRule.action === "block") {
          // Mark as blocked — document stops here, frontend sees blocked node
          await db
            .update(nodeExecutions)
            .set({
              status: "blocked",
              outputData: { blockReason: reason, blockType: "conditional" },
              updatedAt: now,
            })
            .where(eq(nodeExecutions.id, nextNode.id));

          const executions = await db
            .select()
            .from(nodeExecutions)
            .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
            .orderBy(asc(nodeExecutions.stepOrder));
          return buildRuntimeState(documentId, executions);
        }
      }
    }

    // ── Normal case: set node to in_progress ──
    await db
      .update(nodeExecutions)
      .set({
        status: "in_progress",
        startedAt: now,
        updatedAt: now,
        ...(nextInputData ? { inputData: nextInputData } : {}),
      })
      .where(eq(nodeExecutions.id, nextNode.id));

    // Check if next node has autoAdvance and is a restore node
    if (wfData) {
      const nodeDef = wfData.nodes.find((n: WorkflowNodeDef) => n.id === nextNode.nodeId);
      if (nodeDef?.config?.autoAdvance && nodeDef.type === "restore") {
        // Auto-complete restore node
        await db
          .update(nodeExecutions)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(eq(nodeExecutions.id, nextNode.id));

        // Recursively advance to find the real next node
        return advanceNode(documentId, nextNode.id, userId, depth + 1);
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
    .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
    .orderBy(asc(nodeExecutions.stepOrder));

  return buildRuntimeState(documentId, executions);
}

export async function rollbackToNode(
  documentId: string,
  targetStepOrder: number,
  userId: string,
): Promise<DocumentRuntimeState> {
  const now = new Date();

  // Get current executions at target and downstream
  const affectedRows = await db
    .select()
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.isCurrent, true),
      ),
    )
    .orderBy(asc(nodeExecutions.stepOrder));

  const toRollback = affectedRows.filter((r) => r.stepOrder >= targetStepOrder);

  if (toRollback.length === 0) {
    throw new Error("No nodes found to rollback");
  }

  // Find max execution round among affected rows
  const maxRound = Math.max(...toRollback.map((r) => r.executionRound));
  const newRound = maxRound + 1;

  // Mark old rows as not current
  const oldIds = toRollback.map((r) => r.id);
  for (const id of oldIds) {
    await db
      .update(nodeExecutions)
      .set({ isCurrent: false, updatedAt: now })
      .where(eq(nodeExecutions.id, id));
  }

  // Create new execution rows with incremented round
  const newValues = toRollback.map((row, index) => ({
    documentId,
    nodeId: row.nodeId,
    nodeLabel: row.nodeLabel,
    nodeType: row.nodeType,
    status: index === 0 ? ("in_progress" as const) : ("pending" as const),
    stepOrder: row.stepOrder,
    executionRound: newRound,
    isCurrent: true,
    startedAt: index === 0 ? now : null,
  }));

  await db.insert(nodeExecutions).values(newValues);

  // Ensure document is in_progress
  await db
    .update(documents)
    .set({ status: "in_progress", updatedAt: now })
    .where(eq(documents.id, documentId));

  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
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

  // Advance to next node (only current)
  const nextNodes = await db
    .select()
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.status, "pending"),
        eq(nodeExecutions.isCurrent, true),
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
    .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
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
  // Get workflow name and nodes
  const docRows = await db
    .select({ workflowName: workflows.name, nodes: workflows.nodes })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  const workflowName = docRows[0]?.workflowName ?? "Unknown";
  const workflowNodes = (docRows[0]?.nodes as WorkflowNodeDef[]) ?? [];

  // Filter to only current executions
  const currentExecutions = executions.filter((e) => e.isCurrent);

  // Compute currentNodeIndex
  let currentNodeIndex = currentExecutions.length - 1;
  for (let i = 0; i < currentExecutions.length; i++) {
    if (currentExecutions[i].status === "in_progress") {
      currentNodeIndex = i;
      break;
    }
  }

  return {
    documentId,
    workflowName,
    currentNodeIndex,
    nodes: currentExecutions.map(toNodeExecution),
    workflowNodes,
  };
}
