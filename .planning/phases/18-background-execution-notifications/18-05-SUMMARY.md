---
phase: 18-background-execution-notifications
plan: 05
subsystem: api
tags: [rate-limiting, background-tasks, drizzle, elysia]

requires:
  - phase: 18-01
    provides: backgroundTasks table and status enum for count query
provides:
  - Per-user concurrent background task limit (max 3) on start-background endpoint
affects: [18-06, 19-statistics]

tech-stack:
  added: []
  patterns: [pre-handler concurrency guard with drizzle count query]

key-files:
  created: []
  modified:
    - packages/backend/src/modules/runtime/runtime.routes.ts

key-decisions:
  - "Limit constant (MAX_CONCURRENT_TASKS_PER_USER=3) defined at module scope for easy tuning"

patterns-established:
  - "Concurrency guard pattern: count active tasks before allowing new submission"

requirements-completed: [BGND-01, BGND-03]

duration: 1min
completed: 2026-03-26
---

# Phase 18 Plan 05: Per-User Concurrent Task Limit Summary

**Per-user concurrent background task limit (max 3) with drizzle count query and HTTP 429 guard on start-background endpoint**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-26T07:20:10Z
- **Completed:** 2026-03-26T07:21:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added per-user concurrent task limit check querying backgroundTasks for queued/running status
- Returns HTTP 429 with clear Chinese error message when limit exceeded
- Existing pipeline flow unchanged for users within the limit

## Task Commits

Each task was committed atomically:

1. **Task 1: Add per-user concurrent task limit guard** - `a6366da` (feat)

## Files Created/Modified
- `packages/backend/src/modules/runtime/runtime.routes.ts` - Added drizzle imports, MAX_CONCURRENT_TASKS_PER_USER constant, and concurrency count check before pipeline execution

## Decisions Made
- Limit constant defined at module scope (not inline) for easy future adjustment
- Count query uses drizzle-orm count() aggregate with inArray for status filter

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Concurrent task limit enforced; ready for 18-06 (verification/integration)
- Limit value (3) can be made configurable in future if needed

---
*Phase: 18-background-execution-notifications*
*Completed: 2026-03-26*

## Self-Check: PASSED
