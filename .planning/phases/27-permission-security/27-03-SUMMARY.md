---
phase: 27-permission-security
plan: "03"
subsystem: backend / authorization
tags: [permissions, auth, write-authorization, phase-27, runtime-routes]
dependency_graph:
  requires:
    - phase: "27-01"
      provides: "canEditDocument() helper function"
  provides:
    - id: "runtime-subroute-guards"
      type: "route guards"
      paths:
        - "packages/backend/src/modules/runtime/desensitize.routes.ts"
        - "packages/backend/src/modules/runtime/restore.routes.ts"
        - "packages/backend/src/modules/runtime/inline-edit.routes.ts"
        - "packages/backend/src/modules/runtime/input-transform.routes.ts"
        - "packages/backend/src/modules/runtime/model-call.routes.ts"
  affects:
    - "Phase 27 Plans 04+ (remaining guards if any)"
    - "runtime.routes.ts (already completed in 27-01)"
tech_stack:
  added: []
  patterns:
    - "Creator-or-owner guard (canEditDocument) on mutation/action routes"
    - "Membership guard (isDocumentProjectMember) preserved on read-only routes"
    - "Permission classified by actual side effect, not HTTP verb"
key_files:
  created: []
  modified:
    - path: "packages/backend/src/modules/runtime/desensitize.routes.ts"
      change: "detect + confirm: canEditDocument; rules (read-only): isDocumentProjectMember"
    - path: "packages/backend/src/modules/runtime/restore.routes.ts"
      change: "execute + text: canEditDocument"
    - path: "packages/backend/src/modules/runtime/inline-edit.routes.ts"
      change: "stream: canEditDocument"
    - path: "packages/backend/src/modules/runtime/input-transform.routes.ts"
      change: "upload + confirm: canEditDocument"
    - path: "packages/backend/src/modules/runtime/model-call.routes.ts"
      change: "execute/retry/select/revalidate/ai-fix: canEditDocument; status (read-only): isDocumentProjectMember"
key_decisions:
  - |
    HTTP verb is not a reliable signal for permission level: GET /execute and GET /retry
    both mutate nodeExecutions.outputData, so they require canEditDocument despite
    using GET. Only GET /status is truly read-only and stays on isDocumentProjectMember.
  - |
    Desensitize rules endpoint (GET /rules) remains on isDocumentProjectMember because
    it only reads and formats existing desensitization rules from the DB.
patterns-established:
  - "Mutation/action routes: canEditDocument guard before any service call"
  - "Read-only routes: isDocumentProjectMember guard (access for all project members)"
  - "Guard swap: only the permission check and 403 message change, handler bodies untouched"
requirements-completed:
  - "PERM-03"
  - "PERM-05"
metrics:
  duration: "2 min"
  completed: "2026-04-03T08:12:36Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 27 Plan 03: Runtime Subroute Authorization Guards

**Creator-or-owner guards applied to all document-mutating runtime subroutes; read-only subroutes remain accessible to project members**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T08:10:43Z
- **Completed:** 2026-04-03T08:12:36Z
- **Tasks:** 2 / 2
- **Files modified:** 5

## Accomplishments
- Applied `canEditDocument` guard to all mutation/action routes across 5 route modules
- Preserved `isDocumentProjectMember` on genuinely read-only endpoints (desensitize rules, model-call status)
- Reclassified model-call routes by actual side effect rather than HTTP verb (execute/retry use GET but mutate outputData)
- All 403 error messages updated to "仅文档创建者或项目负责人可执行此操作" on mutation routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Move desensitize/restore/inline-edit/input-transform mutations to canEditDocument** - `c88ad01` (feat)
2. **Task 2: Reclassify model-call routes by actual side effects** - `c3141f8` (feat)

## Files Modified

- `packages/backend/src/modules/runtime/desensitize.routes.ts` - detect + confirm: canEditDocument; rules (read-only): isDocumentProjectMember
- `packages/backend/src/modules/runtime/restore.routes.ts` - execute + text-update: canEditDocument
- `packages/backend/src/modules/runtime/inline-edit.routes.ts` - stream: canEditDocument
- `packages/backend/src/modules/runtime/input-transform.routes.ts` - upload + confirm: canEditDocument
- `packages/backend/src/modules/runtime/model-call.routes.ts` - execute/retry/select/revalidate/ai-fix: canEditDocument; status: isDocumentProjectMember

## Decisions Made

- **HTTP verb is not a reliable permission signal:** GET /execute and GET /retry both write nodeExecutions.outputData, so they require canEditDocument despite using GET. Only GET /status is truly read-only and stays on isDocumentProjectMember.
- **Desensitize rules stays membership-only:** GET /rules only reads and formats existing desensitization rules, so it remains accessible to all project members.
- **Guard swap pattern:** Only the permission check and 403 message change; all handler bodies, SSE streaming code, validation logic, and service calls remain untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None.

## Deferred Issues (Out of Scope)

TypeScript reports 8 `TS2578: Unused '@ts-expect-error'` directives in `packages/backend/src/modules/statistics/statistics.service.ts` and 2 type errors in migration scripts. These are pre-existing issues in unrelated files and do not affect Phase 27 runtime route changes.

## Next Phase Readiness

- All runtime subroutes are now guarded. Plan 27-04 can proceed to any remaining unguarded routes or close out Phase 27.
- No blockers or concerns.

---

## Self-Check: PASSED

- Commit `c88ad01` exists: YES
- Commit `c3141f8` exists: YES
- desensitize.routes.ts: detect + confirm use canEditDocument; rules uses isDocumentProjectMember: YES
- restore.routes.ts: both handlers use canEditDocument: YES
- inline-edit.routes.ts: stream uses canEditDocument: YES
- input-transform.routes.ts: both handlers use canEditDocument: YES
- model-call.routes.ts: execute/retry/select/revalidate/ai-fix use canEditDocument; status uses isDocumentProjectMember: YES
- TypeScript errors only in pre-existing unrelated files: YES

---

*Phase: 27-permission-security*
*Plan: 03*
*Completed: 2026-04-03*
