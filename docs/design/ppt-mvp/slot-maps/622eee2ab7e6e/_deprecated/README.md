# Deprecated slot-maps

Slot-maps in this folder were authored against wrong-topology slides. They live here as lessons, not as active mappings.

## slide15.slot-map.json

**Deprecated** (2026-04-20).

**Reason**: Slide 15 is a `single_col_with_dual_image` topology (single left-column text + 2 supporting illustrations + wide top description bar). The original `ppt-three.md` plan mapped `p3 comparison → slide 15` without checking the actual layout; assumed "slide with 2 images = comparison" without verifying content symmetry.

The wireless `comparison` page type needs a symmetric 2-column (or 2×2) layout so left/right bullets have equal visual weight. Slide 15's geometry forced awkward compromises:

- Left bullets fit into the single left-column text slot
- Right bullets had to be compressed into a wide horizontal "top description" bar (visually looked like a caption, not a peer column)
- Decorative images stayed unchanged, covering visual space that a true comparison would use for symmetric content

**Replacement**: p3 now maps to [slide 17](../slide17.slot-map.json), which has topology `grid_2x2_symmetric` — 4 symmetric text quadrants that cleanly host `{LEFT title, RIGHT title, LEFT bullets, RIGHT bullets}`.

**Lesson**: See [`docs/design/ppt-three.md`](../../../../ppt-three.md) §"page_type → expected topology" — future page→slide mappings MUST go through topology classification first.
