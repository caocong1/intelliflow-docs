import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "./notifications.service";

// ─── Notification Routes (authenticated users) ──────────────────────────────

export const notificationRoutes = new Elysia({ prefix: "/notifications" })
  .use(requireAuth)
  .get(
    "/",
    async ({ query, user }) => {
      const limit = Number(query.limit) || 50;
      const offset = Number(query.offset) || 0;
      return getNotifications(user!.id, { limit, offset });
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  .get("/unread-count", async ({ user }) => {
    return getUnreadCount(user!.id);
  })
  .patch(
    "/:id/read",
    async ({ params, user, set }) => {
      const result = await markRead(params.id, user!.id);
      if (!result) {
        set.status = 404;
        return { error: "通知不存在" };
      }
      return result;
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .patch("/read-all", async ({ user }) => {
    return markAllRead(user!.id);
  });
