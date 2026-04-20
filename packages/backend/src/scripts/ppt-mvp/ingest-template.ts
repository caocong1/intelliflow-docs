#!/usr/bin/env bun
/**
 * Template Ingestion POC.
 *
 * Reads any .pptx (typically a designer-website template), extracts its
 * structural assets (theme palette, fonts, slideLayouts, slide examples,
 * media library, charts), resolves the slide → master → theme/themeOverride
 * scheme-color chain, and emits a JSON descriptor that can be consumed by
 * the LandPPT 4-layer AI pipeline (selection 4 in
 * docs/research/template-generation-paradigms.md).
 *
 * This is a POC.  It uses regex-based XML scraping, not a full DOM parser,
 * because the patterns we need are stable and narrow.  See §7.5 of the
 * research doc for the schema this aims to produce.
 *
 * Usage:
 *   bun packages/backend/src/scripts/ppt-mvp/ingest-template.ts <pptx-path> [out-dir]
 *
 * Output (in out-dir, default /tmp/ppt-research/ingest-out/<slug>/):
 *   - template.json    full descriptor
 *   - template.md      human-readable summary
 *   - media/*          extracted media files (copied verbatim)
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, extname } from "node:path";
import { createHash } from "node:crypto";

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

type SchemeColors = {
  dk1?: string; dk2?: string; lt1?: string; lt2?: string;
  accent1?: string; accent2?: string; accent3?: string;
  accent4?: string; accent5?: string; accent6?: string;
  hlink?: string; folHlink?: string;
};

type LayoutInfo = {
  fileName: string;
  layoutType: string;
  matchingName: string;
  placeholderTypes: string[];
  shapeCount: number;
};

type SlideInfo = {
  fileName: string;
  index: number;
  shapeCount: number;
  groupCount: number;
  picCount: number;
  textBoxCount: number;
  hasChart: boolean;
  directColors: string[];
  rawSize: number;
};

type MediaItem = {
  path: string;
  fileName: string;
  size: number;
  ext: string;
  kind: "image" | "icon" | "audio" | "video" | "other";
};

type TemplateDescriptor = {
  template_id: string;
  source_file: string;
  source_basename: string;
  ingested_at: string;

  design_tokens: {
    color_palette: {
      // resolved palette - actual sRGB after themeOverride wins
      primary: string | null;       // accent1
      secondary: string | null;      // accent2
      accent: string[];               // accent3..6 (filtered nonempty)
      neutral: string[];              // dk1, dk2, lt1, lt2
      link: string | null;
      followed_link: string | null;
      raw_scheme: SchemeColors;       // base theme
      override_scheme: SchemeColors | null;
      direct_palette_top10: { color: string; uses: number }[];
    };
    typography: {
      title_font_latin: string | null;
      body_font_latin: string | null;
      title_font_ea: string | null;   // east-asian
      body_font_ea: string | null;
      additional_fonts: string[];
    };
    layout_rhythm: {
      page_count: number;
      layout_count: number;
      avg_text_density: "low" | "mid" | "high";
      page_xml_size_distribution: { min: number; max: number; median: number };
    };
  };

  layouts_extracted: LayoutInfo[];
  slide_examples: SlideInfo[];

  asset_library: {
    media_count: number;
    media_total_bytes: number;
    images: MediaItem[];
    icons: MediaItem[];   // small-size heuristic
    audio: MediaItem[];
    other: MediaItem[];
    has_charts: boolean;
    chart_count: number;
  };

  ai_consumable_summary: string;

  notes: string[];
};

// ────────────────────────────────────────────────────────────────────────
// Tiny XML scraping helpers (regex-based; sufficient for our targets)
// ────────────────────────────────────────────────────────────────────────

const reSrgbClr = /<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/g;
const reTypeface = /typeface="([^"]+)"/g;

/** Parse <a:clrScheme>...</a:clrScheme>, returning a SchemeColors map. */
function parseClrScheme(xml: string): SchemeColors {
  const schemeMatch = xml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
  if (!schemeMatch) return {};
  const inner = schemeMatch[1];
  const out: SchemeColors = {};
  const tags: (keyof SchemeColors)[] = [
    "dk1", "dk2", "lt1", "lt2",
    "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
    "hlink", "folHlink",
  ];
  for (const tag of tags) {
    // Match <a:tag>...</a:tag>, then look for srgbClr or sysClr inside
    const tagRe = new RegExp(`<a:${tag}>([\\s\\S]*?)<\\/a:${tag}>`);
    const m = inner.match(tagRe);
    if (!m) continue;
    const block = m[1];
    const srgb = block.match(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
    if (srgb) {
      out[tag] = `#${srgb[1].toUpperCase()}`;
      continue;
    }
    const sys = block.match(/<a:sysClr[^/]*lastClr="([A-Fa-f0-9]{6})"/);
    if (sys) out[tag] = `#${sys[1].toUpperCase()}`;
  }
  return out;
}

function pickResolved<K extends keyof SchemeColors>(
  override: SchemeColors | null,
  base: SchemeColors,
  key: K,
): string | null {
  return override?.[key] ?? base[key] ?? null;
}

function countTags(xml: string, tag: string): number {
  const re = new RegExp(`<${tag}\\b`, "g");
  return (xml.match(re) ?? []).length;
}

function listMatches(xml: string, re: RegExp, group = 1): string[] {
  const out: string[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[group]);
  }
  return out;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ────────────────────────────────────────────────────────────────────────
// PPTX archive helpers (uses shell unzip; matches existing assets.ts pattern)
// ────────────────────────────────────────────────────────────────────────

function listZipEntries(pptxPath: string): { path: string; size: number }[] {
  const proc = Bun.spawnSync(["unzip", "-l", pptxPath], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    throw new Error(`Failed to list ${pptxPath}: ${proc.stderr.toString()}`);
  }
  const lines = proc.stdout.toString().split("\n");
  const out: { path: string; size: number }[] = [];
  for (const line of lines) {
    // unzip -l format:  size  date  time  path
    const m = line.match(/^\s*(\d+)\s+\S+\s+\S+\s+(.+)$/);
    if (!m) continue;
    const size = parseInt(m[1], 10);
    const path = m[2].trim();
    if (path === "Name" || path.endsWith("/")) continue;
    out.push({ path, size });
  }
  return out;
}

function readZipText(pptxPath: string, entry: string): string | null {
  const proc = Bun.spawnSync(["unzip", "-p", pptxPath, entry], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) return null;
  return proc.stdout.toString();
}

function readZipBytes(pptxPath: string, entry: string): Buffer | null {
  const proc = Bun.spawnSync(["unzip", "-p", pptxPath, entry], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) return null;
  return Buffer.from(proc.stdout);
}

// ────────────────────────────────────────────────────────────────────────
// Main ingestion
// ────────────────────────────────────────────────────────────────────────

function classifyMediaKind(item: { fileName: string; size: number; ext: string }): MediaItem["kind"] {
  const ext = item.ext.toLowerCase();
  if (["mp3", "wav", "m4a", "aac"].includes(ext)) return "audio";
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "svg", "gif", "webp"].includes(ext)) {
    // size-based icon heuristic: <8KB likely icon
    if (item.size < 8192) return "icon";
    return "image";
  }
  return "other";
}

function deriveSlug(pptxPath: string): string {
  const name = basename(pptxPath, ".pptx").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  const hash = createHash("sha1").update(pptxPath).digest("hex").slice(0, 6);
  return `${name}_${hash}`;
}

async function ingest(pptxPath: string, outDir: string): Promise<TemplateDescriptor> {
  if (!existsSync(pptxPath)) throw new Error(`File not found: ${pptxPath}`);

  const entries = listZipEntries(pptxPath);

  // ── Theme + override
  const themeXml = readZipText(pptxPath, "ppt/theme/theme1.xml") ?? "";
  const overrideEntry = entries.find((e) => /ppt\/theme\/themeOverride1\.xml/.test(e.path));
  const overrideXml = overrideEntry ? readZipText(pptxPath, overrideEntry.path) : null;

  const baseScheme = parseClrScheme(themeXml);
  const overrideScheme = overrideXml ? parseClrScheme(overrideXml) : null;

  // ── Master font extraction
  const masterEntry = entries.find((e) => /ppt\/slideMasters\/slideMaster1\.xml/.test(e.path));
  const masterXml = masterEntry ? readZipText(pptxPath, masterEntry.path) ?? "" : "";

  // Theme also defines fontScheme — try theme first, then override, then master
  function extractFonts(xml: string): { latinMajor: string | null; eaMajor: string | null; latinMinor: string | null; eaMinor: string | null } {
    const out = { latinMajor: null as string | null, eaMajor: null as string | null, latinMinor: null as string | null, eaMinor: null as string | null };
    const majorMatch = xml.match(/<a:majorFont>([\s\S]*?)<\/a:majorFont>/);
    const minorMatch = xml.match(/<a:minorFont>([\s\S]*?)<\/a:minorFont>/);
    if (majorMatch) {
      const latin = majorMatch[1].match(/<a:latin\s+typeface="([^"]+)"/);
      const ea = majorMatch[1].match(/<a:ea\s+typeface="([^"]+)"/);
      if (latin) out.latinMajor = latin[1] || null;
      if (ea) out.eaMajor = ea[1] || null;
    }
    if (minorMatch) {
      const latin = minorMatch[1].match(/<a:latin\s+typeface="([^"]+)"/);
      const ea = minorMatch[1].match(/<a:ea\s+typeface="([^"]+)"/);
      if (latin) out.latinMinor = latin[1] || null;
      if (ea) out.eaMinor = ea[1] || null;
    }
    return out;
  }

  const themeFonts = extractFonts(themeXml);
  const overrideFonts = overrideXml ? extractFonts(overrideXml) : { latinMajor: null, eaMajor: null, latinMinor: null, eaMinor: null };
  const masterFonts: string[] = listMatches(masterXml, reTypeface)
    .filter((t) => t && !t.startsWith("+"))
    .filter((t, i, arr) => arr.indexOf(t) === i);

  const titleFontLatin = overrideFonts.latinMajor ?? themeFonts.latinMajor;
  const bodyFontLatin = overrideFonts.latinMinor ?? themeFonts.latinMinor;
  const titleFontEa = overrideFonts.eaMajor ?? themeFonts.eaMajor;
  const bodyFontEa = overrideFonts.eaMinor ?? themeFonts.eaMinor;

  // ── Layouts
  const layoutEntries = entries
    .filter((e) => /ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(e.path))
    .sort((a, b) => {
      const ai = parseInt(a.path.match(/slideLayout(\d+)/)![1], 10);
      const bi = parseInt(b.path.match(/slideLayout(\d+)/)![1], 10);
      return ai - bi;
    });
  const layouts: LayoutInfo[] = [];
  for (const e of layoutEntries) {
    const xml = readZipText(pptxPath, e.path) ?? "";
    const matchingName = (xml.match(/matchingName="([^"]*)"/) ?? [, ""])[1];
    const layoutType = (xml.match(/<p:sldLayout[^>]*\stype="([^"]+)"/) ?? [, ""])[1];
    const placeholders = listMatches(xml, /<p:ph[^/]*type="([^"]+)"/g);
    const shapeCount = countTags(xml, "p:sp");
    layouts.push({
      fileName: basename(e.path),
      layoutType,
      matchingName,
      placeholderTypes: placeholders,
      shapeCount,
    });
  }

  // ── Slides
  const slideEntries = entries
    .filter((e) => /ppt\/slides\/slide\d+\.xml$/.test(e.path))
    .sort((a, b) => {
      const ai = parseInt(a.path.match(/slide(\d+)/)![1], 10);
      const bi = parseInt(b.path.match(/slide(\d+)/)![1], 10);
      return ai - bi;
    });
  const slides: SlideInfo[] = [];
  const directColorTally = new Map<string, number>();
  for (const e of slideEntries) {
    const xml = readZipText(pptxPath, e.path) ?? "";
    const idx = parseInt(e.path.match(/slide(\d+)/)![1], 10);
    const directColors = listMatches(xml, reSrgbClr).map((c) => `#${c.toUpperCase()}`);
    for (const c of directColors) {
      directColorTally.set(c, (directColorTally.get(c) ?? 0) + 1);
    }
    slides.push({
      fileName: basename(e.path),
      index: idx,
      shapeCount: countTags(xml, "p:sp"),
      groupCount: countTags(xml, "p:grpSp"),
      picCount: countTags(xml, "p:pic"),
      textBoxCount: (xml.match(/<p:txBody/g) ?? []).length,
      hasChart: /<c:chart\b/.test(xml) || /chart\d+\.xml/.test(xml),
      directColors: Array.from(new Set(directColors)),
      rawSize: e.size,
    });
  }

  // ── Media
  const mediaEntries = entries.filter((e) => /^ppt\/media\//.test(e.path));
  const media: MediaItem[] = mediaEntries.map((e) => {
    const fn = basename(e.path);
    const ext = extname(fn).slice(1) || "bin";
    const item = { path: e.path, fileName: fn, size: e.size, ext, kind: "other" as MediaItem["kind"] };
    item.kind = classifyMediaKind(item);
    return item;
  });

  // Copy media to outDir/media/
  await mkdir(join(outDir, "media"), { recursive: true });
  for (const m of media) {
    const bytes = readZipBytes(pptxPath, m.path);
    if (!bytes) continue;
    await writeFile(join(outDir, "media", m.fileName), bytes);
  }

  const charts = entries.filter((e) => /^ppt\/charts\/chart\d+\.xml$/.test(e.path));

  // ── Density heuristic
  const sizes = slides.map((s) => s.rawSize);
  const med = median(sizes);
  const density: "low" | "mid" | "high" = med < 30000 ? "low" : med < 80000 ? "mid" : "high";

  const directTopList = Array.from(directColorTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([color, uses]) => ({ color, uses }));

  // ── Build descriptor
  const descriptor: TemplateDescriptor = {
    template_id: deriveSlug(pptxPath),
    source_file: pptxPath,
    source_basename: basename(pptxPath),
    ingested_at: new Date().toISOString(),

    design_tokens: {
      color_palette: {
        primary: pickResolved(overrideScheme, baseScheme, "accent1"),
        secondary: pickResolved(overrideScheme, baseScheme, "accent2"),
        accent: ([
          pickResolved(overrideScheme, baseScheme, "accent3"),
          pickResolved(overrideScheme, baseScheme, "accent4"),
          pickResolved(overrideScheme, baseScheme, "accent5"),
          pickResolved(overrideScheme, baseScheme, "accent6"),
        ].filter((c): c is string => Boolean(c))),
        neutral: ([
          pickResolved(overrideScheme, baseScheme, "dk1"),
          pickResolved(overrideScheme, baseScheme, "dk2"),
          pickResolved(overrideScheme, baseScheme, "lt1"),
          pickResolved(overrideScheme, baseScheme, "lt2"),
        ].filter((c): c is string => Boolean(c))),
        link: pickResolved(overrideScheme, baseScheme, "hlink"),
        followed_link: pickResolved(overrideScheme, baseScheme, "folHlink"),
        raw_scheme: baseScheme,
        override_scheme: overrideScheme,
        direct_palette_top10: directTopList,
      },
      typography: {
        title_font_latin: titleFontLatin,
        body_font_latin: bodyFontLatin,
        title_font_ea: titleFontEa,
        body_font_ea: bodyFontEa,
        additional_fonts: masterFonts,
      },
      layout_rhythm: {
        page_count: slides.length,
        layout_count: layouts.length,
        avg_text_density: density,
        page_xml_size_distribution: {
          min: sizes.length ? Math.min(...sizes) : 0,
          max: sizes.length ? Math.max(...sizes) : 0,
          median: med,
        },
      },
    },

    layouts_extracted: layouts,
    slide_examples: slides,

    asset_library: {
      media_count: media.length,
      media_total_bytes: media.reduce((s, m) => s + m.size, 0),
      images: media.filter((m) => m.kind === "image"),
      icons: media.filter((m) => m.kind === "icon"),
      audio: media.filter((m) => m.kind === "audio"),
      other: media.filter((m) => m.kind === "other" || m.kind === "video"),
      has_charts: charts.length > 0,
      chart_count: charts.length,
    },

    ai_consumable_summary: "",  // filled below
    notes: [],
  };

  descriptor.ai_consumable_summary = buildSummary(descriptor);
  descriptor.notes = buildNotes(descriptor);

  return descriptor;
}

// ────────────────────────────────────────────────────────────────────────
// Build human + AI consumables
// ────────────────────────────────────────────────────────────────────────

function buildSummary(d: TemplateDescriptor): string {
  const palette = d.design_tokens.color_palette;
  const fonts = d.design_tokens.typography;
  const rhythm = d.design_tokens.layout_rhythm;

  const colorParts: string[] = [];
  if (palette.primary) colorParts.push(`主色 ${palette.primary}`);
  if (palette.secondary) colorParts.push(`副色 ${palette.secondary}`);
  if (palette.accent.length) colorParts.push(`辅色 ${palette.accent.join(" / ")}`);

  const fontPart = fonts.title_font_ea
    ? `中文标题 ${fonts.title_font_ea}`
    : fonts.title_font_latin
      ? `标题字体 ${fonts.title_font_latin}`
      : "字体未自定义";

  const densityCn = rhythm.avg_text_density === "low" ? "信息密度偏低" : rhythm.avg_text_density === "high" ? "信息密度高（每页重内容）" : "信息密度中等";

  const richness: string[] = [];
  if (d.asset_library.has_charts) richness.push("含图表");
  if (d.asset_library.audio.length) richness.push("含音频");
  if (d.asset_library.images.length >= 10) richness.push("图像资产丰富");
  if (d.asset_library.icons.length >= 3) richness.push("含图标");

  return [
    `${rhythm.page_count} 页模板，${rhythm.layout_count} 个 slideLayout，${densityCn}`,
    colorParts.length ? `配色：${colorParts.join("，")}` : "配色：使用默认 Office 主题（未自定义）",
    fontPart,
    richness.length ? `特性：${richness.join("、")}` : "",
  ].filter(Boolean).join("；");
}

function buildNotes(d: TemplateDescriptor): string[] {
  const notes: string[] = [];
  const palette = d.design_tokens.color_palette;

  // Check if theme1 was a default Office theme
  const baseAccent1 = palette.raw_scheme.accent1;
  if (baseAccent1 === "#4472C4" && !palette.override_scheme) {
    notes.push("⚠ theme1.xml 是默认 Office 主题色板（4472C4 蓝等），且无 themeOverride —— 真实视觉色可能在 slideMaster 或各 slide 直接 sRGB 中");
  }
  if (palette.override_scheme) {
    notes.push("✓ 检测到 themeOverride1.xml — 真实品牌色板在 override 中（已优先解析）");
  }
  if (palette.direct_palette_top10.length > 0) {
    const topThree = palette.direct_palette_top10.slice(0, 3).map((x) => `${x.color}(×${x.uses})`).join(" ");
    notes.push(`各 slide 直接 sRGB 高频色 Top3：${topThree} —— 可作为补充调色板参考`);
  }
  const fonts = d.design_tokens.typography;
  if (!fonts.title_font_ea && !fonts.body_font_ea) {
    notes.push("⚠ 未检测到东亚（中文）自定义字体 —— theme/override 用的是默认中文字体（如 等线）");
  }
  const rhythm = d.design_tokens.layout_rhythm;
  if (rhythm.page_xml_size_distribution.max > 200000) {
    notes.push(`⚠ 单页 XML 最大 ${(rhythm.page_xml_size_distribution.max / 1024).toFixed(0)}KB —— 该页含极重视觉内容，hybrid render 时可能需要单页 fallback`);
  }
  if (d.layouts_extracted.length === 0) {
    notes.push("⚠ 未找到 slideLayouts —— 该模板可能采用 Kimi 路线（每页自渲染，无 layout 继承）");
  } else if (d.layouts_extracted.length >= 8) {
    notes.push(`✓ ${d.layouts_extracted.length} 个 slideLayouts —— 该模板采用豆包路线（real layout/master 继承），可直接抽取作为 IntelliFlow 选项 B 的 layout 池补充`);
  }
  return notes;
}

function buildMarkdownReport(d: TemplateDescriptor): string {
  const palette = d.design_tokens.color_palette;
  const fonts = d.design_tokens.typography;
  const rhythm = d.design_tokens.layout_rhythm;
  const lib = d.asset_library;

  const swatchLine = (label: string, color: string | null) =>
    color ? `- ${label}: \`${color}\`` : `- ${label}: (空)`;

  const slideRows = d.slide_examples.slice(0, 12).map((s) =>
    `| ${s.index} | ${s.shapeCount} | ${s.picCount} | ${s.textBoxCount} | ${(s.rawSize / 1024).toFixed(1)}KB | ${s.hasChart ? "是" : ""} | ${s.directColors.slice(0, 4).join(", ")} |`,
  ).join("\n");

  const layoutRows = d.layouts_extracted.map((l) =>
    `| ${l.fileName} | \`${l.layoutType || "(未声明)"}\` | ${l.matchingName || "(未命名)"} | ${l.placeholderTypes.length} | ${l.shapeCount} |`,
  ).join("\n");

  return `# Ingested Template — ${d.source_basename}

**Template ID**: \`${d.template_id}\`
**Ingested at**: ${d.ingested_at}
**Source**: \`${d.source_file}\`

## AI Consumable Summary

> ${d.ai_consumable_summary}

## Notes

${d.notes.map((n) => `- ${n}`).join("\n") || "(无特殊提示)"}

## Color Palette (resolved scheme)

${swatchLine("primary (accent1)", palette.primary)}
${swatchLine("secondary (accent2)", palette.secondary)}
- accent: ${palette.accent.length ? palette.accent.map((c) => `\`${c}\``).join(", ") : "(空)"}
- neutral: ${palette.neutral.length ? palette.neutral.map((c) => `\`${c}\``).join(", ") : "(空)"}
${swatchLine("link", palette.link)}
${swatchLine("followed link", palette.followed_link)}

### Direct sRGB Top 10 (used in slide bodies)

${palette.direct_palette_top10.map((x) => `- \`${x.color}\` × ${x.uses}`).join("\n") || "(无)"}

### Override scheme present

${palette.override_scheme ? "**是** — 真实品牌色应来自这里" : "否"}

## Typography

- 标题字体（Latin）: ${fonts.title_font_latin ?? "(默认)"}
- 标题字体（东亚）: ${fonts.title_font_ea ?? "(默认)"}
- 正文字体（Latin）: ${fonts.body_font_latin ?? "(默认)"}
- 正文字体（东亚）: ${fonts.body_font_ea ?? "(默认)"}
- 在 slideMaster 中出现的其他字体: ${fonts.additional_fonts.length ? fonts.additional_fonts.map((f) => `\`${f}\``).join(", ") : "(无)"}

## Layout Rhythm

- 页数: ${rhythm.page_count}
- slideLayout 数: ${rhythm.layout_count}
- 平均文本密度: ${rhythm.avg_text_density}
- 单页 XML 大小分布: min ${rhythm.page_xml_size_distribution.min}, median ${rhythm.page_xml_size_distribution.median}, max ${rhythm.page_xml_size_distribution.max}

## Asset Library

- 媒体总数: ${lib.media_count} (${(lib.media_total_bytes / 1024).toFixed(1)} KB)
- 图像: ${lib.images.length}
- 图标 (<8KB heuristic): ${lib.icons.length}
- 音频: ${lib.audio.length}
- 其他: ${lib.other.length}
- 包含图表: ${lib.has_charts ? `是 (${lib.chart_count} 个)` : "否"}

## Slide Layouts (${d.layouts_extracted.length})

| 文件 | type | matchingName | placeholders | shapes |
|---|---|---|---|---|
${layoutRows || "(无)"}

## Slide Examples (前 12 页)

| # | shapes | pics | textBoxes | xml size | chart? | direct colors |
|---|---|---|---|---|---|---|
${slideRows || "(无)"}

---

*Generated by \`packages/backend/src/scripts/ppt-mvp/ingest-template.ts\`. See \`docs/research/template-generation-paradigms.md\` §7.5 for the design.*
`;
}

// ────────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: bun ingest-template.ts <pptx-path> [out-dir]");
    process.exit(1);
  }
  const pptxPath = args[0];
  const baseOut = args[1] ?? "/tmp/ppt-research/ingest-out";
  const slug = deriveSlug(pptxPath);
  const outDir = join(baseOut, slug);

  if (existsSync(outDir)) await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  console.log(`[ingest-template] reading ${pptxPath}`);
  const descriptor = await ingest(pptxPath, outDir);

  await writeFile(join(outDir, "template.json"), JSON.stringify(descriptor, null, 2));
  await writeFile(join(outDir, "template.md"), buildMarkdownReport(descriptor));

  console.log(`[ingest-template] done`);
  console.log(`  template_id  : ${descriptor.template_id}`);
  console.log(`  layouts      : ${descriptor.layouts_extracted.length}`);
  console.log(`  slides       : ${descriptor.slide_examples.length}`);
  console.log(`  media        : ${descriptor.asset_library.media_count} (${(descriptor.asset_library.media_total_bytes / 1024).toFixed(1)} KB)`);
  console.log(`  has charts   : ${descriptor.asset_library.has_charts}`);
  console.log(`  out dir      : ${outDir}`);
  console.log(`\n  ${descriptor.ai_consumable_summary}\n`);
  for (const note of descriptor.notes) console.log(`  ${note}`);
}

void main();
