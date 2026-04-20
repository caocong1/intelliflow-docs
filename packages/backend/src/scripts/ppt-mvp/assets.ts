import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AssetPlan } from "./types";
import { renderHtmlToPng } from "./ai-pipeline/render-html";

export async function resolveAssetPlanToPaths(assetPlan: AssetPlan): Promise<Record<string, Record<string, string>>> {
  const cacheDir = "/tmp/intelliflow-ppt-mvp-assets";
  await mkdir(cacheDir, { recursive: true });

  const resolved: Record<string, Record<string, string>> = {};
  for (const page of assetPlan.pageAssets) {
    resolved[page.pageId] = {};
    for (const asset of page.assets) {
      if (asset.source.type === "file") {
        resolved[page.pageId][asset.slot] = asset.source.path;
        continue;
      }

      const key = createHash("sha1")
        .update(`${asset.source.pptxPath}::${asset.source.mediaPath}`)
        .digest("hex");
      const ext = asset.source.mediaPath.split(".").pop() ?? "bin";
      const outputPath = join(cacheDir, `${key}.${ext}`);
      const unzip = Bun.spawnSync(["unzip", "-p", asset.source.pptxPath, asset.source.mediaPath], {
        stdout: "pipe",
        stderr: "pipe",
      });
      if (unzip.exitCode !== 0) {
        throw new Error(`Failed to extract asset ${asset.source.mediaPath} from ${asset.source.pptxPath}`);
      }
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, unzip.stdout);
      resolved[page.pageId][asset.slot] = outputPath;
    }
  }
  return resolved;
}

export async function rasterizeSvgAssetPaths(
  resolvedAssets: Record<string, Record<string, string | undefined>>,
): Promise<Record<string, Record<string, string | undefined>>> {
  const cacheDir = "/tmp/intelliflow-ppt-mvp-assets-rasterized";
  await mkdir(cacheDir, { recursive: true });

  const rasterizedBySource = new Map<string, string>();
  for (const assets of Object.values(resolvedAssets)) {
    for (const assetPath of Object.values(assets)) {
      if (!assetPath || !assetPath.toLowerCase().endsWith(".svg")) continue;
      if (rasterizedBySource.has(assetPath)) continue;
      rasterizedBySource.set(assetPath, await rasterizeSvgToPng(assetPath, cacheDir));
    }
  }

  const next: Record<string, Record<string, string | undefined>> = {};
  for (const [pageId, assets] of Object.entries(resolvedAssets)) {
    next[pageId] = {};
    for (const [slot, assetPath] of Object.entries(assets)) {
      next[pageId][slot] = assetPath && rasterizedBySource.has(assetPath)
        ? rasterizedBySource.get(assetPath)
        : assetPath;
    }
  }
  return next;
}

async function rasterizeSvgToPng(svgPath: string, cacheDir: string): Promise<string> {
  const key = createHash("sha1").update(svgPath).digest("hex");
  const outputPath = join(cacheDir, `${key}.png`);
  if (Bun.file(outputPath).size > 0) {
    return outputPath;
  }

  const tempDir = join(cacheDir, `tmp-${key}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });

  try {
    const svg = await readFile(svgPath, "utf8");
    const { width, height } = inferSvgCanvas(svg);
    const scale = 4;
    const renderWidth = width * scale;
    const renderHeight = height * scale;
    const htmlPath = join(tempDir, "icon.html");
    await writeFile(
      htmlPath,
      `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: ${renderWidth}px;
        height: ${renderHeight}px;
        background: transparent;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    ${svg}
  </body>
</html>`,
      "utf8",
    );
    await renderHtmlToPng({
      htmlPath,
      outputPng: outputPath,
      width: renderWidth,
      height: renderHeight,
      delayMs: 50,
    });
  } catch (error) {
    const render = Bun.spawnSync([
      "qlmanage",
      "-t",
      "-s",
      "512",
      "-o",
      tempDir,
      svgPath,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    if (render.exitCode !== 0) {
      throw new Error(
        `Failed to rasterize SVG asset ${svgPath}: ${
          error instanceof Error ? error.message : String(error)
        } / ${render.stderr.toString().slice(-200)}`,
      );
    }

    const files = await readdir(tempDir);
    const pngName = files.find((name) => name.toLowerCase().endsWith(".png"));
    if (!pngName) {
      throw new Error(`qlmanage produced no PNG for ${svgPath}`);
    }

    if (Bun.file(outputPath).size <= 0) {
      await rename(join(tempDir, pngName), outputPath);
    }
  }
  await rm(tempDir, { recursive: true, force: true });
  return outputPath;
}

function inferSvgCanvas(svg: string): { width: number; height: number } {
  const widthMatch = svg.match(/\bwidth=["']([\d.]+)(?:px)?["']/i);
  const heightMatch = svg.match(/\bheight=["']([\d.]+)(?:px)?["']/i);
  if (widthMatch && heightMatch) {
    return {
      width: Math.max(1, Math.round(Number(widthMatch[1]))),
      height: Math.max(1, Math.round(Number(heightMatch[1]))),
    };
  }

  const viewBoxMatch = svg.match(/\bviewBox=["'][^"']*?([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)["']/i);
  if (viewBoxMatch) {
    return {
      width: Math.max(1, Math.round(Number(viewBoxMatch[3]))),
      height: Math.max(1, Math.round(Number(viewBoxMatch[4]))),
    };
  }

  return { width: 120, height: 90 };
}
