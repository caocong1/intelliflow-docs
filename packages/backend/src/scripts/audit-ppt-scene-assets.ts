import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  collectPptSceneAssetRefs,
  mergePptSceneAssetManifest,
  parsePptSceneContent,
  type SceneAssetManifest,
} from "../modules/runtime/ppt-scene";

async function loadManifest(inputPath: string, manifestArg?: string): Promise<SceneAssetManifest | null> {
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
  const [, , inputArg, manifestArg] = process.argv;
  if (!inputArg) {
    throw new Error("Usage: bun packages/backend/src/scripts/audit-ppt-scene-assets.ts <input-json> [asset-manifest-json]");
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const content = await readFile(inputPath, "utf-8");
  const parsedDeck = parsePptSceneContent(content);
  if (!parsedDeck) {
    throw new Error("Input is not a valid ppt_scene/v1 or ppt_scene_family/v1 JSON.");
  }

  const refs = collectPptSceneAssetRefs(parsedDeck);
  const manifest = await loadManifest(inputPath, manifestArg);
  const mergedDeck = manifest ? mergePptSceneAssetManifest(parsedDeck, manifest) : parsedDeck;

  const resolved = refs.filter((ref) => Boolean(mergedDeck.slides.some((slide) => slide.assets?.[ref]?.src)));
  const unresolved = refs.filter((ref) => !resolved.includes(ref));

  console.log(JSON.stringify({
    inputPath,
    manifestPath: manifestArg ?? null,
    totalRefs: refs.length,
    resolvedRefs: resolved,
    unresolvedRefs: unresolved,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
