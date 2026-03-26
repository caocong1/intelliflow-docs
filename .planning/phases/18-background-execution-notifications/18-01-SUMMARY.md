---
phase: 18-background-execution-notifications
plan: 01
subsystem: runtime
tags: [background-tasks, pipeline, orchestrator, notifications, drizzle, postgresql]

# Dependency graph
requires:
  - phase: 17-schema-migration-tech-debt
    provides: backgroundTasks table, nodeExecutions table, document status enum
provides:
  - Background pipeline orchestrator (executeDocumentPipeline)
  - Orphan task detection on server startup (detectOrphanTasks)
  - Non-streaming model call variant (executeModelCallBackground)
  - POST /runtime/:documentId/start-background endpoint
  - notifications table in schema
  - 'failed' value in documentStatusEnum
affects: [18-02, 18-03, 18-04, notification-api, workspace-retry]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget background pipeline, orphan detection on startup, auto-select first model output]

key-files:
  created:
    - packages/backend/src/modules/runtime/background.service.ts
    - packages/backend/drizzle/0002_superb_doctor_doom.sql
  modified:
    - packages/backend/src/db/schema.ts
    - packages/backend/src/modules/runtime/model-call.service.ts
    - packages/backend/src/modules/runtime/runtime.routes.ts
    - packages/backend/src/index.ts
    - packages/backend/src/modules/documents/documents.service.ts

key-decisions:
  - "Auto-confirm all desensitize detections in background mode (no user review)"
  - "Auto-select first completed model output in background mode (user can change later)"
  - "Fire-and-forget pipeline with error capture — route returns immediately with { status: 'queued' }"

patterns-established:
  - "Background pipeline: fire-and-forget from route, async error handling with status tracking"
  - "Orphan detection: query running tasks on startup, mark as failed with Chinese error message"

requirements-completed: [BGND-01, BGND-06]

# Metrics
duration: 6min
completed: 2026-03-26
---

# Phase 18 Plan 01: Backend Background Execution Foundation Summary

**Background pipeline orchestrator with autonomous node execution, non-streaming model calls, orphan detection, notifications table, and 'failed' document status**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-26T06:31:45Z
- **Completed:** 2026-03-26T06:37:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Background pipeline orchestrator runs all 5 node types (input_transform skip, desensitize, model_call, restore, file_export) autonomously
- backgroundTasks table tracks full lifecycle (queued -> running -> completed/failed) with progress percentage
- Server startup detects orphaned running tasks and marks them failed with corresponding node executions
- notifications table ready for Plan 02 to populate with generation_completed/generation_failed events
- Non-streaming model call variant collects full responses and auto-selects first completed model

## Task Commits

Each task was committed atomically:

1. **Task 1: Add notifications table and extend documentStatusEnum with 'failed'** - `99bb67a` (feat)
2. **Task 2: Create background pipeline orchestrator, orphan detection, model-call background variant, start-background endpoint, and startup hook** - `f272d88` (feat)

## Files Created/Modified
- `packages/backend/src/modules/runtime/background.service.ts` - Pipeline orchestrator (executeDocumentPipeline) and orphan detection (detectOrphanTasks)
- `packages/backend/src/db/schema.ts` - Added notificationTypeEnum, notifications table, 'failed' to documentStatusEnum
- `packages/backend/drizzle/0002_superb_doctor_doom.sql` - Migration SQL for notifications table and enum extension
- `packages/backend/src/modules/runtime/model-call.service.ts` - Added executeModelCallBackground for non-streaming model execution
- `packages/backend/src/modules/runtime/runtime.routes.ts` - Added POST /:documentId/start-background endpoint
- `packages/backend/src/index.ts` - Wired detectOrphanTasks into server startup
- `packages/backend/src/modules/documents/documents.service.ts` - Updated DocumentRow type to include 'failed' status

## Decisions Made
- Auto-confirm all desensitize detections in background mode — no interactive user review, all detected items are applied
- Auto-select first completed model output as selectedOutputKey in background mode — users can change selection later in workspace
- Fire-and-forget pipeline pattern — route returns { status: "queued" } immediately, pipeline runs asynchronously with full error capture

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DocumentRow status type to include 'failed'**
- **Found during:** Task 2 (TypeScript type check)
- **Issue:** Adding 'failed' to documentStatusEnum caused type mismatch in documents.service.ts where DocumentRow had hardcoded status union type
- **Fix:** Added '"failed"' to the status union type in DocumentRow
- **Files modified:** packages/backend/src/modules/documents/documents.service.ts
- **Verification:** bunx tsc --noEmit passes cleanly
- **Committed in:** f272d88 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for type safety after enum extension. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Background pipeline ready for Plan 02 to add notification creation on completion/failure
- Plan 03 can build notification polling/SSE API on top of notifications table
- Plan 04 can add frontend background trigger and status display

---
*Phase: 18-background-execution-notifications*
*Completed: 2026-03-26*
