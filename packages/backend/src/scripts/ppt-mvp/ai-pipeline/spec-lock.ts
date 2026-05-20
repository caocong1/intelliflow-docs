/**
 * SpecLock builder + validator + render helpers.
 *
 * SpecLock is the "anti-drift machine contract" — it freezes every
 * design value (HEX colors, font family names, icon library, image-lock
 * triple) into a JSON file that Layer 4 prompts quote verbatim before
 * each page is generated.  Borrowed from hugohe3/ppt-master rule #8
 * ("SPEC_LOCK RE-READ PER PAGE") and arcsin1/oh-my-ppt DesignContract.
 *
 * Full schema/rationale: `ai-agent-ppt-research/06-final/references/spec-lock-schema.md`
 */

import type { IconLibrary, IconStrokeWidth, VisualBrief } from "../types";
import { ensureWindowsFallback } from "./css-from-genes";
import type { SpecLock, StyleGenes, TemplateGenes } from "./types";

// ────────────────────────────────────────────────────────────────────────
// Defaults
// ────────────────────────────────────────────────────────────────────────

/** Default constraints when the brief / genes do not override them. */
const DEFAULT_CONSTRAINTS: SpecLock["constraints"] = {
  maxBulletsPerSlide: 5,
  maxWordsHeadline: 8,
  minVisualRatio: 0.6,
  contrastMinRatio: 4.5,
  colorEconomyMax: 4,
  layoutVarianceWindow: 5,
  maxNestingDepth: 4,
};

/** Default image lock when the brief does not supply one. */
const DEFAULT_IMAGE_LOCK: SpecLock["imageLock"] = {
  rendering: "editorial-photography",
  palette: { dominantUsage: 0.6, supportingUsage: 0.3, accentUsage: 0.1 },
  types: {},
};

const DEFAULT_ICON_LIBRARY: IconLibrary = "tabler-outline";
const DEFAULT_ICON_STROKE: IconStrokeWidth = 2;

// ────────────────────────────────────────────────────────────────────────
// Builder
// ────────────────────────────────────────────────────────────────────────

/**
 * Build a SpecLock from already-derived TemplateGenes + StyleGenes,
 * optionally enriched by an upstream VisualBrief (for image-lock / icon
 * library fields that StyleGenes does not currently express).
 *
 * This is a deterministic function — no LLM call.  Layers 0-1 already
 * locked the high-level intent; this step crystallises it into a
 * machine contract.
 */
export function buildSpecLockFromGenes(
  genes: TemplateGenes,
  _styleGenes: StyleGenes,
  brief?: VisualBrief,
): SpecLock {
  const c = genes.designTokens.colors;
  const f = genes.designTokens.fonts;

  // Build font stacks with Windows-preinstalled fallback (reuse the
  // same helper that drives `css-from-genes.ts` so the spec_lock value
  // and the rendered CSS always agree).
  const titleStack = ensureWindowsFallback([
    `"${f.titleEa}"`,
    `"${f.titleLatin}"`,
    "-apple-system",
    "sans-serif",
  ]).join(", ");
  const bodyStack = ensureWindowsFallback([
    `"${f.bodyEa}"`,
    `"${f.bodyLatin}"`,
    "-apple-system",
    "sans-serif",
  ]).join(", ");
  const monoStack = ensureWindowsFallback([
    `"${f.mono}"`,
    '"JetBrains Mono"',
    "monospace",
  ]).join(", ");

  const palette = {
    primary: c.primary,
    secondary: c.secondary,
    accents: [...c.accents],
    neutrals: [...c.neutral],
    bg: c.bg,
    surface: c.surface,
    text: c.text,
    textMuted: c.textMuted,
    allValues: distinct([
      c.primary,
      c.secondary,
      ...c.accents,
      ...c.neutral,
      c.bg,
      c.surface,
      c.text,
      c.textMuted,
    ]),
  };

  const typography = {
    titleStack,
    bodyStack,
    monoStack,
    titleSize: 50, // matches --size-display-s in css-from-genes.ts
    sectionSize: 32,
    bodySize: 19,
    captionSize: 14,
    allFamilies: distinct([
      f.titleEa,
      f.titleLatin,
      f.bodyEa,
      f.bodyLatin,
      f.mono,
    ]),
  };

  const imageLock: SpecLock["imageLock"] = {
    rendering: brief?.imageRendering ?? DEFAULT_IMAGE_LOCK.rendering,
    palette: brief?.imagePalette ?? DEFAULT_IMAGE_LOCK.palette,
    types: brief?.imageTypes ?? {},
  };

  return {
    version: "spec_lock/v1",
    palette,
    typography,
    iconLibrary: brief?.iconLibrary ?? DEFAULT_ICON_LIBRARY,
    iconStrokeWidth: brief?.iconStrokeWidth ?? DEFAULT_ICON_STROKE,
    imageLock,
    constraints: DEFAULT_CONSTRAINTS,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Validator
// ────────────────────────────────────────────────────────────────────────

/**
 * Verify the spec_lock satisfies the hard rules from
 * `ai-agent-ppt-research/06-final/references/hard-rules.md`.
 *
 * Returns a list of failure reasons; empty list means valid.
 */
export function validateSpecLock(lock: SpecLock): string[] {
  const errors: string[] = [];

  // Palette HEX format + allValues coverage
  const hexRe = /^#[0-9A-Fa-f]{6}$/;
  const expectedHexes = new Set([
    lock.palette.primary,
    lock.palette.secondary,
    ...lock.palette.accents,
    ...lock.palette.neutrals,
    lock.palette.bg,
    lock.palette.surface,
    lock.palette.text,
    lock.palette.textMuted,
  ]);
  for (const hex of expectedHexes) {
    if (!hexRe.test(hex)) {
      errors.push(`Palette HEX "${hex}" must match /^#[0-9A-Fa-f]{6}$/`);
    }
  }
  for (const hex of expectedHexes) {
    if (!lock.palette.allValues.includes(hex)) {
      errors.push(`palette.allValues missing distinct value ${hex}`);
    }
  }

  // Typography H1 (title ≥ 2× body) + H2 (body ≥ 16pt)
  if (lock.typography.titleSize < lock.typography.bodySize * 2) {
    errors.push(
      `H1 violated: titleSize ${lock.typography.titleSize} < bodySize ${lock.typography.bodySize} × 2`,
    );
  }
  if (lock.typography.bodySize < 16) {
    errors.push(`H2 violated: bodySize ${lock.typography.bodySize} < 16pt`);
  }

  // Font stacks must end with a Windows-preinstalled fallback (NEVER-list #14).
  // `ensureWindowsFallback` already guarantees this for builder output, but
  // ingested spec_lock files might bypass the builder, so validate explicitly.
  for (const [name, stack] of [
    ["titleStack", lock.typography.titleStack],
    ["bodyStack", lock.typography.bodyStack],
    ["monoStack", lock.typography.monoStack],
  ] as const) {
    if (!hasWindowsFallback(stack)) {
      errors.push(`typography.${name} missing a Windows-preinstalled font fallback: "${stack}"`);
    }
  }

  // Image-lock palette sum ≈ 1.0
  const usageSum =
    lock.imageLock.palette.dominantUsage +
    lock.imageLock.palette.supportingUsage +
    lock.imageLock.palette.accentUsage;
  if (Math.abs(usageSum - 1.0) > 0.05) {
    errors.push(`imageLock.palette usages sum to ${usageSum.toFixed(2)} (should be ~1.0 ± 0.05)`);
  }

  // Constraint sanity
  const cc = lock.constraints;
  if (cc.maxBulletsPerSlide <= 0 || cc.maxBulletsPerSlide > 10) {
    errors.push(`constraints.maxBulletsPerSlide ${cc.maxBulletsPerSlide} out of [1,10]`);
  }
  if (cc.minVisualRatio < 0.3 || cc.minVisualRatio > 0.9) {
    errors.push(`constraints.minVisualRatio ${cc.minVisualRatio} out of [0.3,0.9]`);
  }
  if (cc.colorEconomyMax < 2 || cc.colorEconomyMax > 8) {
    errors.push(`constraints.colorEconomyMax ${cc.colorEconomyMax} out of [2,8]`);
  }

  return errors;
}

// ────────────────────────────────────────────────────────────────────────
// Render helpers (used by prompts.ts to inject spec_lock anchor)
// ────────────────────────────────────────────────────────────────────────

/**
 * Render the spec_lock as the markdown anchor block that Layer 4
 * prompts paste in BEFORE the page task description.  See the
 * `editorial-ppt` skill's `references/spec-lock-schema.md` for the
 * canonical template — this function emits an abridged but still
 * unambiguous version.
 */
export function renderSpecLockAnchor(lock: SpecLock): string {
  const palette = lock.palette;
  const typo = lock.typography;
  const constraints = lock.constraints;
  const imageLock = lock.imageLock;
  const imageTypes = Object.entries(imageLock.types)
    .map(([slot, t]) => `${slot} → ${t}`)
    .join(", ");

  return [
    "## Locked Design Contract (spec_lock — do not invent values)",
    "",
    "You MUST use ONLY the values below.  Do not interpolate, adjust, or",
    '"match similar".  Any HEX / font / icon-library / image-style not in',
    "this contract is FORBIDDEN.  Violations trigger a retry.",
    "",
    "**Palette** (only these HEX values may appear in the output):",
    `  primary    : ${palette.primary}`,
    `  secondary  : ${palette.secondary}`,
    `  accents    : ${palette.accents.join(", ") || "(none)"}`,
    `  neutrals   : ${palette.neutrals.join(", ") || "(none)"}`,
    `  bg         : ${palette.bg}`,
    `  surface    : ${palette.surface}`,
    `  text       : ${palette.text}`,
    `  textMuted  : ${palette.textMuted}`,
    "",
    "**Typography** (use these stacks verbatim):",
    `  Title font-stack : ${typo.titleStack}`,
    `  Body  font-stack : ${typo.bodyStack}`,
    `  Mono  font-stack : ${typo.monoStack}`,
    `  Sizes            : title ${typo.titleSize}px, section ${typo.sectionSize}px, body ${typo.bodySize}px, caption ${typo.captionSize}px`,
    `  Title ≥ 2× body  : ${typo.titleSize >= typo.bodySize * 2 ? "OK" : "VIOLATED"}`,
    "",
    `**Icon library** : ${lock.iconLibrary} (stroke-width ${lock.iconStrokeWidth}px)`,
    "  Do NOT mix icon libraries.  Do NOT introduce SVGs from other libraries.",
    "",
    "**Image lock** (every image must honour these dimensions):",
    `  Rendering family : ${imageLock.rendering}`,
    `  Palette usage    : dominant ${pct(imageLock.palette.dominantUsage)}, supporting ${pct(imageLock.palette.supportingUsage)}, accent ${pct(imageLock.palette.accentUsage)}`,
    imageTypes ? `  Per-slot types   : ${imageTypes}` : "  Per-slot types   : (use default for slot)",
    "",
    "**Hard constraints** (any violation triggers retry):",
    `  - Body text ≥ ${constraints.maxBulletsPerSlide > 0 ? "16pt" : "16pt"}`,
    `  - Max ${constraints.maxBulletsPerSlide} bullets per slide`,
    `  - Max ${constraints.maxWordsHeadline} words per headline`,
    `  - At least one non-text visual element on every content slide`,
    `  - Max ${constraints.colorEconomyMax} distinct colors per slide`,
    `  - Visual area ≥ ${pct(constraints.minVisualRatio)} of content area`,
    `  - Contrast ≥ ${constraints.contrastMinRatio.toFixed(1)}:1 (WCAG AA)`,
    `  - Max HTML nesting depth ${constraints.maxNestingDepth}`,
    "",
    "Before authoring this page, RE-ANCHOR on the values above.  If a",
    "color/font you would naturally reach for is not in this contract,",
    "it does NOT exist for this deck.  Pick from the locked values only.",
  ].join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// Helpers (private)
// ────────────────────────────────────────────────────────────────────────

function distinct<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function hasWindowsFallback(stack: string): boolean {
  // Replicate ensureWindowsFallback's detection so the validator stays
  // independent of CSS rendering order.
  const names = stack
    .split(",")
    .map((n) => n.trim().replace(/^["']|["']$/g, ""));
  const windowsSafe = new Set([
    "Microsoft YaHei",
    "Microsoft YaHei Light",
    "SimHei",
    "SimSun",
    "FangSong",
    "KaiTi",
    "Arial",
    "Arial Black",
    "Calibri",
    "Calibri Light",
    "Cambria",
    "Segoe UI",
    "Times New Roman",
    "Georgia",
    "Impact",
    "Trebuchet MS",
    "Consolas",
    "Courier New",
    "Tahoma",
    "Verdana",
  ]);
  return names.some((n) => windowsSafe.has(n));
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
