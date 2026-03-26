---
phase: 18-background-execution-notifications
plan: 03
subsystem: ui
tags: [polling, background-execution, status-badges, solidjs, workspace, document-list]

# Dependency graph
requires:
  - phase: 18-background-execution-notifications
    plan: 01
    provides: POST /runtime/:documentId/start-background endpoint, GET /runtime/:documentId state endpoint, 'failed' document status
provides:
  - Polling-based workspace that recovers state from backend instead of driving execution
  - Document list with generation status badges (spinning animation) and auto-polling
  - Failed node display with error summary and retry button
  - startBackgroundExecution and fetchDocumentRuntimeState API helpers
affects: [18-04, workspace-ux, document-list-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [polling with countdown timer, background execution trigger, state recovery on page load]

key-files:
  created: []
  modified:
    - packages/frontend/src/pages/workspace/DocumentWorkspace.tsx
    - packages/frontend/src/pages/projects/ProjectHome.tsx
    - packages/frontend/src/api/client.ts

key-decisions:
  - "Replaced frontend step-by-step advance with single startBackgroundExecution call"
  - "3-second polling for workspace, 10-second polling for document list"
  - "Polling auto-starts on page load if generation is active (state recovery)"

patterns-established:
  - "Polling pattern: createEffect watches isGenerating signal, setInterval ticks countdown, fetchRuntimeState on expiry"
  - "State recovery: on mount, detect active generation from backend state and auto-start polling"
  - "Failed node UX: red banner with error details and retry button that re-triggers background execution"

requirements-completed: [BGND-01, BGND-02, BGND-03]

# Metrics
duration: 6min
completed: 2026-03-26
---

# Phase 18 Plan 03: Frontend Polling & Status Badges Summary

**Polling-based workspace with background execution trigger, countdown timers, failed node retry UX, and document list status badges with auto-refresh**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-26T06:41:08Z
- **Completed:** 2026-03-26T06:47:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Workspace triggers background execution via single POST instead of frontend-driven step-by-step flow
- Workspace polls every 3 seconds during active generation with countdown timer and manual refresh button
- On page load/refresh, workspace recovers state from backend and auto-starts polling if generation is active
- Failed nodes display red banner with error message and retry button
- Document list shows status badges: spinning "生成中", "已完成", "生成失败" (red)
- Document list polls every 10 seconds when any document is in_progress, with countdown + manual refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor DocumentWorkspace to use background execution with polling and state recovery** - `73429cb` (feat)
2. **Task 2: Add generation status badges and polling to document list page** - `3c57d81` (feat)

## Files Created/Modified
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` - Background execution trigger, 3s polling with countdown, failed node display with retry, state recovery on mount
- `packages/frontend/src/pages/projects/ProjectHome.tsx` - Status badges (生成中/已完成/生成失败), 10s polling with countdown, failed status in type and filter
- `packages/frontend/src/api/client.ts` - Added startBackgroundExecution and fetchDocumentRuntimeState helper functions

## Decisions Made
- Replaced the handleAdvance step-by-step flow with startBackgroundExecution call -- entire pipeline runs on backend
- Used 3-second interval for workspace (near real-time feel) and 10-second for document list (lighter load)
- Polling controlled by createEffect watching isGenerating/hasActiveGenerations signals for automatic cleanup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend now fully supports background execution model
- Plan 04 can build on notification delivery and real-time push if needed
- Workspace retry triggers re-execution from failed node via same start-background endpoint

---
*Phase: 18-background-execution-notifications*
*Completed: 2026-03-26*
