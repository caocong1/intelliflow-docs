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
    </>
  );
}
