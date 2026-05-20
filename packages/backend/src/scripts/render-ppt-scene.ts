import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  mergePptSceneAssetManifest,
  parsePptSceneContent,
  renderPptSceneDeckToBuffer,
  type SceneAssetManifest,
} from "../modules/runtime/ppt-scene";

async function loadAssetManifest(inputPath: string, manifestArg?: string): Promise<SceneAssetManifest | null> {
  const candidatePaths = manifestArg
    ? [resolve(process.cwd(), manifestArg)]
    : [
        inputPath.replace(/\.json$/i, ".assets.json"),
        resolve(dirname(inputPath), "ppt-scene-assets.local.json"),
      ];

  for (const path of candidatePaths) {
    try {
      const content = await readFile(path, "utf-8");
      return JSON.parse(content) as SceneAssetManifest;
    } catch {
      // ignore and try next candidate
    }
  }

  return null;
}

async function main() {
  const [, , inputArg, outputArg, manifestArg] = process.argv;
  if (!inputArg) {
    throw new Error("Usage: bun packages/backend/src/scripts/render-ppt-scene.ts <input-json> [output-pptx] [asset-manifest-json]");
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const outputPath = resolve(
    process.cwd(),
    outputArg ?? inputArg.replace(/\.json$/i, ".pptx"),
  );

  const content = await readFile(inputPath, "utf-8");
  const parsedDeck = parsePptSceneContent(content);
  const manifest = await loadAssetManifest(inputPath, manifestArg);
  const sceneDeck = parsedDeck && manifest ? mergePptSceneAssetManifest(parsedDeck, manifest) : parsedDeck;
  if (!sceneDeck) {
    throw new Error("Input is not a valid ppt_scene/v1 or ppt_scene_family/v1 JSON.");
  }

  const result = await renderPptSceneDeckToBuffer(sceneDeck);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.buffer);

  console.log(JSON.stringify({
    inputPath,
    outputPath,
    manifestPath: manifestArg ?? null,
    renderMode: result.renderMode,
    warnings: result.warnings,
    slideCount: result.compositionSummary.totalSlides,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
