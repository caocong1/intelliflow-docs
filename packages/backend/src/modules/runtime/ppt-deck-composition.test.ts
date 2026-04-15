import { describe, expect, test } from "vitest";
import type { Slide } from "../../../../shared/src/slide-types";
import {
  assignTemplateSequence,
  buildDeckCompositionWarnings,
  normalizeSlidesForDeck,
  scoreTemplateCandidate,
} from "./ppt-deck-composition";
import type { NativeTemplateProfileSlide } from "../ppt-templates/native-template-profile";

function createTemplateSlide(
  slideNumber: number,
  semanticRole: NativeTemplateProfileSlide["semanticRole"],
  roleHints: NativeTemplateProfileSlide["roleHints"],
): NativeTemplateProfileSlide {
  return {
    slideId: slideNumber,
    slideNumber,
    layoutName: `layout-${slideNumber}`,
    hasFullBleedImage: semanticRole === "cover",
    selectors: [],
    roleHints,
    semanticRole,
    semanticRoleSource: "auto",
    semanticRoleConfidence: 0.9,
    semanticRoleCandidates: semanticRole ? [{ role: semanticRole, score: 100 }] : [],
    contentDensity: semanticRole === "cover" ? "sparse" : "medium",
    autoUse: true,
    sampleTextSummary: [],
    titleSlot: {
      selector: `title-${slideNumber}`,
      position: { x: 1, y: 1, cx: 1, cy: 1 },
    },
    ...(roleHints.includes("content")
      ? {
          bodySlot: {
            selector: `body-${slideNumber}`,
            position: { x: 1, y: 2, cx: 1, cy: 1 },
          },
        }
      : {}),
    ...(roleHints.includes("two_column")
      ? {
          leftSlot: {
            selector: `left-${slideNumber}`,
            position: { x: 1, y: 2, cx: 1, cy: 1 },
          },
          rightSlot: {
            selector: `right-${slideNumber}`,
            position: { x: 2, y: 2, cx: 1, cy: 1 },
          },
        }
      : {}),
  };
}

describe("ppt deck composition", () => {
  test("normalizeSlidesForDeck infers key semantic roles", () => {
    const slides = normalizeSlidesForDeck([
      { layout: "title", title: "项目方案" },
      { layout: "content", title: "目录", bullets: ["A", "B"] },
      { layout: "title", title: "第二章" },
      { layout: "content", title: "结论总结", bullets: ["结论 1"] },
      { layout: "title", title: "谢谢聆听" },
    ] as Slide[]);

    expect(slides[0].semanticRole).toBe("cover");
    expect(slides[1].semanticRole).toBe("toc");
    expect(slides[2].semanticRole).toBe("section_break");
    expect(slides[3].semanticRole).toBe("summary");
    expect(slides[4].semanticRole).toBe("closing");
  });

  test("assignTemplateSequence penalizes repetitive reuse when alternatives exist", () => {
    const slides = normalizeSlidesForDeck([
      { layout: "title", title: "封面" },
      { layout: "content", title: "第一页", bullets: ["A", "B", "C"] },
      { layout: "content", title: "第二页", bullets: ["D", "E", "F"] },
    ] as Slide[]);
    const templateSlides = [
      createTemplateSlide(1, "cover", ["title"]),
      createTemplateSlide(2, "bullet_list", ["content"]),
      createTemplateSlide(3, "bullet_list", ["content"]),
    ];

    const assignments = assignTemplateSequence(slides, templateSlides);
    expect(assignments[0].templateSlide?.slideNumber).toBe(1);
    expect(assignments[1].templateSlide?.slideNumber).not.toBe(assignments[2].templateSlide?.slideNumber);
  });

  test("scoreTemplateCandidate strongly prefers exact semantic role matches", () => {
    const slide = normalizeSlidesForDeck([
      {
        layout: "two_column",
        title: "项目对比",
        left: { bullets: ["A", "B"] },
        right: { bullets: ["C", "D"] },
      },
    ] as Slide[])[0];
    const comparisonTemplate = createTemplateSlide(1, "comparison", ["two_column"]);
    const contentTemplate = createTemplateSlide(2, "bullet_list", ["content"]);

    const comparisonScore = scoreTemplateCandidate({
      slide,
      templateSlide: comparisonTemplate,
      pageIndex: 0,
      totalSlides: 1,
      usageCount: 0,
    });
    const contentScore = scoreTemplateCandidate({
      slide,
      templateSlide: contentTemplate,
      pageIndex: 0,
      totalSlides: 1,
      usageCount: 0,
    });

    expect(comparisonScore).toBeGreaterThan(contentScore);
  });

  test("buildDeckCompositionWarnings reports markdown fallback", () => {
    const warnings = buildDeckCompositionWarnings({
      source: "markdown",
      usedAi: false,
      aiFailed: true,
    });
    expect(warnings.some((warning) => warning.includes("降级"))).toBe(true);
  });
});
