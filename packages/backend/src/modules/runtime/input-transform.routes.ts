import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { canEditDocument } from "../versions/versions.service";
import { confirmInputTransform, handleFileUpload } from "./input-transform.service";

export const inputTransformRoutes = new Elysia({
  prefix: "/runtime",
})
  .use(requireAuth)

  // ─── Upload file for input transform node ──────────────────────────────────

  .post(
    "/:documentId/input-transform/:nodeExecutionId/upload",
    async ({ params, body, user, set }) => {
      if (!user?.id) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, user.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可上传文件" };
      }

      try {
        const result = await handleFileUpload(
          params.documentId,
          params.nodeExecutionId,
          body.file,
          user.id,
        );
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({
        documentId: t.String(),
        nodeExecutionId: t.String(),
      }),
      body: t.Object({
        file: t.File(),
      }),
    },
  )

  // ─── Confirm input transform node ──────────────────────────────────────────

  .post(
    "/:documentId/input-transform/:nodeExecutionId/confirm",
    async ({ params, body, user, set }) => {
      if (!user?.id) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, user.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可确认输入转换" };
      }

      try {
        const updated = await confirmInputTransform({
          documentId: params.documentId,
          nodeExecutionId: params.nodeExecutionId,
          formData: body.formData as Record<string, string>,
          fileOutputs: body.fileOutputs as Array<{
            fileId: string;
            name: string;
            parsedText: string;
            slotId?: string;
          }>,
          userId: user.id,
        });
        return { success: true, nodeExecution: updated };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({
        documentId: t.String(),
        nodeExecutionId: t.String(),
      }),
      body: t.Object({
        formData: t.Record(t.String(), t.String()),
        fileOutputs: t.Array(
          t.Object({
            fileId: t.String(),
            name: t.String(),
            parsedText: t.String(),
            slotId: t.Optional(t.String()),
          }),
        ),
      }),
    },
  );
