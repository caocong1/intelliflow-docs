// ─── Archetype-aware PPT Renderer ────────────────────────────────────────────
// Each archetype has a dedicated rendering function that positions elements
// according to its visual pattern, using tokens from a StylePack.
// All coordinates assume 16:9 LAYOUT_WIDE (13.33" × 7.5").

import type {
  ContentSlide,
  ImageSlide,
  Slide,
  SlideArchetype,
  SlideStyleOverride,
  TableSlide,
  TitleSlide,
  TwoColumnSlide,
} from "../../../../shared/src/slide-types";
import type { StylePack } from "./ppt-style-packs";

// ─── Minimal PptxGenJS slide interface ───────────────────────────────────────
// Matches the subset of PptxGenJS.Slide we actually call.

type TextOptions = Record<string, unknown>;
type TextRow = { text: string; options?: TextOptions };

export interface PptSlide {
  background?: { color?: string; fill?: Record<string, unknown> };
  addText(text: string | TextRow[], options: TextOptions): void;
  addTable(rows: unknown[][], options: TextOptions): void;
  addShape(type: string, options: TextOptions): void;
  addImage(options: TextOptions): void;
  addNotes?(notes: string): void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function strip(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

/** Contrast color: white for dark backgrounds, text color for light ones */
function contrastOn(bgHex: string, sp: StylePack): string {
  const r = Number.parseInt(bgHex.slice(0, 2), 16);
  const g = Number.parseInt(bgHex.slice(2, 4), 16);
  const b = Number.parseInt(bgHex.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 140 ? "FFFFFF" : sp.palette.text;
}

/** Resolve effective accent color based on emphasisLevel override */
function effectiveAccent(sp: StylePack, override?: SlideStyleOverride): string {
  if (!override?.emphasisLevel || override.emphasisLevel === "normal") return sp.palette.accent;
  if (override.emphasisLevel === "high") return sp.palette.primary;
  return sp.palette.divider; // low emphasis — muted
}

/** Whether to render decorative shapes (cards, shadows, icons) */
function showDecoration(override?: SlideStyleOverride): boolean {
  return override?.decorationDensity !== "minimal";
}

function addNotes(pptSlide: PptSlide, slide: Slide) {
  if ("notes" in slide && slide.notes && typeof pptSlide.addNotes === "function") {
    pptSlide.addNotes(slide.notes.slice(0, 500));
  }
}

// Slide page title helper — most archetypes share this
function addPageTitle(pptSlide: PptSlide, title: string, sp: StylePack) {
  pptSlide.addText(truncate(title, 60), {
    x: 0.75,
    y: 0.35,
    w: 11.8,
    h: 0.8,
    fontSize: sp.fonts.title.size - 4, // page titles slightly smaller than cover
    fontFace: sp.fonts.title.face,
    bold: sp.fonts.title.bold,
    color: sp.palette.text,
  });
}

// ─── Archetype Renderers ─────────────────────────────────────────────────────

function renderCoverHero(pptSlide: PptSlide, slide: TitleSlide, sp: StylePack) {
  const ovr = slide.styleOverride;
  const tone = ovr?.coverTone ?? "formal";

  if (tone === "energetic") {
    // Energetic: use accent as background
    pptSlide.background = { color: effectiveAccent(sp, ovr) };
  } else if (sp.cover.backgroundFill === "gradient" && sp.cover.gradientStops) {
    // PptxGenJS only supports solid fills in this code path. Use a layered
    // solid treatment that keeps the intended two-tone cover without relying
    // on unsupported gradient background XML.
    const accentColor = sp.cover.gradientStops[sp.cover.gradientStops.length - 1]?.color ?? sp.palette.secondary;
    pptSlide.background = { color: sp.palette.primary };
    pptSlide.addShape("rect", {
      x: tone === "creative" ? 0 : 9.2,
      y: 0,
      w: tone === "creative" ? 13.33 : 4.13,
      h: 7.5,
      fill: { color: accentColor, transparency: tone === "creative" ? 55 : 15 },
      line: { color: accentColor, transparency: 100 },
    });
    pptSlide.addShape("rect", {
      x: 0,
      y: tone === "creative" ? 6.82 : 0,
      w: 13.33,
      h: tone === "creative" ? 0.68 : 0.22,
      fill: { color: accentColor },
      line: { color: accentColor, transparency: 100 },
    });
  } else {
    pptSlide.background = { color: sp.palette.primary };
  }

  const titleColor = contrastOn(sp.palette.primary, sp);
  pptSlide.addText(truncate(slide.title, 60), {
    x: 1.0,
    y: 2.2,
    w: 11.3,
    h: 1.6,
    fontSize: sp.fonts.title.size,
    fontFace: sp.fonts.title.face,
    bold: true,
    color: titleColor,
    align: sp.cover.titleAlign,
    valign: "middle",
  });

  if (slide.subtitle) {
    pptSlide.addText(truncate(slide.subtitle, 120), {
      x: 1.0,
      y: 4.0,
      w: 11.3,
      h: 0.9,
      fontSize: sp.fonts.subtitle.size,
      fontFace: sp.fonts.subtitle.face,
      color: titleColor,
      align: sp.cover.titleAlign,
      valign: "top",
      transparency: 25,
    });
  }
}

function renderCoverSplit(pptSlide: PptSlide, slide: TitleSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };

  // Right accent block (40%)
  pptSlide.addShape("rect", {
    x: 7.8,
    y: 0,
    w: 5.53,
    h: 7.5,
    fill: { color: sp.palette.primary },
  });

  // Left text area
  pptSlide.addText(truncate(slide.title, 60), {
    x: 0.75,
    y: 2.0,
    w: 6.5,
    h: 1.6,
    fontSize: sp.fonts.title.size,
    fontFace: sp.fonts.title.face,
    bold: true,
    color: sp.palette.text,
    align: "left",
    valign: "middle",
  });

  if (slide.subtitle) {
    pptSlide.addText(truncate(slide.subtitle, 120), {
      x: 0.75,
      y: 3.8,
      w: 6.5,
      h: 0.9,
      fontSize: sp.fonts.subtitle.size,
      fontFace: sp.fonts.subtitle.face,
      color: sp.palette.textLight,
      align: "left",
    });
  }

  // Accent bar
  pptSlide.addShape("rect", {
    x: 0.75,
    y: 4.9,
    w: 2.0,
    h: 0.06,
    fill: { color: sp.palette.accent },
  });
}

function renderTocVertical(pptSlide: PptSlide, slide: Slide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, "title" in slide ? (slide as TitleSlide).title : "目录", sp);

  const subtitle = slide.layout === "title" ? (slide as TitleSlide).subtitle : undefined;
  const items =
    slide.layout === "content"
      ? (slide as ContentSlide).bullets
      : subtitle
        ? [subtitle]
        : [];

  items.slice(0, 8).forEach((item, i) => {
    const y = 1.5 + i * 0.7;
    // Number circle
    pptSlide.addShape("ellipse", {
      x: 0.75,
      y,
      w: 0.42,
      h: 0.42,
      fill: { color: i === 0 ? sp.palette.primary : sp.palette.surface },
    });
    pptSlide.addText(String(i + 1), {
      x: 0.75,
      y,
      w: 0.42,
      h: 0.42,
      fontSize: 12,
      fontFace: sp.fonts.body.face,
      bold: true,
      color: i === 0 ? contrastOn(sp.palette.primary, sp) : sp.palette.text,
      align: "center",
      valign: "middle",
    });
    pptSlide.addText(truncate(strip(item), 100), {
      x: 1.4,
      y,
      w: 10.5,
      h: 0.42,
      fontSize: sp.fonts.body.size,
      fontFace: sp.fonts.body.face,
      color: sp.palette.text,
      valign: "middle",
    });
  });
}

function renderTocGrid(pptSlide: PptSlide, slide: Slide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, "title" in slide ? (slide as TitleSlide).title : "目录", sp);

  const items =
    slide.layout === "content" ? (slide as ContentSlide).bullets : [];
  const count = Math.min(items.length, 6);
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const cardW = (11.0 - (cols - 1) * 0.4) / cols;
  const cardH = (5.2 - (rows - 1) * 0.4) / rows;

  items.slice(0, count).forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.75 + col * (cardW + 0.4);
    const y = 1.6 + row * (cardH + 0.4);

    // Card background
    pptSlide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: sp.palette.surface },
      rectRadius: sp.shapes.cornerRadius,
      shadow: sp.shapes.cardShadow
        ? { type: "outer", blur: 4, offset: 2, color: "000000", opacity: 0.08 }
        : undefined,
    });

    // Number
    pptSlide.addText(String(i + 1).padStart(2, "0"), {
      x: x + 0.3,
      y: y + 0.25,
      w: 1.0,
      h: 0.5,
      fontSize: sp.fonts.kpi.size * 0.5,
      fontFace: sp.fonts.kpi.face,
      bold: true,
      color: sp.palette.primary,
    });

    // Text
    pptSlide.addText(truncate(strip(item), 80), {
      x: x + 0.3,
      y: y + 0.85,
      w: cardW - 0.6,
      h: cardH - 1.1,
      fontSize: sp.fonts.body.size,
      fontFace: sp.fonts.body.face,
      color: sp.palette.text,
      valign: "top",
      autoFit: true,
    });
  });
}

function renderSectionDivider(pptSlide: PptSlide, slide: TitleSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.surface };

  // Accent stripe at top
  pptSlide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.08,
    fill: { color: sp.palette.primary },
  });

  pptSlide.addText(truncate(slide.title, 60), {
    x: 1.5,
    y: 2.5,
    w: 10.3,
    h: 1.5,
    fontSize: sp.fonts.title.size,
    fontFace: sp.fonts.title.face,
    bold: true,
    color: sp.palette.text,
    align: "center",
    valign: "middle",
  });

  if (slide.subtitle) {
    pptSlide.addText(truncate(slide.subtitle, 120), {
      x: 2.0,
      y: 4.2,
      w: 9.3,
      h: 0.8,
      fontSize: sp.fonts.subtitle.size,
      fontFace: sp.fonts.subtitle.face,
      color: sp.palette.textLight,
      align: "center",
    });
  }
}

function renderBulletStory(pptSlide: PptSlide, slide: ContentSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, slide.title, sp);

  const bulletRows = slide.bullets.map((bullet) => {
    const isBold = bullet.startsWith("**") && bullet.endsWith("**");
    const text = isBold ? bullet.slice(2, -2) : strip(bullet);
    return {
      text: truncate(text, 120),
      options: {
        fontSize: sp.fonts.body.size,
        fontFace: sp.fonts.body.face,
        color: sp.palette.text,
        bold: isBold,
        bullet: { code: "2022" },
        paraSpaceAfter: 6,
      },
    };
  });

  pptSlide.addText(bulletRows, {
    x: 0.75,
    y: 1.4,
    w: 11.8,
    h: 5.5,
    valign: "top",
    autoFit: true,
  });
}

function renderFeatureGrid(pptSlide: PptSlide, slide: ContentSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, slide.title, sp);
  const decorate = showDecoration(slide.styleOverride);

  const items = slide.bullets.slice(0, 4);
  const cols = items.length <= 2 ? 2 : 2;
  const rows = Math.ceil(items.length / cols);
  const cardW = 5.2;
  const cardH = rows === 1 ? 4.5 : 2.2;
  const gapX = 0.6;
  const startX = (13.33 - cols * cardW - (cols - 1) * gapX) / 2;

  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = 1.6 + row * (cardH + 0.5);

    // Card
    pptSlide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: sp.palette.surface },
      rectRadius: sp.shapes.cornerRadius,
      shadow: decorate && sp.shapes.cardShadow
        ? { type: "outer", blur: 4, offset: 2, color: "000000", opacity: 0.08 }
        : undefined,
    });

    if (decorate) {
      // Icon placeholder circle
      pptSlide.addShape("ellipse", {
        x: x + 0.35,
        y: y + 0.3,
        w: 0.5,
        h: 0.5,
        fill: { color: sp.palette.primary },
      });
      pptSlide.addText(String(i + 1), {
        x: x + 0.35,
        y: y + 0.3,
        w: 0.5,
        h: 0.5,
        fontSize: 14,
        fontFace: sp.fonts.body.face,
        bold: true,
        color: contrastOn(sp.palette.primary, sp),
        align: "center",
        valign: "middle",
      });
    }

    // Feature text
    pptSlide.addText(truncate(strip(item), 100), {
      x: decorate ? x + 1.1 : x + 0.3,
      y: y + 0.3,
      w: decorate ? cardW - 1.5 : cardW - 0.6,
      h: cardH - 0.6,
      fontSize: sp.fonts.body.size,
      fontFace: sp.fonts.body.face,
      color: sp.palette.text,
      valign: "middle",
      autoFit: true,
    });
  });
}

function renderComparisonSplit(pptSlide: PptSlide, slide: TwoColumnSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, slide.title, sp);

  // Center divider
  if (sp.shapes.dividerStyle !== "none") {
    pptSlide.addShape("rect", {
      x: 6.55,
      y: 1.5,
      w: 0.03,
      h: 5.2,
      fill: { color: sp.palette.divider },
    });
  }

  // Left column
  const leftTitle = slide.left.title ? strip(slide.left.title) : "";
  if (leftTitle) {
    pptSlide.addText(truncate(leftTitle, 50), {
      x: 0.75,
      y: 1.5,
      w: 5.5,
      h: 0.6,
      fontSize: sp.fonts.subtitle.size,
      fontFace: sp.fonts.subtitle.face,
      bold: true,
      color: sp.palette.primary,
    });
  }
  const leftBullets = slide.left.bullets.map((b) => ({
    text: truncate(strip(b), 80),
    options: {
      fontSize: sp.fonts.body.size,
      fontFace: sp.fonts.body.face,
      color: sp.palette.text,
      bullet: { code: "2022" },
      paraSpaceAfter: 5,
    },
  }));
  pptSlide.addText(leftBullets, {
    x: 0.75,
    y: leftTitle ? 2.2 : 1.5,
    w: 5.5,
    h: leftTitle ? 4.5 : 5.2,
    valign: "top",
    autoFit: true,
  });

  // Right column
  const rightTitle = slide.right.title ? strip(slide.right.title) : "";
  if (rightTitle) {
    pptSlide.addText(truncate(rightTitle, 50), {
      x: 6.9,
      y: 1.5,
      w: 5.5,
      h: 0.6,
      fontSize: sp.fonts.subtitle.size,
      fontFace: sp.fonts.subtitle.face,
      bold: true,
      color: sp.palette.accent,
    });
  }
  const rightBullets = slide.right.bullets.map((b) => ({
    text: truncate(strip(b), 80),
    options: {
      fontSize: sp.fonts.body.size,
      fontFace: sp.fonts.body.face,
      color: sp.palette.text,
      bullet: { code: "2022" },
      paraSpaceAfter: 5,
    },
  }));
  pptSlide.addText(rightBullets, {
    x: 6.9,
    y: rightTitle ? 2.2 : 1.5,
    w: 5.5,
    h: rightTitle ? 4.5 : 5.2,
    valign: "top",
    autoFit: true,
  });
}

function renderTimelineHorizontal(pptSlide: PptSlide, slide: ContentSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, slide.title, sp);

  const items = slide.bullets.slice(0, 5);
  const count = items.length;
  const totalW = 11.0;
  const stepW = totalW / count;
  const startX = 0.75 + stepW / 2;
  const lineY = 3.0;

  // Horizontal line
  pptSlide.addShape("rect", {
    x: 0.75,
    y: lineY + 0.14,
    w: totalW,
    h: 0.04,
    fill: { color: sp.palette.divider },
  });

  items.forEach((item, i) => {
    const cx = startX + i * stepW;

    // Node dot
    pptSlide.addShape("ellipse", {
      x: cx - 0.2,
      y: lineY,
      w: 0.32,
      h: 0.32,
      fill: { color: i === 0 ? sp.palette.primary : sp.palette.secondary },
    });

    // Step number
    pptSlide.addText(String(i + 1), {
      x: cx - 0.2,
      y: lineY,
      w: 0.32,
      h: 0.32,
      fontSize: 10,
      fontFace: sp.fonts.caption.face,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });

    // Label below
    pptSlide.addText(truncate(strip(item), 60), {
      x: cx - stepW / 2 + 0.1,
      y: lineY + 0.6,
      w: stepW - 0.2,
      h: 1.8,
      fontSize: sp.fonts.body.size - 1,
      fontFace: sp.fonts.body.face,
      color: sp.palette.text,
      align: "center",
      valign: "top",
      autoFit: true,
    });
  });
}

function renderKpiRow(pptSlide: PptSlide, slide: ContentSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, slide.title, sp);

  const items = slide.bullets.slice(0, 4);
  const count = items.length;
  const cardW = (11.0 - (count - 1) * 0.5) / count;
  const startX = 0.75;

  items.forEach((item, i) => {
    const x = startX + i * (cardW + 0.5);
    // Try to split "number label" or just use the text as label
    const parts = item.match(/^([\d,.%+\-¥$€£]+)\s+(.+)$/);
    const value = parts ? parts[1] : String(i + 1);
    const label = parts ? parts[2] : strip(item);

    // Card
    pptSlide.addShape("roundRect", {
      x,
      y: 2.0,
      w: cardW,
      h: 3.5,
      fill: { color: sp.palette.surface },
      rectRadius: sp.shapes.cornerRadius,
      shadow: sp.shapes.cardShadow
        ? { type: "outer", blur: 4, offset: 2, color: "000000", opacity: 0.08 }
        : undefined,
    });

    // Big number
    pptSlide.addText(truncate(value, 12), {
      x,
      y: 2.4,
      w: cardW,
      h: 1.4,
      fontSize: sp.fonts.kpi.size,
      fontFace: sp.fonts.kpi.face,
      bold: true,
      color: sp.palette.primary,
      align: "center",
      valign: "middle",
    });

    // Label
    pptSlide.addText(truncate(strip(label), 40), {
      x: x + 0.2,
      y: 3.9,
      w: cardW - 0.4,
      h: 1.2,
      fontSize: sp.fonts.body.size,
      fontFace: sp.fonts.body.face,
      color: sp.palette.textLight,
      align: "center",
      valign: "top",
      autoFit: true,
    });
  });
}

function renderTableClean(pptSlide: PptSlide, slide: TableSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, slide.title, sp);

  const colW = 11.0 / Math.max(slide.headers.length, 1);
  const headerColor = contrastOn(sp.table.headerFill, sp);

  const headerRow = slide.headers.map((h) => ({
    text: truncate(strip(h), 30),
    options: {
      bold: true,
      fontSize: 11,
      fontFace: sp.fonts.body.face,
      fill: { color: sp.table.headerFill },
      color: headerColor,
      align: "left",
      valign: "middle",
    },
  }));

  const dataRows = slide.rows.map((row, rowIdx) =>
    row.map((cell) => ({
      text: truncate(strip(cell), 50),
      options: {
        fontSize: 10,
        fontFace: sp.fonts.body.face,
        fill: rowIdx % 2 === 1 ? { color: sp.table.stripeFill } : undefined,
        color: sp.palette.text,
        align: "left",
        valign: "middle",
      },
    })),
  );

  pptSlide.addTable([headerRow, ...dataRows], {
    x: 0.75,
    y: 1.5,
    colW,
    border: { type: "solid", pt: sp.table.borderWidth, color: sp.table.borderColor },
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}

function renderSummaryCards(pptSlide: PptSlide, slide: ContentSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, slide.title, sp);

  const items = slide.bullets.slice(0, 4);
  const cardW = 11.0;
  const cardH = Math.min(1.1, 5.0 / items.length);
  const gap = 0.2;

  items.forEach((item, i) => {
    const y = 1.6 + i * (cardH + gap);

    pptSlide.addShape("roundRect", {
      x: 0.75,
      y,
      w: cardW,
      h: cardH,
      fill: { color: sp.palette.surface },
      rectRadius: sp.shapes.cornerRadius,
    });

    // Accent left bar
    pptSlide.addShape("rect", {
      x: 0.75,
      y,
      w: 0.08,
      h: cardH,
      fill: { color: i === 0 ? sp.palette.primary : sp.palette.secondary },
    });

    pptSlide.addText(truncate(strip(item), 120), {
      x: 1.15,
      y,
      w: cardW - 0.7,
      h: cardH,
      fontSize: sp.fonts.body.size,
      fontFace: sp.fonts.body.face,
      color: sp.palette.text,
      valign: "middle",
      autoFit: true,
    });
  });
}

function renderQnaCentered(pptSlide: PptSlide, slide: Slide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.surface };

  pptSlide.addText("Q & A", {
    x: 1.0,
    y: 1.8,
    w: 11.3,
    h: 2.0,
    fontSize: sp.fonts.title.size + 8,
    fontFace: sp.fonts.title.face,
    bold: true,
    color: sp.palette.primary,
    align: "center",
    valign: "middle",
  });

  const subtitle =
    "title" in slide ? (slide as TitleSlide).subtitle : undefined;
  if (subtitle) {
    pptSlide.addText(truncate(subtitle, 120), {
      x: 2.0,
      y: 4.0,
      w: 9.3,
      h: 0.8,
      fontSize: sp.fonts.subtitle.size,
      fontFace: sp.fonts.subtitle.face,
      color: sp.palette.textLight,
      align: "center",
    });
  }
}

function renderClosingMinimal(pptSlide: PptSlide, slide: TitleSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };

  pptSlide.addText(truncate(slide.title, 60), {
    x: 1.5,
    y: 2.5,
    w: 10.3,
    h: 1.5,
    fontSize: sp.fonts.title.size,
    fontFace: sp.fonts.title.face,
    bold: true,
    color: sp.palette.text,
    align: "center",
    valign: "middle",
  });

  if (slide.subtitle) {
    pptSlide.addText(truncate(slide.subtitle, 120), {
      x: 2.0,
      y: 4.2,
      w: 9.3,
      h: 0.8,
      fontSize: sp.fonts.subtitle.size,
      fontFace: sp.fonts.subtitle.face,
      color: sp.palette.textLight,
      align: "center",
    });
  }

  // Bottom accent line
  pptSlide.addShape("rect", {
    x: 5.0,
    y: 5.5,
    w: 3.33,
    h: 0.05,
    fill: { color: sp.palette.primary },
  });
}

// ─── Image fallback (reused for image archetype) ─────────────────────────────

function renderImageSlide(pptSlide: PptSlide, slide: ImageSlide, sp: StylePack) {
  pptSlide.background = { color: sp.palette.background };
  addPageTitle(pptSlide, slide.title, sp);

  // Placeholder rect (actual image path resolution is handled by export.service)
  pptSlide.addShape("rect", {
    x: 2.0,
    y: 1.5,
    w: 9.0,
    h: 4.8,
    fill: { color: sp.palette.surface },
    line: { color: sp.palette.divider, width: 1 },
  });

  pptSlide.addText(slide.caption || "[图片]", {
    x: 2.0,
    y: 1.5 + 2.0,
    w: 9.0,
    h: 0.8,
    fontSize: sp.fonts.caption.size,
    fontFace: sp.fonts.caption.face,
    color: sp.palette.textLight,
    align: "center",
    valign: "middle",
  });
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

const archetypeRenderers: Record<
  SlideArchetype,
  (pptSlide: PptSlide, slide: Slide, sp: StylePack) => void
> = {
  cover_hero: (s, sl, sp) => renderCoverHero(s, sl as TitleSlide, sp),
  cover_split: (s, sl, sp) => renderCoverSplit(s, sl as TitleSlide, sp),
  toc_vertical: (s, sl, sp) => renderTocVertical(s, sl, sp),
  toc_grid: (s, sl, sp) => renderTocGrid(s, sl, sp),
  section_divider: (s, sl, sp) => renderSectionDivider(s, sl as TitleSlide, sp),
  bullet_story: (s, sl, sp) => renderBulletStory(s, sl as ContentSlide, sp),
  feature_grid: (s, sl, sp) => renderFeatureGrid(s, sl as ContentSlide, sp),
  comparison_split: (s, sl, sp) => renderComparisonSplit(s, sl as TwoColumnSlide, sp),
  timeline_horizontal: (s, sl, sp) => renderTimelineHorizontal(s, sl as ContentSlide, sp),
  kpi_row: (s, sl, sp) => renderKpiRow(s, sl as ContentSlide, sp),
  table_clean: (s, sl, sp) => renderTableClean(s, sl as TableSlide, sp),
  summary_cards: (s, sl, sp) => renderSummaryCards(s, sl as ContentSlide, sp),
  qna_centered: (s, sl, sp) => renderQnaCentered(s, sl, sp),
  closing_minimal: (s, sl, sp) => renderClosingMinimal(s, sl as TitleSlide, sp),
};

/** Layout-aware fallback when archetype/layout mismatch causes an error */
function renderByLayout(pptSlide: PptSlide, slide: Slide, sp: StylePack) {
  switch (slide.layout) {
    case "title":
      renderClosingMinimal(pptSlide, slide, sp);
      break;
    case "content":
      renderBulletStory(pptSlide, slide, sp);
      break;
    case "two_column":
      renderComparisonSplit(pptSlide, slide, sp);
      break;
    case "table":
      renderTableClean(pptSlide, slide, sp);
      break;
    case "image":
      renderImageSlide(pptSlide, slide, sp);
      break;
    default:
      break;
  }
}

/**
 * Render a single slide using its archetype and a style pack.
 * Falls back to a layout-aware renderer for unknown archetypes or mismatches.
 */
export function renderArchetypeSlide(
  pptSlide: PptSlide,
  slide: Slide,
  stylePack: StylePack,
): void {
  const archetype: SlideArchetype = slide.archetype ?? "bullet_story";
  const renderer = archetypeRenderers[archetype] ?? archetypeRenderers.bullet_story;

  try {
    renderer(pptSlide, slide, stylePack);
  } catch {
    renderByLayout(pptSlide, slide, stylePack);
  }

  addNotes(pptSlide, slide);
}
