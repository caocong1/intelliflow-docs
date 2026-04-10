import Elysia, { t } from "elysia";
import { authPlugin, requireAuth } from "./auth.guard";
import { createSession, deleteSession, validateCredentials } from "./auth.service";
import { changePassword } from "../users/users.service";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/login",
    async ({ body, set }) => {
      const user = await validateCredentials(body.username, body.password);

      if (!user) {
        set.status = 401;
        return { error: "用户名或密码错误" };
      }

      const token = await createSession(user.id);

      return { token, user };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
    },
  )
  .use(authPlugin)
  .get("/me", ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "未授权" };
    }
    return { user };
  })
  .post("/logout", async ({ sessionToken, set }) => {
    if (!sessionToken) {
      set.status = 401;
      return { error: "未授权" };
    }
    await deleteSession(sessionToken);
    return { success: true };
  })
  .use(requireAuth)
  .patch(
    "/change-password",
    async ({ user, set, body }) => {
      if (!user) {
        set.status = 401;
        return { error: "未授权" };
      }
      try {
        await changePassword(user.id, body.oldPassword, body.newPassword);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "WRONG_PASSWORD") {
          set.status = 400;
          return { error: "原密码错误" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        oldPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 6, maxLength: 100 }),
      }),
    },
  );
