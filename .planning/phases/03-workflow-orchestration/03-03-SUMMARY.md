---
phase: 03-workflow-orchestration
plan: "03"
subsystem: frontend
tags: [solid-flow, drag-drop, workflow-canvas, custom-nodes, react-flow-port]

# Dependency graph
requires:
  - phase: 03-workflow-orchestration
    plan: "01"
    provides: WorkflowNodeDef, WorkflowEdgeDef, Workflow types; GET/PUT /api/workflows/:id
provides:
  - WorkflowEditor page with three-column layout (library + canvas + config slot)
  - WorkflowCanvas SolidFlow wrapper with custom nodeTypes and edgeTypes
  - NodeLibraryPanel collapsible sidebar with 5 draggable node type cards
  - 5 custom node components with type-specific colors and config status badges
  - DataFlowEdge custom edge with indigo bezier path and arrow marker
affects: [03-04, frontend-workflow-canvas]

# Tech tracking
tech-stack:
  added:
    - "@dschz/solid-flow@0.1.4 — SolidJS port of React Flow / Svelte Flow"
  patterns:
    - "createNodeStore([])/createEdgeStore([]) cast as unknown to bypass BuiltInNode generic — avoids incompatibility with custom node data types"
    - "useSolidFlow() in CanvasInner child component for screenToFlowPosition — must be inside SolidFlow context"
    - "HTML5 drag with dataTransfer key application/solid-flow-node for node type payload"
    - "Frontend tsconfig: removed rootDir constraint + added @intelliflow/shared paths mapping (same pattern as backend)"

key-files:
  created:
    - packages/frontend/src/pages/admin/WorkflowEditor.tsx
    - packages/frontend/src/components/workflow/canvas/WorkflowCanvas.tsx
    - packages/frontend/src/components/workflow/canvas/NodeLibraryPanel.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/InputTransformNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/DesensitizeNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/ModelCallNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/RestoreNode.tsx
    - packages/frontend/src/components/workflow/canvas/nodes/ExportNode.tsx
    - packages/frontend/src/components/workflow/canvas/edges/DataFlowEdge.tsx
  modified:
    - packages/frontend/package.json (added @dschz/solid-flow@0.1.4 dependency)
    - packages/frontend/tsconfig.json (removed rootDir, added @intelliflow/shared paths)

key-decisions:
  - "createNodeStore/createEdgeStore cast via 'as unknown as' — the typed generic overload requires BuiltInNode compatibility (input/output/default/group) which is incompatible with custom WorkflowNodeType strings. Plain untyped cast is the pragmatic solution."
  - "Removed rootDir from frontend tsconfig — @intelliflow/shared paths mapping pulls in files outside src/, same constraint as backend"
  - "CanvasInner component pattern — useSolidFlow() must be called inside the SolidFlow render tree; a separate child component handles drag events using screenToFlowPosition"
  - "DataFlowEdge uses inline SVG <defs> marker instead of solid-flow's markerEnd string — gives full control over arrow color and shape"
  - "NodeLibraryPanel uses emoji icons as placeholders instead of SVGs — lightweight and visually distinct, can be replaced in later polish"

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 3 Plan 03: Workflow Canvas Editor Summary

**@dschz/solid-flow canvas editor with 5 custom node types, collapsible node library panel, and DataFlowEdge — complete drag-and-drop workflow design UI**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-19T11:01:03Z
- **Completed:** 2026-03-19T11:13:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Installed @dschz/solid-flow@0.1.4 and configured frontend tsconfig to resolve @intelliflow/shared types (same pattern established in Plan 03-01 for backend)
- Created WorkflowEditor page: three-column layout (NodeLibraryPanel | WorkflowCanvas | config slot), toolbar with editable workflow name + Save button, loads workflow via GET /api/workflows/:id and saves via PUT, manages nodes/edges as stores initialized from API data
- Created WorkflowCanvas: SolidFlow wrapper with Background (dots), Controls, MiniMap, custom nodeTypes/edgeTypes, onConnect handler using addEdge, onNodeClick for selection. CanvasInner child component handles drag-over/drop using useSolidFlow().screenToFlowPosition
- Created NodeLibraryPanel: collapsible w-60 sidebar (collapses to w-10 icon strip), 5 draggable node cards with type-specific colors (blue/orange/purple/green/red), emoji icons, Chinese labels and descriptions, HTML5 dataTransfer drag setup
- Created 5 custom node components following uniform pattern: colored left border (4px), white background, rounded-lg shadow card, type icon + truncated label + 已配置/未配置 badge, target and source handles
- Created DataFlowEdge: getBezierPath-based edge with inline SVG arrow marker in indigo (#6366f1)
- Auto-connect: when a node is dropped, the rightmost existing node is auto-connected to the new node

## Task Commits

1. **Task 1: Install solid-flow and create canvas editor foundation** - `de8d23f` (feat)
2. **Task 2: Custom node components and node library panel** - `6811857` (feat)

## Files Created/Modified

- `packages/frontend/package.json` — added @dschz/solid-flow@0.1.4
- `packages/frontend/tsconfig.json` — removed rootDir, added @intelliflow/shared paths mapping
- `packages/frontend/src/pages/admin/WorkflowEditor.tsx` — editor page (260 lines)
- `packages/frontend/src/components/workflow/canvas/WorkflowCanvas.tsx` — SolidFlow wrapper (107 lines)
- `packages/frontend/src/components/workflow/canvas/NodeLibraryPanel.tsx` — draggable sidebar (133 lines)
- `packages/frontend/src/components/workflow/canvas/nodes/InputTransformNode.tsx` — blue left border, 📥 icon
- `packages/frontend/src/components/workflow/canvas/nodes/DesensitizeNode.tsx` — orange left border, 🔒 icon
- `packages/frontend/src/components/workflow/canvas/nodes/ModelCallNode.tsx` — purple left border, 🤖 icon
- `packages/frontend/src/components/workflow/canvas/nodes/RestoreNode.tsx` — green left border, 🔓 icon
- `packages/frontend/src/components/workflow/canvas/nodes/ExportNode.tsx` — red left border, 📤 icon
- `packages/frontend/src/components/workflow/canvas/edges/DataFlowEdge.tsx` — indigo bezier edge with arrow

## Decisions Made

- Used `createNodeStore([])/createEdgeStore([]) as unknown as [WFNode[], ...]` to bypass the BuiltInNode generic constraint — the library's typed overloads require compatibility with `input/output/default/group` built-in types which don't match our WorkflowNodeType strings
- Removed `rootDir: ./src` from frontend tsconfig — the @intelliflow/shared paths mapping resolves to ../shared/src/types.ts which is outside the src/ directory; same fix as backend in Plan 03-01
- CanvasInner component pattern: `useSolidFlow()` must be called inside the SolidFlow render tree to access screenToFlowPosition. A separate child component is the cleanest way to use this hook from drop handlers
- DataFlowEdge defines the arrow marker inline in JSX `<defs>` rather than using the library's markerEnd string mechanism, giving precise control over color (#6366f1 indigo) matching the overall theme

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript BuiltInNode generic incompatibility with createNodeStore**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `createNodeStore<typeof customNodeTypes>()` caused TS2322 errors because the `NodesInput<T>` return type includes BuiltInNode variants (`input`, `output`, `default`, `group`) incompatible with WFNode types
- **Fix:** Use plain `createNodeStore([])` without type parameter, then cast result as `[WFNode[], setter]` via double assertion
- **Files modified:** WorkflowEditor.tsx, WorkflowCanvas.tsx
- **Committed in:** `de8d23f` (Task 1 commit)

**2. [Rule 3 - Blocking] Removed rootDir from frontend tsconfig to allow @intelliflow/shared path resolution**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** TS6059 "File is not under rootDir" when @intelliflow/shared path mapping resolved to ../shared/src/types.ts
- **Fix:** Removed `rootDir: ./src` from frontend tsconfig.json — same fix applied to backend in Plan 03-01
- **Files modified:** packages/frontend/tsconfig.json
- **Committed in:** `de8d23f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 type compatibility bug, 1 blocking tsconfig)
**Impact on plan:** No scope change. Both issues resolved within task boundary.

## Next Phase Readiness

- WorkflowEditor is routed at `/admin/workflows/:id/edit` (added in Plan 03-02)
- All 5 node types render correctly — config panel slot in right column ready for Plan 03-04
- onNodeSelect callback passes selectedNodeId up to WorkflowEditor for future config panel wiring
- solid-flow CSS imported at WorkflowEditor entry point (`@dschz/solid-flow/styles`)
- No blockers for Plan 03-04 (node configuration panel)

---
*Phase: 03-workflow-orchestration*
*Completed: 2026-03-19*
