import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  DocumentRuntimeState,
  InputSource,
  InputTransformConfig,
  NodeConfig,
  NodeExecution,
  WorkflowEdgeDef,
  WorkflowNodeDef,
} from "@intelliflow/shared";
import { and, asc, eq, gt, inArray, max, sql } from "drizzle-orm";
import { db } from "../../db";
import { backgroundTasks, documents, nodeExecutions, workflows } from "../../db/schema";
import { createVersionSnapshot } from "../versions/versions.service";
import { evaluateExecutionRule } from "./conditions.service";
import { getModelCallConfig, validateSelectedModelCallOutputData } from "./model-call.service";
import { buildSkippedNodeOutputData } from "./skip-output.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

type RuntimeInputSource = {
  displayName: string;
  text: string;
  sourceType?: "text" | "file";
  fileId?: string;
  fileName?: string;
};

type UpstreamFileSource = {
  fileId: string;
  name: string;
  text?: string;
  desensitizedText?: string;
  restoredText?: string;
};

type UpstreamSourceOutput = {
  displayName?: string;
  text?: string;
  desensitizedText?: string;
  restoredText?: string;
  files?: UpstreamFileSource[];
};

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
  depth = 0,
): Promise<DocumentRuntimeState> {
  // Prevent infinite loops from misconfigured conditions
  if (depth > 50) {
    throw new Error(
      "advanceNode recursion depth exceeded 50 — possible circular condition configuration",
    );
  }
  const now = new Date();

  const [currentNode] = await db
    .select({
      nodeType: nodeExecutions.nodeType,
      outputData: nodeExecutions.outputData,
      selectedOutputKey: nodeExecutions.selectedOutputKey,
    })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!currentNode) {
    throw new Error("Node execution not found");
  }

  if (currentNode.nodeType === "model_call") {
    const config = await getModelCallConfig(nodeExecutionId);
    if (config?.type === "model_call") {
      const validation = validateSelectedModelCallOutputData(
        (currentNode.outputData as Record<string, unknown> | null) ?? null,
        config,
        currentNode.selectedOutputKey,
      );

      if (validation.status === "format_error") {
        throw new Error(validation.errors?.join("\n") ?? "当前模型输出校验失败");
      }
    }
  }

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
        const [updated] = await db
          .select()
          .from(nodeExecutions)
          .where(eq(nodeExecutions.id, nodeExecutionId))
          .limit(1);
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
      const nextConfig = nextNodeDef?.config as
        | { type: string; inputSources?: InputSource[] }
        | undefined;
      const inputSources = nextConfig?.inputSources;

      if (
        (nextConfig?.type === "desensitize" || nextConfig?.type === "restore") &&
        inputSources &&
        inputSources.length > 0
      ) {
        // Build multi-source inputData from upstream node's outputData
        const upstreamOutput = completedNode.outputData as Record<string, unknown> | null;
        const sources: Record<string, RuntimeInputSource> = {};

        for (const src of inputSources) {
          if (!upstreamOutput) continue;

          // Check if upstream has sources structure (another desensitize/restore)
          const upstreamSources = upstreamOutput.sources as
            | Record<string, UpstreamSourceOutput>
            | undefined;
          if (upstreamSources?.[src.outputId]) {
            const s = upstreamSources[src.outputId];
            const displayName = s.displayName?.trim() || src.displayName;
            const files = s.files ?? [];

            if (files.length > 1) {
              let addedFileSource = false;
              for (const file of files) {
                const fileText = file.restoredText ?? file.desensitizedText ?? file.text ?? "";
                if (fileText) {
                  const fileName = file.name?.trim() || file.fileId;
                  sources[`${src.outputId}::file::${file.fileId}`] = {
                    displayName: fileName,
                    text: fileText,
                    sourceType: "file",
                    fileId: file.fileId,
                    fileName,
                  };
                  addedFileSource = true;
                }
              }
              if (addedFileSource) continue;
            }

            const singleFile = files.length === 1 ? files[0] : undefined;
            const text = singleFile
              ? (singleFile.restoredText ??
                singleFile.desensitizedText ??
                singleFile.text ??
                s.restoredText ??
                s.desensitizedText ??
                s.text ??
                "")
              : (s.restoredText ?? s.desensitizedText ?? s.text ?? "");
            if (text) {
              const fileName = singleFile
                ? singleFile.name?.trim() || singleFile.fileId
                : undefined;
              sources[src.outputId] = {
                displayName: fileName ?? displayName,
                text,
                ...(singleFile
                  ? { sourceType: "file" as const, fileId: singleFile.fileId, fileName }
                  : {}),
              };
            }
            continue;
          }

          // Resolve outputId against the upstream node's declared outputs first.
          // inputSources.outputId may be either the canonical `${nodeId}-field-...` /
          // `${nodeId}-fileslot-...` form or a bare `segmentKey` (legacy seeds did this).
          // Normalizing to the canonical id lets the regex dispatch below route both
          // shapes to the same lookup path instead of falling back to the combined blob.
          const sourceNodeDef = wfData?.nodes.find(
            (n: WorkflowNodeDef) => n.id === src.sourceNodeId,
          );
          const inputTransformFields =
            sourceNodeDef?.config.type === "input_transform"
              ? (sourceNodeDef.config as InputTransformConfig).formFields
              : undefined;
          const matchedOutput = sourceNodeDef?.outputs.find(
            (o) => o.id === src.outputId || o.segmentKey === src.outputId,
          );
          const resolvedOutputId = matchedOutput?.id ?? src.outputId;
          const candidateOutputKeys = [
            src.outputId,
            matchedOutput?.segmentKey,
            matchedOutput?.id,
            resolvedOutputId,
          ].filter((value): value is string => typeof value === "string" && value.length > 0);

          const outputItems = upstreamOutput.outputItems as
            | Record<string, { content?: string }>
            | undefined;
          if (outputItems && typeof outputItems === "object" && !Array.isArray(outputItems)) {
            for (const key of candidateOutputKeys) {
              const text = outputItems[key]?.content;
              if (typeof text === "string" && text) {
                sources[src.outputId] = {
                  displayName: src.displayName,
                  text,
                  sourceType: "text",
                };
                break;
              }
            }
            if (sources[src.outputId]) {
              continue;
            }
          }

          // Try field-level lookup: strip "{nodeId}-field-" prefix from outputId to get fields key
          const fieldKeyMatch = resolvedOutputId.match(/^.+-field-(.+)$/);
          const fieldKey = fieldKeyMatch?.[1];
          const fields = upstreamOutput.fields as Record<string, string> | undefined;
          const fieldsByKey = upstreamOutput.fieldsByKey as Record<string, string> | undefined;

          // Text field — single source (try fields by id first, then by machineKey)
          if (fieldKey) {
            const matchedField = inputTransformFields?.find(
              (field) => field.id === fieldKey || field.machineKey === fieldKey,
            );
            const fieldValue =
              fields?.[fieldKey] ??
              fieldsByKey?.[fieldKey] ??
              (matchedField ? fields?.[matchedField.id] : undefined);
            if (fieldValue) {
              sources[src.outputId] = {
                displayName: src.displayName,
                text: fieldValue,
                sourceType: "text",
              };
              continue;
            }

            // Explicit input fields should stay empty instead of falling back to the
            // aggregate output text, otherwise the UI renders fake tabs for empty items.
            if (matchedField && matchedField.type !== "file") {
              continue;
            }
          }

          // FileSlot source — match {nodeId}-fileslot-{fileSlotId} pattern
          const fileslotMatch = resolvedOutputId.match(/-fileslot-(.+)$/);
          if (fileslotMatch) {
            const fileSlotId = fileslotMatch[1];
            const fileSlots = upstreamOutput.fileSlots as
              | Record<string, { text?: string; files?: Array<{ fileId: string; name: string }> }>
              | undefined;
            const allFiles = upstreamOutput.files as
              | Array<{ fileId: string; name: string; parsedText: string }>
              | undefined;

            if (fileSlots?.[fileSlotId]) {
              const slot = fileSlots[fileSlotId];
              const slotFiles = slot.files ?? [];

              if (slotFiles.length > 1 && allFiles) {
                for (const sf of slotFiles) {
                  const fileData = allFiles.find((f) => f.fileId === sf.fileId);
                  const fileText = fileData?.parsedText ?? "";
                  if (fileText) {
                    sources[`${src.outputId}::file::${sf.fileId}`] = {
                      displayName: sf.name,
                      text: fileText,
                      sourceType: "file",
                      fileId: sf.fileId,
                      fileName: sf.name,
                    };
                  }
                }
              } else if (slot.text) {
                const singleFile = slotFiles[0];
                sources[src.outputId] = {
                  displayName: singleFile?.name ?? src.displayName,
                  text: slot.text,
                  sourceType: "file",
                  fileId: singleFile?.fileId,
                  fileName: singleFile?.name,
                };
              }
            }
            const draftSlotFiles = (
              upstreamOutput.files as
                | Array<{ fileId: string; name: string; parsedText: string; slotId?: string }>
                | undefined
            )?.filter((file) => file.slotId === fileSlotId);
            if (draftSlotFiles?.length) {
              if (draftSlotFiles.length > 1) {
                for (const file of draftSlotFiles) {
                  if (file.parsedText) {
                    sources[`${src.outputId}::file::${file.fileId}`] = {
                      displayName: file.name,
                      text: file.parsedText,
                      sourceType: "file",
                      fileId: file.fileId,
                      fileName: file.name,
                    };
                  }
                }
              } else if (draftSlotFiles[0].parsedText) {
                const singleFile = draftSlotFiles[0];
                sources[src.outputId] = {
                  displayName: singleFile.name ?? src.displayName,
                  text: singleFile.parsedText,
                  sourceType: "file",
                  fileId: singleFile.fileId,
                  fileName: singleFile.name,
                };
              }
            }
            // File slot outputs are explicit inputs as well. If the slot is empty,
            // skip it instead of falling back to the merged `[f1] ...` text blob.
            continue;
          }

          // File-upload combined output — split into individual file sources
          if (resolvedOutputId.match(/-file-upload$/)) {
            const hasExplicitFileSlots = inputTransformFields?.some(
              (field) => field.type === "file" && field.fileSlotId,
            );
            if (hasExplicitFileSlots) {
              continue;
            }
            const allFiles = upstreamOutput.files as
              | Array<{ fileId: string; name: string; parsedText: string }>
              | undefined;
            if (allFiles?.length) {
              for (const file of allFiles) {
                if (file.parsedText) {
                  sources[`${src.outputId}::file::${file.fileId}`] = {
                    displayName: file.name,
                    text: file.parsedText,
                    sourceType: "file",
                    fileId: file.fileId,
                    fileName: file.name,
                  };
                }
              }
            }
            continue;
          }

          // Fallback to combined text (last resort for unknown output patterns)
          const fallback =
            (upstreamOutput.text as string) ?? (upstreamOutput.content as string) ?? "";
          if (fallback) sources[src.outputId] = { displayName: src.displayName, text: fallback };
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
        .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
        .orderBy(asc(nodeExecutions.stepOrder));

      const { triggered, reason } = evaluateExecutionRule(
        executionRule,
        freshExecs.map((e) => ({
          nodeId: e.nodeId,
          outputData: e.outputData as Record<string, unknown> | null,
        })),
      );

      if (triggered) {
        if (executionRule.action === "skip") {
          const skippedOutput = buildSkippedNodeOutputData({
            nodeId: nextNode.nodeId,
            config: nextNodeDef!.config as NodeConfig,
            nodeExecs: freshExecs.map((e) => ({
              nodeId: e.nodeId,
              outputData: e.outputData as Record<string, unknown> | null,
            })),
            skipReason: reason,
            skipContext: "conditional",
          });
          // Mark as skipped with conditional skip metadata
          await db
            .update(nodeExecutions)
            .set({
              status: "skipped",
              outputData: skippedOutput.outputData,
              selectedOutputKey: skippedOutput.selectedOutputKey,
              completedAt: now,
              updatedAt: now,
            })
            .where(eq(nodeExecutions.id, nextNode.id));

          // Recursively advance to find the real next node
          return advanceNode(documentId, nextNode.id, userId, (depth ?? 0) + 1);
        }
        if (executionRule.action === "block") {
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
            .where(
              and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)),
            )
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
    .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
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

  // Create new execution rows with incremented round.
  // Only the rollback target keeps its state:
  // - input_transform keeps outputData so the form can be edited again
  // - other target nodes keep inputData so they can be re-run from their upstream inputs
  // All downstream nodes must be cleared, otherwise stale inputs from the previous round leak
  // into the new execution round.
  const newValues = toRollback.map((row, index) => {
    const isTarget = index === 0;
    return {
      documentId,
      nodeId: row.nodeId,
      nodeLabel: row.nodeLabel,
      nodeType: row.nodeType,
      status: isTarget ? ("in_progress" as const) : ("pending" as const),
      stepOrder: row.stepOrder,
      executionRound: newRound,
      isCurrent: true,
      inputData: isTarget ? row.inputData : null,
      outputData: isTarget && row.nodeType === "input_transform" ? row.outputData : null,
      startedAt: isTarget ? now : null,
    };
  });

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
  const executionsBeforeSkip = await db
    .select()
    .from(nodeExecutions)
    .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
    .orderBy(asc(nodeExecutions.stepOrder));

  const nodeDef = wfData?.nodes.find((n: WorkflowNodeDef) => n.id === node.nodeId);
  if (!nodeDef) {
    throw new Error("Workflow node definition not found");
  }
  const skippedOutput = buildSkippedNodeOutputData({
    nodeId: node.nodeId,
    config: nodeDef.config as NodeConfig,
    nodeExecs: executionsBeforeSkip.map((exec) => ({
      nodeId: exec.nodeId,
      outputData: exec.outputData as Record<string, unknown> | null,
    })),
    skipContext: "manual",
  });

  // Mark as skipped
  await db
    .update(nodeExecutions)
    .set({
      status: "skipped",
      outputData: skippedOutput.outputData,
      selectedOutputKey: skippedOutput.selectedOutputKey,
      completedAt: now,
      updatedAt: now,
    })
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
    .select({
      documentTitle: documents.title,
      workflowName: workflows.name,
      nodes: workflows.nodes,
      projectId: documents.projectId,
    })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  const documentTitle = docRows[0]?.documentTitle ?? "未命名文档";
  const workflowName = docRows[0]?.workflowName ?? "Unknown";
  const workflowNodes = (docRows[0]?.nodes as WorkflowNodeDef[]) ?? [];
  const projectId = docRows[0]?.projectId ?? null;

  const activeBackgroundTasks = await db
    .select({ id: backgroundTasks.id })
    .from(backgroundTasks)
    .where(
      and(
        eq(backgroundTasks.documentId, documentId),
        inArray(backgroundTasks.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  const backgroundTaskActive = activeBackgroundTasks.length > 0;

  // Filter to only current executions
  const currentExecutions = executions.filter((e) => e.isCurrent);

  // Compute currentNodeIndex: first node that still needs work
  let currentNodeIndex = currentExecutions.length - 1;
  for (let i = 0; i < currentExecutions.length; i++) {
    const status = currentExecutions[i].status;
    if (status !== "completed" && status !== "skipped") {
      currentNodeIndex = i;
      break;
    }
  }

  return {
    documentId,
    projectId,
    documentTitle,
    workflowName,
    currentNodeIndex,
    backgroundTaskActive,
    nodes: currentExecutions.map(toNodeExecution),
    workflowNodes,
  };
}
