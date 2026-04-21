# HTML Line Consolidation Plan

**Goal**: Make the HTML-fidelity rendering line (线 2) capable of fully replacing the AI-native archetype/style-pack renderer (线 3), in staged phases, without breaking the default production path until line 2 reaches parity.

**Non-goal**: Touch the template-preserve line (线 1). That line has a different trade-off (reuse user's imported .pptx 100% verbatim) and remains independently valuable.

---

## Current state snapshot (2026-04-21)

### Line 3 (archetype / style-pack) — currently production default

Location: `packages/backend/src/modules/runtime/`
- `ppt-archetype-renderer.ts` — pptxgenjs-driven per-archetype renderers
- `ppt-style-packs.ts` — color/font pack variants
- `ppt-deck-composition.ts` — markdown → structured Slide[] + semantic role scoring
- `export.service.buildDeckComposition` — markdown → AI or rules composition

Archetypes covered (~12): cover_hero / cover_split / toc_grid / toc_vertical / section_divider / comparison_split / timeline_horizontal / table_clean / summary_cards / qna_centered / closing_minimal / feature_grid / bullet_story

Input tolerance: any markdown string + optional native template profile.

Render cost: ~10ms per slide (pure pptxgenjs, no external).

### Line 2 (html-fidelity) — this session's work

Location: `packages/backend/src/{modules/runtime,scripts/ppt-mvp/preserve}/`
- Runtime surface: `modules/runtime/html-editable-adapter.ts` + dispatch in `export.service.generatePptBuffer`
- Pipeline: `scripts/ppt-mvp/preserve/html-{roundtrip,to-editable-pptx}.ts`
- Template family (622eee2ab7e6e): 6 HTML files — cover / toc / comparison / timeline / process / device
- Upstream composer: `html-styles/622eee2ab7e6e/outline-to-deck.prompt.md`
- Content contract: `html_fidelity_deck/v1`

Archetypes covered: 6 (the ones listed above).

Input tolerance: requires structured `html_fidelity_deck/v1` JSON. Cannot eat raw markdown directly.

Render cost: 10–30s per slide (LLM fill-plan + Chrome × 2).

---

## Phased consolidation

### Phase 1 — Co-existence with clear triggering (done today)

Status: **✅ Done**. Dispatch in `generatePptBuffer` routes by content version
signature:

```
1. parsePptSceneContent      → ppt-scene branch (user's uncommitted line, orthogonal)
2. parseHtmlFidelityDeckContent → line 2
3. (default) legacy templateId or style-pack → line 3
```

Deliverable this session:
- `outline-to-deck.prompt.md` — lets any `model_call` node upstream produce the JSON line 2 expects
- Adapter test coverage (8 tests)

### Phase 2 — Coverage expansion (next, 2–3 sessions)

**Goal**: bring line 2 from 6 authored templates to at least 12 — every archetype line 3 emits.

Missing templates to author under `docs/design/ppt-mvp/html-styles/622eee2ab7e6e/`:

| Priority | File | Archetype analog (line 3) | Notes |
|---|---|---|---|
| P0 | `feature_grid.html` | `feature_grid` | 2×2 or 3-column feature blocks. Very common in product decks. |
| P0 | `summary.html` | `summary_cards` | Closing-ish takeaway, 3-cluster card set. |
| P1 | `section_break.html` | `section_divider` | Big number + chapter name, used between content sections. |
| P1 | `image_focus.html` | `image_focus` | One dominant image + caption band. Needs asset-binding design. |
| P1 | `closing.html` | `closing_minimal` | "谢谢" + author/contact block. |
| P2 | `table.html` | `table_clean` | Headers + rows; needs variable column count. |
| P2 | `qna.html` | `qna_centered` | Q/A pairs, typically 1 big question. |

Per-template deliverable checklist:
- HTML file with `data-region` + budgets
- Live roundtrip verified (PNG preview)
- Entry in `outline-to-deck.prompt.md` template catalog + selection rules
- `templateToRole` map updated in `html-editable-adapter.ts`
- 6-page integration test in `html-editable-adapter.test.ts` becomes 12-page

**Exit criteria**:
- 12+ HTML templates authored and live-verified
- `outline-to-deck.prompt.md` covers the full archetype catalog
- `html-editable-adapter.test.ts` builds a 12-slide deck from fixtures without retry/timeouts

### Phase 3 — Close the performance gap (1 session)

**Goal**: reduce 6-page editable-deck render time from 60–180s (sequential) to ≤15s.

Tactics:

1. **Parallelize** the per-page pipeline in `renderHtmlFidelityDeckToBuffer`.
   - Currently `for (const page of deck.pages)` is serial.
   - Replace with `Promise.all(pages.map(prepareHtmlSlideAssets))`, then
     sequential `addHtmlSlideToPres` (pres must be mutated in order).
   - Expected speedup: 5–8× on 6-page deck.
2. **Background PNG cache** keyed by `(template, filled-html-hash)`.
   - Store in `/tmp/intelliflow-html-cache/{sha256}.png`.
   - Skip `renderBackgroundPng` on cache hit. ~2s saved per page.
3. **Geometry cache** keyed by `(template, fill-plan-hash)`.
   - Store computed `RegionGeometry[]` JSON alongside bg PNG.
   - Skip `extractGeometry` on cache hit. ~1s saved per page.
4. **Chrome warm-pool** — reuse a single headless instance via CDP instead
   of re-spawning per call. Requires chrome-launcher / puppeteer dep.
   Defer to Phase 3.5 if Phase 3.1–3 is enough.

**Exit criteria**:
- 6-page deck renders in ≤15s from cold cache
- ≤3s from warm cache
- No test regressions

### Phase 4 — Markdown preprocessor (2–3 sessions)

**Goal**: let line 2 accept raw markdown, not just structured JSON.

Tactics:

1. New module: `modules/runtime/html-fidelity-markdown-adapter.ts`.
   - Input: markdown string, optional `preferredTemplateFamily`.
   - Output: `HtmlFidelityDeck` object.
2. Composition logic (two paths):
   - **Rule-based**: reuse `markdownToSlides` from line 3 to split, then
     map each `Slide` to an HTML template via `templateToArchetypeMap`.
     This gives instant no-LLM conversion.
   - **LLM-based**: call a model with the outline-to-deck prompt, using
     the markdown as the "outline" input. Richer but slower.
3. Dispatch update in `generatePptBuffer`:
   - If content is markdown and a new flag `renderEngine: "html_fidelity"` is
     set on the export node config, route through this adapter.
   - Otherwise line 3 default.
4. New `ExportConfig.renderEngine?: "archetype" | "html_fidelity"` field —
   user-visible switch (handled in a later UI task).

**Exit criteria**:
- Any markdown string + `renderEngine=html_fidelity` flag produces a valid editable pptx
- Parity test: same markdown through line 3 and line 2 both produce reasonable output; line 2 output has equal or more archetype coverage

### Phase 5 — Default switch + deprecation (1 session after ≥1 month bake)

**Goal**: make line 2 the default for pptx export.

Tactics:

1. Flip default `renderEngine` to `"html_fidelity"` in `ExportConfig` schema.
2. Add deprecation warnings in `renderSlidesToPptxWithStylePack` and related
   line-3 entry points.
3. Keep line-3 code for one release cycle as emergency fallback (env flag
   `FORCE_ARCHETYPE_RENDERER=1` to re-enable).
4. Migration doc explaining how user configs with hardcoded style-pack IDs
   map to new template-family IDs.

**Exit criteria**:
- Default production path goes through line 2
- Line 3 is reachable only via explicit flag
- No reports of regression after one release

### Phase 6 — Line 3 removal (when safe)

**Goal**: delete dead code.

Gate: >2 releases with no fallback-flag usage observed in telemetry (if added) OR explicit user-facing sign-off that no-one still needs line 3.

Files to delete when safe:
- `ppt-archetype-renderer.ts`
- `ppt-style-packs.ts`
- Most of `ppt-deck-composition.ts` (the Slide[] types may still be shared)
- Relevant branches of `buildDeckComposition`

---

## Dependencies + sequencing

```
Phase 1 ──✅── Phase 2 (templates) ── Phase 3 (perf) ── Phase 4 (markdown) ── Phase 5 (default switch) ── Phase 6 (delete)
                     │
                     └── can interleave with other work (orphan cleanup, UI node)
```

Phase 2 and Phase 3 are parallelizable. Phase 4 depends on both.

## Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM provider outage makes entire line 2 unusable | Mid | High | Keep line 3 as fallback forever; add secondary LLM provider in adapter |
| HTML template count explodes (14+) and becomes unmaintainable | Mid | Mid | Invest in a "template ingest" tool in Phase 2.5 to extract HTML-style templates from real .pptx decks; don't hand-author forever |
| Chrome headless flakiness (SSL hang observed) | Mid | Low | Already hardened with virtual-time-budget + 30s SIGKILL; Phase 3 warm-pool further reduces spawns |
| pptxgenjs gotchas with CJK fonts not bundled | Low | Mid | Bundle 思源宋体 CN as embedded font in Phase 3; audit output on PowerPoint for Windows |
| Template family lock-in (only 622eee2ab7e6e) | High (today) | High | Phase 2.5 spin up template registry once a second family is needed |

## Deliverables per phase

Each phase lands one or more of:
- Code + tests
- Docs (update this plan + README + prompt)
- Live smoke fixtures in `/tmp/intelliflow-html-*`

Commits are squashed into phase-scoped feat() commits; phase numbers are
tracked in commit subjects like `feat(ppt-mvp): phase-2.1 add feature_grid template`.

## Explicit out-of-scope (for this consolidation)

- 前端 UI 层（memory 记录的 PPT 导出节点）— 单独 track，平行进行
- 线 1（preserve mode）runtime dispatch 接入 — 平行进行
- Template registry DB schema — 触发条件是第二个模板家族被需要
- Multi-tenant brand kit — 产品决策问题，不在技术 roadmap

---

## Kickoff: Phase 2 starts next

First concrete work items (in order):
1. Author `feature_grid.html` + live verify
2. Author `summary.html` + live verify
3. Update outline-to-deck prompt catalog with both
4. Update adapter role map
5. Extend adapter test to 8-slide deck
6. Commit as `feat(ppt-mvp): phase 2.1 — feature_grid + summary templates`
