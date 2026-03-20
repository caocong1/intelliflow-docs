# Phase 10: Non-Admin Read API Access - Research

**Researched:** 2026-03-20
**Domain:** Elysia route-level middleware splitting, API access control
**Confidence:** HIGH

## Summary

This phase fixes integration gap INT-NEW-01: non-admin users get 403 when opening the "New Document" modal in ProjectHome because `GET /api/document-types` and `GET /api/workflows` are behind `requireAdmin`. The fix requires splitting two route files to apply `requireAuth` on list endpoints and `requireAdmin` on mutation endpoints.

The codebase currently uses a uniform single-guard-per-route-file pattern — every route file applies either `requireAuth` or `requireAdmin` at the top level via `.use()`. No existing file mixes both guard levels. The solution is straightforward: restructure each route file into two Elysia instances (or use Elysia's `.group()`) sharing the same prefix, each with its own guard.

**Primary recommendation:** Split `document-types.routes.ts` and `workflows.routes.ts` into read (requireAuth) and admin (requireAdmin) route groups. Add optional server-side `isActive`/`status` filtering to service functions. Keep existing frontend client-side filtering as defensive redundancy.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- document-types 和 workflows 的 GET / 列表端点从 requireAdmin 降级为 requireAuth
- 所有变更操作（POST、PUT、PATCH、DELETE）保持 requireAdmin
- GET /:id（详情）、GET /:id/associations（关联查询）、POST /:id/validate、POST /:id/copy 等端点的权限级别 — Claude 根据 Phase 目标自行判断

### Claude's Discretion
- **辅助 GET 端点权限**：GET /:id/associations（document-types）和 GET /:id（workflows）是否也降级为 requireAuth，根据非管理员实际使用场景判断
- **数据过滤策略**：非管理员调用列表接口时是否由后端自动过滤只返回启用状态的项目（vs 返回全部数据由前端过滤）。注意前端 ProjectHome.tsx 已有客户端过滤逻辑（isActive、status==='active'）
- **分页/搜索支持**：非管理员的列表接口是否保留分页和搜索参数
- **前端双重过滤**：如果后端增加了服务端过滤，前端现有的客户端过滤代码是保留（防御性编程）还是移除（简化代码）
- **空状态处理**：当没有可用的文档类型或工作流时，创建文档弹窗的行为（禁用按钮+提示 vs 弹窗内提示）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DMGT-01 | 用户可查看项目内文档列表（按创建时间/类型/状态筛选排序） | Route guard splitting enables non-admin access to doc type and workflow lists needed for document creation modal. The document list itself (GET /api/documents) is already behind requireAuth — this phase fixes the upstream dependency (doc type/workflow selectors). |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Elysia | (project version) | HTTP framework with middleware chaining | Already in use; `.use()` scoping and `.group()` are the standard patterns for per-route middleware |
| Drizzle ORM | (project version) | SQL query builder | Already in use; `eq()`, `and()` combinators for adding filter conditions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| requireAuth guard | N/A (auth.guard.ts:21) | Authenticate any logged-in user | Apply to read-only list endpoints |
| requireAdmin guard | N/A (auth.guard.ts:30) | Authenticate admin users only | Keep on all mutation endpoints |

No new libraries are needed for this phase.

## Architecture Patterns

### Current Route File Structure (BEFORE)
```
document-types.routes.ts:
  new Elysia({ prefix: "/document-types" })
    .use(requireAdmin)        ← ALL routes get admin guard
    .get("/", ...)            ← list (needs downgrade)
    .post("/", ...)           ← create (keep admin)
    .patch("/:id", ...)       ← update (keep admin)
    .patch("/:id/status", ...)← toggle (keep admin)
    .get("/:id/associations", ...) ← associations (discretion)
    .delete("/:id", ...)      ← delete (keep admin)

workflows.routes.ts:
  new Elysia({ prefix: "/workflows" })
    .use(requireAdmin)        ← ALL routes get admin guard
    .get("/", ...)            ← list (needs downgrade)
    .get("/:id", ...)         ← detail (discretion)
    .post("/", ...)           ← create (keep admin)
    .put("/:id", ...)         ← update (keep admin)
    .delete("/:id", ...)      ← delete (keep admin)
    .post("/:id/validate", ...)  ← validate (keep admin)
    .post("/:id/copy", ...)      ← copy (keep admin)
    .patch("/:id/status", ...)   ← toggle (keep admin)
    .patch("/:id/set-default", ...)← set default (keep admin)
```

### Pattern: Split Route File with Two Guard Levels

**What:** Replace single top-level `.use(requireAdmin)` with two Elysia instances sharing the same prefix, each with its own guard.

**When to use:** When a route file needs mixed auth levels (some endpoints public/auth, others admin-only).

**Example:**
```typescript
// document-types.routes.ts — AFTER
import Elysia, { t } from "elysia";
import { requireAuth, requireAdmin } from "../auth/auth.guard";

// Read routes — any authenticated user
const documentTypeReadRoutes = new Elysia({ prefix: "/document-types" })
  .use(requireAuth)
  .get("/", async ({ query }) => {
    // list with optional isActive filter
  });

// Admin routes — admin only
const documentTypeAdminRoutes = new Elysia({ prefix: "/document-types" })
  .use(requireAdmin)
  .post("/", ...)
  .patch("/:id", ...)
  .patch("/:id/status", ...)
  .get("/:id/associations", ...)
  .delete("/:id", ...);

// Export both — register in index.ts
export { documentTypeReadRoutes, documentTypeAdminRoutes };
```

**Alternative approach (simpler):** Keep a single export but use Elysia `.group()` internally:
```typescript
export const documentTypeRoutes = new Elysia({ prefix: "/document-types" })
  .use(requireAuth)
  .get("/", ...) // list — requireAuth
  .use(requireAdmin)
  .post("/", ...) // create — requireAdmin
  // ... all mutations after the requireAdmin .use()
```

**Important note on Elysia middleware scoping:** In Elysia, `.use()` with `{ as: "scoped" }` onBeforeHandle applies to all routes defined AFTER it in the same chain. The `requireAuth` and `requireAdmin` guards both use `as: "scoped"`. So placing `.use(requireAuth)` first, then defining the list route, then `.use(requireAdmin)` before the mutations, will scope correctly. However, this is fragile — the two-export approach is more explicit and less error-prone.

### Recommended Approach: Two Exports per File

The two-export pattern is recommended because:
1. **Explicit guard per group** — no ambiguity about which guard applies
2. **Elysia scoping semantics** — avoids reliance on middleware ordering within a single chain
3. **Registration in index.ts** — just add `.use(documentTypeReadRoutes)` alongside the existing admin routes
4. **Eden Treaty type safety** — both route groups share the same prefix, so the client type union covers both

### Discretion Recommendations

**GET /:id/associations (document-types):** Keep under `requireAdmin`. This endpoint is used only in the admin document-type management page (delete pre-check). Non-admin users do not need to query which workflows are associated with a document type.

**GET /:id (workflows):** Keep under `requireAdmin`. This returns the full workflow graph (nodes, edges, config). Non-admin users only need the list view (name, status) for the document creation selector, not the full graph detail. The full graph is used in the admin workflow editor.

**Data filtering strategy:** Add optional server-side `activeOnly` parameter to `listDocumentTypes` and `listWorkflows` service functions. The read routes (requireAuth) should pass `activeOnly: true` by default. This ensures non-admin users only see items they can actually use. Admin routes continue returning all items (including inactive/draft).

**Pagination/search:** Retain pagination and search parameters on the requireAuth list endpoints. The existing frontend sends `page: "1", pageSize: "100"` but the API should still support proper pagination for future use.

**Frontend double-filtering:** Keep existing client-side filters (`isActive !== false`, `status === "active"`) as defensive programming. The cost is negligible and protects against future regressions.

**Empty state handling:** When the document type or workflow selector is empty after fetching, show a disabled state with an inline message in the modal (e.g., "暂无可用的文档类型，请联系管理员"). This is simpler than disabling the "新建文档" button itself, which requires pre-fetching before the modal opens.

### Anti-Patterns to Avoid
- **Conditional logic inside route handler:** Do NOT check `user.role` inside the GET / handler to decide what to return. Use separate route definitions with different guards instead.
- **Removing client-side filtering:** Do NOT remove the frontend `isActive`/`status` filter even though the backend will now filter. Defense in depth.
- **Changing the route path:** Do NOT create new endpoints like `/document-types/active` or `/workflows/public`. Reuse the existing paths to maintain Eden Treaty client compatibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth guard middleware | Custom auth check in handlers | `requireAuth` / `requireAdmin` from auth.guard.ts | Already battle-tested; consistent across all routes |
| Active-only filtering | Complex SQL subquery | Drizzle `eq(documentTypes.isActive, true)` / `eq(workflows.status, "active")` | Simple equality condition, Drizzle handles parameterization |

## Common Pitfalls

### Pitfall 1: Elysia Middleware Ordering
**What goes wrong:** Placing `.use(requireAdmin)` after `.use(requireAuth)` in a single chain may cause the admin guard to override or stack with the auth guard, potentially rejecting non-admin users from ALL routes.
**Why it happens:** Elysia's scoped `onBeforeHandle` applies to routes defined after `.use()` in the chain, but both guards check auth independently.
**How to avoid:** Use separate Elysia instances (two exports) rather than chaining guards in a single instance.
**Warning signs:** Non-admin users getting 403 on the list endpoint even after the "fix."

### Pitfall 2: Eden Treaty Type Breakage
**What goes wrong:** Splitting one `documentTypeRoutes` export into two exports changes the type signature, breaking the `App` type exported from `index.ts`, which in turn breaks the Eden Treaty client in the frontend.
**Why it happens:** The frontend imports `App` type and generates typed client methods from it. Adding/removing `.use()` registrations in `index.ts` changes the inferred type.
**How to avoid:** Register both new route exports in `index.ts` using `.use()`. The Eden Treaty client auto-unions route types from the same prefix. Run `bun run check` (tsc) after the backend change to verify the frontend type-checks.
**Warning signs:** TypeScript errors in `api.api["document-types"].get()` or `api.api.workflows.get()` calls in the frontend.

### Pitfall 3: Service Function Signature Change
**What goes wrong:** Adding an `activeOnly` parameter to `listDocumentTypes()` without updating all callers.
**Why it happens:** The admin routes currently call `listDocumentTypes(page, pageSize, search)` with 3 args. Adding a 4th parameter could break existing admin calls if not made optional.
**How to avoid:** Make `activeOnly` an optional parameter with a default of `undefined` (return all). Only the new requireAuth route handler passes `true`.
**Warning signs:** Admin doc-type list page shows only active items after the change.

### Pitfall 4: Forgetting to Update index.ts Registration
**What goes wrong:** Creating the new read route export but not registering it in `src/index.ts`, so the endpoint remains unreachable.
**Why it happens:** The new export needs to be imported and `.use()`-d in the main app setup.
**How to avoid:** After creating the new route exports, update `index.ts` to import and register both.
**Warning signs:** 404 on `GET /api/document-types` for non-admin users.

## Code Examples

### Service Layer: Add activeOnly Filter to listDocumentTypes

```typescript
// document-types.service.ts
export async function listDocumentTypes(
  page: number,
  pageSize: number,
  search?: string,
  activeOnly?: boolean, // NEW optional parameter
): Promise<{ data: DocumentTypeRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    conditions.push(
      or(ilike(documentTypes.name, `%${search}%`), ilike(documentTypes.code, `%${search}%`))
    );
  }
  if (activeOnly) {
    conditions.push(eq(documentTypes.isActive, true));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalResult] = await Promise.all([
    db.select(documentTypeColumns).from(documentTypes)
      .where(whereClause)
      .orderBy(desc(documentTypes.createdAt))
      .limit(pageSize).offset(offset),
    db.select({ count: count() }).from(documentTypes).where(whereClause),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}
```

### Service Layer: Add statusFilter to listWorkflows

```typescript
// workflows.service.ts — modify listWorkflows params
export async function listWorkflows(params: {
  documentTypeId?: string;
  search?: string;
  status?: string;    // NEW: filter by workflow status
  page?: number;
  pageSize?: number;
}): Promise<{ data: WorkflowListItem[]; total: number }> {
  // ... existing code ...
  const conditions = [];
  if (params.documentTypeId) {
    conditions.push(eq(workflows.documentTypeId, params.documentTypeId));
  }
  if (params.search) {
    conditions.push(ilike(workflows.name, `%${params.search}%`));
  }
  if (params.status) {
    conditions.push(eq(workflows.status, params.status));
  }
  // ... rest unchanged ...
}
```

### Route File: Split Pattern for document-types

```typescript
// document-types.routes.ts — AFTER
import Elysia, { t } from "elysia";
import { requireAuth, requireAdmin } from "../auth/auth.guard";
import { /* ... */ } from "./document-types.service";

// Read routes — any authenticated user
export const documentTypeReadRoutes = new Elysia({ prefix: "/document-types" })
  .use(requireAuth)
  .get(
    "/",
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 20;
      const search = query.search || undefined;
      const { data, total } = await listDocumentTypes(page, pageSize, search, true);
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

// Admin routes — unchanged, just without GET /
export const documentTypeAdminRoutes = new Elysia({ prefix: "/document-types" })
  .use(requireAdmin)
  .get(/* admin list route — see note below */)
  .post("/", ...)
  .patch("/:id", ...)
  // ... etc
```

**Important design note:** The admin management page also needs GET / to see ALL document types (including inactive). Two approaches:

1. **Single GET / endpoint under requireAuth** with role-aware filtering: if the calling user is admin, return all; if non-admin, return active only. This uses the `user` object from `authPlugin`.
2. **Two separate GET / endpoints** under different guards (problematic — same HTTP method + path conflicts).

**Recommended:** Use approach 1 — a single GET / under `requireAuth` with the handler checking user role to decide whether to apply the active filter. This avoids route conflicts.

```typescript
// Single GET / under requireAuth — role-aware
.get(
  "/",
  async ({ query, user }) => {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const search = query.search || undefined;
    const activeOnly = user!.role !== "admin"; // non-admin sees only active
    const { data, total } = await listDocumentTypes(page, pageSize, search, activeOnly);
    return { data, total, page, pageSize };
  },
  // ...
)
```

### index.ts Registration Update

```typescript
// src/index.ts — updated imports and registration
import { documentTypeReadRoutes, documentTypeAdminRoutes } from "./modules/document-types/document-types.routes";
import { workflowReadRoutes, workflowAdminRoutes } from "./modules/workflows/workflows.routes";

const app = new Elysia({ prefix: "/api" })
  // ... existing routes ...
  .use(documentTypeReadRoutes)
  .use(documentTypeAdminRoutes)
  .use(workflowReadRoutes)
  .use(workflowAdminRoutes)
  // ... rest unchanged ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single guard per route file | Split guards (this phase) | Phase 10 | First mixed-guard route file in the project |
| Client-only active filtering | Server-side + client-side dual filtering | Phase 10 | Reduced data transfer for non-admin users |

## Open Questions

1. **Route conflict with duplicate GET / under different guards**
   - What we know: Two Elysia instances with the same prefix and same method+path may conflict. Elysia resolves routes by first-registered match.
   - What's unclear: Whether Elysia correctly differentiates two `GET /document-types/` handlers registered via separate `.use()` calls with different guards.
   - Recommendation: Avoid the conflict entirely — use a single GET / under requireAuth with role-aware filtering inside the handler (see code example above). This is the safest approach.

2. **Admin list page behavior after the change**
   - What we know: The admin document-types management page currently calls the same `GET /api/document-types` endpoint. After the change, if we always filter `activeOnly` for non-admins, the admin page will continue to work because admin users bypass the filter.
   - What's unclear: No concerns — role-aware filtering handles this cleanly.
   - Recommendation: Verify the admin pages still show inactive/disabled items after the change.

## Sources

### Primary (HIGH confidence)
- `packages/backend/src/modules/auth/auth.guard.ts` — auth guard implementations (requireAuth line 21, requireAdmin line 30)
- `packages/backend/src/modules/document-types/document-types.routes.ts` — current admin-only route structure (requireAdmin at line 13)
- `packages/backend/src/modules/workflows/workflows.routes.ts` — current admin-only route structure (requireAdmin at line 34)
- `packages/backend/src/modules/document-types/document-types.service.ts` — listDocumentTypes with no active filter
- `packages/backend/src/modules/workflows/workflows.service.ts` — listWorkflows with no status filter
- `packages/frontend/src/pages/projects/ProjectHome.tsx` — fetchDocTypes (line 132), fetchWorkflows (line 145), client-side filtering
- `packages/backend/src/db/schema.ts` — documentTypes.isActive (boolean), workflows.status (enum: draft/active/disabled)
- `packages/backend/src/index.ts` — current route registration
- `.planning/v1.0-MILESTONE-AUDIT.md` — INT-NEW-01 gap definition

### Secondary (MEDIUM confidence)
- Elysia middleware scoping behavior — based on project patterns (all `.use()` calls use `as: "scoped"`) and Elysia's documented behavior for onBeforeHandle scoping

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, fully internal refactoring
- Architecture: HIGH - pattern directly observed from 10 existing route files; split-guard approach is straightforward
- Pitfalls: HIGH - all pitfalls derived from direct code analysis (Elysia scoping, Eden Treaty types, service signatures)

**Research date:** 2026-03-20
**Valid until:** Indefinite (internal architecture, not dependent on external library changes)
