import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  backgroundTasks,
  documents,
  nodeExecutions,
  workflows,
} from "../../db/schema";
import type {
  DesensitizeConfig,
  ExportConfig,
  ModelCallConfig,
  RestoreConfig,
  WorkflowNodeDef,
} from "@intelliflow/shared";
import { initDocumentExecution, advanceNode } from "./runtime.service";
import { detectSensitiveInfo, confirmDesensitization } from "./desensitize.service";
import { executeModelCallBackground } from "./model-call.service";
import { executeRestore } from "./restore.service";
import { generateExport } from "./export.service";

// ─── Background Pipeline Orchestrator ────────────────────────────────────────

/**
 * Execute the full document generation pipeline in the background.
 * Runs all nodes autonomously after input_transform is confirmed.
 * Fire-and-forget from the route handler.
 */
export async function executeDocumentPipeline(
  documentId: string,
  userId: string,
  startFromNodeId?: string,
): Promise<void> {
  const now = new Date();

  // Create background task row
  const [task] = await db
    .insert(backgroundTasks)
    .values({
      userId,
      taskType: "document_generation",
      status: "queued",
      documentId,
    })
    .returning();

  // Update to running
  await db
    .update(backgroundTasks)
    .set({ status: "running", startedAt: now, updatedAt: now })
    .where(eq(backgroundTasks.id, task.id));

  try {
    // Get node executions ordered by stepOrder
    const executions = await db
      .select()
      .from(nodeExecutions)
      .where(
        and(
          eq(nodeExecutions.documentId, documentId),
          eq(nodeExecutions.isCurrent, true),
        ),
      )
      .orderBy(asc(nodeExecutions.stepOrder));

    if (executions.length === 0) {
      throw new Error("No node executions found for document");
    }

    // Get workflow node definitions for config access
    const [docRow] = await db
      .select({ nodes: workflows.nodes })
      .from(documents)
      .innerJoin(workflows, eq(documents.workflowId, workflows.id))
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!docRow) throw new Error("Document or workflow not found");

    const wfNodes = docRow.nodes as WorkflowNodeDef[];
    const wfNodeMap = new Map(wfNodes.map((n) => [n.id, n]));

    // Determine start index
    let startIndex = 0;
    if (startFromNodeId) {
      const idx = executions.findIndex((e) => e.nodeId === startFromNodeId);
      if (idx >= 0) startIndex = idx;
    }

    const totalNodes = executions.length;

    // Loop through nodes
    for (let i = startIndex; i < totalNodes; i++) {
      const exec = executions[i];

      // Skip already completed or skipped nodes
      if (exec.status === "completed" || exec.status === "skipped") {
        continue;
      }

      const nodeDef = wfNodeMap.get(exec.nodeId);
      if (!nodeDef) {
        throw new Error(`Workflow node definition not found for nodeId: ${exec.nodeId}`);
      }

      // Update node to in_progress
      const nodeStart = new Date();
      await db
        .update(nodeExecutions)
        .set({ status: "in_progress", startedAt: nodeStart, updatedAt: nodeStart })
        .where(eq(nodeExecutions.id, exec.id));

      // Execute based on node type
      switch (exec.nodeType) {
        case "input_transform": {
          // Input transform is already confirmed before background execution starts — skip
          break;
        }

        case "desensitize": {
          await executeDesensitizeBackground(documentId, exec.id, nodeDef, userId);
          break;
        }

        case "model_call": {
          await executeModelCallBackground(documentId, exec.id, userId);
          break;
        }

        case "restore": {
          const restoreConfig = nodeDef.config as RestoreConfig;
          await executeRestore(documentId, exec.id, restoreConfig);
          break;
        }

        case "file_export": {
          const exportConfig = nodeDef.config as ExportConfig;
          const format = exportConfig.formats?.[0] ?? exportConfig.format ?? "markdown";
          const dateStr = new Date().toISOString().slice(0, 10);
          const ext = format === "word" ? "docx" : format;
          const filename = `document_${dateStr}.${ext}`;
          await generateExport(documentId, exec.id, format, filename, userId);
          break;
        }

        default: {
          console.warn(`[background] Unknown node type: ${exec.nodeType}, skipping`);
          break;
        }
      }

      // Advance node (marks current as completed, activates next)
      await advanceNode(documentId, exec.id, userId);

      // Update progress
      const progress = Math.round(((i + 1) / totalNodes) * 100);
      await db
        .update(backgroundTasks)
        .set({ progress, updatedAt: new Date() })
        .where(eq(backgroundTasks.id, task.id));
    }

    // Pipeline completed
    const completedAt = new Date();
    await db
      .update(backgroundTasks)
      .set({
        status: "completed",
        progress: 100,
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(backgroundTasks.id, task.id));

    // Ensure document is marked completed
    await db
      .update(documents)
      .set({ status: "completed", updatedAt: completedAt })
      .where(eq(documents.id, documentId));

    console.log(`[background] Pipeline completed for document ${documentId}`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[background] Pipeline failed for document ${documentId}:`, errorMessage);

    const failedAt = new Date();

    // Mark background task as failed
    await db
      .update(backgroundTasks)
      .set({
        status: "failed",
        errorMessage: errorMessage.slice(0, 2000),
        updatedAt: failedAt,
      })
      .where(eq(backgroundTasks.id, task.id));

    // Mark any in_progress node executions as failed
    const inProgressNodes = await db
      .select({ id: nodeExecutions.id })
      .from(nodeExecutions)
      .where(
        and(
          eq(nodeExecutions.documentId, documentId),
          eq(nodeExecutions.status, "in_progress"),
          eq(nodeExecutions.isCurrent, true),
        ),
      );

    for (const node of inProgressNodes) {
      await db
        .update(nodeExecutions)
        .set({
          status: "failed",
          errorMessage: errorMessage.slice(0, 2000),
          updatedAt: failedAt,
        })
        .where(eq(nodeExecutions.id, node.id));
    }

    // Mark document as failed
    await db
      .update(documents)
      .set({ status: "failed", updatedAt: failedAt })
      .where(eq(documents.id, documentId));
  }
}

// ─── Background Desensitize ─────────────────────────────────────────────────

/**
 * Run desensitize detection + confirmation automatically for background mode.
 * Uses the node's inputData text, detects sensitive info, then confirms all detected items.
 */
async function executeDesensitizeBackground(
  documentId: string,
  nodeExecutionId: string,
  nodeDef: WorkflowNodeDef,
  userId: string,
): Promise<void> {
  const config = nodeDef.config as DesensitizeConfig;

  // Get input text from the node's inputData
  const [exec] = await db
    .select({ inputData: nodeExecutions.inputData })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  const inputData = exec?.inputData as Record<string, unknown> | null;

  // Try to extract text from various input structures
  let text = "";
  if (inputData?.text && typeof inputData.text === "string") {
    text = inputData.text;
  } else if (inputData?.sources && typeof inputData.sources === "object") {
    // Multi-source input — concatenate all source texts
    const sources = inputData.sources as Record<string, { text?: string }>;
    text = Object.values(sources)
      .map((s) => s.text ?? "")
      .filter(Boolean)
      .join("\n\n");
  }

  if (!text) {
    // No text to desensitize — store empty output and return
    await db
      .update(nodeExecutions)
      .set({
        outputData: { text: "", mappingCount: 0 },
        updatedAt: new Date(),
      })
      .where(eq(nodeExecutions.id, nodeExecutionId));
    return;
  }

  // Detect sensitive info
  const items = await detectSensitiveInfo(text, config.localModelId, config.categories);

  // Apply all detections (auto-confirm in background mode)
  let sanitizedText = text;
  for (const item of items) {
    sanitizedText = sanitizedText.replaceAll(item.original, item.placeholder);
  }

  // Confirm desensitization (stores mappings + output)
  await confirmDesensitization(
    documentId,
    nodeExecutionId,
    items.map((item) => ({
      original: item.original,
      placeholder: item.placeholder,
      sensitiveType: item.sensitiveType,
    })),
    sanitizedText,
    userId,
  );
}

// ─── Orphan Detection ───────────────────────────────────────────────────────

/**
 * Detect and clean up orphaned background tasks on server startup.
 * Tasks with status='running' after a restart are orphans — mark them failed.
 */
export async function detectOrphanTasks(): Promise<number> {
  const orphans = await db
    .select({
      id: backgroundTasks.id,
      documentId: backgroundTasks.documentId,
    })
    .from(backgroundTasks)
    .where(eq(backgroundTasks.status, "running"));

  if (orphans.length === 0) return 0;

  const now = new Date();
  const errorMessage = "服务器重启，任务中断";

  for (const orphan of orphans) {
    // Mark background task as failed
    await db
      .update(backgroundTasks)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: now,
      })
      .where(eq(backgroundTasks.id, orphan.id));

    // Mark any in_progress node executions as failed
    if (orphan.documentId) {
      const inProgressNodes = await db
        .select({ id: nodeExecutions.id })
        .from(nodeExecutions)
        .where(
          and(
            eq(nodeExecutions.documentId, orphan.documentId),
            eq(nodeExecutions.status, "in_progress"),
            eq(nodeExecutions.isCurrent, true),
          ),
        );

      for (const node of inProgressNodes) {
        await db
          .update(nodeExecutions)
          .set({
            status: "failed",
            errorMessage,
            updatedAt: now,
          })
          .where(eq(nodeExecutions.id, node.id));
      }

      // Mark document as failed
      await db
        .update(documents)
        .set({ status: "failed", updatedAt: now })
        .where(eq(documents.id, orphan.documentId));
    }

    console.warn(`[background] Orphaned task ${orphan.id} marked as failed (server restart)`);
  }

  return orphans.length;
}
