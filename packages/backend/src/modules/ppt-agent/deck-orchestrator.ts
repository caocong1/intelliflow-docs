import type { DeckPlan, DeckSlide } from "./types";

export type DeckOutline = {
  narrative: string[];
  sections: Array<{ title: string; slideIds: string[] }>;
};

export type DeckStyleDna = {
  palette: string[];
  mood: string;
  motif: string;
  typography: "classic" | "modern" | "tech";
  spacing: "compact" | "balanced" | "airy";
};

export type DeckReviewResult = {
  issues: string[];
  slideFixes: Array<{ slideId: string; reason: string }>;
};

export function buildDeckOutline(deckPlan: DeckPlan): DeckOutline {
  const chapterSize = Math.max(2, Math.ceil(deckPlan.slides.length / idealSectionCount(deckPlan)));
  const sections = [];
  for (let i = 0; i < deckPlan.slides.length; i += chapterSize) {
    const slides = deckPlan.slides.slice(i, i + chapterSize);
    sections.push({
      title: slides[0]?.title ?? `Section ${sections.length + 1}`,
      slideIds: slides.map((slide) => slide.id),
    });
  }
  return {
    narrative: deckPlan.slides.map((slide) => slide.keyMessage),
    sections,
  };
}

export function buildDeckStyleDna(deckPlan: DeckPlan): DeckStyleDna {
  return {
    palette: deckPlan.theme.palette.slice(0, 5),
    mood: deckPlan.theme.mood,
    motif: deckPlan.theme.visualMotif,
    typography: inferTypography(deckPlan.visualDirection),
    spacing: inferSpacing(deckPlan.slides),
  };
}

export function refineSlideWithStyle(slide: DeckSlide, styleDna: DeckStyleDna): DeckSlide {
  const density = styleDna.spacing === "airy" ? "low" : styleDna.spacing === "compact" ? "high" : "medium";
  return {
    ...slide,
    layoutIntent: appendUniqueHint(
      slide.layoutIntent,
      `统一风格：${styleDna.typography}/${styleDna.spacing}/${styleDna.motif}`,
    ),
    visualHierarchy: appendUniqueHint(slide.visualHierarchy, `配色锚点：${styleDna.palette.join(", ")}`),
    contentDensity: slide.contentDensity === "medium" ? density : slide.contentDensity,
  };
}

export function reviewDeckCoherence(deckPlan: DeckPlan): DeckReviewResult {
  const issues: string[] = [];
  const slideFixes: DeckReviewResult["slideFixes"] = [];

  const densityRuns = findDensityRuns(deckPlan.slides);
  if (densityRuns.length > 0) {
    issues.push(`存在连续高密度页面：${densityRuns.join("、")}`);
    for (const run of densityRuns) {
      const [start] = run.split("-");
      const target = deckPlan.slides[Number(start) - 1];
      if (target) slideFixes.push({ slideId: target.id, reason: "降低信息密度以改善阅读节奏" });
    }
  }

  for (let index = 1; index < deckPlan.slides.length; index += 1) {
    const slide = deckPlan.slides[index];
    const prev = deckPlan.slides[index - 1];
    if (!hasNarrativeBridge(slide.speakerNotes, prev.title)) {
      issues.push(`第 ${index + 1} 页与前页叙事衔接较弱`);
      slideFixes.push({
        slideId: slide.id,
        reason: "补充与前页的叙事连接语句，并在开头标注承接关系",
      });
    }
  }

  return { issues, slideFixes };
}

function idealSectionCount(deckPlan: DeckPlan): number {
  if (deckPlan.slides.length <= 6) return 2;
  if (deckPlan.slides.length <= 12) return 4;
  return 5;
}

function appendUniqueHint(base: string, hint: string): string {
  return base.includes(hint) ? base : `${base}；${hint}`;
}

function hasNarrativeBridge(speakerNotes: string, prevTitle: string): boolean {
  const anchors = [prevTitle, prevTitle.slice(0, 4), "上一页", "前页", "承接"];
  return anchors.some((anchor) => anchor && speakerNotes.includes(anchor));
}

function findDensityRuns(slides: DeckSlide[]): string[] {
  const runs: string[] = [];
  let start = -1;
  for (let i = 0; i < slides.length; i += 1) {
    const isDense = slides[i].contentDensity === "high";
    if (isDense && start === -1) start = i;
    if ((!isDense || i === slides.length - 1) && start !== -1) {
      const end = isDense && i === slides.length - 1 ? i : i - 1;
      if (end - start + 1 >= 3) runs.push(`${start + 1}-${end + 1}`);
      start = -1;
    }
  }
  return runs;
}

function inferTypography(visualDirection: string): DeckStyleDna["typography"] {
  const lower = visualDirection.toLowerCase();
  if (lower.includes("tech") || lower.includes("digital")) return "tech";
  if (lower.includes("classic") || lower.includes("formal")) return "classic";
  return "modern";
}

function inferSpacing(slides: DeckSlide[]): DeckStyleDna["spacing"] {
  const highDensity = slides.filter((slide) => slide.contentDensity === "high").length;
  if (highDensity > Math.floor(slides.length * 0.45)) return "compact";
  const lowDensity = slides.filter((slide) => slide.contentDensity === "low").length;
  if (lowDensity > Math.floor(slides.length * 0.45)) return "airy";
  return "balanced";
}
