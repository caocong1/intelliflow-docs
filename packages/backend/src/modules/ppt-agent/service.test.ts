import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { extractJsonObject, validateDeckPlan } from "./deck-plan-schema";
import { MiniMaxClient } from "./minimax-client";
import { createMemoryPptAgentRepository, createPptAgentService } from "./service";
import type { DeckPlan, PptAiClient } from "./types";

const tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((dir) => rm(dir, { recursive: true, force: true })));
  tmpRoots.length = 0;
});

describe("ppt-agent", () => {
  it("returns a clear missing-env error without leaking secrets", async () => {
    const client = new MiniMaxClient({ apiKey: "" });

    expect(() => client.assertReady()).toThrow("MINIMAX_API_KEY 环境变量未配置");
    expect(() => client.assertReady()).not.toThrow(/sk-|Bearer|key-/i);
  });

  it("runs a complete job with a fake MiniMax client", async () => {
    const root = await tempRoot();
    const repository = createMemoryPptAgentRepository();
    const client = new FakeMiniMaxClient();
    const service = createPptAgentService({ repository, client, workspaceRoot: root });
    const job = await repository.createJob({ userId: "user-1", prompt: "知识中台建设方案" });

    const completed = await service.runJob(job.id, "user-1", {
      prompt: "知识中台建设方案",
      slideCount: 12,
      style: "formal consulting",
    });

    expect(completed.status).toBe("completed");
    expect(completed.deckPlan?.slides).toHaveLength(12);
    expect(
      new Set(completed.deckPlan?.slides.map((slide) => slide.pageType)).size,
    ).toBeGreaterThanOrEqual(8);
    expect(completed.resultStoragePath).toMatch(/\.pptx$/);
  });

  it("retries once when deck plan validation fails", async () => {
    const root = await tempRoot();
    const repository = createMemoryPptAgentRepository();
    const client = new FakeMiniMaxClient({ invalidFirstPlan: true });
    const service = createPptAgentService({ repository, client, workspaceRoot: root });
    const job = await repository.createJob({ userId: "user-1", prompt: "知识中台建设方案" });

    const completed = await service.runJob(job.id, "user-1", {
      prompt: "知识中台建设方案",
      slideCount: 12,
      style: "auto",
    });

    expect(completed.status).toBe("completed");
    expect(client.planCalls).toBe(2);
  });

  it("falls back to a valid deterministic DeckPlan after two invalid model plans", async () => {
    const root = await tempRoot();
    const repository = createMemoryPptAgentRepository();
    const client = new FakeMiniMaxClient({ alwaysInvalidPlan: true, failImages: true });
    const service = createPptAgentService({ repository, client, workspaceRoot: root });
    const job = await repository.createJob({ userId: "user-1", prompt: "知识中台建设方案" });

    const completed = await service.runJob(job.id, "user-1", {
      prompt: "知识中台建设方案",
      slideCount: 12,
      style: "auto",
    });

    expect(completed.status).toBe("completed");
    expect(completed.deckPlan?.slides).toHaveLength(12);
    expect(completed.warnings.some((warning) => warning.includes("保底方案"))).toBe(true);
  });

  it("keeps the original valid plan when critic rewrite is invalid", async () => {
    const root = await tempRoot();
    const repository = createMemoryPptAgentRepository();
    const client = new FakeMiniMaxClient({ blueGrayPlan: true, invalidRewrite: true });
    const service = createPptAgentService({ repository, client, workspaceRoot: root });
    const job = await repository.createJob({ userId: "user-1", prompt: "知识中台建设方案" });

    const completed = await service.runJob(job.id, "user-1", {
      prompt: "知识中台建设方案",
      slideCount: 12,
      style: "auto",
    });

    expect(completed.status).toBe("completed");
    expect(completed.warnings.some((warning) => warning.includes("重写未通过结构校验"))).toBe(true);
  });

  it("keeps the current plan when critic rewrite throws", async () => {
    const root = await tempRoot();
    const repository = createMemoryPptAgentRepository();
    const client = new FakeMiniMaxClient({
      blueGrayPlan: true,
      throwRewrite: true,
      failImages: true,
    });
    const service = createPptAgentService({ repository, client, workspaceRoot: root });
    const job = await repository.createJob({ userId: "user-1", prompt: "知识中台建设方案" });

    const completed = await service.runJob(job.id, "user-1", {
      prompt: "知识中台建设方案",
      slideCount: 12,
      style: "auto",
    });

    expect(completed.status).toBe("completed");
    expect(completed.warnings.some((warning) => warning.includes("重写失败"))).toBe(true);
  });

  it("validates 12-slide plans require at least 8 page types", () => {
    const result = validateDeckPlan(makeDeckPlan(), 12);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        new Set(result.deckPlan.slides.map((slide) => slide.pageType)).size,
      ).toBeGreaterThanOrEqual(8);
    }
  });

  it("extracts JSON after MiniMax reasoning blocks", () => {
    const parsed = extractJsonObject('<think>{"draft": false}</think>\n\n{"ok":true}');

    expect(parsed).toEqual({ ok: true });
  });

  it("falls back to balanced JSON scanning when fenced JSON is malformed", () => {
    const parsed = extractJsonObject('```json\n{"broken": true\n```\n\n{"ok":true}');

    expect(parsed).toEqual({ ok: true });
  });

  it("normalizes MiniMax nullable optional fields and localized density", () => {
    const raw = makeDeckPlan() as unknown as {
      slides: Array<{ chart: null; table: null; timeline: null; contentDensity: string }>;
    };
    raw.slides[0].chart = null;
    raw.slides[0].table = null;
    raw.slides[0].timeline = null;
    raw.slides[0].contentDensity = "中等";
    (
      raw as unknown as { slides: Array<{ contentBlocks: Array<{ emphasis: string }> }> }
    ).slides[0].contentBlocks[0].emphasis = "重点";

    const result = validateDeckPlan(raw, 12);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deckPlan.slides[0].chart).toBeUndefined();
      expect(result.deckPlan.slides[0].contentDensity).toBe("medium");
      expect(result.deckPlan.slides[0].contentBlocks[0].emphasis).toBe("strong");
    }
  });

  it("unwraps common DeckPlan wrapper objects from model output", () => {
    const result = validateDeckPlan({ deckPlan: makeDeckPlan() }, 12);

    expect(result.ok).toBe(true);
  });

  it("falls back to local visuals and records warnings when image generation fails", async () => {
    const root = await tempRoot();
    const repository = createMemoryPptAgentRepository();
    const client = new FakeMiniMaxClient({ failImages: true });
    const service = createPptAgentService({ repository, client, workspaceRoot: root });
    const job = await repository.createJob({ userId: "user-1", prompt: "知识中台建设方案" });

    const completed = await service.runJob(job.id, "user-1", {
      prompt: "知识中台建设方案",
      slideCount: 12,
      style: "auto",
    });

    expect(completed.status).toBe("completed");
    expect(completed.warnings.some((warning) => warning.includes("fallback"))).toBe(true);
  });

  it("produces an unzip-readable PPTX with parseable XML and notes", async () => {
    const root = await tempRoot();
    const repository = createMemoryPptAgentRepository();
    const service = createPptAgentService({
      repository,
      client: new FakeMiniMaxClient({ failImages: true }),
      workspaceRoot: root,
    });
    const job = await repository.createJob({ userId: "user-1", prompt: "知识中台建设方案" });
    await service.runJob(job.id, "user-1", {
      prompt: "知识中台建设方案",
      slideCount: 12,
      style: "auto",
    });

    const download = await service.getDownload("user-1", job.id);
    const zip = await JSZip.loadAsync(download.buffer);
    const slides = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name),
    );
    const notes = Object.keys(zip.files).filter((name) =>
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name),
    );
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");

    expect(slides).toHaveLength(12);
    expect(notes.length).toBeGreaterThanOrEqual(12);
    expect(slideXml?.trim().startsWith("<?xml")).toBe(true);
  });

  it("does not allow downloading another user's completed job", async () => {
    const root = await tempRoot();
    const repository = createMemoryPptAgentRepository();
    const service = createPptAgentService({
      repository,
      client: new FakeMiniMaxClient({ failImages: true }),
      workspaceRoot: root,
    });
    const job = await repository.createJob({ userId: "user-1", prompt: "知识中台建设方案" });
    await service.runJob(job.id, "user-1", {
      prompt: "知识中台建设方案",
      slideCount: 12,
      style: "auto",
    });

    await expect(service.getDownload("user-2", job.id)).rejects.toThrow("PPT 生成任务不存在");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ppt-agent-test-"));
  tmpRoots.push(root);
  return root;
}

class FakeMiniMaxClient implements PptAiClient {
  planCalls = 0;
  private readonly invalidFirstPlan: boolean;
  private readonly alwaysInvalidPlan: boolean;
  private readonly invalidRewrite: boolean;
  private readonly throwRewrite: boolean;
  private readonly blueGrayPlan: boolean;
  private readonly failImages: boolean;

  constructor(
    options: {
      invalidFirstPlan?: boolean;
      alwaysInvalidPlan?: boolean;
      invalidRewrite?: boolean;
      throwRewrite?: boolean;
      blueGrayPlan?: boolean;
      failImages?: boolean;
    } = {},
  ) {
    this.invalidFirstPlan = options.invalidFirstPlan ?? false;
    this.alwaysInvalidPlan = options.alwaysInvalidPlan ?? false;
    this.invalidRewrite = options.invalidRewrite ?? false;
    this.throwRewrite = options.throwRewrite ?? false;
    this.blueGrayPlan = options.blueGrayPlan ?? false;
    this.failImages = options.failImages ?? false;
  }

  assertReady(): void {
    // fake client is always ready
  }

  async createDeckPlan(): Promise<unknown> {
    this.planCalls += 1;
    if (this.alwaysInvalidPlan) return { title: "bad", slides: [] };
    if (this.invalidFirstPlan && this.planCalls === 1) {
      return { title: "bad", slides: [] };
    }
    const plan = makeDeckPlan();
    if (this.blueGrayPlan) {
      plan.theme.palette = ["0F172A", "334155", "F1F5F9", "3B82F6"];
    }
    return plan;
  }

  async rewriteDeckPlan(): Promise<unknown> {
    if (this.throwRewrite) throw new Error("rewrite timeout");
    if (this.invalidRewrite) return { title: "bad" };
    return makeDeckPlan();
  }

  async generateImage(): Promise<string> {
    if (this.failImages) throw new Error("image quota exhausted");
    return tinyPngDataUri();
  }
}

function makeDeckPlan(): DeckPlan {
  const pageTypes: DeckPlan["slides"][number]["pageType"][] = [
    "cover",
    "agenda",
    "problem",
    "strategy",
    "architecture",
    "capability",
    "governance",
    "scenario",
    "timeline",
    "metrics",
    "risk",
    "closing",
  ];

  return {
    title: "AI 驱动的企业知识中台建设方案与落地路线图",
    subtitle: "面向集团管理层的立项汇报",
    audience: "CEO、CIO、业务负责人、信息化负责人和财务负责人",
    visualDirection: "正式商务、咨询公司风，使用深橄榄、铜色和米金形成稳重但不蓝白灰的视觉体系。",
    theme: {
      palette: ["3E4C3A", "A65F32", "E7D7B8", "243128"],
      mood: "正式、稳健、战略、可信",
      referenceKeywords: ["enterprise knowledge hub", "consulting deck", "executive boardroom"],
      visualMotif: "知识网络、治理环、路线图层级",
      paletteDominance: "深橄榄 65%，米金 20%，铜色 10%，深墨绿 5%",
    },
    slides: pageTypes.map((pageType, index) => ({
      id: `slide-${index + 1}`,
      pageType,
      layoutPattern: `layout-${index + 1}`,
      title: slideTitle(pageType),
      subtitle: index === 0 ? "建设方案与落地路线图" : undefined,
      keyMessage: `第 ${index + 1} 页聚焦 ${slideTitle(pageType)} 的管理层决策要点。`,
      contentBlocks: [
        {
          heading: "核心判断",
          body: "以统一知识资产、流程嵌入和可衡量试点形成预算闭环。",
          emphasis: "strong",
        },
        {
          heading: "落地抓手",
          body: "围绕数据治理、知识服务、权限安全和场景运营建立分阶段交付。",
          emphasis: "normal",
        },
        {
          heading: "管理价值",
          body: "降低重复劳动，提升决策质量，并为集团级 AI 应用提供基础底座。",
          emphasis: "normal",
        },
      ],
      chart:
        pageType === "metrics"
          ? { title: "投入产出", labels: ["效率", "成本", "复用"], values: [35, 18, 62], unit: "%" }
          : undefined,
      timeline:
        pageType === "timeline"
          ? [
              { label: "试点", description: "选择高频知识场景验证价值", date: "Q1" },
              { label: "扩展", description: "纳入治理、安全和运营指标", date: "Q2" },
              { label: "推广", description: "集团级能力复用与预算闭环", date: "Q3" },
            ]
          : undefined,
      visualPrompt: "premium abstract enterprise knowledge network with layered governance rings",
      speakerNotes: `讲解第 ${index + 1} 页时，先说明管理层关注点，再连接预算、试点授权和风险治理。`,
      layoutIntent: "正文左对齐，保留左右 0.5 inch 安全边距，不使用标题下划线装饰。",
      contentDensity: "medium",
      visualHierarchy: "标题、关键判断、三条管理要点、右侧视觉元素。",
    })),
  };
}

function slideTitle(pageType: DeckPlan["slides"][number]["pageType"]): string {
  const map: Record<DeckPlan["slides"][number]["pageType"], string> = {
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
  };
  return map[pageType];
}

function tinyPngDataUri(): string {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lN5ksAAAAABJRU5ErkJggg==";
}
