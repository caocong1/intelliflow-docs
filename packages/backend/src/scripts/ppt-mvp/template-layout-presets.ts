import { access, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { NativeTemplate, NativeTemplateLayoutBinding } from "./types";
import type { LayoutExtraction, LayoutPreset, SlideShapeBox } from "./extract-template-layout-presets";

export type TemplateLayoutPresetRuntime = {
  extraction: LayoutExtraction;
  coverPreset?: LayoutPreset;
  tocPreset?: LayoutPreset;
  comparisonPreset?: LayoutPreset;
  timelinePreset?: LayoutPreset;
  processPreset?: LayoutPreset;
  devicePreset?: LayoutPreset;
  resolveShapeMediaPath: (shape: SlideShapeBox | undefined) => string | undefined;
};

function resolveMediaPath(templateJsonPath: string, mediaTarget: string | undefined): string | undefined {
  if (!mediaTarget) return undefined;
  const fileName = basename(mediaTarget);
  return join(dirname(templateJsonPath), "media", fileName);
}

function isCoverPreset(preset: LayoutPreset, slideSize: LayoutExtraction["slideSize"]): boolean {
  const largeImage = preset.shapes.some(
    (shape) =>
      shape.kind === "image" &&
      shape.w >= slideSize.cx * 0.9 &&
      shape.h >= slideSize.cy * 0.9,
  );
  const titleLike = preset.shapes.filter((shape) => shape.kind === "text" && (shape.textSample?.length ?? 0) >= 6);
  return largeImage && titleLike.length >= 2;
}

function isTocPreset(preset: LayoutPreset): boolean {
  return preset.shapes.some((shape) => {
    const text = shape.textSample ?? "";
    return text.includes("目录") || /contents/i.test(text);
  });
}

export function findTemplateCoverPreset(extraction: LayoutExtraction): LayoutPreset | undefined {
  return extraction.presets
    .filter((preset) => isCoverPreset(preset, extraction.slideSize))
    .sort((a, b) => a.slideIndex - b.slideIndex)[0];
}

export function findTemplateTocPreset(extraction: LayoutExtraction): LayoutPreset | undefined {
  return extraction.presets
    .filter((preset) => isTocPreset(preset))
    .sort((a, b) => a.slideIndex - b.slideIndex)[0];
}

function isComparisonPreset(preset: LayoutPreset): boolean {
  const largeImages = preset.shapes.filter(
    (shape) => shape.kind === "image" && shape.w > 3_000_000 && shape.h > 2_000_000,
  );
  return largeImages.length >= 2;
}

export function findTemplateComparisonPreset(extraction: LayoutExtraction): LayoutPreset | undefined {
  return extraction.presets
    .filter((preset) => isComparisonPreset(preset))
    .sort((a, b) => a.slideIndex - b.slideIndex)[0];
}

function isTimelinePreset(preset: LayoutPreset): boolean {
  const bodyPanels = preset.shapes.filter(
    (shape) =>
      shape.kind === "text" &&
      shape.w >= 4_000_000 &&
      shape.h >= 700_000 &&
      shape.y >= 2_400_000,
  );
  const titleBlocks = preset.shapes.filter(
    (shape) =>
      shape.kind === "text" &&
      shape.w >= 1_500_000 &&
      shape.w <= 2_200_000 &&
      shape.h <= 500_000 &&
      shape.y >= 1_800_000,
  );
  return bodyPanels.length >= 4 && titleBlocks.length >= 4;
}

export function findTemplateTimelinePreset(extraction: LayoutExtraction): LayoutPreset | undefined {
  return extraction.presets
    .filter((preset) => isTimelinePreset(preset))
    .sort((a, b) => a.slideIndex - b.slideIndex)[0];
}

function isProcessPreset(preset: LayoutPreset): boolean {
  const wideTextBlocks = preset.shapes.filter(
    (shape) =>
      shape.kind === "text" &&
      shape.w >= 1_800_000 &&
      shape.w <= 2_200_000 &&
      shape.h >= 1_800_000 &&
      shape.y >= 3_000_000,
  );
  return wideTextBlocks.length >= 4;
}

export function findTemplateProcessPreset(extraction: LayoutExtraction): LayoutPreset | undefined {
  return extraction.presets
    .filter((preset) => isProcessPreset(preset))
    .sort((a, b) => a.slideIndex - b.slideIndex)[0];
}

function isDevicePreset(preset: LayoutPreset): boolean {
  const topGroups = preset.shapes.filter(
    (shape) => shape.kind === "group" && shape.w >= 900_000 && shape.w <= 1_300_000 && shape.y >= 1_800_000 && shape.y <= 2_300_000,
  );
  const lowerTextBlocks = preset.shapes.filter(
    (shape) => shape.kind === "text" && shape.w >= 1_800_000 && shape.w <= 2_200_000 && shape.h >= 1_800_000 && shape.y >= 3_000_000,
  );
  return topGroups.length >= 4 && lowerTextBlocks.length >= 4;
}

export function findTemplateDevicePreset(extraction: LayoutExtraction): LayoutPreset | undefined {
  return extraction.presets
    .filter((preset) => isDevicePreset(preset))
    .sort((a, b) => a.slideIndex - b.slideIndex)[0];
}

export function emuToInches(value: number): number {
  return value / 914400;
}

export function findLargestImage(preset: LayoutPreset | undefined): SlideShapeBox | undefined {
  return preset?.shapes
    .filter((shape) => shape.kind === "image")
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
}

export function findLargestText(preset: LayoutPreset | undefined): SlideShapeBox | undefined {
  return preset?.shapes
    .filter((shape) => shape.kind === "text")
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
}

export function findTextByPattern(
  preset: LayoutPreset | undefined,
  pattern: RegExp,
): SlideShapeBox | undefined {
  return preset?.shapes.find((shape) => shape.kind === "text" && pattern.test(shape.textSample ?? ""));
}

export function findRoundedBadgeTexts(preset: LayoutPreset | undefined): SlideShapeBox[] {
  return (preset?.shapes ?? [])
    .filter((shape) => shape.kind === "text" && /^\d{2}$/.test((shape.textSample ?? "").trim()))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export async function loadTemplateLayoutPresetRuntime(
  nativeTemplate: NativeTemplate | undefined,
): Promise<TemplateLayoutPresetRuntime | undefined> {
  if (!nativeTemplate || nativeTemplate.source.kind !== "ingested_template") {
    return undefined;
  }
  if (nativeTemplate.layoutBindings.length > 0) {
    const extraction = bindingsToExtraction(nativeTemplate);
    return {
      extraction,
      coverPreset: findTemplateCoverPreset(extraction),
      tocPreset: findTemplateTocPreset(extraction),
      comparisonPreset: findTemplateComparisonPreset(extraction),
      timelinePreset: findTemplateTimelinePreset(extraction),
      processPreset: findTemplateProcessPreset(extraction),
      devicePreset: findTemplateDevicePreset(extraction),
      resolveShapeMediaPath: (shape) => resolveMediaPath(nativeTemplate.source.templateJsonPath, shape?.mediaTarget),
    };
  }
  const layoutPresetPath = resolve(dirname(nativeTemplate.source.templateJsonPath), "layout-presets.json");
  try {
    await access(layoutPresetPath);
  } catch {
    return undefined;
  }
  const extraction = JSON.parse(await readFile(layoutPresetPath, "utf-8")) as LayoutExtraction;
  return {
    extraction,
    coverPreset: findTemplateCoverPreset(extraction),
    tocPreset: findTemplateTocPreset(extraction),
    comparisonPreset: findTemplateComparisonPreset(extraction),
    timelinePreset: findTemplateTimelinePreset(extraction),
    processPreset: findTemplateProcessPreset(extraction),
    devicePreset: findTemplateDevicePreset(extraction),
    resolveShapeMediaPath: (shape) => resolveMediaPath(nativeTemplate.source.templateJsonPath, shape?.mediaTarget),
  };
}

function bindingToPreset(binding: NativeTemplateLayoutBinding): LayoutPreset {
  return {
    slideIndex: binding.sourceSlideIndex,
    slidePath: binding.sourceSlidePath,
    layoutPath: binding.sourceLayoutPath,
    layoutType: binding.sourceLayoutType,
    layoutName: binding.sourceLayoutName,
    candidateRole: binding.candidateRole ?? "unknown",
    shapeCount: binding.shapes.length,
    imageCount: binding.shapes.filter((shape) => shape.kind === "image").length,
    textCount: binding.shapes.filter((shape) => shape.kind === "text").length,
    shapes: binding.shapes.map((shape) => ({ ...shape })),
  };
}

function bindingsToExtraction(nativeTemplate: NativeTemplate): LayoutExtraction {
  return {
    version: "template_layout_presets/v1",
    pptxPath: nativeTemplate.source.kind === "ingested_template" ? nativeTemplate.source.templateJsonPath : "",
    slideSize: {
      cx: 12192000,
      cy: 6858000,
    },
    extractedAt: new Date().toISOString(),
    presets: nativeTemplate.layoutBindings.map(bindingToPreset),
  };
}
