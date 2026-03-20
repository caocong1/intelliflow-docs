import { createMemo } from "solid-js";
import type { HandlePosition } from "../../../../lib/flow-engine/types";
import { getBezierPath } from "../../../../lib/flow-engine/edge-paths";

type TempEdgeProps = {
  sourcePos: { x: number; y: number };
  mousePos: { x: number; y: number };
  sourceHandlePos: HandlePosition;
};

export default function TempEdge(props: TempEdgeProps) {
  const pathData = createMemo(() => {
    // Use a bezier from source handle to mouse position
    // Target handle position is the opposite of source for natural curve
    const targetPos: HandlePosition =
      props.sourceHandlePos === "right" ? "left" :
      props.sourceHandlePos === "left" ? "right" :
      props.sourceHandlePos === "top" ? "bottom" : "top";

    return getBezierPath(
      props.sourcePos.x, props.sourcePos.y, props.sourceHandlePos,
      props.mousePos.x, props.mousePos.y, targetPos,
    );
  });

  return (
    <path
      d={pathData().path}
      stroke="#6366f1"
      stroke-width="2"
      stroke-dasharray="6 3"
      fill="none"
      style={{ "pointer-events": "none", opacity: "0.6" }}
    />
  );
}
