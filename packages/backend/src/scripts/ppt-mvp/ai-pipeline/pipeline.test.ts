import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { runPipeline } from "./pipeline";
import type { MockProvider } from "./pipeline";
import type { PageAssetMap } from "./types";
import type {
  PresentationOutline,
  MvpPageDefinition,
  VisualBrief,
} from "../types";

const FAKE_BRIEF: VisualBrief = {
  version: "visual_brief/v1",
  deckTone: "test_tone",
  colorMode: "test_color_mode",
  imageLanguage: "test_image",
  iconLanguage: "test_icon",
  shapeLanguage: "test_shape",
  density: "medium",
  avoid: [],
};

const OUTLINE: PresentationOutline = {
  version: "presentation_outline/v1",
  title: "Test Deck",
  audience: "Test audience",
  language: "zh-CN",
  sections: [{ id: "s1", title: "Section 1", intent: "comparison", priority: "high" }],
};

const PAGES: MvpPageDefinition[] = [
  {
    pageId: "p1",
    pageType: "cover",
    variantHint: "cover_hero_image",
    title: "Test Title",
    subtitle: "Test Subtitle",
    eyebrow: "TEST EYEBROW",
    audienceLine: "Test audience line",
    speakerNote: "Speaker note 1",
  },
  {
    pageId: "p2",
    pageType: "toc",
    variantHint: "toc_card_grid_8",
    title: "目录",
    eyebrow: "CONTENTS",
    items: [
      { index: "01", title: "Item 1", subtitle: "Sub 1" },
      { index: "02", title: "Item 2", subtitle: "Sub 2" },
    ],
    speakerNote: "Speaker note 2",
  },
];

const FAKE_GENES_JSON = JSON.stringify({
  version: "template_genes/v1",
  source: { kind: "brief", brief: { version: "visual_brief/v1" } },
  summary: "Test genes",
  designTokens: {
    colors: {
      primary: "#0E8B5A",
      secondary: "#0A6B45",
      accents: [],
      neutral: ["#FAFAF7", "#F1F5F2", "#0F1B17", "#6B7570"],
      bg: "#FAFAF7",
      surface: "#FFFFFF",
      text: "#0F1B17",
      textMuted: "#6B7570",
    },
    fonts: {
      titleLatin: "Source Han Serif SC",
      titleEa: "Source Han Serif SC",
      bodyLatin: "PingFang SC",
      bodyEa: "PingFang SC",
      mono: "JetBrains Mono",
    },
    rhythm: {
      density: "medium",
      pagePadding: { x: 88, y: 64 },
      preferredLayoutGrammar: "asymmetric_editorial",
    },
  },
});

const FAKE_STYLE_GENES_JSON = JSON.stringify({
  version: "style_genes/v1",
  colorDna: "test color dna",
  typographyDna: "test typography dna",
  shapeDna: "test shape dna",
  rhythmDna: "test rhythm dna",
});

const FAKE_CONSTITUTION_JSON = JSON.stringify({
  version: "global_constitution/v1",
  rules: ["Rule 1", "Rule 2"],
});

function fakeBrief(pageId: string, pageType: string): string {
  return JSON.stringify({
    version: "page_brief/v1",
    pageId,
    pageType,
    intent: "test intent",
    primaryFocal: "test focal",
    composition: "test composition",
    whatToAvoid: "test avoid",
    tone: "test tone",
  });
}

function fakeHtml(pageId: string): string {
  const page = PAGES.find((item) => item.pageId === pageId);
  const content = page ? collectExpectedText(page).join(" ") : pageId;
  return `<!DOCTYPE html>
<html><head><title>${pageId}</title></head>
<body><div class="slide"><div class="slide-inner"><h1>${content} ${"x".repeat(700)}</h1></div></div></body>
</html>`;
}

function fakeHtmlWithAsset(pageId: string, assetUrl: string): string {
  const page = PAGES.find((item) => item.pageId === pageId);
  const content = page ? collectExpectedText(page).join(" ") : pageId;
  return `<!DOCTYPE html>
<html><head><title>${pageId}</title></head>
<body>
  <div class="slide" style="background-image:url('${assetUrl}')">
    <div class="slide-inner">
      <img src="${assetUrl}" alt="">
      <h1>${content} ${"x".repeat(700)}</h1>
    </div>
  </div>
</body>
</html>`;
}

function fakeHtmlWithHiddenContent(pageId: string): string {
  const page = PAGES.find((item) => item.pageId === pageId);
  const content = page ? collectExpectedText(page).join(" ") : pageId;
  return `<!DOCTYPE html>
<html><head><title>${pageId}</title><style>.hidden{display:none}</style></head>
<body><div class="slide"><div class="slide-inner"><div class="hidden">should not be hidden</div><h1>${content} ${"x".repeat(700)}</h1></div></div></body>
</html>`;
}

function collectExpectedText(page: MvpPageDefinition): string[] {
  switch (page.pageType) {
    case "cover":
      return [page.title, page.subtitle, page.eyebrow, page.audienceLine];
    case "toc":
      return [page.title, page.eyebrow, ...page.items.flatMap((item) => [item.index, item.title, item.subtitle])];
    case "comparison":
      return [page.title, page.eyebrow, page.leftTitle, page.rightTitle, ...page.leftBullets, ...page.rightBullets];
    case "timeline":
      return [page.title, page.eyebrow, page.summary, ...page.nodes.flatMap((node) => [node.year, node.title, node.detail])];
    case "process":
      return [page.title, page.eyebrow, page.summary, ...page.steps.flatMap((step) => [step.index, step.title, step.detail])];
    case "device_overview":
      return [page.title, page.eyebrow, page.summary, ...page.devices.flatMap((device) => [device.name, device.scenario, device.note])];
    default:
      return [page.pageId];
  }
}

function buildAllSuccessProvider(): MockProvider {
  return (key) => {
    if (key === "layer0") return `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\``;
    if (key === "layer1") return `\`\`\`json\n${FAKE_STYLE_GENES_JSON}\n\`\`\``;
    if (key === "layer2") return `\`\`\`json\n${FAKE_CONSTITUTION_JSON}\n\`\`\``;
    if (key.startsWith("layer3:")) {
      const pageId = key.slice("layer3:".length);
      const page = PAGES.find((p) => p.pageId === pageId);
      if (!page) return undefined;
      return `\`\`\`json\n${fakeBrief(pageId, page.pageType)}\n\`\`\``;
    }
    if (key.startsWith("layer4:")) {
      const pageId = key.slice("layer4:".length).replace(/:retry$/, "");
      return `\`\`\`html\n${fakeHtml(pageId)}\n\`\`\``;
    }
    return undefined;
  };
}

describe("pipeline orchestrator", () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), "pipeline-test-"));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  test("emits all 5 artifacts when every layer succeeds", async () => {
    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: buildAllSuccessProvider(), forceMock: true },
    );

    expect(artifacts.templateGenes.summary).toBe("Test genes");
    expect(artifacts.styleGenes.colorDna).toBe("test color dna");
    expect(artifacts.globalConstitution.rules).toHaveLength(2);
    expect(artifacts.pageBriefs).toHaveLength(2);
    expect(artifacts.renderedPages).toHaveLength(2);

    expect(existsSync(join(sessionDir, "00-template-genes.json"))).toBe(true);
    expect(existsSync(join(sessionDir, "01-style-genes.json"))).toBe(true);
    expect(existsSync(join(sessionDir, "02-global-constitution.json"))).toBe(true);
    expect(existsSync(join(sessionDir, "03-page-briefs.json"))).toBe(true);
    expect(existsSync(join(sessionDir, "04-design-system.css"))).toBe(true);
    expect(existsSync(join(sessionDir, "pages", "p1.html"))).toBe(true);
    expect(existsSync(join(sessionDir, "pages", "p2.html"))).toBe(true);
    expect(existsSync(join(sessionDir, "pipeline.log.txt"))).toBe(true);
  });

  test("attaches speaker notes from page-plan to RenderedPage", async () => {
    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: buildAllSuccessProvider(), forceMock: true },
    );

    expect(artifacts.renderedPages[0].speakerNote).toBe("Speaker note 1");
    expect(artifacts.renderedPages[1].speakerNote).toBe("Speaker note 2");
  });

  test("retries Layer 4 once when first response fails validation, then succeeds", async () => {
    let p1Calls = 0;
    const provider: MockProvider = (key) => {
      if (key === "layer0") return `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\``;
      if (key === "layer1") return `\`\`\`json\n${FAKE_STYLE_GENES_JSON}\n\`\`\``;
      if (key === "layer2") return `\`\`\`json\n${FAKE_CONSTITUTION_JSON}\n\`\`\``;
      if (key.startsWith("layer3:")) {
        const pageId = key.slice("layer3:".length);
        const page = PAGES.find((p) => p.pageId === pageId);
        if (!page) return undefined;
        return `\`\`\`json\n${fakeBrief(pageId, page.pageType)}\n\`\`\``;
      }
      if (key === "layer4:p1") {
        p1Calls += 1;
        return "```html\n<too short>\n```";  // fails validation (no <body>, too short)
      }
      if (key === "layer4:p1:retry") {
        p1Calls += 1;
        return `\`\`\`html\n${fakeHtml("p1")}\n\`\`\``;
      }
      if (key === "layer4:p2") return `\`\`\`html\n${fakeHtml("p2")}\n\`\`\``;
      return undefined;
    };

    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: provider, forceMock: true },
    );

    expect(p1Calls).toBe(2);
    expect(artifacts.renderedPages[0].retryCount).toBe(1);
    expect(artifacts.renderedPages[1].retryCount).toBe(0);
  });

  test("falls back to placeholder HTML when both attempts fail", async () => {
    const provider: MockProvider = (key) => {
      if (key === "layer0") return `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\``;
      if (key === "layer1") return `\`\`\`json\n${FAKE_STYLE_GENES_JSON}\n\`\`\``;
      if (key === "layer2") return `\`\`\`json\n${FAKE_CONSTITUTION_JSON}\n\`\`\``;
      if (key.startsWith("layer3:")) {
        const pageId = key.slice("layer3:".length);
        const page = PAGES.find((p) => p.pageId === pageId);
        if (!page) return undefined;
        return `\`\`\`json\n${fakeBrief(pageId, page.pageType)}\n\`\`\``;
      }
      // Always return invalid html for both attempts
      if (key.startsWith("layer4:")) return "```html\n<x>\n```";
      return undefined;
    };

    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: provider, forceMock: true },
    );

    for (const rp of artifacts.renderedPages) {
      expect(rp.retryCount).toBe(2);
      const html = await readFile(rp.htmlPath, "utf8");
      expect(html).toContain("FALLBACK");
      expect(html).toContain("AI 生成失败");
    }
  });

  test("retries Layer 4 when required asset is missing from html, then succeeds", async () => {
    const assetUrl = "file:///tmp/hero-bg.png";
    const pageAssetMap: PageAssetMap = {
      p1: [
        {
          slot: "hero_bg",
          kind: "background_photo",
          path: "/tmp/hero-bg.png",
          fileUrl: assetUrl,
        },
      ],
    };
    let p1Calls = 0;
    const provider: MockProvider = (key) => {
      if (key === "layer0") return `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\``;
      if (key === "layer1") return `\`\`\`json\n${FAKE_STYLE_GENES_JSON}\n\`\`\``;
      if (key === "layer2") return `\`\`\`json\n${FAKE_CONSTITUTION_JSON}\n\`\`\``;
      if (key.startsWith("layer3:")) {
        const pageId = key.slice("layer3:".length);
        const page = PAGES.find((p) => p.pageId === pageId);
        if (!page) return undefined;
        return `\`\`\`json\n${fakeBrief(pageId, page.pageType)}\n\`\`\``;
      }
      if (key === "layer4:p1") {
        p1Calls += 1;
        return `\`\`\`html\n${fakeHtml("p1")}\n\`\`\``;
      }
      if (key === "layer4:p1:retry") {
        p1Calls += 1;
        return `\`\`\`html\n${fakeHtmlWithAsset("p1", assetUrl)}\n\`\`\``;
      }
      if (key === "layer4:p2") return `\`\`\`html\n${fakeHtml("p2")}\n\`\`\``;
      return undefined;
    };

    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        pageAssets: pageAssetMap,
        sessionDir,
      },
      { mockProvider: provider, forceMock: true },
    );

    expect(p1Calls).toBe(2);
    expect(artifacts.renderedPages[0].retryCount).toBe(1);
    const html = await readFile(artifacts.renderedPages[0].htmlPath, "utf8");
    expect(html).toContain(assetUrl);
  });

  test("fails validation when html hides content with display none", async () => {
    let p1Calls = 0;
    const provider: MockProvider = (key) => {
      if (key === "layer0") return `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\``;
      if (key === "layer1") return `\`\`\`json\n${FAKE_STYLE_GENES_JSON}\n\`\`\``;
      if (key === "layer2") return `\`\`\`json\n${FAKE_CONSTITUTION_JSON}\n\`\`\``;
      if (key.startsWith("layer3:")) {
        const pageId = key.slice("layer3:".length);
        const page = PAGES.find((p) => p.pageId === pageId);
        if (!page) return undefined;
        return `\`\`\`json\n${fakeBrief(pageId, page.pageType)}\n\`\`\``;
      }
      if (key === "layer4:p1") {
        p1Calls += 1;
        return `\`\`\`html\n${fakeHtmlWithHiddenContent("p1")}\n\`\`\``;
      }
      if (key === "layer4:p1:retry") {
        p1Calls += 1;
        return `\`\`\`html\n${fakeHtml("p1")}\n\`\`\``;
      }
      if (key === "layer4:p2") return `\`\`\`html\n${fakeHtml("p2")}\n\`\`\``;
      return undefined;
    };

    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: provider, forceMock: true },
    );

    expect(p1Calls).toBe(2);
    expect(artifacts.renderedPages[0].retryCount).toBe(1);
  });

  test("forceMock=true throws when provider returns undefined", async () => {
    const incompleteProvider: MockProvider = (key) =>
      key === "layer0" ? `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\`` : undefined;

    await expect(
      runPipeline(
        {
          outline: OUTLINE,
          pages: PAGES,
          layer0Source: { kind: "brief", brief: FAKE_BRIEF },
          sessionDir,
        },
        { mockProvider: incompleteProvider, forceMock: true },
      ),
    ).rejects.toThrow(/forceMock=true.*no response for key "layer1"/);
  });

  // ── Tier 2+3 regression coverage ──────────────────────────────────────

  test("emits 01b-spec-lock.json with deterministic palette + Windows font fallback", async () => {
    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: buildAllSuccessProvider(), forceMock: true },
    );

    expect(existsSync(join(sessionDir, "01b-spec-lock.json"))).toBe(true);
    expect(artifacts.specLock).toBeDefined();
    expect(artifacts.specLock.version).toBe("spec_lock/v1");
    // every distinct palette HEX from the genes lands in allValues
    expect(artifacts.specLock.palette.allValues).toContain("#0E8B5A");
    expect(artifacts.specLock.palette.allValues).toContain("#FAFAF7");
    // Windows fallback is appended to each font stack (NEVER-list #14)
    expect(artifacts.specLock.typography.titleStack).toContain('"Microsoft YaHei"');
    expect(artifacts.specLock.typography.bodyStack).toContain('"Microsoft YaHei"');
  });

  test("PipelineArtifacts.placeholderFallbackCount matches actual fallback emission", async () => {
    // Force BOTH pages to fall back (every layer4 mock returns invalid html)
    const provider: MockProvider = (key) => {
      if (key === "layer0") return `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\``;
      if (key === "layer1") return `\`\`\`json\n${FAKE_STYLE_GENES_JSON}\n\`\`\``;
      if (key === "layer2") return `\`\`\`json\n${FAKE_CONSTITUTION_JSON}\n\`\`\``;
      if (key.startsWith("layer3:")) {
        const pageId = key.slice("layer3:".length);
        const page = PAGES.find((p) => p.pageId === pageId);
        if (!page) return undefined;
        return `\`\`\`json\n${fakeBrief(pageId, page.pageType)}\n\`\`\``;
      }
      if (key.startsWith("layer4:")) return "```html\n<x>\n```";
      return undefined;
    };

    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: provider, forceMock: true },
    );

    expect(artifacts.placeholderFallbackCount).toBe(PAGES.length);
    for (const rp of artifacts.renderedPages) {
      expect(rp.fallback).toBe(true);
      expect(rp.retryCount).toBe(2);
    }
  });

  test("placeholderFallbackCount is 0 on a clean run", async () => {
    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: buildAllSuccessProvider(), forceMock: true },
    );
    expect(artifacts.placeholderFallbackCount).toBe(0);
    for (const rp of artifacts.renderedPages) {
      expect(rp.fallback).toBeFalsy();
    }
  });

  test("Layer 3 mock can supply visualElement + layoutArchetype, validateVisualElement enforces presence", async () => {
    // First attempt: brief asks for chart, html is text-only → fails missing_visual_element
    // Retry: html contains a <svg> → passes
    let p1Calls = 0;
    const provider: MockProvider = (key) => {
      if (key === "layer0") return `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\``;
      if (key === "layer1") return `\`\`\`json\n${FAKE_STYLE_GENES_JSON}\n\`\`\``;
      if (key === "layer2") return `\`\`\`json\n${FAKE_CONSTITUTION_JSON}\n\`\`\``;
      if (key === "layer3:p1") {
        return `\`\`\`json\n${JSON.stringify({
          version: "page_brief/v1",
          pageId: "p1",
          pageType: "cover",
          intent: "i",
          primaryFocal: "f",
          composition: "c",
          whatToAvoid: "w",
          tone: "t",
          visualElement: "chart",
          visualElementRequired: true,
          layoutArchetype: "centered-hero",
        })}\n\`\`\``;
      }
      if (key === "layer3:p2") {
        // p2 has no visualElement requirement so should not need retry
        return `\`\`\`json\n${fakeBrief("p2", "toc")}\n\`\`\``;
      }
      if (key === "layer4:p1") {
        p1Calls += 1;
        return `\`\`\`html\n${fakeHtml("p1")}\n\`\`\``; // no <svg> / <canvas> / .chart class
      }
      if (key === "layer4:p1:retry") {
        p1Calls += 1;
        const page = PAGES.find((p) => p.pageId === "p1");
        const content = page ? collectExpectedText(page).join(" ") : "p1";
        return `\`\`\`html
<!DOCTYPE html>
<html><body><div class="slide"><div class="slide-inner">
  <svg class="chart"><rect width="200" height="80"></rect></svg>
  <h1>${content} ${"x".repeat(700)}</h1>
</div></div></body></html>
\`\`\``;
      }
      if (key === "layer4:p2") return `\`\`\`html\n${fakeHtml("p2")}\n\`\`\``;
      return undefined;
    };

    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: provider, forceMock: true },
    );

    expect(p1Calls).toBe(2);
    expect(artifacts.renderedPages[0].retryCount).toBe(1);
    expect(artifacts.pageBriefs[0].visualElement).toBe("chart");
    expect(artifacts.pageBriefs[0].layoutArchetype).toBe("centered-hero");

    // confirm retried HTML contains the visual element
    const html = await readFile(artifacts.renderedPages[0].htmlPath, "utf8");
    expect(html).toContain("<svg");
  });

  test("visualElementRequired=false suppresses the missing_visual_element check", async () => {
    // Layer 3 declares visualElement: chart but visualElementRequired: false.
    // Layer 4 emits text-only HTML — should NOT retry.
    let p1Calls = 0;
    const provider: MockProvider = (key) => {
      if (key === "layer0") return `\`\`\`json\n${FAKE_GENES_JSON}\n\`\`\``;
      if (key === "layer1") return `\`\`\`json\n${FAKE_STYLE_GENES_JSON}\n\`\`\``;
      if (key === "layer2") return `\`\`\`json\n${FAKE_CONSTITUTION_JSON}\n\`\`\``;
      if (key === "layer3:p1") {
        return `\`\`\`json\n${JSON.stringify({
          version: "page_brief/v1",
          pageId: "p1",
          pageType: "cover",
          intent: "i",
          primaryFocal: "f",
          composition: "c",
          whatToAvoid: "w",
          tone: "t",
          visualElement: "chart",
          visualElementRequired: false,
          layoutArchetype: "centered-hero",
        })}\n\`\`\``;
      }
      if (key === "layer3:p2") return `\`\`\`json\n${fakeBrief("p2", "toc")}\n\`\`\``;
      if (key === "layer4:p1") {
        p1Calls += 1;
        return `\`\`\`html\n${fakeHtml("p1")}\n\`\`\``;
      }
      if (key === "layer4:p2") return `\`\`\`html\n${fakeHtml("p2")}\n\`\`\``;
      return undefined;
    };

    const artifacts = await runPipeline(
      {
        outline: OUTLINE,
        pages: PAGES,
        layer0Source: { kind: "brief", brief: FAKE_BRIEF },
        sessionDir,
      },
      { mockProvider: provider, forceMock: true },
    );

    expect(p1Calls).toBe(1); // no retry — visualElementRequired=false
    expect(artifacts.renderedPages[0].retryCount).toBe(0);
  });
});
