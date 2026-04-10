import Elysia, { t } from "elysia";
import { requireAdmin, requireAuth } from "../auth/auth.guard";
import { createUser, listUsers, resetPassword, toggleUserStatus, updateUser } from "./users.service";

// ── Read routes (any authenticated user) ─────────────────────────────────────

export const userReadRoutes = new Elysia({ prefix: "/users" }).use(requireAuth).get(
  "/",
  async ({ query, user }) => {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const search = query.search || undefined;
    const activeOnly = user?.role !== "admin";
    const { data, total } = await listUsers(page, pageSize, search, activeOnly);
    return { data, total, page, pageSize };
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
      search: t.Optional(t.String()),
    }),
  },
);

// ── Admin routes (admin only) ────────────────────────────────────────────────

export const userAdminRoutes = new Elysia({ prefix: "/users" })
  .use(requireAdmin)
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const user = await createUser(body);
        set.status = 201;
        return user;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // PostgreSQL unique violation code is 23505
        if (message.includes("23505") || message.includes("unique")) {
          set.status = 409;
          return { error: "用户名已存在" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3, maxLength: 50 }),
        password: t.String({ minLength: 6, maxLength: 100 }),
        displayName: t.String({ minLength: 1, maxLength: 100 }),
        role: t.Union([t.Literal("admin"), t.Literal("user")]),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const user = await updateUser(params.id, body);
        return user;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "USER_NOT_FOUND") {
          set.status = 404;
          return { error: "用户不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        displayName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        role: t.Optional(t.Union([t.Literal("admin"), t.Literal("user")])),
      }),
    },
  )
  .patch(
    "/:id/password",
    async ({ params, body, set }) => {
      try {
        await resetPassword(params.id, body.password);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "USER_NOT_FOUND") {
          set.status = 404;
          return { error: "用户不存在" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        password: t.String({ minLength: 6, maxLength: 100 }),
      }),
    },
  )
  .patch(
    "/:id/status",
    async ({ params, set }) => {
      try {
        const user = await toggleUserStatus(params.id);
        return user;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "USER_NOT_FOUND") {
          set.status = 404;
          return { error: "用户不存在" };
        }
        if (message === "LAST_ACTIVE_ADMIN") {
          set.status = 409;
          return { error: "不能停用最后一个管理员" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
