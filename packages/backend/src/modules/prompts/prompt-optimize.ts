import Elysia, { t } from "elysia";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/auth.guard";
import { db } from "../../db";
import { models, providers } from "../../db/schema";

const DEFAULT_META_PROMPT = `你是一个提示词优化专家。请优化以下提示词，使其更加清晰、具体、结构化。
保留原始意图和所有变量引用（如 {{节点名.输出名}}），不要改变变量格式。
只返回优化后的提示词文本，不要添加解释。`;

export const promptOptimizeRoutes = new Elysia({ prefix: "/prompts" })
  .use(requireAuth)
  .post(
    "/optimize",
    async ({ body, set }) => {
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
        })
        .from(models)
        .innerJoin(providers, eq(models.providerId, providers.id))
        .where(and(eq(models.id, modelId), eq(models.isActive, true)))
        .limit(1);

      if (!model) {
        set.status = 404;
        return { error: "模型不存在或未启用" };
      }

      // Build request to OpenAI-compatible API
      const systemPrompt = metaPrompt?.trim() || DEFAULT_META_PROMPT;

      const requestBody: Record<string, unknown> = {
        model: model.modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptText },
        ],
        stream: false,
      };

      if (model.temperature != null) requestBody.temperature = model.temperature;
      if (model.maxTokens != null) requestBody.max_tokens = model.maxTokens;
      if (model.topP != null) requestBody.top_p = model.topP;

      try {
        const response = await fetch(`${model.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${model.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          console.error(`Prompt optimize model call failed: HTTP ${response.status} ${errText.slice(0, 200)}`);
          set.status = 502;
          return { error: "模型调用失败，请稍后重试" };
        }

        const result = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        const optimizedText = result.choices?.[0]?.message?.content?.trim() ?? "";

        if (!optimizedText) {
          set.status = 502;
          return { error: "模型未返回有效结果" };
        }

        return {
          optimizedText,
          modelUsed: model.id,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Prompt optimize error: ${message}`);
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
