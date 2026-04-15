import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import {
  createTemplate,
  deleteTemplate,
  getDefaultTemplate,
  getTemplate,
  listTemplates,
  reRecognizeNativeTemplate,
  setDefault,
  updateTemplate,
  uploadTemplate,
  validateThemeConfig,
} from "./ppt-templates.service";

export const pptTemplateRoutes = new Elysia({ prefix: "/ppt-templates" })
  .use(requireAdmin)
  .get(
    "/",
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Math.min(Number(query.limit) || 20, 100);
      const type = query.type as "code_theme" | "native_pptx" | undefined;
      const includeInactive = query.includeInactive === "true";
      return await listTemplates(page, limit, type, includeInactive);
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        type: t.Optional(t.Union([t.Literal("code_theme"), t.Literal("native_pptx")])),
        includeInactive: t.Optional(t.String()),
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
    "/:id/re-recognize",
    async ({ params, set }) => {
      try {
        return await reRecognizeNativeTemplate(params.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "TEMPLATE_NOT_FOUND") {
          set.status = 404;
          return { error: "PPT 模板不存在" };
        }
        if (message === "TEMPLATE_NOT_NATIVE_PPTX") {
          set.status = 400;
          return { error: "仅原生 PPT 模板支持重新识别" };
        }
        if (message === "TEMPLATE_PROFILE_PARSE_FAILED") {
          set.status = 400;
          return { error: "模板识别失败，请检查模板文件结构" };
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
        if (message === "INACTIVE_TEMPLATE_CANNOT_BE_DEFAULT") {
          set.status = 400;
          return { error: "停用模板不能设为默认模板" };
        }
        throw err;
      }
    },
    { params: t.Object({ id: t.String() }) },
  )

  // ─── Upload native .pptx template ──────────────────────────────────────────

  .post(
    "/upload",
    async ({ body, user, set }) => {
      try {
        const result = await uploadTemplate({
          file: body.file,
          name: body.name,
          description: body.description,
          createdBy: user?.id,
        });
        set.status = 201;
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const errorMap: Record<string, { status: number; error: string }> = {
          INVALID_FILE_TYPE: { status: 400, error: "仅支持 .pptx 文件" },
          FILE_TOO_LARGE: { status: 400, error: "文件大小不能超过 50MB" },
          NO_PLACEHOLDERS: {
            status: 400,
            error: "模板中未检测到 {{XXX}} 占位符，无法动态填充内容",
          },
          MISSING_TITLE_PLACEHOLDER: {
            status: 400,
            error: "模板中缺少含 {{TITLE}} 的 layout",
          },
          MISSING_BODY_PLACEHOLDER: {
            status: 400,
            error: "模板中缺少含 {{BODY}} 的 layout",
          },
        };
        const mapped = errorMap[message];
        if (mapped) {
          set.status = mapped.status;
          return { error: mapped.error };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: "50m",
          type: [
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          ],
        }),
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String({ maxLength: 500 })),
      }),
    },
  )

  // ─── Create code theme template ────────────────────────────────────────────

  .post(
    "/create-theme",
    async ({ body, user, set }) => {
      const validation = validateThemeConfig(body.themeConfig);
      if (!validation.valid) {
        set.status = 400;
        return { error: "themeConfig 校验失败", details: validation.errors };
      }

      const template = await createTemplate({
        name: body.name,
        description: body.description,
        type: "code_theme",
        aspectRatio: body.aspectRatio,
        themeConfig: body.themeConfig,
        createdBy: user?.id,
      });
      set.status = 201;
      return template;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String({ maxLength: 500 })),
        aspectRatio: t.Optional(
          t.Union([t.Literal("16:9"), t.Literal("4:3")]),
        ),
        themeConfig: t.Any(),
      }),
    },
  );
