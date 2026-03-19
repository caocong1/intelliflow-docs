import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import {
  createModel,
  deleteModel,
  listModelsByProvider,
  toggleModelStatus,
  updateModel,
} from "./models.service";

export const modelRoutes = new Elysia({ prefix: "/models" })
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
  );
