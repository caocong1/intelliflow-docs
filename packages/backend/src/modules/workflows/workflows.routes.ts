import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import {
  copyWorkflow,
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
  setDefaultWorkflow,
  toggleWorkflowStatus,
  updateWorkflow,
} from "./workflows.service";
import { validateWorkflow } from "./validation";
import type { WorkflowEdgeDef, WorkflowNodeDef, WorkflowStatus } from "@intelliflow/shared";

const nodeSchema = t.Object({
  id: t.String(),
  type: t.String(),
  label: t.String(),
  position: t.Object({ x: t.Number(), y: t.Number() }),
  config: t.Record(t.String(), t.Unknown()),
  outputs: t.Array(t.Object({ name: t.String(), label: t.String() })),
});

const edgeSchema = t.Object({
  id: t.String(),
  source: t.String(),
  target: t.String(),
  sourceHandle: t.Optional(t.String()),
  targetHandle: t.Optional(t.String()),
});

export const workflowRoutes = new Elysia({ prefix: "/workflows" })
  .use(requireAdmin)

  // GET / — list with optional filters
  .get(
    "/",
    async ({ query }) => {
      const result = await listWorkflows({
        documentTypeId: query.documentTypeId,
        search: query.search,
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      });
      return result;
    },
    {
      query: t.Object({
        documentTypeId: t.Optional(t.String()),
        search: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  )

  // GET /:id — get single workflow with full graph
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const workflow = await getWorkflow(params.id);
        return workflow;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "WORKFLOW_NOT_FOUND") {
          set.status = 404;
          return { error: "工作流不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // POST / — create workflow
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const workflow = await createWorkflow(body);
        set.status = 201;
        return workflow;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "DOCUMENT_TYPE_NOT_FOUND") {
          set.status = 400;
          return { error: "文档类型不存在" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        documentTypeId: t.String(),
        name: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
      }),
    },
  )

  // PUT /:id — update workflow
  .put(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const workflow = await updateWorkflow(params.id, {
          name: body.name,
          description: body.description,
          nodes: body.nodes as WorkflowNodeDef[] | undefined,
          edges: body.edges as WorkflowEdgeDef[] | undefined,
        });
        return workflow;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "WORKFLOW_NOT_FOUND") {
          set.status = 404;
          return { error: "工作流不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        description: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
        nodes: t.Optional(t.Array(nodeSchema)),
        edges: t.Optional(t.Array(edgeSchema)),
      }),
    },
  )

  // DELETE /:id — delete workflow
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
        return await deleteWorkflow(params.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "WORKFLOW_NOT_FOUND") {
          set.status = 404;
          return { error: "工作流不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // POST /:id/validate — validate workflow graph
  .post(
    "/:id/validate",
    async ({ params, set }) => {
      try {
        const workflow = await getWorkflow(params.id);
        const errors = validateWorkflow(
          workflow.nodes as WorkflowNodeDef[],
          workflow.edges as WorkflowEdgeDef[],
        );
        return { valid: errors.filter((e) => e.severity === "error").length === 0, errors };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "WORKFLOW_NOT_FOUND") {
          set.status = 404;
          return { error: "工作流不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // POST /:id/copy — copy workflow
  .post(
    "/:id/copy",
    async ({ params, body, set }) => {
      try {
        const workflow = await copyWorkflow(params.id, {
          name: body.name,
          targetDocumentTypeId: body.targetDocumentTypeId ?? undefined,
        });
        set.status = 201;
        return workflow;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "WORKFLOW_NOT_FOUND") {
          set.status = 404;
          return { error: "工作流不存在" };
        }
        if (message === "DOCUMENT_TYPE_NOT_FOUND") {
          set.status = 400;
          return { error: "目标文档类型不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200 }),
        targetDocumentTypeId: t.Optional(t.Nullable(t.String())),
      }),
    },
  )

  // PATCH /:id/status — toggle workflow status
  .patch(
    "/:id/status",
    async ({ params, body, set }) => {
      try {
        const workflow = await toggleWorkflowStatus(params.id, body.status as WorkflowStatus);
        return workflow;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "WORKFLOW_NOT_FOUND") {
          set.status = 404;
          return { error: "工作流不存在" };
        }
        if (message === "WORKFLOW_VALIDATION_FAILED") {
          set.status = 422;
          return { error: "工作流验证失败，无法启用" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Union([t.Literal("draft"), t.Literal("active"), t.Literal("disabled")]),
      }),
    },
  )

  // PATCH /:id/set-default — set as default for document type
  .patch(
    "/:id/set-default",
    async ({ params, set }) => {
      try {
        const workflow = await setDefaultWorkflow(params.id);
        return workflow;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "WORKFLOW_NOT_FOUND") {
          set.status = 404;
          return { error: "工作流不存在" };
        }
        if (message === "WORKFLOW_NOT_ACTIVE") {
          set.status = 422;
          return { error: "只有已启用的工作流才能设为默认" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
