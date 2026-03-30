import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import {
  createTemplate,
  deleteTemplate,
  getDefaultTemplate,
  getTemplate,
  listTemplates,
  setDefault,
  updateTemplate,
} from "./ppt-templates.service";

export const pptTemplateRoutes = new Elysia({ prefix: "/ppt-templates" })
  .use(requireAdmin)
  .get(
    "/",
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Math.min(Number(query.limit) || 20, 100);
      const type = query.type as "code_theme" | "native_pptx" | undefined;
      return await listTemplates(page, limit, type);
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        type: t.Optional(t.Union([t.Literal("code_theme"), t.Literal("native_pptx")])),
      }),
    },
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        return await getTemplate(params.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "TEMPLATE_NOT_FOUND") {
          set.status = 404;
          return { error: "PPT 模板不存在" };
        }
        throw err;
      }
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/",
    async ({ body, user, set }) => {
      const template = await createTemplate({
        ...body,
        createdBy: user?.id,
      });
      set.status = 201;
      return template;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String({ maxLength: 500 })),
        type: t.Union([t.Literal("code_theme"), t.Literal("native_pptx")]),
        aspectRatio: t.Optional(t.String({ maxLength: 10 })),
        themeConfig: t.Optional(t.Any()),
        templateFilePath: t.Optional(t.String({ maxLength: 500 })),
        availableLayouts: t.Optional(t.Array(t.String())),
      }),
    },
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      try {
        return await updateTemplate(params.id, body);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "TEMPLATE_NOT_FOUND") {
          set.status = 404;
          return { error: "PPT 模板不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.String({ maxLength: 500 })),
        aspectRatio: t.Optional(t.String({ maxLength: 10 })),
        themeConfig: t.Optional(t.Any()),
        templateFilePath: t.Optional(t.String({ maxLength: 500 })),
        availableLayouts: t.Optional(t.Array(t.String())),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
        return await deleteTemplate(params.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "TEMPLATE_NOT_FOUND") {
          set.status = 404;
          return { error: "PPT 模板不存在" };
        }
        throw err;
      }
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/:id/set-default",
    async ({ params, set }) => {
      try {
        return await setDefault(params.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "TEMPLATE_NOT_FOUND") {
          set.status = 404;
          return { error: "PPT 模板不存在" };
        }
        throw err;
      }
    },
    { params: t.Object({ id: t.String() }) },
  );
