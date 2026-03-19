import Elysia from "elysia";
import type { SessionUser } from "./auth.service";
import { getSessionUser } from "./auth.service";

export const authPlugin = new Elysia({ name: "auth" }).resolve(
  { as: "global" },
  async ({ request }): Promise<{ user: SessionUser | null; sessionToken: string | null }> => {
    const authorization = request.headers.get("Authorization");
    let token: string | null = null;
    let user: SessionUser | null = null;

    if (authorization?.startsWith("Bearer ")) {
      token = authorization.slice(7);
      user = await getSessionUser(token);
    }

    return { user, sessionToken: token };
  },
);

export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(authPlugin)
  .onBeforeHandle({ as: "scoped" }, ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  });

export const requireAdmin = new Elysia({ name: "requireAdmin" })
  .use(authPlugin)
  .onBeforeHandle({ as: "scoped" }, ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden" };
    }
  });
