import type { HandlePosition, PathResult } from "./types";

/**
 * Compute control point offset based on handle position direction.
 */
function getControlPoint(
  x: number,
  y: number,
  position: HandlePosition,
  offset: number,
): [number, number] {
  switch (position) {
    case "top":
      return [x, y - offset];
    case "bottom":
      return [x, y + offset];
    case "left":
      return [x - offset, y];
    case "right":
      return [x + offset, y];
  }
}

/**
 * Generate a cubic bezier SVG path between two handle positions.
 * If controlPoints are provided, use them instead of auto-calculated ones.
 */
export function getBezierPath(
  sourceX: number,
  sourceY: number,
  sourcePosition: HandlePosition,
  targetX: number,
  targetY: number,
  targetPosition: HandlePosition,
  curvature = 0.25,
  controlPoints?: Array<{ x: number; y: number }>,
): PathResult {
  let scx: number;
  let scy: number;
  let tcx: number;
  let tcy: number;

  if (controlPoints && controlPoints.length >= 2) {
    scx = controlPoints[0].x;
    scy = controlPoints[0].y;
    tcx = controlPoints[1].x;
    tcy = controlPoints[1].y;
  } else {
    const dx = Math.abs(targetX - sourceX);
    const dy = Math.abs(targetY - sourceY);
    const offset = Math.max(dx, dy) * curvature;
    [scx, scy] = getControlPoint(sourceX, sourceY, sourcePosition, offset);
    [tcx, tcy] = getControlPoint(targetX, targetY, targetPosition, offset);
  }

  const path = `M ${sourceX},${sourceY} C ${scx},${scy} ${tcx},${tcy} ${targetX},${targetY}`;
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  return { path, labelX, labelY };
}

/**
 * Generate a straight line SVG path between two points.
 */
export function getStraightPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): PathResult {
  const path = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  return { path, labelX, labelY };
}

/**
 * Generate an orthogonal step (L-shaped or Z-shaped) SVG path.
 */
export function getStepPath(
  sourceX: number,
  sourceY: number,
  sourcePosition: HandlePosition,
  targetX: number,
  targetY: number,
  _targetPosition: HandlePosition,
  _padding = 20,
  controlPoints?: Array<{ x: number; y: number }>,
): PathResult {
  // For horizontal flow (right->left), route via midpoint X
  // For vertical flow (bottom->top), route via midpoint Y
  const isHorizontal = sourcePosition === "right" || sourcePosition === "left";

  let path: string;
  let labelX: number;
  let labelY: number;

  if (isHorizontal) {
    const midX = controlPoints?.[0]?.x ?? (sourceX + targetX) / 2;
    path = `M ${sourceX},${sourceY} L ${midX},${sourceY} L ${midX},${targetY} L ${targetX},${targetY}`;
    labelX = midX;
    labelY = (sourceY + targetY) / 2;
  } else {
    const midY = controlPoints?.[0]?.y ?? (sourceY + targetY) / 2;
    path = `M ${sourceX},${sourceY} L ${sourceX},${midY} L ${targetX},${midY} L ${targetX},${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = midY;
  }

  return { path, labelX, labelY };
}
