/**
 * AI-pipeline types — LandPPT-style 4-layer creative pipeline.
 *
 * Background:  see docs/research/template-generation-paradigms.md §4.1, §8.5, §8.6.
 *
 * Layer flow:
 *   Layer 0  →  TemplateGenes        (project-level design intent)
 *   Layer 1  →  StyleGenes           (design DNA distilled from template)
 *   Layer 2  →  GlobalConstitution   (deck-wide visual rules)
 *   Layer 3  →  PageBrief[]          (per-page creative direction)
 *   Layer 4  →  RenderedPage[]       (HTML + speaker note + meta)
 */

import type {
  AssetPlan,
  IconLibrary,
  IconStrokeWidth,
  ImagePaletteUsage,
  ImageRendering,
  ImageType,
  MvpPageDefinition,
  PresentationOutline,
  VisualBrief,
} from "../types";

// ────────────────────────────────────────────────────────────────────────
// Inputs
// ────────────────────────────────────────────────────────────────────────

/** Where Layer 0 sources its style anchor. */
export type Layer0Source =
  | { kind: "brief"; brief: VisualBrief }
  | { kind: "ingested_template"; templateJsonPath: string };

export type PipelineInputs = {
  outline: PresentationOutline;
  pages: MvpPageDefinition[];
  layer0Source: Layer0Source;
  pageAssets?: PageAssetMap;
  /** Where to write intermediate artifacts and final outputs. */
  sessionDir: string;
};

export type PageAssetRef = {
  slot: string;
  kind: AssetPlan["pageAssets"][number]["assets"][number]["kind"];
  path: string;
  fileUrl: string;
};

export type PageAssetMap = Record<string, PageAssetRef[]>;

// ────────────────────────────────────────────────────────────────────────
// Layer 0 — TemplateGenes (project design intent, machine-friendly)
// ────────────────────────────────────────────────────────────────────────

export type TemplateGenes = {
  version: "template_genes/v1";
  source: Layer0Source;
  /** Concise human-readable summary the AI uses as anchor in later layers. */
  summary: string;
  designTokens: {
    colors: {
      primary: string;
      secondary: string;
      accents: string[];
      neutral: string[];
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
      pagePadding: { x: number; y: number };
      preferredLayoutGrammar: "asymmetric_editorial" | "grid_corporate" | "mixed";
    };
  };
};

// ────────────────────────────────────────────────────────────────────────
// Layer 1 — StyleGenes (verbal DNA the LLM can quote in subsequent prompts)
// ────────────────────────────────────────────────────────────────────────

export type StyleGenes = {
  version: "style_genes/v1";
  colorDna: string;
  typographyDna: string;
  shapeDna: string;
  rhythmDna: string;
};

// ────────────────────────────────────────────────────────────────────────
// Layer 2 — GlobalConstitution (deck-wide rules)
// ────────────────────────────────────────────────────────────────────────

export type GlobalConstitution = {
  version: "global_constitution/v1";
  rules: string[];
};

// ────────────────────────────────────────────────────────────────────────
// Layer 3 — PageBrief (per-page creative direction)
// ────────────────────────────────────────────────────────────────────────

/**
 * Visual element enum — borrowed from AionUi morph-ppt-3d's "Every 3
 * content slides, at least 1 non-text visual element" rule, with the
 * specific visual-types enumeration from danny0926/ppt-skills.
 *
 * Sourced from `editorial-ppt` skill `references/hard-rules.md` H4.
 */
export type VisualElementType =
  | "icon_in_colored_circle"
  | "colored_block"
  | "large_stat_number"
  | "chart"
  | "shape_composition"
  | "hero_image"
  | "diagram";

/**
 * Layout archetype enum — borrowed from oh-my-ppt's 9 layoutIntent
 * enum + danny0926/ppt-skills 15-layout-type catalog (kept narrow
 * here to match our 6 page types but extensible).
 */
export type LayoutArchetype =
  | "centered-hero"
  | "split-visual"
  | "visual-hero"
  | "icon-grid"
  | "two-column"
  | "comparison"
  | "timeline-horizontal"
  | "process-flow"
  | "big-number"
  | "quote"
  | "title-bullets"
  | "device-triptych"
  | "section-divider";

export type PageBrief = {
  version: "page_brief/v1";
  pageId: string;
  pageType: MvpPageDefinition["pageType"];
  intent: string;
  primaryFocal: string;
  composition: string;
  whatToAvoid: string;
  tone: string;

  /** Optional (C8) — required visual element type for this page.
   *  Layer 4 validation enforces presence if `visualElementRequired` true. */
  visualElement?: VisualElementType;
  visualElementRequired?: boolean;

  /** Optional (H8) — locked layout archetype for variance checking.
   *  Generator MUST emit a different archetype than the previous page. */
  layoutArchetype?: LayoutArchetype;
};

// ────────────────────────────────────────────────────────────────────────
// Layer 4 — RenderedPage (HTML + meta)
// ────────────────────────────────────────────────────────────────────────

export type RenderedPage = {
  pageId: string;
  pageType: MvpPageDefinition["pageType"];
  htmlPath: string;
  speakerNote: string;
  /** Number of validation retries used. 0 = first try. */
  retryCount: number;
  /** Whether the placeholder fallback was emitted (Layer 4 retry exhausted). */
  fallback?: boolean;
};

// ────────────────────────────────────────────────────────────────────────
// SpecLock (Layer 1.5) — machine contract preventing per-page drift
// ────────────────────────────────────────────────────────────────────────

/**
 * Anti-drift machine contract.  Borrowed from hugohe3/ppt-master
 * `spec_lock.md` (rule #8: SPEC_LOCK RE-READ PER PAGE) + arcsin1/oh-my-ppt
 * DesignContract.  Layer 4 prompts quote this verbatim as the FIRST
 * anchor so the LLM can't invent intermediate hex / font / icon values.
 *
 * Full schema documented in
 * `ai-agent-ppt-research/06-final/references/spec-lock-schema.md`.
 */
export type SpecLock = {
  version: "spec_lock/v1";

  palette: {
    primary: string;
    secondary: string;
    accents: string[];
    neutrals: string[];
    bg: string;
    surface: string;
    text: string;
    textMuted: string;
    /** Union of every distinct HEX in this lock — drift detector references this. */
    allValues: string[];
  };

  typography: {
    titleStack: string;
    bodyStack: string;
    monoStack: string;
    titleSize: number;
    sectionSize: number;
    bodySize: number;
    captionSize: number;
    /** Union of every distinct font family in this lock. */
    allFamilies: string[];
  };

  iconLibrary: IconLibrary;
  iconStrokeWidth: IconStrokeWidth;

  imageLock: {
    rendering: ImageRendering;
    palette: ImagePaletteUsage;
    types: Partial<Record<string, ImageType>>;
  };

  constraints: {
    maxBulletsPerSlide: number; // default 5
    maxWordsHeadline: number; // default 8
    minVisualRatio: number; // default 0.6
    contrastMinRatio: number; // default 4.5 (WCAG AA body)
    colorEconomyMax: number; // default 4
    layoutVarianceWindow: number; // default 5 (≥3 distinct in 5-page window)
    maxNestingDepth: number; // default 4
  };
};

// ────────────────────────────────────────────────────────────────────────
// Validation result objects (structured retry feedback — C5)
// ────────────────────────────────────────────────────────────────────────

/**
 * Structured error returned by validators.  Replaces the previous
 * stringly-typed signature of `validateHtml`.  Borrowed from
 * icip-cas/PPTAgent REPL feedback pattern — when retry prompts contain
 * specific code+suggestion, the LLM repairs targeted issues rather than
 * regenerating the entire page from scratch.
 */
export type ValidationErrorCode =
  | "empty_html"
  | "size_too_small"
  | "missing_body"
  | "missing_slide_class"
  | "hidden_content"
  | "missing_content"
  | "missing_asset"
  | "missing_visual_asset_markup"
  | "missing_visual_element"
  | "color_drift"
  | "font_drift";

export type ValidationError = {
  code: ValidationErrorCode;
  /** Optional slot/element name that failed. */
  slot?: string;
  /** Expected value (HEX, family name, asset URL, etc.). */
  expected?: string;
  /** Actual observed value (or null if completely missing). */
  actual?: string;
  /** One-line, actionable repair hint — injected verbatim into retry prompt. */
  suggestion: string;
};

// ────────────────────────────────────────────────────────────────────────
// Pipeline outputs
// ────────────────────────────────────────────────────────────────────────

export type PipelineArtifacts = {
  templateGenes: TemplateGenes;
  styleGenes: StyleGenes;
  specLock: SpecLock;
  globalConstitution: GlobalConstitution;
  pageBriefs: PageBrief[];
  renderedPages: RenderedPage[];
  designSystemCssPath: string;
  /** Aggregate count of pages that hit the placeholder fallback (anti-pattern). */
  placeholderFallbackCount: number;
};
