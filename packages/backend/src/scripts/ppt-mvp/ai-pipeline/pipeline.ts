/**
 * Pipeline orchestrator — runs Layers 0-4 sequentially with persistence.
 *
 * Outputs are written under `<sessionDir>/`:
 *   - 00-template-genes.json
 *   - 01-style-genes.json
 *   - 02-global-constitution.json
 *   - 03-page-briefs.json
 *   - 04-design-system.css
 *   - pages/<pageId>.html
 *   - pipeline.log.txt   (timing + mode per call)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import type { MvpPageDefinition } from "../types";
import { callClaude, extractFencedCode, extractJson } from "./claude-client";
import { generateDesignSystemCss } from "./css-from-genes";
import {
  buildLayer0PromptFromBrief,
  buildLayer0PromptFromIngestedTemplate,
  buildLayer1Prompt,
  buildLayer2Prompt,
  buildLayer3Prompt,
  buildLayer4Prompt,
  SYSTEM_DESIGN,
} from "./prompts";
import type {
  GlobalConstitution,
  PageAssetRef,
  PageBrief,
  PipelineArtifacts,
  PipelineInputs,
  RenderedPage,
  StyleGenes,
  TemplateGenes,
} from "./types";

/**
 * Mock response provider — return canned text for a given layer key,
 * or undefined to fall through to live API.
 *
 * Keys used by the orchestrator:
 *   "layer0", "layer1", "layer2",
 *   "layer3:<pageId>", "layer4:<pageId>", "layer4:<pageId>:retry"
 */
export type MockProvider = (key: string) => string | undefined;

export type PipelineOptions = {
  mockProvider?: MockProvider;
  /** Force mock mode for ALL calls.  When false, only calls with a mock
   *  hit fall back to mock; otherwise live API is used. */
  forceMock?: boolean;
};

const HTML_MIN_SIZE = 600;

export async function runPipeline(
  inputs: PipelineInputs,
  options: PipelineOptions = {},
): Promise<PipelineArtifacts> {
  const { sessionDir, outline, pages, layer0Source, pageAssets } = inputs;
  await mkdir(sessionDir, { recursive: true });
  await mkdir(join(sessionDir, "pages"), { recursive: true });

  const log: string[] = [];
  const stamp = (msg: string) => {
    log.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`  ${msg}`);
  };

  function shouldMock(key: string): { mock: boolean; resp?: string } {
    const supplied = options.mockProvider?.(key);
    if (supplied != null) return { mock: true, resp: supplied };
    if (options.forceMock) {
      throw new Error(
        `forceMock=true but mockProvider returned no response for key "${key}"`,
      );
    }
    return { mock: false };
  }

  // ── Layer 0
  stamp("Layer 0 — TemplateGenes");
  const layer0Prompt =
    layer0Source.kind === "brief"
      ? buildLayer0PromptFromBrief(outline, layer0Source.brief)
      : buildLayer0PromptFromIngestedTemplate(
          outline,
          await readFile(layer0Source.templateJsonPath, "utf8"),
        );

  const m0 = shouldMock("layer0");
  const r0 = await callClaude({
    prompt: layer0Prompt,
    system: SYSTEM_DESIGN,
    maxTokens: 2048,
    mock: m0.mock,
    mockResponse: m0.resp,
  });
  stamp(`  ${r0.mode} · ${r0.durationMs}ms`);
  const templateGenes = extractJson<TemplateGenes>(r0.content);
  await writeFile(
    join(sessionDir, "00-template-genes.json"),
    JSON.stringify(templateGenes, null, 2),
  );

  // ── Deterministic CSS generation (no AI) from genes
  stamp("Generating design-system.css from TemplateGenes (deterministic)");
  const css = generateDesignSystemCss(templateGenes);
  const cssPath = join(sessionDir, "04-design-system.css");
  await writeFile(cssPath, css);

  // ── Layer 1
  stamp("Layer 1 — StyleGenes");
  const m1 = shouldMock("layer1");
  const r1 = await callClaude({
    prompt: buildLayer1Prompt(templateGenes),
    system: SYSTEM_DESIGN,
    maxTokens: 1024,
    mock: m1.mock,
    mockResponse: m1.resp,
  });
  stamp(`  ${r1.mode} · ${r1.durationMs}ms`);
  const styleGenes = extractJson<StyleGenes>(r1.content);
  await writeFile(
    join(sessionDir, "01-style-genes.json"),
    JSON.stringify(styleGenes, null, 2),
  );

  // ── Layer 2
  stamp("Layer 2 — GlobalConstitution");
  const m2 = shouldMock("layer2");
  const r2 = await callClaude({
    prompt: buildLayer2Prompt(outline, pages, templateGenes, styleGenes),
    system: SYSTEM_DESIGN,
    maxTokens: 1024,
    mock: m2.mock,
    mockResponse: m2.resp,
  });
  stamp(`  ${r2.mode} · ${r2.durationMs}ms`);
  const globalConstitution = extractJson<GlobalConstitution>(r2.content);
  await writeFile(
    join(sessionDir, "02-global-constitution.json"),
    JSON.stringify(globalConstitution, null, 2),
  );

  // ── Layer 3 (per page)
  stamp(`Layer 3 — PageBriefs (×${pages.length})`);
  const pageBriefs: PageBrief[] = [];
  for (const page of pages) {
    const key = `layer3:${page.pageId}`;
    const m3 = shouldMock(key);
    const r3 = await callClaude({
      prompt: buildLayer3Prompt(
        page,
        outline,
        templateGenes,
        styleGenes,
        globalConstitution,
        pageAssets?.[page.pageId] ?? [],
      ),
      system: SYSTEM_DESIGN,
      maxTokens: 800,
      mock: m3.mock,
      mockResponse: m3.resp,
    });
    stamp(`  ${page.pageId} · ${r3.mode} · ${r3.durationMs}ms`);
    const brief = extractJson<PageBrief>(r3.content);
    pageBriefs.push(brief);
  }
  await writeFile(
    join(sessionDir, "03-page-briefs.json"),
    JSON.stringify(pageBriefs, null, 2),
  );

  // ── Layer 4 (per page, with one retry on validation failure)
  stamp(`Layer 4 — Per-page HTML (×${pages.length})`);
  const renderedPages: RenderedPage[] = [];
  const cssHref = relative(join(sessionDir, "pages"), cssPath);

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const brief = pageBriefs[i];
    const speakerNote = (page as MvpPageDefinition & { speakerNote?: string }).speakerNote ?? "";

    const baseKey = `layer4:${page.pageId}`;
    const retryKey = `${baseKey}:retry`;

    const tryCall = async (key: string, isRetry: boolean) => {
      const m = shouldMock(key);
      return callClaude({
        prompt: buildLayer4Prompt(
          page,
          templateGenes,
          styleGenes,
          globalConstitution,
          brief,
          pageAssets?.[page.pageId] ?? [],
          css,
          cssHref,
        ),
        system: isRetry
          ? `${SYSTEM_DESIGN}\n\nThe previous attempt failed validation (HTML structure, missing asset usage, or page completeness). Produce a complete page now.`
          : SYSTEM_DESIGN,
        maxTokens: 4096,
        mock: m.mock,
        mockResponse: m.resp,
      });
    };

    let r4 = await tryCall(baseKey, false);
    let html = extractFencedCode(r4.content, "html");
    let retryCount = 0;

    const initialValidationError = validateHtml(page, html, pageAssets?.[page.pageId] ?? []);
    if (initialValidationError) {
      stamp(`  ${page.pageId} validation failed (${initialValidationError}), retrying`);
      retryCount = 1;
      r4 = await tryCall(retryKey, true);
      html = extractFencedCode(r4.content, "html");
    }

    const retryValidationError = validateHtml(page, html, pageAssets?.[page.pageId] ?? []);
    if (retryValidationError) {
      // Fall back to a minimal page so the deck still builds
      stamp(`  ${page.pageId} retry also failed (${retryValidationError}); emitting placeholder`);
      html = renderPlaceholder(page, cssHref);
      retryCount = 2;
    }

    const htmlPath = join(sessionDir, "pages", `${page.pageId}.html`);
    await writeFile(htmlPath, html!);
    stamp(`  ${page.pageId} · ${r4.mode} · ${r4.durationMs}ms · ${html!.length}B`);

    renderedPages.push({
      pageId: page.pageId,
      pageType: page.pageType,
      htmlPath,
      speakerNote,
      retryCount,
    });
  }

  await writeFile(join(sessionDir, "pipeline.log.txt"), `${log.join("\n")}\n`);

  return {
    templateGenes,
    styleGenes,
    globalConstitution,
    pageBriefs,
    renderedPages,
    designSystemCssPath: cssPath,
  };
}

function validateHtml(
  page: MvpPageDefinition,
  html: string | null,
  assets: PageAssetRef[],
): string | null {
  if (!html) return "empty_html";
  if (html.length < HTML_MIN_SIZE) return `size=${html.length}`;
  if (!/<body[\s>]/i.test(html)) return "missing_body";
  if (!/class\s*=\s*["'][^"']*\bslide\b/.test(html)) return "missing_slide_class";
  if (/display\s*:\s*none/i.test(html) || /visibility\s*:\s*hidden/i.test(html)) {
    return "hidden_content";
  }

  const missingContent = findMissingPageContent(page, html);
  if (missingContent) return missingContent;

  const requiredAssets = getRequiredAssets(page, assets);
  for (const asset of requiredAssets) {
    if (!html.includes(asset.fileUrl)) {
      return `missing_asset:${asset.slot}`;
    }
  }

  if (requiredAssets.length > 0 && !/(<img[\s>]|background-image\s*:|background\s*:|url\s*\()/i.test(html)) {
    return "missing_visual_asset_markup";
  }

  return null;
}

function renderPlaceholder(page: MvpPageDefinition, cssHref: string): string {
  const title = (page as { title?: string }).title ?? page.pageId;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${page.pageId} placeholder</title>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
<div class="slide">
  <div class="slide-inner">
    <div class="eyebrow eyebrow-mark"><span>FALLBACK</span></div>
    <h1 class="title-display-l" style="margin-top: 24px;">${title}</h1>
    <p class="body" style="margin-top: 16px; color: var(--ink-mute);">
      AI 生成失败，已使用占位排版。Page id: ${page.pageId}
    </p>
  </div>
</div>
</body>
</html>`;
}

function getRequiredAssets(
  page: MvpPageDefinition,
  assets: PageAssetRef[],
): PageAssetRef[] {
  const slotNames = (() => {
    switch (page.variantHint) {
      case "cover_hero_image":
        return ["hero_bg"];
      case "toc_card_grid_8":
        return ["bg_texture"];
      case "comparison_dual_image":
        return ["left_illustration", "right_illustration"];
      case "timeline_horizontal_5":
        return [
          "timeline_icon_1",
          "timeline_icon_2",
          "timeline_icon_3",
          "timeline_icon_4",
          "timeline_icon_5",
        ];
      case "process_flow_5":
        return ["process_illustration"];
      case "device_triptych_3":
        return ["device_image_1", "device_image_2", "device_image_3"];
      default:
        return [];
    }
  })();

  return slotNames
    .map((slot) => assets.find((asset) => asset.slot === slot))
    .filter((asset): asset is PageAssetRef => asset != null);
}

function findMissingPageContent(page: MvpPageDefinition, html: string): string | null {
  const checks: string[] = [];

  switch (page.pageType) {
    case "cover":
      checks.push(page.title, page.subtitle, page.audienceLine);
      break;
    case "toc":
      checks.push(page.title);
      for (const item of page.items) {
        checks.push(item.index, item.title, item.subtitle);
      }
      break;
    case "comparison":
      checks.push(page.title, page.leftTitle, page.rightTitle, ...page.leftBullets, ...page.rightBullets);
      break;
    case "timeline":
      checks.push(page.title, page.summary);
      for (const node of page.nodes) {
        checks.push(node.year, node.title, node.detail);
      }
      break;
    case "process":
      checks.push(page.title, page.summary);
      for (const step of page.steps) {
        checks.push(step.index, step.title, step.detail);
      }
      break;
    case "device_overview":
      checks.push(page.title, page.summary);
      for (const device of page.devices) {
        checks.push(device.name, device.scenario, device.note);
      }
      break;
    default:
      return null;
  }

  const missing = checks.find((text) => !html.includes(text));
  return missing ? `missing_content:${missing}` : null;
}

/** Tiny helper used by build scripts when checking session dir. */
export function sessionDirExists(dir: string): boolean {
  return existsSync(dir);
}
