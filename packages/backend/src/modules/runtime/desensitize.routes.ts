import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isDocumentProjectMember, canEditDocument } from "../versions/versions.service";
import { confirmDesensitization, detectSensitiveInfo, getDesensitizeRules } from "./desensitize.service";
import { db } from "../../db";
import { nodeExecutions, workflows, documents } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { DesensitizeConfig, WorkflowNodeDef } from "@intelliflow/shared";

/**
 * Get the desensitize config for a node execution by looking up the workflow.
 */
async function getDesensitizeConfig(
  nodeExecutionId: string,
): Promise<DesensitizeConfig | null> {
  const [exec] = await db
    .select({
      nodeId: nodeExecutions.nodeId,
      documentId: nodeExecutions.documentId,
    })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) return null;

  const [doc] = await db
    .select({ nodes: workflows.nodes })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, exec.documentId))
    .limit(1);

  if (!doc) return null;

  const nodes = doc.nodes as WorkflowNodeDef[];
  const nodeDef = nodes.find((n) => n.id === exec.nodeId);
  if (!nodeDef || nodeDef.config.type !== "desensitize") return null;

  return nodeDef.config as DesensitizeConfig;
}

export const desensitizeRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  // ─── Detect sensitive info ──────────────────────────────────────────────────

  .post(
    "/:documentId/desensitize/:nodeExecutionId/detect",
    async ({ params, body, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        const config = await getDesensitizeConfig(params.nodeExecutionId);
        if (!config) {
          set.status = 404;
          return { error: "未找到脱敏节点配置" };
        }

        const items = await detectSensitiveInfo(
          body.text,
          config.localModelId,
          config.categories,
        );

        return { items };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({ text: t.String() }),
    },
  )

  // ─── Confirm desensitization ────────────────────────────────────────────────

  .post(
    "/:documentId/desensitize/:nodeExecutionId/confirm",
    async ({ params, body, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        const nodeExecution = await confirmDesensitization(
          params.documentId,
          params.nodeExecutionId,
          body.items as Array<{ original: string; placeholder: string; sensitiveType: string }>,
          body.sanitizedText,
          user!.id,
        );

        return nodeExecution;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({
        items: t.Array(
          t.Object({
            original: t.String(),
            placeholder: t.String(),
            sensitiveType: t.String(),
          }),
        ),
        sanitizedText: t.String(),
      }),
    },
  )

  // ─── Get desensitize rules (for model call prompt injection) ────────────────

  .get(
    "/:documentId/desensitize/:nodeExecutionId/rules",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问运行时" };
      }

      try {
        const rules = await getDesensitizeRules(params.documentId, params.nodeExecutionId);
        return { rules };
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
