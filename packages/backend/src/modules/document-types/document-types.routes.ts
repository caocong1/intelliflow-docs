import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import {
  createDocumentType,
  deleteDocumentType,
  getAssociatedWorkflows,
  listDocumentTypes,
  toggleDocumentTypeStatus,
  updateDocumentType,
} from "./document-types.service";

export const documentTypeRoutes = new Elysia({ prefix: "/document-types" })
  .use(requireAdmin)
  .get(
    "/",
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 20;
      const search = query.search || undefined;
      const { data, total } = await listDocumentTypes(page, pageSize, search);
      return { data, total, page, pageSize };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )
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
          return { error: "Document type code already exists" };
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
          return { error: "Document type not found" };
        }
        if (message.includes("23505") || message.includes("unique")) {
          set.status = 409;
          return { error: "Document type code already exists" };
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
          return { error: "Document type not found" };
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
      const workflows = await getAssociatedWorkflows(params.id);
      return { workflows };
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
          return { error: "Document type not found" };
        }
        if (message === "HAS_ASSOCIATED_WORKFLOWS") {
          set.status = 409;
          return { error: "Cannot delete: associated workflows exist", workflows: [] as { id: string; name: string }[] };
        }
        if (message === "HAS_ASSOCIATED_DOCUMENTS") {
          set.status = 409;
          return { error: "Cannot delete document type with associated documents" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
