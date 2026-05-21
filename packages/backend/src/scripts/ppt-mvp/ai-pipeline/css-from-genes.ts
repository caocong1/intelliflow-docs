/**
 * Deterministic design-system.css generator from TemplateGenes.
 *
 * We don't ask the AI to generate CSS — that's where it makes consistency
 * mistakes.  Instead, we substitute its TemplateGenes (machine-friendly
 * tokens) into a known-good template.  The AI's job in Layer 4 is to USE
 * these tokens, not invent them.
 */

import type { TemplateGenes } from "./types";

/**
 * Fonts pre-installed on Windows that we trust as final fallback.
 *
 * The LLM may emit `titleEa: "PingFang SC"` (Mac-only) and `titleLatin:
 * "Georgia"` (cross-platform), producing a stack like
 * `"PingFang SC", "Georgia", -apple-system, sans-serif` which silently
 * collapses to system default on Windows.  We append a Microsoft YaHei
 * tail (covers both CJK and Latin acceptably) whenever no known Windows
 * preinstalled font is already present.
 *
 * Sourced from `ai-agent-ppt-research/06-final/references/never-list.md`
 * #14 + `curated-palettes.md` font stacks.
 */
const WINDOWS_PREINSTALLED_FONTS = new Set([
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

const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "system-ui"]);

function stripQuotes(name: string): string {
  return name.trim().replace(/^["']|["']$/g, "");
}

/**
 * Build a font stack that is guaranteed to end with a Windows-preinstalled
 * font (before any generic family).  Existing Windows-preinstalled entries
 * in the stack short-circuit the appending logic.
 */
export function ensureWindowsFallback(stack: string[]): string[] {
  const result = stack.filter((entry) => entry && entry.trim().length > 0);
  const hasWindowsFont = result.some((entry) => {
    const cleaned = stripQuotes(entry);
    return WINDOWS_PREINSTALLED_FONTS.has(cleaned);
  });
  if (hasWindowsFont) return result;

  // Find the last index that is a generic family (serif / sans-serif / ...)
  let insertAt = result.length;
  for (let i = result.length - 1; i >= 0; i -= 1) {
    if (GENERIC_FAMILIES.has(stripQuotes(result[i]))) {
      insertAt = i;
    } else {
      break;
    }
  }
  result.splice(insertAt, 0, '"Microsoft YaHei"');
  return result;
}

export function generateDesignSystemCss(genes: TemplateGenes): string {
  const c = genes.designTokens.colors;
  const f = genes.designTokens.fonts;
  const r = genes.designTokens.rhythm;

  const displayStack = ensureWindowsFallback([
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

  return `/* ========================================================================
   AI-pipeline design system — generated from TemplateGenes.
   Source: ${genes.source.kind === "brief" ? "visual brief" : `ingested template ${genes.source.templateJsonPath}`}
   Summary: ${genes.summary}
   ======================================================================== */

:root {
  /* Color tokens (from TemplateGenes) */
  --primary: ${c.primary};
  --secondary: ${c.secondary};
  ${c.accents
    .slice(0, 4)
    .map((acc, i) => `--accent-${i + 1}: ${acc};`)
    .join("\n  ")}
  ${c.neutral
    .slice(0, 4)
    .map((n, i) => `--neutral-${i + 1}: ${n};`)
    .join("\n  ")}

  --bg-page: ${c.bg};
  --bg-surface: ${c.surface};
  --ink-display: ${c.text};
  --ink-body: ${c.text};
  --ink-mute: ${c.textMuted};
  --ink-faint: color-mix(in srgb, ${c.textMuted} 60%, ${c.bg});

  --line: color-mix(in srgb, ${c.textMuted} 25%, ${c.bg});
  --line-soft: color-mix(in srgb, ${c.textMuted} 12%, ${c.bg});

  /* Typography (font stacks include Windows-preinstalled fallback) */
  --font-display: ${displayStack};
  --font-body: ${bodyStack};
  --font-mono: ${monoStack};

  --size-eyebrow: 14px;
  --size-body: 19px;
  --size-card-title: 22px;
  --size-section: 32px;
  --size-display-s: 50px;
  --size-display: 68px;

  /* Rhythm */
  --pad-page-x: ${r.pagePadding.x}px;
  --pad-page-y: ${r.pagePadding.y}px;
  --gap-l: 40px;
  --gap-m: 24px;
  --gap-s: 16px;

  --radius-card: 10px;
  --radius-pill: 999px;
  --radius-tab: 4px;

  --shadow-card: 0 1px 2px rgba(15, 23, 42, 0.05), 0 6px 16px rgba(15, 23, 42, 0.05);
}

/* Constitution: page frame */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { font-family: var(--font-body); color: var(--ink-body); background: var(--bg-page); }

.slide {
  width: 1920px;
  height: 1080px;
  background: var(--bg-page);
  position: relative;
  overflow: hidden;
  font-family: var(--font-body);
  color: var(--ink-body);
}
.slide-inner {
  position: absolute;
  inset: var(--pad-page-y) var(--pad-page-x);
  display: flex;
  flex-direction: column;
  z-index: 1;
}

/* Common typography */
.eyebrow {
  font-family: var(--font-mono);
  font-size: var(--size-eyebrow);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--primary);
  font-weight: 600;
}
.eyebrow-mark { display: inline-flex; align-items: center; gap: 12px; }
.eyebrow-mark::before {
  content: "";
  width: 28px;
  height: 2px;
  background: var(--primary);
  display: inline-block;
}

.title-display {
  font-family: var(--font-display);
  font-size: var(--size-display-s);
  font-weight: 800;
  line-height: 1.15;
  color: var(--ink-display);
  letter-spacing: -0.005em;
}
.title-display-l {
  font-family: var(--font-display);
  font-size: var(--size-display);
  font-weight: 800;
  line-height: 1.1;
  color: var(--ink-display);
}

.body { font-size: var(--size-body); line-height: 1.55; color: var(--ink-body); }

.card {
  background: var(--bg-surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.page-marker {
  position: absolute;
  bottom: 24px;
  right: var(--pad-page-x);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 0.08em;
  z-index: 2;
}
.page-marker .accent-bar {
  display: inline-block;
  width: 18px;
  height: 1px;
  background: var(--primary);
  vertical-align: middle;
  margin-right: 10px;
}
`;
}
