---
phase: 13-document-runtime-refactor-align-phase12
plan: 10
subsystem: runtime, api
tags: [drizzle, solidjs, upstream-data, draft-save, progress-display]

# Dependency graph
requires:
  - phase: 13-document-runtime-refactor-align-phase12
    provides: runtime service layer, document workspace, node execution schema
provides:
  - outputData.text field in InputTransform for downstream node data flow
  - Correct draft save body shape ({ data: ... } envelope)
  - Document list progress display (progressStep, totalSteps, currentNodeLabel)
affects: [document-runtime, workspace-ui, project-home]

# Tech tracking
tech-stack:
  added: []
  patterns: [correlated SQL subqueries for progress aggregation]

key-files:
  created: []
  modified:
    - packages/backend/src/modules/runtime/input-transform.service.ts
    - packages/frontend/src/pages/workspace/DocumentWorkspace.tsx
    - packages/backend/src/modules/documents/documents.service.ts

key-decisions:
  - "Reordered combinedText computation before outputData construction to include text field"
  - "Used correlated SQL subqueries with is_current=true filter for execution versioning"

patterns-established:
  - "outputData.text convention: all node types expose text field for downstream consumption"
  - "Draft save body envelope: always wrap as { data: ... } for backend compatibility"

requirements-completed: [NODE-01, NODE-04, NODE-05, DOC-03, RECV-01]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 13 Plan 10: UAT Gap Closure Summary

**Fix upstream data flow (outputData.text), draft save body shape, and document list progress subqueries to close remaining UAT gaps**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T03:43:54Z
- **Completed:** 2026-03-25T03:45:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed InputTransform outputData to include `text: combinedText` field enabling downstream nodes (desensitize) to receive upstream text
- Fixed draft save body shape in DocumentWorkspace to use `{ data: ... }` envelope matching backend expectations
- Added progress subqueries to listDocuments returning progressStep, totalSteps, and currentNodeLabel for frontend progress bar display

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix upstream data flow and draft save body shape** - `c9c15cc` (fix)
2. **Task 2: Add progress subqueries to listDocuments** - `0362bcb` (feat)

## Files Created/Modified
- `packages/backend/src/modules/runtime/input-transform.service.ts` - Added text field to outputData, reordered combinedText computation
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` - Wrapped draft save bodies in { data } envelope
- `packages/backend/src/modules/documents/documents.service.ts` - Added DocumentListItem progress fields and correlated SQL subqueries

## Decisions Made
- Reordered combinedText computation before outputData construction (was computed after, making it unavailable for inclusion)
- Used correlated SQL subqueries with raw SQL and `is_current=true` filter to respect execution versioning in progress display
- Added nodeExecutions import even though SQL uses raw table name, for schema reference consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in Login.tsx (WeChat login types) are unrelated to this plan's changes -- out of scope per deviation rules

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Desensitize node can now receive upstream InputTransform text via outputData.text
- Draft save requests use correct body shape, eliminating 404 errors
- Document list API returns progress fields for frontend progress bar display
- All UAT gap root causes addressed; ready for re-testing

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both task commits verified (c9c15cc, 0362bcb)
- outputData.text field present in input-transform.service.ts
- { data } envelope present in both draft save calls in DocumentWorkspace.tsx
- progressStep, totalSteps, currentNodeLabel subqueries present in documents.service.ts

---
*Phase: 13-document-runtime-refactor-align-phase12*
*Completed: 2026-03-25*
