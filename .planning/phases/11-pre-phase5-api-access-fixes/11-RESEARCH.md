# Phase 11: Pre-Phase 5 API Access Fixes - Research

**Researched:** 2026-03-20
**Domain:** Elysia route-level middleware splitting, API access control (users, models, workflow detail)
**Confidence:** HIGH

## Summary

Phase 11 closes two integration gaps (INT-NEW-02, INT-NEW-03) and one Phase 5 readiness blocker identified in the v1.0 milestone audit (re-audit #5). All three issues share the same root cause: read endpoints behind `requireAdmin` that need to be accessible to non-admin authenticated users.

The three affected route files are: (1) `users.routes.ts` -- non-admin project owners cannot search users to invite members because `GET /api/users` is admin-only; (2) `models.routes.ts` -- `GET /api/models` is admin-only but Phase 5 workspace components (`ModelCallConfig.tsx`, `DesensitizeConfig.tsx`) need model lists for non-admin users; (3) `workflows.routes.ts` -- `GET /api/workflows/:id` is in `workflowAdminRoutes` but Phase 5 runtime needs to load single workflow definitions for non-admin users.

Phase 10 established the exact pattern needed: split each route file into `*ReadRoutes` (requireAuth) and `*AdminRoutes` (requireAdmin) exports, register both in `index.ts`. This phase applies the same pattern to three more route files. No new libraries, no architectural changes, no frontend modifications required.

**Primary recommendation:** Apply the Phase 10 route-splitting pattern to users, models, and workflow-detail routes. Add a search/filter parameter to `listUsers` for the invite use case. Move `GET /api/workflows/:id` from `workflowAdminRoutes` to `workflowReadRoutes`. The `listActiveModels` service already filters correctly -- only route guard change needed.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROJ-05 | 项目负责人可邀请和移除项目成员 | INT-NEW-02 fix: split users.routes.ts so `GET /api/users` (with search parameter) uses requireAuth, enabling non-admin project owners to search users for invitation. Add search/username filter to `listUsers` service. All mutation endpoints (POST, PATCH, PATCH /:id/status) remain behind requireAdmin. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Elysia | (project version) | HTTP framework with middleware chaining | Already in use; `.use()` scoping is the standard pattern for per-route middleware |
| Drizzle ORM | (project version) | SQL query builder | Already in use; `eq()`, `and()`, `ilike()` for adding filter conditions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| requireAuth guard | N/A (auth.guard.ts:21) | Authenticate any logged-in user | Apply to read-only endpoints |
| requireAdmin guard | N/A (auth.guard.ts:30) | Authenticate admin users only | Keep on all mutation endpoints |

No new libraries needed. This is purely an internal restructuring.

## Architecture Patterns

### Pattern: Phase 10 Route-Splitting (Established)

**What:** Split a single route file with one guard level into two Elysia instances with different guards, sharing the same URL prefix. Export both from the route file, register both in `index.ts`.

**When to use:** When a route file needs mixed auth levels -- some endpoints for any authenticated user, others for admins only.

**Current state of each target file:**

```
users.routes.ts (BEFORE — single requireAdmin):
  GET /          ← list users (needs requireAuth for invite search)
  POST /         ← create user (keep requireAdmin)
  PATCH /:id     ← update user (keep requireAdmin)
  PATCH /:id/status ← toggle status (keep requireAdmin)

models.routes.ts (BEFORE — single requireAdmin):
  GET /              ← list active models (needs requireAuth)
  GET /by-provider/:providerId ← list by provider (keep requireAdmin — admin model config only)
  POST /             ← create model (keep requireAdmin)
  PATCH /:id         ← update model (keep requireAdmin)
  DELETE /:id        ← delete model (keep requireAdmin)
  PATCH /:id/status  ← toggle status (keep requireAdmin)

workflows.routes.ts (AFTER Phase 10 — already split):
  workflowReadRoutes:  GET /         ← list (already requireAuth)
  workflowAdminRoutes: GET /:id      ← detail (needs move to requireAuth)
                       POST /        ← create (keep requireAdmin)
                       PUT /:id      ← update (keep requireAdmin)
                       ... all other mutations (keep requireAdmin)
```

### Pattern Application: Users

```typescript
// users.routes.ts — AFTER
import Elysia, { t } from "elysia";
import { requireAuth, requireAdmin } from "../auth/auth.guard";
import { createUser, listUsers, toggleUserStatus, updateUser } from "./users.service";

// Read routes — any authenticated user
export const userReadRoutes = new Elysia({ prefix: "/users" })
  .use(requireAuth)
  .get(
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

// Admin routes — admin only
export const userAdminRoutes = new Elysia({ prefix: "/users" })
  .use(requireAdmin)
  .post("/", ...)   // create
  .patch("/:id", ...)  // update
  .patch("/:id/status", ...);  // toggle
```

**Key design decision for users:** The `GET /api/users` endpoint under `requireAuth` uses role-aware filtering:
- **Admin callers** see all users (including inactive) -- for the admin user management page
- **Non-admin callers** see only active users -- for the member invite search in `ProjectSettings.tsx`

This mirrors the Phase 10 pattern for document-types and workflows where `activeOnly = user?.role !== "admin"`.

### Pattern Application: Models

```typescript
// models.routes.ts — AFTER
import Elysia, { t } from "elysia";
import { requireAuth, requireAdmin } from "../auth/auth.guard";

// Read routes — any authenticated user
export const modelReadRoutes = new Elysia({ prefix: "/models" })
  .use(requireAuth)
  .get(
    "/",
    async () => {
      const data = await listActiveModels();
      return { data };
    },
  );

// Admin routes — admin only
export const modelAdminRoutes = new Elysia({ prefix: "/models" })
  .use(requireAdmin)
  .get("/by-provider/:providerId", ...)  // admin model config page
  .post("/", ...)
  .patch("/:id", ...)
  .delete("/:id", ...)
  .patch("/:id/status", ...);
```

**Key observation:** `listActiveModels()` already filters `where(eq(models.isActive, true))` and JOINs provider name. No service layer change needed for models -- only the route guard changes.

### Pattern Application: Workflow Detail

```typescript
// workflows.routes.ts — AFTER (move GET /:id from admin to read)

export const workflowReadRoutes = new Elysia({ prefix: "/workflows" })
  .use(requireAuth)
  .get("/", ...)     // existing list (already here from Phase 10)
  .get("/:id", ...); // MOVED from workflowAdminRoutes

export const workflowAdminRoutes = new Elysia({ prefix: "/workflows" })
  .use(requireAdmin)
  // GET /:id removed — now in read routes
  .post("/", ...)
  .put("/:id", ...)
  .delete("/:id", ...)
  .post("/:id/validate", ...)
  .post("/:id/copy", ...)
  .patch("/:id/status", ...)
  .patch("/:id/set-default", ...);
```

**Key observation:** `getWorkflow()` returns the full workflow graph (nodes, edges, config). Phase 5 runtime needs this to execute the workflow for non-admin users. The data is not sensitive -- it contains node configurations and prompt templates that the user will interact with during document creation. No role-aware filtering needed for the detail endpoint.

### Anti-Patterns to Avoid
- **Creating new search-specific endpoints:** Do NOT create `/users/search` or `/models/active`. Reuse existing `GET /` paths to maintain Eden Treaty client compatibility.
- **Removing the admin list functionality:** The admin user management page calls `GET /api/users` to list all users. The role-aware filter ensures admins still see everything.
- **Adding search to models:** The `listActiveModels()` function already returns all active models. Do not add search/pagination -- the model list is small and clients filter client-side.
- **Conditional logic for workflow detail:** Do NOT add role-checking inside `GET /api/workflows/:id`. Any authenticated user should be able to load any workflow definition -- project-level access control is handled by the project membership check in Phase 5.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth guard middleware | Custom auth check in handlers | `requireAuth` / `requireAdmin` from auth.guard.ts | Already battle-tested; consistent across all routes |
| User search | Custom search endpoint | Add `search` + `ilike` to existing `listUsers` | Follows existing pattern from document-types service |
| Active-only user filtering | Complex role-check logic | `eq(users.isActive, true)` via optional param | Same pattern as document-types `activeOnly` |

**Key insight:** Every route-split in this phase follows the exact same pattern established by Phase 10 for document-types and workflows list. The pattern is proven and consistent.

## Common Pitfalls

### Pitfall 1: Eden Treaty Type Breakage on Users
**What goes wrong:** Replacing the single `userRoutes` export with `userReadRoutes` + `userAdminRoutes` changes the type signature, breaking the `App` type exported from `index.ts`, which breaks Eden Treaty client calls in the frontend.
**Why it happens:** The frontend imports `App` type and generates typed client methods. Changing `.use()` registrations in `index.ts` changes the inferred type.
**How to avoid:** Register both new route exports in `index.ts` using `.use()`. The Eden Treaty client auto-unions route types from the same prefix. Run `bun run check` (tsc) after the backend change to verify the frontend type-checks.
**Warning signs:** TypeScript errors in `api.api.users.get()` calls in `ProjectSettings.tsx` or `UserManagement.tsx`.

### Pitfall 2: Breaking Admin User Management Page
**What goes wrong:** After adding `activeOnly` to `listUsers`, the admin user management page (`UserManagement.tsx`) only shows active users because the filter is always applied.
**Why it happens:** If `activeOnly` defaults to `true` instead of being role-aware.
**How to avoid:** Use `const activeOnly = user?.role !== "admin"` in the route handler. Admin callers pass `activeOnly = false`, non-admin callers pass `activeOnly = true`. The existing `UserManagement.tsx` calls `GET /api/users` without any active filter -- it expects all users.
**Warning signs:** Admin page missing inactive/disabled users after the change.

### Pitfall 3: Search Parameter Missing from listUsers
**What goes wrong:** The `listUsers` service currently takes only `(page, pageSize)` with no search capability. The `ProjectSettings.tsx` `handleInvite()` fetches ALL users (`pageSize: "1000"`) and filters client-side by username. Without adding server-side search, this works but is inefficient.
**Why it happens:** The original user management page lists all users without search.
**How to avoid:** Add optional `search` parameter to `listUsers` with `ilike(users.username, ...)` or `ilike(users.displayName, ...)`. This follows the same pattern as `listDocumentTypes` (already has search). Even though the frontend currently does client-side filtering, adding server-side search is the right thing to do for consistency and future optimization.
**Warning signs:** N/A -- existing behavior works, but adding search is good practice.

### Pitfall 4: Forgetting to Update index.ts Registration
**What goes wrong:** Creating new exports but not updating `index.ts` imports and `.use()` registrations.
**Why it happens:** Multiple files to update, easy to miss one.
**How to avoid:** After creating new route exports, update `index.ts` to: (1) change `userRoutes` import to `userReadRoutes, userAdminRoutes`; (2) change `modelRoutes` import to `modelReadRoutes, modelAdminRoutes`; (3) replace `.use(userRoutes)` with `.use(userReadRoutes).use(userAdminRoutes)`; (4) replace `.use(modelRoutes)` with `.use(modelReadRoutes).use(modelAdminRoutes)`. The workflow routes are already split -- just move the `GET /:id` handler.
**Warning signs:** 404 on read endpoints for non-admin users.

### Pitfall 5: Route Path Conflict for Workflow Detail
**What goes wrong:** Moving `GET /api/workflows/:id` to `workflowReadRoutes` while keeping it in `workflowAdminRoutes` creates a duplicate route.
**Why it happens:** Copy-paste error when moving the handler between route groups.
**How to avoid:** Remove `GET /:id` from `workflowAdminRoutes` entirely after adding it to `workflowReadRoutes`. There should be exactly one handler for `GET /api/workflows/:id`.
**Warning signs:** Elysia may silently pick the first registered handler, or behave unpredictably.

## Code Examples

### Service Layer: Add search and activeOnly to listUsers

```typescript
// users.service.ts — modified listUsers signature
export async function listUsers(
  page: number,
  pageSize: number,
  search?: string,       // NEW: search by username or displayName
  activeOnly?: boolean,  // NEW: non-admin sees only active users
): Promise<{ data: UserRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(users.username, `%${search}%`),
        ilike(users.displayName, `%${search}%`),
      )
    );
  }
  if (activeOnly) {
    conditions.push(eq(users.isActive, true));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalResult] = await Promise.all([
    db
      .select(userColumns)
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(users).where(whereClause),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}
```

**Note:** Need to add `ilike`, `or` to the imports from `drizzle-orm`. The `and`, `count`, `desc`, `eq`, `ne` are already imported.

### index.ts Registration Update

```typescript
// src/index.ts — updated imports
import { userReadRoutes, userAdminRoutes } from "./modules/users/users.routes";
import { modelReadRoutes, modelAdminRoutes } from "./modules/models/models.routes";
// workflows already split from Phase 10 — no import change needed

const app = new Elysia({ prefix: "/api" })
  // ...
  .use(userReadRoutes)
  .use(userAdminRoutes)
  // ...
  .use(modelReadRoutes)
  .use(modelAdminRoutes)
  // ...
  .use(workflowReadRoutes)   // already registered
  .use(workflowAdminRoutes)  // already registered
```

### Existing Frontend Callers (NO changes needed)

```typescript
// ProjectSettings.tsx — handleInvite() calls GET /api/users
// Currently: api.api.users.get({ query: { page: "1", pageSize: "1000" } })
// After: Same call works — now hits userReadRoutes (requireAuth) instead of 403
// Client-side username matching continues to work

// ModelCallConfig.tsx — fetchModels() calls GET /api/models
// Currently: api.api.models.get({ query: {} })
// After: Same call works — now hits modelReadRoutes (requireAuth)

// DesensitizeConfig.tsx — fetchModels() calls GET /api/models
// Currently: api.api.models.get({ query: {} })
// After: Same call works — now hits modelReadRoutes (requireAuth)

// WorkflowEditor.tsx — calls GET /api/workflows/:id
// Currently: api.api.workflows({ id: params.id }).get()
// After: Same call works — now hits workflowReadRoutes (requireAuth)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single guard per route file | Split guards (Phase 10) | Phase 10 | Established pattern for mixed-guard route files |
| Users list admin-only | Users list role-aware (this phase) | Phase 11 | Non-admin project owners can search users for invite |
| Models list admin-only | Models list any-auth (this phase) | Phase 11 | Phase 5 workspace can access model list |
| Workflow detail admin-only | Workflow detail any-auth (this phase) | Phase 11 | Phase 5 runtime can load workflow definitions |

## Open Questions

1. **Should non-admin users see user password hash or other sensitive fields?**
   - What we know: `listUsers` returns `userColumns` which excludes `passwordHash` (only includes id, username, displayName, role, isActive, createdAt, updatedAt). This is already safe.
   - What's unclear: Nothing -- the column selection is already correct.
   - Recommendation: No change needed. The `userColumns` selection was designed without passwordHash from the start.

2. **Should `GET /api/models/by-provider/:providerId` also be downgraded?**
   - What we know: This endpoint is called only by `ModelConfiguration.tsx` (admin page) to list all models under a specific provider, including inactive ones. Phase 5 components use `GET /api/models` (which returns only active models) instead.
   - What's unclear: No future non-admin use case identified.
   - Recommendation: Keep under `requireAdmin`. Only `GET /api/models` (active models list) needs to be accessible to non-admin users.

3. **Should workflow detail be filtered for non-admin (e.g., only active workflows)?**
   - What we know: Phase 5 runtime will load a workflow by ID when a user starts document creation. The workflow was already selected from the filtered list (active only for non-admin). Loading a specific workflow by ID means the user already has a valid reference.
   - What's unclear: Edge case -- what if a workflow is disabled between selection and loading?
   - Recommendation: Return the workflow regardless of status. The runtime should handle the "workflow no longer active" case gracefully, but that's a Phase 5 concern, not Phase 11.

## Sources

### Primary (HIGH confidence)
- `packages/backend/src/modules/users/users.routes.ts` -- current admin-only route structure (requireAdmin at line 6)
- `packages/backend/src/modules/users/users.service.ts` -- listUsers with no search/filter parameters
- `packages/backend/src/modules/models/models.routes.ts` -- current admin-only route structure (requireAdmin at line 12)
- `packages/backend/src/modules/models/models.service.ts` -- listActiveModels already filters isActive=true with provider JOIN
- `packages/backend/src/modules/workflows/workflows.routes.ts` -- already split (Phase 10), GET /:id currently in workflowAdminRoutes (line 69)
- `packages/backend/src/modules/workflows/workflows.service.ts` -- getWorkflow returns full graph, listWorkflows already has status filter
- `packages/backend/src/modules/document-types/document-types.routes.ts` -- Phase 10 split pattern reference (read + admin exports)
- `packages/backend/src/modules/auth/auth.guard.ts` -- requireAuth (line 21), requireAdmin (line 30), authPlugin resolve user
- `packages/backend/src/index.ts` -- current route registration (userRoutes, modelRoutes, workflowReadRoutes, workflowAdminRoutes)
- `packages/frontend/src/pages/projects/ProjectSettings.tsx` -- handleInvite() calls GET /api/users (line 192)
- `packages/frontend/src/components/workflow/config/ModelCallConfig.tsx` -- fetchModels() calls GET /api/models (line 26)
- `packages/frontend/src/components/workflow/config/DesensitizeConfig.tsx` -- fetchModels() calls GET /api/models (line 26)
- `packages/frontend/src/pages/admin/WorkflowEditor.tsx` -- calls GET /api/workflows/:id (line 103)
- `.planning/v1.0-MILESTONE-AUDIT.md` -- INT-NEW-02, INT-NEW-03, Phase 5 readiness blockers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, purely internal restructuring using established patterns
- Architecture: HIGH - Phase 10 pattern directly observed and proven; exact same approach applied to 3 more route files
- Pitfalls: HIGH - all pitfalls derived from direct code analysis and Phase 10 experience (same pitfalls apply)

**Research date:** 2026-03-20
**Valid until:** Indefinite (internal architecture, not dependent on external library changes)
