import { Show } from "solid-js";
import { BaseEdge, getBezierPath, type EdgeProps } from "@dschz/solid-flow";

export default function DataFlowEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition as Parameters<typeof getBezierPath>[0]["sourcePosition"],
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition as Parameters<typeof getBezierPath>[0]["targetPosition"],
  });

  const markerId = `dataflow-arrow-${props.id}`;

  return (
    <>
      {/* Arrow marker definition */}
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="#6366f1"
          />
        </marker>
      </defs>

      <BaseEdge
        path={path}
        labelX={labelX}
        labelY={labelY}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: "#6366f1",
          "stroke-width": "2",
        }}
        label={props.label}
        labelStyle={props.labelStyle}
      />

      {/* Data flow label at edge midpoint — shows output names from source node */}
      <Show when={props.label}>
        <foreignObject
          x={labelX - 60}
          y={labelY - 12}
          width="120"
          height="24"
          style={{ "pointer-events": "none", overflow: "visible" }}
        >
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "100%",
              height: "100%",
            }}
          >
            <span
              style={{
                background: "rgba(99,102,241,0.08)",
                color: "#6366f1",
                "font-size": "10px",
                "font-weight": "500",
                padding: "2px 6px",
                "border-radius": "4px",
                border: "1px solid rgba(99,102,241,0.2)",
                "white-space": "nowrap",
                "max-width": "110px",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                display: "block",
              }}
            >
              {props.label as string}
            </span>
          </div>
        </foreignObject>
      </Show>
    </>
  );
}
