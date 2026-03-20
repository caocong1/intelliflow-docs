import { For, Show, Switch, Match, createSignal, createMemo, onCleanup } from "solid-js";
import type { FlowNodeData, FlowEdgeData, Viewport, HandlePosition } from "../../../lib/flow-engine/types";
import type { WorkflowNodeType } from "@intelliflow/shared";
import { screenToFlow, getHandlePosition } from "../../../lib/flow-engine/coordinate";
import FlowViewport from "./FlowViewport";
import FlowBackground from "./FlowBackground";
import FlowControls from "./FlowControls";
import FlowNode from "./nodes/FlowNode";
import EdgeRenderer from "./edges/EdgeRenderer";
import TempEdge from "./edges/TempEdge";
import InputTransformNode from "./nodes/InputTransformNode";
import DesensitizeNode from "./nodes/DesensitizeNode";
import ModelCallNode from "./nodes/ModelCallNode";
import RestoreNode from "./nodes/RestoreNode";
import ExportNode from "./nodes/ExportNode";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

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
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  errorNodeIds: Set<string>;
  onNodeSelect: (id: string, e: MouseEvent) => void;
  onEdgeSelect: (id: string) => void;
  onCanvasClick: () => void;
  onNodeDragEnd: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeSizeChange: (nodeId: string, size: { width: number; height: number }) => void;
  onConnectionComplete: (sourceId: string, targetId: string) => void;
  onNodeDropped: (nodeType: WorkflowNodeType, position: { x: number; y: number }) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
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

  // Connection state
  const [connecting, setConnecting] = createSignal<ConnectingState | null>(null);

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

  // --- Pan ---
  function handleCanvasMouseDown(e: MouseEvent) {
    // Only pan on left mouse button on empty canvas
    if (e.button !== 0) return;
    // Check if target is the canvas container or background
    const target = e.target as HTMLElement;
    if (target !== canvasRef && !target.closest("svg.flow-background")) {
      return;
    }

    props.onCanvasClick();

    setIsPanning(true);
    panStart = { x: e.clientX, y: e.clientY };
    viewportStart = { x: props.viewport.x, y: props.viewport.y };

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - panStart.x;
      const dy = ev.clientY - panStart.y;
      props.setViewport({
        x: viewportStart.x + dx,
        y: viewportStart.y + dy,
        zoom: props.viewport.zoom,
      });
    }

    function onUp() {
      setIsPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // --- Node drag ---
  function handleNodeDragStart(nodeId: string, startScreenPos: { x: number; y: number }) {
    const node = props.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setIsDragging(true);
    dragNodeId = nodeId;
    dragStart = { x: startScreenPos.x, y: startScreenPos.y };
    dragNodeStartPos = { x: node.position.x, y: node.position.y };

    function onMove(ev: MouseEvent) {
      const dx = (ev.clientX - dragStart.x) / props.viewport.zoom;
      const dy = (ev.clientY - dragStart.y) / props.viewport.zoom;
      const newPos = {
        x: dragNodeStartPos.x + dx,
        y: dragNodeStartPos.y + dy,
      };
      props.updateNodePosition(dragNodeId, newPos);
    }

    function onUp(ev: MouseEvent) {
      setIsDragging(false);
      const dx = (ev.clientX - dragStart.x) / props.viewport.zoom;
      const dy = (ev.clientY - dragStart.y) / props.viewport.zoom;
      const finalPos = {
        x: dragNodeStartPos.x + dx,
        y: dragNodeStartPos.y + dy,
      };
      props.onNodeDragEnd(dragNodeId, finalPos);
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
        // Check if we dropped on a handle
        const target = ev.target as HTMLElement;
        const handleEl = target.closest("[data-handle-type]") as HTMLElement | null;
        if (handleEl) {
          const targetNodeEl = handleEl.closest("[data-node-id]") as HTMLElement | null;
          if (targetNodeEl) {
            const targetNodeId = targetNodeEl.dataset.nodeId;
            if (targetNodeId && targetNodeId !== conn.sourceNodeId) {
              // Determine source and target based on handle types
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

    // Compute bounding box of all nodes
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

  // Cursor style
  const cursorStyle = () => {
    if (connecting()) return "crosshair";
    if (isPanning()) return "grabbing";
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
    >
      <FlowBackground viewport={props.viewport} />
      <FlowViewport panX={props.viewport.x} panY={props.viewport.y} zoom={props.viewport.zoom}>
        {/* SVG layer for edges */}
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
              .edge-animated {
                stroke-dasharray: 8 4;
                animation: edge-flow 0.6s linear infinite;
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
                      selected={props.selectedEdgeId === edge.id}
                      onSelect={props.onEdgeSelect}
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
        </svg>
        {/* HTML node layer */}
        <For each={[...props.nodes]}>
          {(node) => (
            <div data-node-id={node.id}>
              <FlowNode
                node={node}
                selected={props.selectedNodeId === node.id}
                onDragStart={handleNodeDragStart}
                onHandleMouseDown={handleHandleMouseDown}
                onNodeClick={props.onNodeSelect}
                onSizeChange={props.onNodeSizeChange}
              >
                <Switch>
                  <Match when={node.data.nodeType === "input_transform"}>
                    <InputTransformNode
                      data={node.data}
                      selected={props.selectedNodeId === node.id}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                  <Match when={node.data.nodeType === "desensitize"}>
                    <DesensitizeNode
                      data={node.data}
                      selected={props.selectedNodeId === node.id}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                  <Match when={node.data.nodeType === "model_call"}>
                    <ModelCallNode
                      data={node.data}
                      selected={props.selectedNodeId === node.id}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                  <Match when={node.data.nodeType === "restore"}>
                    <RestoreNode
                      data={node.data}
                      selected={props.selectedNodeId === node.id}
                      hasError={props.errorNodeIds.has(node.id)}
                    />
                  </Match>
                  <Match when={node.data.nodeType === "export"}>
                    <ExportNode
                      data={node.data}
                      selected={props.selectedNodeId === node.id}
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
    </div>
  );
}
