/**
 * Text width & line-count validation for preserve-mode slot constraints.
 *
 * We count "width units" instead of raw char count because CJK characters
 * render ~2× wider than ASCII in most template fonts. The unit system:
 *   - CJK ideograph / fullwidth form / CJK punctuation → 2 units
 *   - everything else (ASCII, Latin extended, space, digits) → 1 unit
 *
 * This is a heuristic, not a font-metrics measurement. Authors calibrate
 * per-slot maxWidthUnits by comparing against the original template's
 * textSample width; the LLM-rewrite path is the self-healing mechanism
 * when content inevitably exceeds. Exact measurement requires a font
 * engine (fontkit); out of scope for Session 1.
 */

/** Return the width in units for a single code point. */
function codePointWidth(cp: number): number {
  // Hangul Jamo
  if (cp >= 0x1100 && cp <= 0x11ff) return 2;
  // CJK Radicals, Kangxi, CJK Symbols, Hiragana, Katakana, Bopomofo,
  // Hangul Compatibility Jamo, Kanbun, Bopomofo Extended, CJK Strokes,
  // Katakana Phonetic Extensions, Enclosed CJK Letters and Months, CJK
  // Compatibility, CJK Unified Ideographs Extension A, Yijing Hexagram
  // Symbols, CJK Unified Ideographs, Yi Syllables, Yi Radicals.
  if (cp >= 0x2e80 && cp <= 0x9fff) return 2;
  // Hangul Syllables
  if (cp >= 0xac00 && cp <= 0xd7a3) return 2;
  // CJK Compatibility Ideographs
  if (cp >= 0xf900 && cp <= 0xfaff) return 2;
  // Fullwidth forms (e.g. ：｜）
  if (cp >= 0xff01 && cp <= 0xff60) return 2;
  if (cp >= 0xffe0 && cp <= 0xffe6) return 2;
  // CJK Symbols and Punctuation (。、《》etc. — 0x3000-0x303F)
  if (cp >= 0x3000 && cp <= 0x303e) return 2;
  // CJK Unified Ideographs Extension B-F (SMP)
  if (cp >= 0x20000 && cp <= 0x2fffd) return 2;
  return 1;
}

export function widthUnits(str: string): number {
  let total = 0;
  for (const ch of str) {
    total += codePointWidth(ch.codePointAt(0) ?? 0);
  }
  return total;
}

export type FitViolation = {
  reason: string;
  actualWidthUnits?: number;
  actualLines?: number;
};

export type FitResult =
  | { fits: true }
  | { fits: false; violations: FitViolation[]; actualLines: number };

/** Validate a single-line text value. */
export function validateSingleLine(value: string, maxWidthUnits: number): FitResult {
  const w = widthUnits(value);
  if (w <= maxWidthUnits) return { fits: true };
  return {
    fits: false,
    actualLines: 1,
    violations: [
      {
        reason: `value width ${w} > maxWidthUnits ${maxWidthUnits}`,
        actualWidthUnits: w,
      },
    ],
  };
}

/**
 * Validate a multi-line value made of explicit paragraphs.
 *
 * Each paragraph counts as at least 1 line. If a paragraph's width exceeds
 * maxWidthUnits, we assume PowerPoint auto-wraps it into `ceil(w / max)`
 * lines. Sum over all paragraphs must be ≤ maxLines.
 */
export function validateParagraphs(
  paragraphs: Array<{ text: string }>,
  maxWidthUnits: number,
  maxLines: number,
): FitResult {
  const violations: FitViolation[] = [];
  let totalLines = 0;
  for (const p of paragraphs) {
    const w = widthUnits(p.text);
    const lines = Math.max(1, Math.ceil(w / maxWidthUnits));
    totalLines += lines;
    if (w > maxWidthUnits) {
      violations.push({
        reason: `paragraph "${p.text.slice(0, 24)}${p.text.length > 24 ? "…" : ""}" width ${w} > maxWidthUnits ${maxWidthUnits}`,
        actualWidthUnits: w,
      });
    }
  }
  if (totalLines > maxLines) {
    violations.push({
      reason: `total line count ${totalLines} > maxLines ${maxLines}`,
      actualLines: totalLines,
    });
  }
  if (violations.length === 0) return { fits: true };
  return { fits: false, violations, actualLines: totalLines };
}
