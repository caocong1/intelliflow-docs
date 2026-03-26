# Phase 20: Search + Favorites + Recent Access - Research

**Researched:** 2026-03-26
**Domain:** Full-stack search, favorites, and recent access features (SolidJS + Elysia + Drizzle + PostgreSQL)
**Confidence:** HIGH

## Summary

Phase 20 adds three user-facing features: global search across projects/documents/workflows, a favorites system for bookmarking resources, and automatic recent access tracking. The database schema for favorites (`userFavorites`) and recent access (`userRecentAccess`) already exists with proper enum types and unique constraints. The backend needs new API endpoints, and the frontend needs three new pages (`/search`, `/favorites`, `/recent`), sidebar menu items, and dashboard summary cards.

The existing codebase uses `ilike` for text search across all modules (projects, documents, workflows, users). This is a proven pattern in the project; no pg_trgm or full-text search is needed (explicitly out of scope per REQUIREMENTS.md). The visibility filtering logic in `documents.service.ts` (lines 87-104) handles `self`/`project`/`specific` visibility and must be replicated in the global search endpoint to enforce SRCH-03.

**Primary recommendation:** Create a single `search` backend module with a unified `/search` endpoint that queries projects, documents, and workflows in parallel, applying existing visibility and membership checks. For favorites and recent access, create a `user-activity` module handling both concerns since they share the same polymorphic target pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Sidebar adds three independent menu items: search, favorites, recent access
- Three independent pages: /search, /favorites, /recent
- Search scope: documents (title/description), projects (name/description), workflows (name)
- Search results grouped by type (project/document/workflow), 3 per group by default, expandable
- No type filter controls -- keep it simple
- Input-as-you-type + 300ms debounce, reuse existing SearchInput component
- Search results respect document visibility permissions
- Favorites: star icon on project cards, document list items, workflow list items
- Favorites page /favorites grouped by type, sorted by favorite time descending
- No sort/filter on favorites -- keep simple
- Recent access: auto-record on detail page entry (project home, document workspace, workflow editor)
- List page browsing does NOT count as access
- Max 20 recent access records, auto-evict oldest
- Recent access page /recent: pure chronological list (not grouped by type)
- Dashboard embeds "recent access" and "favorites" summary cards (3-5 items each) with "view all" links

### Claude's Discretion
- Sidebar positioning of the three new menu items (above/below workspace section, dividers)
- Search result item display details (time format, status badges, etc.)
- Dashboard summary card layout and styling
- Empty state design (no results, no favorites, no recent access)
- Search result keyword highlight approach

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | Global search for documents (title, description) | Use `ilike` on documents table with cross-project visibility filtering; existing pattern in documents.service.ts |
| SRCH-02 | Global search for projects (name, description) and workflows (name) | Use `ilike` on projects/workflows tables; existing pattern in projects.service.ts and workflows.service.ts |
| SRCH-03 | Search results respect document visibility permissions | Replicate visibility logic from documents.service.ts lines 87-104: project membership + visibility enum + specific members |
| SRCH-04 | Favorites toggle and "My Favorites" view | DB schema `userFavorites` exists with unique constraint; toggle = INSERT on conflict DELETE pattern |
| SRCH-05 | Recent access tracking and "Recent Access" view | DB schema `userRecentAccess` exists with unique constraint; UPSERT pattern with accessedAt update; cap at 20 records |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SolidJS | (project version) | Frontend framework | Project standard |
| @solidjs/router | (project version) | Routing | Project standard, `Route` + `A` components |
| Elysia | (project version) | Backend HTTP framework | Project standard, prefix-based routing |
| Drizzle ORM | (project version) | Database queries | Project standard, `ilike`, `eq`, `and`, `or`, `inArray` |
| PostgreSQL | (project version) | Database | Project standard |
| Tailwind CSS | (project version) | Styling | Project standard, indigo-950 theme |
| @elysiajs/eden (treaty) | (project version) | Type-safe API client | Project standard for typed endpoints |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SearchInput component | N/A | Debounced search input | Reuse directly on /search page |
| Badge component | N/A | Type labels (project/document/workflow) | In search results and lists |
| Pagination component | N/A | Result pagination | If search results need paging |

### No New Dependencies Needed
This phase uses only existing project dependencies. No new npm packages required.

## Architecture Patterns

### Recommended Project Structure

**Backend:**
```
packages/backend/src/modules/
├── search/
│   ├── search.routes.ts        # GET /search?q=...
│   └── search.service.ts       # Cross-entity search with visibility
├── user-activity/
│   ├── user-activity.routes.ts # Favorites + Recent Access endpoints
│   └── user-activity.service.ts
```

**Frontend:**
```
packages/frontend/src/
├── pages/
│   ├── Search.tsx              # /search page
│   ├── Favorites.tsx           # /favorites page
│   └── RecentAccess.tsx        # /recent page
├── components/
│   ├── favorites/
│   │   └── FavoriteButton.tsx  # Star toggle component
│   └── dashboard/
│       ├── RecentAccessCard.tsx # Dashboard summary card
│       └── FavoritesCard.tsx   # Dashboard summary card
```

### Pattern 1: Unified Search Endpoint
**What:** Single `GET /api/search?q=keyword` endpoint that returns `{ projects: [], documents: [], workflows: [] }` with counts.
**When to use:** Global search across entity types.
**Why:** Avoids 3 separate API calls, enables server-side permission filtering in one pass, simplifies frontend data fetching.

```typescript
// Backend: search.service.ts
export async function globalSearch(userId: string, query: string, limit = 3) {
  const term = `%${query}%`;

  // 1. Projects: user must be a member
  const projectResults = await db
    .select({ id: projects.id, name: projects.name, description: projects.description })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(and(
      eq(projectMembers.userId, userId),
      eq(projects.isDeleted, false),
      or(ilike(projects.name, term), ilike(projects.description, term)),
    ))
    .limit(limit);

  // 2. Documents: visibility-aware (reuse existing pattern)
  // 3. Workflows: all active workflows are visible to authenticated users
  return { projects: projectResults, documents: docResults, workflows: wfResults };
}
```

### Pattern 2: Favorites Toggle (Upsert/Delete)
**What:** POST to add favorite, DELETE to remove. Use unique constraint for idempotency.
**When to use:** Star icon click.

```typescript
// Toggle favorite: try insert, if conflict exists then delete
export async function toggleFavorite(
  userId: string, targetType: "project" | "document" | "workflow", targetId: string
): Promise<boolean> {
  const existing = await db.select({ id: userFavorites.id })
    .from(userFavorites)
    .where(and(
      eq(userFavorites.userId, userId),
      eq(userFavorites.targetType, targetType),
      eq(userFavorites.targetId, targetId),
    )).limit(1);

  if (existing.length > 0) {
    await db.delete(userFavorites).where(eq(userFavorites.id, existing[0].id));
    return false; // unfavorited
  }
  await db.insert(userFavorites).values({ userId, targetType, targetId });
  return true; // favorited
}
```

### Pattern 3: Recent Access with Cap (Upsert + Evict)
**What:** On detail page visit, upsert recent access record and evict oldest if > 20.
**When to use:** User navigates to project home, document workspace, or workflow editor.

```typescript
export async function recordAccess(
  userId: string, targetType: "project" | "document" | "workflow", targetId: string
) {
  // Upsert: update accessedAt if exists, insert if not
  await db.insert(userRecentAccess)
    .values({ userId, targetType, targetId, accessedAt: new Date() })
    .onConflictDoUpdate({
      target: [userRecentAccess.userId, userRecentAccess.targetType, userRecentAccess.targetId],
      // Note: unique constraint is on (userId, targetType, targetId) — need to use the constraint name
      set: { accessedAt: new Date() },
    });

  // Evict: keep only latest 20
  const oldest = await db.select({ id: userRecentAccess.id })
    .from(userRecentAccess)
    .where(eq(userRecentAccess.userId, userId))
    .orderBy(desc(userRecentAccess.accessedAt))
    .offset(20);

  if (oldest.length > 0) {
    await db.delete(userRecentAccess)
      .where(inArray(userRecentAccess.id, oldest.map(r => r.id)));
  }
}
```

### Pattern 4: Frontend API Calls (Raw Fetch)
**What:** Use raw `fetch` with Bearer token pattern, same as notifications and statistics modules.
**Why:** Eden treaty works for typed routes, but newer modules (notifications, statistics) use raw fetch for flexibility. Follow the same pattern.

```typescript
// packages/frontend/src/lib/api/search.ts
async function authFetch(path: string): Promise<Response> {
  const token = localStorage.getItem("auth_token");
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function globalSearch(query: string) {
  const res = await authFetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}
```

### Pattern 5: SolidJS Page with createResource
**What:** Use `createResource` with reactive signal for data fetching, consistent with existing pages.

```typescript
const [query, setQuery] = createSignal("");
const [results] = createResource(query, async (q) => {
  if (!q.trim()) return null;
  return globalSearch(q);
});
```

### Anti-Patterns to Avoid
- **Separate API calls per entity type:** Do NOT make 3 parallel frontend requests for search. Use single unified endpoint.
- **Client-side permission filtering:** Do NOT fetch all documents and filter on frontend. Server MUST enforce visibility.
- **Recording access on list pages:** CONTEXT.md explicitly says list browsing does NOT count. Only detail page entry.
- **Using Eden treaty for new complex endpoints:** The project pattern for newer modules uses raw fetch. Eden treaty has typing issues with dynamic routes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounced search input | Custom debounce logic | Existing `SearchInput` component | Already has 300ms debounce, clear button, consistent styling |
| Text search | Full-text search, pg_trgm | PostgreSQL `ILIKE` | Project standard, explicitly no Elasticsearch per REQUIREMENTS.md |
| Unique constraint handling | Manual check-then-insert | DB unique constraints + `onConflictDoUpdate` | Race-condition safe, already in schema |
| Auth header injection | Manual token handling per request | Reuse auth fetch helper pattern from `api/client.ts` | Consistent with existing code |

**Key insight:** The DB schema and search patterns are already established. This phase is mostly about wiring up existing patterns into new endpoints and pages.

## Common Pitfalls

### Pitfall 1: Document Visibility in Cross-Project Search
**What goes wrong:** Search returns documents the user cannot access.
**Why it happens:** The existing `listDocuments` function filters within a single project. Global search must check across ALL projects the user is a member of, AND apply per-document visibility rules.
**How to avoid:** First get all project IDs where user is a member, then query documents within those projects with the same visibility logic (project/self/specific).
**Warning signs:** User sees documents from projects they don't belong to, or sees `visibility=self` documents created by others.

### Pitfall 2: Drizzle onConflictDoUpdate with Composite Unique Constraint
**What goes wrong:** Drizzle's `onConflictDoUpdate` may need the constraint name rather than column targets for composite unique constraints.
**Why it happens:** The `userRecentAccess` table has a named constraint `uq_user_recent_access_user_target` on 3 columns. Drizzle's API for `onConflictDoUpdate` may require specifying `targetWhere` or `target` correctly.
**How to avoid:** Use the named constraint: `.onConflictDoUpdate({ target: [userRecentAccess.userId, userRecentAccess.targetType, userRecentAccess.targetId], set: { accessedAt: new Date() } })` or use raw SQL for the upsert if Drizzle's API is tricky.
**Warning signs:** Duplicate rows in recent access, or constraint violation errors.

### Pitfall 3: Polymorphic Target Resolution
**What goes wrong:** Favorites/recent access records reference a `targetId` (UUID) with no FK constraint. If the target entity is deleted, the record becomes orphaned.
**Why it happens:** Design decision from Phase 17: polymorphic `target_id` without FK, enforced at app layer.
**How to avoid:** When fetching favorites/recent access lists, LEFT JOIN to the target tables and filter out nulls (deleted targets). Display gracefully or auto-clean.
**Warning signs:** Favorites list shows blank entries or crashes on null target data.

### Pitfall 4: Recent Access Cap Race Condition
**What goes wrong:** Under concurrent requests, more than 20 records could temporarily exist.
**Why it happens:** The "evict oldest" step happens after the insert, creating a window.
**How to avoid:** This is acceptable for an internal tool. The cap is a soft limit. The eviction query will clean up on next access. No need for transactions or locks.
**Warning signs:** Momentarily seeing 21-22 records (acceptable, self-healing).

### Pitfall 5: Sidebar Navigation State
**What goes wrong:** Multiple sidebar items appear active simultaneously.
**Why it happens:** The existing `isActive` function uses `startsWith` matching. `/recent` could conflict with other paths if not careful.
**How to avoid:** The three new paths (`/search`, `/favorites`, `/recent`) are unique prefixes that won't conflict with existing routes (`/projects`, `/admin/*`). No issue expected, but verify.
**Warning signs:** Two sidebar items highlighted at once.

## Code Examples

### Backend Route Registration Pattern
```typescript
// search.routes.ts — follows existing Elysia pattern
import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { globalSearch } from "./search.service";

export const searchRoutes = new Elysia({ prefix: "/search" })
  .use(requireAuth)
  .get("/", async ({ query, user }) => {
    if (!query.q?.trim()) return { projects: [], documents: [], workflows: [] };
    return globalSearch(user!.id, query.q.trim(), Number(query.limit) || 3);
  }, {
    query: t.Object({
      q: t.String(),
      limit: t.Optional(t.String()),
    }),
  });
```

### Sidebar Menu Item Pattern
```typescript
// Follows exact pattern from existing Sidebar.tsx
<A href="/search" class={linkClass("/search")}>
  <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <title>搜索</title>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
  搜索
</A>
```

### Dashboard Summary Card Pattern
```typescript
// Follows existing Dashboard.tsx card styling
<div class="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
  <div class="flex items-center justify-between mb-3">
    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">最近访问</p>
    <A href="/recent" class="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer">
      查看全部
    </A>
  </div>
  {/* List items */}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Eden treaty for all API calls | Raw fetch for newer modules | Phase 18+ | New endpoints should use raw fetch pattern |
| Per-project document search | Need cross-project global search | Phase 20 (new) | Must combine project membership + document visibility |

**Deprecated/outdated:**
- Nothing deprecated. All existing patterns remain valid.

## Open Questions

1. **Workflow visibility model**
   - What we know: Workflows are managed by admins. All authenticated users can see workflows in the workflow list.
   - What's unclear: Should search results show ALL active workflows or only workflows the user has used?
   - Recommendation: Show all active workflows (consistent with existing admin-managed model). Workflows are shared resources.

2. **Favorite button on workflow items**
   - What we know: CONTEXT.md says "workflow list items" should have star icons. Workflows are in admin section.
   - What's unclear: Regular users don't see the admin workflow list. Where do regular users favorite workflows?
   - Recommendation: Show favorite toggle on workflow items wherever they appear (search results, document creation flow). The favorites page shows all favorited workflows regardless.

## Sources

### Primary (HIGH confidence)
- Project codebase: `packages/backend/src/db/schema.ts` lines 308-351 - userFavorites and userRecentAccess table definitions
- Project codebase: `packages/backend/src/modules/documents/documents.service.ts` lines 87-104 - document visibility filtering pattern
- Project codebase: `packages/frontend/src/components/ui/SearchInput.tsx` - reusable debounced search input
- Project codebase: `packages/frontend/src/api/client.ts` - API client pattern (Eden treaty + raw fetch)
- Project codebase: `packages/frontend/src/App.tsx` - routing pattern with `@solidjs/router`
- Project codebase: `packages/frontend/src/components/nav/Sidebar.tsx` - sidebar navigation pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions - user-confirmed interaction patterns and scope

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - follows established module patterns from Phase 17-19
- Pitfalls: HIGH - visibility filtering logic verified directly from source code
- API patterns: HIGH - both Eden treaty and raw fetch patterns observed in codebase

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable internal project, no external dependency changes)
