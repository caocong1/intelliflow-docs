import { createHash } from "node:crypto";
import type { DeckPlan, DeckSlide } from "../types";

export function makeSvgDeckPlan(slides: DeckSlide[]): DeckPlan {
  return {
    title: "SVG 模板测试",
    subtitle: "模板 smoke",
    audience: "test",
    visualDirection: "formal",
    theme: {
      palette: ["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"],
      mood: "formal",
      referenceKeywords: ["test"],
      visualMotif: "abstract",
      paletteDominance: "balanced",
    },
    slides,
  };
}

export function makeSvgSlide(pageType: DeckSlide["pageType"]): DeckSlide {
  return {
    id: `test-${pageType}`,
    pageType,
    layoutPattern: `${pageType}-pat`,
    title: svgSlideTitle(pageType),
    keyMessage: "测试关键信息",
    contentBlocks: [
      { heading: "核心判断", body: "以统一知识资产形成预算闭环", emphasis: "strong" },
      { heading: "落地抓手", body: "围绕数据治理建立分阶段交付", emphasis: "normal" },
      { heading: "管理价值", body: "降低重复劳动，提升决策质量", emphasis: "normal" },
    ],
    visualPrompt: "abstract enterprise network motif",
    speakerNotes: "讲解词",
    layoutIntent: "正文左对齐",
    contentDensity: "medium",
    visualHierarchy: "标题优先",
    chart:
      pageType === "chart"
        ? {
            title: "数据",
            labels: ["A", "B", "C"],
            values: [30, 50, 20],
            unit: "%",
            chartType: "bar",
          }
        : undefined,
    timeline:
      pageType === "timeline" || pageType === "roadmap"
        ? [{ label: "阶段1", description: "描述", date: "Q1" }]
        : undefined,
    table: pageType === "table" ? { headers: ["列1", "列2"], rows: [["a", "b"]] } : undefined,
  };
}

export function tinyPngDataUri(): string {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lN5ksAAAAABJRU5ErkJggg==";
}

export function svgSignature(svg: string): {
  ids: string[];
  rectCount: number;
  textCount: number;
  imageCount: number;
  tspanCount: number;
} {
  const ids = Array.from(svg.matchAll(/id="([^"]+)"/g))
    .map((m) => m[1])
    .sort();
  return {
    ids,
    rectCount: (svg.match(/<rect\b/g) ?? []).length,
    textCount: (svg.match(/<text\b/g) ?? []).length,
    imageCount: (svg.match(/<image\b/g) ?? []).length,
    tspanCount: (svg.match(/<tspan\b/g) ?? []).length,
  };
}

export function svgStableHash(svg: string): string {
  const normalized = svg.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

function svgSlideTitle(pageType: DeckSlide["pageType"]): string {
  const map: Record<string, string> = {
    cover: "封面",
    agenda: "目录",
    section: "章节",
    problem: "现状痛点",
    strategy: "战略价值",
    architecture: "总体架构",
    capability: "核心能力",
    governance: "数据治理与安全",
    scenario: "试点场景",
    timeline: "实施路线图",
    metrics: "投入产出",
    table: "对比表",
    risk: "风险与治理",
    summary: "总结",
    closing: "总结页",
    comparison: "方案对比",
    process: "推进流程",
    roadmap: "未来路线图",
    team: "团队成员",
    quote: "关键引用",
    chart: "数据图表",
    contact: "联系方式",
  };
  return map[pageType] ?? "测试页面";
}
