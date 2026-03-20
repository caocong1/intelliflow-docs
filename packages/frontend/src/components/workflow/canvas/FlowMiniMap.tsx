import { createMemo } from "solid-js";
import type { FlowNodeData, FlowEdgeData, Viewport } from "../../../lib/flow-engine/types";
import type { WorkflowNodeType } from "@intelliflow/shared";

const NODE_TYPE_COLORS: Record<WorkflowNodeType, string> = {
  input_transform: "#3b82f6",
  desensitize: "#f97316",
  model_call: "#a855f7",
  restore: "#22c55e",
  export: "#ef4444",
};

type FlowMiniMapProps = {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  viewport: Viewport;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange: (viewport: Viewport) => void;
};

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const PADDING = 50;

export default function FlowMiniMap(props: FlowMiniMapProps) {
  // Compute bounding box of all nodes with padding
  const bounds = createMemo(() => {
    if (props.nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
    }

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

    return {
      minX: minX - PADDING,
      minY: minY - PADDING,
      maxX: maxX + PADDING,
      maxY: maxY + PADDING,
    };
  });

  // Scale factor to fit bounding box into minimap
  const scale = createMemo(() => {
    const b = bounds();
    const contentWidth = b.maxX - b.minX;
    const contentHeight = b.maxY - b.minY;
    if (contentWidth <= 0 || contentHeight <= 0) return 1;
    return Math.min(MINIMAP_WIDTH / contentWidth, MINIMAP_HEIGHT / contentHeight);
  });

  // Transform flow coordinates to minimap coordinates
  function toMinimap(x: number, y: number) {
    const b = bounds();
    const s = scale();
    return {
      x: (x - b.minX) * s,
      y: (y - b.minY) * s,
    };
  }

  // Viewport indicator rectangle in minimap coordinates
  const viewportRect = createMemo(() => {
    const s = scale();
    const v = props.viewport;
    const cw = props.canvasWidth;
    const ch = props.canvasHeight;

    // The visible area in flow coordinates:
    // flow_x = (screen_x - viewport.x) / viewport.zoom
    const flowLeft = -v.x / v.zoom;
    const flowTop = -v.y / v.zoom;
    const flowWidth = cw / v.zoom;
    const flowHeight = ch / v.zoom;

    const topLeft = toMinimap(flowLeft, flowTop);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: flowWidth * s,
      height: flowHeight * s,
    };
  });

  // Node center position lookup for edges
  function getNodeCenter(nodeId: string) {
    const node = props.nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    return toMinimap(
      node.position.x + node.size.width / 2,
      node.position.y + node.size.height / 2,
    );
  }

  function handleClick(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert minimap click to flow coordinates
    const b = bounds();
    const s = scale();
    const flowX = clickX / s + b.minX;
    const flowY = clickY / s + b.minY;

    // Center the viewport on this flow position
    const cw = props.canvasWidth;
    const ch = props.canvasHeight;
    const z = props.viewport.zoom;
    const newX = cw / 2 - flowX * z;
    const newY = ch / 2 - flowY * z;

    props.onViewportChange({ x: newX, y: newY, zoom: z });
  }

  return (
    <div
      class="absolute bottom-4 right-4 z-20 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden"
      style={{ width: `${MINIMAP_WIDTH}px`, height: `${MINIMAP_HEIGHT}px` }}
    >
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        style={{ cursor: "pointer" }}
        onClick={handleClick}
      >
        {/* Edge lines */}
        {[...props.edges].map((edge) => {
          const source = getNodeCenter(edge.source);
          const target = getNodeCenter(edge.target);
          if (!source || !target) return null;
          return (
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="#94a3b8"
              stroke-width="1"
            />
          );
        })}

        {/* Node rectangles colored by type */}
        {[...props.nodes].map((node) => {
          const pos = toMinimap(node.position.x, node.position.y);
          const s = scale();
          const w = Math.max(node.size.width * s, 4);
          const h = Math.max(node.size.height * s, 3);
          const color = NODE_TYPE_COLORS[node.data.nodeType] || "#6b7280";
          return (
            <rect
              x={pos.x}
              y={pos.y}
              width={w}
              height={h}
              rx="1"
              fill={color}
              opacity="0.9"
            />
          );
        })}

        {/* Viewport indicator */}
        {(() => {
          const vr = viewportRect();
          return (
            <rect
              x={vr.x}
              y={vr.y}
              width={vr.width}
              height={vr.height}
              fill="rgba(99, 102, 241, 0.1)"
              stroke="#6366f1"
              stroke-width="1.5"
              rx="1"
            />
          );
        })()}
      </svg>
    </div>
  );
}
