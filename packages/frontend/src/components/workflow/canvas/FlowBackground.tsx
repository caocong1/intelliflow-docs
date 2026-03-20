import type { Viewport } from "../../../lib/flow-engine/types";

type FlowBackgroundProps = {
  viewport: Viewport;
};

export default function FlowBackground(props: FlowBackgroundProps) {
  const patternSize = 20;

  const offsetX = () => props.viewport.x % (patternSize * props.viewport.zoom);
  const offsetY = () => props.viewport.y % (patternSize * props.viewport.zoom);
  const scaledSize = () => patternSize * props.viewport.zoom;

  return (
    <svg
      class="absolute inset-0 w-full h-full"
      style={{ "pointer-events": "none" }}
    >
      <defs>
        <pattern
          id="flow-bg-dots"
          x={offsetX()}
          y={offsetY()}
          width={scaledSize()}
          height={scaledSize()}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={scaledSize() / 2}
            cy={scaledSize() / 2}
            r={1}
            fill="#cbd5e1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#f8fafc" />
      <rect width="100%" height="100%" fill="url(#flow-bg-dots)" />
    </svg>
  );
}
