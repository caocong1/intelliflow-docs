---
phase: 10-non-admin-read-api-access
plan: 01
subsystem: api
tags: [elysia, auth, rbac, document-types, workflows]

# Dependency graph
requires:
  - phase: 06-document-type-management
    provides: "documentTypeRoutes with CRUD endpoints"
  - phase: 03-workflow-engine
    provides: "workflowRoutes with CRUD endpoints"
provides:
  - "documentTypeReadRoutes (requireAuth) and documentTypeAdminRoutes (requireAdmin) split exports"
  - "workflowReadRoutes (requireAuth) and workflowAdminRoutes (requireAdmin) split exports"
  - "Role-aware server-side filtering: non-admin sees only active items"
affects: [frontend-project-home, document-creation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Route splitting pattern: read (requireAuth) + admin (requireAdmin) exports per module"]

key-files:
  created: []
  modified:
    - packages/backend/src/modules/document-types/document-types.service.ts
    - packages/backend/src/modules/document-types/document-types.routes.ts
    - packages/backend/src/modules/workflows/workflows.service.ts
    - packages/backend/src/modules/workflows/workflows.routes.ts
    - packages/backend/src/index.ts

key-decisions:
  - "Route split pattern: one read group (requireAuth) + one admin group (requireAdmin) per module, both sharing the same URL prefix"
  - "Role-aware filtering via user?.role check in route handler, not middleware"
  - "Status type cast as union literal for Drizzle PgEnum compatibility"

patterns-established:
  - "Route splitting: split monolithic admin-only route files into read (any auth) + admin exports when non-admin access is needed"
  - "Role-aware filtering: check user.role in handler and pass filter params to service layer"

requirements-completed: [DMGT-01]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 10 Plan 01: Non-Admin Read API Access Summary

**Split document-types and workflows routes into read (requireAuth) + admin (requireAdmin) groups with role-aware server-side filtering for non-admin users**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T07:54:23Z
- **Completed:** 2026-03-20T07:57:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `activeOnly` parameter to `listDocumentTypes` and `status` parameter to `listWorkflows` for server-side filtering
- Split both route files into read (requireAuth) and admin (requireAdmin) exports
- Non-admin authenticated users can now call GET /api/document-types and GET /api/workflows (previously blocked with 403)
- Admin users continue seeing all items; all mutation endpoints remain admin-only
- Frontend Eden Treaty types resolve correctly without any frontend code changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add activeOnly/status filter to service functions** - `12ae978` (feat)
2. **Task 2: Split route files into read/admin exports and update registration** - `e9527b5` (feat)

## Files Created/Modified
- `packages/backend/src/modules/document-types/document-types.service.ts` - Added optional `activeOnly` parameter to `listDocumentTypes`
- `packages/backend/src/modules/document-types/document-types.routes.ts` - Split into `documentTypeReadRoutes` (requireAuth) and `documentTypeAdminRoutes` (requireAdmin)
- `packages/backend/src/modules/workflows/workflows.service.ts` - Added optional `status` parameter to `listWorkflows`
- `packages/backend/src/modules/workflows/workflows.routes.ts` - Split into `workflowReadRoutes` (requireAuth) and `workflowAdminRoutes` (requireAdmin)
- `packages/backend/src/index.ts` - Updated imports and registration to use four route groups

## Decisions Made
- Route split pattern: one read group (requireAuth) + one admin group (requireAdmin) per module, both sharing the same URL prefix
- Role-aware filtering done via `user?.role` check in route handler (not middleware), passing filter params to service layer
- Used `as "draft" | "active" | "disabled"` type cast for `status` parameter in Drizzle `eq()` call since PgEnum column requires literal union type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript enum type mismatch for workflow status filter**
- **Found during:** Task 1 (service function filter parameters)
- **Issue:** `params.status` typed as `string` but Drizzle's `eq()` requires the PgEnum literal union `"draft" | "active" | "disabled"`
- **Fix:** Added type assertion `as "draft" | "active" | "disabled"` on `params.status` in the `eq()` call
- **Files modified:** packages/backend/src/modules/workflows/workflows.service.ts
- **Verification:** `bunx tsc --noEmit` passes cleanly
- **Committed in:** 12ae978 (Task 1 commit)

**2. [Rule 1 - Bug] Replaced non-null assertion with optional chaining for Biome compliance**
- **Found during:** Task 2 (route splitting)
- **Issue:** Biome lint forbids `user!.role` non-null assertion
- **Fix:** Changed `user!.role` to `user?.role` in both route files (semantically equivalent since requireAuth guarantees user is non-null)
- **Files modified:** packages/backend/src/modules/document-types/document-types.routes.ts, packages/backend/src/modules/workflows/workflows.routes.ts
- **Verification:** No Biome lint errors in modified files
- **Committed in:** e9527b5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation and lint compliance. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Non-admin users can now list document types and workflows via the existing API
- Frontend ProjectHome "New Document" modal will populate selectors correctly for non-admin users
- No frontend changes needed - existing client-side filters remain as defense-in-depth

---
*Phase: 10-non-admin-read-api-access*
*Completed: 2026-03-20*
