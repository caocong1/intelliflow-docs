/**
 * Visual QA — Track A (subagent review) + Track B (deterministic detector).
 *
 * Borrowed from:
 * - anthropics/skills/pptx — "USE SUBAGENTS — even for 2-3 slides" + 11-item checklist
 * - daymade/claude-code-skills/ppt-creator — 10-dim × 10-point RUBRIC with ≥75 ship threshold
 * - impeccable/critique — double-blind Assessment A (LLM) + B (detector)
 * - icip-cas/PPTAgent — PPTEval Content/Design/Coherence rubric anchors
 *
 * Run AFTER per-page HTML rendering, BEFORE PNG/PPTX packing.  Surfaces
 * a structured report so the caller can decide whether to regenerate
 * weak pages, ship as-is, or alert the user.
 *
 * Full methodology: `ai-agent-ppt-research/06-final/references/visual-qa-checklist.md`
 * + `references/rubric.md`.
 */

import { readFile } from "node:fs/promises";
import { callClaude, extractJson } from "./claude-client";
import type { RenderedPage, SpecLock } from "./types";

// ────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────

export type QaSeverity = "high" | "medium" | "low";

export type QaViolation = {
  slideId: string;
  item: number; // 1-11 from visual-qa-checklist
  severity: QaSeverity;
  what: string;
  where?: string;
};

export type QaRubricDimension =
  | "goal_clarity"
  | "story_structure"
  | "slide_assertions"
  | "evidence_quality"
  | "chart_fit"
  | "visual_and_accessibility"
  | "coherence_and_transitions"
  | "speakability"
  | "deliverables_complete"
  | "robustness";

export type QaScores = Record<QaRubricDimension, number>; // each 0-10

export type QaResult = {
  /** Track A subagent output (or null if disabled / failed). */
  subagent: {
    scores: QaScores;
    total: number; // sum of 10 dimensions
    passed: boolean; // total >= threshold
    weakestDimensions: QaRubricDimension[]; // up to 3
    violations: QaViolation[];
  } | null;

  /** Track B deterministic detector output (always present). */
  detector: {
    colorDrift: Array<{ slideId: string; foundHex: string; allowed: string[] }>;
    fontDrift: Array<{ slideId: string; foundFamily: string; allowed: string[] }>;
    bannedFeatures: Array<{ slideId: string; pattern: string }>;
    placeholderResidue: Array<{ slideId: string; match: string }>;
  };

  /** Pages the QA recommends regenerating (rubric < threshold OR high-severity). */
  needsRegenerate: string[];

  /** Overall pass/fail synthesis. */
  passed: boolean;
};

export type RunVisualQaOptions = {
  /** Rubric ship threshold (sum of 10 dimensions). Default 75. */
  threshold?: number;
  /** Set to true to skip the LLM subagent (Track B only — fast / token-free). */
  detectorOnly?: boolean;
  /** Mock provider key for subagent call, when in mock/test mode. */
  mockProvider?: (key: string) => string | undefined;
  /** Force mock mode for the subagent (throws if mockProvider has no entry). */
  forceMock?: boolean;
};

// ────────────────────────────────────────────────────────────────────────
// Track B — deterministic detector
// ────────────────────────────────────────────────────────────────────────

const HEX_RE = /#[0-9A-Fa-f]{6}\b/g;
const FONT_FAMILY_RE = /font-family\s*:\s*([^;{}]+?)\s*(?:[;}]|$)/gi;
const PLACEHOLDER_RES = [
  /\bxxxx+\b/i,
  /\blorem\s+ipsum\b/i,
  /\b(insert|placeholder|tbd|todo|fixme)\b/i,
  /\bplaceholder text\b/i,
];
const BANNED_FEATURE_RES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /class\s*=\s*["'][^"']*\btext-xs\b/, label: "tailwind text-xs (forbid <16pt body)" },
  { pattern: /class\s*=\s*["'][^"']*\btext-sm\b/, label: "tailwind text-sm (forbid <16pt body)" },
  { pattern: /opacity\s*:\s*0\b/, label: "opacity:0 as initial state (breaks PNG capture)" },
  { pattern: /visibility\s*:\s*hidden\b/, label: "visibility:hidden as initial state" },
  { pattern: /<iframe[\s>]/i, label: "iframe forbidden in slide HTML" },
  { pattern: /\b(font-size)\s*:\s*\d+\s*v[hw]\b/i, label: "vw/vh font units break PPT export" },
];

function detectColorDrift(slideId: string, html: string, allowed: Set<string>) {
  const found = new Set<string>();
  // strip CSS variable declarations (those are spec_lock-derived) so we
  // only see literal hex in actual usage
  for (const match of html.matchAll(HEX_RE)) {
    const hex = match[0].toUpperCase();
    if (!allowed.has(hex.toUpperCase()) && !allowed.has(hex)) {
      found.add(hex);
    }
  }
  return [...found].map((foundHex) => ({
    slideId,
    foundHex,
    allowed: [...allowed],
  }));
}

function detectFontDrift(slideId: string, html: string, allowed: Set<string>) {
  const found = new Set<string>();
  for (const match of html.matchAll(FONT_FAMILY_RE)) {
    const stack = match[1] ?? "";
    const families = stack
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    for (const family of families) {
      if (!family || family.startsWith("var(") || family.startsWith("-apple")) continue;
      if (
        family === "serif" ||
        family === "sans-serif" ||
        family === "monospace" ||
        family === "system-ui"
      ) {
        continue;
      }
      if (![...allowed].some((a) => a.toLowerCase() === family.toLowerCase())) {
        found.add(family);
      }
    }
  }
  return [...found].map((foundFamily) => ({
    slideId,
    foundFamily,
    allowed: [...allowed],
  }));
}

function detectBannedFeatures(slideId: string, html: string) {
  const out: Array<{ slideId: string; pattern: string }> = [];
  for (const { pattern, label } of BANNED_FEATURE_RES) {
    if (pattern.test(html)) out.push({ slideId, pattern: label });
  }
  return out;
}

function detectPlaceholderResidue(slideId: string, html: string) {
  const out: Array<{ slideId: string; match: string }> = [];
  for (const re of PLACEHOLDER_RES) {
    const m = html.match(re);
    if (m) out.push({ slideId, match: m[0] });
  }
  return out;
}

async function runDetector(
  pages: RenderedPage[],
  specLock: SpecLock,
): Promise<QaResult["detector"]> {
  const allowedHex = new Set(specLock.palette.allValues.map((h) => h.toUpperCase()));
  const allowedFontStr = `${specLock.typography.titleStack}, ${specLock.typography.bodyStack}, ${specLock.typography.monoStack}`;
  const allowedFonts = new Set(
    allowedFontStr
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((s) => s.length > 0 && !s.startsWith("-apple")),
  );

  const colorDrift: QaResult["detector"]["colorDrift"] = [];
  const fontDrift: QaResult["detector"]["fontDrift"] = [];
  const bannedFeatures: QaResult["detector"]["bannedFeatures"] = [];
  const placeholderResidue: QaResult["detector"]["placeholderResidue"] = [];

  for (const page of pages) {
    if (page.fallback) continue; // placeholder pages are by definition off-spec
    let html: string;
    try {
      html = await readFile(page.htmlPath, "utf8");
    } catch {
      continue;
    }
    colorDrift.push(...detectColorDrift(page.pageId, html, allowedHex));
    fontDrift.push(...detectFontDrift(page.pageId, html, allowedFonts));
    bannedFeatures.push(...detectBannedFeatures(page.pageId, html));
    placeholderResidue.push(...detectPlaceholderResidue(page.pageId, html));
  }

  return { colorDrift, fontDrift, bannedFeatures, placeholderResidue };
}

// ────────────────────────────────────────────────────────────────────────
// Track A — LLM subagent
// ────────────────────────────────────────────────────────────────────────

const SUBAGENT_SYSTEM = [
  "You are a visual QA reviewer for an editorial-grade slide deck.",
  "",
  'Your mindset (anthropics/skills/pptx): "Assume there are problems.',
  "Your first inspection is almost never correct. Approach QA as a bug",
  "hunt, not a confirmation step. If you found zero issues on first",
  'inspection, you weren\'t looking hard enough."',
  "",
  "You receive: each slide's HTML source + the deck's locked spec_lock",
  "contract.  You score the deck against a 10-dimension rubric, each",
  "0-10.  Total < 75 triggers regeneration of the weakest 3 dimensions.",
  "",
  "Be honest.  Independent of the generator's intentions.  Pages that",
  "drift from spec_lock values OR violate any of the 11-item checklist",
  "should score low on the relevant dimensions.",
  "",
  "Output: ONE JSON object only inside a ```json fence — no commentary.",
].join("\n");

function buildSubagentPrompt(
  pages: RenderedPage[],
  htmlBodies: string[],
  specLock: SpecLock,
  detector: QaResult["detector"],
  threshold: number,
): string {
  return [
    "## Deck spec_lock (the locked design contract)",
    "```json",
    JSON.stringify(
      {
        palette: specLock.palette,
        typography: specLock.typography,
        iconLibrary: specLock.iconLibrary,
        imageLock: specLock.imageLock,
        constraints: specLock.constraints,
      },
      null,
      2,
    ),
    "```",
    "",
    "## Slides to review (one per page)",
    ...pages.map((p, i) => {
      const html = htmlBodies[i] ?? "(unreadable)";
      const truncated = html.length > 4000 ? `${html.slice(0, 4000)}\n... [truncated ${html.length - 4000} bytes]` : html;
      const tag = p.fallback ? " [PLACEHOLDER FALLBACK]" : "";
      return [
        `### Slide ${p.pageId} (${p.pageType})${tag}`,
        "```html",
        truncated,
        "```",
      ].join("\n");
    }),
    "",
    "## Track-B detector results (deterministic findings — corroborate or counter)",
    "```json",
    JSON.stringify(
      {
        colorDriftCount: detector.colorDrift.length,
        fontDriftCount: detector.fontDrift.length,
        bannedFeaturesCount: detector.bannedFeatures.length,
        placeholderResidueCount: detector.placeholderResidue.length,
        examples: {
          colorDrift: detector.colorDrift.slice(0, 5),
          fontDrift: detector.fontDrift.slice(0, 5),
          bannedFeatures: detector.bannedFeatures.slice(0, 5),
          placeholderResidue: detector.placeholderResidue.slice(0, 5),
        },
      },
      null,
      2,
    ),
    "```",
    "",
    "## Rubric (10 dimensions × 10 points, threshold ≥ " + threshold + ")",
    "1. goal_clarity — single clear conclusion per deck",
    "2. story_structure — Pyramid: 1 conclusion → 3-5 reasons → evidence; TOC + closing present",
    "3. slide_assertions — assertion-style headlines, not topic labels",
    "4. evidence_quality — concrete bullets (numbers, names, time periods)",
    "5. chart_fit — chart matches data shape, labelled, sourced",
    "6. visual_and_accessibility — WCAG AA contrast, no overlap, ≥1 visual per content slide",
    "7. coherence_and_transitions — spec_lock honoured verbatim; archetype variance",
    "8. speakability — 45-60s speaker notes per slide, structured",
    "9. deliverables_complete — all artefacts present",
    "10. robustness — fallbacks documented, gaps explicit",
    "",
    "## 11-item visual checklist (flag any violation as a QaViolation)",
    "1. Overlapping elements   2. Text overflow / cut off   3. Decoration sized for wrong line count",
    "4. Footer/citation collision   5. Elements < 0.3in apart   6. Uneven gaps",
    "7. Margin < 0.5in from edge   8. Columns drift   9. Low-contrast text/icons",
    "10. Text boxes too narrow → over-wrap   11. Placeholder residue (xxxx/lorem/[insert])",
    "",
    "## Output schema (JSON only)",
    "```ts",
    `{
  scores: {
    goal_clarity: 0-10, story_structure: 0-10, slide_assertions: 0-10,
    evidence_quality: 0-10, chart_fit: 0-10, visual_and_accessibility: 0-10,
    coherence_and_transitions: 0-10, speakability: 0-10,
    deliverables_complete: 0-10, robustness: 0-10
  };
  total: number;            // sum
  passed: boolean;          // total >= ${threshold}
  weakestDimensions: string[];   // up to 3 dimension names
  violations: Array<{
    slideId: string;
    item: 1-11;
    severity: "high" | "medium" | "low";
    what: string;
    where?: string;
  }>;
}`,
    "```",
    "",
    "Output the JSON only inside a ```json fence.",
  ].join("\n");
}

async function runSubagent(
  pages: RenderedPage[],
  specLock: SpecLock,
  detector: QaResult["detector"],
  options: RunVisualQaOptions,
): Promise<QaResult["subagent"]> {
  const threshold = options.threshold ?? 75;
  const htmlBodies = await Promise.all(
    pages.map(async (p) => {
      try {
        return await readFile(p.htmlPath, "utf8");
      } catch {
        return "(unreadable)";
      }
    }),
  );

  const key = "qa:subagent";
  const mockResp = options.mockProvider?.(key);
  if (mockResp == null && options.forceMock) {
    throw new Error(`forceMock=true but mockProvider returned no QA response for key "${key}"`);
  }

  const prompt = buildSubagentPrompt(pages, htmlBodies, specLock, detector, threshold);
  const result = await callClaude({
    prompt,
    system: SUBAGENT_SYSTEM,
    maxTokens: 2048,
    mock: mockResp != null,
    mockResponse: mockResp,
  });

  type RawSubagent = {
    scores: QaScores;
    total: number;
    passed: boolean;
    weakestDimensions: QaRubricDimension[];
    violations: QaViolation[];
  };

  try {
    const parsed = extractJson<RawSubagent>(result.content);
    return {
      scores: parsed.scores,
      total: parsed.total,
      passed: parsed.passed,
      weakestDimensions: parsed.weakestDimensions ?? [],
      violations: parsed.violations ?? [],
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Public entry point
// ────────────────────────────────────────────────────────────────────────

export async function runVisualQa(
  pages: RenderedPage[],
  specLock: SpecLock,
  options: RunVisualQaOptions = {},
): Promise<QaResult> {
  const threshold = options.threshold ?? 75;

  const detector = await runDetector(pages, specLock);

  const subagent = options.detectorOnly
    ? null
    : await runSubagent(pages, specLock, detector, options);

  // Synthesize: a slide needs regen if it appears in:
  //   - subagent.violations with severity == "high", OR
  //   - detector.bannedFeatures, OR
  //   - detector.placeholderResidue
  // PLUS if subagent.total < threshold, mark ALL non-fallback slides as needing regen.
  const slidesNeedingRegen = new Set<string>();
  for (const v of subagent?.violations ?? []) {
    if (v.severity === "high") slidesNeedingRegen.add(v.slideId);
  }
  for (const b of detector.bannedFeatures) slidesNeedingRegen.add(b.slideId);
  for (const p of detector.placeholderResidue) slidesNeedingRegen.add(p.slideId);
  if (subagent && !subagent.passed) {
    for (const p of pages) {
      if (!p.fallback) slidesNeedingRegen.add(p.pageId);
    }
  }

  const passed =
    (subagent ? subagent.total >= threshold : true) &&
    detector.placeholderResidue.length === 0 &&
    detector.bannedFeatures.length === 0;

  return {
    subagent,
    detector,
    needsRegenerate: [...slidesNeedingRegen].sort(),
    passed,
  };
}
