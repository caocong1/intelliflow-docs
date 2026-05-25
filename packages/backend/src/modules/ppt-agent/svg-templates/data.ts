import type { DeckSlide } from "../types";
import {
  SLIDE_H,
  SLIDE_W,
  type SlideColors,
  cardShadow,
  escapeXml,
  extractMetric,
  pageHeader,
  wrapSvg,
} from "./base";

// --- metrics ---
export function renderMetricsSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const chart = slidePlan.chart;
  const blocks = slidePlan.contentBlocks.slice(0, 4);
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
  ];

  for (const [i, block] of blocks.entries()) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 120 + col * 520;
    const y = 160 + row * 160;
    const metric =
      extractMetric(block.body) ||
      (chart?.values?.[i] !== undefined ? `${chart.values[i]}${chart.unit ?? ""}` : `${i + 1}`);
    const accent = i === 0 ? colors.support : i % 2 === 0 ? colors.accent : colors.main;

    parts.push(
      `  <g id="metric-${i + 1}" transform="translate(${x}, ${y})">`,
      cardShadow(x, y, 480, 130, 10),
      `    <rect width="480" height="130" rx="10" fill="${colors.cardFill}" stroke="${accent}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="6" height="130" rx="3" fill="${accent}"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="36" font-weight="bold" fill="${accent}" x="28" y="50">${escapeXml(metric)}</text>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.cardText}" x="28" y="78">${escapeXml(block.heading || "关键指标")}</text>`,
      `    ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardMuted}" x="28" y="100">${escapeXml(block.body)}</text>` : ""}`,
      "  </g>",
    );
  }
  return wrapSvg(parts.join("\n"));
}

// --- table ---
export function renderTableSlide(slidePlan: DeckSlide, colors: SlideColors, index: number): string {
  const table = slidePlan.table ?? {
    headers: ["维度", "设计要点", "管理抓手"],
    rows: slidePlan.contentBlocks
      .slice(0, 5)
      .map((block) => [
        block.heading || "议题",
        block.body.slice(0, 40),
        slidePlan.keyMessage.slice(0, 32),
      ]),
  };
  const headers = table.headers.slice(0, 4);
  const rows = table.rows.slice(0, 6);
  const x = 120;
  const y = 150;
  const w = 1040;
  const rowH = 55;
  const colW = w / headers.length;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
  ];

  for (const [col, header] of headers.entries()) {
    const headerColor = col === 0 ? colors.support : colors.accent;
    parts.push(
      `  <g id="th-${col}">`,
      `    <rect x="${x + col * colW}" y="${y}" width="${colW}" height="${rowH}" rx="0" fill="${headerColor}" opacity="0.9"/>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" x="${x + col * colW + colW / 2}" y="${y + 34}">${escapeXml(header)}</text>`,
      "  </g>",
    );
  }

  for (const [rowIndex, row] of rows.entries()) {
    for (const [col, cell] of row.slice(0, headers.length).entries()) {
      const ry = y + rowH * (rowIndex + 1);
      parts.push(
        `  <g id="td-${rowIndex}-${col}">`,
        `    <rect x="${x + col * colW}" y="${ry}" width="${colW}" height="${rowH}" rx="0" fill="${rowIndex % 2 === 0 ? colors.cardFill : colors.panel}" opacity="${rowIndex % 2 === 0 ? "1" : "0.5"}" stroke="${colors.cardStroke}" stroke-width="0.5"/>`,
        `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardText}" x="${x + col * colW + 12}" y="${ry + 34}">${escapeXml(cell)}</text>`,
        "  </g>",
      );
    }
  }
  return wrapSvg(parts.join("\n"));
}

// --- timeline ---
export function renderTimelineSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const items =
    slidePlan.timeline && slidePlan.timeline.length > 0
      ? slidePlan.timeline.slice(0, 5)
      : slidePlan.contentBlocks.slice(0, 5).map((block, i) => ({
          label: block.heading || `阶段 ${i + 1}`,
          description: block.body,
          date: `P${i + 1}`,
        }));
  const count = items.length;
  const startX = 140;
  const endX = 1140;
  const gap = count > 1 ? (endX - startX) / (count - 1) : 0;
  const centerY = 400;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="timeline-bg">`,
    `    <rect x="${startX - 20}" y="${centerY - 60}" width="${endX - startX + 40}" height="120" rx="16" fill="${colors.panel}" opacity="0.5"/>`,
    "  </g>",
    `  <g id="timeline-line">`,
    `    <line x1="${startX}" y1="${centerY}" x2="${endX}" y2="${centerY}" stroke="${colors.accent}" stroke-width="4" opacity="0.3"/>`,
    "  </g>",
  ];

  for (const [i, item] of items.entries()) {
    const nodeX = startX + i * gap;
    const isTop = i % 2 === 0;
    const labelY = isTop ? centerY - 55 : centerY + 45;
    const descY = isTop ? labelY - 24 : labelY + 24;
    const nodeColor = i === count - 1 ? colors.support : colors.accent;

    parts.push(
      `  <g id="node-${i + 1}">`,
      `    <circle cx="${nodeX}" cy="${centerY}" r="14" fill="${nodeColor}"/>`,
      `    <circle cx="${nodeX}" cy="${centerY}" r="6" fill="#ffffff"/>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" font-weight="bold" fill="${colors.text}" x="${nodeX}" y="${labelY}">${escapeXml(item.label)}</text>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.muted}" x="${nodeX}" y="${descY}">${escapeXml(item.description)}</text>`,
      "  </g>",
    );
  }
  return wrapSvg(parts.join("\n"));
}
