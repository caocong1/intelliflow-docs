/**
 * Neighbor-aware safe-stretch computation for preserve mode.
 *
 * When a slot declares `widthStretchEmu` or `heightStretchEmu`, the stretched
 * bbox might collide with adjacent shapes. This module:
 *   - parses the target slide's XML to collect every shape's absolute bbox
 *   - for each stretched slot, finds the nearest neighbor shape on the
 *     growth direction (right for width, down for height) and returns the
 *     maximum safe delta
 *   - flags conflicts BEFORE automizer applies the transform
 *
 * Keep intentionally simple: uses regex over slide XML (not a full DOM
 * walk with group-transform math), so the bboxes are local-to-parent-group
 * for grouped shapes. Good enough for detecting obvious top-level conflicts
 * (preserve-mode's typical use case).
 */

export type ShapeBbox = {
  name: string;
  creationId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Extracts top-level shape bboxes from slide XML. Regex-based, ignores groups. */
export function extractSlideBboxes(slideXml: string): ShapeBbox[] {
  const out: ShapeBbox[] = [];
  // Find <p:sp> and <p:pic> blocks with their xfrm.
  const re = /<p:(sp|pic)\b[\s\S]*?<\/p:\1>/g;
  for (const m of slideXml.matchAll(re)) {
    const block = m[0];
    const nameMatch = block.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/);
    const cidMatch = block.match(/<a16:creationId\b[^>]*\bid="\{([^}]+)\}"/);
    const xfrmMatch = block.match(
      /<p:spPr\b[^>]*>[\s\S]*?<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/,
    );
    if (!xfrmMatch) continue;
    const off = xfrmMatch[1].match(/<a:off\s+x="(\d+)"\s+y="(\d+)"\s*\/>/);
    const ext = xfrmMatch[1].match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
    if (!off || !ext) continue;
    out.push({
      name: nameMatch?.[1] ?? "",
      creationId: cidMatch?.[1],
      x: Number(off[1]),
      y: Number(off[2]),
      w: Number(ext[1]),
      h: Number(ext[2]),
    });
  }
  return out;
}

export type StretchConflict = {
  slotCreationId: string;
  slotName: string;
  direction: "x" | "y";
  requestedDeltaEmu: number;
  maxSafeDeltaEmu: number;
  conflictingShape: { name: string; x: number; y: number };
};

/**
 * For a given slot and a requested stretch in EMU, compute the maximum
 * safe delta before it would overlap another shape on that axis.
 *
 * A shape is considered on the growth path if:
 *   - direction "x": its y range overlaps the slot's y range AND its x > slot.x+slot.w
 *   - direction "y": its x range overlaps the slot's x range AND its y > slot.y+slot.h
 */
export function computeSafeStretch(
  slot: ShapeBbox,
  allShapes: ShapeBbox[],
  direction: "x" | "y",
  requestedDeltaEmu: number,
): StretchConflict | null {
  if (requestedDeltaEmu <= 0) return null;
  const slotRight = slot.x + slot.w;
  const slotBottom = slot.y + slot.h;

  let minGap = Number.POSITIVE_INFINITY;
  let conflict: ShapeBbox | null = null;

  for (const other of allShapes) {
    if (other.creationId && other.creationId === slot.creationId) continue;
    if (direction === "x") {
      // Y-range overlap test.
      const yOverlap = other.y < slotBottom && other.y + other.h > slot.y;
      if (!yOverlap) continue;
      if (other.x <= slotRight) continue;
      const gap = other.x - slotRight;
      if (gap < minGap) {
        minGap = gap;
        conflict = other;
      }
    } else {
      const xOverlap = other.x < slotRight && other.x + other.w > slot.x;
      if (!xOverlap) continue;
      if (other.y <= slotBottom) continue;
      const gap = other.y - slotBottom;
      if (gap < minGap) {
        minGap = gap;
        conflict = other;
      }
    }
  }

  // Use a small safety margin (~50000 EMU ≈ 0.05cm) so stretched shape doesn't
  // butt up against its neighbor.
  const MARGIN = 50_000;
  const maxSafe = Math.max(0, minGap - MARGIN);

  if (requestedDeltaEmu <= maxSafe) return null;

  return {
    slotCreationId: slot.creationId ?? "",
    slotName: slot.name,
    direction,
    requestedDeltaEmu,
    maxSafeDeltaEmu: maxSafe === Number.POSITIVE_INFINITY ? requestedDeltaEmu : maxSafe,
    conflictingShape: conflict
      ? { name: conflict.name, x: conflict.x, y: conflict.y }
      : { name: "(slide boundary or unknown)", x: 0, y: 0 },
  };
}
