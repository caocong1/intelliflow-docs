# 622eee2ab7e6e.pptx Slot-map Index

Source template: [`packages/backend/test-fixtures/ppt-mvp/622eee2ab7e6e.pptx`](../../../../../packages/backend/test-fixtures/ppt-mvp/622eee2ab7e6e.pptx)

Fixed section structure:

| Slides | Section header | Meaning |
|--------|---------------|---------|
| 1 | (cover) | Deck cover |
| 2 | 目录 | TOC |
| 3 | — | Section divider (PART/01) |
| 4–7 | 部门工作概述 | Section 1: overview |
| 8 | — | Section divider (PART/02) |
| 9–13 | 工作成果展示 | Section 2: results |
| 14 | — | Section divider (PART/03) |
| 15–18 | 存在不足之处 | Section 3: problems/gaps |
| 19 | — | Section divider (PART/04) |
| 20–24 | 未来工作规划 | Section 4: future plans |
| 25 | THANKS | Closing |

## 25-slide topology classification

Classified by `extract-template-layout-presets.ts`'s output — heuristic is: (1) count of "添加标题" placeholders, (2) repeated bbox groupings (x/y symmetry), (3) text shape count. Auto-generated, then hand-corrected for slides 1 and 25.

| idx | section | topology | text_slots | img | notes |
|-----|---------|----------|-----------|-----|-------|
| 1 | — | `cover_hero` | 5 | 2 | Cover — hero image + 2 pill labels |
| 2 | 目录 | `toc_list_4` | 10 | 1 | 4 rows × (number + title) |
| 3 | — | `section_divider` | 3 | 1 | PART/01 |
| 4 | 部门工作概述 | `repeat_2` | 7 | 1 | 2 items |
| 5 | 部门工作概述 | `row_3_cells` | 7 | 0 | 3-column content |
| 6 | 部门工作概述 | `grid_2x2_symmetric` | 6 | 0 | 4 symmetric quadrants, central decoration |
| 7 | 部门工作概述 | `repeat_3` | 5 | 0 | 3 items (1 left + 3 right stacked) |
| 8 | — | `section_divider` | 3 | 1 | PART/02 |
| 9 | 工作成果展示 | `row_3_cells` | 11 | 1 | 3-column with decoration |
| 10 | 工作成果展示 | `col_2_symmetric` | 14 | 0 | 2 symmetric columns, stats-heavy |
| 11 | 工作成果展示 | `repeat_2` | 7 | 0 | 2 items with percent bars |
| 12 | 工作成果展示 | `repeat_3` | 7 | 2 | 3 items with images |
| 13 | 工作成果展示 | `row_3_cells` | 7 | 0 | **3-cell A/B/C pill layout** — excellent for device triptych |
| 14 | — | `section_divider` | 3 | 1 | PART/03 |
| 15 | 存在不足之处 | `single_col_with_dual_image` | 5 | 2 | Single-col text + 2 side illustrations. **Not suitable for symmetric compare** |
| 16 | 存在不足之处 | `repeat_3` | 9 | 0 | 3 items with icons |
| 17 | 存在不足之处 | `grid_2x2_symmetric` | 5 | 0 | **4 symmetric quadrants** — used for p3 comparison |
| 18 | 存在不足之处 | `repeat_3` | 9 | 1 | 3 items with central SVG |
| 19 | — | `section_divider` | 3 | 1 | PART/04 |
| 20 | 未来工作规划 | `repeat_2` | 7 | 1 | 2 stacked items |
| 21 | 未来工作规划 | `row_4_cells` | 5 | 0 | **4-cell horizontal flow** — good for process/timeline |
| 22 | 未来工作规划 | `grid_2x2_symmetric` | 9 | 0 | 4 quadrants w/ richer content (9 text slots) |
| 23 | 未来工作规划 | `repeat_2` | 7 | 3 | 2 items with triple-image |
| 24 | 未来工作规划 | `repeat_4` | 9 | 0 | 4-item horizontal list |
| 25 | — | `closing` | 5 | 2 | THANKS closer |

## Recommended page_type → slide mapping

See also [`docs/design/ppt-three.md`](../../../ppt-three.md) §page_type-topology. **Current bindings for the wireless deck**:

| page | page_type | sourceSlide | topology | status |
|------|-----------|-------------|----------|--------|
| p1 | cover | 1 | `cover_hero` | ✅ done |
| p2 | toc | 2 | `toc_list_4` | ✅ done (8→4 grouped_merge) |
| p3 | comparison | **17** | `grid_2x2_symmetric` | ✅ done (was 15 — wrong topology, see `_deprecated/`) |
| p4 | timeline | ~~22~~ **TBD** | needs 5-node or 4+footer | 🟡 22 has grid_2x2 (4 cells) — would need 5→4+footer compression; consider slide 21 (`row_4_cells`) for cleaner linear timeline |
| p5 | process | 21 | `row_4_cells` | 🟡 planned — 4 cells for first 4 steps + footer strip for 5th |
| p6 | device_overview | ~~24~~ **TBD** | needs 3 cells | 🔴 24 is `repeat_4` (wrong cell count); **change to slide 13** which has true 3-cell A/B/C layout |

### Flagged issues

- p4 → slide 22: same grid_2x2 topology as p3 (slide 17) — would make two consecutive slides look structurally identical. Consider slide 21 (`row_4_cells`) which gives timeline a distinct horizontal flow. Session 4 decision.
- p6 → slide 24: `repeat_4` has 4 cells but wireless content has 3 devices. Slide 13 is a TRUE `row_3_cells` A/B/C layout — much better fit. Session 6 decision.

## Slot-map authoring workflow

Before authoring a new `slideN.slot-map.json`:

1. **Look up topology**: find slide N in the table above. Confirm the topology matches the `page_type` you need (see `ppt-three.md` §page_type-topology).
2. **Dump shapes**: `python3 -c "import json; d=json.load(open('/tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/layout-presets.json')); s=next(p for p in d['presets'] if p['slideIndex']==N); [print(sh) for sh in s['shapes']]"`
3. **Extract creationIds**: `unzip -p test-fixtures/ppt-mvp/622eee2ab7e6e.pptx ppt/slides/slideN.xml | grep -oE 'name="[^"]+".*creationId'` (or use the existing spike tooling).
4. **Author only the slots you're replacing** + any decorations you want to explicitly enumerate as a drift tripwire. Shapes not in slot-map are preserved implicitly.
5. **Validate**: `bun packages/backend/src/scripts/ppt-mvp/preserve/_validate-gate2.ts` (or integrate with fill-plan round-trip test).
6. **Build + preview**: `bun packages/backend/src/scripts/ppt-mvp/preserve/build-wireless-template-preserve.ts /tmp/out.pptx --strict` and `render-slide-preview.ts` to directional-check.
7. **Calibrate**: widen `maxWidthUnits`, add `minFontPt` and/or `widthStretchEmu` per the Session 3.1 A+B+C pattern.
