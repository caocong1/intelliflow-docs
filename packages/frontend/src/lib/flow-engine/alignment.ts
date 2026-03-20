/**
 * Alignment guide computation for node drag snapping.
 * Computes horizontal and vertical alignment guides between a dragging node
 * and all other nodes, with configurable snap threshold.
 */

export type Guide = {
  /** "vertical" means a vertical line at position X; "horizontal" means a horizontal line at position Y */
  type: "vertical" | "horizontal";
  /** The coordinate (X for vertical, Y for horizontal) */
  position: number;
};

export type AlignmentResult = {
  guides: Guide[];
  snappedX: number | null;
  snappedY: number | null;
};

type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Compute alignment guides for a dragging node against all other nodes.
 * Returns guides to display and snapped positions if within threshold.
 */
export function computeAlignmentGuides(
  draggingNode: NodeRect,
  otherNodes: NodeRect[],
  threshold = 5,
): AlignmentResult {
  const guides: Guide[] = [];
  let snappedX: number | null = null;
  let snappedY: number | null = null;
  let bestDx = threshold + 1;
  let bestDy = threshold + 1;

  const dragLeft = draggingNode.x;
  const dragRight = draggingNode.x + draggingNode.width;
  const dragCenterX = draggingNode.x + draggingNode.width / 2;
  const dragTop = draggingNode.y;
  const dragBottom = draggingNode.y + draggingNode.height;
  const dragCenterY = draggingNode.y + draggingNode.height / 2;

  for (const other of otherNodes) {
    const otherLeft = other.x;
    const otherRight = other.x + other.width;
    const otherCenterX = other.x + other.width / 2;
    const otherTop = other.y;
    const otherBottom = other.y + other.height;
    const otherCenterY = other.y + other.height / 2;

    // Vertical guides (X axis alignment)
    const xChecks = [
      { dragVal: dragLeft, otherVal: otherLeft },      // left-left
      { dragVal: dragLeft, otherVal: otherRight },     // left-right
      { dragVal: dragRight, otherVal: otherLeft },     // right-left
      { dragVal: dragRight, otherVal: otherRight },    // right-right
      { dragVal: dragCenterX, otherVal: otherCenterX }, // center-center
    ];

    for (const check of xChecks) {
      const dx = Math.abs(check.dragVal - check.otherVal);
      if (dx <= threshold && dx < bestDx) {
        bestDx = dx;
        // Snap: adjust dragging node X so dragVal aligns with otherVal
        snappedX = draggingNode.x + (check.otherVal - check.dragVal);
        // Clear old vertical guides and add new one
        const vIdx = guides.findIndex((g) => g.type === "vertical");
        if (vIdx >= 0) guides.splice(vIdx, guides.length);
        guides.push({ type: "vertical", position: check.otherVal });
      } else if (dx <= threshold && dx === bestDx) {
        guides.push({ type: "vertical", position: check.otherVal });
      }
    }

    // Horizontal guides (Y axis alignment)
    const yChecks = [
      { dragVal: dragTop, otherVal: otherTop },        // top-top
      { dragVal: dragTop, otherVal: otherBottom },     // top-bottom
      { dragVal: dragBottom, otherVal: otherTop },     // bottom-top
      { dragVal: dragBottom, otherVal: otherBottom },  // bottom-bottom
      { dragVal: dragCenterY, otherVal: otherCenterY }, // center-center
    ];

    for (const check of yChecks) {
      const dy = Math.abs(check.dragVal - check.otherVal);
      if (dy <= threshold && dy < bestDy) {
        bestDy = dy;
        snappedY = draggingNode.y + (check.otherVal - check.dragVal);
        const hIdx = guides.findIndex((g) => g.type === "horizontal");
        if (hIdx >= 0) guides.splice(hIdx, guides.length);
        guides.push({ type: "horizontal", position: check.otherVal });
      } else if (dy <= threshold && dy === bestDy) {
        guides.push({ type: "horizontal", position: check.otherVal });
      }
    }
  }

  // Deduplicate guides
  const uniqueGuides: Guide[] = [];
  const seen = new Set<string>();
  for (const g of guides) {
    const key = `${g.type}:${g.position}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueGuides.push(g);
    }
  }

  return { guides: uniqueGuides, snappedX, snappedY };
}
