import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isProjectMember, isProjectOwner } from "../projects/projects.service";
import {
  createDocument,
  deleteDocument,
  getDocument,
  getDocumentRaw,
  listDeletedDocuments,
  listDocuments,
  permanentDeleteDocument,
  restoreDocument,
  updateDocument,
  updateVisibility,
} from "./documents.service";

export const documentMgmtRoutes = new Elysia({ prefix: "/documents" })
  .use(requireAuth)

  // ─── List documents (with visibility filtering) ──────────────────────────────

  .get(
    "/",
    async ({ query, user, set }) => {
      const projectId = query.projectId;
      if (!projectId) {
        set.status = 400;
        return { error: "缺少项目ID" };
      }

      const member = await isProjectMember(projectId, user!.id);
      if (!member) {
        set.status = 403;
        return { error: "仅项目成员可查看文档" };
      }

      const owner = await isProjectOwner(projectId, user!.id);
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 20;

      const { data, total } = await listDocuments(projectId, user!.id, owner, {
        page,
        pageSize,
        search: query.search || undefined,
        status: query.status || undefined,
        sort: query.sort || undefined,
      });

      return { data, total, page, pageSize };
    },
    {
      query: t.Object({
        projectId: t.String(),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        search: t.Optional(t.String()),
        status: t.Optional(t.String()),
        sort: t.Optional(t.String()),
      }),
    },
  )

  // ─── List deleted documents (recycle bin) ────────────────────────────────────

  .get(
    "/deleted",
    async ({ query, user, set }) => {
      const projectId = query.projectId;
      if (!projectId) {
        set.status = 400;
        return { error: "缺少项目ID" };
      }

      const owner = await isProjectOwner(projectId, user!.id);
      if (!owner) {
        set.status = 403;
        return { error: "仅项目负责人可查看回收站" };
      }

      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 20;

      const { data, total } = await listDeletedDocuments(projectId, page, pageSize);
      return { data, total, page, pageSize };
    },
    {
      query: t.Object({
        projectId: t.String(),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  )

  // ─── Create document ─────────────────────────────────────────────────────────

  .post(
    "/",
    async ({ body, user, set }) => {
      const member = await isProjectMember(body.projectId, user!.id);
      if (!member) {
        set.status = 403;
        return { error: "仅项目成员可创建文档" };
      }

      try {
        const doc = await createDocument(user!.id, body);
        set.status = 201;
        return doc;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("23503") || message.includes("foreign key")) {
          set.status = 400;
          return { error: "无效的项目ID或工作流ID" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        projectId: t.String(),
        workflowId: t.String(),
        title: t.String({ minLength: 1, maxLength: 300 }),
        description: t.Optional(t.String({ maxLength: 1000 })),
      }),
    },
  )

  // ─── Get document detail ──────────────────────────────────────────────────────

  .get(
    "/:id",
    async ({ params, user, set }) => {
      // We need the document to check projectId for member check
      // First fetch without visibility to get projectId
      const doc = await getDocument(params.id, user!.id, false);
      if (!doc) {
        // Try again as owner check for each project the user belongs to
        // Simplified: just check if doc exists at all first
        set.status = 404;
        return { error: "文档不存在" };
      }

      const member = await isProjectMember(doc.projectId, user!.id);
      if (!member) {
        set.status = 403;
        return { error: "仅项目成员可查看文档" };
      }

      const owner = await isProjectOwner(doc.projectId, user!.id);
      // Re-fetch with proper ownership context
      const result = await getDocument(params.id, user!.id, owner);
      if (!result) {
        set.status = 403;
        return { error: "你没有该文档的查看权限" };
      }

      return result;
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ─── Update document ──────────────────────────────────────────────────────────

  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      // Check document creator
      const doc = await getDocument(params.id, user!.id, true);
      if (!doc) {
        set.status = 404;
        return { error: "文档不存在" };
      }
      if (doc.createdBy !== user!.id) {
        set.status = 403;
        return { error: "仅文档创建者可更新" };
      }

      const updated = await updateDocument(params.id, body);
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 300 })),
        description: t.Optional(t.String({ maxLength: 1000 })),
      }),
    },
  )

  // ─── Soft delete document ─────────────────────────────────────────────────────

  .delete(
    "/:id",
    async ({ params, user, set }) => {
      const doc = await getDocument(params.id, user!.id, true);
      if (!doc) {
        set.status = 404;
        return { error: "文档不存在" };
      }

      // Creator or project owner can delete
      const owner = await isProjectOwner(doc.projectId, user!.id);
      if (doc.createdBy !== user!.id && !owner) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可删除" };
      }

      await deleteDocument(params.id);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ─── Restore document ─────────────────────────────────────────────────────────

  .post(
    "/:id/restore",
    async ({ params, user, set }) => {
      // Need to find the document even if deleted — use direct query approach
      const doc = await getDocumentRaw(params.id);
      if (!doc) {
        set.status = 404;
        return { error: "文档不存在" };
      }

      const owner = await isProjectOwner(doc.projectId, user!.id);
      if (!owner) {
        set.status = 403;
        return { error: "仅项目负责人可恢复文档" };
      }

      const restored = await restoreDocument(params.id);
      return restored;
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ─── Permanent delete ─────────────────────────────────────────────────────────

  .delete(
    "/:id/permanent",
    async ({ params, user, set }) => {
      const doc = await getDocumentRaw(params.id);
      if (!doc) {
        set.status = 404;
        return { error: "文档不存在" };
      }

      const owner = await isProjectOwner(doc.projectId, user!.id);
      if (!owner) {
        set.status = 403;
        return { error: "仅项目负责人可永久删除文档" };
      }

      await permanentDeleteDocument(params.id);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ─── Update visibility ────────────────────────────────────────────────────────

  .patch(
    "/:id/visibility",
    async ({ params, body, user, set }) => {
      const doc = await getDocument(params.id, user!.id, true);
      if (!doc) {
        set.status = 404;
        return { error: "文档不存在" };
      }
      if (doc.createdBy !== user!.id) {
        set.status = 403;
        return { error: "仅文档创建者可更改可见范围" };
      }

      const updated = await updateVisibility(
        params.id,
        user!.id,
        body.visibility,
        body.memberIds,
      );
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        visibility: t.Union([
          t.Literal("self"),
          t.Literal("project"),
          t.Literal("specific"),
        ]),
        memberIds: t.Optional(t.Array(t.String())),
      }),
    },
  );

