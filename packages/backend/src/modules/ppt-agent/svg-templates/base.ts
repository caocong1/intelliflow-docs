import type { DeckSlide, VisualAsset } from "../types";

export type SlideColors = {
  bg: string;
  main: string;
  accent: string;
  support: string;
  text: string;
  muted: string;
  panel: string;
  /** Card/surface fill — white in light mode, dark in dark mode */
  cardFill: string;
  /** Card/surface stroke */
  cardStroke: string;
  /** Alternating row/card fill for tables and lists */
  cardFillAlt: string;
  /** Text color on card/surface backgrounds */
  cardText: string;
  /** Secondary text color on card/surface backgrounds */
  cardMuted: string;
  /** Whether the theme is dark (bg luminance < 0.3) */
  isDark: boolean;
};

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

const FALLBACK_PALETTE = ["1e3a5f", "3b82f6", "f59e0b", "64748b", "f8fafc"];

export function slideColors(palette: string[], _index: number): SlideColors {
  const colors = palette.length >= 5 ? palette : FALLBACK_PALETTE;
  const bg = colors[4] || "#f8fafc";
  const main = colors[0] || "#1e3a5f";
  const isDark = hexLuminance(main) < 0.3;
  return {
    bg,
    main,
    accent: colors[2] || "#f59e0b",
    support: colors[1] || "#3b82f6",
    text: colors[0] || "#1e3a5f",
    muted: colors[3] || "#64748b",
    panel: colors[4] || "#f8fafc",
    cardFill: isDark ? "#1a1a2e" : "#ffffff",
    cardStroke: isDark ? "#2a2a3e" : "#e2e8f0",
    cardFillAlt: isDark ? "#222240" : "#f8fafc",
    cardText: isDark ? "#f8fafc" : "#0f172a",
    cardMuted: isDark ? "#cbd5e1" : "#475569",
    isDark,
  };
}

function hexLuminance(hex: string): number {
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapSvg(content: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SLIDE_W} ${SLIDE_H}" width="${SLIDE_W}" height="${SLIDE_H}">`,
    content,
    "</svg>",
  ].join("\n");
}

export function padSlideNumber(n: number, total: number): string {
  return String(n).padStart(Math.max(String(total).length, 2), "0");
}

export function extractMetric(body: string): string | undefined {
  const match = body.match(/(\d+[\d,]*\.?\d*)\s*(%|万|亿|个|次|倍|天|年|人|元|[kKwW])?/i);
  if (match) return `${match[1]}${match[2] ?? ""}`;
  return undefined;
}

export function wrapMultilingualLines(
  text: string,
  opts: {
    maxUnitsPerLine: number;
    maxLines: number;
    emptyFallback?: string;
    ellipsis?: string;
  },
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const emptyFallback = opts.emptyFallback ?? "";
  if (!normalized) return emptyFallback ? [emptyFallback] : [];

  const lines: string[] = [];
  let current = "";
  let units = 0;
  const normalizedNoSpaces = normalized.replace(/\s/g, "");

  for (const char of normalized) {
    const charUnits = multilingualCharWidth(char);
    if (units + charUnits > opts.maxUnitsPerLine && current.length > 0) {
      lines.push(current.trim());
      current = "";
      units = 0;
      if (lines.length >= opts.maxLines) break;
    }
    current += char;
    units += charUnits;
  }

  if (lines.length < opts.maxLines && current.trim().length > 0) {
    lines.push(current.trim());
  }

  if (lines.length > opts.maxLines) {
    lines.length = opts.maxLines;
  }

  const consumed = lines.join("");
  if (consumed.length < normalizedNoSpaces.length && lines.length > 0) {
    const last = lines.length - 1;
    const ellipsis = opts.ellipsis ?? "...";
    lines[last] = trimLineEndPunctuation(lines[last]).concat(ellipsis);
  }

  return lines;
}

function multilingualCharWidth(char: string): number {
  if (/\s/.test(char)) return 0.5;
  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char)) return 2;
  if (/[A-Z0-9]/.test(char)) return 1.25;
  return 1;
}

function trimLineEndPunctuation(text: string): string {
  return text.replace(/[，。；：、,.!?！？]+$/u, "");
}

// --- shared layout components ---

export function pageHeader(slidePlan: DeckSlide, colors: SlideColors, partNum: number): string {
  return [
    `  <g id="header" transform="translate(120, 50)">`,
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.support}" letter-spacing="2">`,
    `      <tspan x="0" dy="0">PART ${String(partNum).padStart(2, "0")}</tspan>`,
    "    </text>",
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="32" font-weight="bold" fill="${colors.text}" x="0" y="36">`,
    `      <tspan x="0" dy="0">${escapeXml(slidePlan.title)}</tspan>`,
    "    </text>",
    `    <rect x="0" y="50" width="60" height="4" rx="2" fill="${colors.accent}"/>`,
    "  </g>",
  ].join("\n");
}

export function imageBgLayer(
  visual: VisualAsset | undefined,
  overlayColor: string,
  opacity = 0.55,
): string {
  if (!visual?.dataUri) return "";
  return [
    `  <g id="bg-image">`,
    `    <image href="${escapeXml(visual.dataUri)}" x="0" y="0" width="${SLIDE_W}" height="${SLIDE_H}" preserveAspectRatio="xMidYMid slice"/>`,
    `    <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${overlayColor}" opacity="${opacity}"/>`,
    "  </g>",
  ].join("\n");
}

export function imageSideLayer(
  visual: VisualAsset | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  if (!visual?.dataUri) return "";
  return [
    `  <g id="side-image" transform="translate(${x}, ${y})">`,
    `    <rect width="${w}" height="${h}" rx="10" fill="#0f172a" opacity="0.06"/>`,
    `    <image href="${escapeXml(visual.dataUri)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 10px)"/>`,
    "  </g>",
  ].join("\n");
}

// --- decorative motifs ---

export function defsGradient(id: string, from: string, to: string, angle = 135): string {
  const rad = (angle * Math.PI) / 180;
  const x1 = Math.round(50 - 50 * Math.cos(rad));
  const y1 = Math.round(50 - 50 * Math.sin(rad));
  const x2 = Math.round(50 + 50 * Math.cos(rad));
  const y2 = Math.round(50 + 50 * Math.sin(rad));
  return [
    `    <linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">`,
    `      <stop offset="0%" stop-color="#${from}"/>`,
    `      <stop offset="100%" stop-color="#${to}"/>`,
    "    </linearGradient>",
  ].join("\n");
}

export function decorCornerDots(colors: SlideColors): string {
  const dots: string[] = [];
  for (let i = 0; i < 5; i++) {
    dots.push(
      `<circle cx="${15 + i * 16}" cy="15" r="3" fill="${colors.accent}" opacity="${0.18 + i * 0.08}"/>`,
    );
  }
  return `  <g id="decor-dots">${dots.join("")}</g>`;
}

export function decorAccentBar(x: number, y: number, w: number, h: number, color: string): string {
  return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${color}" opacity="0.85"/>`;
}

export function sectionDivider(y: number, colors: SlideColors): string {
  return [
    `  <g id="section-divider" transform="translate(120, ${y})">`,
    `    <rect width="60" height="4" rx="2" fill="${colors.accent}"/>`,
    "  </g>",
  ].join("\n");
}

export function cardShadow(x: number, y: number, w: number, h: number, rx: number): string {
  return `  <rect x="${x + 3}" y="${y + 3}" width="${w}" height="${h}" rx="${rx}" fill="#0f172a" opacity="0.06"/>`;
}

export function bgGradientOverlay(gradientId: string, opacity = 0.08): string {
  return `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#${gradientId})" opacity="${opacity}"/>`;
}

// --- card builders ---

export function buildCard(
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  colors: SlideColors,
  opts: { shadow?: boolean; topBar?: string; border?: string } = {},
): string[] {
  const parts: string[] = [];
  if (opts.shadow) parts.push(cardShadow(x, y, w, h, rx));
  const border = opts.border ?? colors.cardStroke;
  parts.push(
    `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${colors.cardFill}" stroke="${border}" stroke-width="1.5"/>`,
  );
  if (opts.topBar) {
    parts.push(`  <rect x="${x}" y="${y}" width="${w}" height="6" rx="3" fill="${opts.topBar}"/>`);
  }
  return parts;
}

export function buildNumberedCircle(
  cx: number,
  cy: number,
  r: number,
  num: number,
  fill: string,
): string {
  return [
    `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`,
    `  <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="${r * 0.8}" font-weight="bold" fill="#ffffff" x="${cx}" y="${cy + r * 0.3}">${num}</text>`,
  ].join("\n");
}

export function buildTextBlock(
  x: number,
  y: number,
  heading: string | undefined,
  body: string,
  colors: SlideColors,
): string {
  const parts: string[] = [];
  if (heading) {
    parts.push(
      `  <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" font-weight="bold" fill="${colors.cardText}" x="${x}" y="${y}">${escapeXml(heading)}</text>`,
    );
    parts.push(
      `  <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" fill="${colors.cardMuted}" x="${x}" y="${y + 22}">${escapeXml(body)}</text>`,
    );
  } else {
    parts.push(
      `  <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" fill="${colors.cardText}" x="${x}" y="${y + 6}">${escapeXml(body)}</text>`,
    );
  }
  return parts.join("\n");
}
