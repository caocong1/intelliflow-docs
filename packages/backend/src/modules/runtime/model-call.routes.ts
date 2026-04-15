import type {
  ModelCallConfig,
  ModelCallLiveEvent,
  ModelCallSnapshotPayload,
  ModelOutput,
  NodeExecutionStatus,
} from "@intelliflow/shared";
import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "../../db";
import { models, providers } from "../../db/schema";
import { nodeExecutions } from "../../db/schema";
import { requireAuth } from "../auth/auth.guard";
import { canEditDocument, isDocumentProjectMember } from "../versions/versions.service";
import { buildSnapshotEvent, getSession, subscribe } from "./model-call-live-session";
import {
  buildModelCallOutputData,
  upsertModelCallManualFeedbackInOutputData,
} from "./model-call-output";
import { buildModelCallSnapshotPayload, getModelOutputsForDisplay } from "./model-call-state";
import {
  appendTransientPromptToResolvedPrompt,
  executeModelCall,
  getModelCallConfig,
  resolveModelCallExecutionPrompts,
  retryModelCall,
  selectModelOutput,
  validateModelOutput,
  validateSelectedModelCallOutputData,
} from "./model-call.service";
import { getStrategy } from "./strategies";
import type { ModelCallInput } from "./strategies";

function encodeSseEvent(event: ModelCallLiveEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function buildSnapshotFromExecution(params: {
  outputData: Record<string, unknown> | null;
  selectedOutputKey: string | null;
  status: NodeExecutionStatus;
  errorMessage?: string | null;
}): ModelCallSnapshotPayload | null {
  return buildModelCallSnapshotPayload({
    outputData: params.outputData,
    nodeStatus: params.status,
    errorMessage: params.errorMessage,
    selectedOutputKey: params.selectedOutputKey,
  });
}

function getCurrentSelectionState(
  outputData: Record<string, unknown>,
  selectedOutputKey: string | null,
): { selectedModelIds?: string[]; defaultSelectedModelId?: string | null } {
  const selectedModelIds = Array.isArray(outputData.selectedModelIds)
    ? outputData.selectedModelIds.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : undefined;

  return {
    selectedModelIds,
    defaultSelectedModelId: selectedModelIds?.[0] ?? selectedOutputKey,
  };
}

export const modelCallRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)

  // ─── Execute model call (SSE streaming) ─────────────────────────────────────

  .get(
    "/:documentId/model-call/:nodeExecutionId/execute",
    async ({ params, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
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
        const modelIds =
          mcConfig.modelIds.length > 0
            ? mcConfig.modelIds
            : mcConfig.modelId
              ? [mcConfig.modelId]
              : [];

        if (modelIds.length === 0) {
          set.status = 400;
          return { error: "该节点未配置模型" };
        }

        const { resolvedPrompt, resolvedSystemPrompt, variableMapping } =
          await resolveModelCallExecutionPrompts({
            documentId: params.documentId,
            nodeExecutionId: params.nodeExecutionId,
            config: mcConfig,
          });

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
          userId,
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
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
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
        const { resolvedPrompt, resolvedSystemPrompt, variableMapping } =
          await resolveModelCallExecutionPrompts({
            documentId: params.documentId,
            nodeExecutionId: params.nodeExecutionId,
            config: mcConfig,
          });
        const effectivePrompt = appendTransientPromptToResolvedPrompt(resolvedPrompt, null);

        const stream = await retryModelCall(
          params.documentId,
          params.nodeExecutionId,
          params.modelId,
          effectivePrompt,
          mcConfig.promptTemplate,
          mcConfig.systemPromptTemplate,
          resolvedSystemPrompt,
          variableMapping,
          userId,
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
      params: t.Object({
        documentId: t.String(),
        nodeExecutionId: t.String(),
        modelId: t.String(),
      }),
    },
  )

  .post(
    "/:documentId/model-call/:nodeExecutionId/retry/:modelId",
    async ({ params, body, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "未找到模型调用节点配置" };
        }

        const mcConfig = config as ModelCallConfig;
        const { resolvedPrompt, resolvedSystemPrompt, variableMapping } =
          await resolveModelCallExecutionPrompts({
            documentId: params.documentId,
            nodeExecutionId: params.nodeExecutionId,
            config: mcConfig,
          });
        const effectivePrompt = appendTransientPromptToResolvedPrompt(
          resolvedPrompt,
          body.additionalPrompt,
        );

        const stream = await retryModelCall(
          params.documentId,
          params.nodeExecutionId,
          params.modelId,
          effectivePrompt,
          mcConfig.promptTemplate,
          mcConfig.systemPromptTemplate,
          resolvedSystemPrompt,
          variableMapping,
          userId,
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
      params: t.Object({
        documentId: t.String(),
        nodeExecutionId: t.String(),
        modelId: t.String(),
      }),
      body: t.Object({
        additionalPrompt: t.Optional(t.String()),
      }),
    },
  )

  // ─── Regenerate current node with manual feedback ──────────────────────────

  .post(
    "/:documentId/model-call/:nodeExecutionId/regenerate",
    async ({ params, body, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "未找到模型调用节点配置" };
        }

        const mcConfig = config as ModelCallConfig;
        const modelIds =
          mcConfig.modelIds.length > 0
            ? mcConfig.modelIds
            : mcConfig.modelId
              ? [mcConfig.modelId]
              : [];

        if (modelIds.length === 0) {
          set.status = 400;
          return { error: "该节点未配置模型" };
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

        const manualFeedback = body.manualFeedback.trim();
        if (!manualFeedback) {
          set.status = 400;
          return { error: "请先填写人工意见，再按意见重生成。" };
        }

        const updatedAt = new Date();
        const nextOutputData = upsertModelCallManualFeedbackInOutputData({
          outputData: (exec.outputData as Record<string, unknown> | null) ?? null,
          content: body.manualFeedback,
          updatedAt: updatedAt.toISOString(),
        });

        await db
          .update(nodeExecutions)
          .set({
            outputData: nextOutputData,
            updatedAt,
          })
          .where(eq(nodeExecutions.id, params.nodeExecutionId));

        const { resolvedPrompt, resolvedSystemPrompt, variableMapping } =
          await resolveModelCallExecutionPrompts({
            documentId: params.documentId,
            nodeExecutionId: params.nodeExecutionId,
            config: mcConfig,
            manualFeedbackOverride: body.manualFeedback,
          });

        const stream = await executeModelCall(
          params.documentId,
          params.nodeExecutionId,
          modelIds,
          resolvedPrompt,
          mcConfig.promptTemplate,
          mcConfig.systemPromptTemplate,
          resolvedSystemPrompt,
          variableMapping,
          userId,
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
      body: t.Object({ manualFeedback: t.String() }),
    },
  )

  // ─── Select model output ────────────────────────────────────────────────────

  .post(
    "/:documentId/model-call/:nodeExecutionId/select",
    async ({ params, body, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        const selectedModelIds =
          body.selectedModelIds && body.selectedModelIds.length > 0
            ? body.selectedModelIds
            : body.selectedModelId
              ? [body.selectedModelId]
              : [];
        const result = await selectModelOutput(
          params.documentId,
          params.nodeExecutionId,
          selectedModelIds,
        );
        return {
          success: true,
          outputData: result.outputData,
          selectedOutputKey: result.selectedOutputKey,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set.status = 400;
        return { error: message };
      }
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
      body: t.Object({
        selectedModelId: t.Optional(t.String()),
        selectedModelIds: t.Optional(t.Array(t.String())),
      }),
    },
  )

  // ─── Validate currently selected output before advance ─────────────────────

  .post(
    "/:documentId/model-call/:nodeExecutionId/validate-selection",
    async ({ params, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        const [exec] = await db
          .select({
            outputData: nodeExecutions.outputData,
            selectedOutputKey: nodeExecutions.selectedOutputKey,
          })
          .from(nodeExecutions)
          .where(eq(nodeExecutions.id, params.nodeExecutionId))
          .limit(1);

        if (!exec) {
          set.status = 404;
          return { error: "未找到节点执行记录" };
        }

        const config = await getModelCallConfig(params.nodeExecutionId);
        if (!config || config.type !== "model_call") {
          set.status = 404;
          return { error: "未找到模型调用节点配置" };
        }

        const validation = validateSelectedModelCallOutputData(
          (exec.outputData as Record<string, unknown> | null) ?? null,
          config,
          exec.selectedOutputKey,
        );

        if (validation.status === "format_error") {
          set.status = 400;
          return {
            error: validation.errors?.join("\n") ?? "当前输出校验失败",
            errors: validation.errors,
          };
        }

        return { success: true };
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

  // ─── Status polling fallback ────────────────────────────────────────────────

  .get(
    "/:documentId/model-call/:nodeExecutionId/stream",
    async ({ params, request, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const isMember = await isDocumentProjectMember(params.documentId, userId);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问运行时" };
      }

      const [exec] = await db
        .select({
          outputData: nodeExecutions.outputData,
          selectedOutputKey: nodeExecutions.selectedOutputKey,
          status: nodeExecutions.status,
          errorMessage: nodeExecutions.errorMessage,
        })
        .from(nodeExecutions)
        .where(eq(nodeExecutions.id, params.nodeExecutionId))
        .limit(1);

      if (!exec) {
        set.status = 404;
        return { error: "未找到节点执行记录" };
      }

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          const session = getSession(params.nodeExecutionId);
          const sessionSnapshot = buildSnapshotEvent(
            params.nodeExecutionId,
            exec.selectedOutputKey ?? null,
          );
          const fallbackSnapshot = buildSnapshotFromExecution({
            outputData: exec.outputData as Record<string, unknown> | null,
            selectedOutputKey: exec.selectedOutputKey,
            status: exec.status,
            errorMessage: exec.errorMessage,
          });

          const initialEvent: ModelCallLiveEvent | null =
            sessionSnapshot ??
            (fallbackSnapshot ? { type: "snapshot", data: fallbackSnapshot } : null);

          if (initialEvent) {
            controller.enqueue(encoder.encode(encodeSseEvent(initialEvent)));
          }

          if (!session || session.completed || session.failed || exec.status !== "in_progress") {
            controller.close();
            return;
          }

          const unsubscribe =
            subscribe(params.nodeExecutionId, (event) => {
              try {
                controller.enqueue(encoder.encode(encodeSseEvent(event)));
                if (event.type === "snapshot" && event.data.done) {
                  unsubscribe?.();
                  controller.close();
                }
              } catch {
                unsubscribe?.();
              }
            }) ?? null;

          request.signal.addEventListener(
            "abort",
            () => {
              unsubscribe?.();
              try {
                controller.close();
              } catch {
                // Already closed.
              }
            },
            { once: true },
          );
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },
    {
      params: t.Object({ documentId: t.String(), nodeExecutionId: t.String() }),
    },
  )

  .get(
    "/:documentId/model-call/:nodeExecutionId/status",
    async ({ params, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const isMember = await isDocumentProjectMember(params.documentId, userId);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可访问运行时" };
      }

      const [exec] = await db
        .select({
          outputData: nodeExecutions.outputData,
          status: nodeExecutions.status,
          errorMessage: nodeExecutions.errorMessage,
        })
        .from(nodeExecutions)
        .where(eq(nodeExecutions.id, params.nodeExecutionId))
        .limit(1);

      if (!exec) {
        set.status = 404;
        return { error: "未找到节点执行记录" };
      }

      const modelsData = getModelOutputsForDisplay({
        outputData: exec.outputData as Record<string, unknown> | null,
        nodeStatus: exec.status,
        errorMessage: exec.errorMessage,
      });

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
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        // Load node execution
        const [exec] = await db
          .select({
            outputData: nodeExecutions.outputData,
            selectedOutputKey: nodeExecutions.selectedOutputKey,
          })
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

        const selectionState = getCurrentSelectionState(outputData, exec.selectedOutputKey);
        const { outputData: nextOutputData, selectedOutputKey } = buildModelCallOutputData({
          models: modelsMap,
          config: mcConfig,
          selectedModelIds: selectionState.selectedModelIds,
          defaultSelectedModelId: selectionState.defaultSelectedModelId ?? params.modelId,
          previousOutputData: outputData,
        });

        await db
          .update(nodeExecutions)
          .set({
            outputData: nextOutputData,
            selectedOutputKey,
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
      params: t.Object({
        documentId: t.String(),
        nodeExecutionId: t.String(),
        modelId: t.String(),
      }),
      body: t.Optional(t.Object({ content: t.Optional(t.String()) })),
    },
  )

  // ─── AI fix broken JSON output ─────────────────────────────────────────────

  .post(
    "/:documentId/model-call/:nodeExecutionId/models/:modelId/ai-fix",
    async ({ params, user, set }) => {
      const userId = user?.id;
      if (!userId) {
        set.status = 401;
        return { error: "未登录" };
      }

      const canEdit = await canEditDocument(params.documentId, userId);
      if (!canEdit) {
        set.status = 403;
        return { error: "仅文档创建者或项目负责人可执行此操作" };
      }

      try {
        // Load node execution
        const [exec] = await db
          .select({
            outputData: nodeExecutions.outputData,
            selectedOutputKey: nodeExecutions.selectedOutputKey,
          })
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
        const jsonNamedOutputs = (mcConfig.namedOutputs ?? []).filter(
          (output) => output.format === "json",
        );
        if (jsonNamedOutputs.length > 0) {
          repairPrompt += "命名产物 JSON 约束：\n";
          repairPrompt += jsonNamedOutputs
            .map((output) => {
              const schemaText = output.jsonSchema
                ? `\nSchema:\n\`\`\`json\n${JSON.stringify(output.jsonSchema, null, 2)}\n\`\`\``
                : "";
              return `- ${output.id}${schemaText}`;
            })
            .join("\n\n");
          repairPrompt += "\n\n";
        }
        repairPrompt += `需要修复的内容：\n\`\`\`\n${brokenContent}\n\`\`\`\n\n`;
        repairPrompt += "请只返回修复后的内容本身，不要包含任何解释或 markdown 代码块标记。";

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

              const selectionState = getCurrentSelectionState(outputData, exec.selectedOutputKey);
              const { outputData: nextOutputData, selectedOutputKey } = buildModelCallOutputData({
                models: modelsMap,
                config: mcConfig,
                selectedModelIds: selectionState.selectedModelIds,
                defaultSelectedModelId: selectionState.defaultSelectedModelId ?? params.modelId,
                previousOutputData: outputData,
              });

              await db
                .update(nodeExecutions)
                .set({
                  outputData: nextOutputData,
                  selectedOutputKey,
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
      params: t.Object({
        documentId: t.String(),
        nodeExecutionId: t.String(),
        modelId: t.String(),
      }),
    },
  );
