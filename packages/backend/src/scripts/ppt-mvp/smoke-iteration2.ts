#!/usr/bin/env bun
/**
 * Smoke test for Iteration 2 pipeline (Tier 1+2+3 changes).
 *
 * Stand-alone: does NOT depend on `/tmp/ppt-research/landppt-experiment/` —
 * supplies its own minimal Layer 4 HTML so we can verify end-to-end
 * (4 LLM mocks → spec_lock → render → visual QA → pptx pack) without
 * external fixtures.
 *
 * Run:
 *   CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *   bun packages/backend/src/scripts/ppt-mvp/smoke-iteration2.ts
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildFromPagePlan } from "./ai-pipeline/build-from-page-plan";
import type { MockProvider } from "./ai-pipeline/pipeline";
import type { PagePlan } from "./types";

const REPO_DOCS = new URL("../../../../../docs", import.meta.url).pathname;
const MVP_DOCS = join(REPO_DOCS, "design", "ppt-mvp");
const OUT_PPTX = "/tmp/intelliflow-smoke-iteration2.pptx";

// ─── canned mock JSON payloads ──────────────────────────────────────────────

const GENES = {
  version: "template_genes/v1",
  source: { kind: "brief", brief: { version: "visual_brief/v1" } },
  summary: "Clean editorial green palette for a B2B wireless-network primer deck.",
  designTokens: {
    colors: {
      primary: "#0E8B5A",
      secondary: "#0A6B45",
      accents: ["#DCEFE5", "#C56B2C"],
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
      pagePadding: { x: 96, y: 72 },
      preferredLayoutGrammar: "asymmetric_editorial",
    },
  },
} as const;

const STYLE_GENES = {
  version: "style_genes/v1",
  colorDna:
    "Anchor on Forest 0E8B5A as primary, never default to corporate blue. Use one accent only (warm clay C56B2C).",
  typographyDna:
    "Serif (Source Han Serif SC) for display sizes, sans (PingFang SC) for body. Title >= 2× body.",
  shapeDna:
    "Soft 8px-radius cards, 1px hairline borders, no drop shadows beyond elevation 1.",
  rhythmDna:
    "Asymmetric editorial; 12-column conceptual grid; 60-70% visual weight on dominant element.",
};

const CONSTITUTION = {
  version: "global_constitution/v1",
  rules: [
    "Use Forest 0E8B5A primary at ~60% visual weight; never default to blue.",
    "Maintain 4.5:1 body-text contrast minimum; no mid-gray on white.",
    "Body text >= 16pt; titles >= 36pt and >= 2× body.",
    "Never place an accent line under a title — hallmark of AI-generated slides.",
    "Use exactly one icon library across the deck; do not mix libraries.",
    "Every content slide must contain a non-text visual element.",
    "Maintain at least 0.5in of margin on all sides; no element bleeds the edge.",
    "Vary layout archetype between adjacent slides.",
  ],
};

// per-page brief with visualElement + layoutArchetype (Tier 2 schema)
function buildBrief(
  pageId: string,
  pageType: string,
  visualElement: string,
  archetype: string,
) {
  return {
    version: "page_brief/v1",
    pageId,
    pageType,
    intent: `Render the ${pageType} page for the wireless-network primer.`,
    primaryFocal: "Single dominant visual element occupying ~60% of the slide.",
    composition: "Left text column, right visual column; eyebrow strip on top.",
    whatToAvoid:
      "Generic AI-PPT aesthetics, centered titles with green underline, hero photo backgrounds with white-text overlay.",
    tone: "editorial / publication",
    visualElement,
    visualElementRequired: true,
    layoutArchetype: archetype,
  };
}

// ─── self-contained Layer 4 HTML (uses css var resolution and spec_lock palette) ──

function htmlFor(
  pageId: string,
  pageType: string,
  outlineTitle: string,
  page: PagePlan["pages"][number],
): string {
  // Pull primary content from the page-plan record so validateHtml's
  // findFirstMissingContent passes.
  switch (page.pageType) {
    case "cover":
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${page.title}</title>
<style>
  body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #0F1B17; background: #FAFAF7; }
  .slide { width: 1920px; height: 1080px; position: relative; overflow: hidden; }
  .slide-inner { padding: 96px 120px; height: 100%; box-sizing: border-box; display: grid; grid-template-columns: 1.2fr 1fr; gap: 72px; }
  .eyebrow { font-family: "JetBrains Mono", monospace; font-size: 16px; letter-spacing: 0.18em; color: #0E8B5A; text-transform: uppercase; }
  .title { font-family: "Source Han Serif SC", serif; font-size: 84px; line-height: 1.08; color: #0F1B17; margin-top: 48px; }
  .subtitle { font-size: 24px; line-height: 1.5; color: #0F1B17; margin-top: 32px; }
  .audience { font-size: 18px; color: #6B7570; margin-top: 48px; }
  .visual { background: #DCEFE5; border-radius: 12px; padding: 64px; display: flex; align-items: center; justify-content: center; }
  .visual svg { width: 100%; height: auto; }
</style>
</head>
<body>
  <div class="slide">
    <div class="slide-inner">
      <div>
        <div class="eyebrow">${page.eyebrow}</div>
        <h1 class="title">${page.title}</h1>
        <p class="subtitle">${page.subtitle}</p>
        <p class="audience">${page.audienceLine}</p>
      </div>
      <div class="visual">
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="200" cy="200" r="160" fill="none" stroke="#0E8B5A" stroke-width="2"/>
          <circle cx="200" cy="200" r="110" fill="none" stroke="#0E8B5A" stroke-width="2"/>
          <circle cx="200" cy="200" r="60" fill="#0E8B5A"/>
          <path d="M 80 200 L 320 200 M 200 80 L 200 320" stroke="#0A6B45" stroke-width="1.5"/>
        </svg>
      </div>
    </div>
  </div>
</body>
</html>`;

    case "toc":
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${page.title}</title>
<style>
  body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #0F1B17; background: #FAFAF7; }
  .slide { width: 1920px; height: 1080px; position: relative; overflow: hidden; }
  .slide-inner { padding: 96px 120px; height: 100%; box-sizing: border-box; }
  .eyebrow { font-family: "JetBrains Mono", monospace; font-size: 16px; letter-spacing: 0.18em; color: #0E8B5A; text-transform: uppercase; }
  .title { font-family: "Source Han Serif SC", serif; font-size: 64px; color: #0F1B17; margin: 24px 0 56px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
  .card { background: #FFFFFF; border: 1px solid #F1F5F2; border-radius: 8px; padding: 32px; min-height: 180px; }
  .idx { font-family: "JetBrains Mono", monospace; font-size: 36px; color: #0E8B5A; font-weight: 700; }
  .ctitle { font-family: "Source Han Serif SC", serif; font-size: 22px; color: #0F1B17; margin-top: 16px; line-height: 1.3; }
  .csub { font-size: 16px; color: #6B7570; margin-top: 8px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="slide">
    <div class="slide-inner">
      <div class="eyebrow">${page.eyebrow}</div>
      <h1 class="title">${page.title}</h1>
      <div class="grid">
        ${page.items
          .map(
            (it: { index: string; title: string; subtitle: string }) => `<div class="card">
          <div class="idx">${it.index}</div>
          <div class="ctitle">${it.title}</div>
          <div class="csub">${it.subtitle}</div>
        </div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </div>
</body>
</html>`;

    case "comparison":
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${page.title}</title>
<style>
  body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #0F1B17; background: #FAFAF7; }
  .slide { width: 1920px; height: 1080px; position: relative; overflow: hidden; }
  .slide-inner { padding: 96px 120px; height: 100%; box-sizing: border-box; }
  .eyebrow { font-family: "JetBrains Mono", monospace; font-size: 16px; letter-spacing: 0.18em; color: #0E8B5A; text-transform: uppercase; }
  .title { font-family: "Source Han Serif SC", serif; font-size: 56px; color: #0F1B17; margin: 24px 0 56px; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
  .col { padding: 48px; border-radius: 8px; min-height: 600px; }
  .col-left { background: #DCEFE5; }
  .col-right { background: #F1F5F2; }
  .colored-block { display: inline-block; background: #0E8B5A; color: #FAFAF7; padding: 8px 20px; border-radius: 4px; font-size: 14px; font-weight: 700; margin-bottom: 24px; letter-spacing: 0.06em; }
  .colored-block.warm { background: #C56B2C; }
  .col h2 { font-family: "Source Han Serif SC", serif; font-size: 32px; margin: 0 0 32px; line-height: 1.2; color: #0F1B17; }
  .col ul { list-style: none; padding: 0; margin: 0; }
  .col li { font-size: 18px; line-height: 1.7; padding-left: 32px; position: relative; margin-bottom: 16px; }
  .col li::before { content: "—"; position: absolute; left: 0; color: #0E8B5A; font-weight: 700; }
  .col-right li::before { color: #6B7570; }
</style>
</head>
<body>
  <div class="slide">
    <div class="slide-inner">
      <div class="eyebrow">${page.eyebrow}</div>
      <h1 class="title">${page.title}</h1>
      <div class="columns">
        <div class="col col-left">
          <span class="colored-block">优势 · ADVANTAGE</span>
          <h2>${page.leftTitle}</h2>
          <ul>${page.leftBullets.map((b: string) => `<li>${b}</li>`).join("")}</ul>
        </div>
        <div class="col col-right">
          <span class="colored-block warm">局限 · LIMITATION</span>
          <h2>${page.rightTitle}</h2>
          <ul>${page.rightBullets.map((b: string) => `<li>${b}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    case "timeline":
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${page.title}</title>
<style>
  body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #0F1B17; background: #FAFAF7; }
  .slide { width: 1920px; height: 1080px; position: relative; overflow: hidden; }
  .slide-inner { padding: 96px 120px; height: 100%; box-sizing: border-box; }
  .eyebrow { font-family: "JetBrains Mono", monospace; font-size: 16px; letter-spacing: 0.18em; color: #0E8B5A; text-transform: uppercase; }
  .title { font-family: "Source Han Serif SC", serif; font-size: 56px; color: #0F1B17; margin: 24px 0 16px; }
  .summary { font-size: 22px; color: #6B7570; margin-bottom: 64px; max-width: 1000px; line-height: 1.5; }
  .track { display: grid; grid-template-columns: repeat(${page.pageType === "timeline" ? page.nodes.length : 5}, 1fr); gap: 32px; position: relative; }
  .track::before { content: ""; position: absolute; left: 5%; right: 5%; top: 80px; height: 2px; background: #DCEFE5; }
  .node { position: relative; padding-top: 130px; }
  .dot { position: absolute; top: 70px; left: calc(50% - 12px); width: 24px; height: 24px; border-radius: 50%; background: #0E8B5A; box-shadow: 0 0 0 6px #FAFAF7; }
  .year { font-family: "JetBrains Mono", monospace; font-size: 14px; color: #0E8B5A; letter-spacing: 0.12em; }
  .ntitle { font-family: "Source Han Serif SC", serif; font-size: 24px; margin: 8px 0; line-height: 1.3; }
  .ndetail { font-size: 16px; color: #6B7570; line-height: 1.5; }
</style>
</head>
<body>
  <div class="slide">
    <div class="slide-inner">
      <div class="eyebrow">${page.eyebrow}</div>
      <h1 class="title">${page.title}</h1>
      <p class="summary">${page.summary}</p>
      <div class="track">
        ${page.nodes
          .map(
            (n: { year: string; title: string; detail: string }) => `<div class="node">
          <div class="dot"></div>
          <div class="year">${n.year}</div>
          <div class="ntitle">${n.title}</div>
          <div class="ndetail">${n.detail}</div>
        </div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </div>
</body>
</html>`;

    default:
      return `<!DOCTYPE html><html><body><div class="slide"><div class="slide-inner"><h1>${outlineTitle}</h1><p>${pageId}</p></div></div></body></html>`;
  }
}

// ─── mock provider ──────────────────────────────────────────────────────────

async function buildMock(plan: PagePlan, outlineTitle: string): Promise<MockProvider> {
  // 4 pages — alternate layoutArchetype to keep Variance Mandate happy
  const archetypes = ["centered-hero", "icon-grid", "comparison", "timeline-horizontal"];
  const visualElements = ["shape_composition", "icon_in_colored_circle", "colored_block", "diagram"];

  const qaResponse = {
    scores: {
      goal_clarity: 8,
      story_structure: 8,
      slide_assertions: 7,
      evidence_quality: 8,
      chart_fit: 7,
      visual_and_accessibility: 9,
      coherence_and_transitions: 9,
      speakability: 8,
      deliverables_complete: 7,
      robustness: 8,
    },
    total: 79,
    passed: true,
    weakestDimensions: ["chart_fit", "deliverables_complete", "slide_assertions"],
    violations: [],
  };

  return (key: string) => {
    if (key === "layer0") return `\`\`\`json\n${JSON.stringify(GENES, null, 2)}\n\`\`\``;
    if (key === "layer1") return `\`\`\`json\n${JSON.stringify(STYLE_GENES, null, 2)}\n\`\`\``;
    if (key === "layer2") return `\`\`\`json\n${JSON.stringify(CONSTITUTION, null, 2)}\n\`\`\``;
    if (key === "qa:subagent") return `\`\`\`json\n${JSON.stringify(qaResponse, null, 2)}\n\`\`\``;

    if (key.startsWith("layer3:")) {
      const pageId = key.slice("layer3:".length);
      const idx = plan.pages.findIndex((p) => p.pageId === pageId);
      if (idx < 0) return undefined;
      const page = plan.pages[idx];
      return `\`\`\`json\n${JSON.stringify(
        buildBrief(pageId, page.pageType, visualElements[idx], archetypes[idx]),
        null,
        2,
      )}\n\`\`\``;
    }

    if (key.startsWith("layer4:")) {
      const pageId = key.slice("layer4:".length).replace(/:retry$/, "");
      const page = plan.pages.find((p) => p.pageId === pageId);
      if (!page) return undefined;
      return `\`\`\`html\n${htmlFor(pageId, page.pageType, outlineTitle, page)}\n\`\`\``;
    }

    return undefined;
  };
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("[smoke] Iteration 2 end-to-end smoke test starting");
  process.env.CLAUDE_MOCK = "1";

  const outline = JSON.parse(
    await readFile(join(MVP_DOCS, "wireless-outline.json"), "utf8"),
  );
  const plan = JSON.parse(
    await readFile(join(MVP_DOCS, "wireless-page-plan.json"), "utf8"),
  ) as PagePlan;

  console.log(`[smoke] outline: ${outline.title}`);
  console.log(`[smoke] pages: ${plan.pages.length}`);
  console.log(`[smoke] CHROME_PATH: ${process.env.CHROME_PATH ?? "(unset)"}`);

  const mockProvider = await buildMock(plan, outline.title);

  const result = await buildFromPagePlan({
    outlinePath: join(MVP_DOCS, "wireless-outline.json"),
    briefPath: join(MVP_DOCS, "wireless-visual-brief.json"),
    planPath: join(MVP_DOCS, "wireless-page-plan.json"),
    outputPptx: OUT_PPTX,
    mockProvider,
    forceMock: true,
    sessionTag: "smoke-iteration2",
    visualQa: { detectorOnly: false, mockProvider, forceMock: true },
  });

  console.log("");
  console.log("[smoke] ✅ DONE");
  console.log(`        pptx          : ${result.pptxPath}`);
  console.log(`        sessionDir    : ${result.sessionDir}`);
  console.log(`        retry counts  : ${result.artifacts.renderedPages.map((p) => p.retryCount).join(", ")}`);
  console.log(`        fallbacks     : ${result.artifacts.placeholderFallbackCount}`);
  if (result.visualQa) {
    console.log(`        QA detector   :`);
    console.log(`           colorDrift       ${result.visualQa.detector.colorDrift.length}`);
    console.log(`           fontDrift        ${result.visualQa.detector.fontDrift.length}`);
    console.log(`           bannedFeatures   ${result.visualQa.detector.bannedFeatures.length}`);
    console.log(`           placeholderRes   ${result.visualQa.detector.placeholderResidue.length}`);
    console.log(`        needsRegenerate   ${JSON.stringify(result.visualQa.needsRegenerate)}`);
    console.log(`        passed            ${result.visualQa.passed}`);
  }
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err);
  process.exit(1);
});
