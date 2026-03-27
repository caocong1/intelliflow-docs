---
phase: 22-bug-fixes-form-field-type-extension
plan: 03
subsystem: api
tags: [runtime, validation, machineKey, fieldsByKey, derive-outputs]

requires:
  - phase: 22-01
    provides: "FormFieldDef type extension with machineKey and new field types"
provides:
  - "fieldsByKey dual-view in outputData for machineKey-based variable resolution"
  - "Runtime validation of number, date, datetime, select, multiselect field types"
  - "derive-outputs generates OutputDefs for all non-file field types using machineKey"
affects: [model-call, prompt-resolution, input-transform, derive-outputs]

tech-stack:
  added: []
  patterns: ["fieldsByKey dual-view pattern for machineKey access", "validateFieldValue helper for runtime type checking"]

key-files:
  created: []
  modified:
    - packages/backend/src/modules/runtime/input-transform.service.ts
    - packages/backend/src/modules/runtime/model-call.service.ts
    - packages/frontend/src/lib/flow-engine/derive-outputs.ts

key-decisions:
  - "Workflow config loaded via workflowId JOIN (not workflowSnapshot) matching existing codebase pattern"
  - "Validation errors collected and thrown as single AppError(400) with all field errors joined"
  - "Resolution order: direct outputData key -> fields[UUID] -> fieldsByKey[machineKey]"

patterns-established:
  - "fieldsByKey dual-view: machineKey-indexed mirror of UUID-keyed fields for human-readable references"
  - "validateFieldValue: centralized field type validation helper"

requirements-completed: [SC-7, SC-8, SC-6]

duration: 3min
completed: 2026-03-27
---

# Phase 22 Plan 03: fieldsByKey Dual-View + Runtime Validation + machineKey Derive-Outputs Summary

**fieldsByKey dual-view in outputData with runtime field validation and machineKey-based variable resolution in prompt templates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T02:52:28Z
- **Completed:** 2026-03-27T02:55:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Built fieldsByKey map (machineKey -> value) in input-transform outputData for downstream machineKey references
- Added runtime validation for number, date, datetime, select, multiselect field types at confirm time
- Added fieldsByKey fallback in resolvePromptTemplate enabling {{nodeId.machineKey}} syntax
- Extended derive-outputs to generate OutputDefs for all non-file field types using machineKey as segment key

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fieldsByKey dual-view + runtime validation** - `b5503f0` (feat)
2. **Task 2: Update variable resolution + derive-outputs** - `6fea5de` (feat)

## Files Created/Modified
- `packages/backend/src/modules/runtime/input-transform.service.ts` - fieldsByKey construction, validateFieldValue helper, workflow config loading
- `packages/backend/src/modules/runtime/model-call.service.ts` - fieldsByKey fallback in resolvePromptTemplate
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` - All non-file types generate OutputDefs, machineKey as segment key

## Decisions Made
- Loaded workflow config via workflowId JOIN to workflows table (matching getModelCallConfig pattern) instead of workflowSnapshot
- Validation errors collected into array and thrown as single AppError(400) with semicolon-joined messages
- Variable resolution order: direct outputData key, then fields[UUID], then fieldsByKey[machineKey]

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used workflowId JOIN instead of workflowSnapshot**
- **Found during:** Task 1
- **Issue:** Plan referenced `documents.workflowSnapshot` which does not exist in the schema
- **Fix:** Used `documents.workflowId` with JOIN to `workflows` table, matching existing `getModelCallConfig` pattern
- **Files modified:** packages/backend/src/modules/runtime/input-transform.service.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** b5503f0

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Schema access pattern corrected to match actual codebase. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- fieldsByKey dual-view enables downstream machineKey references for Plan 02 (frontend form rendering)
- All non-file field types now generate OutputDefs for variable picker integration

---
*Phase: 22-bug-fixes-form-field-type-extension*
*Completed: 2026-03-27*
