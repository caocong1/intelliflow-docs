import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { canEditDocument, isDocumentProjectMember } from "../versions/versions.service";
import { downloadPpt, generatePpt, getPptPreview } from "./ppt.service";

export const pptRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  .get(
    "/:documentId/ppt/:nodeExecutionId/preview",
    async ({ params, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const isMember = await isDocumentProjectMember(params.documentId, userId);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问 PPT 预览" };
      }

      try {
        return await getPptPreview(params.documentId, params.nodeExecutionId);
      } catch (err: unknown) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
    },
  )

  .post(
    "/:documentId/ppt/:nodeExecutionId/generate",
    async ({ params, body, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可生成 PPT" };
      }

      try {
        return await generatePpt(
          params.documentId,
          params.nodeExecutionId,
          body.filename,
          userId,
          body.styleId,
        );
      } catch (err: unknown) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({
        filename: t.String(),
        styleId: t.Optional(t.Nullable(t.String())),
      }),
    },
  )

  .get(
    "/:documentId/ppt/:nodeExecutionId/download",
    async ({ params, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const isMember = await isDocumentProjectMember(params.documentId, userId);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可下载 PPT" };
      }

      try {
        const result = await downloadPpt(params.documentId, params.nodeExecutionId);
        if (!result) {
          set.status = 404;
          return { error: "PPT 文件不存在，请先生成" };
        }

        return new Response(new Uint8Array(result.buffer), {
          headers: {
            "Content-Type": result.mimeType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
          },
        });
      } catch (err: unknown) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
    },
  );
