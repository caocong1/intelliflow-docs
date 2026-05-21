/**
 * Layer 0 → 4 prompt builders.
 *
 * Each builder returns the user-facing prompt string.  The orchestrator
 * passes a system prompt and parsing helpers separately.
 */

import type { MvpPageDefinition, PresentationOutline, VisualBrief } from "../types";
import { renderSpecLockAnchor } from "./spec-lock";
import type {
  GlobalConstitution,
  LayoutArchetype,
  PageAssetRef,
  PageBrief,
  SpecLock,
  StyleGenes,
  TemplateGenes,
  ValidationError,
  VisualElementType,
} from "./types";

// ────────────────────────────────────────────────────────────────────────
// System prompts
// ────────────────────────────────────────────────────────────────────────

/**
 * NEVER-list — anti-patterns synthesised from anthropics/skills/pptx,
 * iOfficeAI/AionUi officecli-pptx, and design-taste-frontend (skills.sh).
 *
 * Each item explicitly counters a known LLM default failure mode. Vague
 * "avoid generic aesthetics" guidance has near-zero effect on LLM
 * behaviour; concrete bans force the model to actively work around them.
 *
 * See `ai-agent-ppt-research/06-final/references/never-list.md` for the
 * full 32-item list and source attribution.
 */
const NEVER_LIST = [
  "## NEVER do these (each is a known AI-PPT failure mode)",
  // Visual / aesthetic
  "- NEVER place accent lines or underlines beneath slide titles — chief AI-generation tell.",
  "- NEVER default to blue. Also forbid purple-to-blue AI gradients (the 'LILA' look).",
  "- NEVER center body text. Only headlines/hero/short callouts may centre.",
  "- NEVER create text-only content slides — every content slide needs at least one visual element (icon-in-circle / colored block / large stat / chart / shape composition / hero image / diagram). Exceptions: section_break, closing, quote.",
  "- NEVER use 4+ colours in body content. Stay within primary + secondary + 1 accent + neutral.",
  "- NEVER use hero photo with white-text overlay; if a hero image is needed, use editorial composition (asymmetric, text bites into image edge).",
  "- NEVER include emoji or sticker decoration. Use geometric shapes or icon-library glyphs instead.",
  "- NEVER mix icon libraries within one deck. Pick one of tabler-outline / tabler-filled / chunk-filled / phosphor-duotone.",
  "- NEVER use the generic 4×2 card wall for TOC; use hierarchy (1 featured wide + 2 medium + 5 compact).",
  "- NEVER use rainbow gradients.",
  // Typography
  "- NEVER use body text smaller than 16pt (chart axis labels ≤12pt and footnotes ≤14pt allowed).",
  "- NEVER use font sizes text-6xl / text-7xl / text-8xl in HTML; h1 must be text-4xl or text-5xl.",
  "- NEVER use vw / vh font units — they break PPT export. Use px or rem only.",
  "- NEVER omit a Windows-preinstalled font fallback in font stacks (must end with Microsoft YaHei / SimHei / Arial / Calibri / Segoe UI / Times New Roman / Consolas).",
  // Layout
  "- NEVER repeat the same layout archetype on consecutive slides (Variance Mandate).",
  "- NEVER fill every pixel — keep ≥40% whitespace baseline, use macro padding.",
  "- NEVER use opacity:0 / visibility:hidden / display:none in slide content — breaks PNG capture.",
  "- NEVER use iframe in slide HTML.",
  "- NEVER nest deeper than 4 levels (prevents tag-closure failures).",
  // Color / contrast
  "- NEVER use mid-gray or muted text on dark backgrounds; dark bg (luminance <30%) requires white or near-white body text (luminance >80%).",
  "- NEVER violate WCAG AA contrast (≥4.5:1 body, ≥3:1 large/icons).",
  // Process
  "- NEVER invent palette or font values that are not in the locked design contract.",
  "- NEVER claim success without inspecting the rendered output for violations of the above.",
].join("\n");

export const SYSTEM_DESIGN = [
  "You are a senior visual designer who specialises in editorial-grade",
  "Chinese/English presentation decks. You produce structured design",
  "specifications and clean semantic HTML.",
  "",
  NEVER_LIST,
  "",
  "## Output format",
  "When asked for JSON, return JSON only inside a ```json fence.",
  "When asked for HTML, return HTML only inside a ```html fence — no commentary.",
].join("\n");

// ────────────────────────────────────────────────────────────────────────
// Layer 0 — TemplateGenes from brief OR ingested template
// ────────────────────────────────────────────────────────────────────────

/**
 * Curated fallback palettes (sourced from anthropics/skills/pptx +
 * iOfficeAI/AionUi morph-ppt-3d — two independent projects converged
 * on the SAME 10 sets, which makes them a de-facto standard).
 *
 * Use this list as anchor when the brief is ambiguous or LLM colour
 * inference would otherwise default to generic blue.
 *
 * See `ai-agent-ppt-research/06-final/references/curated-palettes.md`
 * for full HEX values, dominance rules, and selection decision tree.
 */
const CURATED_PALETTES_REMINDER = [
  "## Fallback palettes (use verbatim when brief is ambiguous)",
  "If the visual brief does NOT clearly imply primary/secondary/accent",
  "colors, SELECT one of these 10 curated palettes verbatim — do not",
  "invent intermediate HEX values. Set `source.kind = 'preset'` and",
  "include `summary` that references the chosen preset name.",
  "",
  "Specificity test (from Anthropic pptx skill): if swapping your",
  "colors into a completely different presentation would still 'work',",
  "you haven't made specific enough choices.",
  "",
  "  1. Midnight Executive — #1E2761 / #CADCFC / #FFFFFF — finance, executive briefings",
  "  2. Forest & Moss      — #2C5F2D / #97BC62 / #F5F5F5 — sustainability, healthcare, education",
  "  3. Coral Energy       — #F96167 / #F9E795 / #2F3C7E — product launch, consumer marketing",
  "  4. Warm Terracotta    — #B85042 / #E7E8D1 / #A7BEAE — architecture, hospitality, lifestyle",
  "  5. Ocean Gradient     — #065A82 / #1C7293 / #21295C — tech, data, science",
  "  6. Charcoal Minimal   — #36454F / #F2F2F2 / #212121 — editorial, photography, minimalist",
  "  7. Teal Trust         — #028090 / #00A896 / #02C39A — healthcare, wellness, finance",
  "  8. Berry & Cream      — #6D2E46 / #A26769 / #ECE2D0 — brand, fashion, food",
  "  9. Sage Calm          — #84B59F / #69A297 / #50808E — wellness, slow brands",
  " 10. Cherry Bold        — #990011 / #FCF6F5 / #2F3C7E — bold marketing, keynotes",
  "",
  "Dominance rule (60-30-10): one color dominates 60-70% of visual",
  "weight, 1-2 supporting tones share 20-30%, one sharp accent gets",
  "10-15%. Never give all colors equal weight.",
].join("\n");

/**
 * Curated font pairings — same dual-source convergence as palettes.
 * Every stack MUST end with a Windows-preinstalled fallback so that
 * the PPTX renders consistently across Mac/Windows/WPS.
 */
const CURATED_FONT_PAIRINGS_REMINDER = [
  "## Font pairings (pick one; pair with CJK font for Chinese decks)",
  "  - Georgia / Calibri          — formal business, finance",
  "  - Arial Black / Arial        — bold marketing, product launches",
  "  - Calibri / Calibri Light    — clean corporate, minimal",
  "  - Cambria / Calibri          — traditional professional",
  "  - Trebuchet MS / Calibri     — friendly tech, startups",
  "  - Impact / Arial             — bold headlines, keynotes",
  "  - Palatino / Garamond        — elegant editorial, luxury",
  "  - Consolas / Calibri         — developer tools, technical",
  "",
  "For Chinese decks, lead the stack with a CJK font and END with a",
  "Windows-preinstalled fallback. Examples:",
  "  - Title : 'Source Han Serif SC', 'PingFang SC', 'Microsoft YaHei', Georgia, serif",
  "  - Body  : 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
  "",
  "HARD RULE: every font stack MUST end with one of: Microsoft YaHei,",
  "SimHei, SimSun, FangSong, KaiTi, Arial, Calibri, Cambria, Segoe UI,",
  "Times New Roman, Georgia, Impact, Trebuchet MS, Consolas. This is a",
  "non-negotiable Windows-compatibility requirement.",
].join("\n");

export function buildLayer0PromptFromBrief(
  outline: PresentationOutline,
  brief: VisualBrief,
): string {
  return [
    "## Task",
    "Output a `template_genes/v1` JSON object that captures a coherent visual",
    "design intent for the deck described below.  The intent will steer all",
    "subsequent design layers.",
    "",
    "## Project context",
    `- Topic: ${outline.title}`,
    `- Audience: ${outline.audience}`,
    `- Language: ${outline.language}`,
    `- Sections: ${outline.sections.map((s) => s.title).join(" / ")}`,
    "",
    "## Visual brief (must respect)",
    `- Tone: ${brief.deckTone}`,
    `- Color mode: ${brief.colorMode}`,
    `- Image language: ${brief.imageLanguage}`,
    `- Icon language: ${brief.iconLanguage}`,
    `- Shape language: ${brief.shapeLanguage}`,
    `- Density: ${brief.density}`,
    `- AVOID: ${brief.avoid.join(" / ")}`,
    "",
    CURATED_PALETTES_REMINDER,
    "",
    CURATED_FONT_PAIRINGS_REMINDER,
    "",
    "## Output schema",
    "Return ONE JSON object matching this TypeScript type:",
    "```ts",
    `{
  version: "template_genes/v1";
  source: { kind: "brief"; brief: VisualBrief };
  summary: string;            // 1-2 sentences, will be quoted to other AI calls
  designTokens: {
    colors: {
      primary: string;        // hex like "#0E8B5A"
      secondary: string;
      accents: string[];      // 0-4 hex colors
      neutral: string[];      // 2-4 hex colors (bg/surface/text-related neutrals)
      bg: string;
      surface: string;
      text: string;
      textMuted: string;
    };
    fonts: {
      titleLatin: string;
      titleEa: string;
      bodyLatin: string;
      bodyEa: string;
      mono: string;
    };
    rhythm: {
      density: "low" | "medium" | "high";
      pagePadding: { x: number; y: number };  // px
      preferredLayoutGrammar: "asymmetric_editorial" | "grid_corporate" | "mixed";
    };
  };
}`,
    "```",
    "",
    "Output the JSON only.",
  ].join("\n");
}

export function buildLayer0PromptFromIngestedTemplate(
  outline: PresentationOutline,
  ingestedTemplateJson: string,
): string {
  return [
    "## Task",
    "Distil the ingested PPT template descriptor below into a",
    "`template_genes/v1` JSON object that captures its visual identity for use",
    "as design anchor when generating a NEW deck on a different topic.",
    "",
    "## Project context (the new deck)",
    `- Topic: ${outline.title}`,
    `- Audience: ${outline.audience}`,
    `- Language: ${outline.language}`,
    `- Sections: ${outline.sections.map((s) => s.title).join(" / ")}`,
    "",
    "## Ingested template descriptor (the visual anchor)",
    "```json",
    ingestedTemplateJson,
    "```",
    "",
    "## Critical interpretation rules",
    "1. The `direct_palette_top10` reflects what the designer ACTUALLY used in",
    "   slides — trust it more than `override_scheme` or `raw_scheme` if they",
    "   differ.",
    "2. `additional_fonts` in master often shows the real Chinese typography",
    "   even when fontScheme is default.",
    "3. `avg_text_density` and median XML size suggest information density.",
    "",
    "## Output schema",
    "Same `template_genes/v1` schema as the brief-based variant; set",
    "`source.kind = 'ingested_template'` and `source.templateJsonPath` to the",
    "path the descriptor was loaded from.",
    "",
    "Output the JSON only.",
  ].join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// Layer 1 — StyleGenes (verbal DNA)
// ────────────────────────────────────────────────────────────────────────

export function buildLayer1Prompt(genes: TemplateGenes): string {
  return [
    "## Task",
    "Distil the design intent below into a `style_genes/v1` JSON object —",
    "four short verbal DNA statements that any subsequent prompt can quote",
    "to keep the deck visually coherent.",
    "",
    "## Template genes (input)",
    "```json",
    JSON.stringify(genes, null, 2),
    "```",
    "",
    "## Output schema",
    "```ts",
    `{
  version: "style_genes/v1";
  colorDna: string;          // 1-2 sentences on color strategy
  typographyDna: string;     // 1-2 sentences on type pairing + voice
  shapeDna: string;          // 1-2 sentences on cards/borders/radius/shadows
  rhythmDna: string;         // 1-2 sentences on density and layout grammar
}`,
    "```",
    "",
    "Each DNA value should be PRESCRIPTIVE (\"use X for Y\"), not descriptive.",
    "Output the JSON only.",
  ].join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// Layer 2 — GlobalConstitution
// ────────────────────────────────────────────────────────────────────────

export function buildLayer2Prompt(
  outline: PresentationOutline,
  pages: MvpPageDefinition[],
  genes: TemplateGenes,
  styleGenes: StyleGenes,
): string {
  const pageList = pages
    .map((p, i) => `  ${i + 1}. ${p.pageType} — ${p.title}`)
    .join("\n");

  return [
    "## Task",
    "Output a `global_constitution/v1` JSON object listing 6-8 hard rules",
    "that every page in this deck MUST follow to maintain visual coherence.",
    "",
    "## Deck overview",
    `- Title: ${outline.title}`,
    `- Pages:`,
    pageList,
    "",
    "## Style anchor (already locked)",
    `- Summary: ${genes.summary}`,
    `- Color DNA: ${styleGenes.colorDna}`,
    `- Typography DNA: ${styleGenes.typographyDna}`,
    `- Shape DNA: ${styleGenes.shapeDna}`,
    `- Rhythm DNA: ${styleGenes.rhythmDna}`,
    "",
    "## Output schema",
    "```ts",
    `{
  version: "global_constitution/v1";
  rules: string[];           // 6-8 imperative rules ("Use X never Y")
}`,
    "```",
    "",
    "Rules should be enforceable in HTML/CSS review.  Cover: color economy,",
    "typographic hierarchy, decoration discipline, information hierarchy,",
    "negative space, page marker / continuity.",
    "Output the JSON only.",
  ].join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// Layer 3 — PageBrief (per page)
// ────────────────────────────────────────────────────────────────────────

export function buildLayer3Prompt(
  page: MvpPageDefinition,
  outline: PresentationOutline,
  genes: TemplateGenes,
  styleGenes: StyleGenes,
  constitution: GlobalConstitution,
  pageAssets: PageAssetRef[] = [],
  previousArchetype?: LayoutArchetype,
): string {
  const pageJson = JSON.stringify(page, null, 2);

  return [
    "## Task",
    `Produce a \`page_brief/v1\` JSON object that gives the AI generating`,
    `THIS page direction without locking the layout.`,
    "",
    "## Deck context",
    `- Title: ${outline.title}`,
    `- Style summary: ${genes.summary}`,
    "",
    "## Style genes (DNA)",
    `- Color: ${styleGenes.colorDna}`,
    `- Typography: ${styleGenes.typographyDna}`,
    `- Shape: ${styleGenes.shapeDna}`,
    `- Rhythm: ${styleGenes.rhythmDna}`,
    "",
    "## Global constitution",
    constitution.rules.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    "",
    "## Page content",
    "```json",
    pageJson,
    "```",
    "",
    ...buildPageAssetPromptSection(page, pageAssets),
    "",
    "## Variance constraint (H8)",
    previousArchetype
      ? `Previous slide used layoutArchetype="${previousArchetype}". You MUST pick a DIFFERENT archetype for this slide.`
      : "This is the first slide; any archetype is allowed.",
    "",
    "## Output schema",
    "```ts",
    `{
  version: "page_brief/v1";
  pageId: string;            // copy from page content
  pageType: string;          // copy from page content
  intent: string;            // why this page exists
  primaryFocal: string;      // single visual focal element
  composition: string;       // grid / asymmetric / split / etc + key positions
  whatToAvoid: string;       // antipatterns specific to this page type
  tone: string;              // emotional register

  // REQUIRED — pick the visual element type for this page:
  visualElement: "icon_in_colored_circle" | "colored_block" | "large_stat_number"
                 | "chart" | "shape_composition" | "hero_image" | "diagram";
  // visualElementRequired: true unless pageType is cover/section_break/closing/quote
  visualElementRequired: boolean;

  // REQUIRED — pick the layout archetype (must differ from previous page):
  layoutArchetype: "centered-hero" | "split-visual" | "visual-hero" | "icon-grid"
                   | "two-column" | "comparison" | "timeline-horizontal" | "process-flow"
                   | "big-number" | "quote" | "title-bullets" | "device-triptych" | "section-divider";
}`,
    "```",
    "",
    "Output the JSON only.",
  ].join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// Layer 4 — per-page HTML
// ────────────────────────────────────────────────────────────────────────

export function buildLayer4Prompt(
  page: MvpPageDefinition,
  genes: TemplateGenes,
  styleGenes: StyleGenes,
  constitution: GlobalConstitution,
  brief: PageBrief,
  pageAssets: PageAssetRef[],
  designSystemCss: string,
  designSystemHref: string,
  /** Optional — when supplied, the spec_lock anchor is prepended FIRST so the
   *  LLM re-anchors on locked values before reading anything else. */
  specLock?: SpecLock,
): string {
  const pageJson = JSON.stringify(page, null, 2);
  const visualElementHint = brief.visualElement
    ? `(this page MUST contain a "${brief.visualElement}" element${brief.visualElementRequired ? " — REQUIRED" : ""})`
    : "";

  return [
    // ── SPEC-LOCK ANCHOR FIRST (per PPT Master rule #8 — verbatim re-read each page)
    ...(specLock ? [renderSpecLockAnchor(specLock), "", "---", ""] : []),
    "## Task",
    "Produce a single complete HTML file for ONE deck slide rendered at",
    "1920×1080 px.  The HTML MUST link to the provided design-system CSS",
    `via \`<link rel=\"stylesheet\" href=\"${designSystemHref}\">\` and use ONLY`,
    "the CSS variables and class names defined in that stylesheet (you may add",
    "page-local CSS in a single `<style>` block if needed for this page only).",
    "",
    "## Style anchor",
    `- Summary: ${genes.summary}`,
    `- Color DNA: ${styleGenes.colorDna}`,
    `- Typography DNA: ${styleGenes.typographyDna}`,
    `- Shape DNA: ${styleGenes.shapeDna}`,
    `- Rhythm DNA: ${styleGenes.rhythmDna}`,
    "",
    "## Global constitution (HARD RULES)",
    constitution.rules.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    "",
    "## Page brief",
    `- Intent: ${brief.intent}`,
    `- Primary focal: ${brief.primaryFocal}`,
    `- Composition: ${brief.composition}`,
    `- Avoid: ${brief.whatToAvoid}`,
    `- Tone: ${brief.tone}`,
    visualElementHint ? `- Visual element: ${brief.visualElement} ${visualElementHint}` : "",
    brief.layoutArchetype ? `- Layout archetype: ${brief.layoutArchetype}` : "",
    "",
    ...buildVariantLayoutRecipe(page),
    "",
    "## Page content (use ALL fields, do not omit)",
    "```json",
    pageJson,
    "```",
    "",
    ...buildPageAssetPromptSection(page, pageAssets),
    "",
    "## Design system CSS (the stylesheet your HTML will load)",
    "```css",
    designSystemCss,
    "```",
    "",
    "## Output requirements",
    "- Wrap in `<div class=\"slide\">` with a `<div class=\"slide-inner\">` child",
    "- 1920×1080 (the .slide class already declares this)",
    "- Use the EXACT asset file URLs provided in the page asset section; do not invent or rename paths",
    "- If a slot is marked REQUIRED, the final HTML must visibly reference it via `<img src=...>` or CSS `background-image`",
    "- DO NOT include the speaker note in the visible page (it is delivered",
    "  separately as PPT speaker note)",
    "- Avoid generic AI-PPT aesthetics: no hero photo backgrounds, no rainbow",
    "  gradients, no emoji, no decorative photo overlays",
    ...buildVariantHardRules(page),
    "",
    "Return one ```html fenced block only, complete with `<!DOCTYPE html>`,",
    "<html>, <head> with the link tag, and <body>.  No commentary.",
  ].join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// Retry prompt — structured error feedback (PPTAgent REPL pattern)
// ────────────────────────────────────────────────────────────────────────

/**
 * Build the retry suffix appended to SYSTEM_DESIGN when a Layer 4
 * attempt failed validation.  Borrowed from icip-cas/PPTAgent's REPL
 * feedback mechanism — telling the LLM exactly which checks failed
 * (with a one-line repair hint) is far more effective than a generic
 * "previous attempt failed" string.
 *
 * See `ai-agent-ppt-research/06-final/references/source-deep-dive.md` §6.
 */
export function buildRetrySystemSuffix(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return "\n\nThe previous attempt failed validation. Re-author this page.";
  }
  const lines = errors.map((e) => {
    const slot = e.slot ? ` (slot: ${e.slot})` : "";
    const expected =
      e.expected !== undefined && e.actual !== undefined
        ? ` [expected: ${e.expected}, got: ${e.actual}]`
        : "";
    return `  - [${e.code}]${slot}${expected} — ${e.suggestion}`;
  });
  return [
    "",
    "",
    "## Previous attempt failed validation",
    "",
    "Fix THESE specific issues — do not rewrite working sections from",
    "scratch, do not change unrelated content:",
    "",
    ...lines,
    "",
    "After fixing, re-validate against the same checks before emitting.",
  ].join("\n");
}

// Describe a visualElement enum value in natural language for prompts/error messages.
export function describeVisualElement(type: VisualElementType): string {
  switch (type) {
    case "icon_in_colored_circle":
      return "an SVG icon centred inside a coloured circle background";
    case "colored_block":
      return "a coloured rectangular block highlighting a key concept";
    case "large_stat_number":
      return "a large statistic number (≥56pt) with a short caption";
    case "chart":
      return "a chart (bar / line / pie) rendered via SVG or canvas";
    case "shape_composition":
      return "a composed geometric shape arrangement (rect/ellipse/path)";
    case "hero_image":
      return "a large hero image / illustration used as visual focus";
    case "diagram":
      return "a labelled diagram (mermaid-style or hand-composed)";
  }
}

function buildPageAssetPromptSection(
  page: MvpPageDefinition,
  pageAssets: PageAssetRef[],
): string[] {
  if (pageAssets.length === 0) {
    return [
      "## Page assets",
      "No local page assets are available for this page.",
    ];
  }

  return [
    "## Page assets",
    "The following local assets are available for this page.",
    "Use the exact `fileUrl` values when referencing them in HTML or CSS.",
    ...pageAssets.map((asset) => {
      const required = getRequiredAssetSlots(page).includes(asset.slot) ? "REQUIRED" : "optional";
      return `- ${asset.slot} [${asset.kind}, ${required}]` +
        `\n  fileUrl: ${asset.fileUrl}` +
        `\n  intended usage: ${describeAssetUsage(page, asset.slot)}`;
    }),
  ];
}

function getRequiredAssetSlots(page: MvpPageDefinition): string[] {
  switch (page.variantHint) {
    case "cover_hero_image":
      return ["hero_bg"];
    case "toc_card_grid_8":
      return ["bg_texture"];
    case "comparison_dual_image":
      return ["left_illustration", "right_illustration"];
    case "timeline_horizontal_5":
      return [
        "timeline_icon_1",
        "timeline_icon_2",
        "timeline_icon_3",
        "timeline_icon_4",
        "timeline_icon_5",
      ];
    case "process_flow_5":
      return ["process_illustration"];
    case "device_triptych_3":
      return ["device_image_1", "device_image_2", "device_image_3"];
    default:
      return [];
  }
}

function describeAssetUsage(page: MvpPageDefinition, slot: string): string {
  switch (page.variantHint) {
    case "cover_hero_image":
      if (slot === "hero_bg") return "Use as the dominant hero image or full-page cover background.";
      return "Use only if it supports the hero composition.";
    case "toc_card_grid_8":
      if (slot === "bg_texture") return "Use as a subtle page texture or low-contrast background anchor.";
      return "Use only as a supporting visual anchor.";
    case "comparison_dual_image":
      if (slot === "left_illustration") return "Place above or beside the left comparison block.";
      if (slot === "right_illustration") return "Place above or beside the right comparison block.";
      if (slot === "left_icon") return "Use as a small supporting icon for the left comparison heading.";
      if (slot === "right_icon") return "Use as a small supporting icon for the right comparison heading.";
      return "Use only if it strengthens the comparison hierarchy.";
    case "timeline_horizontal_5":
      if (slot.startsWith("timeline_icon_")) return "Use as the visual icon for its matching timeline node.";
      if (slot === "bg_texture") return "Use as a subtle background texture, not as a hero image.";
      if (slot === "summary_icon") return "Use as a small visual anchor for the summary strip or footer callout.";
      return "Use only if it supports the timeline reading flow.";
    case "process_flow_5":
      if (slot === "process_illustration") return "Use as the main process-cycle or workflow anchor for the page.";
      if (slot === "bg_texture") return "Use only as a low-contrast texture behind the process content.";
      return "Use only if it supports the workflow reading flow.";
    case "device_triptych_3":
      if (slot === "device_image_1") return "Use as the product visual for device card 1.";
      if (slot === "device_image_2") return "Use as the product visual for device card 2.";
      if (slot === "device_image_3") return "Use as the product visual for device card 3.";
      if (slot === "scenario_bg") return "Use as a subtle scenario photo band or low-contrast environment anchor.";
      return "Use only if it strengthens the device taxonomy.";
    default:
      return "Use only when it directly improves information hierarchy.";
  }
}

function buildVariantHardRules(page: MvpPageDefinition): string[] {
  switch (page.variantHint) {
    case "cover_hero_image":
      return [
        "- HARD RULE: this is `cover_hero_image`; you MUST use `hero_bg` as a visible hero image or full-page background",
        "- HARD RULE: do not render this page as text-only card layout",
        "- HARD RULE: avoid a generic centered translucent rectangle floating in the middle of the page",
      ];
    case "toc_card_grid_8":
      return [
        "- HARD RULE: this is `toc_card_grid_8`; do not output a plain white page with 8 isolated cards only",
        "- HARD RULE: use `bg_texture` as a subtle page-level visual anchor if provided",
        "- HARD RULE: all 8 TOC items must remain visible; do not hide, collapse, or omit any card",
      ];
    case "comparison_dual_image":
      return [
        "- HARD RULE: this is `comparison_dual_image`; you MUST render both left and right illustrations",
        "- HARD RULE: the two comparison halves must each have a clear visual + text hierarchy, not just bullet lists",
        "- HARD RULE: left and right halves must not feel mirrored-white-card clones; use distinct tone treatment or emphasis blocks",
      ];
    case "timeline_horizontal_5":
      return [
        "- HARD RULE: this is `timeline_horizontal_5`; you MUST render all five timeline icons if provided",
        "- HARD RULE: avoid pure text timeline; each node needs a visible icon anchor plus year/title/detail hierarchy",
        "- HARD RULE: do not place all cards on one flat baseline; the chronology must have alternating rhythm or staggered hierarchy",
      ];
    case "process_flow_5":
      return [
        "- HARD RULE: this is `process_flow_5`; you MUST use `process_illustration` as a visible workflow anchor",
        "- HARD RULE: render all five steps with explicit order, not as an undifferentiated bullet list",
      ];
    case "device_triptych_3":
      return [
        "- HARD RULE: this is `device_triptych_3`; you MUST render all three device images if provided",
        "- HARD RULE: each device card must combine image + device name + deployment scenario + concise note",
      ];
    default:
      return [];
  }
}

function buildVariantLayoutRecipe(page: MvpPageDefinition): string[] {
  switch (page.variantHint) {
    case "cover_hero_image":
      return [
        "## Variant layout recipe",
        "- Use a bold editorial cover: the hero image should dominate 55-75% of the canvas",
        "- Title block should lock to the left edge or lower-left region and visibly bite into the hero image field",
        "- If using a white card/panel, keep it edge-anchored and asymmetric, not centered",
        "- The page should feel like a finished opening slide, not a generic title page",
      ];
    case "toc_card_grid_8":
      return [
        "## Variant layout recipe",
        "- Use a hierarchy-rich contents page, not a uniform 4x2 card wall",
        "- Recommended composition: 1 featured wide card, 2 medium cards, 5 compact cards, all 8 visible",
        "- Compact cards should hug their content; avoid oversized empty boxes or rigid equal-height rows",
        "- Preserve strong scanning rhythm: the eye should move from title area to featured section to smaller cards",
      ];
    case "comparison_dual_image":
      return [
        "## Variant layout recipe",
        "- Build a real contrast page: two image-led halves with distinct visual emphasis, not two identical cards",
        "- Each side should include one dominant message line plus supporting bullets",
        "- Use color or tint contrast to signal advantage vs limitation immediately",
      ];
    case "timeline_horizontal_5":
      return [
        "## Variant layout recipe",
        "- Build a clear horizontal chronology with year markers, icons, and a visible connector track",
        "- Use staggered rhythm: alternate node depth or card position so the page does not read as identical repeated boxes",
        "- Use one additional emphasis device such as a summary bar, milestone highlight, or stronger endpoint treatment",
        "- Keep the timeline readable in one glance from left to right",
      ];
    case "process_flow_5":
      return [
        "## Variant layout recipe",
        "- Use the process illustration as a visual anchor, then map the five steps into an obvious execution order",
        "- The page should feel operational and procedural, not like a generic icon + bullet layout",
      ];
    case "device_triptych_3":
      return [
        "## Variant layout recipe",
        "- Present the three device types as a clean product taxonomy with strong image-first cards",
        "- Crop product images tightly around the hardware; avoid large white dead margins inside the image frame",
        "- Use stronger scenario chips or labels so the deployment context reads immediately",
        "- Each card must clearly bind device image, deployment scenario, and a practical deployment note",
      ];
    default:
      return [];
  }
}
