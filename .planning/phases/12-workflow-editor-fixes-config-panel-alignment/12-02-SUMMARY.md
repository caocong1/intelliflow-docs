---
phase: 12-workflow-editor-fixes-config-panel-alignment
plan: "02"
subsystem: ui
tags: [solidjs, svg, html, canvas, flow-editor, pan-zoom, drag-drop, edge-rendering]

requires:
  - phase: 12-workflow-editor-fixes-config-panel-alignment
    provides: "Flow engine library (types, store, coordinates, edge-paths, derive-outputs)"
  - phase: 03-workflow-management
    provides: "Existing WorkflowEditor, node components, NodeLibraryPanel, ConfigPanel"
provides:
  - "Custom SVG+HTML canvas (FlowCanvas) replacing @dschz/solid-flow"
  - "FlowViewport with CSS transform pan/zoom"
  - "FlowNode wrapper with absolute positioning, drag, ResizeObserver"
  - "NodeHandle connection points on node borders"
  - "EdgeRenderer with SVG bezier/straight/step paths and arrow markers"
  - "TempEdge for connection drag visualization"
  - "FlowBackground dot grid pattern"
  - "FlowControls zoom in/out/fit buttons"
  - "Simplified node content components (no solid-flow dependencies)"
affects: [12-03-PLAN, 12-04-PLAN, 12-05-PLAN, 12-06-PLAN, 12-07-PLAN]

tech-stack:
  added: []
  removed: ["@dschz/solid-flow"]
  patterns:
    - "SVG+HTML layered canvas with CSS transform viewport for flow editors"
    - "FlowNode wrapper pattern: positioning + drag + handles, child renders content only"
    - "EdgeRenderer with invisible hit area (12px) + visible path (2px) dual-path pattern"
    - "Connection creation via handle mousedown -> temp edge -> handle mouseup"

key-files:
  created:
    - packages/frontend/src/components/workflow/canvas/FlowCanvas.tsx
    - packages/frontend/src/components/workflow/canvas/FlowViewport.tsx
    - packages/frontend/src/components/workflow/canvas/FlowBackground.tsx
    - packages/frontend/src/components/workflow/canvas/FlowControls.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/FlowNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/NodeHandle.tsx
    - packages/frontend/src/components/workflow/canvas/edges/EdgeRenderer.tsx
    - packages/frontend/src/components/workflow/canvas/edges/TempEdge.tsx
  modified:
    - packages/frontend/src/pages/admin/WorkflowEditor.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/InputTransformNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/DesensitizeNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/ModelCallNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/RestoreNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/ExportNode.tsx
    - packages/frontend/src/components/workflow/config/ConfigPanel.tsx
    - packages/frontend/src/components/workflow/config/RestoreConfig.tsx
    - packages/frontend/src/components/workflow/config/ExportConfig.tsx
    - packages/frontend/src/components/workflow/config/ModelCallConfig.tsx
    - packages/frontend/src/components/workflow/prompt/PromptEditor.tsx
    - packages/frontend/src/components/workflow/prompt/VariablePicker.tsx
    - packages/frontend/package.json
  deleted:
    - packages/frontend/src/components/workflow/canvas/WorkflowCanvas.tsx
    - packages/frontend/src/components/workflow/canvas/edges/DataFlowEdge.tsx

key-decisions:
  - "SVG layer uses pointer-events:none on container, pointer-events:stroke on hit-area paths for correct event layering"
  - "Node content components accept simple props {data, selected, hasError} with typed NodeConfig instead of Record<string,unknown>"
  - "FlowNode wrapper handles all positioning, drag, handles, ResizeObserver; child components render only visual content"
  - "Connection creation uses data-handle-type/data-node-id attributes for mouseup target detection"
  - "Edge animation via CSS stroke-dasharray/stroke-dashoffset keyframe animation (GPU-accelerated)"
  - "dataTransfer key 'application/solid-flow-node' kept for backward compatibility with NodeLibraryPanel"

patterns-established:
  - "Canvas component architecture: FlowCanvas orchestrates, FlowViewport transforms, nodes as HTML, edges as SVG"
  - "Node wrapper pattern: FlowNode handles mechanics, child component handles appearance"
  - "Dual-path edge rendering: wide transparent hit area + narrow visible path with marker"

requirements-completed: [FLOW-02, FLOW-13]

duration: 17min
completed: 2026-03-20
---

# Phase 12 Plan 02: Custom SVG+HTML Canvas Infrastructure Summary

**Custom flow editor canvas with SVG edges and HTML nodes replacing @dschz/solid-flow, supporting pan/zoom/drag/connect/drop interactions**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-20T14:43:15Z
- **Completed:** 2026-03-20T15:00:04Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Built 8 new canvas infrastructure components (FlowCanvas, FlowViewport, FlowBackground, FlowControls, FlowNode, NodeHandle, EdgeRenderer, TempEdge)
- Simplified all 5 node components to pure content renderers with typed NodeConfig props
- Migrated WorkflowEditor from solid-flow stores to custom createFlowStore with auto-derived outputs
- Completely removed @dschz/solid-flow dependency -- zero imports remain, package removed
- Updated all downstream type references (ConfigPanel, RestoreConfig, ExportConfig, ModelCallConfig, PromptEditor, VariablePicker) from WFNode/WFEdge to FlowNodeData/FlowEdgeData

## Task Commits

Each task was committed atomically:

1. **Task 1: Create canvas infrastructure components** - `ee9bc4e` (feat)
2. **Task 2: Migrate WorkflowEditor, remove solid-flow** - `5190952` (refactor)

## Files Created/Modified
- `FlowCanvas.tsx` - Main orchestrator: SVG+HTML layers, pan/zoom, drop handling, connection creation
- `FlowViewport.tsx` - CSS transform viewport wrapper (translate + scale)
- `FlowBackground.tsx` - SVG dot pattern background adjusting with viewport
- `FlowControls.tsx` - Zoom in/out/fit-view floating button panel
- `FlowNode.tsx` - Node wrapper: absolute positioning, drag, ResizeObserver, handles
- `NodeHandle.tsx` - 12x12px connection handle with position-based CSS placement
- `EdgeRenderer.tsx` - SVG edge with bezier/straight/step paths, arrow markers, hit area
- `TempEdge.tsx` - Dashed bezier path during connection drag
- `WorkflowEditor.tsx` - Rewritten to use createFlowStore + FlowCanvas
- `InputTransformNode.tsx` through `ExportNode.tsx` - Simplified to content-only components
- `ConfigPanel.tsx`, config panels, prompt editors - Updated to FlowNodeData/FlowEdgeData types
- `WorkflowCanvas.tsx` - Deleted (replaced by FlowCanvas)
- `DataFlowEdge.tsx` - Deleted (replaced by EdgeRenderer)
- `package.json` - @dschz/solid-flow removed

## Decisions Made
- SVG layer uses `pointer-events: none` on container with `pointer-events: stroke` only on edge hit-area paths, preventing SVG from blocking HTML node clicks
- Node content components use typed `NodeConfig` instead of `Record<string, unknown>` for proper type-safe config checking (e.g., `config.formFields.length > 0`)
- Connection target detection uses `data-handle-type` and `data-node-id` DOM attributes on mouseup, avoiding complex coordinate-based hit testing
- Edge flow animation uses CSS `stroke-dasharray` + `stroke-dashoffset` keyframe for GPU-accelerated rendering with zero JS overhead
- Kept `application/solid-flow-node` dataTransfer key for drag-drop compatibility -- just a string constant, no library dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node components updated in Task 1 instead of Task 2**
- **Found during:** Task 1 (tsc verification)
- **Issue:** FlowCanvas imports node components which still had solid-flow NodeProps type, causing compilation failure
- **Fix:** Simplified all 5 node components to new props type in Task 1 alongside canvas creation
- **Files modified:** InputTransformNode.tsx, DesensitizeNode.tsx, ModelCallNode.tsx, RestoreNode.tsx, ExportNode.tsx
- **Verification:** tsc --noEmit passes with zero errors
- **Committed in:** ee9bc4e (Task 1 commit)

**2. [Rule 3 - Blocking] Type migration of downstream config/prompt files overlapped with 12-04 execution**
- **Found during:** Task 2
- **Issue:** ConfigPanel and config sub-panels imported WFNode/WFEdge from WorkflowEditor; concurrent 12-04 executor already completed this migration
- **Fix:** Verified all changes were committed, no duplicate work needed
- **Verification:** grep confirms zero WFNode/WFEdge references, tsc passes

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Task ordering adjusted for compilation dependency. Type migration overlap resolved cleanly with no conflicts.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Canvas infrastructure complete, ready for interaction features (selection, delete, keyboard shortcuts) in Plan 12-03
- All node/edge rendering functional with pan/zoom/drag/connect/drop
- No blockers for subsequent plans

---
*Phase: 12-workflow-editor-fixes-config-panel-alignment*
*Completed: 2026-03-20*
