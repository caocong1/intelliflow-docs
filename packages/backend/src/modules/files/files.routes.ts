import Elysia, { t } from "elysia";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { requireAuth } from "../auth/auth.guard";
import { insertDocumentFile, listDocumentFiles, getUploadPath } from "./files.service";
import { sanitizeFilename } from "../../common/sanitize";
import { isDocumentProjectMember } from "../versions/versions.service";

export const fileRoutes = new Elysia({ prefix: "/files" })
  .use(requireAuth)

  // ─── Create file index record ──────────────────────────────────────────────

  .post(
    "/",
    async ({ body, user, set }) => {
      const isMember = await isDocumentProjectMember(body.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可上传文件" };
      }
      const storagePath = join(
        getUploadPath(body.documentId),
        randomUUID() + "_" + sanitizeFilename(body.originalName),
      );
      const record = await insertDocumentFile({
        documentId: body.documentId,
        category: body.category,
        originalName: body.originalName,
        storagePath,
        mimeType: body.mimeType,
        fileSize: body.fileSize,
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
        mimeType: t.Optional(t.String()),
        fileSize: t.Optional(t.Number()),
      }),
    },
  )

  // ─── List files for a document ─────────────────────────────────────────────

  .get(
    "/",
    async ({ query, user, set }) => {
      const isMember = await isDocumentProjectMember(query.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可查看文件列表" };
      }
      const files = await listDocumentFiles(query.documentId);
      return { data: files };
    },
    {
      query: t.Object({
        documentId: t.String(),
      }),
    },
  );
