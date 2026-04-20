import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import PptxGenJS from "pptxgenjs";

import { rasterizeSvgAssetPaths, resolveAssetPlanToPaths } from "./assets";
import { buildCanvasRenderModel } from "./canvas-model";
import { fitPageToSchema } from "./content-fitting";
import { buildDeckJson } from "./deck-json";
import { buildDeckExportPlan } from "./export-strategy";
import {
  DEFAULT_NATIVE_TEMPLATE_PATH,
  getRequiredAssetSlots,
  loadNativeTemplate,
  nativeTemplateToTheme,
} from "./native-template";
import { loadTemplateLayoutPresetRuntime } from "./template-layout-presets";
import type { AssetPlan, NativeTemplate, PagePlan, PresentationOutline, VisualBrief } from "./types";
import { MVP_THEME, VARIANT_SCHEMAS, renderMvpPage } from "./variant-library";

export type BuildNativeFromPagePlanOptions = {
  outlinePath: string;
  briefPath: string;
  planPath: string;
  assetPlanPath: string;
  outputPptx: string;
  pageIds?: string[];
  nativeTemplatePath?: string;
};

export type BuildNativeFromPagePlanResult = {
  outputPath: string;
  deckJsonPath: string;
  deckTitle: string;
  familyId: string;
  familyName: string;
  pageCount: number;
  exportPlan: ReturnType<typeof buildDeckExportPlan>;
  variants: string[];
  pageFrames: Array<{
    pageId: string;
    variantId: string;
    narrativeRole: string;
    exportComplexity: string;
  }>;
  warnings: string[];
  briefTone: string;
  selectedPageIds: string[];
};

export async function buildNativeFromPagePlan(
  opts: BuildNativeFromPagePlanOptions,
): Promise<BuildNativeFromPagePlanResult> {
  const outline = await readJsonFile<PresentationOutline>(opts.outlinePath);
  const brief = await readJsonFile<VisualBrief>(opts.briefPath);
  const pagePlan = await readJsonFile<PagePlan>(opts.planPath);
  const assetPlan = await readJsonFile<AssetPlan>(opts.assetPlanPath);
  const nativeTemplate = await loadTemplateOrDefault(opts.nativeTemplatePath);
  /**
   * @deprecated Template-aware rhythm branches (cover/toc/comparison/process/timeline/device)
   * inside variant-library.ts are superseded by preserve mode — see
   * `packages/backend/src/scripts/ppt-mvp/preserve/build-from-template-preserve.ts`.
   *
   * Set env `USE_LAYOUT_PRESET_RENDER=1` to opt into the legacy path (frozen, not extended).
   * Default OFF: `layoutPresetRuntime` is undefined → variant-library falls back to its
   * generic native renderings, which remain the supported AI-native line. Do not add new
   * template-specific branches to variant-library.ts; use preserve mode instead.
   */
  const useLayoutPresetRender = process.env.USE_LAYOUT_PRESET_RENDER === "1";
  const layoutPresetRuntime = useLayoutPresetRender
    ? await loadTemplateLayoutPresetRuntime(nativeTemplate)
    : undefined;
  const filteredPages =
    opts.pageIds && opts.pageIds.length > 0
      ? pagePlan.pages.filter((page) => opts.pageIds?.includes(page.pageId))
      : pagePlan.pages;

  if (filteredPages.length === 0) {
    throw new Error(`No pages matched selection ${opts.pageIds?.join(", ") ?? "(none)"}`);
  }

  const fittedPages = filteredPages.map((page) => {
    const schema = VARIANT_SCHEMAS.find((candidate) => candidate.variantId === page.variantHint);
    if (!schema) throw new Error(`Missing schema for variant ${page.variantHint}`);
    return fitPageToSchema(page, schema, nativeTemplate.familyId);
  });

  const resolvedAssets = await rasterizeSvgAssetPaths(await resolveAssetPlanToPaths(assetPlan));
  for (const page of fittedPages) {
    const pageAssets = resolvedAssets[page.pageId] ?? {};
    const missingSlots = getRequiredAssetSlots(nativeTemplate, page.variantId)
      .filter((slot) => !pageAssets[slot]);
    if (missingSlots.length > 0) {
      throw new Error(
        `Missing required assets for ${page.pageId}/${page.variantId}: ${missingSlots.join(", ")}`,
      );
    }
  }
  const canvas = buildCanvasRenderModel(
    outline,
    brief,
    fittedPages,
    nativeTemplate ? nativeTemplateToTheme(nativeTemplate) : MVP_THEME,
    nativeTemplate ? {
      familyId: nativeTemplate.familyId,
      familyName: nativeTemplate.familyName,
    } : undefined,
  );
  const exportPlan = buildDeckExportPlan(canvas);
  const deckJson = buildDeckJson(canvas, exportPlan, resolvedAssets);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "IntelliFlow Docs";
  pptx.company = "IntelliFlow Docs";
  pptx.subject = outline.title;
  pptx.title = outline.title;
  pptx.lang = "zh-CN";

  for (const page of canvas.pages) {
    const slide = pptx.addSlide();
    renderMvpPage(slide, page, resolvedAssets[page.pageId] ?? {}, canvas.theme, nativeTemplate, layoutPresetRuntime);
    if (page.speakerNote) {
      (slide as unknown as { addNotes?: (text: string) => void }).addNotes?.(page.speakerNote);
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as unknown as Buffer;
  await mkdir(dirname(opts.outputPptx), { recursive: true });
  await writeFile(opts.outputPptx, buffer);
  const deckJsonPath = opts.outputPptx.endsWith(".pptx")
    ? `${opts.outputPptx.slice(0, -extname(opts.outputPptx).length)}.deck.json`
    : `${opts.outputPptx}.deck.json`;
  await writeFile(deckJsonPath, JSON.stringify(deckJson, null, 2), "utf-8");

  return {
    outputPath: opts.outputPptx,
    deckJsonPath,
    deckTitle: canvas.deckTitle,
    familyId: canvas.familyId,
    familyName: canvas.familyName,
    pageCount: canvas.pages.length,
    exportPlan,
    variants: canvas.pages.map((page) => page.variantId),
    pageFrames: canvas.pageFrames.map((frame) => ({
      pageId: frame.pageId,
      variantId: frame.variantId,
      narrativeRole: frame.narrativeRole,
      exportComplexity: frame.exportComplexity,
    })),
    warnings: canvas.pages.flatMap((page) => page.warnings),
    briefTone: brief.deckTone,
    selectedPageIds: opts.pageIds ?? [],
  };
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

async function loadTemplateOrDefault(path: string | undefined): Promise<NativeTemplate> {
  return loadNativeTemplate(path ?? DEFAULT_NATIVE_TEMPLATE_PATH);
}
