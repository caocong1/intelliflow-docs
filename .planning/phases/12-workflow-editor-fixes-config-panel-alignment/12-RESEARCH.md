# Phase 12: Workflow Editor Fixes & Config Panel Alignment - Research

**Researched:** 2026-03-20
**Domain:** Custom SVG+HTML flow editor replacing @dschz/solid-flow, plus config panel alignment, undo/redo, autosave
**Confidence:** HIGH (architecture), MEDIUM (SVG edge interaction details)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 键盘 Delete/Backspace 删除选中的节点或边
- 删除节点时自动删除所有连入/连出的边
- 删除前显示确认对话框
- 边的删除：点击选中边（高亮显示）+ Delete 键
- 支持框选 + Ctrl/Shift 点击多选节点，可批量移动和批量删除
- 所有流程图操作（节点增删、边增删、节点移动、所有配置修改）都实时自动保存到后端
- 支持 Ctrl+Z 撤销 / Ctrl+Shift+Z 恢复，覆盖所有操作
- 右上角显示自动保存状态（"保存中..." + 动画）
- 验证按钮独立于保存，验证通过后显示"已验证"状态
- 验证通过后如果内容被修改并自动保存，验证状态重置为"未验证"
- 模型调用节点：modelId 单选改为 modelIds[] 多选（checkbox 列表）
- 运行时字段 autoAdvance、allowEdit、skippable 在每个节点配置面板底部以"运行时设置"折叠区暴露
- 全面检查所有 5 个节点配置面板，确保共享类型中的每个字段在 UI 中都有对应输入控件
- 配置面板样式一致性：交给 ui-ux-pro-max 审查并统一
- 节点名称（label）确保正确传递给运行时
- "表单字段"改名为"用户输入项"
- 去掉英文字段名（name），自动从显示标签（label）生成
- 输入转换的输出配置与具体设置一一对应
- 移除手动 OutputsEditor，输出完全从配置自动派生
- 脱敏节点配置改为管理员添加脱敏类别（名称+描述），占位符格式系统内定
- 导出格式增加 PPT，变为 word/pdf/markdown/ppt
- 提示词编辑器旁加"优化提示词"按钮
- "变量"概念改名为"节点输出"
- 强制线性流程：每个节点最多 1 个输入连接 + 1 个输出连接
- 新连接自动替换旧连接（保持线性）
- 自动连接：拖放新节点时连接到最近的没有输出线的节点
- 连接线加流动动画效果
- 支持多种线型（曲线、直线、折线）
- 连接线中间可拖拽调整形状
- 节点样式交给 ui-ux-pro-max 统一设计
- 扩展为全配置字段验证
- 增加线性流程验证
- 拖动节点时显示对齐辅助线
- MiniMap 中节点根据类型显示不同颜色
- 顶部工具栏显示验证状态和上次保存时间
- 节点连接点可自由设置在上下左右

### Claude's Discretion
- 撤销/恢复的具体实现方案（命令模式 vs 快照 vs diff）
- 自动保存的防抖策略和频率
- 对齐辅助线的具体视觉效果和吸附距离
- 提示词优化的默认 meta-prompt 内容
- 连接线拖拽调整形状的具体交互细节
- 各节点的 autoAdvance/allowEdit/skippable 默认值

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Summary

Phase 12 is a fundamental rewrite of the workflow editor canvas layer. The user has decided to **remove `@dschz/solid-flow` entirely** and build a custom flow editor using SVG for edges/guides/selection and HTML for nodes, with CSS transform-based pan/zoom. This eliminates the poorly documented third-party dependency and gives full control over every interaction pattern required by the spec.

The custom canvas architecture uses a proven pattern employed by React Flow (internally), Excalidraw, tldraw, and other production flow editors: a **viewport container** with CSS `transform: translate(x,y) scale(z)` wrapping two layers — an SVG layer (edges, guides, selection rectangles) and an HTML layer (absolutely positioned node components). SolidJS fine-grained reactivity is ideal for this pattern because individual node position changes only re-render affected nodes and connected edges, not the entire canvas.

In addition to the canvas rewrite, the phase includes all config panel alignment work (modelIds[], auto-derived outputs, runtime settings, desensitize categories, export PPT format, prompt optimization, variable renaming), undo/redo, autosave, validation expansion, and UI/UX polish.

**Primary recommendation:** Structure the work in layers: (1) core canvas engine (viewport, coordinate system, node rendering, edge rendering), (2) interaction layer (drag, connect, select, delete), (3) advanced features (alignment guides, minimap, undo/redo, autosave), (4) config panel alignment, (5) validation expansion, (6) UI/UX polish. The canvas engine is the foundation; everything else builds on it.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| solid-js | ^1.9.5 (installed) | Reactive UI framework, fine-grained reactivity for canvas | Project standard; perfect for flow editors due to signal-level updates |
| @solidjs/router | ^0.15.3 (installed) | Client routing | Project standard |
| Tailwind CSS v4 | ^4.1.3 (installed) | Utility-first CSS | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none — custom SVG+HTML) | N/A | Flow canvas rendering | Replacing @dschz/solid-flow |
| ui-ux-pro-max skill | N/A | Design review & style unification | Node cards, config panels, connection lines, NodeLibraryPanel |

### What Gets Removed
| Library | Current Usage | Replacement |
|---------|--------------|-------------|
| @dschz/solid-flow | SolidFlow, Background, Controls, MiniMap, Handle, BaseEdge, getBezierPath, createNodeStore, createEdgeStore, useSolidFlow, addEdge | Custom FlowCanvas component with SVG+HTML layers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom SVG+HTML canvas | Keep @dschz/solid-flow | solid-flow is poorly documented, limited API, blocks required features (edge selection, alignment guides, multi-select, edge dragging) — user decided to replace |
| Canvas2D rendering | SVG+HTML | Canvas2D is faster for 1000+ nodes but loses DOM event handling, accessibility, and CSS styling. SVG+HTML is correct for 50-200 node scale |
| WebGL (pixi.js) | SVG+HTML | Massive overkill for this scale; loses all DOM benefits |

**Installation:**
```bash
# Remove solid-flow
bun remove @dschz/solid-flow
# No new dependencies needed — pure SolidJS + SVG + HTML
```

## Architecture Patterns

### Recommended Project Structure
```
packages/frontend/src/
├── components/workflow/
│   ├── canvas/
│   │   ├── FlowCanvas.tsx            # NEW — main canvas: viewport, SVG+HTML layers, pan/zoom
│   │   ├── FlowViewport.tsx          # NEW — CSS transform viewport wrapper
│   │   ├── FlowBackground.tsx        # NEW — dot/grid pattern SVG background
│   │   ├── FlowControls.tsx          # NEW — zoom in/out/fit buttons
│   │   ├── FlowMiniMap.tsx           # NEW — scaled SVG minimap with viewport indicator
│   │   ├── AlignmentGuides.tsx       # NEW — SVG alignment guide lines
│   │   ├── SelectionBox.tsx          # NEW — rubber-band selection rectangle
│   │   ├── NodeLibraryPanel.tsx      # EXISTS — drag source (minor: update dataTransfer key)
│   │   ├── ValidationOverlay.tsx     # EXISTS — validation display (extend)
│   │   ├── edges/
│   │   │   ├── EdgeRenderer.tsx      # NEW — SVG edge path rendering (bezier/straight/step)
│   │   │   ├── EdgeLabel.tsx         # NEW — foreignObject label at edge midpoint
│   │   │   ├── TempEdge.tsx          # NEW — temporary edge during connection drag
│   │   │   └── edge-paths.ts         # NEW — path calculation functions (bezier, straight, step)
│   │   └── nodes/
│   │       ├── FlowNode.tsx          # NEW — node wrapper (absolute pos, handles, drag)
│   │       ├── NodeHandle.tsx        # NEW — connection handle component (replaces solid-flow Handle)
│   │       ├── InputTransformNode.tsx    # EXISTS — content only, remove Handle/NodeProps imports
│   │       ├── DesensitizeNode.tsx       # EXISTS — same
│   │       ├── ModelCallNode.tsx         # EXISTS — same
│   │       ├── RestoreNode.tsx           # EXISTS — same
│   │       └── ExportNode.tsx            # EXISTS — same
│   ├── config/
│   │   ├── ConfigPanel.tsx           # EXISTS — add RuntimeSettings, remove OutputsEditor
│   │   ├── RuntimeSettings.tsx       # NEW — autoAdvance/allowEdit/skippable collapsible
│   │   ├── InputTransformConfig.tsx  # EXISTS — rename fields, auto-name from label
│   │   ├── DesensitizeConfig.tsx     # EXISTS — categories redesign
│   │   ├── ModelCallConfig.tsx       # EXISTS — modelIds[] multi-select, optimize prompt
│   │   ├── RestoreConfig.tsx         # EXISTS — add runtime settings
│   │   └── ExportConfig.tsx          # EXISTS — add PPT format
│   └── prompt/
│       ├── PromptEditor.tsx          # EXISTS — rename "变量" to "节点输出"
│       └── VariablePicker.tsx        # EXISTS — rename "变量" to "节点输出"
├── lib/
│   ├── flow-engine/
│   │   ├── types.ts                  # NEW — FlowNode, FlowEdge, Viewport, HandlePosition types
│   │   ├── store.ts                  # NEW — createFlowStore (nodes, edges, viewport signals)
│   │   ├── coordinate.ts            # NEW — screen↔flow coordinate transforms
│   │   ├── edge-paths.ts            # NEW — bezier, straight, step path calculators
│   │   ├── alignment.ts             # NEW — snap-to-grid, node-to-node alignment
│   │   ├── selection.ts             # NEW — selection state management
│   │   ├── undo-redo.ts             # NEW — snapshot-based undo/redo
│   │   ├── autosave.ts              # NEW — debounced save with queue
│   │   └── derive-outputs.ts        # NEW — auto-derive outputs from config
│   └── ...
```

### Pattern 1: CSS Transform Viewport (Pan/Zoom)

**What:** A container div with `transform: translate(panX, panY) scale(zoom)` and `transform-origin: 0 0`. All flow content (nodes + edges) lives inside this transformed container. Pan is mouse drag on empty space; zoom is wheel/pinch.

**When to use:** This is THE pattern for SVG+HTML flow editors. React Flow, tldraw, Excalidraw all use it.

**Architecture:**
```
┌─ FlowCanvas (overflow: hidden, captures wheel/mouse events)
│  ├─ FlowBackground (fixed, repeats with viewport offset)
│  ├─ FlowViewport (transform: translate(panX,panY) scale(zoom))
│  │  ├─ SVG layer (position: absolute, 100% width/height, pointer-events: none)
│  │  │  ├─ <g> edges (pointer-events: stroke for click)
│  │  │  ├─ <g> alignment guides
│  │  │  └─ <g> selection rectangle
│  │  └─ HTML layer (position: absolute)
│  │     └─ For each node: absolute-positioned div at (node.x, node.y)
│  ├─ FlowControls (fixed position, outside viewport transform)
│  └─ FlowMiniMap (fixed position, outside viewport transform)
```

**Example:**
```typescript
// FlowViewport.tsx
import { type JSX } from "solid-js";

type ViewportProps = {
  panX: number;
  panY: number;
  zoom: number;
  children: JSX.Element;
};

export default function FlowViewport(props: ViewportProps) {
  return (
    <div
      style={{
        transform: `translate(${props.panX}px, ${props.panY}px) scale(${props.zoom})`,
        "transform-origin": "0 0",
        position: "absolute",
        top: 0,
        left: 0,
        // Width/height set very large to allow free panning
        width: "10000px",
        height: "10000px",
      }}
    >
      {props.children}
    </div>
  );
}
```

**Confidence:** HIGH — this is the established pattern across all modern flow editors.

### Pattern 2: Coordinate System (Screen ↔ Flow)

**What:** Two coordinate spaces: **screen** (mouse events, `clientX/Y`) and **flow** (node positions, edge endpoints). Conversion is essential for all interactions.

**Formulas:**
```typescript
// coordinate.ts
export type Viewport = { x: number; y: number; zoom: number };

// Screen → Flow: where the mouse is in flow coordinates
export function screenToFlow(
  screenX: number, screenY: number,
  canvasRect: DOMRect,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: (screenX - canvasRect.left - viewport.x) / viewport.zoom,
    y: (screenY - canvasRect.top - viewport.y) / viewport.zoom,
  };
}

// Flow → Screen: where a flow point appears on screen
export function flowToScreen(
  flowX: number, flowY: number,
  canvasRect: DOMRect,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: flowX * viewport.zoom + viewport.x + canvasRect.left,
    y: flowY * viewport.zoom + viewport.y + canvasRect.top,
  };
}
```

**Zoom behavior:** Zoom toward mouse pointer position. On wheel event:
```typescript
function handleWheel(e: WheelEvent) {
  e.preventDefault();
  const direction = e.deltaY > 0 ? -1 : 1;
  const factor = 1 + direction * 0.1; // 10% per step
  const newZoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);

  // Zoom toward mouse position
  const mouseX = e.clientX - canvasRect.left;
  const mouseY = e.clientY - canvasRect.top;
  const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
  const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);

  setViewport({ x: newX, y: newY, zoom: newZoom });
}
```

**Zoom limits:** `MIN_ZOOM = 0.2`, `MAX_ZOOM = 4` (matching current solid-flow config).

**Confidence:** HIGH — basic linear algebra, well-established.

### Pattern 3: SVG Edge Rendering

**What:** Edges rendered as SVG `<path>` elements in the SVG layer. Three path types needed: bezier (curved), straight (linear), and step (orthogonal with corners).

**Bezier path calculation:**
```typescript
// edge-paths.ts
export type HandlePosition = "top" | "right" | "bottom" | "left";

export function getBezierPath(
  sourceX: number, sourceY: number, sourcePosition: HandlePosition,
  targetX: number, targetY: number, targetPosition: HandlePosition,
  curvature = 0.25
): { path: string; labelX: number; labelY: number } {
  const dx = Math.abs(targetX - sourceX);
  const dy = Math.abs(targetY - sourceY);
  const offset = Math.max(dx, dy) * curvature;

  // Control points extend in the direction of the handle
  const [scx, scy] = getControlPoint(sourceX, sourceY, sourcePosition, offset);
  const [tcx, tcy] = getControlPoint(targetX, targetY, targetPosition, offset);

  const path = `M ${sourceX},${sourceY} C ${scx},${scy} ${tcx},${tcy} ${targetX},${targetY}`;
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  return { path, labelX, labelY };
}

function getControlPoint(
  x: number, y: number, position: HandlePosition, offset: number
): [number, number] {
  switch (position) {
    case "top": return [x, y - offset];
    case "bottom": return [x, y + offset];
    case "left": return [x - offset, y];
    case "right": return [x + offset, y];
  }
}

// Step path (orthogonal routing)
export function getStepPath(
  sourceX: number, sourceY: number, sourcePosition: HandlePosition,
  targetX: number, targetY: number, targetPosition: HandlePosition,
  padding = 20
): { path: string; labelX: number; labelY: number } {
  // Simplified L-shaped or Z-shaped routing
  const midX = (sourceX + targetX) / 2;
  const path = `M ${sourceX},${sourceY} L ${midX},${sourceY} L ${midX},${targetY} L ${targetX},${targetY}`;
  return { path, labelX: midX, labelY: (sourceY + targetY) / 2 };
}
```

**Edge click target:** SVG paths are thin and hard to click. Use an invisible wider path behind the visible one:
```typescript
// EdgeRenderer.tsx — each edge renders two paths
<>
  {/* Invisible wide hit area */}
  <path
    d={pathData}
    stroke="transparent"
    stroke-width="12"
    fill="none"
    style={{ cursor: "pointer", "pointer-events": "stroke" }}
    onClick={() => onEdgeSelect(edge.id)}
  />
  {/* Visible edge */}
  <path
    d={pathData}
    stroke={selected ? "#4f46e5" : "#6366f1"}
    stroke-width={selected ? "3" : "2"}
    fill="none"
    style={{ "pointer-events": "none" }}
    class={animated ? "edge-animated" : ""}
  />
</>
```

**Flow animation (CSS):**
```css
@keyframes edge-flow {
  from { stroke-dashoffset: 24; }
  to { stroke-dashoffset: 0; }
}
.edge-animated {
  stroke-dasharray: 8 4;
  animation: edge-flow 0.6s linear infinite;
}
```

**Edge midpoint dragging:** Store optional control point overrides per edge. When user drags the midpoint, update the control point. The edge path function checks for custom control points first, falls back to automatic calculation.

**Confidence:** HIGH for bezier/straight/animation, MEDIUM for edge midpoint dragging (interaction complexity).

### Pattern 4: Node Rendering with Handles

**What:** Each node is an absolutely positioned HTML div. Connection handles are small div circles positioned on the node border (top/right/bottom/left). Handle positions are computed from node position + node dimensions + handle side.

**FlowNode wrapper:**
```typescript
// FlowNode.tsx — wraps each node type component
export default function FlowNode(props: {
  node: FlowNodeData;
  selected: boolean;
  onDragStart: (nodeId: string, startPos: { x: number; y: number }) => void;
  onHandleMouseDown: (nodeId: string, handleType: "source" | "target", position: HandlePosition) => void;
  children: JSX.Element; // The actual node content (InputTransformNode, etc.)
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${props.node.position.x}px`,
        top: `${props.node.position.y}px`,
        "z-index": props.selected ? 10 : 1,
      }}
      onMouseDown={(e) => {
        if (e.target closest is not a handle) {
          props.onDragStart(props.node.id, { x: e.clientX, y: e.clientY });
        }
      }}
    >
      {props.children}
      {/* Handles rendered by FlowNode, not by individual node components */}
      <NodeHandle type="target" position="left" onMouseDown={...} />
      <NodeHandle type="source" position="right" onMouseDown={...} />
    </div>
  );
}
```

**Handle position computation (for edge endpoint calculation):**
```typescript
export function getHandlePosition(
  nodePos: { x: number; y: number },
  nodeSize: { width: number; height: number },
  side: HandlePosition
): { x: number; y: number } {
  switch (side) {
    case "top": return { x: nodePos.x + nodeSize.width / 2, y: nodePos.y };
    case "bottom": return { x: nodePos.x + nodeSize.width / 2, y: nodePos.y + nodeSize.height };
    case "left": return { x: nodePos.x, y: nodePos.y + nodeSize.height / 2 };
    case "right": return { x: nodePos.x + nodeSize.width, y: nodePos.y + nodeSize.height / 2 };
  }
}
```

**Node size measurement:** Use `ResizeObserver` on each node div to track actual rendered dimensions (needed for handle positioning and edge endpoint calculation). Cache sizes in the flow store.

**Confidence:** HIGH — standard pattern.

### Pattern 5: Connection Creation UX

**What:** User mousedown on a source handle → temporary edge follows mouse → mouseup on a target handle creates the edge. During drag, render a temporary SVG path from source handle to mouse position.

**Flow:**
1. `onMouseDown` on source handle → store `{ sourceNodeId, sourceHandlePosition }` in a `connecting` signal
2. `onMouseMove` on canvas → update temp edge endpoint to current mouse position (in flow coords)
3. `onMouseUp` on target handle → create edge, clear `connecting`
4. `onMouseUp` on empty space → cancel, clear `connecting`

**Linear constraint enforcement:** Before creating the edge, check:
- Source node already has an outgoing edge → remove it (replace)
- Target node already has an incoming edge → remove it (replace)

**Confidence:** HIGH.

### Pattern 6: Selection System

**What:** Three selection modes: click (single), Ctrl/Shift+click (toggle multi), rubber-band box (area select).

**Implementation:**
```typescript
// selection.ts
export function createSelectionStore() {
  const [selectedNodeIds, setSelectedNodeIds] = createSignal<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = createSignal<Set<string>>(new Set());

  function selectNode(id: string, multi: boolean) {
    if (multi) {
      // Toggle: add if not selected, remove if selected
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedNodeIds(new Set([id]));
      setSelectedEdgeIds(new Set());
    }
  }

  function selectEdge(id: string) {
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set([id]));
  }

  function selectNodesInRect(rect: DOMRect, nodes: FlowNode[]) {
    const ids = new Set<string>();
    for (const node of nodes) {
      if (rectsIntersect(rect, getNodeRect(node))) {
        ids.add(node.id);
      }
    }
    setSelectedNodeIds(ids);
  }

  function clearSelection() {
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
  }

  return { selectedNodeIds, selectedEdgeIds, selectNode, selectEdge, selectNodesInRect, clearSelection };
}
```

**Rubber-band box:** On mousedown on empty canvas space (not a node or handle), start tracking. On mousemove, render an SVG `<rect>` from start to current position. On mouseup, compute which nodes intersect the rectangle and select them.

**Batch operations:** Selected nodes can be moved together (offset all positions by the same delta) or deleted together (with confirmation dialog).

**Confidence:** HIGH.

### Pattern 7: MiniMap

**What:** A scaled-down representation of the entire flow in a fixed-position overlay. Shows all nodes as colored rectangles (by type), all edges as thin lines, and a semi-transparent viewport indicator rectangle.

**Implementation approach:** Render a small SVG that mirrors the flow state at a much smaller scale. Compute the bounding box of all nodes, then scale everything to fit within the minimap dimensions (e.g., 200x150px).

```typescript
// FlowMiniMap.tsx
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;

// Node colors by type (matches existing color scheme)
const NODE_COLORS: Record<WorkflowNodeType, string> = {
  input_transform: "#3b82f6",  // blue
  desensitize: "#f97316",      // orange
  model_call: "#a855f7",       // purple
  restore: "#22c55e",          // green
  export: "#ef4444",           // red
};

function FlowMiniMap(props: { nodes: FlowNode[]; edges: FlowEdge[]; viewport: Viewport; canvasSize: { w: number; h: number } }) {
  // Compute bounding box of all nodes
  // Scale to fit minimap
  // Render nodes as small colored rects
  // Render edges as thin lines
  // Render viewport indicator as semi-transparent rect
  // onClick on minimap → pan to clicked position
}
```

**Confidence:** HIGH — straightforward scaled rendering.

### Pattern 8: Alignment Guides

**What:** When dragging a node, show horizontal/vertical guide lines when the node's edges/center align with other nodes. Snap the node position to the nearest guide within a threshold.

**Implementation:**
```typescript
// alignment.ts
const SNAP_THRESHOLD = 5; // pixels in flow coords

export type Guide = { axis: "x" | "y"; position: number };

export function computeAlignmentGuides(
  draggingNode: { x: number; y: number; width: number; height: number },
  otherNodes: Array<{ x: number; y: number; width: number; height: number }>,
  threshold = SNAP_THRESHOLD
): { guides: Guide[]; snappedX: number | null; snappedY: number | null } {
  const guides: Guide[] = [];
  let snappedX: number | null = null;
  let snappedY: number | null = null;

  const dragCenterX = draggingNode.x + draggingNode.width / 2;
  const dragCenterY = draggingNode.y + draggingNode.height / 2;
  const dragRight = draggingNode.x + draggingNode.width;
  const dragBottom = draggingNode.y + draggingNode.height;

  for (const other of otherNodes) {
    const otherCenterX = other.x + other.width / 2;
    const otherCenterY = other.y + other.height / 2;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;

    // Check vertical alignment (X-axis guides)
    for (const [dragVal, otherVal] of [
      [draggingNode.x, other.x],           // left-left
      [draggingNode.x, otherRight],         // left-right
      [dragRight, other.x],                 // right-left
      [dragRight, otherRight],              // right-right
      [dragCenterX, otherCenterX],          // center-center
    ]) {
      if (Math.abs(dragVal - otherVal) < threshold) {
        guides.push({ axis: "x", position: otherVal });
        if (snappedX === null) snappedX = otherVal - (dragVal - draggingNode.x);
      }
    }

    // Check horizontal alignment (Y-axis guides) — same pattern
    // ... (top-top, top-bottom, bottom-top, bottom-bottom, center-center)
  }

  return { guides, snappedX, snappedY };
}
```

**Visual rendering:** SVG lines spanning the full canvas at the guide positions, rendered in `AlignmentGuides.tsx` only during active drag.

**Confidence:** HIGH — well-understood algorithm.

### Pattern 9: Snapshot Undo/Redo

**What:** Store complete `{ nodes, edges }` snapshots in a bounded array. Ctrl+Z pops from undo stack to redo stack; Ctrl+Shift+Z reverses.

**Recommendation:** Use snapshot approach (not command pattern). For workflows with <200 nodes, serialization cost is negligible. The simplicity advantage is significant — command pattern requires separate undo logic for every operation type.

```typescript
// undo-redo.ts
import { createSignal } from "solid-js";

export type FlowSnapshot = {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
};

export function createUndoRedo(initial: FlowSnapshot, maxHistory = 50) {
  const [undoStack, setUndoStack] = createSignal<FlowSnapshot[]>([]);
  const [redoStack, setRedoStack] = createSignal<FlowSnapshot[]>([]);
  const [current, setCurrent] = createSignal<FlowSnapshot>(initial);

  function push(snapshot: FlowSnapshot) {
    setUndoStack((prev) => [...prev.slice(-(maxHistory - 1)), current()]);
    setRedoStack([]);
    setCurrent(() => structuredClone(snapshot));
  }

  function undo(): FlowSnapshot | null {
    const stack = undoStack();
    if (stack.length === 0) return null;
    const prev = stack[stack.length - 1];
    setUndoStack(stack.slice(0, -1));
    setRedoStack((r) => [...r, current()]);
    setCurrent(() => prev);
    return prev;
  }

  function redo(): FlowSnapshot | null {
    const stack = redoStack();
    if (stack.length === 0) return null;
    const next = stack[stack.length - 1];
    setRedoStack(stack.slice(0, -1));
    setUndoStack((u) => [...u, current()]);
    setCurrent(() => next);
    return next;
  }

  return { current, push, undo, redo, canUndo: () => undoStack().length > 0, canRedo: () => redoStack().length > 0 };
}
```

**When to push:** On node add/delete, edge add/delete, config change commit (on blur, not every keystroke), node drag end (not every pixel), batch operations. NOT on every mouse move during drag.

**Confidence:** HIGH.

### Pattern 10: Debounced Autosave

**What:** After any state change, debounce 1.5 seconds then fire PUT to backend. Show status indicator.

```typescript
// autosave.ts
export function createAutosave(
  saveFn: (data: FlowSnapshot) => Promise<void>,
  delay = 1500
) {
  const [status, setStatus] = createSignal<"idle" | "saving" | "saved" | "error">("idle");
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = false;
  let queued: FlowSnapshot | null = null;

  async function executeSave(data: FlowSnapshot) {
    inflight = true;
    setStatus("saving");
    try {
      await saveFn(data);
      setStatus("saved");
      // If another save was queued during this one, execute it
      if (queued) {
        const next = queued;
        queued = null;
        await executeSave(next);
      }
    } catch {
      setStatus("error");
    } finally {
      inflight = false;
    }
  }

  function trigger(data: FlowSnapshot) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (inflight) {
        queued = data; // Queue for after current save completes
      } else {
        executeSave(data);
      }
    }, delay);
  }

  return { trigger, status };
}
```

**Confidence:** HIGH.

### Pattern 11: Auto-Derived Outputs

**What:** Each node type computes its `outputs[]` deterministically from its config.

```typescript
// derive-outputs.ts
export function deriveOutputs(nodeId: string, config: NodeConfig): OutputDef[] {
  switch (config.type) {
    case "input_transform": {
      const outputs: OutputDef[] = [];
      for (const field of config.formFields) {
        if (field.type === "text" || field.type === "textarea") {
          outputs.push({
            id: `${nodeId}-field-${field.id}`,
            name: field.label || "未命名",
            description: `用户输入项: ${field.label}`,
          });
        }
      }
      if (config.allowFileUpload) {
        outputs.push({
          id: `${nodeId}-file-upload`,
          name: "文件输出 (动态)",
          description: "运行时按实际上传数量展开",
        });
      }
      return outputs;
    }
    case "model_call":
      return config.modelIds.map((modelId) => ({
        id: `${nodeId}-model-${modelId}`,
        name: modelId, // Display name resolved at render time
        description: "模型生成输出",
      }));
    case "desensitize":
      return [{ id: `${nodeId}-desensitized`, name: "脱敏后文本" }];
    case "restore":
      return [{ id: `${nodeId}-restored`, name: "恢复后文本" }];
    case "export":
      return [{ id: `${nodeId}-exported`, name: "导出文件" }];
  }
}
```

**Key:** Use deterministic IDs (`${nodeId}-field-${fieldId}`) so downstream references (VariableRef.outputId in prompt templates) remain stable when config is re-saved.

**Confidence:** HIGH.

### Anti-Patterns to Avoid
- **Using canvas element for nodes:** Loses DOM events, CSS styling, accessibility. Use HTML divs.
- **Re-rendering all edges on any change:** Use SolidJS fine-grained reactivity — each edge should only re-render when its source/target node position changes.
- **Storing viewport state in the flow snapshot:** Viewport (pan/zoom) is view-only state, not data. Keep it separate from undo/redo snapshots.
- **Using requestAnimationFrame for drag:** SolidJS signals already batch updates efficiently. Use `onMouseMove` directly, set signals — SolidJS handles the rest.
- **Global mouse listeners without cleanup:** Always remove `window.addEventListener("mousemove/mouseup")` in `onCleanup` or on mouseup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bezier math | Custom cubic bezier solver | Simple `C` path command with control points | SVG handles bezier natively; just compute control points |
| Edge animation | Custom requestAnimationFrame loop | CSS `stroke-dasharray` + `stroke-dashoffset` animation | GPU-accelerated, zero JS overhead |
| Debounce timer | Manual setTimeout tracking | A `createDebounce` utility (5 lines) or use the autosave pattern above | Prevent timer leak bugs |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Already used throughout codebase |
| Deep clone for snapshots | Manual recursive copy | `structuredClone()` | Built-in, handles all JSON-serializable types |
| Rect intersection test | Complex polygon math | Simple AABB overlap check (4 comparisons) | All nodes are axis-aligned rectangles |

**Key insight:** The custom canvas is NOT about reinventing the wheel — it's about having a simple, controllable architecture where SVG handles edge rendering natively and HTML handles node rendering natively. The "hard" parts (bezier curves, coordinate transforms, hit testing) are each just 10-20 lines of math.

## Common Pitfalls

### Pitfall 1: SVG Pointer Events Layer Ordering
**What goes wrong:** SVG layer captures all mouse events, preventing clicks on HTML nodes underneath (or vice versa).
**Why it happens:** SVG and HTML layers overlap; default pointer-events settings conflict.
**How to avoid:** Set `pointer-events: none` on the SVG container element. Set `pointer-events: stroke` (or `visibleStroke`) only on edge hit-area paths. Set `pointer-events: all` on edge labels (foreignObject). HTML node layer naturally sits on top and captures events.
**Warning signs:** Nodes can't be clicked; or edges can't be clicked.

### Pitfall 2: Node Size Unknown at First Render
**What goes wrong:** Edge endpoints are wrong on first render because node dimensions aren't known until after DOM paint.
**Why it happens:** Node size depends on content (text, config status badge). Until the node renders, we don't know its width/height.
**How to avoid:** Use `ResizeObserver` on each node wrapper. Store measured sizes in the flow store. Edge rendering reads from measured sizes. On first frame, edges may appear at node origin — use a small default size (180x60) as initial estimate.
**Warning signs:** Edges pointing to wrong positions on page load, then jumping to correct positions.

### Pitfall 3: Zoom Anchor Point
**What goes wrong:** Zoom centers on canvas origin (0,0) instead of on the mouse pointer position.
**Why it happens:** Naive zoom implementation just changes the scale without adjusting the translation.
**How to avoid:** Use the zoom-toward-mouse formula shown in Pattern 2 above. The key is `newPan = mousePos - (mousePos - oldPan) * (newZoom / oldZoom)`.
**Warning signs:** Canvas "jumps" when zooming; content drifts away from mouse cursor.

### Pitfall 4: Drag Event Conflicts (Node Drag vs Pan vs Selection Box)
**What goes wrong:** Mousedown starts all three behaviors simultaneously. Node drags while canvas pans. Selection box appears during node move.
**Why it happens:** All three use mousedown + mousemove + mouseup on overlapping elements.
**How to avoid:** Determine intent on mousedown based on target:
1. Mousedown on **handle** → connection creation (highest priority)
2. Mousedown on **node** → node drag (stop propagation)
3. Mousedown on **empty canvas** → either pan (middle mouse / Space+drag) or selection box (left click)

Use `e.stopPropagation()` on node mousedown to prevent canvas pan/select. Use `e.button` to distinguish left (select/drag) from middle (pan).
**Warning signs:** Erratic canvas behavior; multiple operations triggering simultaneously.

### Pitfall 5: Auto-Output Derivation Breaking Downstream References
**What goes wrong:** When outputs are auto-derived, their IDs change, breaking `contentMapping` and `inputRefs` in downstream nodes.
**Why it happens:** If outputs are regenerated with new UUIDs on every config change.
**How to avoid:** Use deterministic output IDs: `${nodeId}-field-${fieldId}` for input_transform, `${nodeId}-model-${modelId}` for model_call. Downstream refs use these stable IDs.
**Warning signs:** Prompt template variables showing as "unknown" after config edit.

### Pitfall 6: Autosave Race Conditions
**What goes wrong:** Rapid edits trigger overlapping save requests. A slow save completes after a fast save, overwriting newer data.
**Why it happens:** Debounce only prevents rapid fire, doesn't prevent overlapping requests.
**How to avoid:** Use save queue: if a save is in-flight, queue the next save. When in-flight completes, fire queued save with latest state. See autosave pattern above.
**Warning signs:** Edits "reverting" after save completes.

### Pitfall 7: Performance with 100+ Nodes and Reactive Edges
**What goes wrong:** Moving one node causes all edges to re-render because edge rendering depends on node positions.
**Why it happens:** If all node positions are stored in a single signal/array, any change triggers full recalculation.
**How to avoid:** Use SolidJS stores (not signals) for node positions. Access individual node positions via `store.nodes[index].position` — SolidJS tracks granular property access. Each edge component should only read its specific source/target node positions. Use `createMemo` per-edge to recompute path only when that edge's endpoint positions change.
**Warning signs:** Canvas becomes sluggish when moving nodes with many edges.

### Pitfall 8: ExportConfig Format Type Mismatch
**What goes wrong:** Adding "ppt" to format options but shared type still defines `format: "word" | "pdf" | "markdown"`.
**Why it happens:** Forgetting to update the shared type when adding new format options.
**How to avoid:** Update `ExportConfig.format` union type in `packages/shared/src/types.ts` FIRST, then update frontend and backend.
**Warning signs:** TypeScript errors or runtime mismatches.

## Code Examples

### Flow Store (Central State)
```typescript
// lib/flow-engine/store.ts
import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";

export type FlowNodeData = {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  size: { width: number; height: number }; // measured by ResizeObserver
  data: {
    nodeType: WorkflowNodeType;
    label: string;
    config: Record<string, unknown>;
    outputs: OutputDef[];
  };
  sourceHandle: HandlePosition; // default "right"
  targetHandle: HandlePosition; // default "left"
};

export type FlowEdgeData = {
  id: string;
  source: string;
  target: string;
  type: "bezier" | "straight" | "step"; // line type
  controlPoints?: { x: number; y: number }[]; // for midpoint dragging
};

export type Viewport = { x: number; y: number; zoom: number };

export function createFlowStore(initialNodes: FlowNodeData[], initialEdges: FlowEdgeData[]) {
  const [nodes, setNodes] = createStore<FlowNodeData[]>(initialNodes);
  const [edges, setEdges] = createStore<FlowEdgeData[]>(initialEdges);
  const [viewport, setViewport] = createSignal<Viewport>({ x: 0, y: 0, zoom: 1 });

  return { nodes, setNodes, edges, setEdges, viewport, setViewport };
}
```

### Edge Path with Arrow Marker
```typescript
// EdgeRenderer.tsx — single edge rendering
import { createMemo, Show } from "solid-js";

export default function EdgeRenderer(props: {
  edge: FlowEdgeData;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
  sourceHandlePos: HandlePosition;
  targetHandlePos: HandlePosition;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const pathData = createMemo(() => {
    switch (props.edge.type) {
      case "bezier": return getBezierPath(
        props.sourcePos.x, props.sourcePos.y, props.sourceHandlePos,
        props.targetPos.x, props.targetPos.y, props.targetHandlePos,
      );
      case "straight": return getStraightPath(props.sourcePos, props.targetPos);
      case "step": return getStepPath(
        props.sourcePos.x, props.sourcePos.y, props.sourceHandlePos,
        props.targetPos.x, props.targetPos.y, props.targetHandlePos,
      );
    }
  });

  const markerId = `arrow-${props.edge.id}`;

  return (
    <g>
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={props.selected ? "#4f46e5" : "#6366f1"} />
        </marker>
      </defs>
      {/* Wide invisible hit area */}
      <path d={pathData().path} stroke="transparent" stroke-width="12" fill="none"
            style={{ cursor: "pointer", "pointer-events": "stroke" }}
            onClick={() => props.onSelect(props.edge.id)} />
      {/* Visible edge */}
      <path d={pathData().path} stroke={props.selected ? "#4f46e5" : "#6366f1"}
            stroke-width={props.selected ? "3" : "2"} fill="none"
            marker-end={`url(#${markerId})`}
            class="edge-animated" style={{ "pointer-events": "none" }} />
    </g>
  );
}
```

### Keyboard Shortcuts
```typescript
// In FlowCanvas.tsx or WorkflowEditor.tsx
function handleKeyDown(e: KeyboardEvent) {
  // Delete selected nodes/edges
  if (e.key === "Delete" || e.key === "Backspace") {
    const selNodes = selectedNodeIds();
    const selEdges = selectedEdgeIds();
    if (selNodes.size > 0 || selEdges.size > 0) {
      // Show confirmation dialog, then delete
      if (confirm(`确认删除 ${selNodes.size} 个节点和 ${selEdges.size} 条连接？`)) {
        deleteSelected(selNodes, selEdges);
      }
    }
  }
  // Undo
  if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault();
    const snapshot = undoRedo.undo();
    if (snapshot) applySnapshot(snapshot);
  }
  // Redo
  if (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
    e.preventDefault();
    const snapshot = undoRedo.redo();
    if (snapshot) applySnapshot(snapshot);
  }
}
```

## Migration Path: solid-flow → Custom Canvas

### API Replacement Map

| solid-flow API | Custom Replacement | Notes |
|---|---|---|
| `SolidFlow` component | `FlowCanvas` component | Main canvas with viewport, SVG+HTML layers |
| `Background` | `FlowBackground` | SVG pattern (dots/grid) behind viewport |
| `Controls` | `FlowControls` | Zoom in/out/fit buttons, fixed position |
| `MiniMap` | `FlowMiniMap` | Scaled SVG with node colors by type |
| `Handle` | `NodeHandle` | Connection point div on node border |
| `BaseEdge` + `getBezierPath` | `EdgeRenderer` + `edge-paths.ts` | SVG path rendering with custom path functions |
| `useSolidFlow()` | Direct signal access | `screenToFlowPosition` → `coordinate.ts`; `fitView` → custom viewport calculation |
| `createNodeStore` | `createStore` from solid-js/store | Standard SolidJS store for nodes array |
| `createEdgeStore` | `createStore` from solid-js/store | Standard SolidJS store for edges array |
| `addEdge` | Simple array push + linear constraint | `setEdges([...edges, newEdge])` with dedup |
| `onConnect` callback | `onConnectionComplete` handler in FlowCanvas | Custom connection creation from handle drag |
| `onNodeClick` callback | `onClick` on FlowNode wrapper | Direct DOM event |
| `NodeProps<D,T>` type | Custom `FlowNodeContentProps` type | `{ data: WorkflowNodeData; selected: boolean }` |
| `EdgeProps` type | Custom `EdgeRendererProps` type | Source/target positions, selected state |
| `Node`/`Edge` types | `FlowNodeData`/`FlowEdgeData` types | Defined in `types.ts` |
| `fitView` | Custom `fitViewToNodes` function | Compute bounding box → set viewport to center+scale |
| `screenToFlowPosition` | `screenToFlow()` from `coordinate.ts` | Pure function using viewport state |

### What Can Be Dropped
- `@dschz/solid-flow/styles` import — no external CSS needed
- `NodeTypes`/`EdgeTypes` registry pattern — use Switch/Match or direct component references
- `Store` type casting workarounds (`as unknown as [WFNode[], ...]`) — use plain SolidJS stores directly

### Migration Steps
1. Create `lib/flow-engine/` with types, store, coordinate, edge-path utilities
2. Create `FlowCanvas`, `FlowViewport`, `FlowBackground`, `FlowControls`
3. Create `FlowNode` wrapper, `NodeHandle`, `EdgeRenderer`, `TempEdge`
4. Update 5 node components: remove `Handle`/`NodeProps` imports, accept simple props
5. Update `WorkflowEditor.tsx`: replace `createNodeStore`/`createEdgeStore` with `createStore`, remove `@dschz/solid-flow` imports
6. Update `WorkflowCanvas.tsx` → rename to `FlowCanvas.tsx`, rewrite with custom canvas
7. Remove `DataFlowEdge.tsx` → replaced by `EdgeRenderer.tsx`
8. `bun remove @dschz/solid-flow`

## Performance Considerations

### 50-200 Nodes Scale
- **Node rendering:** HTML nodes with absolute positioning is O(n) DOM elements. 200 nodes = 200 divs. Modern browsers handle this easily.
- **Edge rendering:** 200 nodes in a linear flow = ~199 edges = ~398 SVG path elements (visible + hit area). Well within SVG performance limits.
- **Node drag:** Only the dragged node(s) and connected edges re-render. SolidJS granular reactivity ensures other nodes/edges don't re-render.
- **Viewport pan/zoom:** Single CSS transform on the viewport container. GPU-accelerated. Zero per-node cost.
- **Alignment guide computation:** O(n) scan of other nodes during drag. For 200 nodes, this is <1ms per frame.

### Optimization strategies (if needed)
- **Viewport culling:** Only render nodes/edges visible in the current viewport. Not needed at 200 nodes, but useful if scaling to 1000+.
- **Edge path memoization:** Use `createMemo` per edge so path recalculation only happens when that edge's endpoints move.
- **Batch node position updates:** During multi-node drag, batch all position updates in a single store reconciliation.

**Verdict:** At the 50-200 node scale, no special optimization is needed. SolidJS's fine-grained reactivity + SVG + CSS transforms handle this scale comfortably.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @dschz/solid-flow library | Custom SVG+HTML canvas | Phase 12 | Full control over interactions; no undocumented limitations |
| Manual OutputsEditor | Auto-derived from config | Phase 12 | Eliminates user error, ensures runtime alignment |
| Single modelId select | modelIds[] checkbox list | Phase 12 | Enables multi-model parallel generation |
| Manual save button | Debounced autosave + status indicator | Phase 12 | Better UX, no data loss |
| No undo/redo | Snapshot-based Ctrl+Z / Ctrl+Shift+Z | Phase 12 | Standard editor expectation |
| "变量" terminology | "节点输出" terminology | Phase 12 | Aligns with Phase 5 runtime concepts |
| No edge selection/deletion | Click select + Delete key | Phase 12 | Basic editing capability |
| No multi-select | Click + Ctrl/Shift + rubber-band | Phase 12 | Batch operations |
| No alignment guides | Snap-to-grid + node-to-node alignment | Phase 12 | Professional editor feel |

**Deprecated/outdated:**
- `@dschz/solid-flow`: Removed entirely — replaced by custom canvas
- `OutputsEditor.tsx`: Removed — replaced by auto-derivation
- `modelId` field in ModelCallConfig: Replaced by `modelIds[]`
- `name` field in FormFieldDef: Auto-generated from `label`

## Open Questions

1. **Edge midpoint dragging complexity**
   - What we know: User wants edges to be draggable at the midpoint to reshape the curve. This requires storing custom control points per edge and rendering the path using those control points.
   - What's unclear: The exact UX for multi-segment step edges (which segment gets the drag handle?) and whether the drag should add a new control point or move an existing one.
   - Recommendation: For v1, implement single midpoint drag for bezier edges (move the two control points symmetrically). For step edges, allow dragging the middle segment horizontally. Keep it simple and iterate.

2. **Prompt optimization API endpoint**
   - What we know: User wants "优化提示词" button that calls an AI model.
   - What's unclear: Whether to create a new backend endpoint or reuse existing model call infrastructure.
   - Recommendation: Create `POST /api/prompts/optimize` accepting `{ promptText, modelId, metaPrompt? }` and returning optimized text. Reuse existing model call service internally.

3. **DesensitizeConfig type change scope**
   - What we know: Current type uses `ruleTypes: string[]` and `placeholderFormat: string`. New design requires `categories: Array<{ name: string; description: string }>`.
   - What's unclear: Whether Phase 5 runtime desensitize executor already handles the new format.
   - Recommendation: Update shared type first. Check and update Phase 5 executor if needed. Placeholder format `[TYPE_N]` becomes a constant.

4. **Node dimension measurement timing**
   - What we know: Edge endpoints depend on node dimensions, which are only known after render.
   - What's unclear: Whether there will be visible "jump" when ResizeObserver reports sizes.
   - Recommendation: Use reasonable default sizes (180x60) for initial render. ResizeObserver updates will be near-instant (same frame via microtask). Most users won't notice.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: All workflow-related source files analyzed (`WorkflowCanvas.tsx`, `WorkflowEditor.tsx`, `DataFlowEdge.tsx`, 5 node components, `NodeLibraryPanel.tsx`, `package.json`)
- `packages/shared/src/types.ts`: Referenced via CONTEXT.md for shared type definitions
- `12-CONTEXT.md`: User decisions and constraints
- SVG specification: Path commands (`M`, `C`, `L`), marker elements, pointer-events attribute
- CSS Transforms specification: `transform`, `transform-origin` for viewport

### Secondary (MEDIUM confidence)
- React Flow architecture patterns: CSS transform viewport, SVG+HTML layering, coordinate system — applied by analogy as this is the established pattern for flow editors (React Flow open source)
- tldraw/Excalidraw architecture: Same SVG+HTML+CSS transform pattern, confirming this is the standard approach
- SolidJS reactivity model: Fine-grained store tracking for per-node/per-edge updates — verified against SolidJS documentation

### Tertiary (LOW confidence)
- Edge midpoint dragging UX details: No direct reference implementation inspected; based on general bezier control point manipulation knowledge

## Metadata

**Confidence breakdown:**
- Custom canvas architecture: HIGH - Well-established SVG+HTML+CSS transform pattern used by React Flow, tldraw, Excalidraw
- Edge rendering: HIGH - Standard SVG path math, CSS animation
- Interaction patterns (drag, select, connect): HIGH - Standard DOM event patterns
- Edge midpoint dragging: MEDIUM - Conceptually simple but UX details need iteration
- Config panel alignment: HIGH - Direct code analysis, clear field mapping
- Undo/redo + autosave: HIGH - Standard patterns, simple implementation
- Performance at 200 nodes: HIGH - Well within SVG+HTML capabilities

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (custom implementation; no external dependency changes)
