import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isDocumentProjectMember } from "../versions/versions.service";
import { executeRestore, updateRestoredText } from "./restore.service";
import { db } from "../../db";
import { nodeExecutions, workflows, documents } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { RestoreConfig, WorkflowNodeDef } from "@intelliflow/shared";

/**
 * Get the restore config for a node execution by looking up the workflow.
 */
async function getRestoreConfig(
  nodeExecutionId: string,
): Promise<RestoreConfig | null> {
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
  if (!nodeDef || nodeDef.config.type !== "restore") return null;

  return nodeDef.config as RestoreConfig;
}

export const restoreRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  // ─── Execute restore (replace placeholders with real values) ──────────────

  .post(
    "/:documentId/restore/:nodeExecutionId/execute",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问运行时" };
      }

      try {
        const config = await getRestoreConfig(params.nodeExecutionId);
        if (!config) {
          set.status = 404;
          return { error: "未找到恢复节点配置" };
        }

        const result = await executeRestore(
          params.documentId,
          params.nodeExecutionId,
          config,
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
    },
  )

  // ─── Update restored text (manual correction) ────────────────────────────

  .put(
    "/:documentId/restore/:nodeExecutionId/text",
    async ({ params, body, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问运行时" };
      }

      try {
        const result = await updateRestoredText(
          params.documentId,
          params.nodeExecutionId,
          body.updatedText,
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
      body: t.Object({ updatedText: t.String() }),
    },
  );
