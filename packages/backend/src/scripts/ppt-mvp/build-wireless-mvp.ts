import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { spawn } from "node:child_process";
import PptxGenJS from "pptxgenjs";
import { rasterizeSvgAssetPaths, resolveAssetPlanToPaths } from "./assets";
import { buildCanvasRenderModel } from "./canvas-model";
import { fitPageToSchema } from "./content-fitting";
import { buildDeckJson } from "./deck-json";
import { buildDeckExportPlan } from "./export-strategy";
import type { AssetPlan, PagePlan, PresentationOutline, VisualBrief } from "./types";
import { MVP_THEME, VARIANT_SCHEMAS, renderMvpPage } from "./variant-library";

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

async function runProcess(command: string, args: string[]) {
  return await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${command} exited with code ${code}`));
    });
    child.on("error", rejectRun);
  });
}

async function renderHybridSlidePng(pageId: string): Promise<string> {
  const outputPath = resolve(process.cwd(), `/tmp/ppt-mvp-${pageId}-hybrid.png`);
  await runProcess("bun", [
    "packages/backend/src/scripts/ppt-mvp/render-slide-image.ts",
    pageId,
    outputPath,
  ]);
  return outputPath;
}

async function main() {
  const baseDir = resolve(process.cwd(), "docs/design/ppt-mvp");
  const outputArg = process.argv[2];
  const outputPath = resolve(
    process.cwd(),
    outputArg && outputArg.trim().length > 0
      ? outputArg
      : "/tmp/intelliflow-ppt-mvp-wireless-v1.pptx",
  );

  const outline = await readJsonFile<PresentationOutline>(`${baseDir}/wireless-outline.json`);
  const brief = await readJsonFile<VisualBrief>(`${baseDir}/wireless-visual-brief.json`);
  const pagePlan = await readJsonFile<PagePlan>(`${baseDir}/wireless-page-plan.json`);
  const assetPlan = await readJsonFile<AssetPlan>(`${baseDir}/wireless-asset-plan.json`);

  const fittedPages = pagePlan.pages.map((page) => {
    const schema = VARIANT_SCHEMAS.find((candidate) => candidate.variantId === page.variantHint);
    if (!schema) throw new Error(`Missing schema for variant ${page.variantHint}`);
    return fitPageToSchema(page, schema);
  });

  const resolvedAssets = await rasterizeSvgAssetPaths(await resolveAssetPlanToPaths(assetPlan));
  const canvas = buildCanvasRenderModel(outline, brief, fittedPages, MVP_THEME);
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
    const pageStrategy = exportPlan.pageStrategies.find((item) => item.pageId === page.pageId);
    if (pageStrategy?.strategy === "hybrid") {
      const hybridPng = await renderHybridSlidePng(page.pageId);
      slide.addImage({
        path: hybridPng,
        x: 0,
        y: 0,
        w: 13.33,
        h: 7.5,
        imageSizingCrop: { x: 0, y: 0, w: 13.33, h: 7.5 },
      });
    } else {
      renderMvpPage(slide, page, resolvedAssets[page.pageId] ?? {});
    }
    if (page.speakerNote) {
      (slide as unknown as { addNotes?: (text: string) => void }).addNotes?.(page.speakerNote);
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as unknown as Buffer;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  const deckJsonPath = outputPath.endsWith(".pptx")
    ? `${outputPath.slice(0, -extname(outputPath).length)}.deck.json`
    : `${outputPath}.deck.json`;
  await writeFile(deckJsonPath, JSON.stringify(deckJson, null, 2), "utf-8");

  console.log(JSON.stringify({
    outputPath,
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
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
