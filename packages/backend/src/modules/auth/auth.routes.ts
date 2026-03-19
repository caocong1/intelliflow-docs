import Elysia, { t } from "elysia";
import { authPlugin } from "./auth.guard";
import { createSession, deleteSession, validateCredentials } from "./auth.service";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/login",
    async ({ body, set }) => {
      const user = await validateCredentials(body.username, body.password);

      if (!user) {
        set.status = 401;
        return { error: "Invalid credentials" };
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
      return { error: "Unauthorized" };
    }
    return { user };
  })
  .post("/logout", async ({ sessionToken, set }) => {
    if (!sessionToken) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    await deleteSession(sessionToken);
    return { success: true };
  });
