---
phase: 26-conditional-node-execution
plan: "01"
subsystem: runtime
tags: [conditional-execution, node-skip, node-block, pg-enum, workflow-validation]

# Dependency graph
requires:
  - phase: "25-system-prompt-separation"
    provides: "Background pipeline architecture, runtime.service.ts, model-call.service.ts::resolveRef"
provides:
  - "NodeCondition and NodeExecutionRule types for conditional node execution"
  - "conditions.service.ts with evaluateCondition and evaluateExecutionRule"
  - "\"blocked\" status in NodeExecutionStatus and pgEnum"
  - "executionRule field on all 5 node config types"
  - "Conditional skip (auto-advance) and block (stop) in advanceNode and background pipeline"
  - "Workflow validation Rule 12 for executionRule integrity"
affects:
  - "Phase 26-02 (frontend UI for condition configuration)"
  - "Phase 26-03 (frontend workspace display of blocked status)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Condition evaluation using resolveRef for upstream outputData resolution"
    - "Conditional skip uses recursion with depth guard to find next eligible node"
    - "Conditional block sets status and returns immediately, stopping the pipeline"
    - "Workflow validation validates executionRule structure and upstream reachability"

key-files:
  created:
    - "packages/backend/src/modules/runtime/conditions.service.ts"
    - "packages/backend/drizzle/0006_add_blocked_status.sql"
  modified:
    - "packages/shared/src/types.ts"
    - "packages/backend/src/db/schema.ts"
    - "packages/backend/src/modules/runtime/runtime.service.ts"
    - "packages/backend/src/modules/runtime/background.service.ts"
    - "packages/backend/src/modules/workflows/validation.ts"

key-decisions:
  - "evaluateExecutionRule uses resolveRef for variable resolution, consistent with prompt template resolution"
  - "skip action recurses with depth guard, block action returns immediately with blocked status"
  - "executionRule validation reuses getUpstreamIds BFS traversal from existing Rule 10 validation"
  - "blocked status in NodeExecutionStatus allows frontend to display conditional block distinctly"

patterns-established:
  - "conditions.service.ts as pure evaluation logic, no DB side effects"
  - "50-depth recursion guard prevents infinite loops from misconfigured conditions"
  - "Block reason stored in outputData.blockReason for frontend display"

requirements-completed: [COND-01, COND-02, COND-03, COND-04, COND-07, COND-08]

# Metrics
duration: 6min
completed: 2026-03-27
---

# Phase 26 Plan 01: Conditional Node Execution - Backend Summary

**Conditional node skip/block with executionRule types, conditions.service.ts, runtime integration, and workflow validation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T06:12:21Z
- **Completed:** 2026-03-27T06:18:06Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- Shared types `NodeCondition` and `NodeExecutionRule` added to `@intelliflow/shared`, exported; `"blocked"` added to `NodeExecutionStatus`; `executionRule?: NodeExecutionRule` added to all 5 config interfaces
- `nodeExecutionStatusEnum` updated with `"blocked"` value; migration SQL created for PG enum addition
- `conditions.service.ts` created with `evaluateCondition` (5 operators) and `evaluateExecutionRule` (and/or logic combining resolveRef results)
- `advanceNode` in `runtime.service.ts` evaluates executionRule before setting node in_progress; skip recurses to next node, block stops with `blocked` status; 50-depth recursion guard
- `executeDocumentPipeline` in `background.service.ts` evaluates executionRule in pipeline loop after skippable check; skip continues, block marks task failed with notification then returns
- `validation.ts` Rule 12 validates executionRule: action/logic/conditions structure, sourceRef.nodeId existence and upstream reachability, operator/value requirements

## Task Commits

1. **Task 1: Shared types + DB migration + conditions service** - `6522eaa` (feat)
2. **Task 2: Runtime integration (advanceNode, background pipeline, validation)** - `72ba221` (feat)

## Files Created/Modified

- `packages/shared/src/types.ts` - NodeCondition, NodeExecutionRule interfaces; NodeExecutionStatus with "blocked"; executionRule on all 5 configs
- `packages/backend/src/db/schema.ts` - Added "blocked" to nodeExecutionStatusEnum
- `packages/backend/drizzle/0006_add_blocked_status.sql` - ALTER TYPE for PostgreSQL enum
- `packages/backend/src/modules/runtime/conditions.service.ts` - evaluateCondition and evaluateExecutionRule functions
- `packages/backend/src/modules/runtime/runtime.service.ts` - executionRule evaluation in advanceNode with skip/block handling
- `packages/backend/src/modules/runtime/background.service.ts` - executionRule evaluation in pipeline loop
- `packages/backend/src/modules/workflows/validation.ts` - Rule 12: executionRule structural and reachability validation

## Decisions Made

- Used `resolveRef` for condition variable resolution, consistent with prompt template resolution approach in `model-call.service.ts`
- Conditional skip uses recursive `advanceNode` call with depth guard rather than inline loop to leverage existing node-finding logic
- Conditional block stops the background pipeline immediately (no recursion), marks task failed, sends notification - consistent with existing error handling pattern
- `getUpstreamIds` BFS traversal reused from Rule 10 for condition sourceRef reachability validation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Backend types and runtime logic complete. Phase 26-02 can implement frontend UI for condition configuration. Phase 26-03 can implement blocked status display in workspace.
- PostgreSQL migration must be run manually: `ALTER TYPE node_execution_status ADD VALUE IF NOT EXISTS 'blocked';` (not in a transaction block).

---
*Phase: 26-conditional-node-execution*
*Plan: 26-01*
*Completed: 2026-03-27*
