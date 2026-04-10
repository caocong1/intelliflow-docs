import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isDocumentProjectMember, canEditDocument } from "../versions/versions.service";
import { executeRestore, confirmRestore, updateRestoreSource } from "./restore.service";
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
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
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

  // ─── Confirm restore ─────────────────────────────────────────────────────

  .post(
    "/:documentId/restore/:nodeExecutionId/confirm",
    async ({ params, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }
      try {
        return await confirmRestore(params.documentId, params.nodeExecutionId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    { params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }) },
  )

  // ─── Update restore source (per-source edit) ───────────────────────────

  .put(
    "/:documentId/restore/:nodeExecutionId/source",
    async ({ params, body, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }
      try {
        return await updateRestoreSource(
          params.documentId, params.nodeExecutionId,
          body.sourceId, body.restoredText,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({ sourceId: t.String(), restoredText: t.String() }),
    },
  );
