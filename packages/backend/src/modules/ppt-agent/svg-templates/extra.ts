import type { DeckSlide, VisualAsset } from "../types";
import {
  SLIDE_H,
  SLIDE_W,
  type SlideColors,
  cardShadow,
  escapeXml,
  imageSideLayer,
  pageHeader,
  wrapMultilingualLines,
  wrapSvg,
} from "./base";

// --- comparison ---
export function renderComparisonSlide(
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
    `  <g id="vs-divider" transform="translate(${SLIDE_W / 2}, 170)">`,
    `    <line x1="0" y1="0" x2="0" y2="480" stroke="${colors.accent}" stroke-width="2" opacity="0.3" stroke-dasharray="8,6"/>`,
    `    <circle cx="0" cy="240" r="32" fill="${colors.accent}" opacity="0.12"/>`,
    `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.accent}" x="0" y="246">VS</text>`,
    "  </g>",
  ];

  const cols = [
    { side: "left", group: left, color: colors.accent, label: "方案 A", x: 80 },
    { side: "right", group: right, color: colors.support, label: "方案 B", x: 680 },
  ];

  for (const col of cols) {
    parts.push(
      `  <g id="col-${col.side}" transform="translate(${col.x}, 170)">`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="16" font-weight="bold" fill="${col.color}" text-anchor="middle" x="240" y="-10">${col.label}</text>`,
    );
    for (const [i, block] of col.group.entries()) {
      const y = i * 130;
      const titleRaw = block.heading || block.body;
      const titleLine =
        wrapMultilingualLines(titleRaw, {
          maxUnitsPerLine: 24,
          maxLines: 1,
          ellipsis: "...",
        })[0] ?? titleRaw;
      const bodyLine = block.heading
        ? (wrapMultilingualLines(block.body, {
            maxUnitsPerLine: 38,
            maxLines: 1,
            ellipsis: "...",
          })[0] ?? block.body)
        : "";
      parts.push(
        `    <g transform="translate(0, ${y})">`,
        cardShadow(0, y, 480, 110, 10),
        `      <rect width="480" height="110" rx="10" fill="${colors.cardFill}" stroke="${col.color}" stroke-width="1.5"/>`,
        `      <rect x="0" y="0" width="6" height="110" rx="3" fill="${col.color}"/>`,
        `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" font-weight="bold" fill="${colors.cardText}" x="22" y="28">${escapeXml(titleLine)}</text>`,
        `      ${block.heading ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" fill="${colors.cardMuted}" x="22" y="52">${escapeXml(bodyLine)}</text>` : ""}`,
        "    </g>",
      );
    }
    parts.push("  </g>");
  }

  if (visual?.dataUri) {
    parts.push(imageSideLayer(visual, 1160, 560, 100, 100));
  }

  return wrapSvg(parts.join("\n"));
}

// --- process ---
export function renderProcessSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 5);
  const count = blocks.length;
  const startX = 100;
  const endX = SLIDE_W - 100;
  const stepW = Math.min(200, (endX - startX - (count - 1) * 40) / count);
  const gap = (endX - startX - count * stepW) / Math.max(count - 1, 1);
  const centerY = 380;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="process-bg">`,
    `    <rect x="${startX - 20}" y="${centerY - 90}" width="${endX - startX + 40}" height="180" rx="16" fill="${colors.panel}" opacity="0.5"/>`,
    "  </g>",
    `  <g id="process-line">`,
    `    <line x1="${startX}" y1="${centerY}" x2="${endX}" y2="${centerY}" stroke="${colors.accent}" stroke-width="3" opacity="0.35"/>`,
    "  </g>",
  ];

  for (const [i, block] of blocks.entries()) {
    const cx = startX + stepW / 2 + i * (stepW + gap);
    const isLast = i === count - 1;
    const nodeColor = i === 0 ? colors.support : isLast ? colors.accent : colors.main;
    const labelY = i % 2 === 0 ? centerY - 55 : centerY + 55;

    parts.push(
      `  <g id="step-${i + 1}">`,
      `    <rect x="${cx - stepW / 2}" y="${labelY - 18}" width="${stepW}" height="36" rx="6" fill="${nodeColor}" opacity="0.12"/>`,
      `    <circle cx="${cx}" cy="${centerY}" r="22" fill="${nodeColor}"/>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" x="${cx}" y="${centerY + 6}">${i + 1}</text>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" font-weight="bold" fill="${colors.cardText}" x="${cx}" y="${labelY}">${escapeXml(block.heading || block.body)}</text>`,
      `    ${block.heading ? `<text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="11" fill="${colors.cardMuted}" x="${cx}" y="${labelY + 16}">${escapeXml(block.body)}</text>` : ""}`,
      "  </g>",
    );

    if (i < count - 1) {
      const arrowX = cx + stepW / 2 + 6;
      parts.push(
        `  <polygon points="${arrowX},${centerY - 6} ${arrowX + 12},${centerY} ${arrowX},${centerY + 6}" fill="${colors.accent}" opacity="0.5"/>`,
      );
    }
  }
  return wrapSvg(parts.join("\n"));
}

// --- roadmap ---
export function renderRoadmapSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
): string {
  const items =
    slidePlan.timeline && slidePlan.timeline.length > 0
      ? slidePlan.timeline.slice(0, 6)
      : slidePlan.contentBlocks.slice(0, 6).map((block, i) => ({
          label: block.heading || `里程碑 ${i + 1}`,
          description: block.body,
          date: `Q${i + 1}`,
        }));
  const count = items.length;
  const startX = 100;
  const rowH = 90;
  const gap = 10;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
  ];

  for (const [i, item] of items.entries()) {
    const y = 150 + i * (rowH + gap);
    const progress = Math.min(1, (i + 1) / count);
    const barColor = i === 0 ? colors.support : i === count - 1 ? colors.accent : colors.main;
    const barW = 240 + (600 - 240) * (i / Math.max(count - 1, 1));

    const labelLine =
      wrapMultilingualLines(item.label, {
        maxUnitsPerLine: 22,
        maxLines: 1,
        ellipsis: "...",
      })[0] ?? item.label;
    const descriptionLine =
      wrapMultilingualLines(item.description, {
        maxUnitsPerLine: 48,
        maxLines: 1,
        ellipsis: "...",
      })[0] ?? item.description;
    const dateLine =
      wrapMultilingualLines(item.date || "", {
        maxUnitsPerLine: 14,
        maxLines: 1,
        ellipsis: "...",
      })[0] ??
      (item.date || "");

    parts.push(
      `  <g id="roadmap-${i + 1}" transform="translate(${startX}, ${y})">`,
      cardShadow(startX, y, 1080, rowH, 10),
      `    <rect width="1080" height="${rowH}" rx="10" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
      `    <rect x="0" y="0" width="8" height="${rowH}" rx="4" fill="${barColor}"/>`,
      `    <rect x="20" y="${rowH / 2 - 4}" width="${barW}" height="8" rx="4" fill="${barColor}" opacity="0.2"/>`,
      `    <rect x="20" y="${rowH / 2 - 4}" width="${barW * progress}" height="8" rx="4" fill="${barColor}" opacity="0.7"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.cardText}" x="20" y="28">${escapeXml(labelLine)}</text>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardMuted}" x="20" y="48">${escapeXml(descriptionLine)}</text>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="20" font-weight="bold" fill="${barColor}" x="920" y="${rowH / 2 + 8}">${escapeXml(dateLine)}</text>`,
      "  </g>",
    );
  }
  return wrapSvg(parts.join("\n"));
}

// --- team ---
export function renderTeamSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
  visual?: VisualAsset,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 6);
  const cols = Math.min(blocks.length, 3);
  const cardW = 300;
  const cardH = 170;
  const gapX = 40;
  const gapY = 30;
  const startX = (SLIDE_W - (cols * cardW + (cols - 1) * gapX)) / 2;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
  ];

  for (const [i, block] of blocks.entries()) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = 150 + row * (cardH + gapY);
    const avatarColor = i % 3 === 0 ? colors.accent : i % 3 === 1 ? colors.support : colors.main;

    parts.push(
      `  <g id="team-${i + 1}" transform="translate(${x}, ${y})">`,
      cardShadow(x, y, cardW, cardH, 12),
      `    <rect width="${cardW}" height="${cardH}" rx="12" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
      `    <circle cx="${cardW / 2}" cy="38" r="30" fill="${avatarColor}" opacity="0.12"/>`,
      `    <circle cx="${cardW / 2}" cy="26" r="14" fill="${avatarColor}" opacity="0.3"/>`,
      `    <path d="M${cardW / 2 - 10} ${50} Q${cardW / 2} ${68} ${cardW / 2 + 10} ${50}" stroke="${avatarColor}" stroke-width="2" fill="none" opacity="0.3"/>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" font-weight="bold" fill="${colors.cardText}" x="${cardW / 2}" y="90">${escapeXml(block.heading || `成员 ${i + 1}`)}</text>`,
      `    ${block.heading ? `<text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardMuted}" x="${cardW / 2}" y="112">${escapeXml(block.body)}</text>` : `<text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.cardMuted}" x="${cardW / 2}" y="112">${escapeXml(block.body)}</text>`}`,
      "  </g>",
    );
  }

  if (visual?.dataUri) {
    parts.push(imageSideLayer(visual, 1120, 560, 140, 120));
  }

  return wrapSvg(parts.join("\n"));
}

// --- quote ---
export function renderQuoteSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
  visual?: VisualAsset,
): string {
  const quote = slidePlan.contentBlocks[0]?.body || slidePlan.keyMessage;
  const author = slidePlan.contentBlocks[0]?.heading || slidePlan.subtitle || "";
  const quoteLines = wrapMultilingualLines(quote, {
    maxUnitsPerLine: 34,
    maxLines: 4,
    emptyFallback: "（暂无引用内容）",
    ellipsis: "...",
  });
  const quoteTextColor = colors.isDark ? "#f8fafc" : colors.text;
  const quoteAuthorColor = colors.isDark ? "#e2e8f0" : colors.text;
  const quoteDividerColor = colors.isDark ? "#94a3b8" : colors.accent;
  const openQuoteOpacity = colors.isDark ? 0.38 : 0.28;
  const closeQuoteOpacity = colors.isDark ? 0.26 : 0.18;
  const lineGap = 38;
  const quoteStartY = 116;
  const quoteLastLineY = quoteStartY + Math.max(0, quoteLines.length - 1) * lineGap;
  const dividerY = quoteLastLineY + 44;
  const authorY = dividerY + 34;
  const closeQuoteY = author ? authorY + 24 : dividerY + 42;
  const cardH = Math.min(380, Math.max(280, closeQuoteY + 40));
  const cardY = Math.max(150, Math.floor((SLIDE_H - cardH) / 2));
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="quote-container" transform="translate(140, ${cardY})">`,
    cardShadow(0, 0, 1000, cardH, 16),
    `    <rect width="1000" height="${cardH}" rx="16" fill="${colors.cardFill}" stroke="${colors.accent}" stroke-width="1.5"/>`,
    `    <rect x="0" y="0" width="10" height="${cardH}" rx="5" fill="${colors.accent}"/>`,
    `    <circle cx="940" cy="48" r="34" fill="${colors.accent}" opacity="0.08"/>`,
    `    <text font-family="Georgia, Microsoft YaHei, serif" font-size="82" fill="${colors.accent}" opacity="${openQuoteOpacity}" x="42" y="92">“</text>`,
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="22" fill="${quoteTextColor}" x="66" y="116">`,
    ...quoteLines.map(
      (line, lineIndex) =>
        `      <tspan x="66" dy="${lineIndex === 0 ? 0 : 38}">${escapeXml(line)}</tspan>`,
    ),
    "    </text>",
    `    <line x1="66" y1="${dividerY}" x2="162" y2="${dividerY}" stroke="${quoteDividerColor}" stroke-width="2"/>`,
    `    ${author ? `<text font-family="Microsoft YaHei, Arial, sans-serif" font-size="16" font-weight="bold" fill="${quoteAuthorColor}" x="66" y="${authorY}">— ${escapeXml(author)}</text>` : ""}`,
    `    <text font-family="Georgia, Microsoft YaHei, serif" font-size="72" fill="${colors.accent}" opacity="${closeQuoteOpacity}" x="906" y="${closeQuoteY}">”</text>`,
    "  </g>",
  ];

  if (visual?.dataUri) {
    parts.push(imageSideLayer(visual, 1120, 560, 140, 120));
  }

  return wrapSvg(parts.join("\n"));
}

// --- chart ---
export function renderChartSlide(slidePlan: DeckSlide, colors: SlideColors, index: number): string {
  const chart = slidePlan.chart ?? {
    title: "关键数据",
    labels: slidePlan.contentBlocks.slice(0, 5).map((b) => b.heading || "项目"),
    values: slidePlan.contentBlocks.slice(0, 5).map((_, i) => (i + 1) * 20),
    unit: "%",
  };
  const chartType = chart.chartType ?? "bar";
  const labels = chart.labels.slice(0, 6);
  const values = chart.values.slice(0, 6);

  const header = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
  ];

  switch (chartType) {
    case "line":
      return wrapSvg([...header, ...renderLineChart(chart, labels, values, colors)].join("\n"));
    case "pie":
      return wrapSvg([...header, ...renderPieChart(chart, labels, values, colors)].join("\n"));
    case "radar":
      return wrapSvg([...header, ...renderRadarChart(chart, labels, values, colors)].join("\n"));
    default:
      return wrapSvg([...header, ...renderBarChart(chart, labels, values, colors)].join("\n"));
  }
}

function pickColor(i: number, colors: SlideColors): string {
  return i % 3 === 0 ? colors.accent : i % 3 === 1 ? colors.support : colors.main;
}

function renderBarChart(
  chart: { title: string; unit?: string },
  labels: string[],
  values: number[],
  colors: SlideColors,
): string[] {
  const maxVal = Math.max(...values, 1);
  const chartX = 140;
  const chartY = 180;
  const chartW = 800;
  const chartH = 400;
  const barGap = 30;
  const barW = (chartW - barGap * (labels.length - 1) - 80) / labels.length;

  const parts: string[] = [
    `  <g id="chart-area" transform="translate(${chartX}, ${chartY})">`,
    `    <rect x="0" y="0" width="${chartW}" height="${chartH}" rx="12" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.text}" x="24" y="30">${escapeXml(chart.title)}</text>`,
  ];

  for (const [i, val] of values.entries()) {
    const barH = (val / maxVal) * (chartH - 140);
    const bx = 60 + i * (barW + barGap);
    const by = chartH - 60 - barH;
    const barColor = pickColor(i, colors);

    parts.push(
      `    <g id="bar-${i}">`,
      `      <rect x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="6" fill="${barColor}" opacity="0.8"/>`,
      `      <rect x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="6" fill="${barColor}" opacity="0.15"/>`,
      `      <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" font-weight="bold" fill="${barColor}" x="${bx + barW / 2}" y="${by - 8}">${val}${chart.unit ?? ""}</text>`,
      `      <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" fill="${colors.muted}" x="${bx + barW / 2}" y="${chartH - 40}">${escapeXml(labels[i])}</text>`,
      "    </g>",
    );
  }

  parts.push("  </g>");
  return parts;
}

function renderLineChart(
  chart: { title: string; unit?: string },
  labels: string[],
  values: number[],
  colors: SlideColors,
): string[] {
  const maxVal = Math.max(...values, 1);
  const chartX = 140;
  const chartY = 180;
  const chartW = 800;
  const chartH = 400;
  const padL = 60;
  const padR = 40;
  const padT = 60;
  const padB = 70;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const count = values.length;
  const stepX = count > 1 ? plotW / (count - 1) : plotW;

  const parts: string[] = [
    `  <g id="chart-area" transform="translate(${chartX}, ${chartY})">`,
    `    <rect x="0" y="0" width="${chartW}" height="${chartH}" rx="12" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.text}" x="24" y="30">${escapeXml(chart.title)}</text>`,
    // grid lines
    `    <g id="grid" opacity="0.15">`,
  ];

  for (let g = 0; g <= 4; g++) {
    const gy = padT + (plotH / 4) * g;
    parts.push(
      `      <line x1="${padL}" y1="${gy}" x2="${padL + plotW}" y2="${gy}" stroke="${colors.text}" stroke-width="1"/>`,
    );
  }
  parts.push("    </g>");

  // area fill
  let areaPath = `M${padL},${padT + plotH}`;
  for (let i = 0; i < count; i++) {
    const px = padL + i * stepX;
    const py = padT + plotH - (values[i] / maxVal) * plotH;
    areaPath += ` L${px},${py}`;
  }
  areaPath += ` L${padL + (count - 1) * stepX},${padT + plotH} Z`;

  parts.push(`    <path d="${areaPath}" fill="${colors.accent}" opacity="0.08"/>`);

  // line + points
  let linePath = "";
  const points: string[] = [];
  for (let i = 0; i < count; i++) {
    const px = padL + i * stepX;
    const py = padT + plotH - (values[i] / maxVal) * plotH;
    linePath += `${i === 0 ? "M" : "L"}${px},${py} `;
    const ptColor = pickColor(i, colors);
    points.push(
      `      <circle cx="${px}" cy="${py}" r="5" fill="${ptColor}"/>`,
      `      <circle cx="${px}" cy="${py}" r="3" fill="#ffffff"/>`,
      `      <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" font-weight="bold" fill="${ptColor}" x="${px}" y="${py - 10}">${values[i]}${chart.unit ?? ""}</text>`,
      `      <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="11" fill="${colors.muted}" x="${px}" y="${padT + plotH + 18}">${escapeXml(labels[i])}</text>`,
    );
  }

  parts.push(
    `    <polyline points="${linePath
      .trim()
      .replace(/[ML]/g, (m) => `${m} `)
      .trim()}" fill="none" stroke="${colors.accent}" stroke-width="3" stroke-linejoin="round"/>`,
    ...points,
    "  </g>",
  );

  return parts;
}

function renderPieChart(
  chart: { title: string; unit?: string },
  labels: string[],
  values: number[],
  colors: SlideColors,
): string[] {
  const chartX = 140;
  const chartY = 180;
  const chartW = 800;
  const chartH = 400;
  const cx = chartW / 2;
  const cy = chartH / 2 + 10;
  const r = 140;
  const total = values.reduce((s, v) => s + v, 0);
  const palette = [colors.accent, colors.support, colors.main, colors.muted, "#f97316", "#22c55e"];

  const parts: string[] = [
    `  <g id="chart-area" transform="translate(${chartX}, ${chartY})">`,
    `    <rect x="0" y="0" width="${chartW}" height="${chartH}" rx="12" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.text}" x="24" y="30">${escapeXml(chart.title)}</text>`,
  ];

  let angle = 0;
  for (let i = 0; i < values.length; i++) {
    const pct = total > 0 ? values[i] / total : 1 / values.length;
    const sweep = pct * 2 * Math.PI;
    const midAngle = angle + sweep / 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const labelR = r + 30;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);

    parts.push(
      `    <path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${palette[i % palette.length]}" opacity="0.75"/>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="11" fill="${colors.text}" x="${lx}" y="${ly - 4}">${escapeXml(labels[i])}</text>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="11" font-weight="bold" fill="${palette[i % palette.length]}" x="${lx}" y="${ly + 12}">${values[i]}${chart.unit ?? ""}</text>`,
    );
    angle += sweep;
  }

  // legend
  const legendX = chartW - 160;
  for (let i = 0; i < labels.length; i++) {
    const ly = 60 + i * 26;
    parts.push(
      `    <rect x="${legendX}" y="${ly}" width="12" height="12" rx="3" fill="${palette[i % palette.length]}" opacity="0.75"/>`,
      `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="11" fill="${colors.muted}" x="${legendX + 18}" y="${ly + 10}">${escapeXml(labels[i].slice(0, 8))}</text>`,
    );
  }

  parts.push("  </g>");
  return parts;
}

function renderRadarChart(
  chart: { title: string; unit?: string },
  labels: string[],
  values: number[],
  colors: SlideColors,
): string[] {
  const chartX = 140;
  const chartY = 180;
  const chartW = 800;
  const chartH = 400;
  const cx = chartW / 2;
  const cy = chartH / 2 + 10;
  const maxR = 150;
  const count = values.length;
  const maxVal = Math.max(...values, 1);
  const levels = 4;

  const parts: string[] = [
    `  <g id="chart-area" transform="translate(${chartX}, ${chartY})">`,
    `    <rect x="0" y="0" width="${chartW}" height="${chartH}" rx="12" fill="${colors.cardFill}" stroke="${colors.cardStroke}" stroke-width="1.5"/>`,
    `    <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.text}" x="24" y="30">${escapeXml(chart.title)}</text>`,
  ];

  // grid rings
  for (let level = 1; level <= levels; level++) {
    const lr = (maxR / levels) * level;
    const ringPts: string[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      ringPts.push(`${cx + lr * Math.cos(angle)},${cy + lr * Math.sin(angle)}`);
    }
    parts.push(
      `    <polygon points="${ringPts.join(" ")}" fill="none" stroke="${colors.cardStroke}" stroke-width="1"/>`,
    );
  }

  // axis lines
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const ex = cx + maxR * Math.cos(angle);
    const ey = cy + maxR * Math.sin(angle);
    parts.push(
      `    <line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="${colors.cardStroke}" stroke-width="1"/>`,
    );
  }

  // data polygon
  const dataPts: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const vr = (values[i] / maxVal) * maxR;
    dataPts.push(`${cx + vr * Math.cos(angle)},${cy + vr * Math.sin(angle)}`);
  }

  parts.push(
    `    <polygon points="${dataPts.join(" ")}" fill="${colors.accent}" opacity="0.15" stroke="${colors.accent}" stroke-width="2"/>`,
  );

  // data points and labels
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const vr = (values[i] / maxVal) * maxR;
    const px = cx + vr * Math.cos(angle);
    const py = cy + vr * Math.sin(angle);
    const ptColor = pickColor(i, colors);
    const lr = maxR + 28;
    const lx = cx + lr * Math.cos(angle);
    const ly = cy + lr * Math.sin(angle);

    parts.push(
      `    <circle cx="${px}" cy="${py}" r="4" fill="${ptColor}"/>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="11" fill="${colors.text}" x="${lx}" y="${ly + 4}">${escapeXml(labels[i])}</text>`,
      `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="10" font-weight="bold" fill="${ptColor}" x="${px}" y="${py - 8}">${values[i]}${chart.unit ?? ""}</text>`,
    );
  }

  parts.push("  </g>");
  return parts;
}

// --- contact ---
export function renderContactSlide(
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
  visual?: VisualAsset,
): string {
  const blocks = slidePlan.contentBlocks.slice(0, 5);
  const titleLine =
    wrapMultilingualLines(slidePlan.title, {
      maxUnitsPerLine: 30,
      maxLines: 1,
      ellipsis: "...",
    })[0] ?? slidePlan.title;
  const keyMessageLine =
    wrapMultilingualLines(slidePlan.keyMessage, {
      maxUnitsPerLine: 58,
      maxLines: 1,
      ellipsis: "...",
    })[0] ?? slidePlan.keyMessage;
  const parts: string[] = [
    `  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${colors.bg}"/>`,
    pageHeader(slidePlan, colors, index + 1),
    `  <g id="contact-card" transform="translate(240, 160)">`,
    cardShadow(0, 0, 800, 440, 16),
    `    <rect width="800" height="440" rx="16" fill="${colors.cardFill}" stroke="${colors.accent}" stroke-width="1.5"/>`,
    `    <rect x="0" y="0" width="800" height="6" rx="3" fill="${colors.accent}"/>`,
    `    <circle cx="400" cy="120" r="50" fill="${colors.accent}" opacity="0.12"/>`,
    `    <circle cx="400" cy="120" r="30" fill="${colors.accent}" opacity="0.2"/>`,
    `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="24" font-weight="bold" fill="${colors.text}" x="400" y="210">${escapeXml(titleLine)}</text>`,
    `    <text text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" fill="${colors.muted}" x="400" y="238">${escapeXml(keyMessageLine)}</text>`,
    `    <line x1="300" y1="258" x2="500" y2="258" stroke="${colors.cardStroke}" stroke-width="1"/>`,
  ];

  for (const [i, block] of blocks.entries()) {
    const y = 280 + i * 32;
    const iconColor = i % 3 === 0 ? colors.accent : i % 3 === 1 ? colors.support : colors.main;
    const headingLine =
      block.heading && block.heading.trim().length > 0
        ? (wrapMultilingualLines(block.heading, {
            maxUnitsPerLine: 14,
            maxLines: 1,
            ellipsis: "...",
          })[0] ?? block.heading)
        : "";
    const bodyLine =
      wrapMultilingualLines(block.body, {
        maxUnitsPerLine: headingLine ? 32 : 50,
        maxLines: 1,
        ellipsis: "...",
      })[0] ?? block.body;
    parts.push(
      `    <g transform="translate(60, ${y})">`,
      `      <circle cx="10" cy="-4" r="5" fill="${iconColor}" opacity="0.5"/>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.text}" x="24" y="0">${escapeXml(headingLine)}</text>`,
      `      <text font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" fill="${colors.muted}" x="${headingLine ? 160 : 24}" y="0">${escapeXml(bodyLine)}</text>`,
      "    </g>",
    );
  }

  parts.push("  </g>");

  if (visual?.dataUri) {
    parts.push(imageSideLayer(visual, 1100, 560, 140, 120));
  }

  return wrapSvg(parts.join("\n"));
}
