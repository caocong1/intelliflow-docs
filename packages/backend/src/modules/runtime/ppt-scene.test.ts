import { describe, expect, test } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildPptSceneDeckSummary,
  collectPptSceneAssetRefs,
  mergePptSceneAssetManifest,
  parsePptSceneContent,
  renderPptSceneDeckToBuffer,
} from "./ppt-scene";

describe("ppt-scene", () => {
  test("parses a single scene document", () => {
    const content = JSON.stringify({
      version: "ppt_scene/v1",
      theme: {
        palette: {
          bg: "#FFFFFF",
          text: "#111111",
          primary: "#D93829",
          border: "#DDDDDD",
        },
        fonts: {
          display: "Microsoft YaHei",
          heading: "Microsoft YaHei",
          body: "Microsoft YaHei",
        },
        textStyles: {
          display: {
            font: "display",
            size: 32,
            bold: true,
            color: "{palette.text}",
          },
        },
      },
      slides: [
        {
          id: "cover",
          background: { fill: "{palette.bg}" },
          elements: [
            {
              id: "title",
              type: "text",
              x: 100,
              y: 120,
              w: 600,
              h: 120,
              styleRef: "display",
              paragraphs: [
                {
                  runs: [{ text: "Hello Scene" }],
                },
              ],
            },
          ],
        },
      ],
    });

    const deck = parsePptSceneContent(content);
    expect(deck).not.toBeNull();
    expect(deck?.source).toBe("scene");
    expect(deck?.slides).toHaveLength(1);
    expect(deck?.slides[0]?.id).toBe("cover");
  });

  test("parses a family document and preserves pageType for summary counts", () => {
    const content = JSON.stringify({
      version: "ppt_scene_family/v1",
      pages: [
        {
          pageType: "cover_editorial",
          scene: {
            version: "ppt_scene/v1",
            slides: [{ id: "cover", elements: [] }],
          },
        },
        {
          pageType: "closing_statement",
          scene: {
            version: "ppt_scene/v1",
            slides: [{ id: "closing", elements: [] }],
          },
        },
      ],
    });

    const deck = parsePptSceneContent(content);
    expect(deck).not.toBeNull();
    expect(deck?.source).toBe("family");
    expect(deck?.slides).toHaveLength(2);

    const summary = buildPptSceneDeckSummary(deck!);
    expect(summary.totalSlides).toBe(2);
    expect(summary.semanticRoleCounts).toMatchObject({
      cover: 1,
      closing: 1,
    });
  });

  test("normalizes element-like entries accidentally placed directly inside slides[]", () => {
    const content = JSON.stringify({
      version: "ppt_scene/v1",
      theme: {
        palette: {
          bg: "#FFFFFF",
          text: "#111111",
        },
        fonts: {
          display: "Microsoft YaHei",
          heading: "Microsoft YaHei",
          body: "Microsoft YaHei",
        },
      },
      slides: [
        {
          id: "normal-slide",
          elements: [],
        },
        {
          id: "group_b3",
          type: "group",
          x: 100,
          y: 100,
          w: 200,
          h: 120,
          children: [
            {
              id: "card",
              type: "shape",
              shape: "rect",
              x: 0,
              y: 0,
              w: 200,
              h: 120,
              fill: "#F5F5F5",
            },
          ],
        },
      ],
    });

    const deck = parsePptSceneContent(content);
    expect(deck).not.toBeNull();
    expect(deck?.slides).toHaveLength(2);
    expect(deck?.slides[1]?.id).toBe("group_b3");
    expect(deck?.slides[1]?.elements).toHaveLength(1);
    expect(deck?.slides[1]?.elements[0]?.type).toBe("group");
  });

  test("collects asset refs and merges an external asset manifest", () => {
    const content = JSON.stringify({
      version: "ppt_scene_family/v1",
      pages: [
        {
          pageType: "image_focus_story",
          scene: {
            version: "ppt_scene/v1",
            assets: {
              local_only: {
                type: "image",
                src: "/tmp/local-only.png",
              },
            },
            slides: [
              {
                id: "image-slide",
                elements: [
                  {
                    id: "img-a",
                    type: "image",
                    assetRef: "hero",
                    x: 0,
                    y: 0,
                    w: 100,
                    h: 100,
                  },
                  {
                    id: "img-b",
                    type: "image",
                    assetRef: "local_only",
                    x: 0,
                    y: 120,
                    w: 100,
                    h: 100,
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    const deck = parsePptSceneContent(content);
    expect(deck).not.toBeNull();
    expect(collectPptSceneAssetRefs(deck!)).toEqual(["hero", "local_only"]);

    const merged = mergePptSceneAssetManifest(deck!, {
      hero: {
        type: "image",
        src: "/tmp/hero.png",
      },
    });

    expect(merged.slides[0]?.assets.hero?.src).toBe("/tmp/hero.png");
    expect(merged.slides[0]?.assets.local_only?.src).toBe("/tmp/local-only.png");
  });

  test("renders a scene deck to a valid pptx buffer", async () => {
    const content = JSON.stringify({
      version: "ppt_scene/v1",
      theme: {
        palette: {
          bg: "#F6F3EE",
          surface: "#FFFDF8",
          text: "#1E1B18",
          muted: "#6B645C",
          primary: "#B2452F",
          border: "#E7DED2",
        },
        fonts: {
          display: "Microsoft YaHei",
          heading: "Microsoft YaHei",
          body: "Microsoft YaHei",
          mono: "JetBrains Mono",
        },
        textStyles: {
          display: {
            font: "display",
            size: 30,
            bold: true,
            color: "{palette.text}",
          },
          body: {
            font: "body",
            size: 12,
            color: "{palette.text}",
          },
          eyebrow: {
            font: "mono",
            size: 10,
            bold: true,
            color: "{palette.primary}",
          },
        },
      },
      slides: [
        {
          id: "scene-slide",
          background: { fill: "{palette.bg}" },
          notes: "scene notes",
          elements: [
            {
              id: "frame",
              type: "shape",
              shape: "rect",
              x: 40,
              y: 40,
              w: 1520,
              h: 820,
              fill: "{palette.surface}",
              stroke: "{palette.border}",
              strokeWidth: 1,
            },
            {
              id: "headline",
              type: "text",
              x: 120,
              y: 100,
              w: 500,
              h: 80,
              styleRef: "display",
              paragraphs: [{ runs: [{ text: "Scene Renderer" }] }],
            },
            {
              id: "callout",
              type: "group",
              x: 120,
              y: 240,
              w: 500,
              h: 220,
              children: [
                {
                  id: "callout-box",
                  type: "shape",
                  shape: "roundRect",
                  x: 0,
                  y: 0,
                  w: 500,
                  h: 220,
                  fill: "{palette.bg}",
                  stroke: "{palette.border}",
                  strokeWidth: 1,
                },
                {
                  id: "callout-label",
                  type: "text",
                  x: 24,
                  y: 24,
                  w: 220,
                  h: 24,
                  styleRef: "eyebrow",
                  paragraphs: [{ runs: [{ text: "EDITORIAL CARD" }] }],
                },
                {
                  id: "callout-text",
                  type: "text",
                  x: 24,
                  y: 72,
                  w: 420,
                  h: 80,
                  styleRef: "body",
                  paragraphs: [{ runs: [{ text: "Scene-based rendering can now produce editable PPT slides." }] }],
                },
              ],
            },
            {
              id: "comparison-table",
              type: "table",
              x: 760,
              y: 140,
              w: 680,
              h: 340,
              columns: [180, 250, 250],
              header: [
                { text: "维度", fill: "{palette.primary}", color: "#FFFFFF" },
                { text: "旧链路", fill: "{palette.primary}", color: "#FFFFFF" },
                { text: "新链路", fill: "{palette.primary}", color: "#FFFFFF" },
              ],
              rows: [
                ["输入", "SlidePresentation", "ppt_scene/v1"],
                ["渲染", "archetype", "scene canvas"],
              ],
              cellStyle: {
                color: "{palette.text}",
                borderColor: "{palette.border}",
                borderWidth: 1,
              },
              stripe: {
                enabled: true,
                fill: "{palette.bg}",
              },
            },
            {
              id: "missing-image",
              type: "image",
              assetRef: "missing_asset",
              x: 760,
              y: 540,
              w: 340,
              h: 180,
              fit: "cover",
            },
          ],
        },
      ],
    });

    const deck = parsePptSceneContent(content);
    expect(deck).not.toBeNull();

    const result = await renderPptSceneDeckToBuffer(deck!);
    expect(result.renderMode).toBe("scene_canvas_v1");
    expect(result.compositionSummary.totalSlides).toBe(1);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.buffer[0]).toBe(0x50);
    expect(result.buffer[1]).toBe(0x4b);

    const tempDir = await mkdtemp(join(tmpdir(), "ppt-scene-render-"));
    const filePath = join(tempDir, "scene-rendered.pptx");
    await writeFile(filePath, result.buffer);

    const verifyResult = Bun.spawnSync(["unzip", "-t", filePath], {
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(verifyResult.exitCode).toBe(0);
  });

  test("renders mono+cjk text and zero-size line scenes without corrupting pptx", async () => {
    const content = JSON.stringify({
      version: "ppt_scene/v1",
      theme: {
        palette: {
          bg: "#111111",
          text: "#FFFFFF",
          primary: "#D93829",
          border: "#DDDDDD",
        },
        fonts: {
          display: "Microsoft YaHei",
          heading: "Microsoft YaHei",
          body: "Microsoft YaHei",
          mono: "JetBrains Mono",
        },
        textStyles: {
          eyebrow: {
            font: "mono",
            size: 12,
            bold: true,
            color: "{palette.primary}",
          },
          display: {
            font: "display",
            size: 42,
            bold: true,
            color: "{palette.text}",
          },
        },
      },
      slides: [
        {
          id: "repair-guard",
          background: { fill: "{palette.bg}" },
          elements: [
            {
              id: "mono-cjk",
              type: "text",
              x: 100,
              y: 100,
              w: 800,
              h: 80,
              styleRef: "eyebrow",
              paragraphs: [{ runs: [{ text: "CORE PHILOSOPHY // 核心建设理念" }] }],
            },
            {
              id: "line-h",
              type: "shape",
              shape: "line",
              x: 100,
              y: 220,
              w: 400,
              h: 0,
              stroke: "{palette.primary}",
              strokeWidth: 2,
            },
            {
              id: "line-v",
              type: "shape",
              shape: "line",
              x: 520,
              y: 220,
              w: 0,
              h: 200,
              stroke: "{palette.primary}",
              strokeWidth: 2,
            },
            {
              id: "headline",
              type: "text",
              x: 100,
              y: 300,
              w: 600,
              h: 140,
              styleRef: "display",
              paragraphs: [{ runs: [{ text: "系统能力。" }] }],
            },
          ],
        },
      ],
    });

    const deck = parsePptSceneContent(content);
    expect(deck).not.toBeNull();

    const result = await renderPptSceneDeckToBuffer(deck!);
    const tempDir = await mkdtemp(join(tmpdir(), "ppt-scene-repair-guard-"));
    const filePath = join(tempDir, "repair-guard.pptx");
    await writeFile(filePath, result.buffer);

    const verifyResult = Bun.spawnSync(["unzip", "-t", filePath], {
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(verifyResult.exitCode).toBe(0);
  });
});
