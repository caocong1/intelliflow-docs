---
name: editorial-ppt
description: "Generate editorial-grade PPT decks with deck-wide visual coherence. Use when user asks to create PPT / presentation / slides / 演示 / 幻灯片 / pptx / 简报 / 汇报 / 路演 from a topic, outline, document (Markdown/PDF/DOCX), or visual brief. This skill encodes a 4-layer pipeline (TemplateGenes → spec_lock → PageBrief → RenderedPage) with curated palettes, hard rules, NEVER-list, and visual QA loop — designed to prevent generic AI-PPT aesthetics."
---

# Editorial PPT — Deck-Wide Coherent Presentation Generation

> Goal: Transform a topic / outline / document into a coherent, editorial-grade slide deck.
> When uncertain about visual direction, anchor on **curated presets + hard rules + NEVER-list** rather than improvising.
> Output: structured spec + per-page HTML/SVG → rendered PPTX, with subagent visual QA closing the loop.

This skill is a methodology distilled from analyzing 19 PPT-generation projects (Anthropic pptx, PPTAgent, PPT Master, AionUi, allweone presentation-ai, presenton, oh-my-ppt, danny0926/ppt-skills, daymade/ppt-creator, and 10 design-quality skills). It captures **what 4+ projects independently converge on** rather than any single project's idiosyncrasy.

---

## When to Use

Triggers (any of these keywords):
- **English**: presentation, slides, slide deck, pptx, PPT, pitch deck, keynote
- **Chinese**: 演示, 幻灯片, 简报, 汇报, 路演, PPT, 提案, 方案展示
- File outputs: `.pptx`, `.key`, `.odp`

When user has:
- A topic to present (e.g. "do a deck on wireless network construction")
- An outline / page plan
- A PDF / DOCX / Markdown to convert
- An existing PPTX template they want to honor

**Skip this skill** when user only needs: text outline (no visual), notes-only, simple bullet list, or single hero image.

---

## Core Methodology — 4 Layers + 1 QA Loop

```
Layer 0 — TemplateGenes  (machine-readable design intent)
            ↓ deterministic CSS generation (no LLM)
            04-design-system.css
Layer 1 — spec_lock.json  (machine contract — verbatim values)
            ↓
Layer 2 — GlobalConstitution  (6-8 hard rules for the deck)
            ↓
Layer 3 — PageBrief[]  (per-page direction with hard visualElement field)
            ↓
Layer 4 — RenderedPage[]  (per-page HTML with content + assets)
            ↓ headless render → PNG / native PPTX
Layer 5 — Visual QA Subagent Loop  (11-item checklist + ≥75 score gate)
            ↓
Output: .pptx + speaker notes
```

### Layer 0 — TemplateGenes (input → machine-friendly design tokens)

**Input options**:
- Visual brief (tone / colorMode / imageLanguage / iconLanguage / shapeLanguage / density / avoid)
- Ingested PPTX template (via `JSZip → theme.xml → 12 OOXML color slots → weighted slide scan`)
- Direct preset (one of 10 curated palettes)

**Output schema**:
```typescript
{
  version: "template_genes/v2";
  source: { kind: "brief" | "ingested_template" | "preset"; ... };
  designTokens: {
    colors: { primary, secondary, accents[0-4], neutrals[0-3], bg, surface, text, textMuted };
    fonts: { titleStack, bodyStack, monoStack }; // stacks ending in Windows-preinstalled fallback
    rhythm: { density, pagePadding, preferredLayoutGrammar };
    imageRendering: "vector-illustration" | "editorial" | "3d-isometric" | "sketch-notes" | "realistic-photo" | "abstract-geometric";
    imagePalette: { dominantUsage: "60%", supportingUsage: "30%", accentUsage: "10%" };
  };
}
```

**Rule**: If brief is ambiguous, fall back to one of 10 curated palettes (see `references/curated-palettes.md`). Never default to blue.

### Layer 1 — spec_lock.json (anti-drift machine contract)

**Why**: PPT Master rule #8 — "SPEC_LOCK RE-READ PER PAGE — Colors / fonts / icons / images MUST come from this file — no memory values, no on-the-fly invention." Same pattern in oh-my-ppt's DesignContract.

**Schema**:
```typescript
{
  version: "spec_lock/v1";
  palette: {
    primary: "#XXXXXX",       // verbatim HEX
    secondary: "#XXXXXX",
    accents: ["#XXXXXX", ...],
    neutrals: ["#XXXXXX", ...]
  };
  typography: {
    titleStack: "PingFang SC, Source Han Serif SC, Microsoft YaHei, Source Han Serif, Georgia, serif",
    bodyStack: "PingFang SC, Microsoft YaHei, -apple-system, sans-serif",
    titleSize: 50,
    bodySize: 19,
    sizeRatio: "title >= 2x body"
  };
  iconLibrary: "tabler-outline" | "tabler-filled" | "chunk-filled" | "phosphor-duotone";
  iconStrokeWidth: 2;          // locked deck-wide
  imageLock: {
    rendering: "...",          // copy from TemplateGenes
    palette: { ... },
    types: { hero: "...", framework: "...", comparison: "..." }
  };
  constraints: {
    maxBulletsPerSlide: 5,
    maxWordsHeadline: 8,       // danny0926 rule
    minVisualRatio: 0.6,       // danny0926 60/40 rule
    contrastMinRatio: 4.5,     // WCAG AA
    colorEconomyMax: 4         // PPT Master rule
  };
}
```

**Critical rule** (verbatim PPT Master): **"Before authoring each page, MUST `read_file <project>/spec_lock.json`"** — this means every Layer 4 prompt includes the spec_lock summary as the FIRST anchor.

### Layer 2 — GlobalConstitution (deck-wide hard rules)

6-8 imperative rules in markdown bullet form. Generated by LLM from spec_lock + outline. Must cover:
- Color economy ("Use primary for headlines, accents for callouts ONLY")
- Typographic hierarchy ("Title 50px → Section 32px → Body 19px → Caption 14px, never compress")
- Decoration discipline ("One signature visual motif throughout; e.g., Eyebrow Tags + Double-Bezel cards")
- Information hierarchy ("One primary message per slide; bullets ≤ 5")
- Negative space ("Macro padding py-24~py-40; do not fill every pixel")
- Page marker / continuity ("Bottom-right page marker with primary accent bar")
- Variance Mandate (from high-end-visual-design): "No consecutive pages share the same layout grammar; every page is a unique twist on the same philosophy"

### Layer 3 — PageBrief (per-page direction)

```typescript
{
  pageId, pageType, intent, primaryFocal, composition, tone, whatToAvoid,
  // NEW HARD FIELDS:
  visualElement: "icon_in_colored_circle" | "colored_block" | "large_stat_number" | "chart" | "shape_composition" | "hero_image" | "diagram",
  visualElementRequired: true,    // Layer 4 must contain this element type or retry
  layoutArchetype: "centered-hero" | "two-column" | "split-visual" | "visual-hero" | "icon-grid" | "comparison" | "timeline" | "process-flow" | "big-number" | "quote" | ...
}
```

**Variance rule**: PageBrief generator MUST check previous page's `layoutArchetype` and pick a different one (Layer 0/1 enforcement, not hopeful prompting).

### Layer 4 — RenderedPage (per-page HTML/SVG)

Layer 4 prompt structure (must include ALL of these sections):

1. **Role + identity** — "You are an editorial-grade designer."
2. **NEVER-list** — (see `references/never-list.md`, 12+ items)
3. **spec_lock anchor** — verbatim quote of spec_lock.json (REREAD per page)
4. **Hard rules** — H1-H8 (see `references/hard-rules.md`)
5. **Curated palette reminder** — palette ID + HEX values
6. **PageBrief content** — intent + focal + composition + visualElement
7. **Variant layout recipe** — for known archetype, concrete composition guidance
8. **Output constraints** — HTML format, max nesting depth, banned classes

**Retry policy** (PPTAgent REPL pattern):
- Validate HTML → if fails, return STRUCTURED error: `{ code, slot, expected, actual, suggestion }`
- Inject structured error as new user turn; do NOT use vague "previous attempt failed"
- Max 2 retries; **do NOT fall back to placeholder** — log failure to metrics + raise to user

### Layer 5 — Visual QA Subagent Loop (closing the loop)

**Must be a separate subagent**, not the same LLM that generated the page. anthropics/pptx: "USE SUBAGENTS — even for 2-3 slides. You've been staring at the code and will see what you expect, not what's there."

**Inputs**: rendered PNG of each page + the deck's spec_lock.json.

**Two-track evaluation** (impeccable/critique pattern):
- **Track A — LLM design review**: 11-item checklist (see `references/visual-qa-checklist.md`)
- **Track B — Detector script**: deterministic checks (color drift / font drift / overlap / contrast / outside-margin)

**Scoring** (daymade/ppt-creator RUBRIC): 10 dimensions × 10 points = 100. Threshold ≥ 75. If < 75, identify weakest 3 dimensions, regenerate, re-score (max 2 iterations).

**Critical**: "Do not declare success until you've completed at least one fix-and-verify cycle." (anthropics/pptx)

---

## Workflow (per generation request)

### Stage 1 — Intake (≤ 1 min)
1. If user provides PDF/DOCX/Markdown, extract content first.
2. If visual brief is missing, run minimal 10-question intake (see `references/intake-form.md`). Use safe defaults if user doesn't answer.
3. Determine deck length (10-20 slides typical, max 30).

### Stage 2 — Layer 0 (TemplateGenes)
1. If user supplied ingested PPTX template: extract via OOXML parsing.
2. If user supplied brief: derive design tokens; **if any token is uncertain, FALL BACK to a curated palette** rather than guessing.
3. Output 00-template-genes.json.

### Stage 3 — Layer 1 (spec_lock.json)
1. Distill TemplateGenes into machine contract.
2. Lock icon library (one of 4).
3. Lock 3D image system (rendering + palette + types).
4. Validate: every HEX is valid, every font stack ends with Windows-preinstalled.

### Stage 4 — Deterministic CSS Generation (no LLM)
1. Generate `04-design-system.css` from spec_lock.
2. CSS variables for every locked value.

### Stage 5 — Layer 2 (GlobalConstitution)
1. LLM generates 6-8 hard rules.
2. Must include Variance Mandate.

### Stage 6 — Layer 3 (PageBrief × N pages, sequential)
1. For each page: LLM produces PageBrief.
2. **Variance check**: layoutArchetype must differ from previous page.
3. Validate: visualElement field is one of allowed enum.

### Stage 7 — Layer 4 (Per-page HTML, sequential)
1. For each page: LLM produces HTML.
2. Validate: structural (HTML well-formed, body / slide class, NO banned features) + content (all spec_lock values verbatim referenced) + asset (all required images used) + visualElement (element of declared type present).
3. On failure: structured REPL feedback → retry (max 2).
4. **NO placeholder fallback** — log failure, alert.

### Stage 8 — Render
1. HTML → PNG via headless Chrome (image-backed path) OR
2. HTML → SVG → DrawingML (native editable path, PPT Master style) OR
3. HTML + native text overlay (dual-layer, danny0926 style — recommended)
4. Pack into PPTX with pptxgenjs.

### Stage 9 — Layer 5 (Visual QA Subagent)
1. Spawn subagent with PNG + spec_lock.
2. Run 11-item checklist + detector script.
3. Score 10 × 10 = 100; threshold ≥ 75.
4. If < 75: identify weakest 3, regenerate, re-score (max 2 iterations).
5. **Must complete at least one fix-and-verify cycle** before declaring success.

### Stage 10 — Deliverables
1. Final .pptx file (editable in PowerPoint / Keynote / WPS).
2. spec_lock.json (machine contract).
3. Speaker notes (45-60s per slide).
4. Quality report (per-slide score breakdown).

---

## Curated Palettes (Layer 0 fallback)

10 palettes (Midnight Executive / Forest & Moss / Coral Energy / Warm Terracotta / Ocean Gradient / Charcoal Minimal / Teal Trust / Berry & Cream / Sage Calm / Cherry Bold) and 8 font pairings — see `references/curated-palettes.md`.

These are pre-validated for: WCAG AA contrast, dominance ratio 60/30/10, professional & non-generic appearance. **Sourced from anthropic/skills/pptx and AionUi morph-ppt-3d (two independent projects converged on the same set).**

---

## NEVER-list (12+ banned anti-patterns)

See `references/never-list.md`. Highlights:
- NEVER use accent lines under titles (chief AI-generation tell)
- NEVER default to blue (LILA BAN — also forbid purple-to-blue AI gradients)
- NEVER center body text
- NEVER create text-only content slides (use icon-grid / visual-hero instead)
- NEVER use 4+ colors in body content
- NEVER use opacity:0 / visibility:hidden as initial state
- NEVER use font sizes < 16pt (mobile of <14pt always banned)
- NEVER use hero photo + white-text overlay (generic AI aesthetic)
- NEVER include emoji as decoration
- NEVER mix icon libraries within a deck
- NEVER omit the spec_lock anchor at the start of Layer 4 prompts
- NEVER fall back to placeholder without alerting

---

## Hard Rules (H1-H8 quantified)

See `references/hard-rules.md`. Quantified, enforceable.

- **H1** Title size ≥ 2× body size
- **H2** Body text ≥ 16pt
- **H3** Dark backgrounds (luminance < 30%): body text must be white or near-white (luminance > 80%)
- **H4** Every content slide MUST have at least one visual element (icon / chart / shape / image / large-stat)
- **H5** Speaker notes mandatory on content slides (45-60s)
- **H6** Color economy: max 4 colors per page
- **H7** Visual ratio: ≥ 60% non-text area
- **H8** Variance: no two consecutive slides share the same layoutArchetype

---

## Visual QA Checklist (11 items)

See `references/visual-qa-checklist.md`. Verbatim from anthropics/pptx + AionUi Gate 5b.

1. Overlapping elements
2. Text overflow / cut off at edges
3. Decoration positioned for single-line but title wrapped
4. Source citations / footers colliding
5. Elements too close (< 0.3" gaps)
6. Uneven gaps (one area sparse, another crowded)
7. Insufficient margin from slide edges (< 0.5")
8. Columns not aligned consistently
9. Low-contrast text / icons (< WCAG AA)
10. Text boxes too narrow → over-wrapping
11. Leftover placeholder content (xxxx / lorem / TODO)

---

## RUBRIC (10 dimensions × 10 points, threshold ≥ 75)

See `references/rubric.md`. Each dimension scored 0-10 by visual QA subagent.

1. Goal Clarity
2. Story Structure (Pyramid completeness)
3. Slide Assertions (assertion-style headlines)
4. Evidence Quality
5. Chart Fit
6. Visual & Accessibility
7. Coherence & Transitions
8. Speakability (45-60s/slide)
9. Deliverables Complete
10. Robustness (gaps marked, fallback explicit)

---

## When skill and reference disagree, REFERENCE is authoritative

Skill is a navigation map; concrete schemas and rules live in references/. Always read the relevant reference file before making decisions on:
- Color → `references/curated-palettes.md`
- Font → `references/curated-palettes.md` § Typography
- Hard rules → `references/hard-rules.md`
- NEVER list → `references/never-list.md`
- QA checklist → `references/visual-qa-checklist.md`
- spec_lock schema → `references/spec-lock-schema.md`

---

## Common Pitfalls (from analyzed projects)

- **PPTAgent**: depending on reference PPT quality — if reference is bad, output ceiling is locked. → Mitigation: curated reference library only.
- **PPT Master**: spec_lock not re-read per page → drift. → Mitigation: bake into Layer 4 prompt template, not optional.
- **anthropics/pptx**: QA loop skipped when "looks fine" → escape failures. → Mitigation: enforce ≥1 fix-and-verify cycle.
- **AionUi**: teammate "stand by" prompts cause LLM stream timeouts → use mailbox + idle-then-wake.
- **danny0926**: heavy CDN dependency (Google Fonts, rough.js, mermaid) fails in air-gapped corp networks → localize before shipping.
- **slide-deck-ai refinement**: full PPTX rewrite each iteration is token-expensive → prefer diff-style edits (5 actions like PPTAgent).
- **allweone**: live-DOM PPTX export needs running Web app → not suitable for batch/CLI generation.
- **presenton**: TSX layout LLM-generation from screenshot is too constrained for novel content → require fallback to brief.

---

## Output Artifacts (every generation)

```
<session_dir>/
├── 00-template-genes.json
├── 01-spec-lock.json           ← machine contract
├── 02-global-constitution.json
├── 03-page-briefs.json
├── 04-design-system.css
├── pages/
│   ├── <pageId>.html
│   ├── <pageId>.png
│   ├── <pageId>.qa.json        ← per-page QA score
│   └── <pageId>.brief.md       ← human-readable summary
├── pipeline.log.txt
├── visual-qa-report.md         ← aggregated 10×10 rubric scores
└── <output>.pptx                ← final deliverable
```

---

## Reference Files

| Path | Purpose |
|---|---|
| `references/curated-palettes.md` | 10 palettes + 8 font pairings + selection guide |
| `references/never-list.md` | 12+ anti-patterns with rationale |
| `references/hard-rules.md` | H1-H8 quantified rules |
| `references/visual-qa-checklist.md` | 11 items + subagent prompt template |
| `references/rubric.md` | 10-dim scoring rubric with anchored examples |
| `references/spec-lock-schema.md` | Full TypeScript types + validation rules |
| `references/intake-form.md` | 10-question intake with safe defaults |
| `references/source-deep-dive.md` | Per-project deep-dive on what's borrowed |

---

**Version**: editorial-ppt/v1.0
**Date**: 2026-05-20
**Synthesized from**: anthropics/skills/pptx, icip-cas/PPTAgent, hugohe3/ppt-master, iOfficeAI/AionUi, allweonedev/presentation-ai, presenton/presenton, arcsin1/oh-my-ppt, danny0926/ppt-skills, daymade/claude-code-skills/ppt-creator, barun-saha/slide-deck-ai, ai-forever/slides_generator, lewislulu/html-ppt-skill, and 9 design-quality skills on skills.sh.
