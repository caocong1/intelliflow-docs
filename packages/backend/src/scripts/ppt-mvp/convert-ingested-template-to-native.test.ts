import { describe, expect, test } from "vitest";
import { convertIngestedTemplateToNative } from "./convert-ingested-template-to-native";
import { validateNativeTemplate } from "./native-template-schema";
import type { IngestedTemplateDescriptor } from "./types";

function makeDescriptor(overrides?: Partial<IngestedTemplateDescriptor>): IngestedTemplateDescriptor {
  return {
    template_id: "sample_ingested_template",
    source_file: "/tmp/sample/template.json",
    source_basename: "sample-template.pptx",
    ingested_at: "2026-04-18T00:00:00.000Z",
    design_tokens: {
      color_palette: {
        primary: "#4472C4",
        secondary: "#ED7D31",
        accent: ["#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"],
        neutral: ["#000000", "#44546A", "#FFFFFF", "#E7E6E6"],
        link: "#0563C1",
        followed_link: "#954F72",
        raw_scheme: {},
        override_scheme: null,
        direct_palette_top10: [
          { color: "#FFFFFF", uses: 100 },
          { color: "#4ADE80", uses: 90 },
          { color: "#1F2937", uses: 60 },
          { color: "#6B7280", uses: 40 },
        ],
      },
      typography: {
        title_font_latin: "Arial",
        body_font_latin: "Arial",
        title_font_ea: null,
        body_font_ea: null,
        additional_fonts: ["Arial"],
      },
      layout_rhythm: {
        page_count: 16,
        layout_count: 10,
        avg_text_density: "low",
        page_xml_size_distribution: {
          min: 5000,
          max: 45000,
          median: 24000,
        },
      },
    },
    layouts_extracted: [
      { fileName: "slideLayout1.xml", layoutType: "title", matchingName: "标题", placeholderTypes: ["title"], shapeCount: 4 },
      { fileName: "slideLayout2.xml", layoutType: "twoTxTwoObj", matchingName: "比较", placeholderTypes: ["title", "body", "body"], shapeCount: 8 },
      { fileName: "slideLayout3.xml", layoutType: "picTx", matchingName: "图片与标题", placeholderTypes: ["title", "pic", "body"], shapeCount: 6 },
    ],
    slide_examples: [
      {
        fileName: "slide1.xml",
        index: 1,
        shapeCount: 8,
        groupCount: 0,
        picCount: 1,
        textBoxCount: 3,
        hasChart: false,
        directColors: ["#4ADE80", "#1F2937"],
        rawSize: 18000,
      },
    ],
    asset_library: {
      media_count: 12,
      media_total_bytes: 1024 * 1024,
      images: [{ path: "ppt/media/image1.png", fileName: "image1.png", size: 12000, ext: "png", kind: "image" }],
      icons: [{ path: "ppt/media/icon1.svg", fileName: "icon1.svg", size: 3200, ext: "svg", kind: "icon" }],
      audio: [],
      other: [],
      has_charts: false,
      chart_count: 0,
    },
    ai_consumable_summary: "浅色科技感模板，含比较与图片页。",
    ...overrides,
  };
}

describe("ppt-mvp convert ingested template to native", () => {
  test("prefers direct palette when source theme looks like default office colors", () => {
    const nativeTemplate = convertIngestedTemplateToNative(makeDescriptor());

    expect(nativeTemplate.tokens.colors.primary).toBe("4ADE80");
    expect(nativeTemplate.tokens.colors.text).not.toBe("000000");
    expect(nativeTemplate.layoutBindings).toEqual([]);
    expect(validateNativeTemplate(nativeTemplate).valid).toBe(true);
  });

  test("trusts override palette when source template has an explicit theme override", () => {
    const descriptor = makeDescriptor({
      design_tokens: {
        ...makeDescriptor().design_tokens,
        color_palette: {
          ...makeDescriptor().design_tokens.color_palette,
          primary: "#16A1C8",
          secondary: "#09947F",
          override_scheme: {
            accent1: "#16A1C8",
            accent2: "#09947F",
          },
          direct_palette_top10: [
            { color: "#FFFFFF", uses: 50 },
            { color: "#91CF50", uses: 40 },
            { color: "#2A5BAA", uses: 39 },
            { color: "#000000", uses: 30 },
          ],
        },
      },
    });

    const nativeTemplate = convertIngestedTemplateToNative(descriptor, {
      templateJsonPath: "/tmp/ppt-research/ingest-out/sample/template.json",
    });

    expect(nativeTemplate.tokens.colors.primary).toBe("16A1C8");
    expect(nativeTemplate.tokens.colors.accent).toBe("09947F");
    expect(nativeTemplate.source.kind).toBe("ingested_template");
    if (nativeTemplate.source.kind === "ingested_template") {
      expect(nativeTemplate.source.templateJsonPath).toBe("/tmp/ppt-research/ingest-out/sample/template.json");
    }
    expect(validateNativeTemplate(nativeTemplate).valid).toBe(true);
  });

  test("embeds selected layout bindings when extracted presets are provided", () => {
    const nativeTemplate = convertIngestedTemplateToNative(makeDescriptor(), {
      layoutExtraction: {
        version: "template_layout_presets/v1",
        pptxPath: "/tmp/source.pptx",
        slideSize: { cx: 12192000, cy: 6858000 },
        extractedAt: "2026-04-18T00:00:00.000Z",
        presets: [
          {
            slideIndex: 1,
            slidePath: "ppt/slides/slide1.xml",
            layoutPath: "ppt/slideLayouts/slideLayout7.xml",
            layoutType: "blank",
            layoutName: "空白",
            candidateRole: "cover_candidate",
            shapeCount: 2,
            imageCount: 1,
            textCount: 1,
            shapes: [
              { id: 1, kind: "image", name: "cover", x: 0, y: 0, w: 100, h: 100, mediaTarget: "../media/image1.jpg" },
              { id: 2, kind: "text", name: "title", x: 10, y: 10, w: 50, h: 20, textSample: "部门复盘总结" },
            ],
          },
          {
            slideIndex: 2,
            slidePath: "ppt/slides/slide2.xml",
            layoutPath: "ppt/slideLayouts/slideLayout7.xml",
            layoutType: "blank",
            layoutName: "空白",
            candidateRole: "toc_candidate",
            shapeCount: 2,
            imageCount: 0,
            textCount: 2,
            shapes: [
              { id: 3, kind: "text", name: "toc-zh", x: 10, y: 10, w: 40, h: 20, textSample: "目 录" },
              { id: 4, kind: "text", name: "toc-en", x: 20, y: 20, w: 20, h: 20, textSample: "contents" },
            ],
          },
        ],
      },
    });

    expect(nativeTemplate.layoutBindings).toHaveLength(1);
    expect(["cover_hero_image", "toc_card_grid_8"]).toContain(nativeTemplate.layoutBindings[0]?.variantId);
    expect(validateNativeTemplate(nativeTemplate).valid).toBe(true);
  });
});
