import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  buildVisualPremiumSceneContent,
  parseSlidePresentationContent,
  renderVisualPremiumPresentation,
} from "./ppt-visual-premium";
import { parsePptSceneContent } from "./ppt-scene";

const samplePresentation = {
  metadata: { aspectRatio: "16:9", language: "zh-CN" },
  slides: [
    {
      layout: "title",
      semanticRole: "cover",
      title: "AI驱动的企业知识中台",
      subtitle: "建设方案与12个月落地路线图",
      notes: "开场说明项目背景。",
    },
    {
      layout: "content",
      semanticRole: "toc",
      title: "汇报议程",
      bullets: ["现状与问题", "目标价值", "建设方案", "落地路径"],
      notes: "建立听众预期。",
    },
    {
      layout: "two_column",
      semanticRole: "comparison",
      title: "知识资产分散导致效率损耗",
      left: { title: "当前状态", bullets: ["资料分散", "检索困难", "复用不足"] },
      right: { title: "目标状态", bullets: ["统一入口", "语义问答", "模板复用"] },
      notes: "突出改造前后差异。",
    },
    {
      layout: "table",
      semanticRole: "timeline",
      title: "12个月实施路线图",
      headers: ["阶段", "月份", "重点", "里程碑"],
      rows: [
        ["启动", "1-2", "范围盘点", "试点清单"],
        ["建设", "3-5", "平台能力", "MVP上线"],
      ],
      notes: "说明先试点再推广。",
    },
  ],
};

const executivePresentation = {
  metadata: { aspectRatio: "16:9", language: "zh-CN" },
  slides: [
    {
      layout: "title",
      semanticRole: "cover",
      title: "AI驱动的企业知识中台",
      subtitle: "建设方案与12个月落地路线图",
    },
    {
      layout: "content",
      semanticRole: "toc",
      title: "汇报议程",
      bullets: ["现状与问题", "目标价值", "建设方案", "落地路径", "投入与治理"],
    },
    {
      layout: "two_column",
      semanticRole: "comparison",
      title: "知识资产分散导致效率损耗",
      left: { title: "当前状态", bullets: ["资料散落", "检索困难", "复用不足"] },
      right: { title: "目标状态", bullets: ["统一入口", "智能问答", "模板复用"] },
    },
    {
      layout: "content",
      semanticRole: "bullet_list",
      title: "立项目标：把知识转化为业务生产力",
      bullets: ["统一知识入口", "沉淀行业方案", "缩短售前周期", "提升交付复用", "形成运营机制"],
    },
    {
      layout: "two_column",
      semanticRole: "comparison",
      title: "总体架构：三层能力闭环",
      left: { title: "能力输入", bullets: ["文档接入", "知识抽取", "权限继承"] },
      right: { title: "能力输出", bullets: ["语义检索", "智能问答", "文档生成"] },
    },
    {
      layout: "content",
      semanticRole: "bullet_list",
      title: "核心能力：从检索到自动产出",
      bullets: ["统一检索", "问答助手", "方案生成", "模板管理", "知识运营", "效果分析"],
    },
    {
      layout: "table",
      semanticRole: "table",
      title: "试点场景优先级",
      headers: ["场景", "价值", "数据", "优先级"],
      rows: [
        ["售前方案", "高", "中", "P0"],
        ["交付复盘", "高", "高", "P0"],
        ["客服知识", "中", "高", "P1"],
      ],
    },
    {
      layout: "table",
      semanticRole: "timeline",
      title: "12个月实施路线图",
      headers: ["阶段", "月份", "重点", "里程碑"],
      rows: [
        ["启动", "1-2", "盘点范围", "试点清单"],
        ["建设", "3-5", "平台能力", "MVP上线"],
        ["推广", "6-9", "场景复制", "三线试点"],
        ["运营", "10-12", "机制固化", "集团推广"],
      ],
    },
    {
      layout: "table",
      semanticRole: "table",
      title: "投入产出测算框架",
      headers: ["项目", "投入", "收益"],
      rows: [
        ["平台", "一次性", "复用能力"],
        ["数据治理", "持续", "检索效率"],
        ["运营", "持续", "方案产出"],
      ],
    },
    {
      layout: "content",
      semanticRole: "bullet_list",
      title: "治理与安全是上线前置条件",
      bullets: ["权限继承", "敏感信息识别", "内容审核", "日志追踪", "责任机制"],
    },
    {
      layout: "two_column",
      semanticRole: "summary",
      title: "决策建议：小步快跑，指标牵引",
      left: { title: "建议批准试点", bullets: ["先做高价值场景", "用指标验证价值"] },
      right: { title: "下一步", bullets: ["确定试点业务线", "确认预算边界", "建立治理小组", "设置复盘节奏"] },
    },
    {
      layout: "title",
      semanticRole: "closing",
      title: "以知识中台支撑AI规模化落地",
      subtitle: "从试点价值闭环走向集团级知识运营机制",
    },
  ],
};

describe("ppt-visual-premium", () => {
  test("parses SlidePresentation and converts it to a scene family", () => {
    const parsed = parseSlidePresentationContent(JSON.stringify(samplePresentation));
    expect(parsed).not.toBeNull();

    const content = buildVisualPremiumSceneContent(parsed!, "consulting_gray");
    const deck = parsePptSceneContent(content);
    expect(deck).not.toBeNull();
    expect(deck?.source).toBe("family");
    expect(deck?.slides).toHaveLength(4);
    expect(deck?.slides[0]?.pageType).toBe("cover_1_premium");
    expect(deck?.slides[2]?.pageType).toBe("comparison_3_premium");
  });

  test("routes executive decks through richer semantic templates", () => {
    const parsed = parseSlidePresentationContent(JSON.stringify(executivePresentation));
    expect(parsed).not.toBeNull();

    const content = buildVisualPremiumSceneContent(parsed!, "consulting_gray");
    const deck = parsePptSceneContent(content);
    const pageTypes = deck?.slides.map((slide) => slide.pageType) ?? [];

    expect(pageTypes).toHaveLength(12);
    expect(new Set(pageTypes).size).toBe(12);
    expect(content).toContain("capability-hero");
    expect(content).toContain("guardrail-left");
    expect(content).toContain("priority-rank");
    expect(content).toContain("timeline-axis");
    expect(content).toContain("finance-right");
    expect(content).toContain("decision-panel");
    expect(content).toContain("statement-band");
  });

  test("renders structured slides through the local visual premium renderer", async () => {
    const parsed = parseSlidePresentationContent(JSON.stringify(samplePresentation));
    expect(parsed).not.toBeNull();

    const result = await renderVisualPremiumPresentation(parsed!, "consulting_gray");
    expect(result.renderMode).toBe("scene_family_v1");
    expect(result.compositionSummary.totalSlides).toBe(4);
    expect(result.buffer[0]).toBe(0x50);
    expect(result.buffer[1]).toBe(0x4b);

    const tempDir = await mkdtemp(join(tmpdir(), "ppt-visual-premium-"));
    const filePath = join(tempDir, "visual-premium.pptx");
    await writeFile(filePath, result.buffer);

    const verifyResult = Bun.spawnSync(["unzip", "-t", filePath], {
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(verifyResult.exitCode).toBe(0);

    const tableSlideResult = Bun.spawnSync(["unzip", "-p", filePath, "ppt/slides/slide4.xml"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const tableSlideXml = new TextDecoder().decode(tableSlideResult.stdout);

    expect(tableSlideResult.exitCode).toBe(0);
    expect(tableSlideXml).not.toContain("<a:tbl");
    expect(tableSlideXml).not.toContain("outerShdw");
  });
});
