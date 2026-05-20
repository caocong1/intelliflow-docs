# spec_lock.json — Machine Contract Schema

> Anti-drift mechanism: every Layer 4 prompt MUST re-read this file before authoring each page. Sourced from PPT Master `spec_lock.md` (TS-typed adaptation), oh-my-ppt DesignContract, allweone ThemeProperties.

---

## Full TypeScript Type

```typescript
export interface SpecLockV1 {
  version: "spec_lock/v1";

  /** Source provenance — where did this lock come from? */
  source:
    | { kind: "brief"; brief: VisualBrief }
    | { kind: "ingested_template"; templatePath: string; weightedScore: number }
    | { kind: "preset"; presetId: PalettePresetId; pairingId: FontPairingId };

  /** PALETTE — verbatim HEX, never compute at render time */
  palette: {
    primary: HexColor;        // e.g. "#2C5F2D"
    secondary: HexColor;
    accents: HexColor[];      // 0-4, primary accent first
    neutrals: HexColor[];     // 2-4, light to dark
    bg: HexColor;
    surface: HexColor;
    text: HexColor;
    textMuted: HexColor;
    /** All distinct color values for drift detection */
    allValues: HexColor[];
  };

  /** TYPOGRAPHY — full stacks ending in Windows-preinstalled fallback */
  typography: {
    titleStack: string;       // e.g. "Source Han Serif SC, PingFang SC, Microsoft YaHei, Georgia, serif"
    bodyStack: string;
    monoStack: string;
    titleSize: number;        // px, between 36 and 96
    sectionSize: number;      // px, between 20 and 32
    bodySize: number;         // px, ≥ 16
    captionSize: number;      // px, 10-14
    sizeRatio: "title >= 2x body";  // assertion, validated
    /** All distinct font names for drift detection */
    allFamilies: string[];
  };

  /** ICON LIBRARY — locked deck-wide, 1 of 4 */
  iconLibrary: "tabler-outline" | "tabler-filled" | "chunk-filled" | "phosphor-duotone";
  iconStrokeWidth: 1.5 | 2 | 3;   // locked single value, default 2

  /** IMAGE LOCK — three-dimensional anti-drift */
  imageLock: {
    rendering:
      | "vector-illustration"
      | "editorial-photography"
      | "3d-isometric"
      | "sketch-notes"
      | "realistic-photo"
      | "abstract-geometric"
      | "hand-drawn";
    palette: {
      dominantUsage: number;   // 0.6-0.7
      supportingUsage: number; // 0.2-0.3
      accentUsage: number;     // 0.05-0.15
    };
    /** Per-slot image type for the deck's 6-8 archetype slots */
    types: Record<string, ImageType>;
  };

  /** HARD CONSTRAINTS (quantified) */
  constraints: {
    maxBulletsPerSlide: 5;             // danny0926 rule
    maxWordsHeadline: 8;               // danny0926 rule
    minVisualRatio: 0.6;               // 60/40 rule
    contrastMinRatio: 4.5;             // WCAG AA body
    contrastMinRatioHeading: 3.0;      // WCAG AA large text
    colorEconomyMax: 4;                // max colors per page
    layoutVarianceWindow: 5;           // ≥3 distinct in any 5-slide window
    maxNestingDepth: 4;                // HTML structural depth
  };

  /** RHYTHM — page-level layout grammar */
  rhythm: {
    density: "low" | "medium" | "high";
    pagePadding: { x: number; y: number };  // px
    preferredLayoutGrammar: "asymmetric_editorial" | "grid_corporate" | "mixed";
    decorationMotif: "eyebrow_tag" | "double_bezel" | "soft_card" | "geo_block" | "frame_minimal";  // ONE motif, repeated throughout deck
  };

  /** RADIUS / SHADOW (allweone-style 6th token category) */
  shapes: {
    cornerRadius: { card: number; pill: number; tab: number };  // px
    shadow: {
      card: ShadowSpec;
      surface: ShadowSpec;
    };
    borderWidth: 1 | 1.5 | 2;
    borderColor: HexColor;
  };
}

type HexColor = `#${string}`;
type ImageType = "background" | "hero" | "framework" | "comparison" | "diagram" | "illustration" | "icon";

interface ShadowSpec {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;  // rgba or hex
}

type PalettePresetId =
  | "midnight_executive"
  | "forest_and_moss"
  | "coral_energy"
  | "warm_terracotta"
  | "ocean_gradient"
  | "charcoal_minimal"
  | "teal_trust"
  | "berry_and_cream"
  | "sage_calm"
  | "cherry_bold";

type FontPairingId =
  | "georgia_calibri"
  | "arial_black_arial"
  | "calibri_calibri_light"
  | "cambria_calibri"
  | "trebuchet_calibri"
  | "impact_arial"
  | "palatino_garamond"
  | "consolas_calibri";
```

---

## Validation Rules

A `spec_lock.json` is valid iff ALL of:

1. **palette.allValues** is the union of `primary | secondary | accents | neutrals | bg | surface | text | textMuted` — must be exhaustive (no other hex values appear in subsequent layers).
2. Every HEX matches `/^#[0-9A-Fa-f]{6}$/` (no 3-char shortcuts, no 8-char alpha).
3. **typography.allFamilies** is the union of font names extracted from `titleStack | bodyStack | monoStack`.
4. Every stack ends in a Windows-preinstalled font: `Microsoft YaHei | SimHei | SimSun | FangSong | KaiTi | Arial | Calibri | Cambria | Segoe UI | Times New Roman | Georgia | Impact | Trebuchet MS | Consolas`.
5. `titleSize >= bodySize * 2` (H1 rule).
6. `bodySize >= 16` (H2 rule).
7. Contrast: `getContrast(text, bg) >= 4.5` AND `getContrast(textMuted, bg) >= 4.5`.
8. **iconLibrary** is one of the 4 enums.
9. **imageLock.palette** sums approximately to 1.0 (`abs(dominantUsage + supportingUsage + accentUsage - 1.0) < 0.05`).
10. **rhythm.decorationMotif** is one of the 5 enums (lock one for the entire deck).

Implement as:

```typescript
// scripts/validate-spec-lock.ts
import { z } from "zod";

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const SpecLockSchema = z.object({
  version: z.literal("spec_lock/v1"),
  palette: z.object({ /* ... */ }).superRefine((p, ctx) => {
    const expected = new Set([p.primary, p.secondary, ...p.accents, ...p.neutrals, p.bg, p.surface, p.text, p.textMuted]);
    const actual = new Set(p.allValues);
    if (![...expected].every(v => actual.has(v))) {
      ctx.addIssue({ code: "custom", message: "palette.allValues must include all distinct hex values" });
    }
  }),
  typography: z.object({ /* ... */ }).superRefine((t, ctx) => {
    if (t.titleSize < t.bodySize * 2) {
      ctx.addIssue({ code: "custom", message: `H1 violated: titleSize ${t.titleSize} < bodySize ${t.bodySize} * 2` });
    }
    if (t.bodySize < 16) {
      ctx.addIssue({ code: "custom", message: `H2 violated: bodySize ${t.bodySize} < 16` });
    }
  }),
  // ...
});

export function validateSpecLock(json: unknown): { valid: boolean; errors: string[] } {
  const result = SpecLockSchema.safeParse(json);
  return result.success
    ? { valid: true, errors: [] }
    : { valid: false, errors: result.error.errors.map(e => e.message) };
}
```

---

## How Layer 4 prompts MUST consume this

Each Layer 4 (per-page HTML) prompt has THIS as its FIRST anchor section, before any task description:

```
## Locked Design Contract (spec_lock — do not invent values)

You MUST use ONLY these values. Do not interpolate, do not adjust,
do not "match similar". If a value is not in this contract, do NOT use it.

Palette (all values must come from this list):
  primary:    {{spec_lock.palette.primary}}
  secondary:  {{spec_lock.palette.secondary}}
  accents:    {{spec_lock.palette.accents.join(", ")}}
  neutrals:   {{spec_lock.palette.neutrals.join(", ")}}
  bg:         {{spec_lock.palette.bg}}
  text:       {{spec_lock.palette.text}}
  textMuted:  {{spec_lock.palette.textMuted}}

Typography (use these stacks verbatim):
  Title:  font-family: {{spec_lock.typography.titleStack}}
  Body:   font-family: {{spec_lock.typography.bodyStack}}
  Sizes:  title {{spec_lock.typography.titleSize}}px, body {{spec_lock.typography.bodySize}}px

Icon library: {{spec_lock.iconLibrary}} (stroke-width {{spec_lock.iconStrokeWidth}}px)
  Do NOT use SVG from other libraries; do NOT mix.

Decoration motif: {{spec_lock.rhythm.decorationMotif}}
  Apply this motif uniformly across the deck.

Image rendering: {{spec_lock.imageLock.rendering}}
  All images must visually match this rendering style.

Constraints (any violation = retry):
  - Body text ≥ 16pt (got bodySize {{spec_lock.typography.bodySize}})
  - Max 5 bullets per slide
  - Max 8 words per headline
  - At least one non-text visual element on this slide
  - Max 4 distinct colors on this slide
  - Visual area ≥ 60% of content area

---

## Now author the page:

{{ ... rest of Layer 4 prompt ... }}
```

This block alone is the largest source of cross-page consistency. **Do NOT make it optional. Do NOT shorten it. Do NOT paraphrase.**

---

## Why this beats "design tokens" alone

IntelliFlow already has CSS variables generated from TemplateGenes. The gap is:
- CSS variables tell the BROWSER what to render
- spec_lock tells the LLM what NOT to invent

Without spec_lock, the LLM sees a brief like "tone: clean_green_editorial" and infers HEX values fresh per page. Result: page 1 uses `#1A6E45`, page 2 uses `#0E8B5A`, page 3 uses `#2D9966`. CSS variables would render whatever the LLM writes — they don't constrain the LLM's invention. spec_lock does.

---

## Source attribution

- spec_lock concept + "read per page" rule: hugohe3/ppt-master skills/SKILL.md rule #8
- DesignContract field set: arcsin1/oh-my-ppt prompt/planning.ts buildDesignContractSystemPrompt
- 6-token-category coverage: allweonedev/presentation-ai themes.ts ThemeProperties
- HEX validation strictness: anthropics/skills/pptx pptxgenjs.md common pitfall #5
