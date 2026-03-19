import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import {
  createProvider,
  deleteProvider,
  listProviders,
  testProviderConnection,
  toggleProviderStatus,
  updateProvider,
} from "./providers.service";

export const providerRoutes = new Elysia({ prefix: "/providers" })
  .use(requireAdmin)
  .get("/", async () => {
    const data = await listProviders();
    return { data };
  })
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const provider = await createProvider(body);
        set.status = 201;
        return provider;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("23505") || message.includes("unique")) {
          set.status = 409;
          return { error: "供应商名称已存在" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        type: t.Optional(
          t.Union([t.Literal("openai_compatible"), t.Literal("opencode")]),
        ),
        deploymentType: t.Optional(
          t.Union([t.Literal("cloud"), t.Literal("local")]),
        ),
        baseUrl: t.String({ minLength: 1, maxLength: 500 }),
        apiKey: t.Optional(t.String({ maxLength: 500 })),
        username: t.Optional(t.String({ maxLength: 100 })),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const provider = await updateProvider(params.id, body);
        return provider;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "PROVIDER_NOT_FOUND") {
          set.status = 404;
          return { error: "供应商不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        deploymentType: t.Optional(
          t.Union([t.Literal("cloud"), t.Literal("local")]),
        ),
        baseUrl: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
        apiKey: t.Optional(t.String({ maxLength: 500 })),
        username: t.Optional(t.String({ maxLength: 100 })),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
        return await deleteProvider(params.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "PROVIDER_NOT_FOUND") {
          set.status = 404;
          return { error: "供应商不存在" };
        }
        if (message === "HAS_MODELS") {
          set.status = 409;
          return { error: "请先删除该供应商下的所有模型" };
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
        const provider = await toggleProviderStatus(params.id);
        return provider;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "PROVIDER_NOT_FOUND") {
          set.status = 404;
          return { error: "供应商不存在" };
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
    async ({ params, body, set }) => {
      try {
        const result = await testProviderConnection(params.id, body?.modelId);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "PROVIDER_NOT_FOUND") {
          set.status = 404;
          return { error: "供应商不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Optional(
        t.Object({
          modelId: t.Optional(t.String()),
        }),
      ),
    },
  );
