import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { isDocumentProjectMember, canEditDocument } from "../versions/versions.service";
import {
  executeModelCall,
  getModelCallConfig,
  getUpstreamDesensitizeRules,
  getUpstreamNodeExecutions,
  resolvePromptTemplate,
  retryModelCall,
  selectModelOutput,
  validateModelOutput,
} from "./model-call.service";
import { getStrategy } from "./strategies";
import type { ModelCallInput } from "./strategies";
import { models, providers } from "../../db/schema";
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
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        // Get config
        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "未找到模型调用节点配置" };
        }

        const mcConfig = config as ModelCallConfig;
        const modelIds = mcConfig.modelIds.length > 0
          ? mcConfig.modelIds
          : mcConfig.modelId ? [mcConfig.modelId] : [];

        if (modelIds.length === 0) {
          set.status = 400;
          return { error: "该节点未配置模型" };
        }

        // Resolve prompt
        const allExecs = await getUpstreamNodeExecutions(params.documentId);
        const desensitizeRules = await getUpstreamDesensitizeRules(params.documentId);
        const { resolved: resolvedPrompt, mapping: variableMapping } = await resolvePromptTemplate(
          mcConfig.promptTemplate,
          params.documentId,
          allExecs.map((e) => ({
            nodeId: e.nodeId,
            nodeLabel: e.nodeLabel,
            outputData: e.outputData as Record<string, unknown> | null,
          })),
          desensitizeRules,
          mcConfig,
        );

        // Resolve system prompt (no desensitize rules)
        let resolvedSystemPrompt: string | undefined;
        if (mcConfig.systemPromptTemplate) {
          const { resolved } = await resolvePromptTemplate(
            mcConfig.systemPromptTemplate,
            params.documentId,
            allExecs.map((e) => ({
              nodeId: e.nodeId,
              nodeLabel: e.nodeLabel,
              outputData: e.outputData as Record<string, unknown> | null,
            })),
            [],  // No desensitize rules for system prompt
          );
          resolvedSystemPrompt = resolved;
        }

        // Execute and return SSE stream
        const stream = await executeModelCall(
          params.documentId,
          params.nodeExecutionId,
          modelIds,
          resolvedPrompt,
          mcConfig.promptTemplate,
          mcConfig.systemPromptTemplate,
          resolvedSystemPrompt,
          variableMapping,
          user!.id,
          mcConfig,
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
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        // Get config for prompt resolution
        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "未找到模型调用节点配置" };
        }

        const mcConfig = config as ModelCallConfig;
        const allExecs = await getUpstreamNodeExecutions(params.documentId);
        const desensitizeRules = await getUpstreamDesensitizeRules(params.documentId);
        const { resolved: resolvedPrompt, mapping: variableMapping } = await resolvePromptTemplate(
          mcConfig.promptTemplate,
          params.documentId,
          allExecs.map((e) => ({
            nodeId: e.nodeId,
            nodeLabel: e.nodeLabel,
            outputData: e.outputData as Record<string, unknown> | null,
          })),
          desensitizeRules,
          mcConfig,
        );

        // Resolve system prompt (no desensitize rules)
        let resolvedSystemPrompt: string | undefined;
        if (mcConfig.systemPromptTemplate) {
          const { resolved } = await resolvePromptTemplate(
            mcConfig.systemPromptTemplate,
            params.documentId,
            allExecs.map((e) => ({
              nodeId: e.nodeId,
              nodeLabel: e.nodeLabel,
              outputData: e.outputData as Record<string, unknown> | null,
            })),
            [],  // No desensitize rules for system prompt
          );
          resolvedSystemPrompt = resolved;
        }

        const stream = await retryModelCall(
          params.documentId,
          params.nodeExecutionId,
          params.modelId,
          resolvedPrompt,
          mcConfig.promptTemplate,
          mcConfig.systemPromptTemplate,
          resolvedSystemPrompt,
          variableMapping,
          user!.id,
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
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
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
        return { error: "仅项目成员可访问运行时" };
      }

      const [exec] = await db
        .select({ outputData: nodeExecutions.outputData })
        .from(nodeExecutions)
        .where(eq(nodeExecutions.id, params.nodeExecutionId))
        .limit(1);

      if (!exec) {
        set.status = 404;
        return { error: "未找到节点执行记录" };
      }

      const outputData = (exec.outputData as Record<string, unknown>) ?? {};
      const modelsData = (outputData.models as Record<string, ModelOutput>) ?? {};

      return { models: modelsData };
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
    },
  )

  // ─── Revalidate model output JSON ──────────────────────────────────────────

  .post(
    "/:documentId/model-call/:nodeExecutionId/models/:modelId/revalidate",
    async ({ params, body, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        // Load node execution
        const [exec] = await db
          .select({ outputData: nodeExecutions.outputData })
          .from(nodeExecutions)
          .where(eq(nodeExecutions.id, params.nodeExecutionId))
          .limit(1);

        if (!exec) {
          set.status = 404;
          return { error: "未找到节点执行记录" };
        }

        // Load node config
        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "未找到模型调用节点配置" };
        }

        const mcConfig = config as ModelCallConfig;
        const outputData = (exec.outputData as Record<string, unknown>) ?? {};
        const modelsMap = (outputData.models as Record<string, ModelOutput>) ?? {};
        const modelOutput = modelsMap[params.modelId];

        if (!modelOutput) {
          set.status = 404;
          return { error: "未找到该模型的输出" };
        }

        // Use provided content or current content
        const content = body?.content ?? modelOutput.content;

        // Validate
        const validation = validateModelOutput(content, mcConfig);

        // Update outputData
        modelsMap[params.modelId] = {
          ...modelOutput,
          content,
          status: validation.status === "format_error" ? "format_error" : "completed",
          formatErrors: validation.errors,
        };

        await db
          .update(nodeExecutions)
          .set({
            outputData: { ...outputData, models: modelsMap },
            updatedAt: new Date(),
          })
          .where(eq(nodeExecutions.id, params.nodeExecutionId));

        return { status: validation.status, errors: validation.errors };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String(), modelId: t.String() }),
      body: t.Optional(t.Object({ content: t.Optional(t.String()) })),
    },
  )

  // ─── AI fix broken JSON output ─────────────────────────────────────────────

  .post(
    "/:documentId/model-call/:nodeExecutionId/models/:modelId/ai-fix",
    async ({ params, user, set }) => {
      const canEdit = await canEditDocument(params.documentId, user!.id);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        // Load node execution
        const [exec] = await db
          .select({ outputData: nodeExecutions.outputData })
          .from(nodeExecutions)
          .where(eq(nodeExecutions.id, params.nodeExecutionId))
          .limit(1);

        if (!exec) {
          set.status = 404;
          return { error: "未找到节点执行记录" };
        }

        // Load node config
        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "未找到模型调用节点配置" };
        }

        const mcConfig = config as ModelCallConfig;
        const outputData = (exec.outputData as Record<string, unknown>) ?? {};
        const modelsMap = (outputData.models as Record<string, ModelOutput>) ?? {};
        const modelOutput = modelsMap[params.modelId];

        if (!modelOutput) {
          set.status = 404;
          return { error: "未找到该模型的输出" };
        }

        const brokenContent = modelOutput.content;
        const formatErrors = modelOutput.formatErrors ?? [];

        // Build repair prompt
        let repairPrompt = "以下是一段 JSON 输出，但存在格式错误，请修复并返回正确的 JSON。\n\n";
        repairPrompt += `错误信息：\n${formatErrors.map((e) => `- ${e}`).join("\n")}\n\n`;
        if (mcConfig.jsonSchema) {
          repairPrompt += `期望的 JSON Schema：\n\`\`\`json\n${JSON.stringify(mcConfig.jsonSchema, null, 2)}\n\`\`\`\n\n`;
        }
        repairPrompt += `需要修复的内容：\n\`\`\`\n${brokenContent}\n\`\`\`\n\n`;
        repairPrompt += "请只返回修复后的 JSON，不要包含任何解释或 markdown 代码块标记。";

        // Look up the model + provider
        const [model] = await db
          .select({
            id: models.id,
            modelId: models.modelId,
            displayName: models.displayName,
            temperature: models.temperature,
            maxTokens: models.maxTokens,
            topP: models.topP,
            baseUrl: providers.baseUrl,
            apiKey: providers.apiKey,
            providerType: providers.type,
            providerId: providers.id,
            providerName: providers.name,
            agentMode: models.agentMode,
            agentMaxTurns: models.agentMaxTurns,
            agentMaxBudgetUsd: models.agentMaxBudgetUsd,
            agentAllowedTools: models.agentAllowedTools,
          })
          .from(models)
          .innerJoin(providers, eq(models.providerId, providers.id))
          .where(eq(models.id, params.modelId))
          .limit(1);

        if (!model) {
          set.status = 404;
          return { error: "未找到模型" };
        }

        // Stream the fix via SSE
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let fixedContent = "";

            try {
              const strategy = getStrategy(model.providerType);
              const strategyInput: ModelCallInput = {
                ...model,
                providerType: model.providerType,
              };

              function sendEvent(event: import("@intelliflow/shared").SSEEvent) {
                const line = `data: ${JSON.stringify(event)}\n\n`;
                try {
                  controller.enqueue(encoder.encode(line));
                } catch {
                  // Stream may be closed
                }
              }

              sendEvent({
                type: "status",
                modelId: model.id,
                data: "streaming",
                timestamp: new Date().toISOString(),
              });

              const result = await strategy.execute({
                model: strategyInput,
                resolvedPrompt: repairPrompt,
                sendEvent,
              });
              fixedContent = result.content;

              // Auto-validate the fixed output
              const validation = validateModelOutput(fixedContent, mcConfig);

              sendEvent({
                type: "complete",
                modelId: model.id,
                data: JSON.stringify({
                  content: fixedContent,
                  status: validation.status,
                  errors: validation.errors,
                }),
                timestamp: new Date().toISOString(),
              });

              // Update outputData with fixed content
              modelsMap[params.modelId] = {
                ...modelOutput,
                content: fixedContent,
                status: validation.status === "format_error" ? "format_error" : "completed",
                formatErrors: validation.errors,
              };

              await db
                .update(nodeExecutions)
                .set({
                  outputData: { ...outputData, models: modelsMap },
                  updatedAt: new Date(),
                })
                .where(eq(nodeExecutions.id, params.nodeExecutionId));
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              const line = `data: ${JSON.stringify({
                type: "error",
                modelId: model.id,
                data: errorMessage,
                timestamp: new Date().toISOString(),
              })}\n\n`;
              try {
                controller.enqueue(encoder.encode(line));
              } catch {
                // Stream closed
              }
            }

            controller.close();
          },
        });

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
  );
