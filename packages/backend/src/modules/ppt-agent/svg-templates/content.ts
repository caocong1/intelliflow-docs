import type { DeckSlide, VisualAsset } from "../types";
import {
  SLIDE_H,
  SLIDE_W,
  type SlideColors,
  cardShadow,
  escapeXml,
  imageSideLayer,
  pageHeader,
  wrapSvg,
} from "./base";

// --- content (default) ---
export function renderContentSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
  visual?: VisualAsset,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 5);
  const sparse = blocks.length <= 3;
  const cardW = sparse ? 1120 : 1040;
  const cardH = sparse ? 112 : 68;
  const startX = sparse ? 80 : 120;
  const startY = sparse ? 168 : 140;
  const gap = sparse ? 24 : 12;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="content" transform="translate(${startX}, ${startY})">`,
  ];

  for (const [i, block] of blocks.entries()) {
    const y = i * (cardH + gap);
    const isEven = i % 2 === 0;
    parts.push(
      `    <g transform="translate(0, ${y})">`,
      cardShadow(0, 0, cardW, cardH, 10),
      `      <rect width="${cardW}" height="${cardH}" rx="10" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.2"/>`,
      `      <rect x="0" y="0" width="${sparse ? 10 : 6}" height="${cardH}" rx="4" fill="${isEven ? colors.accent : colors.support}"/>`,
      `      <circle cx="${sparse ? 30 : 20}" cy="${sparse ? 32 : 20}" r="${sparse ? 7 : 4}" fill="${isEven ? colors.accent : colors.support}" opacity="0.72"/>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="${sparse ? 22 : 15}" font-weight="bold" fill="${colors.cardText}" x="${sparse ? 50 : 32}" y="${sparse ? 44 : 22}">${escapeXml(block.heading || block.body)}</text>`,
      `      ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="${sparse ? 16 : 13}" fill="${colors.cardMuted}" x="${sparse ? 50 : 32}" y="${sparse ? 78 : 44}">${escapeXml(block.body)}</text>` : ""}`,
      "    </g>",
    );
  }
  parts.push("  </g>");

  if (visual?.dataUri) {
    parts.push(
      imageSideLayer(
        visual,
        sparse ? 1060 : 1160,
        sparse ? 520 : 560,
        sparse ? 180 : 100,
        sparse ? 140 : 100,
      ),
    );
  }

  return wrapSvg(parts.join("\n"));
}

// --- problem ---
export function renderProblemSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 4);
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="problem-highlight" transform="translate(120, 130)">`,
    `    <rect x="2" y="2" width="1040" height="56" rx="8" fill="#dc2626" opacity="0.06"/>`,
    `    <rect width="1040" height="56" rx="8" fill="#fef2f2" stroke="#fecaca" stroke-width="1"/>`,
    `    <circle cx="18" cy="28" r="6" fill="#dc2626"/>`,
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="16" font-weight="bold" fill="#dc2626" x="34" y="34">${escapeXml(slidePlan.keyMessage)}</text>`,
    "  </g>",
    `  <g id="issues" transform="translate(120, 210)">`,
  ];

  for (const [i, block] of blocks.entries()) {
    const y = i * 100;
    parts.push(
      `    <g transform="translate(0, ${y})">`,
      `      <circle cx="14" cy="14" r="12" fill="#dc2626" opacity="0.1"/>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="#dc2626" x="8" y="19">${i + 1}</text>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" font-weight="bold" fill="${colors.cardText}" x="34" y="18">${escapeXml(block.heading || block.body)}</text>`,
      `      ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" fill="${colors.cardMuted}" x="34" y="40">${escapeXml(block.body)}</text>` : ""}`,
      `      <line x1="34" y1="65" x2="800" y2="65" stroke="${colors.cardStroke}" stroke-width="1"/>`,
      "    </g>",
    );
  }
  parts.push("  </g>");
  return wrapSvg(parts.join("\n"));
}

// --- strategy ---
export function renderStrategySlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
  visual?: VisualAsset,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 4);
  const left = blocks.slice(0, 2);
  const right = blocks.slice(2, 4);
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="arrow" transform="translate(620, 360)">`,
    `    <polygon points="0,18 24,0 24,12 44,12 44,24 24,24 24,36" fill="${colors.accent}" opacity="0.8"/>`,
    "  </g>",
  ];

  for (const [side, group] of [left, right].entries()) {
    const colX = side === 0 ? 100 : 640;
    const cardColor = side === 0 ? colors.accent : colors.support;
    const titleLabel = side === 0 ? "策略方向" : "实施路径";
    parts.push(
      `  <g id="col-${side + 1}" transform="translate(${colX}, 150)">`,
      cardShadow(colX, 0, 500, 460, 12),
      `    <rect width="500" height="460" rx="12" fill="${colors.cardFill}" stroke="${cardColor}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="500" height="6" rx="3" fill="${cardColor}"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" font-weight="bold" fill="${cardColor}" text-anchor="middle" x="250" y="26">${titleLabel}</text>`,
    );
    for (const [i, block] of group.entries()) {
      const y = 48 + i * 175;
      parts.push(
        `    <g transform="translate(24, ${y})">`,
        `      <rect x="0" y="0" width="10" height="10" rx="5" fill="${cardColor}"/>`,
        `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="16" font-weight="bold" fill="${colors.cardText}" x="18" y="14">${escapeXml(block.heading || block.body)}</text>`,
        `      ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" fill="${colors.cardMuted}" x="18" y="38">${escapeXml(block.body)}</text>` : ""}`,
        "    </g>",
      );
    }
    parts.push("  </g>");
  }

  if (visual?.dataUri) {
    parts.push(imageSideLayer(visual, 960, 560, 200, 130));
  }

  return wrapSvg(parts.join("\n"));
}

// --- summary ---
export function renderSummarySlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
  visual?: VisualAsset,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 5);
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="summary-box" transform="translate(120, 140)">`,
    cardShadow(0, 0, 1040, 440, 12),
    `    <rect width="1040" height="440" rx="12" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
    `    <rect x="0" y="0" width="1040" height="6" rx="3" fill="${colors.accent}"/>`,
  ];

  for (const [i, block] of blocks.entries()) {
    const y = 30 + i * 72;
    parts.push(
      `    <g transform="translate(24, ${y})">`,
      `      <rect x="0" y="0" width="30" height="30" rx="15" fill="${i === 0 ? colors.accent : i % 2 === 0 ? colors.support : colors.accent}" opacity="${i === 0 ? "1" : "0.75"}"/>`,
      `      <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" x="15" y="21">${i + 1}</text>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" font-weight="bold" fill="${colors.cardText}" x="42" y="20">${escapeXml(block.heading || block.body)}</text>`,
      `      ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardMuted}" x="42" y="44">${escapeXml(block.body)}</text>` : ""}`,
      "    </g>",
    );
  }
  parts.push("  </g>");

  if (visual?.dataUri) {
    parts.push(imageSideLayer(visual, 1160, 560, 100, 100));
  }
  return wrapSvg(parts.join("\n"));
}
