---
phase: 12-workflow-editor-fixes-config-panel-alignment
plan: "01"
subsystem: ui, api
tags: [solidjs, svg, flow-engine, types, coordinate-transforms, edge-paths, reactive-store]

requires:
  - phase: 03-workflow-management
    provides: "Existing workflow editor, node components, shared types"
  - phase: 05-document-creation-runtime
    provides: "Runtime executor components that consume shared types"
provides:
  - "Updated shared types: FormFieldDef without name, DesensitizeConfig with categories, ExportConfig with ppt"
  - "Flow engine types: FlowNodeData, FlowEdgeData, Viewport, HandlePosition"
  - "Reactive flow store with node/edge CRUD, linear constraint enforcement, snapshot/restore"
  - "Coordinate transforms: screenToFlow, flowToScreen, getHandlePosition"
  - "Edge path calculators: getBezierPath, getStraightPath, getStepPath"
  - "deriveOutputs utility for auto-deriving OutputDef from NodeConfig"
affects: [12-02-PLAN, 12-03-PLAN, 12-04-PLAN, 12-05-PLAN, 12-06-PLAN, 12-07-PLAN]

tech-stack:
  added: []
  patterns:
    - "Flow engine as pure library (lib/flow-engine/) separate from UI components"
    - "Deterministic output IDs for stable downstream references"
    - "System-defined placeholder format [TYPE_N] replacing user-configurable format"
    - "SolidJS store + reconcile for fine-grained reactive flow state"

key-files:
  created:
    - packages/frontend/src/lib/flow-engine/types.ts
    - packages/frontend/src/lib/flow-engine/store.ts
    - packages/frontend/src/lib/flow-engine/coordinate.ts
    - packages/frontend/src/lib/flow-engine/edge-paths.ts
    - packages/frontend/src/lib/flow-engine/derive-outputs.ts
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/modules/runtime/desensitize.service.ts
    - packages/backend/src/modules/runtime/desensitize.routes.ts
    - packages/frontend/src/pages/admin/WorkflowEditor.tsx
    - packages/frontend/src/components/workflow/config/DesensitizeConfig.tsx
    - packages/frontend/src/components/workflow/config/InputTransformConfig.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/DesensitizeNode.tsx
    - packages/frontend/src/components/workspace/nodes/DesensitizeExecutor.tsx
    - packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx
    - packages/frontend/src/components/workspace/nodes/ExportExecutor.tsx

key-decisions:
  - "FormFieldDef.name removed; field.id used as key in runtime executors instead"
  - "DesensitizeConfig categories replaces ruleTypes+placeholderFormat; backend service extracts category names for detection"
  - "Placeholder format [TYPE_N] is system-defined constant, not user-configurable"
  - "addEdge enforces linear constraint by removing conflicting edges before insert"
  - "applySnapshot uses solid-js/store reconcile for fine-grained reactivity preservation"

patterns-established:
  - "Flow engine library pattern: pure functions + reactive store in lib/flow-engine/"
  - "Deterministic output IDs: ${nodeId}-field-${fieldId}, ${nodeId}-model-${modelId}"

requirements-completed: [FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-08]

duration: 6min
completed: 2026-03-20
---

# Phase 12 Plan 01: Shared Types & Flow Engine Foundation Summary

**Updated shared types (FormFieldDef name removal, DesensitizeConfig categories, ExportConfig ppt) and created 5-file flow engine library with reactive store, coordinate transforms, edge path calculators, and auto-derived outputs**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T14:32:59Z
- **Completed:** 2026-03-20T14:38:44Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Shared types aligned with runtime requirements: FormFieldDef.name removed, DesensitizeConfig uses categories array, ExportConfig supports ppt format
- Flow engine foundation library created with complete type contracts, reactive store, coordinate math, and path calculators
- All backend and frontend references updated to match new type contracts; both packages compile cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Update shared types for runtime alignment** - `f89512d` (feat)
2. **Task 2: Create flow engine library** - `04c35dd` (feat)

## Files Created/Modified
- `packages/shared/src/types.ts` - Updated FormFieldDef, DesensitizeConfig, ExportConfig
- `packages/frontend/src/lib/flow-engine/types.ts` - FlowNodeData, FlowEdgeData, Viewport, HandlePosition, PathResult types
- `packages/frontend/src/lib/flow-engine/store.ts` - createFlowStore with node/edge CRUD, linear constraint, snapshot/restore
- `packages/frontend/src/lib/flow-engine/coordinate.ts` - screenToFlow, flowToScreen, getHandlePosition
- `packages/frontend/src/lib/flow-engine/edge-paths.ts` - getBezierPath, getStraightPath, getStepPath
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` - deriveOutputs auto-derivation from NodeConfig
- `packages/backend/src/modules/runtime/desensitize.service.ts` - Updated to use categories instead of ruleTypes/placeholderFormat
- `packages/backend/src/modules/runtime/desensitize.routes.ts` - Updated detectSensitiveInfo call signature
- `packages/frontend/src/pages/admin/WorkflowEditor.tsx` - Default desensitize config uses categories
- `packages/frontend/src/components/workflow/config/DesensitizeConfig.tsx` - Rewritten for categories management UI
- `packages/frontend/src/components/workflow/config/InputTransformConfig.tsx` - Removed name field input
- `packages/frontend/src/components/workflow/canvas/nodes/DesensitizeNode.tsx` - Check categories instead of ruleTypes
- `packages/frontend/src/components/workspace/nodes/DesensitizeExecutor.tsx` - System-defined placeholder format
- `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` - Use field.id instead of field.name
- `packages/frontend/src/components/workspace/nodes/ExportExecutor.tsx` - Added ppt format option

## Decisions Made
- FormFieldDef.name removed; runtime executors now use field.id as the key for form data (stable, unique)
- DesensitizeConfig.categories replaces ruleTypes+placeholderFormat; backend extracts category names for detection functions
- Placeholder format [TYPE_N] hardcoded as system constant in both backend service and frontend executor
- Flow store addEdge enforces linear constraint by filtering out conflicting source/target edges before insertion
- applySnapshot uses SolidJS reconcile() to preserve fine-grained reactivity when restoring undo/redo state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed InputTransformExecutor field.name references**
- **Found during:** Task 1 (tsc verification)
- **Issue:** InputTransformExecutor.tsx referenced field.name which was removed from FormFieldDef
- **Fix:** Replaced all field.name references with field.id (the stable identifier)
- **Files modified:** packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** f89512d (Task 1 commit)

**2. [Rule 1 - Bug] Fixed ExportExecutor ExportFormat type mismatch**
- **Found during:** Task 1 (tsc verification)
- **Issue:** Local ExportFormat type didn't include "ppt", causing type error with updated ExportConfig
- **Fix:** Added "ppt" to local ExportFormat union and PPT option to FORMAT_OPTIONS array
- **Files modified:** packages/frontend/src/components/workspace/nodes/ExportExecutor.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** f89512d (Task 1 commit)

**3. [Rule 1 - Bug] Fixed DesensitizeExecutor placeholderFormat reference**
- **Found during:** Task 1 (code review)
- **Issue:** DesensitizeExecutor.tsx referenced config.placeholderFormat which was removed
- **Fix:** Replaced with inline system-defined format string
- **Files modified:** packages/frontend/src/components/workspace/nodes/DesensitizeExecutor.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** f89512d (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs from type changes)
**Impact on plan:** All auto-fixes necessary for compilation after shared type changes. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All type contracts defined and ready for canvas rendering (Plan 12-02) and config panels (Plan 12-04)
- Flow engine library provides complete foundation: store, coordinates, edge paths, derived outputs
- No blockers for subsequent plans

---
*Phase: 12-workflow-editor-fixes-config-panel-alignment*
*Completed: 2026-03-20*
