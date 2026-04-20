#!/usr/bin/env bun
/**
 * Batch-ingest a directory of .pptx templates and build a presets index.
 *
 * Each template is processed by ingest-template.ts (via spawn, to keep this
 * script free of import cycles).  The aggregated presets-index.json lists
 * every successfully ingested preset with its summary, palette, and the
 * template.json path that downstream pipelines (build-wireless-ai-mvp etc.)
 * can feed to Layer 0 as `--ingested`.
 *
 * Usage:
 *   bun packages/backend/src/scripts/ppt-mvp/batch-ingest-templates.ts <input-dir> [--out <dir>]
 *
 * Index location: <out-dir>/presets-index.json
 *   Default <out-dir> = /tmp/ppt-research/ingest-out
 */

import { readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";

const DEFAULT_OUT_DIR = "/tmp/ppt-research/ingest-out";

type CliArgs = {
  inputDir: string;
  outDir: string;
};

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let outDir = DEFAULT_OUT_DIR;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--out") {
      outDir = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--out=")) {
      outDir = a.slice("--out=".length);
    } else {
      positional.push(a);
    }
  }
  if (positional.length < 1) {
    throw new Error("Usage: batch-ingest-templates.ts <input-dir> [--out <dir>]");
  }
  return { inputDir: positional[0], outDir };
}

export type PresetIndexEntry = {
  presetId: string;
  sourceFile: string;
  templateJson: string;
  templateMd: string;
  summary: string;
  palette: {
    primary: string | null;
    secondary: string | null;
    accents: string[];
  };
  fonts: {
    title_ea: string | null;
    body_ea: string | null;
  };
  pageCount: number;
  hasCharts: boolean;
  ingestedAt: string;
  ingestedOk: boolean;
  error?: string;
};

export type PresetsIndex = {
  version: "presets_index/v1";
  generatedAt: string;
  inputDir: string;
  presets: PresetIndexEntry[];
};

async function findPptxFiles(dir: string): Promise<string[]> {
  // Recurse one level (typical 包图网 zips extract to a nested folder)
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase().endsWith(".pptx") && !e.name.startsWith(".")) {
      out.push(p);
    } else if (e.isDirectory()) {
      try {
        const inner = await readdir(p, { withFileTypes: true });
        for (const ie of inner) {
          if (ie.isFile() && ie.name.toLowerCase().endsWith(".pptx") && !ie.name.startsWith(".")) {
            out.push(join(p, ie.name));
          }
        }
      } catch {
        // skip unreadable subdir
      }
    }
  }
  return out;
}

function ingestScriptPath(): string {
  return new URL("./ingest-template.ts", import.meta.url).pathname;
}

async function ingestOne(pptxPath: string, outBase: string): Promise<PresetIndexEntry> {
  const ingestScript = ingestScriptPath();
  const proc = Bun.spawnSync(["bun", ingestScript, pptxPath, outBase], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    return {
      presetId: deriveSlug(pptxPath),
      sourceFile: pptxPath,
      templateJson: "",
      templateMd: "",
      summary: "",
      palette: { primary: null, secondary: null, accents: [] },
      fonts: { title_ea: null, body_ea: null },
      pageCount: 0,
      hasCharts: false,
      ingestedAt: new Date().toISOString(),
      ingestedOk: false,
      error: proc.stderr.toString().slice(-200),
    };
  }

  const slug = deriveSlug(pptxPath);
  const templateJsonPath = join(outBase, slug, "template.json");
  const templateMdPath = join(outBase, slug, "template.md");

  if (!existsSync(templateJsonPath)) {
    return {
      presetId: slug,
      sourceFile: pptxPath,
      templateJson: "",
      templateMd: "",
      summary: "",
      palette: { primary: null, secondary: null, accents: [] },
      fonts: { title_ea: null, body_ea: null },
      pageCount: 0,
      hasCharts: false,
      ingestedAt: new Date().toISOString(),
      ingestedOk: false,
      error: `template.json not found at ${templateJsonPath}`,
    };
  }

  const descriptor = JSON.parse(await Bun.file(templateJsonPath).text()) as {
    template_id: string;
    ingested_at: string;
    ai_consumable_summary: string;
    design_tokens: {
      color_palette: { primary: string | null; secondary: string | null; accent: string[] };
      typography: { title_font_ea: string | null; body_font_ea: string | null };
      layout_rhythm: { page_count: number };
    };
    asset_library: { has_charts: boolean };
  };

  return {
    presetId: descriptor.template_id,
    sourceFile: pptxPath,
    templateJson: templateJsonPath,
    templateMd: templateMdPath,
    summary: descriptor.ai_consumable_summary,
    palette: {
      primary: descriptor.design_tokens.color_palette.primary,
      secondary: descriptor.design_tokens.color_palette.secondary,
      accents: descriptor.design_tokens.color_palette.accent,
    },
    fonts: {
      title_ea: descriptor.design_tokens.typography.title_font_ea,
      body_ea: descriptor.design_tokens.typography.body_font_ea,
    },
    pageCount: descriptor.design_tokens.layout_rhythm.page_count,
    hasCharts: descriptor.asset_library.has_charts,
    ingestedAt: descriptor.ingested_at,
    ingestedOk: true,
  };
}

function deriveSlug(pptxPath: string): string {
  // Mirrors ingest-template.ts deriveSlug for index↔ingest-out alignment
  const name = basename(pptxPath, ".pptx").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  // Use an in-process hash equivalent to crypto sha1 first 6 chars of full path
  const hasher = new Bun.CryptoHasher("sha1");
  hasher.update(pptxPath);
  const hash = hasher.digest("hex").slice(0, 6);
  return `${name}_${hash}`;
}

export function buildIndex(
  inputDir: string,
  presets: PresetIndexEntry[],
): PresetsIndex {
  return {
    version: "presets_index/v1",
    generatedAt: new Date().toISOString(),
    inputDir,
    presets,
  };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  await mkdir(cli.outDir, { recursive: true });

  console.log(`[batch-ingest] scanning ${cli.inputDir} for .pptx`);
  const pptxFiles = await findPptxFiles(cli.inputDir);
  console.log(`[batch-ingest] found ${pptxFiles.length} files`);

  const presets: PresetIndexEntry[] = [];
  for (const f of pptxFiles) {
    console.log(`[batch-ingest] ingest ${basename(f)}`);
    const entry = await ingestOne(f, cli.outDir);
    if (entry.ingestedOk) {
      console.log(`  ok   → ${entry.presetId} · ${entry.summary.slice(0, 60)}...`);
    } else {
      console.log(`  fail → ${entry.error?.slice(0, 100)}`);
    }
    presets.push(entry);
  }

  const index = buildIndex(cli.inputDir, presets);
  const indexPath = join(cli.outDir, "presets-index.json");
  await writeFile(indexPath, JSON.stringify(index, null, 2));

  const okCount = presets.filter((p) => p.ingestedOk).length;
  console.log(`[batch-ingest] done`);
  console.log(`  total    : ${presets.length}`);
  console.log(`  succeeded: ${okCount}`);
  console.log(`  failed   : ${presets.length - okCount}`);
  console.log(`  index    : ${indexPath}`);
}

if (import.meta.main) {
  void main();
}
