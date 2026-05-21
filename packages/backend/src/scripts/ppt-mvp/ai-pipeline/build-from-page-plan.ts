/**
 * Generic AI-pipeline driver: takes any (outline, brief, page-plan) trio and
 * produces an image-backed .pptx via the LandPPT 4-layer pipeline.
 *
 * This is the deck-content-agnostic core.  Topic-specific scripts (e.g.
 * build-wireless-ai-mvp.ts) become thin wrappers that supply paths and an
 * optional MockProvider.
 *
 * See docs/design/ppt-mvp/ai-pipeline.md for usage and design decisions.
 */

import { mkdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveAssetPlanToPaths } from "../assets";
import type { AssetPlan, PagePlan, PresentationOutline, VisualBrief } from "../types";
import type { Layer0Source, PageAssetMap, PipelineArtifacts } from "./types";
import type { MockProvider } from "./pipeline";
import { runPipeline } from "./pipeline";
import { renderHtmlToPng } from "./render-html";
import { packPptx } from "./pack-pptx";
import { runVisualQa, type QaResult, type RunVisualQaOptions } from "./visual-qa";

export type BuildFromPagePlanOptions = {
  outlinePath: string;
  /** Required when layer0Source.kind === "brief" (and layer0Source omitted). */
  briefPath?: string;
  planPath: string;
  outputPptx: string;
  assetPlanPath?: string;

  /** If omitted, defaults to { kind: "brief", brief: <briefPath> }. */
  layer0Source?: Layer0Source;

  mockProvider?: MockProvider;
  /** If true, every layer call MUST resolve through mockProvider; otherwise
   *  unhandled keys throw.  Default: derived from CLAUDE_MOCK env. */
  forceMock?: boolean;

  sessionDirRoot?: string;
  sessionTag?: string;

  /** Allow a caller to observe progress without scraping stdout. */
  log?: (msg: string) => void;

  /** Enable Visual QA (Track A subagent + Track B detector) after render. */
  visualQa?: boolean | RunVisualQaOptions;
};

export type BuildFromPagePlanResult = {
  pptxPath: string;
  sessionDir: string;
  artifacts: PipelineArtifacts;
  /** Visual-QA result when enabled via opts.visualQa. */
  visualQa?: QaResult;
};

export async function buildFromPagePlan(
  opts: BuildFromPagePlanOptions,
): Promise<BuildFromPagePlanResult> {
  const log = opts.log ?? ((m) => console.log(m));
  const sessionRoot = opts.sessionDirRoot ?? "/tmp/intelliflow-ppt-mvp-ai-session";
  const tag = opts.sessionTag ?? "deck";
  const sessionDir = `${sessionRoot}-${tag}-${Date.now()}`;
  await mkdir(sessionDir, { recursive: true });
  log(`[ai-pipeline] session: ${sessionDir}`);

  const outline = await loadJson<PresentationOutline>(opts.outlinePath);
  const plan = await loadJson<PagePlan>(opts.planPath);
  const pageAssets = opts.assetPlanPath
    ? await loadResolvedPageAssets(opts.assetPlanPath)
    : undefined;

  // Resolve Layer 0 source
  let layer0Source: Layer0Source;
  if (opts.layer0Source) {
    layer0Source = opts.layer0Source;
  } else {
    if (!opts.briefPath) {
      throw new Error(
        "buildFromPagePlan: briefPath is required when layer0Source is not supplied",
      );
    }
    const brief = await loadJson<VisualBrief>(opts.briefPath);
    layer0Source = { kind: "brief", brief };
  }

  if (layer0Source.kind === "brief") {
    log("[ai-pipeline] Layer 0 source: visual brief");
  } else {
    log(`[ai-pipeline] Layer 0 source: ingested template ${layer0Source.templateJsonPath}`);
  }
  if (pageAssets) {
    const assetCount = Object.values(pageAssets).reduce((sum, assets) => sum + assets.length, 0);
    log(`[ai-pipeline] assets: loaded ${assetCount} assets across ${Object.keys(pageAssets).length} pages`);
  }

  const forceMock =
    opts.forceMock ?? (process.env.CLAUDE_MOCK === "1" || process.env.CLAUDE_MOCK === "true");

  log(`[ai-pipeline] mode: ${forceMock ? "forced mock" : "live (with optional mock fallback)"}`);
  log("[ai-pipeline] running pipeline (Layers 0-4)");

  const artifacts = await runPipeline(
    {
      outline,
      pages: plan.pages,
      layer0Source,
      pageAssets,
      sessionDir,
    },
    {
      mockProvider: opts.mockProvider,
      forceMock,
    },
  );

  log(`[ai-pipeline] rendering ${artifacts.renderedPages.length} pages → PNG`);
  const slidePacks: Array<{ pngPath: string; speakerNote: string }> = [];
  for (const rp of artifacts.renderedPages) {
    const pngPath = rp.htmlPath.replace(/\.html$/, ".png");
    await renderHtmlToPng({ htmlPath: rp.htmlPath, outputPng: pngPath });
    log(`  ${rp.pageId} → ${basename(pngPath)} (retry=${rp.retryCount})`);
    slidePacks.push({ pngPath, speakerNote: rp.speakerNote });
  }

  // Visual QA (Track A subagent + Track B detector) before packing.
  // Caller decides whether QA failures block shipment; current default is
  // to log + persist the report and continue (do not silently fail).
  let qaResult: QaResult | undefined;
  if (opts.visualQa) {
    log(`[ai-pipeline] running visual QA (Track A + Track B)`);
    const qaOptions: RunVisualQaOptions =
      typeof opts.visualQa === "object" ? opts.visualQa : {};
    qaResult = await runVisualQa(artifacts.renderedPages, artifacts.specLock, qaOptions);
    const qaPath = join(sessionDir, "05-visual-qa.json");
    await writeFile(qaPath, JSON.stringify(qaResult, null, 2));
    log(
      `[ai-pipeline] visual QA → total=${qaResult.subagent?.total ?? "(detector-only)"} passed=${qaResult.passed} needsRegen=${qaResult.needsRegenerate.length}`,
    );
    if (qaResult.needsRegenerate.length > 0) {
      log(
        `[ai-pipeline] ⚠️  pages flagged for regeneration: ${qaResult.needsRegenerate.join(", ")} — see ${qaPath}`,
      );
    }
  }

  log(`[ai-pipeline] packing ${slidePacks.length}-page PPTX`);
  await packPptx({
    slides: slidePacks,
    outputPath: opts.outputPptx,
    title: outline.title,
    subject: "IntelliFlow AI-Pipeline",
    author: "IntelliFlow",
    company: "IntelliFlow",
  });

  log(`[ai-pipeline] done`);
  log(`  pptx     : ${opts.outputPptx}`);
  log(`  session  : ${sessionDir}`);
  log(`  pages    : ${slidePacks.length}`);
  if (artifacts.placeholderFallbackCount > 0) {
    log(`  ⚠️  placeholder fallbacks : ${artifacts.placeholderFallbackCount}`);
  }
  if (qaResult) {
    log(`  visual QA passed         : ${qaResult.passed}`);
  }

  return { pptxPath: opts.outputPptx, sessionDir, artifacts, visualQa: qaResult };
}

async function loadJson<T>(path: string): Promise<T> {
  const txt = await readFile(path, "utf8");
  return JSON.parse(txt) as T;
}

async function loadResolvedPageAssets(assetPlanPath: string): Promise<PageAssetMap> {
  const assetPlan = await loadJson<AssetPlan>(assetPlanPath);
  const resolvedPaths = await resolveAssetPlanToPaths(assetPlan);
  const pageAssets: PageAssetMap = {};

  for (const page of assetPlan.pageAssets) {
    pageAssets[page.pageId] = page.assets
      .map((asset) => {
        const path = resolvedPaths[page.pageId]?.[asset.slot];
        if (!path) return null;
        return {
          slot: asset.slot,
          kind: asset.kind,
          path,
          fileUrl: pathToFileURL(path).toString(),
        };
      })
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null);
  }

  return pageAssets;
}
