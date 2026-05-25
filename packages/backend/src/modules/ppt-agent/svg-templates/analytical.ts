import type { DeckSlide } from "../types";
import {
  SLIDE_H,
  SLIDE_W,
  type SlideColors,
  cardShadow,
  escapeXml,
  pageHeader,
  wrapSvg,
} from "./base";

// --- architecture ---
export function renderArchitectureSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 5);
  const layers = blocks.length;
  const maxW = 900;
  const minW = 500;
  const gap = 18;
  const startY = 150;
  const layerH = 80;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    `  <circle cx="200" cy="200" r="300" fill="${colors.panel}" opacity="0.4"/>`,
    `  <circle cx="1100" cy="500" r="250" fill="${colors.support}" opacity="0.05"/>`,
    pageHeader(slidePlan, colors, index + 1),
  ];

  for (const [i, block] of blocks.entries()) {
    const layerIndex = layers - 1 - i;
    const w = minW + (maxW - minW) * (layerIndex / Math.max(layers - 1, 1));
    const x = (SLIDE_W - w) / 2;
    const y = startY + i * (layerH + gap);
    const fillColor = i % 2 === 0 ? colors.panel : colors.main;
    const fillOpacity = i === 0 ? "0.09" : i % 2 === 0 ? "0.06" : "0.14";
    parts.push(
      `  <g id="layer-${i + 1}" transform="translate(${x}, ${y})">`,
      cardShadow(x, y, w, layerH, 10),
      `    <rect width="${w}" height="${layerH}" rx="10" fill="${fillColor}" opacity="${fillOpacity}" stroke="${colors.accent}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="6" height="${layerH}" rx="3" fill="${colors.accent}"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="18" font-weight="bold" fill="${colors.cardText}" x="24" y="32">${escapeXml(block.heading || block.body)}</text>`,
      `    ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" fill="${colors.cardMuted}" x="24" y="54">${escapeXml(block.body)}</text>` : ""}`,
      "  </g>",
    );
    if (i < layers - 1) {
      parts.push(
        `  <g transform="translate(${SLIDE_W / 2 - 8}, ${y + layerH})">`,
        `    <polygon points="8,0 16,14 0,14" fill="${colors.accent}" opacity="0.6"/>`,
        "  </g>",
      );
    }
  }
  return wrapSvg(parts.join("\n"));
}

// --- capability ---
export function renderCapabilitySlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 6);
  const cols = Math.min(blocks.length, 3);
  const cardW = 300;
  const cardH = 220;
  const gapX = 40;
  const startX = (SLIDE_W - (cols * cardW + (cols - 1) * gapX)) / 2;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
  ];

  for (const [i, block] of blocks.entries()) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = 150 + row * (cardH + 30);
    const topColor = i % 3 === 0 ? colors.accent : i % 3 === 1 ? colors.support : colors.main;
    parts.push(
      `  <g id="cap-${i + 1}" transform="translate(${x}, ${y})">`,
      cardShadow(x, y, cardW, cardH, 12),
      `    <rect width="${cardW}" height="${cardH}" rx="12" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="${cardW}" height="6" rx="3" fill="${topColor}"/>`,
      `    <rect x="20" y="30" width="48" height="48" rx="10" fill="${topColor}" opacity="0.12"/>`,
      `    <circle cx="44" cy="54" r="16" fill="${topColor}" opacity="0.18"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="10" font-weight="bold" fill="${topColor}" text-anchor="middle" x="44" y="58">${String(i + 1).padStart(2, "0")}</text>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="16" font-weight="bold" fill="${colors.cardText}" x="20" y="100">${escapeXml(block.heading || block.body)}</text>`,
      `    ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" fill="${colors.cardMuted}" x="20" y="126">${escapeXml(block.body)}</text>` : ""}`,
      "  </g>",
    );
  }
  return wrapSvg(parts.join("\n"));
}

// --- governance / risk ---
export function renderRiskGovernanceSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 4);
  const cols = Math.min(blocks.length, 4);
  const gap = 30;
  const cardW = (1040 - gap * (cols - 1)) / cols;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
  ];

  for (const [i, block] of blocks.entries()) {
    const x = 120 + i * (cardW + gap);
    const isPrimary = i === 0;
    const accent = isPrimary ? colors.support : colors.accent;
    parts.push(
      `  <g id="risk-${i + 1}" transform="translate(${x}, 180)">`,
      cardShadow(x, 180, cardW, 300, 10),
      `    <rect width="${cardW}" height="300" rx="10" fill="${colors.cardFill}" stroke="${accent}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="${cardW}" height="6" rx="3" fill="${accent}"/>`,
      `    <circle cx="${cardW / 2}" cy="60" r="28" fill="${accent}" opacity="0.12"/>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="22" font-weight="bold" fill="${accent}" x="${cardW / 2}" y="68">${String(i + 1).padStart(2, "0")}</text>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" font-weight="bold" fill="${colors.cardText}" x="${cardW / 2}" y="108">${escapeXml(block.heading || `治理项 ${i + 1}`)}</text>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" fill="${colors.cardMuted}" x="18" y="140">${escapeXml(block.body)}</text>`,
      "  </g>",
    );
  }
  return wrapSvg(parts.join("\n"));
}

// --- scenario ---
export function renderScenarioSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 3);
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="scenarios" transform="translate(120, 150)">`,
  ];

  for (const [i, block] of blocks.entries()) {
    const y = i * 160;
    const barColor = i % 2 === 0 ? colors.accent : colors.support;
    parts.push(
      `    <g transform="translate(0, ${y})">`,
      cardShadow(0, y, 1040, 140, 12),
      `      <rect width="1040" height="140" rx="12" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
      `      <rect x="0" y="0" width="8" height="140" rx="4" fill="${barColor}"/>`,
      `      <circle cx="40" cy="40" r="16" fill="${barColor}" opacity="0.12"/>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" font-weight="bold" fill="${barColor}" text-anchor="middle" x="40" y="45">0${i + 1}</text>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="16" font-weight="bold" fill="${colors.cardText}" x="68" y="32">${escapeXml(block.heading || `场景 ${i + 1}`)}</text>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" fill="${colors.cardMuted}" x="68" y="60">${escapeXml(block.body)}</text>`,
      "    </g>",
    );
  }
  parts.push("  </g>");
  return wrapSvg(parts.join("\n"));
}
