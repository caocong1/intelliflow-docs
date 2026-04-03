---
phase: 27-permission-security
plan: "02"
subsystem: backend / authorization
tags: [permissions, auth, write-authorization, phase-27]
dependency_graph:
  requires:
    - phase: "27-01"
      provides: "canEditDocument(documentId, userId) helper exported from versions.service.ts"
  provides:
    - id: "runtime-write-guards"
      type: "route guards"
      path: "packages/backend/src/modules/runtime/runtime.routes.ts"
    - id: "creator-or-owner-policy"
      type: "authorization policy"
      routes: "init, advance, rollback, draft, skip, start-background"
  affects:
    - "Phase 28+ — file security, other runtime sub-route guards"
tech_stack:
  added: []
  patterns:
    - "Creator-or-owner authorization on runtime mutation endpoints"
    - "Read-only runtime state gate remains project-membership-based"
key_files:
  created: []
  modified:
    - path: "packages/backend/src/modules/runtime/runtime.routes.ts"
      change: "Import canEditDocument; replace isDocumentProjectMember guards with canEditDocument on all six write handlers"
key_decisions:
  - "six write handlers (init, advance, rollback, draft, skip, start-background) now gate on canEditDocument"
  - "GET /runtime/:documentId stays on isDocumentProjectMember — preserves read-only access for project members"
  - "start-background deduplication and per-user concurrency limit remain below the new permission gate"
patterns_established:
  - "Creator-or-owner route guard: await canEditDocument(params.documentId, user!.id) before any service call"
  - "Membership-only route guard: await isDocumentProjectMember(params.documentId, user!.id) for read-only routes"
requirements_completed: [PERM-02, PERM-05]
metrics:
  duration: "1 minute"
  completed: "2026-04-03T08:12:21Z"
  tasks_completed: 2
  files_modified: 1
---

# Phase 27 Plan 02: Add Write-Permission Guards to Core Runtime Routes

**All six core runtime mutation handlers now gate on creator-or-owner; read-only runtime state stays accessible to project members.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-03T08:10:36Z
- **Completed:** 2026-04-03T08:12:21Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Six runtime write handlers upgraded from `isDocumentProjectMember` to `canEditDocument`
- 403 error messages updated to `仅文档创建者或项目负责人可...` on all six handlers
- GET `/runtime/:documentId` preserved on `isDocumentProjectMember` so project members retain read-only runtime inspection
- Background-task deduplication and per-user concurrency limit remain below the new permission gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace membership guards on all core runtime write handlers** - `77235e9` (feat)
2. **Task 2: Keep runtime reads on membership-only access** - `46772c8` (docs)

**Plan metadata:** (pending final commit)

## Files Created/Modified

- `packages/backend/src/modules/runtime/runtime.routes.ts` — Import added `canEditDocument` from `../versions/versions.service`; all six write handlers (`/init`, `/advance/:nodeExecutionId`, `/rollback`, `/nodes/:nodeExecutionId/draft`, `/skip/:nodeExecutionId`, `/start-background`) now call `await canEditDocument(params.documentId, user!.id)` before any service call; `GET /:documentId` unchanged on `isDocumentProjectMember`

## Decisions Made

- Creator-or-owner route guard pattern: `await canEditDocument(params.documentId, user!.id)` before any runtime mutation service call
- Read-only routes stay on `isDocumentProjectMember` to preserve project member read access
- Background-task dedupe and concurrency limit logic intentionally placed below the permission gate so authorized users still get those protections

## Deviations from Plan

None — plan executed exactly as written.

## Auth Gates

None.

## Deferred Issues (Out of Scope)

TypeScript reports 8 `TS2578: Unused '@ts-expect-error'` directives in `statistics.service.ts` and 2 type errors in migration scripts. These are pre-existing issues in unrelated files, unchanged by this plan.

---

## Self-Check: PASSED

- `canEditDocument` imported and used in all 6 write handlers: YES (`rg` confirms lines 67, 116, 141, 167, 193, 218)
- 403 messages mention `仅文档创建者或项目负责人`: YES (lines 70, 119, 144, 170, 196, 221)
- `GET /:documentId` unchanged on `isDocumentProjectMember`: YES (line 92)
- Dedupe + concurrency checks remain below gate in `start-background`: YES (lines 224-255)
- `bunx tsc --noEmit` zero errors in `runtime.routes.ts`: YES

---

*Phase: 27-permission-security*
*Plan: 02*
*Completed: 2026-04-03*
