/**
 * Deterministic design-system.css generator from TemplateGenes.
 *
 * We don't ask the AI to generate CSS — that's where it makes consistency
 * mistakes.  Instead, we substitute its TemplateGenes (machine-friendly
 * tokens) into a known-good template.  The AI's job in Layer 4 is to USE
 * these tokens, not invent them.
 */

import type { TemplateGenes } from "./types";

export function generateDesignSystemCss(genes: TemplateGenes): string {
  const c = genes.designTokens.colors;
  const f = genes.designTokens.fonts;
  const r = genes.designTokens.rhythm;

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

  /* Typography */
  --font-display: "${f.titleEa}", "${f.titleLatin}", -apple-system, sans-serif;
  --font-body: "${f.bodyEa}", "${f.bodyLatin}", -apple-system, sans-serif;
  --font-mono: "${f.mono}", "JetBrains Mono", monospace;

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
