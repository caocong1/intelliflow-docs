import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isDocumentProjectMember } from "../versions/versions.service";
import { downloadExport, generateExport, getExportPreview } from "./export.service";

export const exportRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  // ─── Preview export content ─────────────────────────────────────────────────

  .get(
    "/:documentId/export/:nodeExecutionId/preview",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问导出" };
      }

      try {
        const result = await getExportPreview(params.documentId, params.nodeExecutionId);
        return result;
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

  // ─── Generate export file ──────────────────────────────────────────────────

  .post(
    "/:documentId/export/:nodeExecutionId/generate",
    async ({ params, body, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可生成导出" };
      }

      try {
        const result = await generateExport(
          params.documentId,
          params.nodeExecutionId,
          body.format,
          body.filename,
          user!.id,
        );
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({
        format: t.Union([t.Literal("word"), t.Literal("pdf"), t.Literal("markdown"), t.Literal("pptx")]),
        filename: t.String(),
      }),
    },
  )

  // ─── Download exported file ────────────────────────────────────────────────

  .get(
    "/:documentId/export/:nodeExecutionId/download",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可下载导出" };
      }

      try {
        const result = await downloadExport(params.documentId, params.nodeExecutionId);
        if (!result) {
          set.status = 404;
          return { error: "导出文件不存在，请先生成导出" };
        }

        set.headers["content-type"] = result.mimeType;
        set.headers["content-disposition"] = `attachment; filename="${encodeURIComponent(result.filename)}"`;

        return new Response(new Uint8Array(result.buffer), {
          headers: {
            "Content-Type": result.mimeType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
          },
        });
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
