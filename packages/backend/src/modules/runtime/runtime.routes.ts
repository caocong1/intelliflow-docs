import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isDocumentProjectMember } from "../versions/versions.service";
import {
  advanceNode,
  getDocumentRuntimeState,
  initDocumentExecution,
  rollbackToNode,
  saveNodeDraft,
  skipNode,
} from "./runtime.service";

export const runtimeRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  // ─── Initialize or resume document execution ─────────────────────────────

  .post(
    "/:documentId/init",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问运行时" };
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
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可推进节点" };
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
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可回退节点" };
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
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可保存草稿" };
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
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可跳过节点" };
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
  );
