#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export type SlideShapeBox = {
  id: number;
  kind: "text" | "image" | "group" | "chart" | "shape";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  placeholderType?: string;
  textSample?: string;
  mediaTarget?: string;
};

/**
 * Semantic topology tag for a slide. Derived from shape geometry + text
 * patterns; used by preserve-mode to match content page_type to template
 * slide at pre-flight time (see docs/design/ppt-three.md
 * §page_type-topology). Mirror this list in
 * `packages/backend/src/scripts/ppt-mvp/preserve/template-slot-map-schema.ts`.
 */
export type SlideTopology =
  | "cover_hero"
  | "toc_list_4"
  | "section_divider"
  | "grid_2x2_symmetric"
  | "col_2_symmetric"
  | "row_3_cells"
  | "row_4_cells"
  | "row_5_flow"
  | "single_col"
  | "single_col_with_dual_image"
  | "repeat_2"
  | "repeat_3"
  | "repeat_4"
  | "closing"
  | "other";

export type LayoutPreset = {
  slideIndex: number;
  slidePath: string;
  layoutPath?: string;
  layoutType?: string;
  layoutName?: string;
  candidateRole: "cover_candidate" | "toc_candidate" | "content_candidate" | "unknown";
  topology: SlideTopology;
  shapeCount: number;
  imageCount: number;
  textCount: number;
  shapes: SlideShapeBox[];
};

export type LayoutExtraction = {
  version: "template_layout_presets/v1";
  pptxPath: string;
  slideSize: {
    cx: number;
    cy: number;
  };
  extractedAt: string;
  presets: LayoutPreset[];
};

type CliArgs = {
  pptxPath: string;
  outPath: string;
};

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let outPath = "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") {
      outPath = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
    } else {
      positional.push(arg);
    }
  }
  if (!positional[0]) {
    throw new Error(
      "Usage: bun packages/backend/src/scripts/ppt-mvp/extract-template-layout-presets.ts <pptx-path> [--out <json>]",
    );
  }
  const pptxPath = resolve(process.cwd(), positional[0]);
  const baseName = basename(pptxPath, ".pptx");
  return {
    pptxPath,
    outPath: resolve(
      process.cwd(),
      outPath && outPath.trim().length > 0
        ? outPath
        : `/tmp/ppt-layout-presets-${baseName}.json`,
    ),
  };
}

function unzipList(pptxPath: string): string[] {
  const proc = Bun.spawnSync(["unzip", "-Z1", pptxPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`Failed to list zip entries: ${proc.stderr.toString()}`);
  }
  return proc.stdout.toString().split("\n").map((line) => line.trim()).filter(Boolean);
}

function unzipText(pptxPath: string, entry: string): string {
  const proc = Bun.spawnSync(["unzip", "-p", pptxPath, entry], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`Failed to read ${entry}: ${proc.stderr.toString()}`);
  }
  return proc.stdout.toString();
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#xA;/g, " ")
    .replace(/&#10;/g, " ")
    .replace(/&#13;/g, " ");
}

export function parseXfrm(block: string): { x: number; y: number; w: number; h: number } {
  const off = block.match(/<a:off x="(\d+)" y="(\d+)"\/>/);
  const ext = block.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  return {
    x: Number.parseInt(off?.[1] ?? "0", 10),
    y: Number.parseInt(off?.[2] ?? "0", 10),
    w: Number.parseInt(ext?.[1] ?? "0", 10),
    h: Number.parseInt(ext?.[2] ?? "0", 10),
  };
}

export function parseRelationships(xml: string): Record<string, string> {
  const rels: Record<string, string> = {};
  const regex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    rels[match[1]] = match[2];
  }
  return rels;
}

function extractTextSample(block: string): string | undefined {
  const texts = Array.from(block.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
    .map((match) => decodeXmlText(match[1]).trim())
    .filter(Boolean);
  if (texts.length === 0) return undefined;
  return texts.join(" ").slice(0, 120);
}

function getPlaceholderType(block: string): string | undefined {
  return block.match(/<p:ph[^>]*type="([^"]+)"/)?.[1];
}

export function extractShapesFromSlideXml(
  slideXml: string,
  rels: Record<string, string>,
): SlideShapeBox[] {
  const shapes: SlideShapeBox[] = [];

  const pushShape = (shape: SlideShapeBox) => {
    if (shape.w === 0 && shape.h === 0) return;
    shapes.push(shape);
  };

  const textRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let textMatch: RegExpExecArray | null;
  while ((textMatch = textRegex.exec(slideXml)) !== null) {
    const block = textMatch[1];
    const id = Number.parseInt(block.match(/<p:cNvPr id="(\d+)"/)?.[1] ?? "0", 10);
    const name = decodeXmlText(block.match(/name="([^"]*)"/)?.[1] ?? "");
    const { x, y, w, h } = parseXfrm(block);
    const placeholderType = getPlaceholderType(block);
    const textSample = extractTextSample(block);
    pushShape({
      id,
      kind: textSample ? "text" : "shape",
      name,
      x,
      y,
      w,
      h,
      placeholderType,
      textSample,
    });
  }

  const picRegex = /<p:pic>([\s\S]*?)<\/p:pic>/g;
  let picMatch: RegExpExecArray | null;
  while ((picMatch = picRegex.exec(slideXml)) !== null) {
    const block = picMatch[1];
    const id = Number.parseInt(block.match(/<p:cNvPr id="(\d+)"/)?.[1] ?? "0", 10);
    const name = decodeXmlText(block.match(/name="([^"]*)"/)?.[1] ?? "");
    const { x, y, w, h } = parseXfrm(block);
    const embedId = block.match(/<a:blip[^>]*r:embed="([^"]+)"/)?.[1];
    pushShape({
      id,
      kind: "image",
      name,
      x,
      y,
      w,
      h,
      mediaTarget: embedId ? rels[embedId] : undefined,
    });
  }

  const groupRegex = /<p:grpSp>([\s\S]*?)<\/p:grpSp>/g;
  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = groupRegex.exec(slideXml)) !== null) {
    const block = groupMatch[1];
    const id = Number.parseInt(block.match(/<p:cNvPr id="(\d+)"/)?.[1] ?? "0", 10);
    const name = decodeXmlText(block.match(/name="([^"]*)"/)?.[1] ?? "");
    const { x, y, w, h } = parseXfrm(block);
    pushShape({
      id,
      kind: "group",
      name,
      x,
      y,
      w,
      h,
    });
  }

  const chartRegex = /<p:graphicFrame>([\s\S]*?)<\/p:graphicFrame>/g;
  let chartMatch: RegExpExecArray | null;
  while ((chartMatch = chartRegex.exec(slideXml)) !== null) {
    const block = chartMatch[1];
    const id = Number.parseInt(block.match(/<p:cNvPr id="(\d+)"/)?.[1] ?? "0", 10);
    const name = decodeXmlText(block.match(/name="([^"]*)"/)?.[1] ?? "");
    const { x, y, w, h } = parseXfrm(block);
    pushShape({
      id,
      kind: /<c:chart\b/.test(block) ? "chart" : "shape",
      name,
      x,
      y,
      w,
      h,
    });
  }

  return shapes.sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id);
}

function resolveTarget(baseEntry: string, target: string): string {
  const baseDir = dirname(baseEntry);
  return join(baseDir, target).replace(/\\/g, "/").replace(/\/\.\.\//g, "/");
}

function classifyCandidateRole(shapes: SlideShapeBox[]): LayoutPreset["candidateRole"] {
  const textCount = shapes.filter((shape) => shape.kind === "text").length;
  const imageCount = shapes.filter((shape) => shape.kind === "image").length;
  const largeImage = shapes.some((shape) => shape.kind === "image" && shape.w > 8_000_000 && shape.h > 4_000_000);
  const pillTextCount = shapes.filter((shape) => shape.kind === "text" && shape.w > 1_500_000 && shape.w < 3_000_000 && shape.h < 700_000).length;
  if (largeImage && textCount >= 2) return "cover_candidate";
  if (pillTextCount >= 4 && imageCount === 0) return "toc_candidate";
  if (textCount >= 2 || imageCount >= 1) return "content_candidate";
  return "unknown";
}

/**
 * Heuristic topology classifier for preserve-mode page_type matching.
 *
 * Signals used:
 *   - Section title text (at y < 500000): "THANKS" → closing, "PART/ 0X" → divider
 *   - Hero cover detection (big image + title + pills at low y)
 *   - TOC detection ("目录" title + 4 numbered rows)
 *   - Repeated identical-bbox text shape groups → grid/row/col patterns
 *     - 4 shapes, 2 unique xs + 2 unique ys → grid_2x2_symmetric
 *     - 4 shapes, 4 unique xs, 1 y → row_4_cells
 *     - 3 shapes, 3 unique xs → row_3_cells
 *     - 2 shapes, 2 unique xs → col_2_symmetric (or repeat_2)
 *     - 5+ shapes → row_5_flow
 *   - Fallback: single_col
 *
 * NOT 100% accurate — designed to be a first-pass auto-tag. Authors
 * review output and override via slot-map `topology` field when needed.
 */
export function classifyTopology(shapes: SlideShapeBox[]): SlideTopology {
  const textShapes = shapes.filter((sh) => sh.kind === "text" && sh.textSample);
  const imageShapes = shapes.filter((sh) => sh.kind === "image");

  const sectionTitle = textShapes.find((sh) => sh.y < 500_000);
  const sectionText = (sectionTitle?.textSample ?? "").trim();
  const allText = textShapes.map((sh) => sh.textSample ?? "").join(" ");

  if (/THANKS|感谢您的观看/i.test(sectionText)) return "closing";
  if (/PART\/\s*\d+/i.test(allText) && textShapes.length <= 3) return "section_divider";
  if (sectionText.includes("目") && sectionText.includes("录")) return "toc_list_4";
  if (
    imageShapes.some((sh) => sh.w > 8_000_000 && sh.h > 4_000_000) &&
    textShapes.length >= 3
  ) {
    return "cover_hero";
  }

  // Group text shapes by (w, h) to detect repeated-bbox patterns.
  const byBbox = new Map<string, SlideShapeBox[]>();
  for (const sh of textShapes) {
    const key = `${sh.w}x${sh.h}`;
    byBbox.set(key, [...(byBbox.get(key) ?? []), sh]);
  }
  const repeats = [...byBbox.values()]
    .filter((grp) => grp.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (repeats.length === 0) {
    if (imageShapes.length >= 2 && textShapes.length <= 5) {
      return "single_col_with_dual_image";
    }
    return "single_col";
  }

  const biggest = repeats[0];
  const xs = [...new Set(biggest.map((sh) => sh.x))].sort((a, b) => a - b);
  const ys = [...new Set(biggest.map((sh) => sh.y))].sort((a, b) => a - b);

  if (biggest.length === 4) {
    if (xs.length === 2 && ys.length === 2) return "grid_2x2_symmetric";
    if (xs.length === 4 && ys.length === 1) return "row_4_cells";
    return "repeat_4";
  }
  if (biggest.length === 3 && xs.length === 3) return "row_3_cells";
  if (biggest.length === 2) {
    if (xs.length === 2 && ys.length === 1) return "col_2_symmetric";
    return "repeat_2";
  }
  if (biggest.length >= 5) return "row_5_flow";
  return "other";
}

async function extractLayoutPresets(pptxPath: string): Promise<LayoutExtraction> {
  const entries = unzipList(pptxPath);
  const presentationXml = unzipText(pptxPath, "ppt/presentation.xml");
  const slideSizeMatch = presentationXml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  const slidePaths = entries.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry)).sort((a, b) => {
    const ai = Number.parseInt(a.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
    const bi = Number.parseInt(b.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
    return ai - bi;
  });

  const presets: LayoutPreset[] = [];
  for (const slidePath of slidePaths) {
    const slideXml = unzipText(pptxPath, slidePath);
    const relPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
    const slideRels = entries.includes(relPath) ? parseRelationships(unzipText(pptxPath, relPath)) : {};
    const layoutTarget = slideRels[Object.keys(slideRels).find((id) => /slideLayout/.test(slideRels[id])) ?? ""] ?? "";
    const layoutPath = layoutTarget ? resolveTarget(slidePath, layoutTarget) : undefined;
    const layoutXml = layoutPath && entries.includes(layoutPath) ? unzipText(pptxPath, layoutPath) : "";
    const layoutType = layoutXml.match(/<p:sldLayout[^>]*type="([^"]+)"/)?.[1];
    const layoutName = decodeXmlText(layoutXml.match(/<p:cSld name="([^"]*)"/)?.[1] ?? "");
    const shapes = extractShapesFromSlideXml(slideXml, slideRels);
    presets.push({
      slideIndex: Number.parseInt(slidePath.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10),
      slidePath,
      layoutPath,
      layoutType,
      layoutName,
      candidateRole: classifyCandidateRole(shapes),
      topology: classifyTopology(shapes),
      shapeCount: shapes.length,
      imageCount: shapes.filter((shape) => shape.kind === "image").length,
      textCount: shapes.filter((shape) => shape.kind === "text").length,
      shapes,
    });
  }

  return {
    version: "template_layout_presets/v1",
    pptxPath,
    slideSize: {
      cx: Number.parseInt(slideSizeMatch?.[1] ?? "0", 10),
      cy: Number.parseInt(slideSizeMatch?.[2] ?? "0", 10),
    },
    extractedAt: new Date().toISOString(),
    presets,
  };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const result = await extractLayoutPresets(cli.pptxPath);
  await mkdir(dirname(cli.outPath), { recursive: true });
  await writeFile(cli.outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(JSON.stringify({
    pptxPath: cli.pptxPath,
    outPath: cli.outPath,
    slideCount: result.presets.length,
    roles: result.presets.reduce<Record<string, number>>((acc, preset) => {
      acc[preset.candidateRole] = (acc[preset.candidateRole] ?? 0) + 1;
      return acc;
    }, {}),
  }, null, 2));
}

if (import.meta.main) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
