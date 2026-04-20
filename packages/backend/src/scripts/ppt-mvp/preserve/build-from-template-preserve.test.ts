import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildFromTemplatePreserve } from "./build-from-template-preserve";
import { ensureFixture } from "./fetch-template-fixture";
import { validateTemplateFillPlan } from "./template-fill-plan-schema";
import { validateTemplateSlotMap } from "./template-slot-map-schema";
import { verifyPptxRelationships } from "./verify-pptx-relationships";

const REPO_ROOT = resolve(__dirname, "../../../../../..");
const FILL_PLAN = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/templates/wireless-template-fill-plan.json",
);
const SLIDE1_SLOT_MAP = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide1.slot-map.json",
);
const SLIDE2_SLOT_MAP = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide2.slot-map.json",
);
const SLIDE17_SLOT_MAP = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide17.slot-map.json",
);
const SLIDE21_SLOT_MAP = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide21.slot-map.json",
);
const SLIDE22_SLOT_MAP = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide22.slot-map.json",
);
const SLIDE13_SLOT_MAP = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide13.slot-map.json",
);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function countShapesInSlide(pptxPath: string, slideXmlPath: string): Promise<number> {
  const { default: JSZip } = await import("jszip");
  const buf = readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file(slideXmlPath);
  if (!file) throw new Error(`slide xml not found: ${slideXmlPath}`);
  const xml = await file.async("string");
  const spCount = (xml.match(/<p:sp\b/g) ?? []).length;
  const picCount = (xml.match(/<p:pic\b/g) ?? []).length;
  const grpCount = (xml.match(/<p:grpSp\b/g) ?? []).length;
  return spCount + picCount + grpCount;
}

describe("preserve/schemas", () => {
  test("slide1 slot-map parses and all creationIds are non-empty", () => {
    const result = validateTemplateSlotMap(readJson(SLIDE1_SLOT_MAP));
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.data?.slideIndex).toBe(1);
    expect(result.data?.slots.length).toBeGreaterThanOrEqual(5);
    for (const slot of result.data?.slots ?? []) {
      expect(slot.selector.creationId).toMatch(/^[0-9A-F-]+$/);
      expect(slot.selector.name.length).toBeGreaterThan(0);
    }
  });

  test("slide2 slot-map parses and has TOC row-title slots", () => {
    const result = validateTemplateSlotMap(readJson(SLIDE2_SLOT_MAP));
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.data?.slideIndex).toBe(2);
    const slotIds = new Set(result.data?.slots.map((s) => s.slotId));
    for (const id of ["row_1_title", "row_2_title", "row_3_title", "row_4_title"]) {
      expect(slotIds.has(id), `missing ${id}`).toBe(true);
    }
  });

  test("slide21 slot-map parses and has row_4_cells timeline slots", () => {
    const result = validateTemplateSlotMap(readJson(SLIDE21_SLOT_MAP));
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.data?.slideIndex).toBe(21);
    expect(result.data?.topology).toBe("row_4_cells");
    const slotIds = new Set(result.data?.slots.map((s) => s.slotId));
    for (const id of ["section_title", "cell_1", "cell_2", "cell_3", "cell_4"]) {
      expect(slotIds.has(id), `missing ${id}`).toBe(true);
    }
  });

  test("slide13 slot-map parses and has row_3_cells device triptych slots", () => {
    const result = validateTemplateSlotMap(readJson(SLIDE13_SLOT_MAP));
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.data?.slideIndex).toBe(13);
    expect(result.data?.topology).toBe("row_3_cells");
    const slotIds = new Set(result.data?.slots.map((s) => s.slotId));
    for (const id of ["section_title", "cell_a", "cell_b", "cell_c"]) {
      expect(slotIds.has(id), `missing ${id}`).toBe(true);
    }
  });

  test("slide22 slot-map parses and has 4-step process slots (title+desc pairs)", () => {
    const result = validateTemplateSlotMap(readJson(SLIDE22_SLOT_MAP));
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.data?.slideIndex).toBe(22);
    const slotIds = new Set(result.data?.slots.map((s) => s.slotId));
    for (const id of ["section_title", "step_1_title", "step_1_desc", "step_2_title", "step_2_desc", "step_3_title", "step_3_desc", "step_4_title", "step_4_desc"]) {
      expect(slotIds.has(id), `missing ${id}`).toBe(true);
    }
  });

  test("slide17 slot-map parses and has 2x2 symmetric comparison slots", () => {
    const result = validateTemplateSlotMap(readJson(SLIDE17_SLOT_MAP));
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.data?.slideIndex).toBe(17);
    expect(result.data?.topology).toBe("grid_2x2_symmetric");
    const slotIds = new Set(result.data?.slots.map((s) => s.slotId));
    for (const id of [
      "section_title",
      "quad_tl_title",
      "quad_tr_title",
      "quad_bl_bullets",
      "quad_br_bullets",
    ]) {
      expect(slotIds.has(id), `missing ${id}`).toBe(true);
    }
  });

  test("wireless fill-plan parses and all cross-page references resolve", () => {
    const plan = validateTemplateFillPlan(readJson(FILL_PLAN));
    expect(plan.valid, JSON.stringify(plan.errors)).toBe(true);
    const slotMaps: Record<number, Set<string>> = {
      1: new Set(
        (validateTemplateSlotMap(readJson(SLIDE1_SLOT_MAP)).data?.slots ?? []).map((s) => s.slotId),
      ),
      2: new Set(
        (validateTemplateSlotMap(readJson(SLIDE2_SLOT_MAP)).data?.slots ?? []).map((s) => s.slotId),
      ),
      17: new Set(
        (validateTemplateSlotMap(readJson(SLIDE17_SLOT_MAP)).data?.slots ?? []).map((s) => s.slotId),
      ),
      21: new Set(
        (validateTemplateSlotMap(readJson(SLIDE21_SLOT_MAP)).data?.slots ?? []).map((s) => s.slotId),
      ),
      22: new Set(
        (validateTemplateSlotMap(readJson(SLIDE22_SLOT_MAP)).data?.slots ?? []).map((s) => s.slotId),
      ),
      13: new Set(
        (validateTemplateSlotMap(readJson(SLIDE13_SLOT_MAP)).data?.slots ?? []).map((s) => s.slotId),
      ),
    };
    if (!plan.data) throw new Error("schema should have parsed");
    for (const page of plan.data.pages) {
      const known = slotMaps[page.sourceSlideIndex];
      expect(known, `slot-map missing for slide ${page.sourceSlideIndex}`).toBeDefined();
      for (const a of page.slotAssignments) {
        expect(known.has(a.slotId), `missing slot ${a.slotId} on slide ${page.sourceSlideIndex}`).toBe(true);
      }
    }
  });
});

describe("preserve/build-from-template-preserve", () => {
  let tmpDir: string;
  let outPath: string;
  let templatePath: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "preserve-test-"));
    outPath = join(tmpDir, "p1.pptx");
    templatePath = ensureFixture("622eee2ab7e6e.pptx");
    // Default fill-plan is pre-compressed so no LLM rewrite triggers.
    // The `rewrite is reported` test below exercises the LLM path separately.
    await buildFromTemplatePreserve({
      fillPlanPath: FILL_PLAN,
      outPath,
      templateOverride: templatePath,
      strict: true,
    });
  }, 60000);

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("p1 (slide26): wireless cover text replacements", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = readFileSync(outPath);
    const zip = await JSZip.loadAsync(buf);
    const slide = await zip.file("ppt/slides/slide26.xml")?.async("string");
    expect(slide, "slide26.xml should exist").toBeDefined();
    expect(slide).toContain("无线网络科普");
    expect(slide).toContain("汇报：IT基建");
    expect(slide).toContain("WIRELESS NETWORK CONSTRUCTION GUIDE");
    expect(slide).toContain("场景选型 · 品牌选择 · 建设运维全指南");
    expect(slide).toContain("2026.04");
    expect(slide).not.toContain("部门复盘总结");
    expect(slide).not.toContain("日期： 20XX");
  });

  test("p2 (slide27): TOC 8→4 row titles", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = readFileSync(outPath);
    const zip = await JSZip.loadAsync(buf);
    const slide = await zip.file("ppt/slides/slide27.xml")?.async("string");
    expect(slide, "slide27.xml should exist").toBeDefined();
    // All 8 wireless TOC items present, compressed into 4 row slots.
    for (const expected of [
      "核心优势对比",
      "技术发展历程",
      "标准建设流程",
      "主流设备解析",
      "品牌选型对比",
      "全场景选型指南",
      "优化与运维要点",
      "常见问题答疑",
    ]) {
      expect(slide).toContain(expected);
    }
    // Template row numbers preserved (not replaced).
    for (const n of ["01", "02", "03", "04"]) {
      expect(slide).toContain(n);
    }
    // Note: slide 15 has "存在不足之处" as its section title; both slides
    // (27 = p2, 28 = p3) may share that phrase transiently. We check p2
    // only drops its own placeholders.
    expect(slide).not.toContain("部门 工作概述");
    expect(slide).not.toContain("工作成果展示");
    expect(slide).not.toContain("未来工作规划");
  });

  test("p3 (slide28): 2x2 symmetric comparison (wireless vs wired, both sides)", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = readFileSync(outPath);
    const zip = await JSZip.loadAsync(buf);
    const slide = await zip.file("ppt/slides/slide28.xml")?.async("string");
    expect(slide, "slide28.xml should exist").toBeDefined();
    // Section title (pre-compressed in fill-plan).
    expect(slide).toContain("无线与有线网络核心对比");
    // LEFT side (wireless): title + 3 bullets.
    expect(slide).toContain("无线网络 · 核心优势");
    expect(slide).toContain("终端接入不受物理位置限制");
    expect(slide).toContain("无需大规模布线");
    expect(slide).toContain("扩容仅需新增 AP");
    // RIGHT side (wired): title + 3 bullets.
    expect(slide).toContain("有线网络 · 主要局限");
    expect(slide).toContain("终端依赖网口接入");
    expect(slide).toContain("布线改造成本高");
    expect(slide).toContain("IoT 与高并发扩容困难");
    // Original template placeholders removed.
    expect(slide).not.toContain("存在不足之处");
  });

  test("LLM rewrite path — over-budget value is reported in result.rewrites", async () => {
    // Author a fill-plan with intentionally over-budget content so the rewrite
    // path fires. This is orthogonal to the default fill-plan, which is
    // pre-compressed.
    const overBudgetPlanPath = join(tmpDir, "over-budget-plan.json");
    const slotMapDir = resolve(REPO_ROOT, "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e");
    writeFileSync(
      overBudgetPlanPath,
      JSON.stringify({
        version: "template_fill_plan/v1",
        templateId: "622eee2ab7e6e",
        templatePath: templatePath,
        slotMapDir,
        pages: [
          {
            pageId: "p1",
            sourceSlideIndex: 1,
            mode: "preserve",
            slotAssignments: [
              { slotId: "title", value: "无线网络建设科普方案" },
              { slotId: "eyebrow", value: "ANY" },
              { slotId: "body", paragraphs: [{ text: "body" }] },
              { slotId: "pill_1", value: "pill1" },
              { slotId: "pill_2", value: "pill2" },
            ],
          },
        ],
      }),
    );
    const result = await buildFromTemplatePreserve({
      fillPlanPath: overBudgetPlanPath,
      outPath: join(tmpDir, "p1-rewrite-check.pptx"),
      templateOverride: templatePath,
      slotMapDirOverride: slotMapDir,
      rewriteMocks: {
        title: JSON.stringify({ value: "无线建设方案" }),
      },
    });
    expect(result.rewrittenSlotCount).toBe(1);
    const titleRewrite = result.rewrites.find((r) => r.slotId === "title");
    expect(titleRewrite?.before).toBe("无线网络建设科普方案");
    expect(titleRewrite?.after).toBe("无线建设方案");
  });

  test("strict mode fails instead of rewriting on over-budget content", async () => {
    const overBudgetPlanPath = join(tmpDir, "strict-plan.json");
    const slotMapDir = resolve(REPO_ROOT, "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e");
    writeFileSync(
      overBudgetPlanPath,
      JSON.stringify({
        version: "template_fill_plan/v1",
        templateId: "622eee2ab7e6e",
        templatePath: templatePath,
        slotMapDir,
        pages: [
          {
            pageId: "p1",
            sourceSlideIndex: 1,
            mode: "preserve",
            slotAssignments: [
              { slotId: "title", value: "无线网络建设科普方案" },
              { slotId: "eyebrow", value: "X" },
              { slotId: "body", paragraphs: [{ text: "Y" }] },
              { slotId: "pill_1", value: "p1" },
              { slotId: "pill_2", value: "p2" },
            ],
          },
        ],
      }),
    );
    await expect(
      buildFromTemplatePreserve({
        fillPlanPath: overBudgetPlanPath,
        outPath: join(tmpDir, "strict.pptx"),
        templateOverride: templatePath,
        slotMapDirOverride: slotMapDir,
        strict: true,
      }),
    ).rejects.toThrow(/strict mode/);
  });

  test("rewrite that still exceeds budget eventually throws", async () => {
    const overBudgetPlanPath = join(tmpDir, "bad-rewrite-plan.json");
    const slotMapDir = resolve(REPO_ROOT, "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e");
    writeFileSync(
      overBudgetPlanPath,
      JSON.stringify({
        version: "template_fill_plan/v1",
        templateId: "622eee2ab7e6e",
        templatePath: templatePath,
        slotMapDir,
        pages: [
          {
            pageId: "p1",
            sourceSlideIndex: 1,
            mode: "preserve",
            slotAssignments: [
              { slotId: "title", value: "无线网络建设科普方案" },
              { slotId: "eyebrow", value: "X" },
              { slotId: "body", paragraphs: [{ text: "Y" }] },
              { slotId: "pill_1", value: "p1" },
              { slotId: "pill_2", value: "p2" },
            ],
          },
        ],
      }),
    );
    await expect(
      buildFromTemplatePreserve({
        fillPlanPath: overBudgetPlanPath,
        outPath: join(tmpDir, "bad-rewrite.pptx"),
        templateOverride: templatePath,
        slotMapDirOverride: slotMapDir,
        rewriteMocks: {
          title: JSON.stringify({ value: "这是一个依然非常长的标题超过限制" }),
        },
      }),
    ).rejects.toThrow(/LLM rewrite failed to fit/);
  });

  test("p4 (slide29): timeline row_4_cells with 4 eras", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = readFileSync(outPath);
    const zip = await JSZip.loadAsync(buf);
    const slide = await zip.file("ppt/slides/slide29.xml")?.async("string");
    expect(slide, "slide29.xml should exist").toBeDefined();
    expect(slide).toContain("无线网络技术发展历程");
    for (const era of ["1997", "2009·2014", "2019", "2024"]) {
      expect(slide).toContain(era);
    }
    for (const wifi of ["802.11 初代", "Wi-Fi 4/5", "Wi-Fi 6", "Wi-Fi 7"]) {
      expect(slide).toContain(wifi);
    }
    expect(slide).toContain("46Gbps 级体验");
    expect(slide).not.toContain("未来工作规划");
  });

  test("p5 (slide30): process 4-step (title + desc each)", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = readFileSync(outPath);
    const zip = await JSZip.loadAsync(buf);
    const slide = await zip.file("ppt/slides/slide30.xml")?.async("string");
    expect(slide, "slide30.xml should exist").toBeDefined();
    expect(slide).toContain("无线网络建设实施流程");
    for (const step of ["01 · 现场勘测", "02 · 方案设计", "03 · 设备部署", "04 · 调优验收"]) {
      expect(slide).toContain(step);
    }
    for (const desc of ["核对面积", "确定 AP 点位", "安装 AP、交换", "调优信道与功率"]) {
      expect(slide).toContain(desc);
    }
  });

  test("p6 (slide31): device triptych 3 cells", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = readFileSync(outPath);
    const zip = await JSZip.loadAsync(buf);
    const slide = await zip.file("ppt/slides/slide31.xml")?.async("string");
    expect(slide, "slide31.xml should exist").toBeDefined();
    expect(slide).toContain("主流 AP 形态与部署场景");
    for (const dev of ["面板 AP", "吸顶 AP", "室外 AP"]) {
      expect(slide).toContain(dev);
    }
    for (const scene of ["客房", "办公区", "园区"]) {
      expect(slide).toContain(scene);
    }
  });

  test("B-only: slide17 section_title has minFontPt=20 applied (sz=2000)", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = readFileSync(outPath);
    const zip = await JSZip.loadAsync(buf);
    const slide = await zip.file("ppt/slides/slide28.xml")?.async("string");
    expect(slide, "slide28.xml should exist").toBeDefined();
    // Find the shape containing the new section title. Iterative match.
    const blocks = [...(slide as string).matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)];
    const shape = blocks.find((b) => b[0].includes("无线与有线网络核心对比"));
    expect(shape, "section_title shape should contain title").toBeTruthy();
    const block = shape?.[0] ?? "";
    // minFontPt=20 → <a:rPr sz="2000"/>.
    const szMatches = [...block.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)];
    expect(szMatches.length).toBeGreaterThanOrEqual(1);
    for (const m of szMatches) {
      expect(m[1]).toBe("2000");
    }
  });

  test("shape count on generated slide equals template slide 1", async () => {
    const templateShapes = await countShapesInSlide(templatePath, "ppt/slides/slide1.xml");
    const outputShapes = await countShapesInSlide(outPath, "ppt/slides/slide26.xml");
    expect(outputShapes).toBe(templateShapes);
  });

  test("sldIdLst contains exactly the new slides (one per fill-plan page)", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = readFileSync(outPath);
    const zip = await JSZip.loadAsync(buf);
    const pres = await zip.file("ppt/presentation.xml")?.async("string");
    expect(pres).toBeDefined();
    const plan = validateTemplateFillPlan(readJson(FILL_PLAN));
    const expectedCount = plan.data?.pages.length ?? 0;
    const ids = [...(pres as string).matchAll(/<p:sldId\b[^/]*\/>/g)];
    expect(ids.length).toBe(expectedCount);
  });

  test("relationship integrity — every internal rel target resolves", async () => {
    const broken = await verifyPptxRelationships(outPath);
    expect(broken, JSON.stringify(broken)).toEqual([]);
  });

  test("fill-plan tripwire — unknown slotId must fail loudly", async () => {
    const badOut = join(tmpDir, "bad.pptx");
    const badPlanPath = join(tmpDir, "bad-plan.json");
    const slotMapDir = resolve(REPO_ROOT, "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e");
    const plan = readJson(FILL_PLAN) as {
      pages: Array<{ slotAssignments: Array<{ slotId: string; value?: string }> }>;
    };
    const mutated = JSON.parse(JSON.stringify(plan));
    mutated.pages[0].slotAssignments.push({ slotId: "nonexistent_slot", value: "x" });
    writeFileSync(badPlanPath, JSON.stringify(mutated));
    await expect(
      buildFromTemplatePreserve({
        fillPlanPath: badPlanPath,
        outPath: badOut,
        templateOverride: templatePath,
        slotMapDirOverride: slotMapDir,
      }),
    ).rejects.toThrow(/nonexistent_slot/);
  });
});

describe("preserve/co-location boundary", () => {
  test("preserve modules do not import from native-template or family modules", () => {
    const files = [
      "build-from-template-preserve.ts",
      "build-wireless-template-preserve.ts",
      "template-slot-map-schema.ts",
      "template-fill-plan-schema.ts",
      "verify-pptx-relationships.ts",
    ];
    for (const file of files) {
      const src = readFileSync(resolve(__dirname, file), "utf8");
      expect(src, `${file} must not import native-template modules`).not.toMatch(
        /from\s+["'][^"']*native-template/,
      );
      expect(src, `${file} must not import family-library`).not.toMatch(
        /from\s+["'][^"']*family-library/,
      );
      expect(src, `${file} must not import variant-library`).not.toMatch(
        /from\s+["'][^"']*variant-library/,
      );
    }
  });
});
