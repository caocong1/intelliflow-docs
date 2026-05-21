import type { DeckPlan, DeckSlide, VisualAsset } from "./types";

export type SlideIcon =
  | "agenda"
  | "architecture"
  | "capability"
  | "closing"
  | "governance"
  | "metrics"
  | "network"
  | "problem"
  | "risk"
  | "scenario"
  | "strategy"
  | "timeline";

const IMAGE_PAGE_TYPES = new Set<DeckSlide["pageType"]>([
  "cover",
  "section",
  "strategy",
  "scenario",
  "closing",
]);
const DIAGRAM_FIRST_PAGE_TYPES = new Set<DeckSlide["pageType"]>([
  "agenda",
  "architecture",
  "capability",
  "governance",
  "metrics",
  "risk",
  "table",
  "timeline",
]);

export function shouldGenerateImageForSlide(
  slide: DeckSlide,
  index: number,
  slideCount: number,
): boolean {
  if (DIAGRAM_FIRST_PAGE_TYPES.has(slide.pageType)) return false;
  if (slide.chart || slide.table || slide.timeline) return false;
  if (IMAGE_PAGE_TYPES.has(slide.pageType)) return true;
  return index === 0 || index === slideCount - 1;
}

export function slideIcon(slide: DeckSlide): SlideIcon {
  const map: Partial<Record<DeckSlide["pageType"], SlideIcon>> = {
    agenda: "agenda",
    architecture: "architecture",
    capability: "capability",
    closing: "closing",
    cover: "network",
    governance: "governance",
    metrics: "metrics",
    problem: "problem",
    risk: "risk",
    scenario: "scenario",
    strategy: "strategy",
    timeline: "timeline",
  };
  return map[slide.pageType] ?? "network";
}

export function buildIconSvgDataUri(icon: SlideIcon, color: string): string {
  const stroke = sanitizeColor(color);
  const path = iconPath(icon);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none">',
    `<path d="${path}" stroke="#${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
    "</svg>",
  ].join("");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function reviewDeckDesign(deckPlan: DeckPlan, visuals: VisualAsset[] = []): string[] {
  const issues: string[] = [];
  const generatedImageTargets = deckPlan.slides.filter((slide, index) =>
    shouldGenerateImageForSlide(slide, index, deckPlan.slides.length),
  );
  if (generatedImageTargets.length > Math.ceil(deckPlan.slides.length * 0.45)) {
    issues.push(
      `AI 图片页过多：${generatedImageTargets.length}/${deckPlan.slides.length}，应优先使用图标、图解和表格。`,
    );
  }

  const promptStems = deckPlan.slides.map((slide) =>
    slide.visualPrompt
      .toLowerCase()
      .replace(/slide role [a-z]+/g, "")
      .replace(/no text.*$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90),
  );
  const repeatedPrompts = promptStems.filter(
    (stem, index) => stem && promptStems.indexOf(stem) !== index,
  );
  if (repeatedPrompts.length > 2) {
    issues.push("视觉 prompt 重复度偏高，容易生成相似背景，应按 pageType 区分视觉语义。");
  }

  const generatedVisuals = visuals.filter((visual) => visual.source === "minimax");
  if (generatedVisuals.length > Math.ceil(deckPlan.slides.length * 0.55)) {
    issues.push(
      `实际图片素材使用过多：${generatedVisuals.length}/${deckPlan.slides.length}，会削弱商务图解表达。`,
    );
  }

  const palePalette = deckPlan.theme.palette.filter((color) => luminance(color) > 0.78);
  const darkPalette = deckPlan.theme.palette.filter((color) => luminance(color) < 0.18);
  if (palePalette.length >= 2 && darkPalette.length >= 2) {
    issues.push("palette 同时包含多组极深/极浅主色，渲染时必须固定主底色，避免蓝黑与白金交替。");
  }

  return issues;
}

function sanitizeColor(color: string): string {
  const clean = color
    .replace(/^#/, "")
    .replace(/[^0-9a-f]/gi, "")
    .slice(0, 6)
    .toUpperCase();
  return clean.length === 6 ? clean : "38BDF8";
}

function luminance(hex: string): number {
  const clean = sanitizeColor(hex);
  const [r, g, b] = [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 6)].map(
    (part) => Number.parseInt(part, 16) / 255,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function iconPath(icon: SlideIcon): string {
  const paths: Record<SlideIcon, string> = {
    agenda: "M5 6h14M5 12h14M5 18h9M3 6h.01M3 12h.01M3 18h.01",
    architecture: "M4 18h16M6 14h12M8 10h8M10 6h4M12 6v12",
    capability: "M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4zM9 12l2 2 4-4",
    closing: "M5 12l4 4L19 6M5 20h14",
    governance: "M12 3l8 4-8 4-8-4 8-4zM4 11l8 4 8-4M4 15l8 4 8-4",
    metrics: "M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8",
    network:
      "M6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7.7 7.2l3.2 8.8M16.3 7.2l-3.2 8.8M8 6h8",
    problem:
      "M12 9v4M12 17h.01M10.3 4.3L3.5 18a1.5 1.5 0 0 0 1.3 2.2h14.4a1.5 1.5 0 0 0 1.3-2.2L13.7 4.3a1.9 1.9 0 0 0-3.4 0z",
    risk: "M12 3l8 4v5c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V7l8-4zM9.5 9.5l5 5M14.5 9.5l-5 5",
    scenario: "M4 5h16v10H7l-3 3V5zM8 9h8M8 12h5",
    strategy: "M4 18l6-6 4 4 6-8M15 8h5v5",
    timeline:
      "M4 12h16M6 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 12v5M12 12v5M18 12v5",
  };
  return paths[icon];
}
