import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isDocumentProjectMember } from "../versions/versions.service";
import {
  executeModelCall,
  getModelCallConfig,
  getUpstreamDesensitizeRules,
  getUpstreamNodeExecutions,
  resolvePromptTemplate,
  retryModelCall,
  selectModelOutput,
} from "./model-call.service";
import { db } from "../../db";
import { nodeExecutions } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { ModelCallConfig, ModelOutput } from "@intelliflow/shared";

export const modelCallRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  // ─── Execute model call (SSE streaming) ─────────────────────────────────────

  .get(
    "/:documentId/model-call/:nodeExecutionId/execute",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "Only project members can access runtime" };
      }

      try {
        // Get config
        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "Model call node config not found" };
        }

        const mcConfig = config as ModelCallConfig;
        const modelIds = mcConfig.modelIds.length > 0
          ? mcConfig.modelIds
          : mcConfig.modelId ? [mcConfig.modelId] : [];

        if (modelIds.length === 0) {
          set.status = 400;
          return { error: "No models configured for this node" };
        }

        // Resolve prompt
        const allExecs = await getUpstreamNodeExecutions(params.documentId);
        const desensitizeRules = await getUpstreamDesensitizeRules(params.documentId);
        const resolvedPrompt = await resolvePromptTemplate(
          mcConfig.promptTemplate,
          params.documentId,
          allExecs.map((e) => ({
            nodeLabel: e.nodeLabel,
            outputData: e.outputData as Record<string, unknown> | null,
          })),
          desensitizeRules,
        );

        // Execute and return SSE stream
        const stream = await executeModelCall(
          params.documentId,
          params.nodeExecutionId,
          modelIds,
          resolvedPrompt,
        );

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
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
  )

  // ─── Retry single model (SSE streaming) ─────────────────────────────────────

  .get(
    "/:documentId/model-call/:nodeExecutionId/retry/:modelId",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "Only project members can access runtime" };
      }

      try {
        // Get config for prompt resolution
        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "Model call node config not found" };
        }

        const mcConfig = config as ModelCallConfig;
        const allExecs = await getUpstreamNodeExecutions(params.documentId);
        const desensitizeRules = await getUpstreamDesensitizeRules(params.documentId);
        const resolvedPrompt = await resolvePromptTemplate(
          mcConfig.promptTemplate,
          params.documentId,
          allExecs.map((e) => ({
            nodeLabel: e.nodeLabel,
            outputData: e.outputData as Record<string, unknown> | null,
          })),
          desensitizeRules,
        );

        const stream = await retryModelCall(
          params.documentId,
          params.nodeExecutionId,
          params.modelId,
          resolvedPrompt,
        );

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String(), modelId: t.String() }),
    },
  )

  // ─── Select model output ────────────────────────────────────────────────────

  .post(
    "/:documentId/model-call/:nodeExecutionId/select",
    async ({ params, body, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "Only project members can access runtime" };
      }

      try {
        await selectModelOutput(
          params.documentId,
          params.nodeExecutionId,
          body.selectedModelId,
        );
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({ selectedModelId: t.String() }),
    },
  )

  // ─── Status polling fallback ────────────────────────────────────────────────

  .get(
    "/:documentId/model-call/:nodeExecutionId/status",
    async ({ params, user, set }) => {
      const isMember = await isDocumentProjectMember(params.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "Only project members can access runtime" };
      }

      const [exec] = await db
        .select({ outputData: nodeExecutions.outputData })
        .from(nodeExecutions)
        .where(eq(nodeExecutions.id, params.nodeExecutionId))
        .limit(1);

      if (!exec) {
        set.status = 404;
        return { error: "Node execution not found" };
      }

      const outputData = (exec.outputData as Record<string, unknown>) ?? {};
      const modelsData = (outputData.models as Record<string, ModelOutput>) ?? {};

      return { models: modelsData };
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
    },
  );
