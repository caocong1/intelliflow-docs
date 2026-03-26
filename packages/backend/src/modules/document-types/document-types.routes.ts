import Elysia, { t } from "elysia";
import { requireAdmin, requireAuth } from "../auth/auth.guard";
import {
  createDocumentType,
  deleteDocumentType,
  getAssociatedDocuments,
  getAssociatedWorkflows,
  listDocumentTypes,
  toggleDocumentTypeStatus,
  updateDocumentType,
} from "./document-types.service";

// ── Read routes (any authenticated user) ─────────────────────────────────────

export const documentTypeReadRoutes = new Elysia({ prefix: "/document-types" })
  .use(requireAuth)
  .get(
    "/",
    async ({ query, user }) => {
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 20;
      const search = query.search || undefined;
      const activeOnly = user?.role !== "admin";
      const { data, total } = await listDocumentTypes(page, pageSize, search, activeOnly);
      return { data, total, page, pageSize };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  );

// ── Admin routes (admin only) ────────────────────────────────────────────────

export const documentTypeAdminRoutes = new Elysia({ prefix: "/document-types" })
  .use(requireAdmin)
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const docType = await createDocumentType(body);
        set.status = 201;
        return docType;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("23505") || message.includes("unique")) {
          set.status = 409;
          return { error: "文档类型编码已存在" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        code: t.String({
          minLength: 1,
          maxLength: 50,
          pattern: "^[a-zA-Z0-9_-]+$",
        }),
        description: t.Optional(t.String({ maxLength: 500 })),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const docType = await updateDocumentType(params.id, body);
        return docType;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "DOCUMENT_TYPE_NOT_FOUND") {
          set.status = 404;
          return { error: "文档类型不存在" };
        }
        if (message.includes("23505") || message.includes("unique")) {
          set.status = 409;
          return { error: "文档类型编码已存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        code: t.Optional(
          t.String({
            minLength: 1,
            maxLength: 50,
            pattern: "^[a-zA-Z0-9_-]+$",
          }),
        ),
        description: t.Optional(t.String({ maxLength: 500 })),
      }),
    },
  )
  .patch(
    "/:id/status",
    async ({ params, set }) => {
      try {
        const docType = await toggleDocumentTypeStatus(params.id);
        return docType;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "DOCUMENT_TYPE_NOT_FOUND") {
          set.status = 404;
          return { error: "文档类型不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get(
    "/:id/associations",
    async ({ params }) => {
      const [wfs, docs] = await Promise.all([
        getAssociatedWorkflows(params.id),
        getAssociatedDocuments(params.id),
      ]);
      return { workflows: wfs, documents: docs };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
        return await deleteDocumentType(params.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "DOCUMENT_TYPE_NOT_FOUND") {
          set.status = 404;
          return { error: "文档类型不存在" };
        }
        if (message === "HAS_ASSOCIATIONS") {
          const assocErr = err as Error & {
            associations: {
              workflows: { id: string; name: string }[];
              documents: { id: string; title: string }[];
            };
          };
          set.status = 409;
          return {
            error: "无法删除：该文档类型存在关联的工作流或文档",
            workflows: assocErr.associations?.workflows ?? [],
            documents: assocErr.associations?.documents ?? [],
          };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
