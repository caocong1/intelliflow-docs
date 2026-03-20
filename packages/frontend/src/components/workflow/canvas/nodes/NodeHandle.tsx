import type { HandlePosition } from "../../../../lib/flow-engine/types";

type NodeHandleProps = {
  type: "source" | "target";
  position: HandlePosition;
  onMouseDown: (e: MouseEvent) => void;
};

function getPositionStyles(position: HandlePosition): Record<string, string> {
  switch (position) {
    case "top":
      return { top: "-6px", left: "50%", transform: "translateX(-50%)" };
    case "bottom":
      return { bottom: "-6px", left: "50%", transform: "translateX(-50%)" };
    case "left":
      return { left: "-6px", top: "50%", transform: "translateY(-50%)" };
    case "right":
      return { right: "-6px", top: "50%", transform: "translateY(-50%)" };
  }
}

export default function NodeHandle(props: NodeHandleProps) {
  return (
    <div
      class="w-3 h-3 rounded-full bg-gray-400 hover:bg-indigo-500 absolute z-10 transition-colors cursor-crosshair"
      style={getPositionStyles(props.position)}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        props.onMouseDown(e);
      }}
      data-handle-type={props.type}
      data-handle-position={props.position}
    />
  );
}
