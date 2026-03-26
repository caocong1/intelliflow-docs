import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { globalSearch } from "./search.service";

// ─── Search Routes (authenticated users) ─────────────────────────────────────

export const searchRoutes = new Elysia({ prefix: "/search" })
  .use(requireAuth)
  .get(
    "/",
    async ({ query, user }) => {
      const q = query.q?.trim();
      if (!q) {
        return {
          projects: { items: [], total: 0 },
          documents: { items: [], total: 0 },
          workflows: { items: [], total: 0 },
        };
      }
      const limit = query.limit ? Number(query.limit) : 3;
      return globalSearch(user!.id, q, limit);
    },
    {
      query: t.Object({
        q: t.String(),
        limit: t.Optional(t.String()),
      }),
    },
  );
