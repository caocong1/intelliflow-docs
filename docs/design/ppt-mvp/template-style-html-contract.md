# Template-style HTML Contract (HTML fidelity line POC)

Status: **POC scope only — single page (cover), static HTML, no AI roundtrip yet.**

## Motivation

Preserve mode ([slot-maps](slot-maps/)) lands a decent baseline but leaves two problems:

1. **Can't fundamentally change layout** — if the original `.pptx` doesn't have a slide matching the content's semantic intent, preserve mode forces awkward compromises (see [slot-maps/622eee2ab7e6e/_deprecated/slide15.slot-map.json](slot-maps/622eee2ab7e6e/_deprecated/README.md)).
2. **Content density mismatch** — template slots have fixed pixel budgets; A+B+C (font shrink + widen + LLM rewrite) buys room but still clips at the edges.

HTML fidelity line attempts a different angle: author the TEMPLATE'S VISUAL GRAMMAR in HTML+CSS (backgrounds, geometry, typography tokens), feed the HTML + content to an LLM, and have the LLM produce a layout that respects that grammar. Output goes either as an `editable_ppt_object_plan/v1` JSON (compiled later to .pptx by a native renderer) OR as direct native-template-ready scene JSON.

## Boundaries (what this is NOT)

- Not a full PPT-from-HTML pipeline. Just a grammar-respecting layout intermediary.
- Not a replacement for preserve mode. Only a fallback for content/template topology mismatches.
- Not ingestion-free: still requires a human to author the template-style HTML once per template section. Shared across pages of the same section/style.

## Pipeline

```
[template .pptx screenshot / style analysis]
         |
         v
[template-style-html.ts] ---> [template.style.html]  (hand-authored HTML/CSS)
         |                            |
         |                            v
         |                     [page content (wireless-page-plan.p1)]
         |                            |
         |                            v
         |                    [feed to LLM]
         |                            |
         |                            v
         |             [html_to_ppt_fill_plan/v1 JSON]
         |                            |
         v                            v
 [build-wireless-html-fidelity.ts]  <-/
         |
         v
  [editable .pptx output]
```

## Artifacts

### 1. `template.style.html`

Hand-authored HTML page at `docs/design/ppt-mvp/html-styles/<template-id>/<section>.html` that visually mirrors one section of the template:

- Slide dimensions: 1280×720 px (16:9, 96 DPI), exported 1:1 to EMU at build time.
- Semantic regions via CSS classes:
  - `.slide-root`, `.hero-bg`, `.title`, `.eyebrow`, `.body`, `.pill` etc.
  - Named grid cells for comparison/process layouts.
- Design tokens as CSS custom properties:
  - `--color-primary: #1E40AF;`
  - `--color-accent: #22C55E;`
  - `--font-title: "思源宋体 CN";`
  - `--spacing-unit: 24px;`
- No JavaScript.

### 2. `html_to_ppt_fill_plan/v1` (proposed schema)

Output of the LLM step. Maps page content to HTML regions.

```json
{
  "version": "html_to_ppt_fill_plan/v1",
  "templateId": "622eee2ab7e6e",
  "htmlPath": "../html-styles/622eee2ab7e6e/cover.html",
  "pages": [
    {
      "pageId": "p1",
      "regionAssignments": [
        { "regionSelector": ".slide-root .title", "text": "无线网络科普" },
        { "regionSelector": ".eyebrow", "text": "WIRELESS NETWORK CONSTRUCTION GUIDE" },
        { "regionSelector": ".body p", "paragraphs": [ ... ] },
        { "regionSelector": ".pill:nth-child(1)", "text": "汇报：IT 基建" }
      ]
    }
  ]
}
```

LLM is instructed to fit content to regions respecting CSS-declared budgets (word count hints in `data-max-chars` etc.).

### 3. `build-wireless-html-fidelity.ts`

Renders HTML to PNG via Chrome headless (already have `render-slide-preview.ts` chrome wrapper), then either:
- **Option A (POC v1)**: ship the PNG as a PDF or image-backed slide (`native-template` + single big image). NOT editable, but lowest-complexity.
- **Option B (future)**: parse the HTML DOM back to shape geometry, generate `editable_ppt_object_plan/v1`, compile via pptxgenjs. Fully editable.

## POC v1 scope — cover only

1. Hand-author `html-styles/622eee2ab7e6e/cover.html` mirroring slide 1's visual grammar.
2. Wire `build-wireless-html-fidelity.ts` to inject wireless p1 content + render to PNG.
3. Compare visual fidelity against preserve-mode p1 output.

No LLM step in POC v1 — the content slot IDs are hand-mapped. LLM integration deferred until visual fidelity is validated.

## Success criteria for POC

- Wireless cover renders with template's blue/green geometry, background image, title/pill layout
- Chinese CJK font usable (preview uses PingFang SC as a 思源宋体 CN substitute — fidelity ~80%)
- Fits a 1280×720 export target

## Out of scope for POC

- Multi-template support (hand-author one HTML per template section)
- LLM-driven content fitting
- Editable .pptx output (POC emits PNG-backed slide only)
- All pages beyond cover

## After POC

If cover preview reads as "visually richer than preserve mode", extend to:
- TOC page (p2) — lists benefit from HTML's flex/grid much more than preserve-mode's rigid template slots
- Comparison page (p3) — can try more opinionated comparison layouts than slide 17's 2×2

If cover reads as "worse than preserve mode", park the HTML line and refocus on preserve-mode polish.
