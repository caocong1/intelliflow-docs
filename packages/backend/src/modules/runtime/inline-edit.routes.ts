import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isDocumentProjectMember } from "../versions/versions.service";
import {
  buildInlineEditPrompt,
  executeInlineEdit,
  isPostRestoreNode,
  validateModelSecurity,
} from "./inline-edit.service";
import type { InlineEditAction } from "./inline-edit.service";

export const inlineEditRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  // ─── Inline edit SSE streaming ─────────────────────────────────────────────

  .post(
    "/:documentId/inline-edit/:nodeExecutionId/stream",
    async ({ params, body, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问运行时" };
      }

      try {
        // Check security context
        const postRestore = await isPostRestoreNode(params.documentId, params.nodeExecutionId);

        // Validate model security constraint
        await validateModelSecurity(body.modelId, postRestore);

        // Build prompt
        const prompt = buildInlineEditPrompt(
          body.action as InlineEditAction,
          body.selectedText,
          body.customInstruction,
        );

        // Execute and return SSE stream
        const stream = await executeInlineEdit(
          params.documentId,
          params.nodeExecutionId,
          body.modelId,
          prompt,
          user!.id,
        );

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      } catch (err: unknown) {
        if (err && typeof err === "object" && "statusCode" in err) {
          const appErr = err as { statusCode: number; message: string };
          set.status = appErr.statusCode;
          return { error: appErr.message };
        }
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({
        action: t.Union([
          t.Literal("rewrite"),
          t.Literal("simplify"),
          t.Literal("expand"),
          t.Literal("fix"),
          t.Literal("custom"),
        ]),
        selectedText: t.String({ minLength: 1 }),
        modelId: t.String({ minLength: 1 }),
        customInstruction: t.Optional(t.String()),
      }),
    },
  );
