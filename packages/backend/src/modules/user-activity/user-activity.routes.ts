import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import {
  toggleFavorite,
  listFavorites,
  checkFavorites,
  recordAccess,
  listRecentAccess,
} from "./user-activity.service";

// ─── Target type schema (reused across endpoints) ────────────────────────────

const targetTypeSchema = t.Union([
  t.Literal("project"),
  t.Literal("document"),
  t.Literal("workflow"),
]);

// ─── User Activity Routes (authenticated users) ─────────────────────────────

export const userActivityRoutes = new Elysia({ prefix: "/user-activity" })
  .use(requireAuth)

  // ─── Favorites ─────────────────────────────────────────────────────────
  .post(
    "/favorites/toggle",
    async ({ body, user }) => {
      return toggleFavorite(user!.id, body.targetType, body.targetId);
    },
    {
      body: t.Object({
        targetType: targetTypeSchema,
        targetId: t.String(),
      }),
    },
  )
  .get("/favorites", async ({ user }) => {
    return listFavorites(user!.id);
  })
  .post(
    "/favorites/check",
    async ({ body, user }) => {
      return checkFavorites(user!.id, body.items);
    },
    {
      body: t.Object({
        items: t.Array(
          t.Object({
            targetType: targetTypeSchema,
            targetId: t.String(),
          }),
        ),
      }),
    },
  )

  // ─── Recent Access ─────────────────────────────────────────────────────
  .post(
    "/recent-access",
    async ({ body, user }) => {
      return recordAccess(user!.id, body.targetType, body.targetId);
    },
    {
      body: t.Object({
        targetType: targetTypeSchema,
        targetId: t.String(),
      }),
    },
  )
  .get(
    "/recent-access",
    async ({ query, user }) => {
      const limit = query.limit ? Number(query.limit) : 20;
      return listRecentAccess(user!.id, limit);
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  );
