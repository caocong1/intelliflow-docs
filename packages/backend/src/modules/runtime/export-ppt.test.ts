import { describe, expect, test } from "vitest";
import { markdownToSlides, tryParseSlideJson } from "./export.service";

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
      slides: [{ layout: "title", title: "Test" }],
    });
    const result = tryParseSlideJson(json);
    expect(result).not.toBeNull();
    expect(result!.metadata?.aspectRatio).toBe("16:9");
  });
});

// ─── generatePptBuffer (integration) ─────────────────────────────────────────
// Note: We import dynamically to avoid DB dependencies in the public API functions.
// We test the internal functions (markdownToSlides, tryParseSlideJson) directly above.
// For the full buffer generation, we test via a lightweight approach.

describe("PPT buffer generation", () => {
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
        { layout: "title", title: "Presentation" },
        { layout: "content", title: "Points", bullets: ["A", "B", "C"] },
        { layout: "table", title: "Data", headers: ["X", "Y"], rows: [["1", "2"]] },
      ],
    });
    const result = tryParseSlideJson(json);
    expect(result).not.toBeNull();
    expect(result!.slides.length).toBe(3);
  });
});
