import { describe, expect, it } from "vitest";
import { SVG_HASH_SNAPSHOTS } from "./test-helpers/svg-hash-snapshots";
import {
  makeSvgDeckPlan,
  makeSvgSlide,
  svgSignature,
  svgStableHash,
  tinyPngDataUri,
} from "./test-helpers/svg-test-helpers";
import { buildSvgArtifacts } from "./svg-renderer";
import type { DeckPlan, DeckSlide, VisualAsset } from "./types";
import {
  renderChartSlide,
  renderComparisonSlide,
  renderContactSlide,
  renderProcessSlide,
  renderQuoteSlide,
  renderRoadmapSlide,
  renderTeamSlide,
  slideColors,
  wrapMultilingualLines,
} from "./svg-templates";

describe("ppt-agent svg templates", () => {
  it("renders all new page type templates as valid SVG", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);

    const cases: Array<{ label: string; svg: string }> = [
      { label: "comparison", svg: renderComparisonSlide(makeSvgSlide("comparison"), colors, 0) },
      { label: "process", svg: renderProcessSlide(makeSvgSlide("process"), colors, 0) },
      { label: "roadmap", svg: renderRoadmapSlide(makeSvgSlide("roadmap"), colors, 0) },
      { label: "team", svg: renderTeamSlide(makeSvgSlide("team"), colors, 0) },
      { label: "quote", svg: renderQuoteSlide(makeSvgSlide("quote"), colors, 0) },
      { label: "contact", svg: renderContactSlide(makeSvgSlide("contact"), colors, 0) },
      { label: "chart", svg: renderChartSlide(makeSvgSlide("chart"), colors, 0) },
    ];

    for (const { label, svg } of cases) {
      expect(svg, `${label} should render valid SVG`).toContain("<svg");
      expect(svg, `${label} should close svg tag`).toContain("</svg>");
      expect(svg, `${label} should have SLIDE_W`).toContain("1280");
      expect(svg, `${label} should have SLIDE_H`).toContain("720");
    }
  });

  it("renders all four chart variants as valid SVG", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);
    const variants: Array<"bar" | "line" | "pie" | "radar"> = ["bar", "line", "pie", "radar"];

    for (const chartType of variants) {
      const slide: DeckSlide = {
        id: "chart-test",
        pageType: "chart",
        layoutPattern: "chart-pat",
        title: "图表测试",
        keyMessage: "数据展示",
        contentBlocks: [],
        visualPrompt: "chart motif",
        speakerNotes: "",
        layoutIntent: "",
        contentDensity: "medium",
        visualHierarchy: "",
        chart: {
          title: `${chartType} 图表`,
          labels: ["效率", "成本", "复用", "质量"],
          values: [35, 20, 60, 15],
          unit: "%",
          chartType,
        },
      };

      const svg = renderChartSlide(slide, colors, 0);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain("<text");
      expect(svg).toContain(slide.title);
    }
  });

  it("renders all new page type templates with expected structural elements", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);

    const comparison = renderComparisonSlide(makeSvgSlide("comparison"), colors, 0);
    expect(comparison).toContain("VS");
    expect(comparison).toContain("方案 A");
    expect(comparison).toContain("方案 B");

    const process = renderProcessSlide(makeSvgSlide("process"), colors, 0);
    expect(process).toContain("step-1");

    const roadmap = renderRoadmapSlide(makeSvgSlide("roadmap"), colors, 0);
    expect(roadmap).toContain("roadmap-1");

    const team = renderTeamSlide(makeSvgSlide("team"), colors, 0);
    expect(team).toContain("team-1");

    const quote = renderQuoteSlide(makeSvgSlide("quote"), colors, 0);
    expect(quote).toContain("<text");

    const contact = renderContactSlide(makeSvgSlide("contact"), colors, 0);
    expect(contact).toContain("contact-card");
  });

  it("renders quote slide with wrapped text and optional side visual", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);
    const quoteSlide = makeSvgSlide("quote");
    quoteSlide.contentBlocks[0].body =
      "通过治理优先与场景牵引并行推进，我们可以在保障安全与合规的前提下，持续把知识资产转化为可衡量的组织效率提升与业务价值复用能力。";
    const visual: VisualAsset = {
      slideId: quoteSlide.id,
      dataUri: tinyPngDataUri(),
      source: "fallback",
    };

    const svg = renderQuoteSlide(quoteSlide, colors, 0, visual);
    expect(svg).toContain('id="quote-container"');
    expect(svg).toContain('id="side-image"');
    expect(svg).toContain(visual.dataUri);
    expect(svg).toContain('<tspan x="66" dy="38">');
    expect(svg).not.toContain(quoteSlide.contentBlocks[0].body);
  });

  it("truncates very long quote text with ellipsis", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);
    const quoteSlide = makeSvgSlide("quote");
    quoteSlide.contentBlocks[0].body = "这是一个很长的引用内容".repeat(40);

    const svg = renderQuoteSlide(quoteSlide, colors, 0);
    expect(svg).toContain("...");
    expect(svg.match(/<tspan x="66"/g)?.length).toBeLessThanOrEqual(4);
  });

  it("uses high-contrast quote text styling on dark themes", () => {
    const darkColors = slideColors(["0F172A", "334155", "3B82F6", "94A3B8", "0F172A"], 0);
    const quoteSlide = makeSvgSlide("quote");
    const svg = renderQuoteSlide(quoteSlide, darkColors, 0);

    expect(svg).toContain('font-size="22" fill="#f8fafc"');
    expect(svg).toContain('font-size="16" font-weight="bold" fill="#e2e8f0"');
    expect(svg).toContain('stroke="#94a3b8"');
  });

  it("wrapMultilingualLines supports mixed CJK/Latin text with truncation", () => {
    const lines = wrapMultilingualLines(
      "AI治理平台通过Policy Engine and Data Contracts实现跨团队协作一致性与风险可控。",
      { maxUnitsPerLine: 18, maxLines: 2, ellipsis: "...", emptyFallback: "N/A" },
    );

    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.join("")).toContain("...");
    expect(lines[0].length).toBeGreaterThan(0);
  });

  it("wrapMultilingualLines returns fallback for empty text", () => {
    const lines = wrapMultilingualLines("   ", {
      maxUnitsPerLine: 12,
      maxLines: 2,
      emptyFallback: "（空）",
    });
    expect(lines).toEqual(["（空）"]);
  });

  it("wrapMultilingualLines trims trailing punctuation before ellipsis", () => {
    const lines = wrapMultilingualLines("这是一个需要截断的句子，，，，", {
      maxUnitsPerLine: 6,
      maxLines: 1,
      ellipsis: "...",
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith("...")).toBe(true);
    expect(lines[0]).not.toMatch(/[，。；：、,.!?！？]+\.\.\.$/u);
  });

  it("truncates long contact title and fields to keep layout stable", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);
    const contactSlide = makeSvgSlide("contact");
    contactSlide.title = "这是一个非常长的联系方式页面标题用于验证布局在极端文案下仍然稳定";
    contactSlide.keyMessage =
      "请通过统一门户、邮件列表、值班热线与企业协同平台提交需求与故障并附带业务影响说明";
    contactSlide.contentBlocks = [
      {
        heading: "企业微信技术支持与协同响应中心",
        body: "intelliflow-enterprise-support-and-collaboration-center@example.com",
        emphasis: "normal",
      },
    ];

    const svg = renderContactSlide(contactSlide, colors, 0);
    expect(svg).toContain("...");
    expect(svg).not.toContain(contactSlide.contentBlocks[0].heading);
    expect(svg).not.toContain(contactSlide.contentBlocks[0].body);
  });

  it("truncates long labels in comparison and roadmap slides", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);

    const comparisonSlide = makeSvgSlide("comparison");
    comparisonSlide.contentBlocks = [
      {
        heading: "这是一个非常非常长的方案名称用于验证比较卡片标题截断行为",
        body: "第一方案描述包含大量补充说明文字以测试在固定宽度中的稳定展示效果",
        emphasis: "normal",
      },
      {
        heading: "第二个超长标题同样需要被截断以避免挤压布局与相邻元素",
        body: "第二方案描述同样很长很长很长用于覆盖边界场景并触发省略号",
        emphasis: "normal",
      },
      {
        heading: "第三个超长标题",
        body: "第三方案描述",
        emphasis: "normal",
      },
      {
        heading: "第四个超长标题",
        body: "第四方案描述",
        emphasis: "normal",
      },
    ];
    const comparisonSvg = renderComparisonSlide(comparisonSlide, colors, 0);
    expect(comparisonSvg).toContain("...");
    expect(comparisonSvg).not.toContain(comparisonSlide.contentBlocks[0].heading);
    expect(comparisonSvg).not.toContain(comparisonSlide.contentBlocks[0].body);

    const roadmapSlide = makeSvgSlide("roadmap");
    roadmapSlide.timeline = [
      {
        label: "这是一个非常非常长的里程碑标签用于验证路线图标题单行截断",
        description: "这段描述也非常长用于验证路线图描述文本在单行内被安全截断并保持布局稳定不溢出",
        date: "2026-Q1-Q2-Q3-Extended",
      },
    ];
    const roadmapSvg = renderRoadmapSlide(roadmapSlide, colors, 0);
    expect(roadmapSvg).toContain("...");
    expect(roadmapSvg).not.toContain(roadmapSlide.timeline[0].label);
    expect(roadmapSvg).not.toContain(roadmapSlide.timeline[0].description);
    expect(roadmapSvg).not.toContain(roadmapSlide.timeline[0].date);
  });

  it("keeps structural signatures stable for key svg templates", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);
    const visual: VisualAsset = {
      slideId: "sig-1",
      dataUri: tinyPngDataUri(),
      source: "fallback",
    };

    const signatures = {
      comparison: svgSignature(renderComparisonSlide(makeSvgSlide("comparison"), colors, 0, visual)),
      roadmap: svgSignature(renderRoadmapSlide(makeSvgSlide("roadmap"), colors, 0)),
      quote: svgSignature(renderQuoteSlide(makeSvgSlide("quote"), colors, 0, visual)),
      contact: svgSignature(renderContactSlide(makeSvgSlide("contact"), colors, 0, visual)),
    };

    expect(signatures.comparison.ids).toEqual(
      expect.arrayContaining(["col-left", "col-right", "header", "side-image", "vs-divider"]),
    );
    expect(signatures.comparison.rectCount).toBeGreaterThanOrEqual(10);
    expect(signatures.comparison.textCount).toBeGreaterThanOrEqual(10);
    expect(signatures.comparison.imageCount).toBe(1);
    expect(signatures.comparison.tspanCount).toBeGreaterThanOrEqual(2);

    expect(signatures.roadmap.ids).toEqual(
      expect.arrayContaining(["header", "roadmap-1"]),
    );
    expect(signatures.roadmap.rectCount).toBeGreaterThanOrEqual(6);
    expect(signatures.roadmap.textCount).toBeGreaterThanOrEqual(4);
    expect(signatures.roadmap.imageCount).toBe(0);
    expect(signatures.roadmap.tspanCount).toBeGreaterThanOrEqual(2);

    expect(signatures.quote.ids).toEqual(
      expect.arrayContaining(["header", "quote-container", "side-image"]),
    );
    expect(signatures.quote.rectCount).toBeGreaterThanOrEqual(5);
    expect(signatures.quote.textCount).toBeGreaterThanOrEqual(5);
    expect(signatures.quote.imageCount).toBe(1);
    expect(signatures.quote.tspanCount).toBeGreaterThanOrEqual(3);

    expect(signatures.contact.ids).toEqual(
      expect.arrayContaining(["contact-card", "header", "side-image"]),
    );
    expect(signatures.contact.rectCount).toBeGreaterThanOrEqual(5);
    expect(signatures.contact.textCount).toBeGreaterThanOrEqual(8);
    expect(signatures.contact.imageCount).toBe(1);
    expect(signatures.contact.tspanCount).toBeGreaterThanOrEqual(2);
  });

  it("buildSvgArtifacts emits stable filenames and routed template structures", () => {
    const deckPlan = makeSvgDeckPlan([
      { ...makeSvgSlide("comparison"), id: "artifact-1" },
      { ...makeSvgSlide("roadmap"), id: "artifact-2" },
      { ...makeSvgSlide("quote"), id: "artifact-3" },
      { ...makeSvgSlide("contact"), id: "artifact-4" },
    ]);
    const visuals: VisualAsset[] = [
      { slideId: "artifact-1", dataUri: tinyPngDataUri(), source: "fallback" },
      { slideId: "artifact-3", dataUri: tinyPngDataUri(), source: "fallback" },
      { slideId: "artifact-4", dataUri: tinyPngDataUri(), source: "fallback" },
    ];

    const artifacts = buildSvgArtifacts(deckPlan, visuals);
    expect(artifacts.map((a) => a.filename)).toEqual([
      "01_comparison.svg",
      "02_roadmap.svg",
      "03_quote.svg",
      "04_contact.svg",
    ]);

    const byType = new Map(artifacts.map((a) => [a.pageType, a.svg]));
    expect(byType.get("comparison")).toContain('id="vs-divider"');
    expect(byType.get("comparison")).toContain('id="side-image"');
    expect(byType.get("roadmap")).toContain('id="roadmap-1"');
    expect(byType.get("quote")).toContain('id="quote-container"');
    expect(byType.get("quote")).toContain('id="side-image"');
    expect(byType.get("contact")).toContain('id="contact-card"');
    expect(byType.get("contact")).toContain('id="side-image"');
  });

  it("buildSvgArtifacts skips side-image layers when visuals are absent", () => {
    const deckPlan = makeSvgDeckPlan([
      { ...makeSvgSlide("quote"), id: "no-visual-1" },
      { ...makeSvgSlide("contact"), id: "no-visual-2" },
    ]);
    const artifacts = buildSvgArtifacts(deckPlan, []);

    expect(artifacts.map((a) => a.filename)).toEqual(["01_quote.svg", "02_contact.svg"]);
    expect(artifacts[0].svg).not.toContain('id="side-image"');
    expect(artifacts[1].svg).not.toContain('id="side-image"');
    expect(artifacts[0].svg).toContain('id="quote-container"');
    expect(artifacts[1].svg).toContain('id="contact-card"');
  });

  it("keeps stable hash snapshots for quote/contact key templates", () => {
    const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);
    const quoteSvg = renderQuoteSlide(makeSvgSlide("quote"), colors, 0, {
      slideId: "q",
      dataUri: tinyPngDataUri(),
      source: "fallback",
    });
    const contactSvg = renderContactSlide(makeSvgSlide("contact"), colors, 0, {
      slideId: "c",
      dataUri: tinyPngDataUri(),
      source: "fallback",
    });

    expect(svgStableHash(quoteSvg)).toBe(SVG_HASH_SNAPSHOTS.quote);
    expect(svgStableHash(contactSvg)).toBe(SVG_HASH_SNAPSHOTS.contact);
  });

  it("derives dark card colors when main palette color has low luminance", () => {
    const dark = slideColors(["0F172A", "334155", "3B82F6", "94A3B8", "0F172A"], 0);
    expect(dark.isDark).toBe(true);
    expect(dark.cardFill).toBe("#1a1a2e");
    expect(dark.cardStroke).toBe("#2a2a3e");

    const light = slideColors(["94A3B8", "3B82F6", "F59E0B", "64748B", "FFFFFF"], 0);
    expect(light.isDark).toBe(false);
    expect(light.cardFill).toBe("#ffffff");
    expect(light.cardStroke).toBe("#e2e8f0");
  });

  it("renders dark-themed slide with dark card backgrounds", () => {
    const darkColors = slideColors(["0F172A", "334155", "3B82F6", "94A3B8", "0F172A"], 0);
    const svg = renderComparisonSlide(makeSvgSlide("comparison"), darkColors, 0);
    expect(svg).toContain(`fill="${darkColors.cardFill}"`);
  });
});
