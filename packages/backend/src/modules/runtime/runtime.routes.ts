import { and, count, desc, eq, inArray } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "../../db";
import { backgroundTasks, documents, nodeExecutions, projects } from "../../db/schema";
import { requireAdmin, requireAuth } from "../auth/auth.guard";
import { canEditDocument, isDocumentProjectMember } from "../versions/versions.service";
import {
  advanceNode,
  getDocumentRuntimeState,
  initDocumentExecution,
  rollbackToNode,
  saveNodeDraft,
  skipNode,
} from "./runtime.service";
import { executeDocumentPipeline } from "./background.service";

const MAX_CONCURRENT_TASKS_PER_USER = 3;

export const runtimeRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  // ─── Get all background tasks for current user ────────────────────────────

  .get(
    "/my-tasks",
    async ({ query, user }) => {
      const limit = Number(query.limit) || 20;
      const offset = Number(query.offset) || 0;

      const tasks = await db
        .select({
          id: backgroundTasks.id,
          status: backgroundTasks.status,
          progress: backgroundTasks.progress,
          errorMessage: backgroundTasks.errorMessage,
          documentId: backgroundTasks.documentId,
          documentTitle: documents.title,
          projectId: documents.projectId,
          projectName: projects.name,
          startedAt: backgroundTasks.startedAt,
          completedAt: backgroundTasks.completedAt,
          createdAt: backgroundTasks.createdAt,
        })
        .from(backgroundTasks)
        .leftJoin(documents, eq(backgroundTasks.documentId, documents.id))
        .leftJoin(projects, eq(documents.projectId, projects.id))
        .where(eq(backgroundTasks.userId, user!.id))
        .orderBy(desc(backgroundTasks.createdAt))
        .limit(limit)
        .offset(offset);

      return { tasks };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // ─── Initialize or resume document execution ─────────────────────────────

  .post(
    "/:documentId/init",
    async ({ params, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可初始化运行时" };
      }

      try {
        const state = await initDocumentExecution(params.documentId, user!.id);
        return state;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String() }),
    },
  )

  // ─── Get current runtime state ───────────────────────────────────────────

  .get(
    "/:documentId",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问运行时" };
      }

      const state = await getDocumentRuntimeState(params.documentId);
      if (!state) {
        set.status = 404;
        return { error: "未找到运行状态，请先初始化" };
      }

      return state;
    },
    {
      params: t.Object({ documentId: t.String() }),
    },
  )

  // ─── Advance (confirm) current node ──────────────────────────────────────

  .post(
    "/:documentId/advance/:nodeExecutionId",
    async ({ params, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可推进节点" };
      }

      try {
        const state = await advanceNode(params.documentId, params.nodeExecutionId, user!.id);
        return state;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
    },
  )

  // ─── Rollback to a previous node ─────────────────────────────────────────

  .post(
    "/:documentId/rollback",
    async ({ params, body, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可回退节点" };
      }

      try {
        const state = await rollbackToNode(params.documentId, body.targetStepOrder, user!.id);
        return state;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String() }),
      body: t.Object({ targetStepOrder: t.Number() }),
    },
  )

  // ─── Save node draft (auto-save) ─────────────────────────────────────────

  .put(
    "/:documentId/nodes/:nodeExecutionId/draft",
    async ({ params, body, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可保存草稿" };
      }

      try {
        await saveNodeDraft(params.documentId, params.nodeExecutionId, body.data as Record<string, unknown>);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({ data: t.Record(t.String(), t.Unknown()) }),
    },
  )

  // ─── Skip current node ────────────────────────────────────────────────────

  .post(
    "/:documentId/skip/:nodeExecutionId",
    async ({ params, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可跳过节点" };
      }

      try {
        const state = await skipNode(params.documentId, params.nodeExecutionId, user!.id);
        return state;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
    },
  )

  // ─── Start background document generation ─────────────────────────────────

  .post(
    "/:documentId/start-background",
    async ({ params, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可启动后台生成" };
      }

      // Check if this document already has an active background task (prevent duplicate submission)
      const [existingTask] = await db
        .select({ id: backgroundTasks.id })
        .from(backgroundTasks)
        .where(
          and(
            eq(backgroundTasks.documentId, params.documentId),
            inArray(backgroundTasks.status, ["queued", "running"]),
          ),
        )
        .limit(1);

      if (existingTask) {
        set.status = 409;
        return { error: "该文档已有正在执行的生成任务，请勿重复提交" };
      }

      // Per-user concurrent task limit
      const [{ count: activeCount }] = await db
        .select({ count: count() })
        .from(backgroundTasks)
        .where(
          and(
            eq(backgroundTasks.userId, user!.id),
            inArray(backgroundTasks.status, ["queued", "running"]),
          ),
        );

      if (activeCount >= MAX_CONCURRENT_TASKS_PER_USER) {
        set.status = 429;
        return { error: "已达到并发任务上限（最多 3 个），请等待现有任务完成后再试" };
      }

      try {
        // Initialize execution if not already initialized
        const state = await initDocumentExecution(params.documentId, user!.id);

        // Verify input_transform node is confirmed (completed)
        const inputNode = state.nodes.find((n) => n.nodeType === "input_transform");
        if (inputNode && inputNode.status !== "completed") {
          set.status = 400;
          return { error: "请先确认输入转换节点" };
        }

        // Fire-and-forget: run pipeline in background
        executeDocumentPipeline(params.documentId, user!.id).catch((err) => {
          console.error(`[background] Pipeline error for ${params.documentId}:`, err);
        });

        return { status: "queued" };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String() }),
    },
  );

// ─── Admin: Reset stuck documents ───────────────────────────────────────────

export const runtimeAdminRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAdmin)

  // Reset a single stuck document back to draft
  .post(
    "/:documentId/reset",
    async ({ params, set }) => {
      const [doc] = await db
        .select({ id: documents.id, status: documents.status })
        .from(documents)
        .where(eq(documents.id, params.documentId))
        .limit(1);

      if (!doc) {
        set.status = 404;
        return { error: "文档不存在" };
      }

      if (doc.status !== "in_progress" && doc.status !== "failed") {
        set.status = 400;
        return { error: `文档状态为「${doc.status}」，无需重置` };
      }

      const now = new Date();

      // Cancel any active background tasks for this document
      await db
        .update(backgroundTasks)
        .set({ status: "failed", errorMessage: "管理员手动重置", updatedAt: now })
        .where(
          and(
            eq(backgroundTasks.documentId, params.documentId),
            inArray(backgroundTasks.status, ["queued", "running"]),
          ),
        );

      // Mark all non-terminal node executions as failed
      await db
        .update(nodeExecutions)
        .set({ status: "failed", errorMessage: "管理员手动重置", updatedAt: now })
        .where(
          and(
            eq(nodeExecutions.documentId, params.documentId),
            inArray(nodeExecutions.status, ["pending", "in_progress"]),
            eq(nodeExecutions.isCurrent, true),
          ),
        );

      // Reset document to draft
      await db
        .update(documents)
        .set({ status: "draft", updatedAt: now })
        .where(eq(documents.id, params.documentId));

      return { success: true, message: "文档已重置为草稿状态，可重新发起生成" };
    },
    {
      params: t.Object({ documentId: t.String() }),
    },
  )

  // Batch reset all stuck documents
  .post(
    "/batch-reset-stuck",
    async () => {
      const now = new Date();
      const errorMessage = "管理员批量重置";

      // Find all stuck documents (in_progress with no active background task)
      const stuckDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.status, "in_progress"));

      let resetCount = 0;

      for (const doc of stuckDocs) {
        const [activeTask] = await db
          .select({ id: backgroundTasks.id })
          .from(backgroundTasks)
          .where(
            and(
              eq(backgroundTasks.documentId, doc.id),
              inArray(backgroundTasks.status, ["queued", "running"]),
            ),
          )
          .limit(1);

        if (!activeTask) {
          // No active task → stuck, reset it
          await db
            .update(nodeExecutions)
            .set({ status: "failed", errorMessage, updatedAt: now })
            .where(
              and(
                eq(nodeExecutions.documentId, doc.id),
                inArray(nodeExecutions.status, ["pending", "in_progress"]),
                eq(nodeExecutions.isCurrent, true),
              ),
            );

          await db
            .update(documents)
            .set({ status: "draft", updatedAt: now })
            .where(eq(documents.id, doc.id));

          resetCount++;
        }
      }

      return { success: true, resetCount, message: `已重置 ${resetCount} 个卡住的文档` };
    },
  );
