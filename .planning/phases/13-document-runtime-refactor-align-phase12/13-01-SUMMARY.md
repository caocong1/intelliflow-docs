---
phase: 13-document-runtime-refactor-align-phase12
plan: 01
subsystem: api, database
tags: [drizzle, runtime, model-call, export, versioning, prompt-resolution]

requires:
  - phase: 12-workflow-editor-fixes-config-panel-alignment
    provides: Flow engine with nodeId-based config, models Record output structure
provides:
  - DocumentRuntimeState with workflowNodes for frontend config access
  - nodeId-based prompt variable resolution (replaces nodeLabel-based)
  - model_call_logs table for model API call auditing
  - executionRound versioning on nodeExecutions for rollback history
  - Working directory creation on document init
  - Export resolveContent handles models Record structure
affects: [13-02, 13-03, 13-04, frontend-runtime-executors]

tech-stack:
  added: []
  patterns: [versioned-rollback, nodeId-variable-resolution, model-call-logging]

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/db/schema.ts
    - packages/backend/src/modules/runtime/runtime.service.ts
    - packages/backend/src/modules/runtime/model-call.service.ts
    - packages/backend/src/modules/runtime/model-call.routes.ts
    - packages/backend/src/modules/runtime/export.service.ts
    - packages/backend/src/modules/runtime/desensitize.service.ts

key-decisions:
  - "resolvePromptTemplate returns { resolved, mapping } tuple for model call logging"
  - "rollbackToNode creates new versioned rows (isCurrent=true) instead of mutating existing rows"
  - "buildRuntimeState filters by isCurrent=true and includes workflowNodes from workflow JOIN"

patterns-established:
  - "Versioned rollback: old rows get isCurrent=false, new rows created with executionRound+1"
  - "Model call logging: every API call (success or failure) recorded in model_call_logs"

requirements-completed: [DOC-02, DOC-04, NODE-08, NODE-22, RECV-02]

duration: 6min
completed: 2026-03-21
---

# Phase 13 Plan 01: Backend Data Flow Fixes Summary

**Extended runtime init with workflowNodes, fixed nodeId-based prompt resolution, added model_call_logs table, versioned rollback, and models Record export lookup**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T06:44:20Z
- **Completed:** 2026-03-21T06:50:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- DocumentRuntimeState now includes workflowNodes array with full config for each node
- Prompt variable resolution uses nodeId.outputId format instead of nodeLabel.outputName
- model_call_logs table tracks every model API call with prompt, response status, duration
- Rollback creates versioned nodeExecution rows instead of mutating existing ones
- Export resolveContent handles Phase 12 models Record structure alongside legacy array format
- Working directory (input/output/export subdirs) created on document init

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend shared types + DB schema** - `61a63d5` (feat)
2. **Task 2: Fix runtime services** - `24b13ec` (feat)

## Files Created/Modified
- `packages/shared/src/types.ts` - Added ModelCallLog interface, workflowNodes to DocumentRuntimeState, executionRound/isCurrent to NodeExecution
- `packages/backend/src/db/schema.ts` - Added model_call_logs table, execution_round and is_current columns to node_executions
- `packages/backend/src/modules/runtime/runtime.service.ts` - buildRuntimeState includes workflowNodes, initDocumentExecution creates workDir, rollback uses versioning, all queries filter isCurrent
- `packages/backend/src/modules/runtime/model-call.service.ts` - resolvePromptTemplate uses nodeId matching and returns variable mapping, executeModelCall/retryModelCall insert model_call_logs
- `packages/backend/src/modules/runtime/model-call.routes.ts` - Updated callers to use new resolvePromptTemplate return type and pass promptTemplate/mapping to execute/retry
- `packages/backend/src/modules/runtime/export.service.ts` - Added models Record lookup before legacy modelOutputs array fallback
- `packages/backend/src/modules/runtime/desensitize.service.ts` - Added executionRound and isCurrent fields to returned NodeExecution

## Decisions Made
- resolvePromptTemplate returns `{ resolved, mapping }` tuple so callers can pass variable mapping to model call logging
- rollbackToNode creates new versioned rows with `isCurrent=true` and `executionRound=MAX+1` instead of mutating existing rows -- preserves full execution history
- buildRuntimeState filters by `isCurrent=true` and includes workflowNodes from workflow JOIN

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed desensitize.service.ts missing new NodeExecution fields**
- **Found during:** Task 2 (typecheck verification)
- **Issue:** desensitize.service.ts constructs NodeExecution object without executionRound and isCurrent fields added in Task 1
- **Fix:** Added executionRound and isCurrent fields from the updated DB row
- **Files modified:** packages/backend/src/modules/runtime/desensitize.service.ts
- **Verification:** `bunx tsc --noEmit` passes cleanly
- **Committed in:** 24b13ec (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for type correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend now provides correct data structures for frontend runtime executors
- workflowNodes available in runtime state for config panel rendering
- Variable resolution uses nodeId format matching Phase 12 editor output
- Model call logging infrastructure ready for debugging and analytics
- Ready for Plan 02 (frontend executor refactoring)

---
*Phase: 13-document-runtime-refactor-align-phase12*
*Completed: 2026-03-21*
