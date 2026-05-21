# Hard Rules H1-H8 (Quantified, Enforceable)

> Numerical / boolean rules that must pass for the deck to ship. Sourced from anthropics/pptx, AionUi morph-ppt-3d, danny0926/ppt-skills, daymade/ppt-creator, oh-my-ppt. Validated by detector script (NOT LLM judgment).

---

## H1 — Title size ≥ 2× body size

**Rule**: `titleSize >= bodySize * 2`
**Examples**:
- ✅ Title 36pt + Body 18pt (2.0x)
- ✅ Title 50pt + Body 22pt (2.27x)
- ❌ Title 28pt + Body 20pt (1.4x) — "looks timid" (anthropics)

**Why**: Audience has ≤ 3 seconds per slide. Title must out-weight body for instant scan.

**Source**: anthropics/pptx + AionUi officecli-pptx.

---

## H2 — Body text ≥ 16pt

**Rule**: `bodySize >= 16` AND `cardContentSize >= 16` AND `bulletSize >= 16`.

**Exceptions** (only):
- Chart axis labels: ≤ 12pt OK
- Sublabels: ≤ 14pt OK, max 5 words
- Footnotes: 10-12pt
- Captions: 12-14pt

**Anti-pattern**: "Content doesn't fit" is NOT an excuse. Resolve by:
1. Split into multiple slides
2. Reduce card count
3. Use icon-grid instead of bullet list
4. Remove non-essential text

Never reduce body to fit content (AionUi H4 rule).

**Source**: AionUi morph-ppt-3d H4 + danny0926.

---

## H3 — Dark background contrast

**Rule**: When slide background luminance < 30% (dark mode):
- Body text MUST be white (`#FFFFFF`) or near-white (luminance > 80%)
- NEVER use mid-gray, muted colors, or low-luminance brand colors as body text

**Detector**: compute relative luminance, fail if body text luminance is in `[30, 80]` range on dark bg.

**Why**: AI default behavior in dark mode is to dim text "for elegance" — produces unreadable slides.

**Source**: AionUi H6.

---

## H4 — Every content slide MUST have ≥ 1 visual element

**Rule**: HTML body must contain at least one of:
- `<img>` or `background-image:url(...)`
- `<svg>` element
- Shape composition (`.icon-circle`, `.colored-block`, `.large-stat-number`, `.chart-frame`)
- Diagram (mermaid container)

**Exceptions** (only):
- `pageType: "section_break"` — title-only OK
- `pageType: "closing"` — minimal OK
- `pageType: "quote"` — text-only OK (the quote IS the visual)

**Variance addition** (AionUi rule): Every 3 content slides, **at least 1 must contain a strong non-text visual element** (chart / hero image / large illustration).

**Source**: AionUi morph-ppt-3d Visual Element Checkpoint + danny0926 60/40 ratio.

---

## H5 — Speaker notes mandatory on content slides

**Rule**: Every slide with `pageType ∉ {cover, closing, section_break}` MUST have `speakerNote` field, length 45-60 seconds reading time (≈ 100-180 characters Chinese / 150-250 words English).

**Structure** (daymade/ppt-creator):
```
opening (1 sentence) → core assertion (1 sentence)
  → evidence explanation (2-3 sentences) → transition (1 sentence)
```

**Detector**: count chars, flag if `< 100` or `> 500`.

**Source**: AionUi H7 + daymade/ppt-creator Stage 6.

---

## H6 — Color economy: ≤ 4 colors per page

**Rule**: Per slide, count distinct color values used in fills + strokes + text. Limit: 4.

**Decomposition**:
- 1 primary
- 1 secondary
- 1 accent
- 1 neutral (text + background combined)

**Detector**: scan rendered HTML, extract distinct color tokens, count. Pass if ≤ 4.

**Source**: PPT Master + anthropics/pptx "color economy".

---

## H7 — Visual ratio: ≥ 60% non-text area

**Rule**: Of the slide's content area (excluding chrome / footer / page marker), at least 60% by visual weight must be non-text (images / charts / shapes / icons / whitespace as compositional element).

**Detector**: rasterize HTML, identify text bounding boxes (via DOM walk), compute text-area / total-area ratio. Pass if `text_area / content_area <= 0.4`.

**Why**: AI default is to fill slides with text. Counter-pressure required.

**Source**: danny0926/ppt-skills 60/40 rule + AionUi every-3-slides ≥1 visual rule.

---

## H8 — Variance: no two consecutive slides share the same layoutArchetype

**Rule**: `slides[i].layoutArchetype != slides[i+1].layoutArchetype`

**Allowed exceptions**: bullet_story → bullet_story OK if and only if section context demands it (within same section, must differ in 2+ of: column count, visual element type, content density).

**Detector**: at Layer 3 (PageBrief generation), check previous page's archetype, fail if same.

**Source**: high-end-visual-design Variance Mandate + danny0926 "Never use the same layout type on consecutive slides" + impeccable/distill layout progression.

---

## H9 — Layout progression in any 5-slide window must use ≥ 3 distinct archetypes

(Extension of H8.) Even if every pair differs, A-B-A-B-A is still monotonous.

**Detector**: sliding window of 5, count distinct archetypes, fail if < 3.

**Source**: danny0926 variety rule.

---

## H10 — title-bullets layout MAX 2x in any 10-slide deck

**Rule**: `count(slides where layoutArchetype == "title-bullets") <= 2` per 10 slides.

Text-heavy layouts must be the **last resort**, not the default.

**Source**: danny0926 variety rule.

---

## Validation Sequence (Layer 4 + Layer 5)

```
After HTML generation (Layer 4):
  ├── H1, H2 (font sizes in CSS) — detector pass
  ├── H4 (visual element present) — detector pass
  ├── H6 (color count) — detector pass
  ├── H8, H9, H10 (archetype variance) — at Layer 3 generation
  └── If any fail: structured retry feedback

After PNG render (Layer 5):
  ├── H3 (dark bg contrast) — pixel-level detector
  ├── H5 (speaker notes presence + length) — JSON check
  ├── H7 (visual ratio) — text bbox vs total ratio
  └── If H3/H7 fail: subagent regenerate with explicit reason
```

---

## Why Hard Rules Beat Soft Prompts

Quantified rules give the validator a **boolean pass/fail**. The LLM cannot argue with "body size 14pt fails H2 (must be ≥ 16pt)". Soft prompts like "use readable font sizes" give the LLM negotiation room → drift.

5 of 19 analyzed projects (danny0926, anthropics, AionUi, PPT Master, daymade) explicitly transition from soft to hard rules **specifically** because LLMs default to over-texting and under-visualizing.
