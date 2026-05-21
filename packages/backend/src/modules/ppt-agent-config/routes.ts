import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import { MiniMaxClient, MiniMaxConfigError } from "../ppt-agent/minimax-client";
import { getActivePptAiRuntimeConfig, getPublicPptAiConfig, updatePptAiConfig } from "./service";

export const pptAgentConfigRoutes = new Elysia({ prefix: "/ppt-agent-config" })
  .use(requireAdmin)
  .get("/", async () => {
    return { data: await getPublicPptAiConfig() };
  })
  .patch(
    "/",
    async ({ body }) => {
      return { data: await updatePptAiConfig(body) };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        providerType: t.Optional(t.Literal("openai_compatible")),
        baseUrl: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
        apiKey: t.Optional(t.String({ maxLength: 1000 })),
        apiKeyEnvVar: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        textModel: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        textEndpoint: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        imageModel: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        imageEndpoint: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        imageAspectRatio: t.Optional(t.String({ minLength: 1, maxLength: 20 })),
        imageResponseFormat: t.Optional(t.Literal("base64")),
        imagePromptOptimizer: t.Optional(t.Boolean()),
        temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
        maxCompletionTokens: t.Optional(t.Integer({ minimum: 1, maximum: 1000000 })),
        textTimeoutMs: t.Optional(t.Integer({ minimum: 1000, maximum: 600000 })),
        imageTimeoutMs: t.Optional(t.Integer({ minimum: 1000, maximum: 600000 })),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .post("/test", async ({ set }) => {
    try {
      const client = new MiniMaxClient(await getActivePptAiRuntimeConfig());
      const result = await client.testTextConnection();
      return {
        success: true,
        message: "连接成功",
        latencyMs: result.latencyMs,
        model: result.model,
      };
    } catch (err) {
      if (err instanceof MiniMaxConfigError) {
        set.status = 400;
        return { success: false, error: err.message };
      }
      set.status = 400;
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
