# Slot-maps — Cross-template Runbook

This folder hosts slot-maps for **every** ingested `.pptx` template that the preserve-mode builder supports. Each template gets its own subdirectory keyed by the template's ingest ID (folder name = hash/slug of the source `.pptx`). Slot-maps inside a template folder are per-slide.

Today's layout:

```
slot-maps/
├── README.md                  (this file — cross-template workflow)
├── 622eee2ab7e6e/             (first template: 无线/有线网络 template)
│   ├── README.md              (slide topology table + author workflow)
│   ├── slide1.slot-map.json
│   ├── slide2.slot-map.json
│   ├── slide17.slot-map.json
│   └── _deprecated/           (maps retired because of wrong topology)
│       ├── README.md
│       └── slide15.slot-map.json
└── <next-template-id>/        (future templates follow the same shape)
```

## Why per-template folders

Every slot-map's `creationId`s are **unique to its source `.pptx`**. You cannot reuse a slot-map across templates even if the topologies match — the UUIDs won't resolve. What IS reusable is:

- **Topology vocabulary** (`cover_hero`, `grid_2x2_symmetric`, etc.) — shared across templates, defined in [`preserve/template-slot-map-schema.ts::TOPOLOGIES`](../../../packages/backend/src/scripts/ppt-mvp/preserve/template-slot-map-schema.ts).
- **page_type → topology mapping** — wireless deck rules (see [`docs/design/ppt-three.md`](../../ppt-three.md) §page_type-topology). Works for any template that has slides in those topologies.
- **Fill-plan contract** — `template_fill_plan/v1` just references slot-maps by path; works with any template.

## Adding a new template — 7 steps

1. **Ingest the `.pptx`**:
   ```
   bun packages/backend/src/scripts/ppt-mvp/ingest-template.ts <new-template.pptx>
   ```
   Produces `/tmp/ppt-research/ingest-out/<template-id>/template.json + media/`.

2. **Extract layout presets + topology**:
   ```
   bun packages/backend/src/scripts/ppt-mvp/extract-template-layout-presets.ts <new-template.pptx> --out <template-id>-presets.json
   ```
   Every slide gets a `topology` field auto-classified.

3. **Stage fixture**: copy the `.pptx` into `packages/backend/test-fixtures/ppt-mvp/<template-id>.pptx`. Update [`preserve/fetch-template-fixture.ts`](../../../packages/backend/src/scripts/ppt-mvp/preserve/fetch-template-fixture.ts) `FIXTURES` map.

4. **Create template folder**: `docs/design/ppt-mvp/slot-maps/<template-id>/` with a `README.md` listing each slide's `idx / section / topology / text_slots / img` (copy format from `622eee2ab7e6e/README.md`).

5. **Map page_types to best-fit slides**: consult ppt-three.md §page_type-topology. Preferred: first exact topology match; if none, pick nearest compatible (e.g. `row_4_cells` for a 5-node timeline + footer compression).

6. **Author slot-maps per used slide**: run the spike to dump shape creationIds, then hand-author `slide<N>.slot-map.json` with `topology` field + per-slot selector/strategy/width-budget/minFontPt (see `622eee2ab7e6e/README.md` §authoring-workflow).

7. **Build + verify**: `bun packages/backend/src/scripts/ppt-mvp/preserve/build-wireless-template-preserve.ts /tmp/out.pptx --strict` (swap the wrapper's fill-plan path to the new template's plan). Run `quality-gate.ts` to confirm every replace-strategy slot actually mutated and no preserve-strategy slot drifted.

## Things that are NOT reusable across templates

- **Font size heuristics** — templates use different base pt sizes. Always re-calibrate `minFontPt` per template per slot.
- **Width unit → EMU conversion** — slot bbox widths vary wildly; recalibrate `maxWidthUnits` using `textSample` width inspection.
- **Section header semantics** — e.g. `622eee2ab7e6e` uses "部门工作概述 / 工作成果展示 / 存在不足之处 / 未来工作规划"; other templates have entirely different section structures.

## Deprecation protocol

When a slot-map turns out to be the wrong topology (authored against mis-chosen slide), move it to `_deprecated/` with a short reason in the folder's README. Do NOT delete — these lessons help future authors avoid the same mistakes.

See [`622eee2ab7e6e/_deprecated/README.md`](622eee2ab7e6e/_deprecated/README.md) for the canonical example (slide 15 mis-mapped to p3 comparison).
