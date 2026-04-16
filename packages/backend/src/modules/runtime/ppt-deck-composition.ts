import type {
  Slide,
  SlideSemanticRole,
} from "../../../../shared/src/slide-types";
import type { NativeTemplateProfileSlide } from "../ppt-templates/native-template-profile";

export type DeckSource = "structured" | "ai" | "markdown";

export type DeckCompositionSummary = {
  source: DeckSource;
  totalSlides: number;
  semanticRoleCounts: Partial<Record<SlideSemanticRole, number>>;
  matchedSlides?: number;
  unmatchedSlides?: number;
  templateMatches?: Array<{
    pageNumber: number;
    semanticRole: SlideSemanticRole | null;
    templateSlideNumber: number | null;
    templateLayoutName: string | null;
    score: number;
  }>;
};

export type DeckAssignment = {
  pageNumber: number;
  slide: Slide;
  semanticRole: SlideSemanticRole | null;
  templateSlide: NativeTemplateProfileSlide | null;
  score: number;
};

const NONE_OVERRIDE = "__NONE__";

function normalizeText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function collectSlideText(slide: Slide): string {
  switch (slide.layout) {
    case "title":
      return `${slide.title} ${slide.subtitle ?? ""}`;
    case "content":
      return `${slide.title} ${slide.bullets.join(" ")}`;
    case "two_column":
      return `${slide.title} ${slide.left.title ?? ""} ${slide.left.bullets.join(" ")} ${slide.right.title ?? ""} ${slide.right.bullets.join(" ")}`;
    case "table":
      return `${slide.title} ${slide.headers.join(" ")} ${slide.rows.flat().join(" ")}`;
    case "image":
      return `${slide.title} ${slide.caption ?? ""}`;
    case "blank":
    default:
      return "";
  }
}

function inferSemanticRole(
  slide: Slide,
  index: number,
  totalSlides: number,
): SlideSemanticRole {
  const text = normalizeText(collectSlideText(slide));
  const first = index === 0;
  const last = index === totalSlides - 1;

  if (slide.semanticRole) return slide.semanticRole;
  if (first) return "cover";
  if (/目录|contents|agenda|tableofcontents/.test(text)) return "toc";
  if (/thank|thanks|谢谢|感谢|end/.test(text) || last) return "closing";
  if (/q&a|qa|答疑|问答|常见问题/.test(text)) return "qna";
  if (/总结|结论|summary|核心原则|takeaway/.test(text)) return "summary";
  if (/时间轴|timeline|历程|阶段|里程碑|roadmap/.test(text)) return "timeline";
  if (/对比|vs|compare|comparison|优势/.test(text)) return "comparison";
  if (slide.layout === "table") return "table";
  if (slide.layout === "image") return "image_focus";
  if (slide.layout === "title") return "section_break";
  if (slide.layout === "two_column") return "comparison";
  return "bullet_list";
}

function inferVisualIntent(role: SlideSemanticRole, slide: Slide): string {
  switch (role) {
    case "cover":
      return "hero";
    case "toc":
      return "index";
    case "section_break":
      return "transition";
    case "comparison":
      return "contrast";
    case "timeline":
      return "sequence";
    case "table":
      return "data-grid";
    case "image_focus":
      return "visual-first";
    case "summary":
      return "takeaway";
    case "qna":
      return "faq";
    case "closing":
      return "farewell";
    case "bullet_list":
    default:
      return slide.layout === "two_column" ? "two-column" : "structured-list";
  }
}

export function normalizeSlidesForDeck(slides: Slide[]): Slide[] {
  return slides.map((slide, index) => {
    const semanticRole = inferSemanticRole(slide, index, slides.length);
    return {
      ...slide,
      semanticRole,
      sectionKey: slide.sectionKey ?? `${semanticRole}-${index + 1}`,
      visualIntent: slide.visualIntent ?? inferVisualIntent(semanticRole, slide),
    };
  });
}

function measureSlideDensity(slide: Slide): "sparse" | "medium" | "dense" {
  switch (slide.layout) {
    case "title":
      return slide.subtitle ? "medium" : "sparse";
    case "content": {
      const chars = slide.bullets.join("").length;
      if (slide.bullets.length >= 6 || chars > 180) return "dense";
      if (slide.bullets.length >= 3 || chars > 70) return "medium";
      return "sparse";
    }
    case "two_column": {
      const count = slide.left.bullets.length + slide.right.bullets.length;
      if (count >= 8) return "dense";
      if (count >= 4) return "medium";
      return "sparse";
    }
    case "table": {
      const cellCount = slide.headers.length + slide.rows.flat().length;
      if (cellCount >= 20) return "dense";
      if (cellCount >= 8) return "medium";
      return "sparse";
    }
    case "image":
      return slide.caption ? "medium" : "sparse";
    case "blank":
    default:
      return "sparse";
  }
}

function getEffectiveSlot(
  slide: NativeTemplateProfileSlide,
  slotName:
    | "titleSlot"
    | "subtitleSlot"
    | "bodySlot"
    | "leftSlot"
    | "rightSlot"
    | "tableSlot"
    | "imageSlot"
    | "captionSlot",
) {
  const override = slide.slotOverrides?.[slotName];
  if (override === NONE_OVERRIDE) return undefined;
  if (override && override in slide) {
    return slide[override as keyof NativeTemplateProfileSlide];
  }
  return slide[slotName];
}

function scoreRoleMatch(
  templateSlide: NativeTemplateProfileSlide,
  semanticRole: SlideSemanticRole | null,
): number {
  if (!semanticRole) return 0;
  if (templateSlide.semanticRole === semanticRole) return 95;
  const candidate = templateSlide.semanticRoleCandidates.find(
    (item) => item.role === semanticRole,
  );
  return candidate ? Math.max(20, Math.round(candidate.score * 0.55)) : 0;
}

function scoreSemanticSlotFit(
  templateSlide: NativeTemplateProfileSlide,
  slide: Slide,
  semanticRole: SlideSemanticRole | null,
): number {
  const titleLike =
    Boolean(getEffectiveSlot(templateSlide, "titleSlot")) ||
    Boolean(getEffectiveSlot(templateSlide, "subtitleSlot")) ||
    Boolean(getEffectiveSlot(templateSlide, "bodySlot"));
  const contentLike =
    Boolean(getEffectiveSlot(templateSlide, "bodySlot")) ||
    (Boolean(getEffectiveSlot(templateSlide, "leftSlot")) &&
      Boolean(getEffectiveSlot(templateSlide, "rightSlot")));
  const imageLike = Boolean(getEffectiveSlot(templateSlide, "imageSlot"));

  switch (semanticRole) {
    case "cover":
      return titleLike ? 45 : Number.NEGATIVE_INFINITY;
    case "toc":
      return contentLike ? 36 : Number.NEGATIVE_INFINITY;
    case "section_break":
      return titleLike ? 38 : Number.NEGATIVE_INFINITY;
    case "summary":
    case "qna":
      return contentLike ? 26 : Number.NEGATIVE_INFINITY;
    case "image_focus":
      return imageLike ? 24 : -10;
    case "closing":
      return titleLike ? 34 : Number.NEGATIVE_INFINITY;
    default:
      return 0;
  }
}

function scoreLayoutFit(templateSlide: NativeTemplateProfileSlide, slide: Slide): number {
  switch (slide.layout) {
    case "title":
      return getEffectiveSlot(templateSlide, "titleSlot") ||
        getEffectiveSlot(templateSlide, "bodySlot") ||
        getEffectiveSlot(templateSlide, "subtitleSlot")
        ? 40 +
            (getEffectiveSlot(templateSlide, "titleSlot") ? 10 : 0) +
            (getEffectiveSlot(templateSlide, "subtitleSlot") ? 8 : 0)
        : 0;
    case "content":
      return getEffectiveSlot(templateSlide, "titleSlot") &&
        getEffectiveSlot(templateSlide, "bodySlot")
        ? 42
        : 0;
    case "two_column":
      if (
        getEffectiveSlot(templateSlide, "titleSlot") &&
        getEffectiveSlot(templateSlide, "leftSlot") &&
        getEffectiveSlot(templateSlide, "rightSlot")
      ) {
        return 48;
      }
      return getEffectiveSlot(templateSlide, "bodySlot") ? 20 : 0;
    case "table":
      return getEffectiveSlot(templateSlide, "tableSlot")
        ? 50
        : getEffectiveSlot(templateSlide, "bodySlot")
          ? 18
          : 0;
    case "image":
      return getEffectiveSlot(templateSlide, "imageSlot")
        ? 48
        : getEffectiveSlot(templateSlide, "bodySlot")
          ? 16
          : 0;
    case "blank":
    default:
      return 12;
  }
}

export function scoreTemplateCandidate(params: {
  slide: Slide;
  templateSlide: NativeTemplateProfileSlide;
  pageIndex: number;
  totalSlides: number;
  usageCount: number;
  previousTemplateSlideNumber?: number | null;
}): number {
  const { slide, templateSlide, pageIndex, totalSlides, usageCount, previousTemplateSlideNumber } =
    params;
  if (templateSlide.autoUse === false) return Number.NEGATIVE_INFINITY;

  const semanticRole = slide.semanticRole ?? null;
  const roleScore = scoreRoleMatch(templateSlide, semanticRole);
  const layoutScore = scoreLayoutFit(templateSlide, slide);
  const semanticSlotFit = scoreSemanticSlotFit(templateSlide, slide, semanticRole);
  if (!Number.isFinite(semanticSlotFit)) return Number.NEGATIVE_INFINITY;
  if (roleScore === 0 && layoutScore === 0) return Number.NEGATIVE_INFINITY;

  let score = roleScore + layoutScore + semanticSlotFit;

  if (templateSlide.contentDensity === measureSlideDensity(slide)) {
    score += 18;
  } else if (
    (templateSlide.contentDensity === "medium" && measureSlideDensity(slide) !== "medium") ||
    (templateSlide.contentDensity !== "medium" && measureSlideDensity(slide) === "medium")
  ) {
    score += 8;
  }

  if (pageIndex === 0 && templateSlide.semanticRole === "cover") score += 120;
  if (pageIndex === 0 && templateSlide.slideNumber === 1) score += 90;
  if (pageIndex === totalSlides - 1 && templateSlide.semanticRole === "closing") score += 40;
  if (pageIndex > 0 && pageIndex < Math.max(2, totalSlides - 1) && templateSlide.semanticRole === "toc") {
    score += 20;
  }
  if (semanticRole === "toc" && !getEffectiveSlot(templateSlide, "bodySlot")) {
    score -= 50;
  }
  if (semanticRole === "cover" && templateSlide.slideNumber !== 1) {
    score -= 25;
  }

  score -= usageCount * 38;
  if (previousTemplateSlideNumber === templateSlide.slideNumber) {
    score -= 22;
  }

  return score;
}

export function assignTemplateSequence(
  slides: Slide[],
  templateSlides: NativeTemplateProfileSlide[],
): DeckAssignment[] {
  const usageCount = new Map<number, number>();
  const assignments: DeckAssignment[] = [];

  slides.forEach((slide, index) => {
    const previousTemplateSlideNumber = assignments.at(-1)?.templateSlide?.slideNumber ?? null;
    const ranked = templateSlides
      .map((templateSlide) => ({
        templateSlide,
        score: scoreTemplateCandidate({
          slide,
          templateSlide,
          pageIndex: index,
          totalSlides: slides.length,
          usageCount: usageCount.get(templateSlide.slideNumber) ?? 0,
          previousTemplateSlideNumber,
        }),
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.templateSlide.slideNumber - b.templateSlide.slideNumber,
      );

    const best = ranked[0];
    if (best) {
      usageCount.set(
        best.templateSlide.slideNumber,
        (usageCount.get(best.templateSlide.slideNumber) ?? 0) + 1,
      );
    }

    assignments.push({
      pageNumber: index + 1,
      slide,
      semanticRole: slide.semanticRole ?? null,
      templateSlide: best?.templateSlide ?? null,
      score: best?.score ?? Number.NEGATIVE_INFINITY,
    });
  });

  return assignments;
}

export function buildDeckCompositionSummary(params: {
  source: DeckSource;
  slides: Slide[];
  assignments?: DeckAssignment[];
}): DeckCompositionSummary {
  const semanticRoleCounts: Partial<Record<SlideSemanticRole, number>> = {};
  for (const slide of params.slides) {
    const role = slide.semanticRole ?? null;
    if (!role) continue;
    semanticRoleCounts[role] = (semanticRoleCounts[role] ?? 0) + 1;
  }

  const summary: DeckCompositionSummary = {
    source: params.source,
    totalSlides: params.slides.length,
    semanticRoleCounts,
  };

  if (params.assignments) {
    summary.matchedSlides = params.assignments.filter((item) => item.templateSlide).length;
    summary.unmatchedSlides = params.assignments.filter((item) => !item.templateSlide).length;
    summary.templateMatches = params.assignments.map((item) => ({
      pageNumber: item.pageNumber,
      semanticRole: item.semanticRole,
      templateSlideNumber: item.templateSlide?.slideNumber ?? null,
      templateLayoutName: item.templateSlide?.layoutName ?? null,
      score: Number.isFinite(item.score) ? item.score : 0,
    }));
  }

  return summary;
}

export function buildDeckCompositionWarnings(params: {
  source: DeckSource;
  usedAi: boolean;
  aiFailed: boolean;
  assignments?: DeckAssignment[];
}): string[] {
  const warnings: string[] = [];
  if (params.aiFailed) {
    warnings.push("AI 编排失败，已降级为规则分页模式。");
  } else if (!params.usedAi && params.source === "markdown") {
    warnings.push("未使用 AI 编排，已按规则分页生成幻灯片。");
  }

  if (params.assignments) {
    const unmatched = params.assignments.filter((item) => !item.templateSlide).length;
    if (unmatched > 0) {
      warnings.push(`有 ${unmatched} 页未命中模板画像，已回退到默认绘制逻辑。`);
    }
  }

  return warnings;
}

export function buildTemplatePromptSummary(
  templateSlides: NativeTemplateProfileSlide[],
): string {
  return templateSlides
    .filter((slide) => slide.autoUse !== false)
    .slice(0, 12)
    .map((slide) => {
      const role = slide.semanticRole ?? "bullet_list";
      const sample = slide.sampleTextSummary[0] ? `；样本文字：${slide.sampleTextSummary[0]}` : "";
      return `- 模板页 ${slide.slideNumber}：角色=${role}；布局=${slide.layoutName}；密度=${slide.contentDensity}${sample}`;
    })
    .join("\n");
}
