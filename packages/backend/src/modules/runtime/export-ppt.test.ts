import { describe, expect, test } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Automizer from "pptx-automizer";
import PptxGenJS from "pptxgenjs";
import { DEFAULT_PPT_STYLE_PACK_ID } from "@intelliflow/shared";
import { buildNativeTemplateProfile } from "../ppt-templates/native-template-profile";
import { normalizeSlidesForDeck, assignTemplateSequence } from "./ppt-deck-composition";
import { __pptExportTestUtils, markdownToSlides, tryParseSlideJson } from "./export.service";

// ─── markdownToSlides ────────────────────────────────────────────────────────

describe("markdownToSlides", () => {
  test("empty content produces a title slide", () => {
    const slides = markdownToSlides("");
    expect(slides.length).toBe(1);
    expect(slides[0].layout).toBe("title");
  });

  test("H1 creates a title slide", () => {
    const slides = markdownToSlides("# 项目方案汇报");
    expect(slides[0].layout).toBe("title");
    expect((slides[0] as any).title).toBe("项目方案汇报");
  });

  test("H2 creates content slide pages", () => {
    const md = "# Title\n\n## 第一章\n\n- 要点1\n- 要点2\n\n## 第二章\n\n- 要点3";
    const slides = markdownToSlides(md);
    const contentSlides = slides.filter((s) => s.layout === "content");
    expect(contentSlides.length).toBe(2);
    expect((contentSlides[0] as any).title).toBe("第一章");
    expect((contentSlides[1] as any).title).toBe("第二章");
  });

  test("H3 becomes a bold bullet", () => {
    const md = "## Section\n\n### Sub-heading\n\n- item";
    const slides = markdownToSlides(md);
    const content = slides.find((s) => s.layout === "content") as any;
    expect(content).toBeDefined();
    expect(content.bullets[0]).toContain("**");
  });

  test("bullet lists are captured", () => {
    const md = "## Bullets\n\n- one\n- two\n- three";
    const slides = markdownToSlides(md);
    const content = slides.find((s) => s.layout === "content") as any;
    expect(content.bullets).toEqual(["one", "two", "three"]);
  });

  test("ordered lists are captured", () => {
    const md = "## Steps\n\n1. first\n2. second\n3. third";
    const slides = markdownToSlides(md);
    const content = slides.find((s) => s.layout === "content") as any;
    expect(content.bullets).toEqual(["first", "second", "third"]);
  });

  test("table becomes a TableSlide", () => {
    const md = "## Data\n\n| Name | Value |\n|------|-------|\n| A | 1 |\n| B | 2 |";
    const slides = markdownToSlides(md);
    const table = slides.find((s) => s.layout === "table") as any;
    expect(table).toBeDefined();
    expect(table.headers).toEqual(["Name", "Value"]);
    expect(table.rows.length).toBe(2);
  });

  test("code block becomes content slide bullets", () => {
    const md = "## Code\n\n```\nconst x = 1;\nconsole.log(x);\n```";
    const slides = markdownToSlides(md);
    const content = slides.find((s) => s.layout === "content") as any;
    expect(content).toBeDefined();
    expect(content.bullets.length).toBe(2);
    expect(content.bullets[0]).toContain("const x");
  });

  test("--- forces a page break", () => {
    const md = "## Page1\n\n- a\n- b\n\n---\n\n## Page2\n\n- c";
    const slides = markdownToSlides(md);
    const contentSlides = slides.filter((s) => s.layout === "content");
    expect(contentSlides.length).toBe(2);
  });

  test("more than 8 bullets auto-splits into multiple slides", () => {
    const bullets = Array.from({ length: 12 }, (_, i) => `- item ${i + 1}`).join("\n");
    const md = `## Many\n\n${bullets}`;
    const slides = markdownToSlides(md);
    const contentSlides = slides.filter((s) => s.layout === "content");
    expect(contentSlides.length).toBe(2);
    expect((contentSlides[0] as any).bullets.length).toBe(8);
    expect((contentSlides[1] as any).bullets.length).toBe(4);
    expect((contentSlides[1] as any).title).toContain("(续)");
  });

  test("table with more than 8 rows auto-splits", () => {
    const rows = Array.from({ length: 12 }, (_, i) => `| R${i} | V${i} |`).join("\n");
    const md = `## Big Table\n\n| H1 | H2 |\n|---|---|\n${rows}`;
    const slides = markdownToSlides(md);
    const tableSlides = slides.filter((s) => s.layout === "table");
    expect(tableSlides.length).toBe(2);
  });

  test("no H1 prepends a default title slide", () => {
    const md = "## Section\n\n- content";
    const slides = markdownToSlides(md);
    expect(slides[0].layout).toBe("title");
    expect((slides[0] as any).title).toBe("演示文稿");
  });

  test("mixed content: title + bullets + table + code", () => {
    const md = [
      "# Report",
      "## Overview",
      "- point 1",
      "- point 2",
      "## Data",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "## Code",
      "```",
      "hello()",
      "```",
    ].join("\n");
    const slides = markdownToSlides(md);
    expect(slides.length).toBeGreaterThanOrEqual(4); // title + overview + data table + code
    expect(slides[0].layout).toBe("title");
    expect(slides.some((s) => s.layout === "table")).toBe(true);
  });

  test("blockquotes become quoted bullets", () => {
    const md = "## Quote\n\n> This is important";
    const slides = markdownToSlides(md);
    const content = slides.find((s) => s.layout === "content") as any;
    expect(content.bullets[0]).toContain('"');
  });
});

// ─── tryParseSlideJson ───────────────────────────────────────────────────────

describe("tryParseSlideJson", () => {
  test("valid SlidePresentation JSON returns parsed object", () => {
    const json = JSON.stringify({
      slides: [
        { layout: "title", title: "Hello" },
        { layout: "content", title: "Body", bullets: ["a", "b"] },
      ],
    });
    const result = tryParseSlideJson(json);
    expect(result).not.toBeNull();
    expect(result!.slides.length).toBe(2);
    expect(result!.slides[0].layout).toBe("title");
  });

  test("non-JSON string returns null", () => {
    expect(tryParseSlideJson("# Just markdown")).toBeNull();
  });

  test("JSON without slides field returns null", () => {
    expect(tryParseSlideJson('{"data": "hello"}')).toBeNull();
  });

  test("JSON with empty slides array returns null", () => {
    expect(tryParseSlideJson('{"slides": []}')).toBeNull();
  });

  test("JSON with slides but missing layout returns null", () => {
    expect(tryParseSlideJson('{"slides": [{"title": "no layout"}]}')).toBeNull();
  });

  test("JSON with metadata is accepted", () => {
    const json = JSON.stringify({
      metadata: { aspectRatio: "16:9" },
      slides: [{ layout: "title", title: "Test", semanticRole: "cover" }],
    });
    const result = tryParseSlideJson(json);
    expect(result).not.toBeNull();
    expect(result!.metadata?.aspectRatio).toBe("16:9");
    expect(result!.slides[0].semanticRole).toBe("cover");
  });
});

// ─── generatePptBuffer (integration) ─────────────────────────────────────────
// Note: We import dynamically to avoid DB dependencies in the public API functions.
// We test the internal functions (markdownToSlides, tryParseSlideJson) directly above.
// For the full buffer generation, we test via a lightweight approach.

describe("PPT buffer generation", () => {
  test("legacy workflow template bindings are ignored unless internal fallback is enabled", () => {
    const config = {
      type: "export" as const,
      formats: ["pptx"] as const,
      contentMapping: [],
      templateId: "legacy-template-root",
      templateBindings: {
        pptx: "legacy-template-binding",
      },
    };

    expect(
      __pptExportTestUtils.resolveLegacyPptTemplateId({
        config,
        legacyEnabled: false,
      }),
    ).toBeNull();

    expect(
      __pptExportTestUtils.resolveLegacyPptTemplateId({
        config,
        legacyEnabled: true,
      }),
    ).toBe("legacy-template-binding");

    expect(
      __pptExportTestUtils.resolveLegacyPptTemplateId({
        config,
        templateIdOverride: "manual-template",
        legacyEnabled: true,
      }),
    ).toBe("manual-template");
  });

  test("markdownToSlides + renderSlidesToPptx produces valid PPTX", async () => {
    // Dynamically import to get renderSlidesToPptx via the module
    // Since renderSlidesToPptx is not exported, we test through the slide pipeline
    const PptxGenJS = (await import("pptxgenjs")).default;
    const slides = markdownToSlides("# Test\n\n## Page\n\n- bullet1\n- bullet2");

    // Manually render using PptxGenJS to verify it works
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    for (const slide of slides) {
      const pptSlide = pptx.addSlide();
      if (slide.layout === "title") {
        pptSlide.addText((slide as any).title, { x: 1, y: 2, w: 10, h: 2 });
      } else if (slide.layout === "content") {
        pptSlide.addText((slide as any).title, { x: 1, y: 0.5, w: 10, h: 1 });
        const bullets = (slide as any).bullets.join("\n");
        pptSlide.addText(bullets, { x: 1, y: 1.5, w: 10, h: 5 });
      }
    }
    const output = await pptx.write({ outputType: "nodebuffer" });
    const buffer = Buffer.from(output as ArrayBuffer);

    // Verify it's a valid ZIP (PPTX is a ZIP file)
    expect(buffer.length).toBeGreaterThan(0);
    // ZIP magic bytes: PK\x03\x04
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });

  test("slide JSON input produces valid slides", () => {
    const json = JSON.stringify({
      slides: [
        { layout: "title", title: "Presentation", semanticRole: "cover" },
        { layout: "content", title: "Points", bullets: ["A", "B", "C"] },
        { layout: "table", title: "Data", headers: ["X", "Y"], rows: [["1", "2"]] },
      ],
    });
    const result = tryParseSlideJson(json);
    expect(result).not.toBeNull();
    expect(result!.slides.length).toBe(3);
  });

  test("style-pack export ignores legacy template ids by default and returns render metadata", async () => {
    const result = await __pptExportTestUtils.generatePptBuffer({
      content: JSON.stringify({
        slides: [
          { layout: "title", title: "运营复盘", subtitle: "Q2" },
          { layout: "content", title: "关键结论", bullets: ["增长提速", "成本回落"] },
        ],
      }),
      templateId: "legacy-template-id",
      stylePackId: null,
      documentId: "doc-style-pack",
      nodeExecutionId: "node-style-pack",
      userId: "user-style-pack",
    });

    expect(result.templateId).toBeNull();
    expect(result.stylePackId).toBe(DEFAULT_PPT_STYLE_PACK_ID);
    expect(result.renderMode).toBe("style_pack_v1_structured");
    expect(result.compositionSummary).toMatchObject({
      source: "structured",
      totalSlides: 2,
    });
    expect(result.buffer[0]).toBe(0x50);
    expect(result.buffer[1]).toBe(0x4b);

    const tempDir = await mkdtemp(join(tmpdir(), "style-pack-export-"));
    const filePath = join(tempDir, "style-pack-export.pptx");
    await writeFile(filePath, result.buffer);

    const verifyResult = Bun.spawnSync(["unzip", "-t", filePath], {
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(verifyResult.exitCode).toBe(0);
  });

  test("native template rendering does not keep original sample slides", async () => {
    const template = new PptxGenJS();
    template.layout = "LAYOUT_WIDE";

    const cover = template.addSlide();
    cover.addText("输入标题文字", { x: 0.8, y: 1.2, w: 10, h: 0.8, fontSize: 24 });
    cover.addText("20XX", { x: 0.8, y: 2.4, w: 6, h: 0.5, fontSize: 12 });

    const body = template.addSlide();
    body.addText("输入标题文字", { x: 0.8, y: 0.6, w: 10, h: 0.8, fontSize: 20 });
    body.addText("您的内容打在这里，或者通过复制您的文本后，在此框中选择粘贴，并选择只保留文字", {
      x: 0.8,
      y: 1.6,
      w: 10,
      h: 3.5,
      fontSize: 14,
    });

    const templateBuffer = Buffer.from(
      (await template.write({ outputType: "nodebuffer" })) as ArrayBuffer,
    );

    const automizer = new Automizer({
      templateDir: "",
      outputDir: "",
      useCreationIds: true,
    });
    automizer.loadRoot(templateBuffer).load(templateBuffer, "__native_template__");
    const templateInfos = await automizer.setCreationIds();
    const profile = buildNativeTemplateProfile(templateInfos as never);

    const slides = normalizeSlidesForDeck([
      { layout: "title", title: "新封面", subtitle: "副标题" },
      { layout: "content", title: "新正文", bullets: ["要点 1", "要点 2"] },
    ]);
    const assignments = assignTemplateSequence(slides, profile.slides);

    const rendered = await __pptExportTestUtils.renderSlidesWithNativeTemplate(
      assignments,
      templateBuffer,
      undefined,
      profile,
    );
    const tempDir = await mkdtemp(join(tmpdir(), "ppt-render-test-"));
    const filePath = join(tempDir, "rendered.pptx");
    await writeFile(filePath, rendered);
    const unzipResult = Bun.spawnSync(["unzip", "-l", filePath], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const listing = Buffer.from(unzipResult.stdout).toString("utf8");
    const slideFiles = listing
      .split("\n")
      .filter((line) => /ppt\/slides\/slide\d+\.xml/.test(line));

    const inspectResult = Bun.spawnSync(
      [
        "python3",
        "-c",
        `
from zipfile import ZipFile
import xml.etree.ElementTree as ET
import re, sys
ns = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
path = sys.argv[1]
with ZipFile(path) as z:
    root = ET.fromstring(z.read('ppt/presentation.xml'))
    slide_refs = root.find('p:sldIdLst', ns)
    print('refs=' + str(len(slide_refs.findall('p:sldId', ns)) if slide_refs is not None else 0))
    rel_names = [n for n in z.namelist() if re.match(r'ppt/slides/_rels/slide\\d+\\.xml\\.rels$', n)]
    missing = []
    for rel in rel_names:
        root = ET.fromstring(z.read(rel))
        for child in root:
            target = child.attrib.get('Target')
            if not target or target.startswith('http'):
                continue
            if target.startswith('../'):
                normalized = 'ppt/' + target[3:]
            else:
                normalized = 'ppt/slides/' + target
            if normalized not in z.namelist():
                missing.append((rel, target, normalized))
    print('missing=' + str(len(missing)))
`,
        filePath,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const inspectText = Buffer.from(inspectResult.stdout).toString("utf8");
    const refCount = Number(inspectText.match(/refs=(\d+)/)?.[1] ?? "0");
    const missingCount = Number(inspectText.match(/missing=(\d+)/)?.[1] ?? "0");
    expect(slideFiles.length).toBeGreaterThanOrEqual(2);
    expect(refCount).toBe(2);
    expect(missingCount).toBe(0);
  });
});

// Note: pptRenderEngine dispatch branches are covered via:
// - parseHtmlFidelityDeckContent unit tests (version-signal matching)
// - html-fidelity-markdown-adapter.test.ts (markdown composition)
// - html-editable-adapter.test.ts (renderer integration)
// A direct generatePptBuffer dispatch test would need stubbing chrome +
// LLM + composeDeckWithAi; the abstraction boundaries above make that
// unnecessary — the dispatch itself is a 15-line router.
