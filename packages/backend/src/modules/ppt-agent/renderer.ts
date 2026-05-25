import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import { shouldGenerateImageForSlide, slideIcon } from "./design-assets";
import type { DeckPlan, DeckSlide, PptGenerationMode, RenderedPpt, VisualAsset } from "./types";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const SAFE = 0.5;
const FONT = "Microsoft YaHei";

type PptSlide = ReturnType<PptxGenJS["addSlide"]>;
type Rgb = { r: number; g: number; b: number };

export async function renderDeckToPptx(
  deckPlan: DeckPlan,
  visuals: VisualAsset[],
  generationMode: PptGenerationMode = "template_locked",
): Promise<RenderedPpt> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "IntelliFlow PPT Agent";
  pptx.subject = deckPlan.subtitle;
  pptx.title = deckPlan.title;
  pptx.company = "IntelliFlow";
  pptx.theme = {
    headFontFace: FONT,
    bodyFontFace: FONT,
  };

  const visualMap = new Map(visuals.map((visual) => [visual.slideId, visual]));
  const warnings: string[] = [];
  const palette = ensurePalette(deckPlan.theme.palette);

  for (const [index, slidePlan] of deckPlan.slides.entries()) {
    const slide = pptx.addSlide();
    const visual = visualMap.get(slidePlan.id);
    if (!visual && shouldGenerateImageForSlide(slidePlan, index, deckPlan.slides.length)) {
      warnings.push(`slide ${slidePlan.id} 缺少视觉素材，已使用版式图形。`);
    }

    renderSlide(slide, deckPlan, slidePlan, visual, palette, index, generationMode);
    if (slidePlan.speakerNotes.trim()) {
      (slide as unknown as { addNotes?: (notes: string) => void }).addNotes?.(
        slidePlan.speakerNotes.slice(0, 1000),
      );
    }
  }

  const rawBuffer = (await pptx.write({ outputType: "nodebuffer" })) as unknown as Buffer;
  const buffer = await normalizePptxXmlOrder(rawBuffer);
  return { buffer, warnings };
}

async function normalizePptxXmlOrder(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const presentation = zip.file("ppt/presentation.xml");
  if (!presentation) return buffer;

  const xml = await presentation.async("string");
  const notesMaster = xml.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/)?.[0];
  const slideList = xml.match(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/)?.[0];
  if (!notesMaster || !slideList || xml.indexOf(notesMaster) < xml.indexOf(slideList))
    return buffer;

  const fixed = xml.replace(notesMaster, "").replace(slideList, `${notesMaster}${slideList}`);
  zip.file("ppt/presentation.xml", fixed);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

function renderSlide(
  slide: PptSlide,
  deckPlan: DeckPlan,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  palette: string[],
  index: number,
  generationMode: PptGenerationMode,
) {
  const colors = slideColors(palette, index);
  if (generationMode === "auto_dynamic") {
    renderDynamicSlide(slide, deckPlan, slidePlan, visual, colors, index);
  } else {
    addBaseBackground(slide, colors, slidePlan, index);
    renderExecutiveSlide(slide, deckPlan, slidePlan, visual, colors, index);
    addFooter(slide, slidePlan, index, colors);
  }
}

function renderExecutiveSlide(
  slide: PptSlide,
  deckPlan: DeckPlan,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
  index: number,
) {
  switch (slidePlan.pageType) {
    case "cover":
      renderExecutiveCover(slide, deckPlan, slidePlan, visual, colors);
      break;
    case "agenda":
      renderExecutiveAgenda(slide, slidePlan, visual, colors);
      break;
    case "section":
      renderExecutiveSection(slide, slidePlan, visual, colors, index);
      break;
    case "architecture":
      renderExecutiveArchitecture(slide, slidePlan, visual, colors);
      break;
    case "timeline":
      renderExecutiveTimeline(slide, slidePlan, visual, colors);
      break;
    case "metrics":
      renderExecutiveMetrics(slide, slidePlan, visual, colors);
      break;
    case "table":
      renderExecutiveTable(slide, slidePlan, visual, colors);
      break;
    case "risk":
    case "governance":
      renderExecutiveRiskGovernance(slide, slidePlan, visual, colors);
      break;
    case "closing":
      renderExecutiveClosing(slide, slidePlan, visual, colors);
      break;
    default:
      renderExecutiveContent(slide, slidePlan, visual, colors, index);
      break;
  }
}

function renderExecutiveCover(
  slide: PptSlide,
  deckPlan: DeckPlan,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addVisual(slide, visual, 0, 0, SLIDE_W, SLIDE_H, 0, 0);
  addImageShade(slide, colors.bg, 8);
  addImageShade(slide, colors.main, 30, 6.85, 0, 6.5, SLIDE_H);
  addAccentBar(slide, 0.58, 0.78, 0.08, 5.6, colors.accent);
  addAccentBar(slide, 0.74, 0.78, 0.03, 4.35, colors.support);
  addText(slide, "INTELLIFLOW PPT AGENT", 0.9, 0.8, 3.25, 0.22, {
    fontSize: 7.8,
    bold: true,
    color: colors.accent,
    charSpace: 0,
  });
  addText(slide, formatCoverTitle(deckPlan.title || slidePlan.title), 0.86, 1.34, 5.88, 1.78, {
    fontSize: 31,
    bold: true,
    color: colors.text,
    fit: "shrink",
    margin: 0.02,
  });
  addText(slide, deckPlan.subtitle || slidePlan.keyMessage, 0.9, 3.28, 5.8, 0.54, {
    fontSize: 14,
    color: colors.muted,
    fit: "shrink",
    margin: 0.01,
  });
  addPill(slide, deckPlan.audience, 0.9, 5.54, 5.4, 0.44, colors);
  addIconFeature(slide, slidePlan, 8.42, 4.92, 3.45, 1.28, colors);
}

function renderExecutiveAgenda(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  if (visual) {
    addVisual(slide, visual, 8.35, 0, 4.98, SLIDE_H, 0, 8);
    addImageShade(slide, colors.bg, 8, 8.35, 0, 4.98, SLIDE_H);
  } else {
    addIconWatermark(slide, slidePlan, 9.25, 1.35, 2.25, colors);
  }
  addPageHeader(slide, slidePlan, colors, 0.68, 0.62, 6.9);
  const items = normalizedBlocks(slidePlan, 6);
  for (const [i, block] of items.entries()) {
    const y = 1.82 + i * 0.73;
    const num = String(i + 1).padStart(2, "0");
    slide.addShape("rect", {
      x: 0.72,
      y: y + 0.03,
      w: 0.58,
      h: 0.38,
      fill: { color: i % 2 === 0 ? colors.accent : colors.support },
      line: { color: colors.bg, transparency: 100 },
    });
    addText(slide, num, 0.78, y + 0.15, 0.46, 0.1, {
      fontSize: 6.6,
      bold: true,
      color: colors.bg,
      align: "center",
    });
    addText(slide, block.heading || block.body, 1.62, y - 0.02, 5.7, 0.22, {
      fontSize: 13.6,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, 1.62, y + 0.24, 5.52, 0.18, {
        fontSize: 8.7,
        color: colors.muted,
        fit: "shrink",
      });
    }
    slide.addShape("line", {
      x: 1.62,
      y: y + 0.56,
      w: 5.3,
      h: 0,
      line: { color: colors.main, transparency: 68, width: 0.8 },
    });
  }
  addIconFeature(slide, slidePlan, 9.04, 5.08, 3.35, 1.18, colors);
}

function renderExecutiveSection(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
  index: number,
) {
  addVisual(slide, visual, 0, 0, SLIDE_W, SLIDE_H, 0, 6);
  addImageShade(slide, colors.bg, 18);
  addMotif(slide, colors, 0.74, 0.76, 3.05, 5.88, index);
  addText(slide, slidePlan.title, 4.22, 2.16, 7.15, 0.92, {
    fontSize: 33,
    bold: true,
    color: colors.text,
    fit: "shrink",
  });
  addText(slide, slidePlan.keyMessage, 4.26, 3.25, 6.56, 0.44, {
    fontSize: 13.2,
    color: colors.muted,
    fit: "shrink",
  });
  addAccentBar(slide, 4.28, 4.02, 1.5, 0.07, colors.accent);
}

function renderExecutiveArchitecture(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addIconWatermark(slide, slidePlan, 9.16, 1.28, 2.45, colors);
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 7.4);
  const blocks = normalizedBlocks(slidePlan, 5);
  for (const [i, block] of blocks.entries()) {
    const y = 1.84 + i * 0.82;
    const w = 6.78 - i * 0.38;
    const x = 0.82 + i * 0.19;
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h: 0.58,
      rectRadius: 0.06,
      fill: { color: i % 2 === 0 ? colors.panel : colors.main, transparency: i % 2 === 0 ? 3 : 10 },
      line: { color: i === 1 ? colors.support : colors.accent, transparency: 32, width: 1 },
    });
    addText(slide, block.heading || block.body, x + 0.22, y + 0.13, 1.68, 0.16, {
      fontSize: 8.8,
      bold: true,
      color: i === 1 ? colors.support : colors.accent,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, x + 2.06, y + 0.13, w - 2.28, 0.18, {
        fontSize: 8.1,
        color: colors.text,
        fit: "shrink",
      });
    }
  }
  slide.addShape("line", {
    x: 7.22,
    y: 2.04,
    w: 1.12,
    h: 3.2,
    line: { color: colors.accent, transparency: 10, width: 2, endArrowType: "triangle" },
  });
  addText(slide, "统一治理与服务编排", 8.84, 5.78, 2.86, 0.16, {
    fontSize: 8,
    bold: true,
    color: colors.text,
    fit: "shrink",
    align: "center",
  });
}

function renderExecutiveTimeline(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 7.8);
  const items =
    slidePlan.timeline && slidePlan.timeline.length > 0
      ? slidePlan.timeline.slice(0, 5)
      : normalizedBlocks(slidePlan, 5).map((block, i) => ({
          label: block.heading || `阶段 ${i + 1}`,
          description: block.body,
          date: `P${i + 1}`,
        }));
  const startX = 0.85;
  const gap = 11.25 / Math.max(items.length - 1, 1);
  slide.addShape("line", {
    x: startX,
    y: 3.45,
    w: gap * Math.max(items.length - 1, 0),
    h: 0,
    line: { color: colors.accent, transparency: 16, width: 3 },
  });
  for (const [i, item] of items.entries()) {
    const x = startX + i * gap;
    slide.addShape("ellipse", {
      x: x - 0.2,
      y: 3.17,
      w: 0.56,
      h: 0.56,
      fill: { color: i === items.length - 1 ? colors.support : colors.accent },
      line: { color: colors.bg, transparency: 100 },
    });
    addText(slide, item.date || `0${i + 1}`, x - 0.13, 3.34, 0.42, 0.1, {
      fontSize: 6.2,
      bold: true,
      color: colors.bg,
      align: "center",
    });
    addText(slide, item.label, x - 0.58, 2.46, 1.35, 0.26, {
      fontSize: 10.5,
      bold: true,
      color: colors.text,
      fit: "shrink",
      align: "center",
    });
    addText(slide, item.description, x - 0.78, 3.94, 1.78, 0.54, {
      fontSize: 7.6,
      color: colors.muted,
      fit: "shrink",
      align: "center",
    });
  }
}

function renderExecutiveMetrics(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 7.3);
  addIconWatermark(slide, slidePlan, 9.15, 1.08, 2.25, colors);
  const chart = slidePlan.chart;
  const blocks = normalizedBlocks(slidePlan, 4);
  for (const [i, block] of blocks.slice(0, 4).entries()) {
    const x = 0.74 + (i % 2) * 3.66;
    const y = 1.92 + Math.floor(i / 2) * 1.72;
    const metric =
      extractMetric(block.body) ||
      (chart?.values?.[i] !== undefined ? `${chart.values[i]}${chart.unit ?? ""}` : `${i + 1}`);
    slide.addShape("roundRect", {
      x,
      y,
      w: 3.12,
      h: 1.22,
      rectRadius: 0.08,
      fill: { color: colors.panel, transparency: 2 },
      line: { color: i === 0 ? colors.support : colors.accent, transparency: 24, width: 1.2 },
    });
    addText(slide, metric, x + 0.2, y + 0.14, 1.45, 0.4, {
      fontSize: 24,
      bold: true,
      color: i === 0 ? colors.support : colors.accent,
      fit: "shrink",
    });
    addText(slide, block.heading || "关键指标", x + 0.22, y + 0.7, 2.48, 0.2, {
      fontSize: 9.4,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, x + 0.22, y + 0.96, 2.58, 0.16, {
        fontSize: 6.9,
        color: colors.muted,
        fit: "shrink",
      });
    }
  }
  const values = chart?.values?.slice(0, 3) ?? [35, 20, 60];
  for (const [i, value] of values.entries()) {
    const h = Math.max(0.35, Math.min(1.35, value / 45));
    slide.addShape("rect", {
      x: 1.02 + i * 1.02,
      y: 5.8 - h,
      w: 0.54,
      h,
      fill: { color: i === 2 ? colors.support : colors.accent, transparency: 4 },
      line: { color: colors.bg, transparency: 100 },
    });
  }
}

function renderExecutiveTable(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 7.7);
  addIconWatermark(slide, slidePlan, 9.58, 1.15, 2.1, colors);
  const table =
    slidePlan.table ??
    ({
      headers: ["维度", "设计要点", "管理抓手"],
      rows: normalizedBlocks(slidePlan, 5).map((block) => [
        block.heading || "议题",
        block.body.slice(0, 40),
        slidePlan.keyMessage.slice(0, 32),
      ]),
    } satisfies NonNullable<DeckSlide["table"]>);
  const headers = table.headers.slice(0, 4);
  const rows = table.rows.slice(0, 6);
  const x = 0.7;
  const y = 1.86;
  const w = 8.3;
  const rowH = 0.5;
  const colW = w / headers.length;
  for (const [col, header] of headers.entries()) {
    slide.addShape("rect", {
      x: x + col * colW,
      y,
      w: colW,
      h: rowH,
      fill: { color: col === 0 ? colors.support : colors.accent, transparency: col === 0 ? 8 : 18 },
      line: { color: colors.bg, transparency: 100 },
    });
    addText(slide, header, x + col * colW + 0.1, y + 0.15, colW - 0.18, 0.14, {
      fontSize: 8.2,
      bold: true,
      color: colors.bg,
      fit: "shrink",
    });
  }
  for (const [rowIndex, row] of rows.entries()) {
    for (const [col, cell] of row.slice(0, headers.length).entries()) {
      slide.addShape("rect", {
        x: x + col * colW,
        y: y + rowH * (rowIndex + 1),
        w: colW,
        h: rowH,
        fill: {
          color: rowIndex % 2 === 0 ? colors.panel : colors.main,
          transparency: rowIndex % 2 === 0 ? 5 : 15,
        },
        line: { color: colors.main, transparency: 56, width: 0.6 },
      });
      addText(
        slide,
        cell,
        x + col * colW + 0.1,
        y + rowH * (rowIndex + 1) + 0.13,
        colW - 0.18,
        0.17,
        {
          fontSize: 7.0,
          color: colors.text,
          fit: "shrink",
        },
      );
    }
  }
}

function renderExecutiveRiskGovernance(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 8.1);
  const blocks = normalizedBlocks(slidePlan, 4);
  for (const [i, block] of blocks.entries()) {
    const columns = Math.min(blocks.length, 4);
    const gap = 0.38;
    const cardW = (11.96 - gap * (columns - 1)) / columns;
    const x = 0.74 + i * (cardW + gap);
    slide.addShape("roundRect", {
      x,
      y: 2.02,
      w: cardW,
      h: 2.08,
      rectRadius: 0.08,
      fill: { color: colors.panel, transparency: 2 },
      line: { color: i === 0 ? colors.support : colors.accent, transparency: 28, width: 1.1 },
    });
    addAccentBar(slide, x + 0.22, 2.26, 0.48, 0.06, i === 0 ? colors.support : colors.accent);
    addText(slide, block.heading || `治理项 ${i + 1}`, x + 0.22, 2.48, cardW - 0.48, 0.28, {
      fontSize: 12.4,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    addText(slide, block.body, x + 0.22, 3.0, cardW - 0.48, 0.7, {
      fontSize: 9.2,
      color: colors.muted,
      fit: "shrink",
    });
  }
}

function renderExecutiveClosing(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addVisual(slide, visual, 0, 0, SLIDE_W, SLIDE_H, 0, 0);
  addImageShade(slide, colors.bg, 10);
  addImageShade(slide, colors.main, 34, 0, 0, 7.1, SLIDE_H);
  addText(slide, slidePlan.title, 0.82, 1.72, 6.2, 0.82, {
    fontSize: 31,
    bold: true,
    color: colors.text,
    fit: "shrink",
  });
  addText(slide, slidePlan.keyMessage, 0.86, 2.8, 5.72, 0.46, {
    fontSize: 13.2,
    color: colors.muted,
    fit: "shrink",
  });
  const blocks = normalizedBlocks(slidePlan, 3);
  for (const [i, block] of blocks.entries()) {
    addPill(slide, block.heading || block.body, 0.86 + i * 2.08, 4.52, 1.76, 0.42, colors);
  }
  addIconFeature(slide, slidePlan, 8.12, 4.88, 3.76, 1.28, colors);
}

function renderExecutiveContent(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
  index: number,
) {
  const hierarchy = slidePlan.visualHierarchy?.toLowerCase() ?? "";
  const layoutIntent = slidePlan.layoutIntent?.toLowerCase() ?? "";
  const isComparison = /对比|比较|compare|versus|两者|差异/.test(hierarchy + layoutIntent);
  const isFlow = /流程|流转|pipeline|序列|步骤/.test(hierarchy + layoutIntent);
  const isLayered = /层级|分层|layer|stack|架构/.test(hierarchy + layoutIntent);
  const isCardGrid = /卡片|card|grid|并排/.test(hierarchy + layoutIntent);

  if (isComparison) {
    renderComparisonLayout(slide, slidePlan, visual, colors);
    return;
  }
  if (isFlow) {
    renderFlowLayout(slide, slidePlan, visual, colors);
    return;
  }
  if (isLayered) {
    renderLayeredLayout(slide, slidePlan, visual, colors);
    return;
  }
  if (isCardGrid) {
    renderCardGridLayout(slide, slidePlan, visual, colors);
    return;
  }

  const pattern = index % 5;
  if (pattern === 0) {
    if (visual) {
      addVisual(slide, visual, 7.35, 0, 5.98, SLIDE_H, 0, 8);
      addImageShade(slide, colors.bg, 17, 7.35, 0, 5.98, SLIDE_H);
    } else {
      addIconWatermark(slide, slidePlan, 9.16, 1.35, 2.35, colors);
    }
    addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 6.25);
    addInsightStack(slide, slidePlan, colors, 0.74, 1.94, 5.95);
    addKeyMessage(slide, slidePlan, 0.74, 5.82, 5.95, colors);
  } else if (pattern === 1) {
    if (visual) {
      addVisual(slide, visual, 0.62, 0.52, 12.1, 2.02, 16, 8);
      addImageShade(slide, colors.bg, 18, 0.62, 0.52, 12.1, 2.02);
    } else {
      addIconWatermark(slide, slidePlan, 9.6, 0.76, 1.65, colors);
    }
    addPageHeader(slide, slidePlan, colors, 0.74, 2.92, 7.5);
    addProofGrid(slide, slidePlan, colors, 0.76, 4.08);
  } else if (pattern === 2) {
    if (visual) {
      addVisual(slide, visual, 0, 0, 4.62, SLIDE_H, 0, 8);
      addImageShade(slide, colors.bg, 18, 0, 0, 4.62, SLIDE_H);
    } else {
      addIconWatermark(slide, slidePlan, 1.08, 1.5, 2.2, colors);
    }
    addPageHeader(slide, slidePlan, colors, 5.02, 0.62, 7.1);
    addInsightStack(slide, slidePlan, colors, 5.06, 2.08, 6.92);
    addIconFeature(slide, slidePlan, 0.92, 5.16, 2.86, 1.08, colors);
  } else if (pattern === 3) {
    if (visual) {
      addVisual(slide, visual, 0, 3.52, SLIDE_W, 3.98, 0, 12);
      addImageShade(slide, colors.bg, 14, 0, 3.52, SLIDE_W, 3.98);
    }
    addPageHeader(slide, slidePlan, colors, 0.68, 0.46, 10.8);
    addNumberedList(slide, slidePlan, colors, 0.74, 1.55, 8.2);
  } else {
    if (visual) {
      addVisual(slide, visual, 8.62, 1.08, 4.15, 5.86, 18, 10);
    } else {
      addIconWatermark(slide, slidePlan, 9.72, 1.42, 1.78, colors);
    }
    addPageHeader(slide, slidePlan, colors, 0.68, 0.62, 7.45);
    addSplitColumns(slide, slidePlan, colors, 0.74, 1.94, 7.35);
  }
}

function renderComparisonLayout(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 9.2);
  const blocks = normalizedBlocks(slidePlan, 4);
  const left = blocks.slice(0, 2);
  const right = blocks.slice(2, 4);
  if (left.length === 0)
    left.push({ heading: "方案 A", body: slidePlan.keyMessage, emphasis: "normal" as const });
  if (right.length === 0)
    right.push({ heading: "方案 B", body: slidePlan.keyMessage, emphasis: "normal" as const });

  for (const [side, group] of [left, right].entries()) {
    const colX = 0.62 + side * 6.18;
    slide.addShape("roundRect", {
      x: colX,
      y: 1.82,
      w: 5.62,
      h: 3.58,
      rectRadius: 0.08,
      fill: { color: colors.panel, transparency: 3 },
      line: { color: side === 0 ? colors.accent : colors.support, transparency: 38, width: 1.2 },
    });
    addAccentBar(slide, colX + 0.24, 2.02, 0.68, 0.06, side === 0 ? colors.accent : colors.support);
    for (const [i, block] of group.entries()) {
      addText(slide, block.heading || block.body, colX + 0.26, 2.42 + i * 1.22, 4.92, 0.22, {
        fontSize: 11.8,
        bold: true,
        color: colors.text,
        fit: "shrink",
      });
      if (block.heading) {
        addText(slide, block.body, colX + 0.26, 2.78 + i * 1.22, 4.88, 0.38, {
          fontSize: 8.8,
          color: colors.muted,
          fit: "shrink",
        });
      }
    }
  }
  addIconFeature(slide, slidePlan, 9.82, 5.82, 3.0, 0.82, colors);
}

function renderFlowLayout(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 10.4);
  const blocks = normalizedBlocks(slidePlan, 5);
  const stepW = Math.max(1.1, 11.2 / Math.max(blocks.length, 1));
  for (const [i, block] of blocks.entries()) {
    const x = 0.86 + i * stepW;
    slide.addShape("roundRect", {
      x,
      y: 2.08,
      w: stepW * 0.82,
      h: 2.62,
      rectRadius: 0.08,
      fill: { color: i % 2 === 0 ? colors.panel : colors.main, transparency: i % 2 === 0 ? 3 : 14 },
      line: { color: colors.accent, transparency: 32, width: 1.1 },
    });
    addText(slide, `0${i + 1}`, x + 0.14, 2.28, 0.6, 0.16, {
      fontSize: 8.2,
      bold: true,
      color: colors.accent,
    });
    addText(slide, block.heading || block.body, x + 0.14, 2.68, stepW * 0.62, 0.22, {
      fontSize: 10.2,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, x + 0.14, 3.04, stepW * 0.62, 0.98, {
        fontSize: 7.8,
        color: colors.muted,
        fit: "shrink",
      });
    }
    if (i < blocks.length - 1) {
      slide.addShape("line", {
        x: x + stepW * 0.8,
        y: 3.25,
        w: stepW * 0.24,
        h: 0,
        line: { color: colors.accent, transparency: 38, width: 1.8, endArrowType: "triangle" },
      });
    }
  }
}

function renderLayeredLayout(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 8.9);
  const blocks = normalizedBlocks(slidePlan, 4);
  for (const [i, block] of blocks.entries()) {
    const x = 0.74 + i * 0.14;
    const y = 1.94 + i * 0.78;
    const w = 8.15 - i * 0.46;
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h: 0.58,
      rectRadius: 0.06,
      fill: { color: i % 2 === 0 ? colors.panel : colors.main, transparency: i % 2 === 0 ? 3 : 11 },
      line: { color: i === 0 ? colors.support : colors.accent, transparency: 28, width: 1 },
    });
    addText(slide, block.heading || block.body, x + 0.22, y + 0.14, 1.68, 0.16, {
      fontSize: 9.2,
      bold: true,
      color: i === 0 ? colors.support : colors.accent,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, x + 2.08, y + 0.13, w - 2.32, 0.18, {
        fontSize: 8.1,
        color: colors.text,
        fit: "shrink",
      });
    }
  }
  addIconFeature(slide, slidePlan, 9.14, 5.08, 3.42, 1.02, colors);
}

function renderCardGridLayout(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  addPageHeader(slide, slidePlan, colors, 0.68, 0.58, 9.8);
  const blocks = normalizedBlocks(slidePlan, 4);
  for (const [i, block] of blocks.entries()) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.68 + col * 5.88;
    const y = 1.84 + row * 2.02;
    slide.addShape("roundRect", {
      x,
      y,
      w: 5.32,
      h: 1.62,
      rectRadius: 0.08,
      fill: { color: colors.panel, transparency: 3 },
      line: { color: i === 0 ? colors.support : colors.accent, transparency: 30, width: 1.1 },
    });
    addAccentBar(slide, x + 0.22, y + 0.22, 0.42, 0.05, i === 0 ? colors.support : colors.accent);
    addText(slide, block.heading || block.body, x + 0.22, y + 0.48, 4.68, 0.24, {
      fontSize: 11.8,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, x + 0.22, y + 0.92, 4.72, 0.38, {
        fontSize: 8.2,
        color: colors.muted,
        fit: "shrink",
      });
    }
  }
  addIconFeature(slide, slidePlan, 0.68, 6.08, 11.8, 0.7, colors);
}

function addPageHeader(
  slide: PptSlide,
  slidePlan: DeckSlide,
  colors: SlideColors,
  x: number,
  y: number,
  w: number,
) {
  addText(slide, slidePlan.title, x, y, w, 0.48, {
    fontSize: 25,
    bold: true,
    color: colors.text,
    fit: "shrink",
    margin: 0,
  });
  addText(slide, slidePlan.keyMessage, x, y + 0.58, Math.min(w, 7.8), 0.3, {
    fontSize: 12.2,
    color: colors.muted,
    fit: "shrink",
    margin: 0,
  });
  addAccentBar(slide, x, y + 1.08, 0.88, 0.05, colors.accent);
}

function addInsightStack(
  slide: PptSlide,
  slidePlan: DeckSlide,
  colors: SlideColors,
  x: number,
  y: number,
  w: number,
) {
  const blocks = normalizedBlocks(slidePlan, 4);
  for (const [i, block] of blocks.entries()) {
    const rowY = y + i * 0.78;
    slide.addShape("roundRect", {
      x,
      y: rowY,
      w,
      h: 0.62,
      rectRadius: 0.06,
      fill: { color: i % 2 === 0 ? colors.panel : colors.main, transparency: i % 2 === 0 ? 4 : 18 },
      line: {
        color: i === 0 ? colors.support : colors.accent,
        transparency: i === 0 ? 30 : 58,
        width: 0.9,
      },
    });
    addText(slide, block.heading || block.body, x + 0.2, rowY + 0.12, 1.42, 0.17, {
      fontSize: 10.2,
      bold: true,
      color: i === 0 ? colors.support : colors.accent,
      fit: "shrink",
    });
    addText(
      slide,
      block.heading ? block.body : slidePlan.keyMessage,
      x + 1.78,
      rowY + 0.12,
      w - 2.02,
      0.18,
      {
        fontSize: 9.4,
        color: colors.text,
        fit: "shrink",
      },
    );
  }
}

function addProofGrid(
  slide: PptSlide,
  slidePlan: DeckSlide,
  colors: SlideColors,
  x: number,
  y: number,
) {
  const blocks = normalizedBlocks(slidePlan, 3);
  for (const [i, block] of blocks.slice(0, 3).entries()) {
    const cardX = x + i * 4.05;
    slide.addShape("roundRect", {
      x: cardX,
      y,
      w: 3.55,
      h: 1.44,
      rectRadius: 0.08,
      fill: { color: colors.panel, transparency: 2 },
      line: { color: i === 0 ? colors.support : colors.accent, transparency: 30, width: 1 },
    });
    addText(slide, `0${i + 1}`, cardX + 0.22, y + 0.16, 0.46, 0.14, {
      fontSize: 8.2,
      bold: true,
      color: i === 0 ? colors.support : colors.accent,
    });
    addText(slide, block.heading || block.body, cardX + 0.22, y + 0.46, 2.85, 0.24, {
      fontSize: 12,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, cardX + 0.22, y + 0.86, 2.96, 0.28, {
        fontSize: 8.6,
        color: colors.muted,
        fit: "shrink",
      });
    }
  }
}

function addImageShade(
  slide: PptSlide,
  color: string,
  transparency: number,
  x = 0,
  y = 0,
  w = SLIDE_W,
  h = SLIDE_H,
) {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color, transparency },
    line: { color, transparency: 100 },
  });
}

function addPill(
  slide: PptSlide,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: SlideColors,
) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: colors.panel, transparency: 8 },
    line: { color: colors.accent, transparency: 50, width: 0.8 },
  });
  addText(slide, text, x + 0.18, y + 0.13, w - 0.36, 0.12, {
    fontSize: 7.5,
    bold: true,
    color: colors.text,
    fit: "shrink",
    align: "center",
  });
}

function addIconFeature(
  slide: PptSlide,
  slidePlan: DeckSlide,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: SlideColors,
) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: colors.panel, transparency: 10 },
    line: { color: colors.accent, transparency: 42, width: 0.9 },
  });
  addSemanticGlyph(slide, slidePlan, x + 0.28, y + 0.25, 0.68, colors, 0);
  addText(slide, slidePlan.pageType.toUpperCase(), x + 1.08, y + 0.3, w - 1.34, 0.13, {
    fontSize: 6.8,
    bold: true,
    color: colors.accent,
    fit: "shrink",
  });
  addText(slide, slidePlan.keyMessage, x + 1.08, y + 0.58, w - 1.34, 0.26, {
    fontSize: 8.1,
    color: colors.muted,
    fit: "shrink",
  });
}

function addIconWatermark(
  slide: PptSlide,
  slidePlan: DeckSlide,
  x: number,
  y: number,
  size: number,
  colors: SlideColors,
) {
  slide.addShape("ellipse", {
    x: x - 0.22,
    y: y - 0.22,
    w: size + 0.44,
    h: size + 0.44,
    fill: { color: colors.main, transparency: 46 },
    line: { color: colors.accent, transparency: 62, width: 0.8 },
  });
  addSemanticGlyph(slide, slidePlan, x, y, size, colors, 10);
}

function addSemanticGlyph(
  slide: PptSlide,
  slidePlan: DeckSlide,
  x: number,
  y: number,
  size: number,
  colors: SlideColors,
  transparency: number,
) {
  const icon = slideIcon(slidePlan);
  const color = icon === "risk" || icon === "closing" ? colors.support : colors.accent;
  const line = { color, transparency, width: Math.max(1, size * 0.08) };
  const dot = {
    fill: { color, transparency: Math.min(85, transparency + 8) },
    line: { color: colors.bg, transparency: 100 },
  };

  if (icon === "metrics") {
    for (const [i, height] of [0.34, 0.62, 0.86].entries()) {
      slide.addShape("rect", {
        x: x + size * (0.12 + i * 0.25),
        y: y + size * (1 - height),
        w: size * 0.12,
        h: size * height,
        fill: { color, transparency },
        line: { color, transparency: 100 },
      });
    }
    return;
  }

  if (icon === "timeline" || icon === "agenda") {
    slide.addShape("line", { x: x + size * 0.1, y: y + size * 0.5, w: size * 0.8, h: 0, line });
    for (const point of [0.16, 0.5, 0.84]) {
      slide.addShape("ellipse", {
        x: x + size * point - size * 0.06,
        y: y + size * 0.44,
        w: size * 0.12,
        h: size * 0.12,
        ...dot,
      });
    }
    return;
  }

  if (icon === "architecture" || icon === "capability" || icon === "governance") {
    for (const [i, top] of [0.2, 0.44, 0.68].entries()) {
      slide.addShape("roundRect", {
        x: x + size * (0.12 + i * 0.05),
        y: y + size * top,
        w: size * (0.76 - i * 0.1),
        h: size * 0.12,
        rectRadius: 0.03,
        fill: { color, transparency: Math.min(80, transparency + 6) },
        line: { color, transparency: 100 },
      });
    }
    return;
  }

  slide.addShape("line", { x: x + size * 0.18, y: y + size * 0.2, w: size * 0.64, h: 0, line });
  slide.addShape("line", {
    x: x + size * 0.18,
    y: y + size * 0.2,
    w: size * 0.32,
    h: size * 0.58,
    line,
  });
  slide.addShape("line", { x: x + size * 0.5, y: y + size * 0.78, w: size * 0.32, h: 0, line });
  for (const [px, py] of [
    [0.18, 0.2],
    [0.82, 0.2],
    [0.5, 0.78],
  ]) {
    slide.addShape("ellipse", {
      x: x + size * px - size * 0.07,
      y: y + size * py - size * 0.07,
      w: size * 0.14,
      h: size * 0.14,
      ...dot,
    });
  }
}

function addBaseBackground(
  slide: PptSlide,
  colors: SlideColors,
  slidePlan: DeckSlide,
  index: number,
) {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    fill: { color: colors.bg },
    line: { color: colors.bg, transparency: 100 },
  });

  const variant = backgroundVariant(slidePlan, index);
  if (variant === "left-panel") {
    slide.addShape("rect", {
      x: 0.34,
      y: 0,
      w: 2.2,
      h: SLIDE_H,
      fill: { color: colors.main, transparency: 92 },
      line: { color: colors.main, transparency: 100 },
    });
    slide.addShape("rect", {
      x: 0,
      y: 6.58,
      w: SLIDE_W,
      h: 0.18,
      fill: { color: colors.accent, transparency: 86 },
      line: { color: colors.accent, transparency: 100 },
    });
  } else if (variant === "right-panel") {
    slide.addShape("rect", {
      x: 10.93,
      y: 0,
      w: 2.4,
      h: SLIDE_H,
      fill: { color: colors.main, transparency: 93 },
      line: { color: colors.main, transparency: 100 },
    });
    slide.addShape("rect", {
      x: 9.55,
      y: 0.62,
      w: 0.06,
      h: 5.72,
      fill: { color: colors.accent, transparency: 78 },
      line: { color: colors.accent, transparency: 100 },
    });
  } else if (variant === "top-band") {
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: 0.62,
      fill: { color: colors.main, transparency: 86 },
      line: { color: colors.main, transparency: 100 },
    });
    slide.addShape("rect", {
      x: 0.58,
      y: 0.34,
      w: 1.52,
      h: 0.08,
      fill: { color: colors.accent, transparency: 22 },
      line: { color: colors.accent, transparency: 100 },
    });
    slide.addShape("rect", {
      x: 0,
      y: 7.08,
      w: SLIDE_W,
      h: 0.42,
      fill: { color: colors.main, transparency: 86 },
      line: { color: colors.main, transparency: 100 },
    });
  } else if (variant === "diagonal-split") {
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: 4.82,
      h: SLIDE_H,
      fill: { color: colors.main, transparency: 90 },
      line: { color: colors.main, transparency: 100 },
    });
    slide.addShape("rect", {
      x: 4.52,
      y: 0,
      w: 0.06,
      h: SLIDE_H,
      fill: { color: colors.accent, transparency: 72 },
      line: { color: colors.accent, transparency: 100 },
    });
  } else if (variant === "corner-accent") {
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: 1.68,
      h: 1.68,
      fill: { color: colors.accent, transparency: 88 },
      line: { color: colors.accent, transparency: 100 },
    });
    slide.addShape("rect", {
      x: 11.42,
      y: 5.58,
      w: 1.92,
      h: 1.92,
      fill: { color: colors.support, transparency: 92 },
      line: { color: colors.support, transparency: 100 },
    });
  } else {
    slide.addShape("rect", {
      x: 0,
      y: 0.42,
      w: SLIDE_W,
      h: 0.06,
      fill: { color: colors.accent, transparency: 76 },
      line: { color: colors.accent, transparency: 100 },
    });
    slide.addShape("rect", {
      x: 0,
      y: 7.02,
      w: SLIDE_W,
      h: 0.06,
      fill: { color: colors.accent, transparency: 76 },
      line: { color: colors.accent, transparency: 100 },
    });
  }
}

function backgroundVariant(slidePlan: DeckSlide, index: number): string {
  const variants = [
    "left-panel",
    "right-panel",
    "top-band",
    "diagonal-split",
    "corner-accent",
    "edge-lines",
  ];
  if (slidePlan.pageType === "cover" || slidePlan.pageType === "closing") return "left-panel";
  if (slidePlan.pageType === "section") return "diagonal-split";
  return variants[index % variants.length];
}

// --- dynamic layout engine (auto_dynamic mode) ---

type DynamicLayout = {
  imagePos: "left" | "right" | "top" | "bottom" | "full" | "none";
  contentStyle: "list" | "grid" | "flow" | "comparison" | "stack";
  gap: number;
  titleSize: number;
  bodySize: number;
};

function parseLayoutIntent(slidePlan: DeckSlide): DynamicLayout {
  const text = `${slidePlan.layoutIntent ?? ""} ${slidePlan.visualHierarchy ?? ""}`.toLowerCase();

  let imagePos: DynamicLayout["imagePos"] = "right";
  if (/左图|image.?left|图位.*左|左侧.*图|图片在左/.test(text)) imagePos = "left";
  else if (/右图|image.?right|图位.*右|右侧.*图|图片在右/.test(text)) imagePos = "right";
  else if (/上图|image.?top|图位.*上|上方.*图|图片在上|顶部.*图/.test(text)) imagePos = "top";
  else if (/下图|image.?bottom|图位.*下|下方.*图|图片在下|底部.*图/.test(text)) imagePos = "bottom";
  else if (/全图|full.?image|full.?bleed|铺满|背景图/.test(text)) imagePos = "full";
  else if (/无图|no.?image|纯文|纯排版/.test(text)) imagePos = "none";

  let contentStyle: DynamicLayout["contentStyle"] = "stack";
  if (/对比|比较|compare|versus|两侧/.test(text)) contentStyle = "comparison";
  else if (/流程|流转|pipeline|步骤|序列/.test(text)) contentStyle = "flow";
  else if (/卡片|card|grid|网格|并排|平铺/.test(text)) contentStyle = "grid";
  else if (/列表|list|条目|要点/.test(text)) contentStyle = "list";

  const density = slidePlan.contentDensity ?? "medium";
  const gap = density === "low" ? 0.22 : density === "high" ? 0.12 : 0.16;
  const titleSize = density === "low" ? 26 : density === "high" ? 20 : 23;
  const bodySize = density === "low" ? 10 : density === "high" ? 8 : 9;

  return { imagePos, contentStyle, gap, titleSize, bodySize };
}

function renderDynamicSlide(
  slide: PptSlide,
  deckPlan: DeckPlan,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
  index: number,
) {
  const layout = parseLayoutIntent(slidePlan);
  addCleanBackground(slide, colors);

  const isCover = index === 0;
  const isClosing = index === deckPlan.slides.length - 1;

  if (isCover) {
    renderDynamicCover(slide, deckPlan, slidePlan, visual, colors);
    return;
  }
  if (isClosing) {
    renderDynamicClosing(slide, slidePlan, visual, colors);
    return;
  }

  const titleX = 0.62;
  const titleY = 0.48;
  const titleW = 11.8;

  addText(slide, slidePlan.title, titleX, titleY, titleW, 0.42, {
    fontSize: layout.titleSize,
    bold: true,
    color: colors.text,
    fit: "shrink",
    margin: 0,
  });
  addText(slide, slidePlan.keyMessage, titleX, titleY + 0.52, titleW, 0.22, {
    fontSize: layout.bodySize + 2,
    color: colors.muted,
    fit: "shrink",
    margin: 0,
  });

  const contentTop = titleY + 1.08;
  const visualW = layout.imagePos === "right" || layout.imagePos === "left" ? 5.35 : 12.5;
  const visualH = layout.imagePos === "top" || layout.imagePos === "bottom" ? 2.65 : 3.98;

  if (layout.imagePos === "left" && visual) {
    addVisual(slide, visual, 0.48, contentTop, visualW, visualH, 12, 8);
    renderContentBlocks(slide, slidePlan, colors, layout, visualW + 0.86, contentTop, 7.15);
  } else if (layout.imagePos === "right" && visual) {
    addVisual(slide, visual, 7.48, contentTop, visualW, visualH, 12, 8);
    renderContentBlocks(slide, slidePlan, colors, layout, 0.62, contentTop, 6.5);
  } else if (layout.imagePos === "top" && visual) {
    addVisual(slide, visual, 0.62, contentTop, visualW, visualH, 12, 8);
    renderContentBlocks(slide, slidePlan, colors, layout, 0.62, contentTop + visualH + 0.28, 11.8);
  } else if (layout.imagePos === "bottom" && visual) {
    renderContentBlocks(slide, slidePlan, colors, layout, 0.62, contentTop, 11.8);
    addVisual(slide, visual, 0.62, 4.58, visualW, 2.65, 12, 4);
  } else if (layout.imagePos === "full" && visual) {
    addVisual(slide, visual, 0, 0, SLIDE_W, SLIDE_H, 0, 5);
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      fill: { color: colors.bg, transparency: 22 },
      line: { color: colors.bg, transparency: 100 },
    });
    renderContentBlocks(slide, slidePlan, colors, layout, 0.62, contentTop, 11.8);
  } else {
    renderContentBlocks(slide, slidePlan, colors, layout, 0.62, contentTop + 0.22, 11.8);
  }

  addSlideNumber(slide, index, colors);
}

function renderDynamicCover(
  slide: PptSlide,
  deckPlan: DeckPlan,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  if (visual) {
    addVisual(slide, visual, 0, 0, SLIDE_W, SLIDE_H, 0, 0);
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      fill: { color: colors.bg, transparency: 32 },
      line: { color: colors.bg, transparency: 100 },
    });
  }
  addText(slide, deckPlan.title, 0.72, 1.72, 8.8, 1.35, {
    fontSize: 34,
    bold: true,
    color: colors.text,
    fit: "shrink",
    margin: 0.02,
  });
  addText(slide, deckPlan.subtitle || slidePlan.keyMessage, 0.76, 3.32, 7.5, 0.56, {
    fontSize: 15,
    color: colors.muted,
    fit: "shrink",
    margin: 0.02,
  });
  addText(slide, deckPlan.audience, 0.78, 4.52, 6.0, 0.32, {
    fontSize: 10,
    color: colors.muted,
    fit: "shrink",
  });
}

function renderDynamicClosing(
  slide: PptSlide,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
) {
  if (visual) {
    addVisual(slide, visual, 0, 0, SLIDE_W, SLIDE_H, 0, 0);
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      fill: { color: colors.bg, transparency: 28 },
      line: { color: colors.bg, transparency: 100 },
    });
  }
  addText(slide, slidePlan.title, 0.72, 1.86, 8.5, 0.72, {
    fontSize: 30,
    bold: true,
    color: colors.text,
    fit: "shrink",
  });
  addText(slide, slidePlan.keyMessage, 0.76, 2.84, 7.2, 0.48, {
    fontSize: 14,
    color: colors.muted,
    fit: "shrink",
  });
  const blocks = normalizedBlocks(slidePlan, 3);
  for (const [i, block] of blocks.entries()) {
    addText(slide, block.heading || block.body, 0.78 + i * 2.2, 4.38, 1.88, 0.3, {
      fontSize: 10,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
  }
}

function renderContentBlocks(
  slide: PptSlide,
  slidePlan: DeckSlide,
  colors: SlideColors,
  layout: DynamicLayout,
  x: number,
  y: number,
  w: number,
) {
  const blocks = normalizedBlocks(slidePlan, 6);

  if (layout.contentStyle === "comparison" && blocks.length >= 2) {
    const mid = Math.ceil(blocks.length / 2);
    renderComparisonBlocks(slide, blocks.slice(0, mid), blocks.slice(mid), colors, layout, x, y, w);
    return;
  }
  if (layout.contentStyle === "flow") {
    renderFlowBlocks(slide, blocks, colors, layout, x, y, w);
    return;
  }
  if (layout.contentStyle === "grid") {
    renderGridBlocks(slide, blocks, colors, layout, x, y, w);
    return;
  }
  if (layout.contentStyle === "list") {
    renderListBlocks(slide, blocks, slidePlan, colors, layout, x, y, w);
    return;
  }
  renderStackBlocks(slide, blocks, slidePlan, colors, layout, x, y, w);
}

function renderComparisonBlocks(
  slide: PptSlide,
  left: ReturnType<typeof normalizedBlocks>,
  right: ReturnType<typeof normalizedBlocks>,
  colors: SlideColors,
  layout: DynamicLayout,
  x: number,
  y: number,
  w: number,
) {
  const colW = (w - 0.4) / 2;
  for (const [side, group] of [left, right].entries()) {
    const colX = x + side * (colW + 0.4);
    slide.addShape("roundRect", {
      x: colX,
      y,
      w: colW,
      h: 3.6,
      rectRadius: 0.08,
      fill: { color: colors.panel, transparency: 2 },
      line: { color: side === 0 ? colors.accent : colors.support, transparency: 34, width: 1.2 },
    });
    for (const [i, block] of group.entries()) {
      addText(
        slide,
        block.heading || block.body,
        colX + 0.18,
        y + 0.22 + i * 1.22,
        colW - 0.36,
        0.2,
        {
          fontSize: layout.bodySize + 1,
          bold: true,
          color: colors.text,
          fit: "shrink",
        },
      );
      if (block.heading) {
        addText(slide, block.body, colX + 0.18, y + 0.52 + i * 1.22, colW - 0.36, 0.36, {
          fontSize: layout.bodySize - 1,
          color: colors.muted,
          fit: "shrink",
        });
      }
    }
  }
}

function renderFlowBlocks(
  slide: PptSlide,
  blocks: ReturnType<typeof normalizedBlocks>,
  colors: SlideColors,
  layout: DynamicLayout,
  x: number,
  y: number,
  w: number,
) {
  const stepW = Math.max(1.1, w / Math.max(blocks.length, 1));
  for (const [i, block] of blocks.entries()) {
    const sx = x + i * stepW;
    slide.addShape("roundRect", {
      x: sx,
      y,
      w: stepW * 0.82,
      h: 2.8,
      rectRadius: 0.08,
      fill: { color: i % 2 === 0 ? colors.panel : colors.bg, transparency: i % 2 === 0 ? 2 : 0 },
      line: { color: colors.accent, transparency: 32, width: 1 },
    });
    addText(slide, `0${i + 1}`, sx + 0.14, y + 0.16, 0.5, 0.14, {
      fontSize: 8,
      bold: true,
      color: colors.accent,
    });
    addText(slide, block.heading || block.body, sx + 0.14, y + 0.52, stepW * 0.6, 0.22, {
      fontSize: layout.bodySize + 1,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, sx + 0.14, y + 0.88, stepW * 0.6, 1.02, {
        fontSize: layout.bodySize - 1,
        color: colors.muted,
        fit: "shrink",
      });
    }
    if (i < blocks.length - 1) {
      slide.addShape("line", {
        x: sx + stepW * 0.8,
        y: y + 1.2,
        w: stepW * 0.24,
        h: 0,
        line: { color: colors.accent, transparency: 38, width: 1.8, endArrowType: "triangle" },
      });
    }
  }
}

function renderGridBlocks(
  slide: PptSlide,
  blocks: ReturnType<typeof normalizedBlocks>,
  colors: SlideColors,
  layout: DynamicLayout,
  x: number,
  y: number,
  w: number,
) {
  const cols = blocks.length <= 2 ? blocks.length : 2;
  const rows = Math.ceil(blocks.length / cols);
  const cardW = (w - 0.3 * (cols - 1)) / cols;
  const cardH = Math.min(1.6, 4.2 / rows);
  for (const [i, block] of blocks.entries()) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + col * (cardW + 0.3);
    const cy = y + row * (cardH + 0.22);
    slide.addShape("roundRect", {
      x: cx,
      y: cy,
      w: cardW,
      h: cardH,
      rectRadius: 0.08,
      fill: { color: colors.panel, transparency: 2 },
      line: { color: i === 0 ? colors.support : colors.accent, transparency: 30, width: 1 },
    });
    addText(slide, block.heading || block.body, cx + 0.18, cy + 0.16, cardW - 0.36, 0.22, {
      fontSize: layout.bodySize + 1,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    if (block.heading) {
      addText(slide, block.body, cx + 0.18, cy + 0.52, cardW - 0.36, cardH - 0.72, {
        fontSize: layout.bodySize - 1,
        color: colors.muted,
        fit: "shrink",
      });
    }
  }
}

function renderListBlocks(
  slide: PptSlide,
  blocks: ReturnType<typeof normalizedBlocks>,
  slidePlan: DeckSlide,
  colors: SlideColors,
  layout: DynamicLayout,
  x: number,
  y: number,
  w: number,
) {
  for (const [i, block] of blocks.entries()) {
    const rowY = y + i * 0.72;
    slide.addShape("ellipse", {
      x,
      y: rowY + 0.08,
      w: 0.32,
      h: 0.32,
      fill: { color: colors.accent, transparency: 10 },
      line: { color: colors.bg, transparency: 100 },
    });
    addText(slide, String(i + 1), x + 0.02, rowY + 0.18, 0.28, 0.1, {
      fontSize: 6.8,
      bold: true,
      color: colors.bg,
      align: "center",
    });
    addText(slide, block.heading || block.body, x + 0.48, rowY + 0.08, 1.6, 0.18, {
      fontSize: layout.bodySize + 1,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    addText(
      slide,
      block.heading ? block.body : slidePlan.keyMessage,
      x + 2.2,
      rowY + 0.07,
      w - 2.4,
      0.2,
      {
        fontSize: layout.bodySize - 1,
        color: colors.muted,
        fit: "shrink",
      },
    );
  }
}

function renderStackBlocks(
  slide: PptSlide,
  blocks: ReturnType<typeof normalizedBlocks>,
  slidePlan: DeckSlide,
  colors: SlideColors,
  layout: DynamicLayout,
  x: number,
  y: number,
  w: number,
) {
  for (const [i, block] of blocks.entries()) {
    const rowY = y + i * 0.86;
    slide.addShape("roundRect", {
      x,
      y: rowY,
      w,
      h: 0.66,
      rectRadius: 0.06,
      fill: { color: i % 2 === 0 ? colors.panel : colors.bg, transparency: i % 2 === 0 ? 2 : 0 },
      line: { color: i === 0 ? colors.support : colors.accent, transparency: 42, width: 0.8 },
    });
    addText(slide, block.heading || block.body, x + 0.2, rowY + 0.14, 1.52, 0.18, {
      fontSize: layout.bodySize + 1,
      bold: true,
      color: i === 0 ? colors.support : colors.accent,
      fit: "shrink",
    });
    addText(
      slide,
      block.heading ? block.body : slidePlan.keyMessage,
      x + 1.88,
      rowY + 0.13,
      w - 2.12,
      0.2,
      {
        fontSize: layout.bodySize - 1,
        color: colors.text,
        fit: "shrink",
      },
    );
  }
}

function addCleanBackground(slide: PptSlide, colors: SlideColors) {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    fill: { color: colors.bg },
    line: { color: colors.bg, transparency: 100 },
  });
}

function addSlideNumber(slide: PptSlide, index: number, colors: SlideColors) {
  addText(slide, `${index + 1}`.padStart(2, "0"), 12.28, 7.08, 0.56, 0.16, {
    fontSize: 6.5,
    color: colors.muted,
    align: "right",
  });
}

function addVisual(
  slide: PptSlide,
  visual: VisualAsset | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  transparency = 0,
) {
  if (!visual?.dataUri) return;

  slide.addImage({
    data: visual.dataUri,
    x,
    y,
    w,
    h,
    sizing: { type: "cover", x, y, w, h },
    transparency,
  } as never);
  if (radius > 0) {
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h,
      rectRadius: Math.min(0.12, radius / 100),
      fill: { color: "FFFFFF", transparency: 100 },
      line: { color: "FFFFFF", transparency: 83, width: 1 },
    });
  }
}

function addMotif(
  slide: PptSlide,
  colors: SlideColors,
  x: number,
  y: number,
  w: number,
  h: number,
  index: number,
) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: colors.panel, transparency: 10 },
    line: { color: colors.accent, transparency: 70, width: 1 },
  });
  for (let i = 0; i < 5; i += 1) {
    slide.addShape("ellipse", {
      x: x + 0.34 + ((i + index) % 2) * 1.1,
      y: y + 0.56 + i * 1.02,
      w: 0.38 + i * 0.05,
      h: 0.38 + i * 0.05,
      fill: { color: i % 2 === 0 ? colors.accent : colors.support, transparency: 12 + i * 4 },
      line: { color: colors.bg, transparency: 100 },
    });
  }
}

function addFooter(slide: PptSlide, slidePlan: DeckSlide, index: number, colors: SlideColors) {
  slide.addShape("line", {
    x: SAFE,
    y: 7.03,
    w: 12.25,
    h: 0,
    line: { color: colors.main, transparency: 76, width: 0.8 },
  });
  addText(slide, slidePlan.pageType.toUpperCase(), SAFE, 7.11, 2.2, 0.12, {
    fontSize: 5.8,
    color: colors.muted,
    charSpace: 0,
  });
  addText(slide, `${index + 1}`.padStart(2, "0"), 12.05, 7.08, 0.72, 0.16, {
    fontSize: 6.5,
    color: colors.muted,
    align: "right",
  });
}

function addKeyMessage(
  slide: PptSlide,
  slidePlan: DeckSlide,
  x: number,
  y: number,
  w: number,
  colors: SlideColors,
) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h: 0.72,
    rectRadius: 0.08,
    fill: { color: colors.main, transparency: 10 },
    line: { color: colors.accent, transparency: 55, width: 1 },
  });
  addText(slide, slidePlan.keyMessage, x + 0.22, y + 0.17, w - 0.44, 0.24, {
    fontSize: 9.5,
    color: colors.text,
    fit: "shrink",
  });
}

function addNumberedList(
  slide: PptSlide,
  slidePlan: DeckSlide,
  colors: SlideColors,
  x: number,
  y: number,
  w: number,
) {
  const blocks = normalizedBlocks(slidePlan, 5);
  for (const [i, block] of blocks.entries()) {
    const rowY = y + i * 0.72;
    slide.addShape("roundRect", {
      x,
      y: rowY,
      w,
      h: 0.55,
      rectRadius: 0.06,
      fill: { color: i % 2 === 0 ? colors.panel : colors.bg, transparency: i % 2 === 0 ? 3 : 0 },
      line: { color: colors.accent, transparency: 54, width: 0.8 },
    });
    addText(slide, `${i + 1}`, x + 0.16, rowY + 0.14, 0.35, 0.14, {
      fontSize: 8.2,
      bold: true,
      color: colors.accent,
      align: "center",
    });
    addText(slide, block.heading || block.body, x + 0.62, rowY + 0.1, 1.64, 0.18, {
      fontSize: 9.8,
      bold: true,
      color: colors.text,
      fit: "shrink",
    });
    addText(
      slide,
      block.heading ? block.body : slidePlan.keyMessage,
      x + 2.4,
      rowY + 0.09,
      w - 2.6,
      0.2,
      {
        fontSize: 8.6,
        color: colors.muted,
        fit: "shrink",
      },
    );
  }
}

function addSplitColumns(
  slide: PptSlide,
  slidePlan: DeckSlide,
  colors: SlideColors,
  x: number,
  y: number,
  w: number,
) {
  const blocks = normalizedBlocks(slidePlan, 6);
  const mid = Math.ceil(blocks.length / 2);
  const colW = (w - 0.34) / 2;
  for (const [col, group] of [blocks.slice(0, mid), blocks.slice(mid)].entries()) {
    const colX = x + col * (colW + 0.34);
    for (const [i, block] of group.entries()) {
      const rowY = y + i * 0.96;
      slide.addShape("roundRect", {
        x: colX,
        y: rowY,
        w: colW,
        h: 0.72,
        rectRadius: 0.06,
        fill: { color: i % 2 === 0 ? colors.panel : colors.bg, transparency: i % 2 === 0 ? 3 : 0 },
        line: { color: col === 0 ? colors.accent : colors.support, transparency: 42, width: 0.9 },
      });
      addText(slide, block.heading || block.body, colX + 0.18, rowY + 0.12, colW - 0.36, 0.16, {
        fontSize: 8.6,
        bold: true,
        color: colors.text,
        fit: "shrink",
      });
      if (block.heading) {
        addText(slide, block.body, colX + 0.18, rowY + 0.36, colW - 0.36, 0.16, {
          fontSize: 7.4,
          color: colors.muted,
          fit: "shrink",
        });
      }
    }
  }
}

function addAccentBar(slide: PptSlide, x: number, y: number, w: number, h: number, color: string) {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color },
    line: { color, transparency: 100 },
  });
}

function addText(
  slide: PptSlide,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options: Record<string, unknown>,
) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    fontFace: FONT,
    valign: "mid",
    margin: 0.04,
    align: "left",
    breakLine: false,
    ...options,
  } as never);
}

function normalizedBlocks(slide: DeckSlide, max: number) {
  const blocks = slide.contentBlocks.filter((block) => block.body.trim()).slice(0, max);
  return blocks.length > 0
    ? blocks
    : [{ heading: slide.title, body: slide.keyMessage, emphasis: "normal" as const }];
}

function extractMetric(text: string): string | null {
  return text.match(/(\d+(?:\.\d+)?\s*(?:%|倍|万|亿|天|个月|年|人|项)?)/)?.[1] ?? null;
}

function formatCoverTitle(title: string): string {
  if (title.length <= 18 || title.includes("\n")) return title;
  const breakPoints = ["建设方案", "落地路线图", "与"];
  for (const point of breakPoints) {
    const index = title.indexOf(point);
    if (index > 8 && index < title.length - 6) {
      return `${title.slice(0, index)}\n${title.slice(index)}`;
    }
  }
  const midpoint = Math.ceil(title.length / 2);
  return `${title.slice(0, midpoint)}\n${title.slice(midpoint)}`;
}

type SlideColors = {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  main: string;
  support: string;
  accent: string;
};

function slideColors(palette: string[], index: number): SlideColors {
  const main = palette[0];
  const support = palette[1] ?? palette[0];
  const accent = palette[2 + (index % Math.max(1, palette.length - 2))] ?? palette[2] ?? palette[0];
  const mainRgb = hexToRgb(main);
  const darkTheme = luminance(mainRgb) < 0.44;
  return {
    bg: darkTheme ? "0B1220" : "F8F4EA",
    panel: darkTheme ? mixHex(main, "FFFFFF", 0.1) : "FFFFFF",
    text: darkTheme ? "F8FAFC" : "111827",
    muted: darkTheme ? "CBD5E1" : "475569",
    main,
    support,
    accent,
  };
}

function ensurePalette(palette: string[]): string[] {
  const values = palette
    .map((value) =>
      value
        .replace(/^#/, "")
        .replace(/[^0-9a-f]/gi, "")
        .slice(0, 6)
        .toUpperCase(),
    )
    .filter((value) => value.length === 6);
  return values.length >= 3 ? values : ["0B1220", "111827", "38BDF8", "F59E0B"];
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace(/^#/, "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixHex(a: string, b: string, weight: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = (first: number, second: number) => Math.round(first * (1 - weight) + second * weight);
  return [mix(ca.r, cb.r), mix(ca.g, cb.g), mix(ca.b, cb.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
