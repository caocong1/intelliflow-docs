import { createMemo } from "solid-js";
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
};

export default function EdgeRenderer(props: EdgeRendererProps) {
  const pathData = createMemo(() => {
    switch (props.edge.type) {
      case "bezier":
        return getBezierPath(
          props.sourcePos.x, props.sourcePos.y, props.sourceHandlePos,
          props.targetPos.x, props.targetPos.y, props.targetHandlePos,
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
        );
      default:
        return getBezierPath(
          props.sourcePos.x, props.sourcePos.y, props.sourceHandlePos,
          props.targetPos.x, props.targetPos.y, props.targetHandlePos,
        );
    }
  });

  const markerId = () => `arrow-${props.edge.id}`;
  const strokeColor = () => props.selected ? "#4f46e5" : "#6366f1";

  return (
    <g>
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
      />
    </g>
  );
}
