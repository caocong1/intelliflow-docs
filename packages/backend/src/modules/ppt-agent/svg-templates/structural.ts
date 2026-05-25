import type { DeckSlide, VisualAsset } from "../types";
import {
  SLIDE_H,
  SLIDE_W,
  type SlideColors,
  decorCornerDots,
  escapeXml,
  imageBgLayer,
  wrapSvg,
} from "./base";

// --- cover ---
export function renderCoverSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  visual?: VisualAsset,
): string {
  const bg = visual?.dataUri
    ? imageBgLayer(visual, colors.main, 0.5)
    : [
        `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.main}"/>`,
        `  <g id="hero-bg">`,
        `    <circle cx="1100" cy="80" r="380" fill="${colors.support}" opacity="0.18"/>`,
        `    <circle cx="180" cy="600" r="280" fill="${colors.accent}" opacity="0.12"/>`,
        `    <circle cx="640" cy="360" r="220" fill="#ffffff" opacity="0.04"/>`,
        `    <circle cx="920" cy="220" r="160" fill="${colors.support}" opacity="0.08"/>`,
        "  </g>",
      ].join("\n");

  return wrapSvg(
    [
      bg,
      `  <g id="icon-doc" transform="translate(1200, 30)" opacity="0.12">`,
      `    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#ffffff" stroke-width="1.5" fill="none"/>`,
      `    <polyline points="14 2 14 8 20 8" stroke="#ffffff" stroke-width="1.5" fill="none"/>`,
      "  </g>",
      decorCornerDots({ ...colors, accent: "#ffffff" }),
      `  <g id="title" transform="translate(640, 270)">`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="52" font-weight="bold" fill="#ffffff" letter-spacing="2">`,
      `      <tspan x="0" dy="0">${escapeXml(slidePlan.title)}</tspan>`,
      "    </text>",
      "  </g>",
      `  <g id="subtitle" transform="translate(640, 355)">`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="20" fill="#94a3b8">`,
      `      <tspan x="0" dy="0">${escapeXml(slidePlan.subtitle || slidePlan.keyMessage)}</tspan>`,
      "    </text>",
      "  </g>",
      `  <g id="accent" transform="translate(540, 395)">`,
      `    <rect width="200" height="4" rx="2" fill="${colors.accent}"/>`,
      `    <circle cx="100" cy="2" r="6" fill="${colors.accent}" opacity="0.5"/>`,
      "  </g>",
    ].join("\n"),
  );
}

// --- agenda ---
export function renderAgendaSlide(slidePlan: DeckSlide, colors: SlideColors): string {
  const blocks = slidePlan.contentBlocks.slice(0, 6);
  const compact = blocks.length <= 3;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    `  <g id="title" transform="translate(120, 60)">`,
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="34" font-weight="bold" fill="${colors.text}">`,
    `      <tspan x="0" dy="0">${escapeXml(slidePlan.title)}</tspan>`,
    "    </text>",
    `    <rect x="0" y="48" width="80" height="4" rx="2" fill="${colors.accent}"/>`,
    "  </g>",
    `  <g id="section-divider" transform="translate(1000, 68)">`,
    `    <circle cx="0" cy="26" r="72" fill="${colors.panel}" opacity="0.72"/>`,
    `    <circle cx="0" cy="26" r="46" fill="${colors.support}" opacity="0.1"/>`,
    "  </g>",
  ];

  const layout = compact
    ? { x: 120, y: 146, w: 840, h: 128, gap: 18, titleSize: 26, bodySize: 16 }
    : { x: 120, y: 138, w: 760, h: 78, gap: 16, titleSize: 18, bodySize: 13 };
  for (const [i, block] of blocks.entries()) {
    const y = layout.y + i * (layout.h + layout.gap);
    const num = String(i + 1).padStart(2, "0");
    const isEven = i % 2 === 0;
    parts.push(
      `  <g id="item-${i + 1}" transform="translate(${layout.x}, ${y})">`,
      `    <rect x="3" y="3" width="${layout.w}" height="${layout.h}" rx="10" fill="#0f172a" opacity="0.05"/>`,
      `    <rect width="${layout.w}" height="${layout.h}" rx="10" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="${compact ? 72 : 56}" height="${layout.h}" rx="10" fill="${isEven ? colors.accent : colors.support}"/>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="${compact ? 20 : 16}" font-weight="bold" fill="#ffffff" x="${compact ? 36 : 28}" y="${compact ? 72 : 44}">${num}</text>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="${layout.titleSize}" font-weight="bold" fill="${colors.cardText}" x="${compact ? 96 : 74}" y="${compact ? 52 : 30}">${escapeXml(block.heading || block.body)}</text>`,
      `    ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="${layout.bodySize}" fill="${colors.cardMuted}" x="${compact ? 96 : 74}" y="${compact ? 84 : 54}">${escapeXml(block.body)}</text>` : ""}`,
      "  </g>",
    );
  }

  if (compact) {
    parts.push(
      `  <g id="agenda-note" transform="translate(996, 156)">`,
      `    <rect x="2" y="2" width="180" height="408" rx="14" fill="#0f172a" opacity="0.06"/>`,
      `    <rect width="180" height="408" rx="14" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="180" height="8" rx="4" fill="${colors.support}" opacity="0.82"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.cardText}" x="16" y="36">演示重点</text>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardMuted}" x="16" y="64">${escapeXml(slidePlan.keyMessage)}</text>`,
      `    <circle cx="26" cy="106" r="6" fill="${colors.accent}" opacity="0.8"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardMuted}" x="40" y="110">内容精简时放大</text>`,
      `    <circle cx="26" cy="136" r="6" fill="${colors.support}" opacity="0.8"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardMuted}" x="40" y="140">突出叙事主线</text>`,
      "  </g>",
    );
  }
  return wrapSvg(parts.join("\n"));
}

// --- section ---
export function renderSectionSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  visual?: VisualAsset,
): string {
  const bg = visual?.dataUri
    ? imageBgLayer(visual, colors.main, 0.55)
    : [
        `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
        `  <circle cx="1200" cy="200" r="300" fill="${colors.main}" opacity="0.04"/>`,
        `  <circle cx="1200" cy="200" r="180" fill="${colors.support}" opacity="0.06"/>`,
      ].join("\n");

  return wrapSvg(
    [
      bg,
      `  <g id="accent-left">`,
      `    <rect x="0" y="0" width="8" height="${SLIDE_H}" fill="${colors.accent}"/>`,
      "  </g>",
      `  <g id="section-card" transform="translate(96, 200)">`,
      `    <rect x="4" y="4" width="760" height="260" rx="18" fill="#0f172a" opacity="0.08"/>`,
      `    <rect width="760" height="260" rx="18" fill="${colors.cardFill}" opacity="0.92" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="760" height="10" rx="5" fill="${colors.support}" opacity="0.78"/>`,
      "  </g>",
      `  <g id="title" transform="translate(120, 250)">`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="44" font-weight="bold" fill="${colors.cardText}">`,
      `      <tspan x="0" dy="0">${escapeXml(slidePlan.title)}</tspan>`,
      "    </text>",
      `    <rect x="0" y="60" width="120" height="4" rx="2" fill="${colors.accent}"/>`,
      "  </g>",
      `  <g id="message" transform="translate(120, 370)">`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="18" fill="${colors.cardMuted}">`,
      `      <tspan x="0" dy="0">${escapeXml(slidePlan.keyMessage)}</tspan>`,
      "    </text>",
      "  </g>",
    ].join("\n"),
  );
}

// --- closing ---
export function renderClosingSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  visual?: VisualAsset,
): string {
  const bg = visual?.dataUri
    ? imageBgLayer(visual, colors.main, 0.55)
    : [
        `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.main}"/>`,
        `  <g id="hero-bg">`,
        `    <circle cx="1100" cy="80" r="380" fill="${colors.support}" opacity="0.18"/>`,
        `    <circle cx="180" cy="600" r="280" fill="${colors.accent}" opacity="0.12"/>`,
        `    <circle cx="640" cy="360" r="200" fill="#ffffff" opacity="0.04"/>`,
        "  </g>",
      ].join("\n");

  return wrapSvg(
    [
      bg,
      `  <g id="icon-check" transform="translate(1160, 60)" opacity="0.14">`,
      `    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#ffffff" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
      `    <polyline points="22 4 12 14.01 9 11.01" stroke="#ffffff" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
      "  </g>",
      decorCornerDots({ ...colors, accent: "#ffffff" }),
      `  <g id="title" transform="translate(640, 260)">`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff" letter-spacing="1">`,
      `      <tspan x="0" dy="0">${escapeXml(slidePlan.title)}</tspan>`,
      "    </text>",
      "  </g>",
      `  <g id="subtitle" transform="translate(640, 340)">`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="18" fill="#94a3b8">`,
      `      <tspan x="0" dy="0">${escapeXml(slidePlan.keyMessage)}</tspan>`,
      "    </text>",
      "  </g>",
      `  <g id="accent" transform="translate(540, 385)">`,
      `    <rect width="200" height="3" rx="1.5" fill="${colors.accent}"/>`,
      `    <circle cx="100" cy="1.5" r="5" fill="${colors.accent}" opacity="0.5"/>`,
      "  </g>",
    ].join("\n"),
  );
}
