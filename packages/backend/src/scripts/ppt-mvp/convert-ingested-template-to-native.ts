import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { LayoutExtraction, LayoutPreset } from "./extract-template-layout-presets";
import {
  findTemplateComparisonPreset,
  findTemplateCoverPreset,
  findTemplateDevicePreset,
  findTemplateProcessPreset,
  findTemplateTimelinePreset,
  findTemplateTocPreset,
} from "./template-layout-presets";
import type {
  IngestedTemplateDescriptor,
  MvpVariantId,
  NativeTemplate,
  NativeTemplateLayoutBinding,
  NativeTemplateAssetRule,
  NativeTemplatePrimitive,
  NativeTemplateVariantBinding,
} from "./types";
import { validateNativeTemplate } from "./native-template-schema";

type CliArgs = {
  inputPath: string;
  outputPath: string;
};

type ConvertOptions = {
  templateJsonPath?: string;
  layoutExtraction?: LayoutExtraction;
};

const DEFAULT_OFFICE_PRIMARY = "#4472C4";
const DEFAULT_OFFICE_SECONDARY = "#ED7D31";

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let outputPath = "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") {
      outputPath = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--out=")) {
      outputPath = arg.slice("--out=".length);
    } else {
      positional.push(arg);
    }
  }
  if (!positional[0]) {
    throw new Error(
      "Usage: bun packages/backend/src/scripts/ppt-mvp/convert-ingested-template-to-native.ts <template-json> [--out <native-template-json>]",
    );
  }
  const inputPath = resolve(process.cwd(), positional[0]);
  return {
    inputPath,
    outputPath: resolve(
      process.cwd(),
      outputPath && outputPath.trim().length > 0
        ? outputPath
        : inputPath.replace(/template\.json$/i, "native-template.json"),
    ),
  };
}

function stripHash(color: string): string {
  return color.replace(/^#/, "").toUpperCase();
}

function ensureColor(color: string | null | undefined, fallback: string): string {
  if (!color) return stripHash(fallback);
  return stripHash(color);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = stripHash(hex);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function chroma(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isNearNeutral(hex: string): boolean {
  return chroma(hex) < 20;
}

function preferDirectPalette(descriptor: IngestedTemplateDescriptor): boolean {
  const palette = descriptor.design_tokens.color_palette;
  return (
    palette.override_scheme == null &&
    palette.primary?.toUpperCase() === DEFAULT_OFFICE_PRIMARY &&
    palette.secondary?.toUpperCase() === DEFAULT_OFFICE_SECONDARY
  );
}

function pickDirectBrandColors(descriptor: IngestedTemplateDescriptor): string[] {
  return descriptor.design_tokens.color_palette.direct_palette_top10
    .filter((item) => !isNearNeutral(item.color))
    .sort((a, b) => b.uses - a.uses)
    .map((item) => item.color);
}

function pickPrimaryColor(descriptor: IngestedTemplateDescriptor): string {
  const palette = descriptor.design_tokens.color_palette;
  const direct = pickDirectBrandColors(descriptor);
  if (preferDirectPalette(descriptor) && direct[0]) {
    return stripHash(direct[0]);
  }
  return ensureColor(palette.primary ?? direct[0], "#2FCF7A");
}

function pickAccentColor(descriptor: IngestedTemplateDescriptor, primary: string): string {
  const palette = descriptor.design_tokens.color_palette;
  const direct = pickDirectBrandColors(descriptor)
    .map(stripHash)
    .filter((color) => color !== primary);
  const preferred = descriptor.design_tokens.color_palette.override_scheme
    ? palette.secondary
    : direct[0] ?? palette.secondary ?? palette.accent[0];
  return ensureColor(preferred, "#1F3147");
}

function pickTextColor(descriptor: IngestedTemplateDescriptor): string {
  const directDarkCandidates = descriptor.design_tokens.color_palette.direct_palette_top10
    .map((item) => item.color)
    .filter((color) => luminance(color) < 90 && isNearNeutral(color));
  const directDark = directDarkCandidates.find((color) => stripHash(color) !== "000000") ?? directDarkCandidates[0];
  const neutralCandidates = descriptor.design_tokens.color_palette.neutral.filter((color) => luminance(color) < 120);
  const neutralDark = neutralCandidates.find((color) => stripHash(color) !== "000000") ?? neutralCandidates[0];
  return ensureColor(directDark ?? neutralDark, "#1F2937");
}

function pickMutedTextColor(descriptor: IngestedTemplateDescriptor, textColor: string): string {
  const directMuted = descriptor.design_tokens.color_palette.direct_palette_top10
    .map((item) => item.color)
    .find((color) => {
      const l = luminance(color);
      return l >= 90 && l <= 150 && isNearNeutral(color) && stripHash(color) !== textColor;
    });
  const neutral = descriptor.design_tokens.color_palette.neutral.find((color) => {
    const l = luminance(color);
    return l >= 90 && l <= 180;
  });
  return ensureColor(directMuted ?? neutral, "#667085");
}

function pickBgColor(descriptor: IngestedTemplateDescriptor): string {
  const direct = descriptor.design_tokens.color_palette.direct_palette_top10
    .map((item) => item.color)
    .find((color) => luminance(color) > 230);
  const neutral = descriptor.design_tokens.color_palette.neutral.find((color) => luminance(color) > 220);
  return ensureColor(direct ?? neutral, "#F5F7F8");
}

function pickOutlineColor(descriptor: IngestedTemplateDescriptor, bgColor: string): string {
  const candidate = descriptor.design_tokens.color_palette.direct_palette_top10
    .map((item) => item.color)
    .find((color) => {
      const l = luminance(color);
      return l > 200 && l < 240 && isNearNeutral(color) && stripHash(color) !== bgColor;
    });
  const neutral = descriptor.design_tokens.color_palette.neutral.find((color) => {
    const l = luminance(color);
    return l > 180 && l < 240;
  });
  return ensureColor(candidate ?? neutral, "#D9E2EC");
}

function pickSuccessColor(descriptor: IngestedTemplateDescriptor, primary: string): string {
  const directGreen = pickDirectBrandColors(descriptor)
    .find((color) => {
      const { r, g, b } = hexToRgb(color);
      return g > r && g > b;
    });
  return ensureColor(directGreen ?? `#${primary}`, "#2FCF7A");
}

function pickTypography(descriptor: IngestedTemplateDescriptor): NativeTemplate["tokens"]["typography"] {
  const typography = descriptor.design_tokens.typography;
  return {
    title: typography.title_font_ea ?? typography.title_font_latin ?? typography.additional_fonts[0] ?? "Microsoft YaHei",
    body: typography.body_font_ea ?? typography.body_font_latin ?? typography.additional_fonts[0] ?? "Microsoft YaHei",
    mono: typography.additional_fonts.find((font) => /mono|courier|consolas/i.test(font)) ?? "Arial",
    eyebrow: typography.title_font_ea ?? typography.title_font_latin ?? "Microsoft YaHei",
  };
}

function pickSpacing(descriptor: IngestedTemplateDescriptor): NativeTemplate["tokens"]["spacing"] {
  switch (descriptor.design_tokens.layout_rhythm.avg_text_density) {
    case "high":
      return { pagePadding: 44, sectionGap: 18, cardGap: 12, titleGap: 8 };
    case "mid":
      return { pagePadding: 52, sectionGap: 22, cardGap: 14, titleGap: 10 };
    default:
      return { pagePadding: 60, sectionGap: 26, cardGap: 16, titleGap: 12 };
  }
}

function pickRadius(descriptor: IngestedTemplateDescriptor): NativeTemplate["tokens"]["radius"] {
  return descriptor.asset_library.images.length >= 10
    ? { card: 10, pill: 18, image: 8 }
    : { card: 8, pill: 16, image: 6 };
}

function pickStroke(descriptor: IngestedTemplateDescriptor): NativeTemplate["tokens"]["stroke"] {
  return descriptor.design_tokens.layout_rhythm.avg_text_density === "high"
    ? { thin: 1, strong: 1.2 }
    : { thin: 1, strong: 1.4 };
}

function pickShadow(descriptor: IngestedTemplateDescriptor): NativeTemplate["tokens"]["shadow"] {
  return descriptor.design_tokens.layout_rhythm.avg_text_density === "high"
    ? { cardOpacity: 0.05, cardBlur: 2, cardOffset: 1 }
    : { cardOpacity: 0.06, cardBlur: 3, cardOffset: 1 };
}

function createPrimitive(
  id: string,
  kind: NativeTemplatePrimitive["kind"],
  description: string,
  requiredSlots?: string[],
  defaults?: Record<string, string | number | boolean>,
): NativeTemplatePrimitive {
  return {
    id,
    kind,
    description,
    ...(requiredSlots ? { requiredSlots } : {}),
    ...(defaults ? { defaults } : {}),
  };
}

function createPrimitives(descriptor: IngestedTemplateDescriptor): NativeTemplatePrimitive[] {
  const layoutHints = descriptor.layouts_extracted.map((layout) => layout.layoutType).join(", ");
  const imageRich = descriptor.asset_library.images.length >= 6;
  const density = descriptor.design_tokens.layout_rhythm.avg_text_density;
  const hasCompareLayout = descriptor.layouts_extracted.some((layout) => /twoObj|twoTxTwoObj/i.test(layout.layoutType));
  const hasPicLayout = descriptor.layouts_extracted.some((layout) => /picTx|title/i.test(layout.layoutType));
  return [
    createPrimitive(
      "title_block_top_left",
      "title_block",
      `Top-left title block inferred from layouts: ${layoutHints || "generic title layouts"}.`,
      undefined,
      { titleWidth: density === "high" ? 6.8 : density === "mid" ? 7.2 : 7.6 },
    ),
    createPrimitive("hero_panel_image", "hero_panel", imageRich
      ? "Hero panel for image-led cover slides inferred from image-rich template."
      : "Hero panel for cover slides inferred from title and image layouts.", ["hero_bg"], {
        overlayOpacity: density === "low" ? 48 : 36,
      }),
    createPrimitive("info_rail_right", "info_rail", "Compact side rail for metadata, guide tracks or audience info.", undefined, {
      enabled: density === "low",
      width: density === "low" ? 2.14 : 0,
    }),
    createPrimitive("soft_white_card", "card", "Universal rounded content card normalized from the ingested template.", undefined, {
      tocLayout: density === "low" ? "featured_grid" : "balanced_grid",
      comparisonMode: hasCompareLayout ? "versus" : "balanced",
    }),
    createPrimitive("white_panel_image_frame", "image_frame", "Image frame primitive for illustrations, product photos and diagram plates."),
    createPrimitive("index_pill_badge", "badge", "Rounded numeric or label badge derived as a reusable accent primitive."),
    createPrimitive("timeline_node_milestone", "timeline_node", "Milestone node with icon anchor and short event card.", undefined, {
      layoutMode: density === "low" ? "alternating" : "bottom_track",
    }),
    createPrimitive("process_step_column", "process_step", "Vertical or stepped process node used for execution workflows.", undefined, {
      showIllustration: hasPicLayout,
    }),
    createPrimitive("footer_summary_bar", "footer_summary", "Bottom summary/takeaway strip for page-level conclusions."),
  ];
}

function createAssetRules(): NativeTemplateAssetRule[] {
  return [
    { slot: "hero_bg", usage: "required", treatment: "background_cover", variantIds: ["cover_hero_image"] },
    { slot: "bg_texture", usage: "optional", treatment: "texture_overlay", variantIds: ["toc_card_grid_8", "comparison_dual_image", "timeline_horizontal_5", "process_flow_5"] },
    { slot: "left_illustration", usage: "required", treatment: "image_panel", variantIds: ["comparison_dual_image"] },
    { slot: "right_illustration", usage: "required", treatment: "image_panel", variantIds: ["comparison_dual_image"] },
    { slot: "timeline_icon_1", usage: "required", treatment: "icon_badge", variantIds: ["timeline_horizontal_5"] },
    { slot: "timeline_icon_2", usage: "required", treatment: "icon_badge", variantIds: ["timeline_horizontal_5"] },
    { slot: "timeline_icon_3", usage: "required", treatment: "icon_badge", variantIds: ["timeline_horizontal_5"] },
    { slot: "timeline_icon_4", usage: "required", treatment: "icon_badge", variantIds: ["timeline_horizontal_5"] },
    { slot: "timeline_icon_5", usage: "required", treatment: "icon_badge", variantIds: ["timeline_horizontal_5"] },
    { slot: "process_illustration", usage: "optional", treatment: "image_panel", variantIds: ["process_flow_5"] },
    { slot: "scenario_bg", usage: "optional", treatment: "background_cover", variantIds: ["device_triptych_3"] },
    { slot: "device_image_1", usage: "required", treatment: "image_contain", variantIds: ["device_triptych_3"] },
    { slot: "device_image_2", usage: "required", treatment: "image_contain", variantIds: ["device_triptych_3"] },
    { slot: "device_image_3", usage: "required", treatment: "image_contain", variantIds: ["device_triptych_3"] },
  ];
}

function binding(
  variantId: MvpVariantId,
  pageType: NativeTemplateVariantBinding["pageType"],
  requiredPrimitives: string[],
  optionalPrimitives: string[],
  requiredAssetSlots: string[],
  contentRules: string[],
): NativeTemplateVariantBinding {
  return {
    variantId,
    pageType,
    requiredPrimitives,
    optionalPrimitives,
    requiredAssetSlots,
    contentRules,
    notesPolicy: "speaker_notes_first",
  };
}

function createVariantBindings(descriptor: IngestedTemplateDescriptor): NativeTemplateVariantBinding[] {
  const densityRule =
    descriptor.design_tokens.layout_rhythm.avg_text_density === "high"
      ? "Template density is high; keep on-page copy compressed and prefer notes for explanation."
      : "Keep body copy short and let speaker notes carry narrative expansion.";
  const hasCompareLayout = descriptor.layouts_extracted.some((layout) => /twoObj|twoTxTwoObj/i.test(layout.layoutType));
  const hasPicLayout = descriptor.layouts_extracted.some((layout) => /picTx|title|objTx/i.test(layout.layoutType));
  const summaryRule = descriptor.ai_consumable_summary || "Converted from ingested template.";

  return [
    binding(
      "cover_hero_image",
      "cover",
      ["title_block_top_left", "hero_panel_image"],
      ["info_rail_right", "index_pill_badge"],
      ["hero_bg"],
      [
        hasPicLayout ? "Use image-led hero treatment because the source template exposes picture-oriented layouts." : "Keep a strong visual hero treatment even if the source template is text-led.",
        densityRule,
        `Visual source summary: ${summaryRule}`,
      ],
    ),
    binding(
      "toc_card_grid_8",
      "toc",
      ["title_block_top_left", "soft_white_card", "index_pill_badge"],
      ["footer_summary_bar"],
      ["bg_texture"],
      [
        "TOC should organize modules through a single dominant featured item plus compact supporting items.",
        densityRule,
        "Do not allow the page to collapse into a uniform card wall.",
      ],
    ),
    binding(
      "comparison_dual_image",
      "comparison",
      ["title_block_top_left", "soft_white_card", "white_panel_image_frame"],
      ["index_pill_badge"],
      ["left_illustration", "right_illustration"],
      [
        hasCompareLayout ? "Source template contains comparison/two-column layouts; preserve the sense of opposition." : "Force a left-vs-right opposition even if the source template is less structured.",
        densityRule,
        "Primary bullet gets stronger emphasis than support bullets.",
      ],
    ),
    binding(
      "timeline_horizontal_5",
      "timeline",
      ["title_block_top_left", "timeline_node_milestone", "footer_summary_bar"],
      ["soft_white_card"],
      ["timeline_icon_1", "timeline_icon_2", "timeline_icon_3", "timeline_icon_4", "timeline_icon_5"],
      [
        "Timeline keeps five milestones with short year-title-detail compression.",
        densityRule,
        "Bottom takeaway bar summarizes the trend instead of repeating node text.",
      ],
    ),
    binding(
      "process_flow_5",
      "process",
      ["title_block_top_left", "process_step_column"],
      ["white_panel_image_frame", "footer_summary_bar", "soft_white_card"],
      ["process_illustration"],
      [
        "Process page pairs a visual anchor with a step-by-step operational sequence.",
        densityRule,
        "Number, title and one short operational detail per step only.",
      ],
    ),
    binding(
      "device_triptych_3",
      "device_overview",
      ["title_block_top_left", "soft_white_card", "white_panel_image_frame"],
      ["index_pill_badge", "footer_summary_bar", "info_rail_right"],
      ["device_image_1", "device_image_2", "device_image_3"],
      [
        "Device cards should carry scenario tags so product imagery never floats without context.",
        densityRule,
        "Bottom deployment summary aggregates scenario coverage.",
      ],
    ),
  ];
}

function toFamilyId(templateId: string): string {
  return `ingested_${templateId.replace(/[^a-zA-Z0-9_]+/g, "_")}`;
}

function toFamilyName(descriptor: IngestedTemplateDescriptor): string {
  const base = descriptor.source_basename.replace(/\.pptx$/i, "");
  return `${base} Native Template`;
}

function toLayoutBinding(
  variantId: MvpVariantId,
  preset: LayoutPreset | undefined,
): NativeTemplateLayoutBinding | undefined {
  if (!preset) return undefined;
  return {
    variantId,
    sourceSlideIndex: preset.slideIndex,
    sourceSlidePath: preset.slidePath,
    sourceLayoutPath: preset.layoutPath,
    sourceLayoutType: preset.layoutType,
    sourceLayoutName: preset.layoutName,
    candidateRole: preset.candidateRole,
    shapes: preset.shapes.map((shape) => ({ ...shape })),
  };
}

function buildLayoutBindings(extraction: LayoutExtraction | undefined): NativeTemplateLayoutBinding[] {
  if (!extraction) return [];
  return [
    toLayoutBinding("cover_hero_image", findTemplateCoverPreset(extraction)),
    toLayoutBinding("toc_card_grid_8", findTemplateTocPreset(extraction)),
    toLayoutBinding("comparison_dual_image", findTemplateComparisonPreset(extraction)),
    toLayoutBinding("timeline_horizontal_5", findTemplateTimelinePreset(extraction)),
    toLayoutBinding("process_flow_5", findTemplateProcessPreset(extraction)),
    toLayoutBinding("device_triptych_3", findTemplateDevicePreset(extraction)),
  ].filter((binding): binding is NativeTemplateLayoutBinding => Boolean(binding));
}

export function convertIngestedTemplateToNative(
  descriptor: IngestedTemplateDescriptor,
  opts?: ConvertOptions,
): NativeTemplate {
  const primary = pickPrimaryColor(descriptor);
  const accent = pickAccentColor(descriptor, primary);
  const text = pickTextColor(descriptor);
  const textMuted = pickMutedTextColor(descriptor, text);
  const bg = pickBgColor(descriptor);
  const outline = pickOutlineColor(descriptor, bg);
  const success = pickSuccessColor(descriptor, primary);

  return {
    version: "native_template/v1",
    templateId: `${descriptor.template_id}-native`,
    familyId: toFamilyId(descriptor.template_id),
    familyName: toFamilyName(descriptor),
    source: {
      kind: "ingested_template",
      templateJsonPath: opts?.templateJsonPath ?? descriptor.source_file,
      presetId: descriptor.template_id,
    },
    tokens: {
      colors: {
        bg,
        surface: "FFFFFF",
        text,
        textMuted,
        primary,
        accent,
        outline,
        success,
      },
      typography: pickTypography(descriptor),
      spacing: pickSpacing(descriptor),
      radius: pickRadius(descriptor),
      stroke: pickStroke(descriptor),
      shadow: pickShadow(descriptor),
    },
    primitives: createPrimitives(descriptor),
    variantBindings: createVariantBindings(descriptor),
    assetRules: createAssetRules(),
    layoutBindings: buildLayoutBindings(opts?.layoutExtraction),
    notes: [
      `Converted from ingested template ${descriptor.template_id}.`,
      `Template summary: ${descriptor.ai_consumable_summary}`,
      `Layout count: ${descriptor.design_tokens.layout_rhythm.layout_count}, page count: ${descriptor.design_tokens.layout_rhythm.page_count}, density: ${descriptor.design_tokens.layout_rhythm.avg_text_density}.`,
      descriptor.design_tokens.color_palette.override_scheme
        ? "Brand colors were primarily derived from the template's override color scheme."
        : preferDirectPalette(descriptor)
          ? "Brand colors were primarily derived from direct slide palette usage because the source theme looked like the default Office palette."
          : "Brand colors were derived from the resolved theme palette and direct slide usage together.",
    ],
  };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const descriptor = JSON.parse(await readFile(cli.inputPath, "utf-8")) as IngestedTemplateDescriptor;
  const layoutPresetsPath = resolve(dirname(cli.inputPath), "layout-presets.json");
  let layoutExtraction: LayoutExtraction | undefined;
  try {
    await access(layoutPresetsPath);
    layoutExtraction = JSON.parse(await readFile(layoutPresetsPath, "utf-8")) as LayoutExtraction;
  } catch {
    layoutExtraction = undefined;
  }
  const nativeTemplate = convertIngestedTemplateToNative(descriptor, {
    templateJsonPath: cli.inputPath,
    layoutExtraction,
  });
  const validation = validateNativeTemplate(nativeTemplate);
  if (!validation.valid) {
    throw new Error(`Converted native template failed validation:\n${(validation.errors ?? []).join("\n")}`);
  }
  await mkdir(dirname(cli.outputPath), { recursive: true });
  await writeFile(cli.outputPath, JSON.stringify(nativeTemplate, null, 2), "utf-8");
  console.log(JSON.stringify({
    inputPath: cli.inputPath,
    outputPath: cli.outputPath,
    templateId: nativeTemplate.templateId,
    familyId: nativeTemplate.familyId,
  }, null, 2));
}

if (import.meta.main) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
