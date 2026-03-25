import Elysia, { t } from "elysia";
import { requireAdmin, requireAuth } from "../auth/auth.guard";
import {
  createModel,
  deleteModel,
  listActiveModels,
  listModelsByProvider,
  testModelPrompt,
  toggleModelStatus,
  updateModel,
} from "./models.service";

// ── Read routes (any authenticated user) ─────────────────────────────────────

export const modelReadRoutes = new Elysia({ prefix: "/models" })
  .use(requireAuth)
  .get("/", async () => {
    const data = await listActiveModels();
    return { data };
  });

// ── Admin routes (admin only) ────────────────────────────────────────────────

export const modelAdminRoutes = new Elysia({ prefix: "/models" })
  .use(requireAdmin)
  .get(
    "/by-provider/:providerId",
    async ({ params }) => {
      const data = await listModelsByProvider(params.providerId);
      return { data };
    },
    {
      params: t.Object({ providerId: t.String() }),
    },
  )
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const model = await createModel(body);
        set.status = 201;
        return model;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "PROVIDER_NOT_FOUND") {
          set.status = 400;
          return { error: "供应商不存在" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        providerId: t.String(),
        modelId: t.String({ minLength: 1, maxLength: 200 }),
        displayName: t.String({ minLength: 1, maxLength: 100 }),
        temperature: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 2 }))),
        maxTokens: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 1000000 }))),
        topP: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 1 }))),
        agentMode: t.Optional(t.Nullable(t.Union([t.Literal("simple_chat"), t.Literal("autonomous_agent")]))),
        agentMaxTurns: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 100 }))),
        agentMaxBudgetUsd: t.Optional(t.Nullable(t.String({ maxLength: 20 }))),
        agentAllowedTools: t.Optional(t.Nullable(t.Array(t.String()))),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const model = await updateModel(params.id, body);
        return model;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "MODEL_NOT_FOUND") {
          set.status = 404;
          return { error: "模型不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        modelId: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        displayName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        temperature: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 2 }))),
        maxTokens: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 1000000 }))),
        topP: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 1 }))),
        agentMode: t.Optional(t.Nullable(t.Union([t.Literal("simple_chat"), t.Literal("autonomous_agent")]))),
        agentMaxTurns: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 100 }))),
        agentMaxBudgetUsd: t.Optional(t.Nullable(t.String({ maxLength: 20 }))),
        agentAllowedTools: t.Optional(t.Nullable(t.Array(t.String()))),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
        return await deleteModel(params.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "MODEL_NOT_FOUND") {
          set.status = 404;
          return { error: "模型不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .patch(
    "/:id/status",
    async ({ params, set }) => {
      try {
        const model = await toggleModelStatus(params.id);
        return model;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "MODEL_NOT_FOUND") {
          set.status = 404;
          return { error: "模型不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/test",
    async ({ params, body, set, user }) => {
      try {
        const result = await testModelPrompt(params.id, body.prompt, user?.id);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "MODEL_NOT_FOUND") {
          set.status = 404;
          return { error: "模型不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        prompt: t.String({ minLength: 1, maxLength: 10000 }),
      }),
    },
  );
