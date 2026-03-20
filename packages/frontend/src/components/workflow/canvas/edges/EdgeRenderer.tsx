import { createMemo, createSignal, Show } from "solid-js";
import type { FlowEdgeData, HandlePosition } from "../../../../lib/flow-engine/types";
import { getBezierPath, getStraightPath, getStepPath } from "../../../../lib/flow-engine/edge-paths";

type EdgeRendererProps = {
  edge: FlowEdgeData;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
  sourceHandlePos: HandlePosition;
  targetHandlePos: HandlePosition;
  selected: boolean;
  onSelect: (id: string) => void;
  onUpdateControlPoints?: (edgeId: string, controlPoints: Array<{ x: number; y: number }> | undefined) => void;
  screenToFlow?: (clientX: number, clientY: number) => { x: number; y: number };
};

export default function EdgeRenderer(props: EdgeRendererProps) {
  const [hovered, setHovered] = createSignal(false);
  const [draggingMidpoint, setDraggingMidpoint] = createSignal(false);

  const pathData = createMemo(() => {
    const cp = props.edge.controlPoints;
    switch (props.edge.type) {
      case "bezier":
        return getBezierPath(
          props.sourcePos.x, props.sourcePos.y, props.sourceHandlePos,
          props.targetPos.x, props.targetPos.y, props.targetHandlePos,
          0.25, cp,
        );
      case "straight":
        return getStraightPath(
          props.sourcePos.x, props.sourcePos.y,
          props.targetPos.x, props.targetPos.y,
        );
      case "step":
        return getStepPath(
          props.sourcePos.x, props.sourcePos.y, props.sourceHandlePos,
          props.targetPos.x, props.targetPos.y, props.targetHandlePos,
          20, cp,
        );
      default:
        return getBezierPath(
          props.sourcePos.x, props.sourcePos.y, props.sourceHandlePos,
          props.targetPos.x, props.targetPos.y, props.targetHandlePos,
          0.25, cp,
        );
    }
  });

  const markerId = () => `arrow-${props.edge.id}`;
  const glowFilterId = () => `glow-${props.edge.id}`;
  const strokeColor = () => props.selected ? "#4f46e5" : "#6366f1";
  const showMidpoint = () => (hovered() || props.selected) && props.edge.type !== "straight";

  // Midpoint drag handlers
  function handleMidpointMouseDown(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!props.onUpdateControlPoints || !props.screenToFlow) return;

    setDraggingMidpoint(true);

    const onMove = (ev: MouseEvent) => {
      if (!props.screenToFlow) return;
      const flowPos = props.screenToFlow(ev.clientX, ev.clientY);

      // Compute new control points based on edge type
      if (props.edge.type === "bezier") {
        // Symmetric control points around the drag position
        const sx = props.sourcePos.x;
        const sy = props.sourcePos.y;
        const tx = props.targetPos.x;
        const ty = props.targetPos.y;
        const cp1 = { x: sx + (flowPos.x - sx) * 0.5 + (flowPos.x - (sx + tx) / 2), y: flowPos.y };
        const cp2 = { x: tx + (flowPos.x - tx) * 0.5 + (flowPos.x - (sx + tx) / 2), y: flowPos.y };
        props.onUpdateControlPoints?.(props.edge.id, [cp1, cp2]);
      } else if (props.edge.type === "step") {
        props.onUpdateControlPoints?.(props.edge.id, [{ x: flowPos.x, y: flowPos.y }]);
      }
    };

    const onUp = () => {
      setDraggingMidpoint(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleMidpointDblClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    // Reset control points to auto-calculated
    props.onUpdateControlPoints?.(props.edge.id, undefined);
  }

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => !draggingMidpoint() && setHovered(false)}
    >
      <defs>
        <marker
          id={markerId()}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor()} />
        </marker>
        {/* Glow filter for selected edges */}
        <Show when={props.selected}>
          <filter id={glowFilterId()} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </Show>
      </defs>
      {/* Wide invisible hit area for click */}
      <path
        d={pathData().path}
        stroke="transparent"
        stroke-width="12"
        fill="none"
        style={{ cursor: "pointer", "pointer-events": "stroke" }}
        onClick={(e) => {
          e.stopPropagation();
          props.onSelect(props.edge.id);
        }}
      />
      {/* Visible edge path */}
      <path
        d={pathData().path}
        stroke={strokeColor()}
        stroke-width={props.selected ? "3" : "2"}
        fill="none"
        marker-end={`url(#${markerId()})`}
        class="edge-animated"
        style={{ "pointer-events": "none" }}
        filter={props.selected ? `url(#${glowFilterId()})` : undefined}
      />
      {/* Midpoint drag handle */}
      <Show when={showMidpoint()}>
        <circle
          cx={pathData().labelX}
          cy={pathData().labelY}
          r={6}
          fill="white"
          stroke="#6366f1"
          stroke-width={2}
          style={{
            cursor: draggingMidpoint() ? "grabbing" : "grab",
            "pointer-events": "all",
            transition: "r 150ms ease",
          }}
          onMouseDown={handleMidpointMouseDown}
          onDblClick={handleMidpointDblClick}
        />
      </Show>
    </g>
  );
}
