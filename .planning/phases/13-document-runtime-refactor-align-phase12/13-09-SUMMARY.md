---
phase: 13-document-runtime-refactor-align-phase12
plan: 09
subsystem: workflow, runtime
tags: [desensitize, restore, inputSources, multi-input, derive-outputs, validation]

requires:
  - phase: 13-08
    provides: completed executor components and workflow editor fixes
  - phase: 12
    provides: flow engine, derive-outputs, config panels, validation framework
provides:
  - InputSource type for explicit desensitize/restore input references
  - Multi-output derive-outputs for desensitize/restore nodes
  - Auto-populate inputSources from upstream edges in workflow editor
  - Validation rules 9 (max 1 desensitize) and 10 (valid inputSources)
  - Multi-source runtime data propagation in advanceNode
  - Multi-source executor UI for desensitize and restore
affects: [runtime, workspace, workflow-editor]

tech-stack:
  added: []
  patterns:
    - "InputSource auto-population via syncInputSources() after edge/config changes"
    - "Multi-source inputData format: { sources: { [outputId]: { displayName, text } } }"
    - "Tabbed source view in executors for multi-model workflows"

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/frontend/src/lib/flow-engine/derive-outputs.ts
    - packages/backend/src/modules/workflows/validation.ts
    - packages/frontend/src/pages/admin/WorkflowEditor.tsx
    - packages/frontend/src/components/workflow/config/DesensitizeConfig.tsx
    - packages/frontend/src/components/workflow/config/RestoreConfig.tsx
    - packages/backend/src/modules/runtime/runtime.service.ts
    - packages/frontend/src/components/workspace/nodes/DesensitizeExecutor.tsx
    - packages/frontend/src/components/workspace/nodes/RestoreExecutor.tsx

key-decisions:
  - "inputSources auto-populated from upstream node outputs when edges connect; cleared on disconnect"
  - "derive-outputs generates per-inputSource outputs: {displayName}.脱敏 / {displayName}.恢复"
  - "Validation Rule 9 enforces max 1 desensitize node; Rule 10 validates inputSource references"
  - "Multi-source inputData uses { sources: { [outputId]: { displayName, text } } } structure"
  - "Single shared desensitize mapping table across all input sources"
  - "Legacy single-input fallback preserved for backward compatibility"

patterns-established:
  - "syncInputSources pattern: called after edge add/remove, node drop, and upstream config change"
  - "Multi-source executor pattern: tab bar for source selection, stacked panels for confirmed view"

requirements-completed: [NODE-05, NODE-06, NODE-07, NODE-08, NODE-13, NODE-14, NODE-15, NODE-16]

duration: 6min
completed: 2026-03-24
---

# Phase 13 Plan 09: Multi-Input Desensitize/Restore Summary

**Explicit inputSources on desensitize/restore nodes with auto-population from upstream outputs, multi-output derivation, validation enforcement, and multi-source executor UI**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T02:31:36Z
- **Completed:** 2026-03-24T02:37:36Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Added InputSource type and inputSources field to DesensitizeConfig/RestoreConfig for explicit upstream references
- derive-outputs generates one output per inputSource with naming pattern {displayName}.脱敏 / {displayName}.恢复
- Validation enforces max 1 desensitize node per workflow and validates inputSource references
- WorkflowEditor syncInputSources() auto-populates on edge connect/delete, node drop, and config changes
- Config panels show read-only input source lists with connection hints
- Runtime advanceNode propagates multi-source inputData to desensitize/restore nodes
- Executors handle multi-source input with tabbed views and stacked confirmed panels

## Task Commits

Each task was committed atomically:

1. **Task 1: Type definitions + derive-outputs + validation** - `057e723` (feat)
2. **Task 2: Auto-populate inputSources in workflow editor** - `53daffd` (feat)
3. **Task 3: Update runtime data flow + executors for multi-input** - `248dbff` (feat)

## Files Created/Modified
- `packages/shared/src/types.ts` - Added InputSource interface, inputSources to DesensitizeConfig/RestoreConfig
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` - Multi-output derivation per inputSource
- `packages/backend/src/modules/workflows/validation.ts` - Rule 9 (max 1 desensitize) and Rule 10 (valid inputSources)
- `packages/frontend/src/pages/admin/WorkflowEditor.tsx` - syncInputSources() helper and integration points
- `packages/frontend/src/components/workflow/config/DesensitizeConfig.tsx` - Read-only inputSources display
- `packages/frontend/src/components/workflow/config/RestoreConfig.tsx` - Read-only inputSources display
- `packages/backend/src/modules/runtime/runtime.service.ts` - Multi-source inputData propagation in advanceNode
- `packages/frontend/src/components/workspace/nodes/DesensitizeExecutor.tsx` - Multi-source detection, tab bar, stacked output panels
- `packages/frontend/src/components/workspace/nodes/RestoreExecutor.tsx` - Multi-source read-only view with per-source panels

## Decisions Made
- inputSources auto-populated from upstream node outputs when edges connect; cleared on disconnect
- derive-outputs generates per-inputSource outputs: {displayName}.脱敏 / {displayName}.恢复
- Validation Rule 9 enforces max 1 desensitize node; Rule 10 validates inputSource references
- Multi-source inputData uses { sources: { [outputId]: { displayName, text } } } structure
- Single shared desensitize mapping table across all input sources
- Legacy single-input fallback preserved for backward compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Biome non-null assertion in validation.ts**
- **Found during:** Task 1
- **Issue:** `stack.pop()!` flagged by Biome noNonNullAssertion rule
- **Fix:** Changed to `stack.pop()` with undefined guard
- **Files modified:** packages/backend/src/modules/workflows/validation.ts
- **Committed in:** 057e723 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor lint fix, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 plan 09 is the final plan in phase 13
- All desensitize/restore multi-input functionality complete
- Ready for end-to-end UAT testing with multi-model workflows

---
*Phase: 13-document-runtime-refactor-align-phase12*
*Completed: 2026-03-24*
