import { describe, expect, it } from "vitest";
import { validateDeckPlan } from "./deck-plan-schema";
import {
  AUTO_DYNAMIC_LAYOUT_DIVERSITY_MIN_SCORE,
  scoreDeckLayoutDiversity,
} from "./layout-diversity";
import type { DeckPlan, DeckSlide } from "./types";

describe("layout diversity scoring", () => {
  it("passes a deck with varied structural paradigms", () => {
    const report = scoreDeckLayoutDiversity(makeDiverseDeckPlan());

    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(AUTO_DYNAMIC_LAYOUT_DIVERSITY_MIN_SCORE);
    expect(report.uniqueStructuralParadigms).toBeGreaterThanOrEqual(6);
  });

  it("fails auto_dynamic validation when the deck only changes labels/colors around a few structures", () => {
    const result = validateDeckPlan(makeLowDiversityDeckPlan(), 12, {
      generationMode: "auto_dynamic",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join("\n")).toContain("layoutDiversityScore");
      expect(result.errors.join("\n")).toContain("auto_dynamic");
    }
  });

  it("does not apply the auto diversity gate to template_stylized mode", () => {
    const result = validateDeckPlan(makeLowDiversityDeckPlan(), 12, {
      generationMode: "template_stylized",
    });

    expect(result.ok).toBe(true);
  });
});

function makeDiverseDeckPlan(): DeckPlan {
  return makeDeckPlan([
    "cover",
    "agenda",
    "problem",
    "architecture",
    "capability",
    "governance",
    "scenario",
    "timeline",
    "metrics",
    "table",
    "risk",
    "closing",
  ]);
}

function makeLowDiversityDeckPlan(): DeckPlan {
  return makeDeckPlan([
    "problem",
    "strategy",
    "capability",
    "scenario",
    "summary",
    "section",
    "risk",
    "governance",
    "problem",
    "strategy",
    "capability",
    "scenario",
  ]);
}

function makeDeckPlan(pageTypes: DeckSlide["pageType"][]): DeckPlan {
  return {
    title: "AI 驱动的企业知识中台建设方案",
    subtitle: "管理层汇报",
    audience: "集团管理层",
    visualDirection: "正式商务、咨询公司风。",
    theme: {
      palette: ["3E4C3A", "A65F32", "E7D7B8", "243128"],
      mood: "正式、稳健、战略",
      referenceKeywords: ["enterprise", "consulting"],
      visualMotif: "知识网络与治理环",
      paletteDominance: "深橄榄 65%，米金 20%，铜色 10%，深墨绿 5%",
    },
    slides: pageTypes.map((pageType, index) => ({
      id: `slide-${index + 1}`,
      pageType,
      layoutPattern: `layout-${index + 1}`,
      title: `第 ${index + 1} 页`,
      keyMessage: `第 ${index + 1} 页聚焦管理层决策要点。`,
      contentBlocks: [
        {
          heading: "核心判断",
          body: "以统一知识资产、流程嵌入和可衡量试点形成预算闭环。",
          emphasis: "strong",
        },
      ],
      chart:
        pageType === "metrics"
          ? { title: "投入产出", labels: ["效率", "成本"], values: [35, 18], unit: "%" }
          : undefined,
      table:
        pageType === "table"
          ? {
              title: "方案对比",
              headers: ["方案", "优势"],
              rows: [["知识中台", "可复用"]],
            }
          : undefined,
      timeline:
        pageType === "timeline"
          ? [{ label: "试点", description: "验证价值", date: "Q1" }]
          : undefined,
      visualPrompt:
        "abstract enterprise knowledge network, no text / no letters / no typography / no UI labels",
      speakerNotes: "承接上一页，说明管理层关注点。",
      layoutIntent: "正文左对齐，保留左右 0.5 inch 安全边距，不使用标题下划线装饰。",
      contentDensity: "medium",
      visualHierarchy: "标题、关键判断、三条管理要点、右侧视觉元素。",
    })),
  };
}
