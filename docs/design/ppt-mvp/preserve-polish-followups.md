# Preserve Mode — Polish Follow-ups

Status: **Open**. These items block a "visually polished" release but don't block the code-complete checkpoint at commit a9b02a5.

Collected during Sessions 1–6. Resolve based on real-machine PowerPoint screenshots.

## Known visual gaps (per-page)

### p1 cover (slide 26)
Previously seen issues fixed in Session 1.1/3.1 (title + pill_1 pre-compressed to avoid LLM). **No open issues** based on v6 screenshot. Final visual verification in Parallels PowerPoint still recommended.

### p2 TOC (slide 27)
Previously verified. **No open issues** based on v1 screenshot.

### p3 comparison (slide 28, 2×2)
From Session 3.2 screenshot (v7) — structurally correct. Possible polish:
- [ ] Section title "无线与有线网络核心对比" still wraps to 2 lines at 20pt; consider narrower title or further font shrink
- [ ] quad_bl_bullets / quad_br_bullets may collide with center-image decoration in real PowerPoint (my preview's grouped-shape renderer is approximate)

### p4 timeline (slide 29, row_4_cells)
v1234 preview looks clean. **No open issues** reported yet.
- [ ] Verify section_title doesn't overflow in real PowerPoint ("无线网络技术发展历程" = 20 units)

### p5 process (slide 30, 2×2 pairs)
v12345 preview looks clean. Same-topology-as-p3 caveat:
- [ ] Back-to-back p3 + p5 = two 2×2 grids in a row. Consider visual differentiation (color accent, or re-map p5 to a non-grid layout in a future template)

### p6 device (slide 31, 3-cell A/B/C)
all6 preview looks clean. **No open issues** reported yet.
- [ ] Each cell bbox w=2331650, tight for "客房 / 小会议室" (9 units). Verify no wrap in real PowerPoint

## Cross-page polish

- [ ] **Hero image for HTML POC**: `docs/design/ppt-mvp/html-styles/622eee2ab7e6e/cover-hero.jpg` doesn't exist — the HTML page references it but the file isn't staged. Extract from `packages/backend/test-fixtures/ppt-mvp/622eee2ab7e6e.pptx` (media/image1.jpg is the slide 1 hero per original layout-presets) and drop into html-styles folder.
- [ ] **LLM rewrite timeout hardening**: observed 120s per-call AbortSignal sometimes fires on slow network. Either bump to 180s, or add parallel batching (fire all over-budget slots' rewrites concurrently) so total sequence time doesn't accumulate.
- [ ] **Preview fidelity**: my `render-slide-preview.ts` uses PingFang SC; real PPT uses 思源宋体 CN (slightly narrower). Consider bundling 思源宋体 CN woff2 + referencing via `@font-face` in the HTML output for a more accurate directional preview.

## Architectural polish

- [ ] **Topology refinement**: slide 22's `grid_2x2_symmetric` is visually identical to slide 17's but semantically different (pairs of title+desc vs single text cells). Consider splitting into `grid_2x2_pairs` vs `grid_2x2_uniform` — requires expanding the TOPOLOGIES enum and re-classifying in extract-template-layout-presets.
- [ ] **Auto-generated slide-map boilerplate**: the 9-slot enumeration for slide 22 was repetitive. Consider a codegen helper that takes the shape-dump output + a topology hint and emits a slot-map skeleton to fill in manually.
- [ ] **Image replacement**: deferred from Session 3. All image slots currently `preserve`-only. When ready, wire `modify.setRelationTarget` + `automizer.loadMedia` for the `replace_image` strategy (already declared in schema, just not implemented in builder's switch).
- [ ] **grouped_merge strategy**: currently the fill-plan author does the merge manually (p2 TOC 8→4, p4 timeline 5→4 era-merge). The strategy is declared in schema but not enforced by builder. Either implement or remove.

## Runtime integration

- [ ] Wire [preserve/runtime-adapter.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/runtime-adapter.ts) into `packages/backend/src/modules/runtime/export.service.ts`'s dispatch switch. Requires: DB schema addition for `ppt_templates.type="preserve_slot_map"` + `preserveConfig` JSON column. Scaffolding ready; blocked on DB migration sequencing.
- [ ] `build-wireless-template-preserve.ts` currently hardcodes the 622eee2ab7e6e wireless fill-plan. For the runtime path, the adapter accepts arbitrary fill-plan paths — good. But fill-plan authoring is still manual per template/deck combo. Consider: UI to pick a template + enter content → backend auto-generates a minimal fill-plan.

## HTML fidelity line (P1 priority)

- [ ] Extract hero image from 622eee2ab7e6e.pptx media and stage at `html-styles/622eee2ab7e6e/cover-hero.jpg`
- [ ] LLM roundtrip: feed `html-styles/<template>/<section>.html` + page content to Claude/Kimi, parse `html_to_ppt_fill_plan/v1` from response, compile to PNG
- [ ] Compare cover PNG (HTML-rendered) vs cover PPT (preserve-rendered) side-by-side; pick winner per page
- [ ] Extend to p2/p3 if cover wins
