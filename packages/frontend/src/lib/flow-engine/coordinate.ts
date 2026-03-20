import type { Viewport, HandlePosition } from "./types";

/**
 * Convert screen coordinates (mouse clientX/Y) to flow coordinates.
 */
export function screenToFlow(
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (screenX - canvasRect.left - viewport.x) / viewport.zoom,
    y: (screenY - canvasRect.top - viewport.y) / viewport.zoom,
  };
}

/**
 * Convert flow coordinates to screen coordinates.
 */
export function flowToScreen(
  flowX: number,
  flowY: number,
  canvasRect: DOMRect,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: flowX * viewport.zoom + viewport.x + canvasRect.left,
    y: flowY * viewport.zoom + viewport.y + canvasRect.top,
  };
}

/**
 * Get the absolute flow-space position of a handle on a node.
 * Used for computing edge endpoint positions.
 */
export function getHandlePosition(
  nodePos: { x: number; y: number },
  nodeSize: { width: number; height: number },
  side: HandlePosition,
): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: nodePos.x + nodeSize.width / 2, y: nodePos.y };
    case "bottom":
      return { x: nodePos.x + nodeSize.width / 2, y: nodePos.y + nodeSize.height };
    case "left":
      return { x: nodePos.x, y: nodePos.y + nodeSize.height / 2 };
    case "right":
      return { x: nodePos.x + nodeSize.width, y: nodePos.y + nodeSize.height / 2 };
  }
}
