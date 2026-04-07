import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../../db";
import {
  backgroundTasks,
  documents,
  nodeExecutions,
  projects,
  users,
  workflows,
} from "../../db/schema";
import type {
  DesensitizeConfig,
  ExportConfig,
  ModelCallConfig,
  NodeConfig,
  RestoreConfig,
  WorkflowNodeDef,
} from "@intelliflow/shared";
import { initDocumentExecution, advanceNode } from "./runtime.service";
import { detectSensitiveInfo, confirmDesensitization } from "./desensitize.service";
import { executeModelCallBackground } from "./model-call.service";
import { executeRestore } from "./restore.service";
import { generateExport } from "./export.service";
import { createNotification } from "../notifications/notifications.service";
import { sendTextCardMessage } from "../wecom/wecom.service";
import { evaluateExecutionRule } from "./conditions.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:4000";
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}秒`;
  if (seconds === 0) return `${minutes}分`;
  return `${minutes}分${seconds}秒`;
}

/**
 * Fetch document title and project info for notification content.
 */
async function getDocumentContext(documentId: string) {
  const [row] = await db
    .select({
      documentTitle: documents.title,
      projectId: documents.projectId,
      projectName: projects.name,
    })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  return row ?? { documentTitle: "未知文档", projectId: null, projectName: "未知项目" };
}

/**
 * Fetch user's wecomUserId for WeChat push.
 */
async function getUserWecomId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ wecomUserId: users.wecomUserId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row?.wecomUserId ?? null;
}

/**
 * Send completion notification (in-app + WeChat push).
 */
async function notifyCompletion(
  userId: string,
  documentId: string,
  durationMs: number,
) {
  const ctx = await getDocumentContext(documentId);
  const duration = formatDuration(durationMs);

  // In-app notification
  await createNotification({
    userId,
    type: "generation_completed",
    title: "文档生成完成",
    message: `文档「${ctx.documentTitle}」已生成完成，耗时 ${duration}`,
    documentId,
    projectId: ctx.projectId ?? undefined,
  });

  // WeChat push (best-effort)
  try {
    const wecomUserId = await getUserWecomId(userId);
    if (wecomUserId) {
      await sendTextCardMessage([wecomUserId], {
        title: "文档生成完成",
        description: `<div class="gray">项目：${ctx.projectName}</div><div class="normal">文档「${ctx.documentTitle}」已生成完成，耗时 ${duration}</div>`,
        url: `${getBaseUrl()}/projects/${ctx.projectId}/documents/${documentId}/workspace`,
        btntxt: "查看文档",
      });
    }
  } catch (err) {
    console.error("[background] WeChat push failed (completion):", err);
  }
}

/**
 * Send failure notification (in-app + WeChat push).
 */
async function notifyFailure(
  userId: string,
  documentId: string,
  errorSummary: string,
) {
  const ctx = await getDocumentContext(documentId);

  // In-app notification
  await createNotification({
    userId,
    type: "generation_failed",
    title: "文档生成失败",
    message: `文档「${ctx.documentTitle}」生成失败：${errorSummary}`,
    documentId,
    projectId: ctx.projectId ?? undefined,
  });

  // WeChat push (best-effort)
  try {
    const wecomUserId = await getUserWecomId(userId);
    if (wecomUserId) {
      await sendTextCardMessage([wecomUserId], {
        title: "文档生成失败",
        description: `<div class="gray">项目：${ctx.projectName}</div><div class="normal">文档「${ctx.documentTitle}」生成失败：${errorSummary}</div>`,
        url: `${getBaseUrl()}/projects/${ctx.projectId}/documents/${documentId}/workspace`,
        btntxt: "查看详情",
      });
    }
  } catch (err) {
    console.error("[background] WeChat push failed (failure):", err);
  }
}

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

      // Auto-skip nodes with skippable + autoAdvance config
      if (nodeDef.config.skippable === true && nodeDef.config.autoAdvance === true) {
        const skipNow = new Date();
        await db
          .update(nodeExecutions)
          .set({ status: "skipped", completedAt: skipNow, updatedAt: skipNow })
          .where(eq(nodeExecutions.id, exec.id));
        // Update progress
        const progress = Math.round(((i + 1) / totalNodes) * 100);
        await db
          .update(backgroundTasks)
          .set({ progress, updatedAt: new Date() })
          .where(eq(backgroundTasks.id, task.id));
        continue;
      }

      // ── Conditional node execution: evaluate executionRule before entering node ──
      const executionRule = (nodeDef.config as NodeConfig).executionRule;
      if (executionRule) {
        // Query fresh node executions from DB for condition evaluation
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
          const condNow = new Date();
          if (executionRule.action === "skip") {
            // Mark as skipped with conditional skip metadata
            await db
              .update(nodeExecutions)
              .set({
                status: "skipped",
                outputData: { skipReason: reason, skipType: "conditional" },
                completedAt: condNow,
                updatedAt: condNow,
              })
              .where(eq(nodeExecutions.id, exec.id));
            // Update progress and continue to next node
            const progress = Math.round(((i + 1) / totalNodes) * 100);
            await db
              .update(backgroundTasks)
              .set({ progress, updatedAt: condNow })
              .where(eq(backgroundTasks.id, task.id));
            continue;
          }
          if (executionRule.action === "block") {
            // Mark as blocked
            await db
              .update(nodeExecutions)
              .set({
                status: "blocked",
                outputData: { blockReason: reason, blockType: "conditional" },
                updatedAt: condNow,
              })
              .where(eq(nodeExecutions.id, exec.id));

            // Mark background task as failed with descriptive message
            const errorSummary = `条件阻断：节点「${nodeDef.label}」- ${reason}`;
            await db
              .update(backgroundTasks)
              .set({
                status: "failed",
                errorMessage: errorSummary.slice(0, 2000),
                updatedAt: condNow,
              })
              .where(eq(backgroundTasks.id, task.id));

            // Mark document as failed
            await db
              .update(documents)
              .set({ status: "failed", updatedAt: condNow })
              .where(eq(documents.id, documentId));

            // Send failure notification
            await notifyFailure(userId, documentId, errorSummary);

            // Stop pipeline
            return;
          }
        }
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

        case "export": {
          // Export is driven by frontend ExportExecutor — pipeline only sets it to in_progress
          break;
        }

        default: {
          console.warn(`[background] Unknown node type: ${exec.nodeType}, skipping`);
          break;
        }
      }

      // Interactive nodes: pause pipeline and return control to user
      if (exec.nodeType === "export") {
        // Export is already in_progress — don't advance, just exit pipeline
        const progress = Math.round(((i + 1) / totalNodes) * 100);
        await db.update(backgroundTasks).set({ progress, updatedAt: new Date() }).where(eq(backgroundTasks.id, task.id));
        break;
      }
      if (exec.nodeType === "model_call") {
        // Model finished — stay in_progress with output for user review/edit
        // User will click "确认并继续" to advance
        const progress = Math.round(((i + 1) / totalNodes) * 100);
        await db.update(backgroundTasks).set({ progress, updatedAt: new Date() }).where(eq(backgroundTasks.id, task.id));
        break;
      }

      // Auto nodes (desensitize, restore, input_transform): advance and continue
      await advanceNode(documentId, exec.id, userId);

      // Update progress
      const progress = Math.round(((i + 1) / totalNodes) * 100);
      await db
        .update(backgroundTasks)
        .set({ progress, updatedAt: new Date() })
        .where(eq(backgroundTasks.id, task.id));
    }

    // Check if all nodes are done or pipeline paused at an interactive node
    const freshExecs = await db
      .select()
      .from(nodeExecutions)
      .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)));
    const allDone = freshExecs.every((e) => e.status === "completed" || e.status === "skipped");

    const completedAt = new Date();
    await db
      .update(backgroundTasks)
      .set({
        status: "completed",
        progress: allDone ? 100 : Math.round((freshExecs.filter((e) => e.status === "completed" || e.status === "skipped").length / freshExecs.length) * 100),
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(backgroundTasks.id, task.id));

    if (allDone) {
      await db
        .update(documents)
        .set({ status: "completed", updatedAt: completedAt })
        .where(eq(documents.id, documentId));
    }

    console.log(`[background] Pipeline ${allDone ? "completed" : "paused"} for document ${documentId}`);

    // Only send completion notification when ALL nodes are done
    if (allDone) {
      const durationMs = completedAt.getTime() - now.getTime();
      await notifyCompletion(userId, documentId, durationMs);
    }
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

    // Send failure notifications
    await notifyFailure(userId, documentId, errorMessage.slice(0, 200));
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
        outputData: { text: "", mappingCount: 0, detectedItems: [] },
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
    items.map((item) => ({ placeholder: item.placeholder, sensitiveType: item.sensitiveType, checked: true })),
  );
}

// ─── Orphan Detection ───────────────────────────────────────────────────────

/**
 * Detect and clean up orphaned background tasks on server startup.
 * Handles both `running` and `queued` tasks interrupted by server restart,
 * as well as `in_progress` documents with no active background task.
 */
export async function detectOrphanTasks(): Promise<number> {
  let cleaned = 0;

  // 1. Clean up running/queued background tasks (interrupted by restart)
  const orphanTasks = await db
    .select({
      id: backgroundTasks.id,
      documentId: backgroundTasks.documentId,
      userId: backgroundTasks.userId,
    })
    .from(backgroundTasks)
    .where(inArray(backgroundTasks.status, ["running", "queued"]));

  const now = new Date();
  const errorMessage = "服务器重启，任务中断";

  for (const orphan of orphanTasks) {
    await cleanupFailedTask(orphan.id, orphan.documentId, orphan.userId, errorMessage, now);
    console.warn(`[background] Orphaned task ${orphan.id} marked as failed (server restart)`);
    cleaned++;
  }

  // 2. Clean up in_progress documents that have NO active (running/queued) background task.
  //    This catches the case where init was called but start-background never completed,
  //    or the task record was never created before a crash.
  const orphanDocIds = new Set(orphanTasks.map((t) => t.documentId).filter(Boolean));
  const staleDocuments = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.status, "in_progress"));

  for (const doc of staleDocuments) {
    // Skip if we already handled this document above
    if (orphanDocIds.has(doc.id)) continue;

    // Check if there's an active background task for this document
    const [activeTask] = await db
      .select({ id: backgroundTasks.id })
      .from(backgroundTasks)
      .where(
        and(
          eq(backgroundTasks.documentId, doc.id),
          inArray(backgroundTasks.status, ["running", "queued"]),
        ),
      )
      .limit(1);

    if (!activeTask) {
      // No active task → this document is stuck, mark as failed
      await db
        .update(nodeExecutions)
        .set({ status: "failed", errorMessage, updatedAt: now })
        .where(
          and(
            eq(nodeExecutions.documentId, doc.id),
            eq(nodeExecutions.status, "in_progress"),
            eq(nodeExecutions.isCurrent, true),
          ),
        );

      await db
        .update(documents)
        .set({ status: "failed", updatedAt: now })
        .where(eq(documents.id, doc.id));

      console.warn(`[background] Orphaned document ${doc.id} (no active task) marked as failed`);
      cleaned++;
    }
  }

  return cleaned;
}

// ─── Stuck Task Monitor ─────────────────────────────────────────────────────

/** How long a running task can stay alive before being considered stuck (ms). */
const STUCK_TASK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
/** How often to scan for stuck tasks (ms). */
const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let monitorTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically scan for tasks stuck in `running` state beyond the threshold.
 * This catches cases where a model API hangs past its AbortSignal timeout,
 * or any other scenario the try-catch in executeDocumentPipeline doesn't cover.
 */
export async function detectStuckTasks(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_TASK_THRESHOLD_MS);

  const stuckTasks = await db
    .select({
      id: backgroundTasks.id,
      documentId: backgroundTasks.documentId,
      userId: backgroundTasks.userId,
    })
    .from(backgroundTasks)
    .where(
      and(
        eq(backgroundTasks.status, "running"),
        lt(backgroundTasks.updatedAt, cutoff),
      ),
    );

  if (stuckTasks.length === 0) return 0;

  const errorMessage = "任务执行超时，已自动终止";
  const now = new Date();

  for (const task of stuckTasks) {
    await cleanupFailedTask(task.id, task.documentId, task.userId, errorMessage, now);
    console.warn(`[monitor] Stuck task ${task.id} marked as failed (no progress for ${STUCK_TASK_THRESHOLD_MS / 60000} min)`);
  }

  return stuckTasks.length;
}

/**
 * Start the periodic stuck-task monitor. Call once at server startup.
 */
export function startTaskMonitor(): void {
  if (monitorTimer) return;
  monitorTimer = setInterval(() => {
    detectStuckTasks().catch((err) => {
      console.error("[monitor] Failed to detect stuck tasks:", err);
    });
  }, MONITOR_INTERVAL_MS);
  console.log(`[monitor] Stuck-task monitor started (interval: ${MONITOR_INTERVAL_MS / 1000}s, threshold: ${STUCK_TASK_THRESHOLD_MS / 60000}min)`);
}

/**
 * Stop the periodic stuck-task monitor (for graceful shutdown / tests).
 */
export function stopTaskMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

// ─── Shared Cleanup Helper ──────────────────────────────────────────────────

/**
 * Mark a background task (and its associated node executions + document) as failed.
 */
async function cleanupFailedTask(
  taskId: string,
  documentId: string | null,
  userId: string,
  errorMessage: string,
  now: Date,
): Promise<void> {
  // Mark background task as failed
  await db
    .update(backgroundTasks)
    .set({ status: "failed", errorMessage, updatedAt: now })
    .where(eq(backgroundTasks.id, taskId));

  if (documentId) {
    // Mark any in_progress node executions as failed
    await db
      .update(nodeExecutions)
      .set({ status: "failed", errorMessage, updatedAt: now })
      .where(
        and(
          eq(nodeExecutions.documentId, documentId),
          eq(nodeExecutions.status, "in_progress"),
          eq(nodeExecutions.isCurrent, true),
        ),
      );

    // Mark document as failed
    await db
      .update(documents)
      .set({ status: "failed", updatedAt: now })
      .where(eq(documents.id, documentId));

    // Send failure notification (best-effort)
    try {
      await notifyFailure(userId, documentId, errorMessage);
    } catch (notifyErr) {
      console.error(`[background] Failed to send failure notification for task ${taskId}:`, notifyErr);
    }
  }
}
