import { For, Show, Switch, Match, createSignal, createMemo, onMount, onCleanup } from "solid-js";
import type { FlowNodeData, FlowEdgeData, Viewport, HandlePosition } from "../../../lib/flow-engine/types";
import type { WorkflowNodeType } from "@intelliflow/shared";
import { screenToFlow, getHandlePosition } from "../../../lib/flow-engine/coordinate";
import FlowViewport from "./FlowViewport";
import FlowBackground from "./FlowBackground";
import FlowControls from "./FlowControls";
import FlowNode from "./nodes/FlowNode";
import EdgeRenderer from "./edges/EdgeRenderer";
import TempEdge from "./edges/TempEdge";
import SelectionBox from "./SelectionBox";
import FlowMiniMap from "./FlowMiniMap";
import InputTransformNode from "./nodes/InputTransformNode";
import DesensitizeNode from "./nodes/DesensitizeNode";
import ModelCallNode from "./nodes/ModelCallNode";
import RestoreNode from "./nodes/RestoreNode";
import ExportNode from "./nodes/ExportNode";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const DRAG_THRESHOLD = 5;

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

type ConnectingState = {
  sourceNodeId: string;
  sourceHandleType: "source" | "target";
  sourceHandlePosition: HandlePosition;
  mousePos: { x: number; y: number };
};

export type FlowCanvasProps = {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  errorNodeIds: Set<string>;
  onNodeSelect: (id: string, e: MouseEvent) => void;
  onEdgeSelect: (id: string) => void;
  onCanvasClick: () => void;
  onNodeDragEnd: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeSizeChange: (nodeId: string, size: { width: number; height: number }) => void;
  onConnectionComplete: (sourceId: string, targetId: string) => void;
  onNodeDropped: (nodeType: WorkflowNodeType, position: { x: number; y: number }) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  onDeleteSelected: () => void;
  onRubberBandSelect: (rect: { x: number; y: number; width: number; height: number }) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onUpdateEdgeControlPoints?: (edgeId: string, controlPoints: Array<{ x: number; y: number }> | undefined) => void;
};

export default function FlowCanvas(props: FlowCanvasProps) {
  let canvasRef: HTMLDivElement | undefined;

  // Panning state
  const [isPanning, setIsPanning] = createSignal(false);
  let panStart = { x: 0, y: 0 };
  let viewportStart = { x: 0, y: 0 };

  // Dragging node state
  const [isDragging, setIsDragging] = createSignal(false);
  let dragNodeId = "";
  let dragStart = { x: 0, y: 0 };
  let dragNodeStartPos = { x: 0, y: 0 };
  // For batch drag: store initial positions of all selected nodes
  let batchDragStartPositions: Map<string, { x: number; y: number }> = new Map();

  // Connection state
  const [connecting, setConnecting] = createSignal<ConnectingState | null>(null);

  // Rubber-band selection state
  const [rubberBand, setRubberBand] = createSignal<{
    startPos: { x: number; y: number };
    currentPos: { x: number; y: number };
    active: boolean;
  } | null>(null);

  // Canvas dimensions for minimap
  const [canvasSize, setCanvasSize] = createSignal({ width: 800, height: 600 });

  onMount(() => {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    setCanvasSize({ width: rect.width, height: rect.height });
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width, height });
        }
      }
    });
    observer.observe(canvasRef);
    onCleanup(() => observer.disconnect());
  });

  // Delete confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  // --- Wheel zoom ---
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (!canvasRef) return;

    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = 1 + direction * 0.1;
    const v = props.viewport;
    const newZoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);

    const rect = canvasRef.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const newX = mouseX - (mouseX - v.x) * (newZoom / v.zoom);
    const newY = mouseY - (mouseY - v.y) * (newZoom / v.zoom);

    props.setViewport({ x: newX, y: newY, zoom: newZoom });
  }

  // --- Canvas mousedown: pan or rubber-band ---
  function handleCanvasMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target !== canvasRef && !target.closest("svg.flow-background")) {
      return;
    }

    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const screenStartX = e.clientX;
    const screenStartY = e.clientY;
    const flowStart = screenToFlow(e.clientX, e.clientY, rect, props.viewport);
    let movedBeyondThreshold = false;

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - screenStartX;
      const dy = ev.clientY - screenStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!movedBeyondThreshold && dist > DRAG_THRESHOLD) {
        movedBeyondThreshold = true;
      }

      if (movedBeyondThreshold) {
        // Middle mouse or Space is pan; left click on canvas = rubber-band
        if (e.button === 1) {
          // Pan (middle mouse) - unlikely since we check button===0 above, kept for safety
          if (!isPanning()) {
            setIsPanning(true);
            panStart = { x: screenStartX, y: screenStartY };
            viewportStart = { x: props.viewport.x, y: props.viewport.y };
          }
          props.setViewport({
            x: viewportStart.x + (ev.clientX - panStart.x),
            y: viewportStart.y + (ev.clientY - panStart.y),
            zoom: props.viewport.zoom,
          });
        } else {
          // Rubber-band selection
          const flowCurrent = screenToFlow(ev.clientX, ev.clientY, rect, props.viewport);
          setRubberBand({
            startPos: flowStart,
            currentPos: flowCurrent,
            active: true,
          });
        }
      }
    }

    function onUp(ev: MouseEvent) {
      if (!movedBeyondThreshold) {
        // It was a click on empty canvas - deselect all
        props.onCanvasClick();
      } else {
        const rb = rubberBand();
        if (rb?.active) {
          // Complete rubber-band selection
          const x = Math.min(rb.startPos.x, rb.currentPos.x);
          const y = Math.min(rb.startPos.y, rb.currentPos.y);
          const width = Math.abs(rb.currentPos.x - rb.startPos.x);
          const height = Math.abs(rb.currentPos.y - rb.startPos.y);
          if (width > 2 && height > 2) {
            props.onRubberBandSelect({ x, y, width, height });
          }
        }
      }

      setRubberBand(null);
      setIsPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // --- Node drag (supports batch) ---
  function handleNodeDragStart(nodeId: string, startScreenPos: { x: number; y: number }) {
    const node = props.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setIsDragging(true);
    dragNodeId = nodeId;
    dragStart = { x: startScreenPos.x, y: startScreenPos.y };
    dragNodeStartPos = { x: node.position.x, y: node.position.y };

    // If this node is part of a multi-selection, store all selected node start positions
    batchDragStartPositions = new Map();
    if (props.selectedNodeIds.has(nodeId) && props.selectedNodeIds.size > 1) {
      for (const nid of props.selectedNodeIds) {
        const n = props.nodes.find((nd) => nd.id === nid);
        if (n) {
          batchDragStartPositions.set(nid, { x: n.position.x, y: n.position.y });
        }
      }
    } else {
      batchDragStartPositions.set(nodeId, { x: node.position.x, y: node.position.y });
    }

    function onMove(ev: MouseEvent) {
      const dx = (ev.clientX - dragStart.x) / props.viewport.zoom;
      const dy = (ev.clientY - dragStart.y) / props.viewport.zoom;

      for (const [nid, startPos] of batchDragStartPositions) {
        props.updateNodePosition(nid, {
          x: startPos.x + dx,
          y: startPos.y + dy,
        });
      }
    }

    function onUp(ev: MouseEvent) {
      setIsDragging(false);
      const dx = (ev.clientX - dragStart.x) / props.viewport.zoom;
      const dy = (ev.clientY - dragStart.y) / props.viewport.zoom;

      for (const [nid, startPos] of batchDragStartPositions) {
        props.onNodeDragEnd(nid, {
          x: startPos.x + dx,
          y: startPos.y + dy,
        });
      }

      batchDragStartPositions = new Map();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // --- Handle connection ---
  function handleHandleMouseDown(nodeId: string, handleType: "source" | "target", position: HandlePosition) {
    if (!canvasRef) return;
    const node = props.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const rect = canvasRef.getBoundingClientRect();
    const handlePos = getHandlePosition(node.position, node.size, position);

    setConnecting({
      sourceNodeId: nodeId,
      sourceHandleType: handleType,
      sourceHandlePosition: position,
      mousePos: handlePos,
    });

    function onMove(ev: MouseEvent) {
      const flowPos = screenToFlow(ev.clientX, ev.clientY, rect, props.viewport);
      setConnecting((prev) => prev ? { ...prev, mousePos: flowPos } : null);
    }

    function onUp(ev: MouseEvent) {
      const conn = connecting();
      if (conn) {
        const target = ev.target as HTMLElement;
        const handleEl = target.closest("[data-handle-type]") as HTMLElement | null;
        if (handleEl) {
          const targetNodeEl = handleEl.closest("[data-node-id]") as HTMLElement | null;
          if (targetNodeEl) {
            const targetNodeId = targetNodeEl.dataset.nodeId;
            if (targetNodeId && targetNodeId !== conn.sourceNodeId) {
              if (conn.sourceHandleType === "source") {
                props.onConnectionComplete(conn.sourceNodeId, targetNodeId);
              } else {
                props.onConnectionComplete(targetNodeId, conn.sourceNodeId);
              }
            }
          }
        }
      }
      setConnecting(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // --- Drop from library ---
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!canvasRef) return;
    const nodeType = e.dataTransfer?.getData("application/solid-flow-node") as WorkflowNodeType | undefined;
    if (!nodeType) return;

    const rect = canvasRef.getBoundingClientRect();
    const position = screenToFlow(e.clientX, e.clientY, rect, props.viewport);
    props.onNodeDropped(nodeType, position);
  }

  // --- Fit view ---
  function fitView() {
    if (!canvasRef || props.nodes.length === 0) return;
    const rect = canvasRef.getBoundingClientRect();

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of props.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.size.width);
      maxY = Math.max(maxY, node.position.y + node.size.height);
    }

    const padding = 50;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    const zoom = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, Math.min(MAX_ZOOM, 1));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const x = rect.width / 2 - centerX * zoom;
    const y = rect.height / 2 - centerY * zoom;

    props.setViewport({ x, y, zoom });
  }

  // --- Compute edge endpoint positions ---
  function getEdgeEndpoints(edge: FlowEdgeData) {
    const sourceNode = props.nodes.find((n) => n.id === edge.source);
    const targetNode = props.nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    const sourceHandlePos = sourceNode.sourceHandle;
    const targetHandlePos = targetNode.targetHandle;
    const sourcePos = getHandlePosition(sourceNode.position, sourceNode.size, sourceHandlePos);
    const targetPos = getHandlePosition(targetNode.position, targetNode.size, targetHandlePos);

    return { sourcePos, targetPos, sourceHandlePos, targetHandlePos };
  }

  // --- Keyboard handler for delete + undo/redo ---
  function handleKeyDown(e: KeyboardEvent) {
    // Don't intercept if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }

    // Undo: Ctrl+Z (without Shift)
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      props.onUndo?.();
      return;
    }

    // Redo: Ctrl+Shift+Z
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      props.onRedo?.();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      const nodeCount = props.selectedNodeIds.size;
      const edgeCount = props.selectedEdgeIds.size;
      if (nodeCount > 0 || edgeCount > 0) {
        e.preventDefault();
        setShowDeleteConfirm(true);
      }
    }
    // Escape to deselect
    if (e.key === "Escape") {
      props.onCanvasClick();
    }
  }

  function confirmDelete() {
    props.onDeleteSelected();
    setShowDeleteConfirm(false);
  }

  function cancelDelete() {
    setShowDeleteConfirm(false);
  }

  // Cursor style
  const cursorStyle = () => {
    if (connecting()) return "crosshair";
    if (isPanning()) return "grabbing";
    if (rubberBand()?.active) return "crosshair";
    return "default";
  };

  return (
    <div
      ref={canvasRef}
      class="relative w-full h-full overflow-hidden"
      style={{ cursor: cursorStyle() }}
      tabIndex={0}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
    >
      <FlowBackground viewport={props.viewport} />
      <FlowViewport panX={props.viewport.x} panY={props.viewport.y} zoom={props.viewport.zoom}>
        {/* SVG layer for edges + selection box */}
        <svg
          class="flow-background"
          style={{
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            "pointer-events": "none",
            overflow: "visible",
          }}
        >
          {/* Edge animation CSS */}
          <defs>
            <style>{`
              @keyframes edge-flow {
                from { stroke-dashoffset: 24; }
                to { stroke-dashoffset: 0; }
              }
              @media (prefers-reduced-motion: no-preference) {
                .edge-animated {
                  stroke-dasharray: 8 4;
                  animation: edge-flow 0.6s linear infinite;
                }
              }
              @media (prefers-reduced-motion: reduce) {
                .edge-animated {
                  stroke-dasharray: 8 4;
                }
              }
            `}</style>
          </defs>
          <For each={[...props.edges]}>
            {(edge) => {
              const endpoints = createMemo(() => getEdgeEndpoints(edge));
              return (
                <Show when={endpoints()}>
                  {(ep) => (
                    <EdgeRenderer
                      edge={edge}
                      sourcePos={ep().sourcePos}
                      targetPos={ep().targetPos}
                      sourceHandlePos={ep().sourceHandlePos}
                      targetHandlePos={ep().targetHandlePos}
                      selected={props.selectedEdgeIds.has(edge.id)}
                      onSelect={props.onEdgeSelect}
                      onUpdateControlPoints={props.onUpdateEdgeControlPoints}
                      screenToFlow={(clientX: number, clientY: number) => {
                        if (!canvasRef) return { x: 0, y: 0 };
                        const rect = canvasRef.getBoundingClientRect();
                        return screenToFlow(clientX, clientY, rect, props.viewport);
                      }}
                    />
                  )}
                </Show>
              );
            }}
          </For>
          {/* Temp edge during connection */}
          <Show when={connecting()}>
            {(conn) => {
              const sourceNode = () => props.nodes.find((n) => n.id === conn().sourceNodeId);
              const sourceHandlePos = createMemo(() => {
                const node = sourceNode();
                if (!node) return { x: 0, y: 0 };
                return getHandlePosition(node.position, node.size, conn().sourceHandlePosition);
              });
              return (
                <TempEdge
                  sourcePos={sourceHandlePos()}
                  mousePos={conn().mousePos}
                  sourceHandlePos={conn().sourceHandlePosition}
                />
              );
            }}
          </Show>
          {/* Rubber-band selection box */}
          <Show when={rubberBand()}>
            {(rb) => (
              <SelectionBox
                startPos={rb().startPos}
                currentPos={rb().currentPos}
                visible={rb().active}
              />
            )}
          </Show>
        </svg>
        {/* HTML node layer */}
        <For each={[...props.nodes]}>
          {(node) => (
            <div data-node-id={node.id}>
              <FlowNode
                node={node}
                selected={props.selectedNodeIds.has(node.id)}
                onDragStart={handleNodeDragStart}
                onHandleMouseDown={handleHandleMouseDown}
                onNodeClick={props.onNodeSelect}
                onSizeChange={props.onNodeSizeChange}
              >
                <Switch>
                  <Match when={node.data.nodeType === "input_transform"}>
                    <InputTransformNode
                      data={node.data}
                      selected={props.selectedNodeIds.has(node.id)}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                  <Match when={node.data.nodeType === "desensitize"}>
                    <DesensitizeNode
                      data={node.data}
                      selected={props.selectedNodeIds.has(node.id)}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                  <Match when={node.data.nodeType === "model_call"}>
                    <ModelCallNode
                      data={node.data}
                      selected={props.selectedNodeIds.has(node.id)}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                  <Match when={node.data.nodeType === "restore"}>
                    <RestoreNode
                      data={node.data}
                      selected={props.selectedNodeIds.has(node.id)}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                  <Match when={node.data.nodeType === "export"}>
                    <ExportNode
                      data={node.data}
                      selected={props.selectedNodeIds.has(node.id)}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                </Switch>
              </FlowNode>
            </div>
          )}
        </For>
      </FlowViewport>
      <FlowControls viewport={props.viewport} setViewport={props.setViewport} fitView={fitView} />
      <FlowMiniMap
        nodes={[...props.nodes]}
        edges={[...props.edges]}
        viewport={props.viewport}
        canvasWidth={canvasSize().width}
        canvasHeight={canvasSize().height}
        onViewportChange={props.setViewport}
      />

      {/* Delete confirmation dialog */}
      <Show when={showDeleteConfirm()}>
        <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
          <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 class="text-base font-semibold text-slate-900 mb-2">确认删除</h3>
            <p class="text-sm text-slate-600 mb-5">
              确认删除 {props.selectedNodeIds.size > 0 ? `${props.selectedNodeIds.size} 个节点` : ""}
              {props.selectedNodeIds.size > 0 && props.selectedEdgeIds.size > 0 ? "和" : ""}
              {props.selectedEdgeIds.size > 0 ? `${props.selectedEdgeIds.size} 条连接` : ""}
              ？此操作不可撤销。
            </p>
            <div class="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
