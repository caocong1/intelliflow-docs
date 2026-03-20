import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { insertDocumentFile, listDocumentFiles } from "./files.service";

export const fileRoutes = new Elysia({ prefix: "/files" })
  .use(requireAuth)

  // ─── Create file index record ──────────────────────────────────────────────

  .post(
    "/",
    async ({ body, user, set }) => {
      const record = await insertDocumentFile({
        ...body,
        createdBy: user!.id,
      });
      set.status = 201;
      return { data: record };
    },
    {
      body: t.Object({
        documentId: t.String(),
        category: t.String(),
        originalName: t.String(),
        storagePath: t.String(),
        mimeType: t.Optional(t.String()),
        fileSize: t.Optional(t.Number()),
      }),
    },
  )

  // ─── List files for a document ─────────────────────────────────────────────

  .get(
    "/",
    async ({ query }) => {
      const files = await listDocumentFiles(query.documentId);
      return { data: files };
    },
    {
      query: t.Object({
        documentId: t.String(),
      }),
    },
  );
