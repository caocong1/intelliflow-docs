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

import type { AssetPlan, MvpPageDefinition, PresentationOutline, VisualBrief } from "../types";

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

export type PageBrief = {
  version: "page_brief/v1";
  pageId: string;
  pageType: MvpPageDefinition["pageType"];
  intent: string;
  primaryFocal: string;
  composition: string;
  whatToAvoid: string;
  tone: string;
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
};

// ────────────────────────────────────────────────────────────────────────
// Pipeline outputs
// ────────────────────────────────────────────────────────────────────────

export type PipelineArtifacts = {
  templateGenes: TemplateGenes;
  styleGenes: StyleGenes;
  globalConstitution: GlobalConstitution;
  pageBriefs: PageBrief[];
  renderedPages: RenderedPage[];
  designSystemCssPath: string;
};
