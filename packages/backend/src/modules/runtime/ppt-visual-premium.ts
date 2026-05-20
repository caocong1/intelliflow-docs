import type {
  ContentSlide,
  Slide,
  SlidePresentation,
  SlideSemanticRole,
  TableSlide,
  TitleSlide,
  TwoColumnSlide,
} from "../../../../shared/src/slide-types";
import { DEFAULT_STYLE_PACK_ID, getStylePack } from "./ppt-style-packs";
import { parsePptSceneContent, renderPptSceneDeckToBuffer } from "./ppt-scene";
import { validateSlidePresentation } from "./slide-schema";

type SceneTheme = {
  palette: Record<string, string>;
  fonts: Record<string, string>;
  textStyles: Record<string, Record<string, unknown>>;
};

type SceneElement = Record<string, unknown>;

const CANVAS_W = 1600;
const CANVAS_H = 900;

export function parseSlidePresentationContent(content: string): SlidePresentation | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const validation = validateSlidePresentation(parsed);
  if (!validation.valid) return null;
  return parsed as SlidePresentation;
}

function color(hex: string | undefined, fallback: string): string {
  if (!hex) return `#${fallback}`;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function buildTheme(styleId: string): SceneTheme {
  const pack = getStylePack(styleId) ?? getStylePack(DEFAULT_STYLE_PACK_ID);
  const palette = pack?.palette;

  return {
    palette: {
      bg: color(palette?.background, "F6F8FB"),
      canvas: color(palette?.surface, "FFFFFF"),
      surface: color(palette?.surface, "F8FAFC"),
      primary: color(palette?.primary, "1E3A5F"),
      secondary: color(palette?.secondary, "3B82F6"),
      accent: color(palette?.accent, "F59E0B"),
      text: color(palette?.text, "1F2937"),
      muted: color(palette?.textLight, "64748B"),
      border: color(palette?.divider, "CBD5E1"),
      tableHeader: color(palette?.tableHeader, "1E3A5F"),
      tableStripe: color(palette?.tableStripe, "F1F5F9"),
      ink: "#0B1220",
      white: "#FFFFFF",
      softBlue: "#EAF2FF",
      softCyan: "#E6FFFB",
    },
    fonts: {
      display: "Microsoft YaHei",
      heading: "Microsoft YaHei",
      body: "Microsoft YaHei",
      mono: "JetBrains Mono",
    },
    textStyles: {
      eyebrow: {
        font: "mono",
        size: 10,
        bold: true,
        color: "{palette.accent}",
        tracking: 1.1,
        uppercase: true,
      },
      pageTitle: {
        font: "heading",
        size: 34,
        bold: true,
        color: "{palette.text}",
      },
      coverTitle: {
        font: "display",
        size: 46,
        bold: true,
        color: "{palette.white}",
      },
      subtitle: {
        font: "body",
        size: 18,
        color: "{palette.muted}",
      },
      body: {
        font: "body",
        size: 17,
        color: "{palette.text}",
      },
      bodySmall: {
        font: "body",
        size: 14,
        color: "{palette.text}",
      },
      muted: {
        font: "body",
        size: 12,
        color: "{palette.muted}",
      },
      inverseBody: {
        font: "body",
        size: 15,
        color: "{palette.white}",
      },
      number: {
        font: "mono",
        size: 24,
        bold: true,
        color: "{palette.accent}",
      },
    },
  };
}

function shape(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  options: Record<string, unknown> = {},
): SceneElement {
  return {
    id,
    type: "shape",
    shape: options.shape ?? "rect",
    x,
    y,
    w,
    h,
    fill,
    ...options,
  };
}

function line(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
  strokeWidth = 2,
): SceneElement {
  return {
    id,
    type: "shape",
    shape: "line",
    x,
    y,
    w,
    h,
    stroke,
    strokeWidth,
  };
}

function text(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  styleRef: string,
  options: {
    align?: "left" | "center" | "right" | "justify";
    valign?: "top" | "mid" | "bottom";
    color?: string;
    size?: number;
    bold?: boolean;
  } = {},
): SceneElement {
  return {
    id,
    type: "text",
    x,
    y,
    w,
    h,
    styleRef,
    fit: "shrink",
    paragraphs: [
      {
        align: options.align,
        valign: options.valign,
        runs: [
          {
            text: value,
            color: options.color,
            size: options.size,
            bold: options.bold,
          },
        ],
      },
    ],
  };
}

function inferRole(slide: Slide, index: number, total: number): SlideSemanticRole {
  if (slide.semanticRole) return slide.semanticRole;
  if (index === 0) return "cover";
  if (index === total - 1) return "closing";
  if (slide.layout === "table") return "table";
  if (slide.layout === "two_column") return "comparison";
  if (slide.layout === "image") return "image_focus";
  if (slide.layout === "title") return "section_break";
  return "bullet_list";
}

function slideTitle(slide: Slide): string {
  if ("title" in slide && typeof slide.title === "string") return slide.title;
  return "PPT";
}

function footerElements(index: number, total: number): SceneElement[] {
  const pageNo = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  return [
    line("footer-line", 104, 820, 1392, 0, "{palette.border}", 1),
    text("footer-label", 104, 836, 420, 28, "INTELLIFLOW VISUAL PREMIUM", "eyebrow"),
    text("footer-page", 1350, 836, 146, 28, pageNo, "muted", { align: "right" }),
  ];
}

function headerElements(slide: Slide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  return [
    shape("top-accent", 0, 0, CANVAS_W, 18, "{palette.primary}"),
    shape("top-accent-2", 0, 18, CANVAS_W * 0.34, 8, "{palette.accent}"),
    text("eyebrow", 104, 70, 360, 26, role.replaceAll("_", " "), "eyebrow"),
    text("title", 104, 108, 1120, 78, slideTitle(slide), "pageTitle"),
    ...footerElements(index, total),
  ];
}

function bulletCard(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  index: number,
  content: string,
  accent = "{palette.accent}",
): SceneElement {
  return {
    id,
    type: "group",
    x,
    y,
    w,
    h,
    children: [
      shape(`${id}-bg`, 0, 0, w, h, "{palette.canvas}", {
        shape: "roundRect",
        radius: 18,
        stroke: "{palette.border}",
        strokeWidth: 1,
      }),
      shape(`${id}-stripe`, 0, 0, 12, h, accent, { shape: "rect" }),
      text(`${id}-num`, 28, 22, 56, 38, String(index + 1).padStart(2, "0"), "number"),
      text(`${id}-text`, 96, 18, w - 120, h - 36, content, "body", { valign: "mid" }),
    ],
  };
}

function manualTableGrid(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  headers: string[],
  rows: string[][],
): SceneElement {
  const visibleRows = rows.length > 0 ? rows.slice(0, 8) : [["暂无数据"]];
  const colCount = Math.max(headers.length, ...visibleRows.map((row) => row.length), 1);
  const headerHeight = 56;
  const rowHeight = (h - headerHeight) / Math.max(visibleRows.length, 1);
  const colWidth = w / colCount;
  const cellPad = 12;
  const children: SceneElement[] = [];

  for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
    const cellX = colIndex * colWidth;
    const cellW = Math.max(colWidth, 40);
    children.push(
      shape(`${id}-header-bg-${colIndex}`, cellX, 0, colWidth, headerHeight, "{palette.tableHeader}", {
        stroke: "{palette.canvas}",
        strokeWidth: 1,
      }),
      text(
        `${id}-header-text-${colIndex}`,
        cellX + cellPad,
        10,
        Math.max(cellW - cellPad * 2, 24),
        headerHeight - 20,
        headers[colIndex] ?? "",
        "inverseBody",
        { align: "center", valign: "mid", size: 13, bold: true },
      ),
    );
  }

  visibleRows.forEach((row, rowIndex) => {
    const fill = rowIndex % 2 === 1 ? "{palette.tableStripe}" : "{palette.canvas}";
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const cellX = colIndex * colWidth;
      const cellY = headerHeight + rowIndex * rowHeight;
      const cellW = Math.max(colWidth, 40);
      children.push(
        shape(`${id}-cell-bg-${rowIndex}-${colIndex}`, cellX, cellY, colWidth, rowHeight, fill, {
          stroke: "{palette.border}",
          strokeWidth: 1,
        }),
        text(
          `${id}-cell-text-${rowIndex}-${colIndex}`,
          cellX + cellPad,
          cellY + 8,
          Math.max(cellW - cellPad * 2, 24),
          Math.max(rowHeight - 16, 20),
          row[colIndex] ?? "",
          "bodySmall",
          { valign: "mid", size: 12 },
        ),
      );
    }
  });

  return {
    id,
    type: "group",
    x,
    y,
    w,
    h,
    children,
  };
}

function baseSlide(slide: Slide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  return [shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.bg}"), ...headerElements(slide, index, total, role)];
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function rowLabel(row: string[]): string {
  return row.filter(Boolean).join(" / ");
}

function renderCover(slide: TitleSlide, index: number, total: number): SceneElement[] {
  return [
    shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.ink}"),
    shape("hero-band", 0, 0, 640, CANVAS_H, "{palette.primary}"),
    shape("hero-accent", 640, 0, 110, CANVAS_H, "{palette.accent}", { opacity: 0.95 }),
    shape("right-panel", 1080, 95, 360, 360, "{palette.secondary}", { opacity: 0.22 }),
    shape("right-accent", 1190, 520, 300, 220, "{palette.accent}", { opacity: 0.16 }),
    text("label", 112, 92, 480, 32, "EXECUTIVE BRIEFING", "eyebrow"),
    text("title", 112, 210, 850, 190, slide.title, "coverTitle"),
    text("subtitle", 112, 430, 740, 92, slide.subtitle ?? "", "inverseBody", {
      size: 23,
    }),
    line("divider", 112, 578, 520, 0, "{palette.accent}", 5),
    text("date", 112, 632, 420, 34, "Visual Premium Deck", "inverseBody"),
    text("page", 1320, 812, 168, 36, `${index + 1}/${total}`, "inverseBody", {
      align: "right",
    }),
  ];
}

function renderClosing(slide: TitleSlide, index: number, total: number): SceneElement[] {
  return [
    shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.ink}"),
    shape("statement-band", 96, 126, 980, 488, "{palette.primary}", {
      shape: "roundRect",
      radius: 24,
      opacity: 0.96,
    }),
    shape("accent-block", 1088, 126, 328, 488, "{palette.accent}", {
      shape: "roundRect",
      radius: 24,
      opacity: 0.9,
    }),
    text("kicker", 142, 178, 420, 30, "FINAL DECISION", "eyebrow"),
    text("title", 142, 246, 820, 150, slide.title, "coverTitle", { size: 44 }),
    text("subtitle", 146, 428, 760, 76, slide.subtitle ?? "建议以试点授权启动，形成可衡量的集团级知识运营能力。", "inverseBody", {
      size: 22,
    }),
    line("closing-rule", 142, 538, 520, 0, "{palette.accent}", 5),
    text("next-title", 1130, 184, 224, 42, "NEXT", "coverTitle", { align: "center", size: 34 }),
    text("next-1", 1130, 278, 224, 46, "试点授权", "inverseBody", { align: "center", size: 21, bold: true }),
    text("next-2", 1130, 366, 224, 46, "预算锁定", "inverseBody", { align: "center", size: 21, bold: true }),
    text("next-3", 1130, 454, 224, 46, "指标复盘", "inverseBody", { align: "center", size: 21, bold: true }),
    text("page", 1320, 812, 168, 36, `${index + 1}/${total}`, "inverseBody", {
      align: "right",
    }),
  ];
}

function renderToc(slide: ContentSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const bullets = slide.bullets.slice(0, 6);
  return [
    shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.bg}"),
    ...headerElements(slide, index, total, role),
    shape("agenda-panel", 104, 232, 456, 430, "{palette.primary}", {
      shape: "roundRect",
      radius: 24,
    }),
    text("agenda-num", 150, 290, 180, 92, String(bullets.length).padStart(2, "0"), "coverTitle", {
      size: 62,
    }),
    text("agenda-copy", 152, 408, 320, 110, "从必要性、方案、路径到投入治理，形成一条管理层决策链。", "inverseBody", {
      size: 21,
    }),
    ...bullets.map((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      return {
        id: `toc-card-${i}`,
        type: "group",
        x: 622 + col * 404,
        y: 232 + row * 142,
        w: 352,
        h: 108,
        children: [
          shape(`toc-card-${i}-bg`, 0, 0, 352, 108, "{palette.canvas}", {
            shape: "roundRect",
            radius: 16,
            stroke: "{palette.border}",
            strokeWidth: 1,
          }),
          shape(`toc-card-${i}-num-bg`, 22, 24, 58, 58, i % 2 ? "{palette.secondary}" : "{palette.accent}", {
            shape: "roundRect",
            radius: 12,
          }),
          text(`toc-card-${i}-num`, 28, 38, 46, 28, String(i + 1).padStart(2, "0"), "inverseBody", {
            align: "center",
            bold: true,
          }),
          text(`toc-card-${i}-text`, 100, 28, 222, 52, item, "body", { valign: "mid", bold: true }),
        ],
      };
    }),
  ];
}

function renderValueLadder(slide: ContentSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const bullets = slide.bullets.slice(0, 6);
  const [claim = slide.title, ...steps] = bullets;
  return [
    ...baseSlide(slide, index, total, role),
    shape("claim-panel", 104, 232, 430, 482, "{palette.primary}", {
      shape: "roundRect",
      radius: 24,
    }),
    text("claim-kicker", 146, 290, 240, 30, "CORE CLAIM", "eyebrow"),
    text("claim-text", 146, 360, 320, 150, claim, "coverTitle", { size: 31 }),
    line("claim-rule", 146, 552, 250, 0, "{palette.accent}", 4),
    text("claim-note", 146, 588, 310, 64, "用业务产出定义知识中台，而不是以工具功能定义项目边界。", "inverseBody", {
      size: 18,
    }),
    ...steps.slice(0, 5).map((item, i) => {
      const y = 232 + i * 88;
      return {
        id: `ladder-${i}`,
        type: "group",
        x: 612 + i * 36,
        y,
        w: 760 - i * 36,
        h: 72,
        children: [
          shape(`ladder-${i}-bg`, 0, 0, 760 - i * 36, 72, i % 2 ? "{palette.surface}" : "{palette.canvas}", {
            shape: "roundRect",
            radius: 14,
            stroke: "{palette.border}",
            strokeWidth: 1,
          }),
          shape(`ladder-${i}-index`, 22, 18, 46, 36, i % 2 ? "{palette.secondary}" : "{palette.accent}", {
            shape: "roundRect",
            radius: 8,
          }),
          text(`ladder-${i}-num`, 26, 25, 38, 20, String(i + 1).padStart(2, "0"), "inverseBody", {
            align: "center",
            size: 12,
            bold: true,
          }),
          text(`ladder-${i}-text`, 88, 15, 620 - i * 34, 42, item, "body", { valign: "mid" }),
        ],
      };
    }),
  ];
}

function renderCapabilityGrid(slide: ContentSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const bullets = slide.bullets.slice(0, 6);
  return [
    ...baseSlide(slide, index, total, role),
    shape("capability-hero", 104, 230, 360, 496, "{palette.ink}", {
      shape: "roundRect",
      radius: 24,
    }),
    shape("capability-accent", 104, 230, 360, 12, "{palette.accent}"),
    text("capability-kicker", 144, 286, 220, 28, "CAPABILITY MAP", "eyebrow"),
    text("capability-title", 144, 352, 258, 140, "从知识检索到内容产出", "coverTitle", { size: 31 }),
    text("capability-copy", 146, 538, 252, 92, "每项能力都应绑定业务场景、数据来源和可衡量的运营指标。", "inverseBody", {
      size: 17,
    }),
    ...bullets.map((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      return {
        id: `capability-${i}`,
        type: "group",
        x: 526 + col * 432,
        y: 230 + row * 164,
        w: 382,
        h: 128,
        children: [
          shape(`capability-${i}-bg`, 0, 0, 382, 128, "{palette.canvas}", {
            shape: "roundRect",
            radius: 16,
            stroke: "{palette.border}",
            strokeWidth: 1,
          }),
          shape(`capability-${i}-tab`, 0, 0, 382, 12, i % 2 ? "{palette.secondary}" : "{palette.accent}"),
          text(`capability-${i}-num`, 26, 30, 46, 30, String(i + 1).padStart(2, "0"), "number"),
          text(`capability-${i}-text`, 90, 28, 250, 62, item, "body", { valign: "mid" }),
        ],
      };
    }),
  ];
}

function renderGovernanceGuardrails(slide: ContentSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const bullets = slide.bullets.slice(0, 6);
  return [
    ...baseSlide(slide, index, total, role),
    shape("guardrail-left", 104, 236, 756, 466, "{palette.canvas}", {
      shape: "roundRect",
      radius: 22,
      stroke: "{palette.border}",
      strokeWidth: 1,
    }),
    text("guardrail-left-title", 142, 276, 450, 36, "上线前置控制", "pageTitle", { size: 26 }),
    ...bullets.slice(0, 4).map((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      return {
        id: `guardrail-${i}`,
        type: "group",
        x: 142 + col * 346,
        y: 344 + row * 132,
        w: 304,
        h: 96,
        children: [
          shape(`guardrail-${i}-bg`, 0, 0, 304, 96, i % 2 ? "{palette.softBlue}" : "{palette.surface}", {
            shape: "roundRect",
            radius: 14,
            stroke: "{palette.border}",
            strokeWidth: 1,
          }),
          text(`guardrail-${i}-num`, 22, 26, 44, 26, String(i + 1).padStart(2, "0"), "number", { size: 18 }),
          text(`guardrail-${i}-text`, 78, 20, 196, 50, item, "bodySmall", { valign: "mid" }),
        ],
      };
    }),
    shape("guardrail-right", 928, 236, 462, 466, "{palette.primary}", {
      shape: "roundRect",
      radius: 22,
    }),
    text("guardrail-right-kicker", 970, 290, 220, 30, "OPERATING MODEL", "eyebrow"),
    text("guardrail-right-copy", 970, 356, 330, 112, "把权限、数据、内容质量和责任机制纳入同一套运营闭环，避免试点后难以规模化。", "inverseBody", {
      size: 22,
    }),
    line("guardrail-rule", 970, 512, 270, 0, "{palette.accent}", 5),
    ...bullets.slice(4, 6).map((item, i) =>
      text(`guardrail-extra-${i}`, 970, 548 + i * 58, 330, 38, item, "inverseBody", { size: 17 }),
    ),
  ];
}

function renderContent(slide: ContentSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  if (role === "toc") return renderToc(slide, index, total, role);
  if (includesAny(slide.title, ["治理", "安全", "上线"])) return renderGovernanceGuardrails(slide, index, total, role);
  if (includesAny(slide.title, ["核心能力", "能力"])) return renderCapabilityGrid(slide, index, total, role);
  if (includesAny(slide.title, ["目标", "价值", "业务生产力"])) return renderValueLadder(slide, index, total, role);

  const bullets = slide.bullets.slice(0, 8);
  const columns = bullets.length <= 4 ? 1 : 2;
  const cardW = columns === 1 ? 1070 : 610;
  const cardH = columns === 1 ? 82 : 104;
  const startX = 104;
  const startY = 235;
  return [
    shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.bg}"),
    ...headerElements(slide, index, total, role),
    shape("insight-panel", 1248, 218, 246, 500, "{palette.primary}", {
      shape: "roundRect",
      radius: 22,
    }),
    text("insight-kicker", 1280, 260, 170, 32, "FOCUS", "eyebrow"),
    text("insight-text", 1280, 320, 168, 188, "Keep one clear claim per slide and use cards for scan-friendly executive reading.", "inverseBody"),
    ...bullets.map((item, i) => {
      const col = columns === 1 ? 0 : i % 2;
      const row = columns === 1 ? i : Math.floor(i / 2);
      return bulletCard(`bullet-${i}`, startX + col * 660, startY + row * (cardH + 28), cardW, cardH, i, item);
    }),
  ];
}

function renderComparisonSplit(slide: TwoColumnSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const colW = 625;
  const makeColumn = (
    id: string,
    x: number,
    titleValue: string | undefined,
    bullets: string[],
    accent: string,
  ): SceneElement => ({
    id,
    type: "group",
    x,
    y: 236,
    w: colW,
    h: 470,
    children: [
      shape(`${id}-bg`, 0, 0, colW, 470, "{palette.canvas}", {
        shape: "roundRect",
        radius: 20,
        stroke: "{palette.border}",
        strokeWidth: 1,
      }),
      shape(`${id}-top`, 0, 0, colW, 72, accent, {
        shape: "roundRect",
        radius: 20,
      }),
      text(`${id}-title`, 32, 20, colW - 64, 36, titleValue ?? "", "inverseBody", {
        size: 22,
        bold: true,
      }),
      ...bullets.slice(0, 5).map((item, i) =>
        text(`${id}-bullet-${i}`, 46, 112 + i * 62, colW - 92, 46, `- ${item}`, "body"),
      ),
    ],
  });

  return [
    shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.bg}"),
    ...headerElements(slide, index, total, role),
    makeColumn("left", 104, slide.left.title, slide.left.bullets, "{palette.primary}"),
    makeColumn("right", 870, slide.right.title, slide.right.bullets, "{palette.secondary}"),
    shape("bridge", 740, 390, 120, 120, "{palette.accent}", {
      shape: "roundRect",
      radius: 28,
      opacity: 0.92,
    }),
    text("bridge-text", 760, 428, 80, 40, "VS", "coverTitle", {
      align: "center",
      size: 28,
    }),
  ];
}

function renderArchitectureLoop(slide: TwoColumnSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const leftBullets = slide.left.bullets.slice(0, 4);
  const rightBullets = slide.right.bullets.slice(0, 4);
  const layers = [...leftBullets, ...rightBullets].slice(0, 3);
  return [
    ...baseSlide(slide, index, total, role),
    shape("arch-left", 104, 238, 330, 468, "{palette.canvas}", {
      shape: "roundRect",
      radius: 18,
      stroke: "{palette.border}",
      strokeWidth: 1,
    }),
    shape("arch-right", 1166, 238, 330, 468, "{palette.canvas}", {
      shape: "roundRect",
      radius: 18,
      stroke: "{palette.border}",
      strokeWidth: 1,
    }),
    text("arch-left-title", 134, 280, 244, 34, slide.left.title ?? "输入侧", "body", { bold: true, size: 21 }),
    text("arch-right-title", 1196, 280, 244, 34, slide.right.title ?? "输出侧", "body", { bold: true, size: 21 }),
    ...leftBullets.map((item, i) => text(`arch-left-${i}`, 136, 348 + i * 64, 238, 42, `- ${item}`, "bodySmall")),
    ...rightBullets.map((item, i) => text(`arch-right-${i}`, 1198, 348 + i * 64, 238, 42, `- ${item}`, "bodySmall")),
    shape("arch-core", 504, 238, 592, 468, "{palette.ink}", {
      shape: "roundRect",
      radius: 26,
    }),
    text("arch-core-kicker", 548, 292, 260, 28, "THREE-LAYER LOOP", "eyebrow"),
    ...layers.map((item, i) => {
      const y = 352 + i * 96;
      return {
        id: `arch-layer-${i}`,
        type: "group",
        x: 548,
        y,
        w: 504,
        h: 70,
        children: [
          shape(`arch-layer-${i}-bg`, 0, 0, 504, 70, i === 1 ? "{palette.secondary}" : "{palette.primary}", {
            shape: "roundRect",
            radius: 14,
            opacity: i === 1 ? 0.94 : 0.8,
          }),
          text(`arch-layer-${i}-num`, 24, 20, 44, 28, String(i + 1).padStart(2, "0"), "inverseBody", {
            align: "center",
            bold: true,
          }),
          text(`arch-layer-${i}-text`, 86, 16, 360, 36, item, "inverseBody", { valign: "mid", size: 18 }),
        ],
      };
    }),
  ];
}

function renderDecisionSummary(slide: TwoColumnSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const left = slide.left.bullets.slice(0, 4);
  const right = slide.right.bullets.slice(0, 4);
  return [
    ...baseSlide(slide, index, total, role),
    shape("decision-panel", 104, 236, 520, 466, "{palette.primary}", {
      shape: "roundRect",
      radius: 24,
    }),
    text("decision-kicker", 150, 294, 260, 30, "RECOMMENDATION", "eyebrow"),
    text("decision-title", 150, 360, 360, 112, slide.left.title ?? "建议", "coverTitle", { size: 33 }),
    ...left.slice(0, 2).map((item, i) => text(`decision-proof-${i}`, 152, 520 + i * 52, 350, 34, item, "inverseBody", { size: 17 })),
    ...right.map((item, i) => {
      const x = 700 + (i % 2) * 340;
      const y = 252 + Math.floor(i / 2) * 184;
      return {
        id: `decision-action-${i}`,
        type: "group",
        x,
        y,
        w: 300,
        h: 142,
        children: [
          shape(`decision-action-${i}-bg`, 0, 0, 300, 142, "{palette.canvas}", {
            shape: "roundRect",
            radius: 18,
            stroke: "{palette.border}",
            strokeWidth: 1,
          }),
          shape(`decision-action-${i}-top`, 0, 0, 300, 12, i % 2 ? "{palette.secondary}" : "{palette.accent}"),
          text(`decision-action-${i}-num`, 26, 34, 46, 30, String(i + 1).padStart(2, "0"), "number"),
          text(`decision-action-${i}-text`, 88, 32, 170, 70, item, "body", { valign: "mid" }),
        ],
      };
    }),
  ];
}

function renderTwoColumn(slide: TwoColumnSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  if (role === "summary") return renderDecisionSummary(slide, index, total, role);
  if (includesAny(slide.title, ["架构", "闭环", "能力"])) return renderArchitectureLoop(slide, index, total, role);
  return renderComparisonSplit(slide, index, total, role);
}

function renderPriorityCards(slide: TableSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const rows = slide.rows.slice(0, 6);
  return [
    ...baseSlide(slide, index, total, role),
    shape("priority-rank", 104, 234, 360, 472, "{palette.ink}", {
      shape: "roundRect",
      radius: 24,
    }),
    text("priority-rank-kicker", 146, 292, 220, 30, "PILOT PRIORITY", "eyebrow"),
    text("priority-rank-title", 146, 360, 260, 120, "先做能快速验证价值的场景", "coverTitle", { size: 30 }),
    text("priority-rank-copy", 146, 536, 252, 72, "用业务影响、数据可得性和推广价值共同排序。", "inverseBody", { size: 17 }),
    ...rows.map((row, i) => {
      const col = i % 2;
      const rowIndex = Math.floor(i / 2);
      return {
        id: `priority-card-${i}`,
        type: "group",
        x: 526 + col * 432,
        y: 234 + rowIndex * 150,
        w: 382,
        h: 118,
        children: [
          shape(`priority-card-${i}-bg`, 0, 0, 382, 118, "{palette.canvas}", {
            shape: "roundRect",
            radius: 16,
            stroke: "{palette.border}",
            strokeWidth: 1,
          }),
          shape(`priority-card-${i}-badge`, 24, 24, 58, 58, i % 2 ? "{palette.secondary}" : "{palette.accent}", {
            shape: "roundRect",
            radius: 14,
          }),
          text(`priority-card-${i}-num`, 30, 39, 46, 28, String(i + 1).padStart(2, "0"), "inverseBody", {
            align: "center",
            bold: true,
          }),
          text(`priority-card-${i}-title`, 104, 24, 226, 30, row[0] ?? `场景 ${i + 1}`, "body", { bold: true, size: 18 }),
          text(`priority-card-${i}-copy`, 104, 60, 230, 34, rowLabel(row.slice(1)), "bodySmall", { size: 12 }),
        ],
      };
    }),
  ];
}

function renderRoadmapTimeline(slide: TableSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const rows = slide.rows.slice(0, 5);
  const laneW = 1160 / Math.max(rows.length, 1);
  return [
    ...baseSlide(slide, index, total, role),
    shape("timeline-axis", 166, 472, 1170, 8, "{palette.border}"),
    ...rows.map((row, i) => {
      const x = 126 + i * laneW;
      const accent = i % 2 ? "{palette.secondary}" : "{palette.accent}";
      return {
        id: `roadmap-${i}`,
        type: "group",
        x,
        y: 252,
        w: laneW - 24,
        h: 344,
        children: [
          shape(`roadmap-${i}-head`, 0, 0, laneW - 24, 76, accent, {
            shape: "roundRect",
            radius: 16,
          }),
          text(`roadmap-${i}-phase`, 18, 18, laneW - 60, 28, row[0] ?? `阶段 ${i + 1}`, "inverseBody", {
            bold: true,
            align: "center",
          }),
          shape(`roadmap-${i}-body`, 0, 98, laneW - 24, 210, "{palette.canvas}", {
            shape: "roundRect",
            radius: 16,
            stroke: "{palette.border}",
            strokeWidth: 1,
          }),
          text(`roadmap-${i}-month`, 18, 126, laneW - 60, 30, row[1] ?? "", "number", { align: "center", size: 20 }),
          text(`roadmap-${i}-work`, 18, 174, laneW - 60, 48, row[2] ?? "", "bodySmall", { align: "center", valign: "mid" }),
          text(`roadmap-${i}-milestone`, 18, 242, laneW - 60, 42, row[3] ?? "", "muted", { align: "center", valign: "mid" }),
        ],
      };
    }),
  ];
}

function renderFinancialModel(slide: TableSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  const rows = slide.rows.slice(0, 5);
  return [
    ...baseSlide(slide, index, total, role),
    shape("finance-left", 104, 236, 760, 420, "{palette.canvas}", {
      shape: "roundRect",
      radius: 18,
      stroke: "{palette.border}",
      strokeWidth: 1,
    }),
    manualTableGrid("finance-grid", 132, 272, 704, 330, slide.headers, rows),
    shape("finance-right", 930, 236, 430, 420, "{palette.primary}", {
      shape: "roundRect",
      radius: 22,
    }),
    text("finance-kicker", 970, 294, 240, 30, "BUSINESS CASE", "eyebrow"),
    text("finance-title", 970, 360, 300, 96, "投入以试点价值闭环校验", "coverTitle", { size: 30 }),
    line("finance-rule", 970, 494, 250, 0, "{palette.accent}", 5),
    ...rows.slice(0, 3).map((row, i) => text(`finance-point-${i}`, 972, 536 + i * 44, 310, 30, rowLabel(row.slice(0, 2)), "inverseBody", { size: 15 })),
  ];
}

function renderTable(slide: TableSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  if (role === "timeline" || includesAny(slide.title, ["路线图", "实施", "计划"])) {
    return renderRoadmapTimeline(slide, index, total, role);
  }
  if (includesAny(slide.title, ["投入", "产出", "测算", "ROI"])) {
    return renderFinancialModel(slide, index, total, role);
  }
  if (includesAny(slide.title, ["试点", "优先级", "场景"])) {
    return renderPriorityCards(slide, index, total, role);
  }

  return [
    shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.bg}"),
    ...headerElements(slide, index, total, role),
    shape("table-frame", 96, 224, 1168, 500, "{palette.canvas}", {
      shape: "roundRect",
      radius: 16,
      stroke: "{palette.border}",
      strokeWidth: 1,
    }),
    manualTableGrid("table-grid", 126, 262, 1108, 422, slide.headers, slide.rows),
    shape("right-rail", 1310, 224, 186, 500, "{palette.primary}", {
      shape: "roundRect",
      radius: 16,
    }),
    text("rail-label", 1340, 268, 126, 30, "DATA VIEW", "eyebrow"),
    text("rail-number", 1340, 342, 126, 82, String(slide.rows.length), "coverTitle", {
      size: 52,
      align: "center",
    }),
    text("rail-copy", 1336, 454, 132, 120, "rows structured for fast executive comparison", "inverseBody", {
      align: "center",
    }),
  ];
}

function renderTitleSlide(slide: TitleSlide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  if (role === "cover") return renderCover(slide, index, total);
  if (role === "closing") return renderClosing(slide, index, total);
  return [
    shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.primary}"),
    shape("accent-block", 0, 0, 300, CANVAS_H, "{palette.accent}"),
    text("section", 440, 330, 800, 120, slide.title, "coverTitle", { align: "center" }),
    text("subtitle", 480, 470, 720, 60, slide.subtitle ?? "", "inverseBody", { align: "center" }),
    text("page", 1340, 812, 150, 32, `${index + 1}/${total}`, "inverseBody", { align: "right" }),
  ];
}

function renderImageLike(slide: Slide, index: number, total: number, role: SlideSemanticRole): SceneElement[] {
  return [
    shape("bg", 0, 0, CANVAS_W, CANVAS_H, "{palette.bg}"),
    ...headerElements(slide, index, total, role),
    shape("visual-frame", 104, 236, 880, 450, "{palette.primary}", {
      shape: "roundRect",
      radius: 24,
      opacity: 0.96,
    }),
    shape("visual-inner", 144, 276, 800, 370, "{palette.canvas}", {
      shape: "roundRect",
      radius: 18,
      opacity: 0.16,
      stroke: "{palette.accent}",
      strokeWidth: 2,
    }),
    text("visual-label", 212, 414, 660, 76, "VISUAL PLACEHOLDER", "coverTitle", {
      align: "center",
      size: 30,
    }),
    text("caption", 1060, 294, 360, 160, "caption" in slide && typeof slide.caption === "string" ? slide.caption : slideTitle(slide), "body"),
  ];
}

function renderSlide(slide: Slide, index: number, total: number): {
  pageType: string;
  elements: SceneElement[];
} {
  const role = inferRole(slide, index, total);
  const pageType = slide.archetype ? `${role}_${slide.archetype}_premium` : `${role}_${index + 1}_premium`;
  switch (slide.layout) {
    case "title":
      return { pageType, elements: renderTitleSlide(slide, index, total, role) };
    case "content":
      return { pageType, elements: renderContent(slide, index, total, role) };
    case "two_column":
      return { pageType, elements: renderTwoColumn(slide, index, total, role) };
    case "table":
      return { pageType, elements: renderTable(slide, index, total, role) };
    case "image":
    case "blank":
    default:
      return { pageType, elements: renderImageLike(slide, index, total, role) };
  }
}

export function buildVisualPremiumSceneContent(
  presentation: SlidePresentation,
  styleId: string,
): string {
  const theme = buildTheme(styleId);
  const slides = presentation.slides;
  const pages = slides.map((slide, index) => {
    const rendered = renderSlide(slide, index, slides.length);
    return {
      pageType: rendered.pageType,
      scene: {
        version: "ppt_scene/v1",
        meta: {
          title: slideTitle(slide),
          language: presentation.metadata?.language ?? "zh-CN",
          canvas: { width: CANVAS_W, height: CANVAS_H, unit: "px" },
        },
        theme,
        slides: [
          {
            id: `visual-premium-${index + 1}`,
            name: slideTitle(slide),
            notes: "notes" in slide && typeof slide.notes === "string" ? slide.notes : undefined,
            background: { fill: "{palette.bg}" },
            elements: rendered.elements,
          },
        ],
      },
    };
  });

  return JSON.stringify({
    version: "ppt_scene_family/v1",
    familyId: `visual_premium_${styleId}`,
    familyLabel: "Visual Premium Local Renderer",
    pages,
  });
}

export async function renderVisualPremiumPresentation(
  presentation: SlidePresentation,
  styleId: string,
) {
  const sceneContent = buildVisualPremiumSceneContent(presentation, styleId);
  const deck = parsePptSceneContent(sceneContent);
  if (!deck) {
    throw new Error("visual premium scene conversion failed");
  }
  return renderPptSceneDeckToBuffer(deck);
}
