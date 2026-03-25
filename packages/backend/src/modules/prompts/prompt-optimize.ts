import Elysia, { t } from "elysia";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/auth.guard";
import { db } from "../../db";
import { models, modelCallLogs, providers } from "../../db/schema";
import { getStrategy } from "../runtime/strategies";
import type { ModelCallInput } from "../runtime/strategies";

const DEFAULT_META_PROMPT = `你是一个提示词优化专家。请优化以下提示词，使其更加清晰、具体、结构化。
保留原始意图和所有变量引用（如 {{节点名.输出名}}），不要改变变量格式。
只返回优化后的提示词文本，不要添加解释。`;

export const promptOptimizeRoutes = new Elysia({ prefix: "/prompts" })
  .use(requireAuth)
  .post(
    "/optimize",
    async ({ body, set, user }) => {
      const { promptText, modelId, metaPrompt } = body;

      // Validate prompt text
      if (!promptText.trim()) {
        set.status = 400;
        return { error: "提示词不能为空" };
      }

      // Fetch model + provider info
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
          providerId: providers.id,
          providerName: providers.name,
          providerType: providers.type,
          agentMode: models.agentMode,
          agentMaxTurns: models.agentMaxTurns,
          agentMaxBudgetUsd: models.agentMaxBudgetUsd,
          agentAllowedTools: models.agentAllowedTools,
        })
        .from(models)
        .innerJoin(providers, eq(models.providerId, providers.id))
        .where(and(eq(models.id, modelId), eq(models.isActive, true)))
        .limit(1);

      if (!model) {
        set.status = 404;
        return { error: "模型不存在或未启用" };
      }

      const systemPrompt = metaPrompt?.trim() || DEFAULT_META_PROMPT;
      const resolvedPrompt = `${systemPrompt}\n\n${promptText}`;

      const startTime = Date.now();

      try {
        const strategy = getStrategy(model.providerType);
        const strategyInput: ModelCallInput = {
          ...model,
          providerType: model.providerType as ModelCallInput["providerType"],
        };

        const result = await strategy.execute({
          model: strategyInput,
          resolvedPrompt,
          sendEvent: () => {},
        });

        const latencyMs = Date.now() - startTime;
        const optimizedText = result.content?.trim() ?? "";

        // Log the call
        await db.insert(modelCallLogs).values({
          userId: user?.id ?? null,
          providerId: model.providerId,
          providerName: model.providerName,
          modelId: model.id,
          modelName: model.displayName,
          callSource: "prompt_optimize",
          resolvedPrompt,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          responseStatus: result.status === "failed" || !optimizedText ? "failed" : "completed",
          responseContent: optimizedText || null,
          contentLength: optimizedText.length || null,
          duration: latencyMs,
          errorMessage: result.status === "failed" ? (result.errorMessage ?? null) : optimizedText ? null : "模型未返回有效结果",
        });

        if (result.status === "failed") {
          set.status = 502;
          return { error: result.errorMessage ?? "模型调用失败，请稍后重试" };
        }

        if (!optimizedText) {
          set.status = 502;
          return { error: "模型未返回有效结果" };
        }

        return {
          optimizedText,
          modelUsed: model.id,
        };
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Prompt optimize error: ${message}`);

        await db.insert(modelCallLogs).values({
          userId: user?.id ?? null,
          providerId: model.providerId,
          providerName: model.providerName,
          modelId: model.id,
          modelName: model.displayName,
          callSource: "prompt_optimize",
          resolvedPrompt,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          responseStatus: "failed",
          duration: latencyMs,
          errorMessage: message,
        });

        set.status = 502;
        return { error: "模型调用失败，请稍后重试" };
      }
    },
    {
      body: t.Object({
        promptText: t.String({ minLength: 1 }),
        modelId: t.String(),
        metaPrompt: t.Optional(t.String()),
      }),
    },
  );
