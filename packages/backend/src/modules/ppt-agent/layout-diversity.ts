import type { DeckPlan, DeckSlide } from "./types";

export const AUTO_DYNAMIC_LAYOUT_DIVERSITY_MIN_SCORE = 72;

type AdjacentRepeat = {
  slideIds: [string, string];
  field: "layoutPattern" | "pageType" | "structuralParadigm";
  value: string;
};

export type StructuralParadigm =
  | "hero"
  | "section"
  | "matrix"
  | "split"
  | "timeline"
  | "process"
  | "data_insight"
  | "table"
  | "governance"
  | "narrative"
  | "closing";

export type LayoutDiversityReport = {
  version: "layout_diversity/v1";
  score: number;
  threshold: number;
  passed: boolean;
  slideCount: number;
  uniqueLayoutPatterns: number;
  uniquePageTypes: number;
  uniqueStructuralParadigms: number;
  requiredStructuralParadigms: number;
  adjacentRepeats: AdjacentRepeat[];
  paradigmBySlide: Array<{
    slideId: string;
    pageType: DeckSlide["pageType"];
    layoutPattern: string;
    structuralParadigm: StructuralParadigm;
  }>;
  reasons: string[];
};

export function scoreDeckLayoutDiversity(
  deckPlan: DeckPlan,
  options: { threshold?: number; requiredStructuralParadigms?: number } = {},
): LayoutDiversityReport {
  const slideCount = deckPlan.slides.length;
  const threshold = options.threshold ?? AUTO_DYNAMIC_LAYOUT_DIVERSITY_MIN_SCORE;
  const requiredStructuralParadigms =
    options.requiredStructuralParadigms ?? requiredParadigmCount(slideCount);
  const paradigmBySlide = deckPlan.slides.map((slide) => ({
    slideId: slide.id,
    pageType: slide.pageType,
    layoutPattern: slide.layoutPattern,
    structuralParadigm: classifyStructuralParadigm(slide),
  }));

  const uniqueLayoutPatterns = uniqueCount(deckPlan.slides.map((slide) => slide.layoutPattern));
  const uniquePageTypes = uniqueCount(deckPlan.slides.map((slide) => slide.pageType));
  const uniqueStructuralParadigms = uniqueCount(
    paradigmBySlide.map((item) => item.structuralParadigm),
  );
  const adjacentRepeats = [
    ...findAdjacentRepeats(deckPlan.slides, "layoutPattern", (slide) => slide.layoutPattern),
    ...findAdjacentRepeats(deckPlan.slides, "pageType", (slide) => slide.pageType),
    ...findAdjacentRepeats(deckPlan.slides, "structuralParadigm", (slide) =>
      classifyStructuralParadigm(slide),
    ),
  ];

  const patternTarget = Math.min(slideCount, 8);
  const pageTypeTarget = Math.min(slideCount, 8);
  const layoutPatternScore = ratioScore(uniqueLayoutPatterns, patternTarget, 25);
  const pageTypeScore = ratioScore(uniquePageTypes, pageTypeTarget, 20);
  const paradigmScore = ratioScore(uniqueStructuralParadigms, requiredStructuralParadigms, 35);
  const adjacencyScore =
    slideCount <= 1 ? 20 : Math.max(0, 1 - adjacentRepeats.length / ((slideCount - 1) * 3)) * 20;
  const score = Math.round(layoutPatternScore + pageTypeScore + paradigmScore + adjacencyScore);

  const reasons: string[] = [];
  if (uniqueStructuralParadigms < requiredStructuralParadigms) {
    reasons.push(
      `structural paradigms ${uniqueStructuralParadigms}/${requiredStructuralParadigms}`,
    );
  }
  if (uniqueLayoutPatterns < patternTarget) {
    reasons.push(`layout patterns ${uniqueLayoutPatterns}/${patternTarget}`);
  }
  if (uniquePageTypes < pageTypeTarget) {
    reasons.push(`page types ${uniquePageTypes}/${pageTypeTarget}`);
  }
  if (adjacentRepeats.length > 0) {
    reasons.push(
      `adjacent repeats ${adjacentRepeats
        .slice(0, 4)
        .map((item) => `${item.slideIds.join("/")}:${item.value}`)
        .join(", ")}`,
    );
  }
  if (score < threshold) {
    reasons.push(`score ${score}/${threshold}`);
  }

  return {
    version: "layout_diversity/v1",
    score,
    threshold,
    passed: score >= threshold && uniqueStructuralParadigms >= requiredStructuralParadigms,
    slideCount,
    uniqueLayoutPatterns,
    uniquePageTypes,
    uniqueStructuralParadigms,
    requiredStructuralParadigms,
    adjacentRepeats,
    paradigmBySlide,
    reasons,
  };
}

export function formatLayoutDiversityIssue(report: LayoutDiversityReport): string {
  return [
    `layoutDiversityScore 未达标：${report.score}/${report.threshold}`,
    `结构范式 ${report.uniqueStructuralParadigms}/${report.requiredStructuralParadigms}`,
    `布局骨架 ${report.uniqueLayoutPatterns}/${Math.min(report.slideCount, 8)}`,
    report.reasons.length > 0 ? `原因：${report.reasons.join("；")}` : "",
    "auto_dynamic 必须重采样版式结构，而不是只替换颜色或背景。",
  ]
    .filter(Boolean)
    .join("；");
}

function classifyStructuralParadigm(slide: DeckSlide): StructuralParadigm {
  const text =
    `${slide.pageType} ${slide.layoutPattern} ${slide.layoutIntent} ${slide.visualHierarchy}`.toLowerCase();

  if (slide.pageType === "cover") return "hero";
  if (slide.pageType === "section") return "section";
  if (slide.pageType === "closing" || slide.pageType === "contact") return "closing";
  if (slide.pageType === "agenda") return "matrix";
  if (slide.pageType === "comparison") return "split";
  if (slide.pageType === "process") return "process";
  if (slide.pageType === "roadmap") return "timeline";
  if (slide.pageType === "team") return "matrix";
  if (slide.pageType === "quote") return "narrative";
  if (slide.pageType === "chart") return "data_insight";
  if (
    slide.pageType === "timeline" ||
    slide.timeline ||
    /timeline|roadmap|milestone|路线/.test(text)
  ) {
    return "timeline";
  }
  if (/process|flow|step|workflow|流程|步骤/.test(text)) return "process";
  if (
    slide.pageType === "metrics" ||
    slide.chart ||
    /metric|kpi|chart|data|insight|指标|图表/.test(text)
  ) {
    return "data_insight";
  }
  if (slide.pageType === "table" || slide.table || /table|matrix|对比表/.test(text)) return "table";
  if (slide.pageType === "architecture" || /split|two[- ]column|left|right|架构|分层/.test(text)) {
    return "split";
  }
  if (
    slide.pageType === "governance" ||
    slide.pageType === "risk" ||
    /risk|governance|治理|风险/.test(text)
  ) {
    return "governance";
  }
  if (/grid|card|matrix|quadrant|宫格|卡片|矩阵/.test(text)) return "matrix";
  return "narrative";
}

function requiredParadigmCount(slideCount: number): number {
  if (slideCount <= 1) return slideCount;
  return Math.min(6, slideCount);
}

function ratioScore(actual: number, target: number, max: number): number {
  if (target <= 0) return max;
  return Math.min(1, actual / target) * max;
}

function uniqueCount(values: string[]): number {
  return new Set(values.filter((value) => value.trim().length > 0)).size;
}

function findAdjacentRepeats(
  slides: DeckSlide[],
  field: AdjacentRepeat["field"],
  pick: (slide: DeckSlide) => string,
): AdjacentRepeat[] {
  const repeats: AdjacentRepeat[] = [];
  for (let index = 1; index < slides.length; index += 1) {
    const previous = pick(slides[index - 1]);
    const current = pick(slides[index]);
    if (previous && previous === current) {
      repeats.push({
        slideIds: [slides[index - 1].id, slides[index].id],
        field,
        value: current,
      });
    }
  }
  return repeats;
}
