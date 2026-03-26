import { asc, eq, and, lt } from "drizzle-orm";
import { db } from "../../db";
import { modelCallLogs, models, nodeExecutions, providers } from "../../db/schema";
import { forbidden } from "../../common/errors";
import { getStrategy } from "./strategies";
import type { ModelCallInput } from "./strategies";
import type { SSEEvent } from "@intelliflow/shared";

// ─── Inline Edit Action Types ────────────────────────────────────────────────

export type InlineEditAction = "rewrite" | "simplify" | "expand" | "fix" | "custom";

// ─── Prompt Construction ─────────────────────────────────────────────────────

const ACTION_PROMPTS: Record<Exclude<InlineEditAction, "custom">, string> = {
  rewrite: "请改写以下文本，保持原意但使用不同的表达方式：",
  simplify: "请精简以下文本，去除冗余，保持核心信息：",
  expand: "请扩写以下文本，增加细节和深度，保持原有风格：",
  fix: "请修正以下文本中的语法、拼写和标点错误，保持原意：",
};

const SUFFIX = "\n\n请只返回修改后的文本，不要添加解释或额外内容。";

/**
 * Build an inline edit prompt based on the action type and selected text.
 */
export function buildInlineEditPrompt(
  action: InlineEditAction,
  selectedText: string,
  customInstruction?: string,
): string {
  if (action === "custom") {
    if (!customInstruction) {
      throw new Error("自定义操作需要提供指令");
    }
    return `${customInstruction}\n\n${selectedText}${SUFFIX}`;
  }

  const template = ACTION_PROMPTS[action];
  if (!template) {
    throw new Error(`未知的编辑操作: ${action}`);
  }

  return `${template}\n\n${selectedText}${SUFFIX}`;
}

// ─── Security: Post-Restore Node Detection ───────────────────────────────────

/**
 * Check if the target node execution is after a completed restore node in the workflow.
 */
export async function isPostRestoreNode(
  documentId: string,
  nodeExecutionId: string,
): Promise<boolean> {
  // Get the target node's stepOrder
  const [targetExec] = await db
    .select({ stepOrder: nodeExecutions.stepOrder })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!targetExec) {
    throw new Error("未找到节点执行记录");
  }

  // Check if any preceding node is a completed restore node
  const restoreNodes = await db
    .select({ id: nodeExecutions.id })
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.nodeType, "restore"),
        eq(nodeExecutions.status, "completed"),
        lt(nodeExecutions.stepOrder, targetExec.stepOrder),
      ),
    )
    .limit(1);

  return restoreNodes.length > 0;
}

// ─── Security: Model Deployment Type Validation ──────────────────────────────

/**
 * Validate that the selected model meets security constraints.
 * Post-restore nodes may only use local/private models.
 */
export async function validateModelSecurity(
  modelId: string,
  isPostRestore: boolean,
): Promise<void> {
  if (!isPostRestore) return;

  const [result] = await db
    .select({ deploymentType: providers.deploymentType })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.id, modelId))
    .limit(1);

  if (!result) {
    throw new Error("未找到模型记录");
  }

  if (result.deploymentType !== "local") {
    throw forbidden("安全约束：恢复节点后仅允许使用本地模型");
  }
}

// ─── Inline Edit Execution ───────────────────────────────────────────────────

/**
 * Execute an inline edit: stream AI response via SSE and log to model_call_logs.
 */
export async function executeInlineEdit(
  documentId: string,
  nodeExecutionId: string,
  modelId: string,
  prompt: string,
  userId: string,
): Promise<ReadableStream<Uint8Array>> {
  // Look up model + provider
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
    .where(eq(models.id, modelId))
    .limit(1);

  if (!model) {
    throw new Error("未找到模型记录");
  }

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const startTime = Date.now();

      function sendEvent(event: SSEEvent) {
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

      let fullContent = "";

      try {
        const strategy = getStrategy(model.providerType);
        const strategyInput: ModelCallInput = {
          ...model,
          providerType: model.providerType,
        };
        const result = await strategy.execute({
          model: strategyInput,
          resolvedPrompt: prompt,
          sendEvent,
        });
        fullContent = result.content;

        if (result.status === "failed") {
          throw new Error(result.errorMessage ?? "Model call failed");
        }

        // Send complete event
        sendEvent({
          type: "complete",
          modelId: model.id,
          data: fullContent,
          timestamp: new Date().toISOString(),
        });

        // Log successful inline edit call
        await db.insert(modelCallLogs).values({
          documentId,
          nodeExecutionId,
          userId,
          providerId: model.providerId,
          providerName: model.providerName,
          modelId: model.id,
          modelName: model.displayName,
          callSource: "inline_edit",
          promptTemplate: null,
          resolvedPrompt: prompt,
          variableMapping: null,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          responseStatus: "completed",
          responseContent: fullContent,
          contentLength: fullContent.length,
          tokenUsage: null,
          duration: Date.now() - startTime,
          errorMessage: null,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        sendEvent({
          type: "error",
          modelId: model.id,
          data: errorMessage,
          timestamp: new Date().toISOString(),
        });

        // Log failed inline edit call
        await db.insert(modelCallLogs).values({
          documentId,
          nodeExecutionId,
          userId,
          providerId: model.providerId,
          providerName: model.providerName,
          modelId: model.id,
          modelName: model.displayName,
          callSource: "inline_edit",
          promptTemplate: null,
          resolvedPrompt: prompt,
          variableMapping: null,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          responseStatus: "failed",
          responseContent: fullContent || null,
          contentLength: fullContent.length || null,
          tokenUsage: null,
          duration: Date.now() - startTime,
          errorMessage,
        });
      }

      controller.close();
    },
  });
}
