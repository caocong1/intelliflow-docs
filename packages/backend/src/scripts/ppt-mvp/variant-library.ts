import type PptxGenJS from "pptxgenjs";
import type { CanvasRenderModel, FittedPageSlots, NativeTemplate } from "./types";
import {
  addFamilySoftPanel,
  addFamilyPageMarker,
  setActiveFamilyTemplate,
  addFamilyText,
  addFamilyTextureBackground,
  addFamilyTitleBlock,
  addImageContainOrPlaceholder,
  addImageCover as addFamilyImageCover,
} from "./family-primitives";
import {
  getPrimitiveBoolean,
  getPrimitiveNumber,
  getPrimitiveString,
  hasTemplatePrimitive,
} from "./native-template";
import {
  emuToInches,
  findTemplateComparisonPreset,
  findLargestImage,
  findLargestText,
  findTextByPattern,
  type TemplateLayoutPresetRuntime,
} from "./template-layout-presets";
export { MVP_VARIANT_SCHEMAS as VARIANT_SCHEMAS } from "./family-library";

export const MVP_THEME: CanvasRenderModel["theme"] = {
  colors: {
    bg: "F5F7F8",
    surface: "FFFFFF",
    text: "1F2937",
    textMuted: "667085",
    primary: "2FCF7A",
    accent: "1F3147",
    outline: "D9E2EC",
    success: "2FCF7A",
  },
  fonts: {
    title: "Microsoft YaHei",
    body: "Microsoft YaHei",
    mono: "Arial",
  },
};

let ACTIVE_THEME: CanvasRenderModel["theme"] = MVP_THEME;
let ACTIVE_TEMPLATE: NativeTemplate | undefined;

function addCard(slide: PptxGenJS.Slide, opts: {
  x: number; y: number; w: number; h: number; fill?: string; stroke?: string; radius?: number;
}) {
  slide.addShape("roundRect" as never, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    rectRadius: opts.radius ?? 0.08,
    fill: { color: opts.fill ?? ACTIVE_THEME.colors.surface },
    line: { color: opts.stroke ?? ACTIVE_THEME.colors.outline, width: 1 },
  });
}

function addSoftPanel(slide: PptxGenJS.Slide, opts: {
  x: number; y: number; w: number; h: number; fill?: string; stroke?: string; radius?: number;
}) {
  addFamilySoftPanel(slide, opts);
}

function addText(slide: PptxGenJS.Slide, text: string, opts: {
  x: number; y: number; w: number; h: number; size?: number; color?: string; bold?: boolean; align?: "left" | "center" | "right";
}) {
  addFamilyText(slide, ACTIVE_THEME, text, opts);
}

function addImageOrPlaceholder(slide: PptxGenJS.Slide, imagePath: string | undefined, box: { x: number; y: number; w: number; h: number }) {
  addImageContainOrPlaceholder(slide, ACTIVE_THEME, imagePath, box);
}

function addImageCover(slide: PptxGenJS.Slide, imagePath: string | undefined, box: { x: number; y: number; w: number; h: number }) {
  addFamilyImageCover(slide, imagePath, box);
}

function addMutedTextureBg(slide: PptxGenJS.Slide, imagePath: string | undefined) {
  addFamilyTextureBackground(slide, imagePath);
}

function splitCoverSubtitle(subtitle: string): string[] {
  return subtitle
    .split(/[·•｜|/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function splitScenarioTags(scenario: string): string[] {
  return scenario
    .split(/[\/／]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function renderExtractedTemplateCover(
  slide: PptxGenJS.Slide,
  page: FittedPageSlots,
  runtime: TemplateLayoutPresetRuntime,
) {
  const preset = runtime.coverPreset;
  if (!preset) return false;
  const bgShape = findLargestImage(preset);
  const bgPath = runtime.resolveShapeMediaPath(bgShape);
  const eyebrowShape = findTextByPattern(preset, /business/i);
  const titleShape = preset.shapes
    .filter((shape) => shape.kind === "text" && (shape.textSample ?? "").includes("部门复盘总结"))
    .sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? findLargestText(preset);
  const subtitleShape = preset.shapes
    .filter((shape) => shape.kind === "text" && (shape.textSample ?? "").includes("Please click here"))
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const chipShapes = preset.shapes
    .filter((shape) => shape.kind === "text" && /汇报人|日期/.test(shape.textSample ?? ""))
    .sort((a, b) => a.x - b.x);

  if (bgPath) {
    addImageCover(slide, bgPath, { x: 0, y: 0, w: 13.33, h: 7.5 });
  }
  slide.addShape("rect" as never, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
    fill: { color: "102033", transparency: 34 },
    line: { color: "102033", transparency: 100 },
  });

  if (eyebrowShape) {
    addText(slide, String(page.slots.eyebrow ?? ""), {
      x: emuToInches(eyebrowShape.x),
      y: emuToInches(eyebrowShape.y),
      w: emuToInches(eyebrowShape.w),
      h: emuToInches(eyebrowShape.h),
      size: 10,
      color: "F8C04A",
      bold: true,
    });
  }
  if (titleShape) {
    addText(slide, String(page.slots.title ?? ""), {
      x: emuToInches(titleShape.x),
      y: emuToInches(titleShape.y),
      w: emuToInches(titleShape.w),
      h: emuToInches(titleShape.h),
      size: 29,
      color: "FFFFFF",
      bold: true,
    });
  }
  if (subtitleShape) {
    addText(slide, String(page.slots.subtitle ?? ""), {
      x: emuToInches(subtitleShape.x),
      y: emuToInches(subtitleShape.y),
      w: emuToInches(subtitleShape.w),
      h: emuToInches(subtitleShape.h),
      size: 15.5,
      color: "E8EEF5",
      bold: true,
    });
  }

  const subtitleParts = splitCoverSubtitle(String(page.slots.subtitle ?? ""));
  chipShapes.slice(0, 2).forEach((shape, idx) => {
    const x = emuToInches(shape.x);
    const y = emuToInches(shape.y);
    const w = emuToInches(shape.w);
    const h = emuToInches(shape.h);
    addSoftPanel(slide, {
      x,
      y,
      w,
      h,
      fill: idx === 0 ? MVP_THEME.colors.primary : MVP_THEME.colors.success,
      stroke: idx === 0 ? MVP_THEME.colors.primary : MVP_THEME.colors.success,
      radius: 0.16,
    });
    addText(slide, subtitleParts[idx] ?? String(page.slots.audienceLine ?? ""), {
      x: x + 0.12,
      y: y + 0.1,
      w: w - 0.24,
      h: h - 0.16,
      size: 9,
      color: "FFFFFF",
      bold: true,
      align: "center",
    });
  });

  addText(slide, String(page.slots.audienceLine ?? ""), {
    x: 1.26,
    y: 6.34,
    w: 5.2,
    h: 0.22,
    size: 11.5,
    color: "E6ECF3",
  });
  return true;
}

function renderExtractedTemplateToc(
  slide: PptxGenJS.Slide,
  page: FittedPageSlots,
  runtime: TemplateLayoutPresetRuntime,
) {
  const preset = runtime.tocPreset;
  if (!preset) return false;
  const bgShape = findLargestImage(preset);
  const bgPath = runtime.resolveShapeMediaPath(bgShape);
  const titleZh = findTextByPattern(preset, /目|录/);
  const titleEn = findTextByPattern(preset, /contents/i);
  const items = Array.isArray(page.slots.items) ? page.slots.items as Array<Record<string, string>> : [];
  const cardGroups = preset.shapes
    .filter((shape) => shape.kind === "group" && shape.w >= 3_000_000 && shape.w <= 3_600_000 && shape.h >= 650_000 && shape.h <= 850_000)
    .sort((a, b) => a.y - b.y)
    .slice(0, 4);
  const numberTexts = preset.shapes
    .filter((shape) => shape.kind === "text" && /^\d{2}$/.test((shape.textSample ?? "").trim()))
    .sort((a, b) => a.y - b.y)
    .slice(0, 4);

  if (bgPath) {
    addImageCover(slide, bgPath, { x: 0, y: 0, w: 13.33, h: 7.5 });
  }
  slide.addShape("rect" as never, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
    fill: { color: "FFFFFF", transparency: 18 },
    line: { color: "FFFFFF", transparency: 100 },
  });

  if (titleZh) {
    const title = String(page.slots.title ?? "");
    addText(slide, title.length === 2 ? `${title[0]}\n      ${title[1]}` : title, {
      x: emuToInches(titleZh.x),
      y: emuToInches(titleZh.y),
      w: emuToInches(titleZh.w),
      h: emuToInches(titleZh.h),
      size: 42,
      color: "FFFFFF",
      bold: true,
    });
  }
  if (titleEn) {
    addText(slide, String(page.slots.eyebrow ?? "CONTENTS"), {
      x: emuToInches(titleEn.x) + 0.1,
      y: emuToInches(titleEn.y) + 0.2,
      w: 0.48,
      h: 1.9,
      size: 8.5,
      color: "FFFFFF",
      bold: true,
    });
  }

  const groupedItems = Array.from({ length: Math.ceil(items.length / 2) }, (_, idx) => items.slice(idx * 2, idx * 2 + 2)).slice(0, 4);
  groupedItems.forEach((groupItems, idx) => {
    const frame = cardGroups[idx];
    if (!frame) return;
    const x = emuToInches(frame.x);
    const y = emuToInches(frame.y);
    const w = emuToInches(frame.w);
    const h = emuToInches(frame.h);
    const numberShape = numberTexts[idx];
    addSoftPanel(slide, {
      x,
      y,
      w,
      h,
      fill: "FFFFFF",
      stroke: "E7EEF3",
      radius: 0.14,
    });
    if (numberShape) {
      addSoftPanel(slide, {
        x: emuToInches(numberShape.x) - 0.02,
        y: emuToInches(numberShape.y) - 0.04,
        w: emuToInches(numberShape.w) + 0.02,
        h: emuToInches(numberShape.h) + 0.06,
        fill: idx % 2 === 0 ? "2A5BAA" : "91CF50",
        stroke: idx % 2 === 0 ? "2A5BAA" : "91CF50",
        radius: 0.22,
      });
      addText(slide, groupItems.map((item) => item.index ?? "").filter(Boolean).join("-"), {
        x: emuToInches(numberShape.x) - 0.02,
        y: emuToInches(numberShape.y) + 0.04,
        w: emuToInches(numberShape.w) + 0.02,
        h: emuToInches(numberShape.h),
        size: 8.5,
        color: "FFFFFF",
        bold: true,
        align: "center",
      });
    }
    const textX = x + 1.16;
    addText(slide, groupItems[0]?.title ?? "", {
      x: textX,
      y: y + 0.12,
      w: w - 1.32,
      h: 0.18,
      size: 15,
      bold: true,
      color: MVP_THEME.colors.text,
    });
    if (groupItems[1]) {
      addText(slide, groupItems[1].title ?? "", {
        x: textX,
        y: y + 0.34,
        w: w - 1.32,
        h: 0.16,
        size: 11.5,
        bold: true,
        color: MVP_THEME.colors.text,
      });
    }
    addText(
      slide,
      groupItems
        .map((item) => item.subtitle ?? "")
        .filter(Boolean)
        .join(" | "),
      {
        x: textX,
        y: y + 0.56,
        w: w - 1.32,
        h: 0.14,
        size: 8,
        color: MVP_THEME.colors.textMuted,
      },
    );
  });
  return true;
}

function renderExtractedTemplateComparison(
  slide: PptxGenJS.Slide,
  page: FittedPageSlots,
  assets: Record<string, string | undefined>,
  runtime: TemplateLayoutPresetRuntime,
) {
  const preset = runtime.comparisonPreset ?? findTemplateComparisonPreset(runtime.extraction);
  if (!preset) return false;
  const titleShape = findLargestText(preset);
  const images = preset.shapes
    .filter((shape) => shape.kind === "image")
    .sort((a, b) => a.x - b.x)
    .slice(0, 2);
  if (images.length < 2) return false;
  const infoPill = preset.shapes.find((shape) => shape.kind === "text" && (shape.textSample ?? "").includes("添加标题"));
  const bottomPanel = preset.shapes
    .filter((shape) => shape.kind === "shape" && shape.w > 7_000_000 && shape.h > 1_500_000)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const leftBullets = Array.isArray(page.slots.leftBullets) ? page.slots.leftBullets as string[] : [];
  const rightBullets = Array.isArray(page.slots.rightBullets) ? page.slots.rightBullets as string[] : [];

  slide.background = { color: "FFFFFF" };

  if (titleShape) {
    addText(slide, String(page.slots.title ?? ""), {
      x: emuToInches(titleShape.x),
      y: emuToInches(titleShape.y),
      w: 4.8,
      h: emuToInches(titleShape.h),
      size: 24,
      color: MVP_THEME.colors.text,
      bold: true,
    });
  }

  const [leftImage, rightImage] = images;
  addImageOrPlaceholder(slide, assets.left_illustration, {
    x: emuToInches(leftImage.x),
    y: emuToInches(leftImage.y),
    w: emuToInches(leftImage.w),
    h: emuToInches(leftImage.h),
  });
  addImageOrPlaceholder(slide, assets.right_illustration, {
    x: emuToInches(rightImage.x),
    y: emuToInches(rightImage.y),
    w: emuToInches(rightImage.w),
    h: emuToInches(rightImage.h),
  });

  if (infoPill) {
    const x = emuToInches(infoPill.x);
    const y = emuToInches(infoPill.y);
    const w = emuToInches(infoPill.w);
    const h = emuToInches(infoPill.h);
    addSoftPanel(slide, {
      x,
      y,
      w,
      h,
      fill: "2A5BAA",
      stroke: "2A5BAA",
      radius: 0.18,
    });
    addText(slide, String(page.slots.leftTitle ?? ""), {
      x: x + 0.1,
      y: y + 0.08,
      w: w - 0.2,
      h: h - 0.16,
      size: 10,
      color: "FFFFFF",
      bold: true,
      align: "center",
    });
  }

  const panelX = bottomPanel ? emuToInches(bottomPanel.x) : 4.2;
  const panelY = bottomPanel ? emuToInches(bottomPanel.y) : 4.12;
  const panelW = bottomPanel ? emuToInches(bottomPanel.w) : 8.7;
  const panelH = bottomPanel ? emuToInches(bottomPanel.h) : 2.0;
  addSoftPanel(slide, {
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    fill: "FFFFFF",
    stroke: "E7EEF3",
    radius: 0.12,
  });

  addText(slide, String(page.slots.leftTitle ?? ""), {
    x: panelX + 0.32,
    y: panelY + 0.18,
    w: 2.6,
    h: 0.22,
    size: 16,
    color: "2A5BAA",
    bold: true,
  });
  addText(slide, String(page.slots.rightTitle ?? ""), {
    x: panelX + panelW / 2 + 0.16,
    y: panelY + 0.18,
    w: 2.6,
    h: 0.22,
    size: 16,
    color: "91CF50",
    bold: true,
  });

  leftBullets.slice(0, 3).forEach((bullet, idx) => {
    addText(slide, `• ${bullet}`, {
      x: panelX + 0.32,
      y: panelY + 0.56 + idx * 0.34,
      w: panelW / 2 - 0.46,
      h: 0.18,
      size: 9,
      color: MVP_THEME.colors.textMuted,
    });
  });
  rightBullets.slice(0, 3).forEach((bullet, idx) => {
    addText(slide, `• ${bullet}`, {
      x: panelX + panelW / 2 + 0.16,
      y: panelY + 0.56 + idx * 0.34,
      w: panelW / 2 - 0.46,
      h: 0.18,
      size: 9,
      color: MVP_THEME.colors.textMuted,
    });
  });

  return true;
}

function renderExtractedTemplateTimeline(
  slide: PptxGenJS.Slide,
  page: FittedPageSlots,
  runtime: TemplateLayoutPresetRuntime,
) {
  const preset = runtime.timelinePreset;
  if (!preset) return false;
  const titleShape = preset.shapes
    .filter((shape) => shape.kind === "text" && shape.y < 1_000_000)
    .sort((a, b) => a.x - b.x || a.y - b.y)[0];
  const titleBlocks = preset.shapes
    .filter(
      (shape) =>
        shape.kind === "text" &&
        shape.w >= 1_500_000 &&
        shape.w <= 2_200_000 &&
        shape.h <= 500_000 &&
        shape.y >= 1_800_000,
    )
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, 4);
  const bodyBlocks = preset.shapes
    .filter(
      (shape) =>
        shape.kind === "text" &&
        shape.w >= 4_000_000 &&
        shape.h >= 700_000 &&
        shape.y >= 2_400_000,
    )
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, 4);
  const nodes = Array.isArray(page.slots.nodes) ? page.slots.nodes as Array<Record<string, string>> : [];
  if (titleBlocks.length < 4 || bodyBlocks.length < 4) return false;

  slide.background = { color: "FFFFFF" };
  if (titleShape) {
    addText(slide, String(page.slots.title ?? ""), {
      x: emuToInches(titleShape.x),
      y: emuToInches(titleShape.y),
      w: 4.8,
      h: emuToInches(titleShape.h),
      size: 23,
      color: MVP_THEME.colors.text,
      bold: true,
    });
  }
  addText(slide, String(page.slots.eyebrow ?? ""), {
    x: titleShape ? emuToInches(titleShape.x) : 1.02,
    y: titleShape ? emuToInches(titleShape.y) + 0.54 : 0.92,
    w: 2.2,
    h: 0.16,
    size: 9,
    color: MVP_THEME.colors.textMuted,
    bold: true,
  });

  nodes.slice(0, 4).forEach((node, idx) => {
    const titleBox = titleBlocks[idx];
    const bodyBox = bodyBlocks[idx];
    const x = emuToInches(bodyBox.x);
    const y = emuToInches(bodyBox.y);
    const w = emuToInches(bodyBox.w);
    const h = emuToInches(bodyBox.h);
    addSoftPanel(slide, {
      x,
      y,
      w,
      h,
      fill: "FFFFFF",
      stroke: "E7EEF3",
      radius: 0.14,
    });
    addSoftPanel(slide, {
      x: x + 0.18,
      y: y + 0.16,
      w: 0.9,
      h: 0.32,
      fill: idx % 2 === 0 ? "2A5BAA" : "91CF50",
      stroke: idx % 2 === 0 ? "2A5BAA" : "91CF50",
      radius: 0.16,
    });
    addText(slide, node.year ?? "", {
      x: x + 0.18,
      y: y + 0.24,
      w: 0.9,
      h: 0.12,
      size: 8.5,
      color: "FFFFFF",
      bold: true,
      align: "center",
    });
    addText(slide, node.title ?? "", {
      x: emuToInches(titleBox.x),
      y: emuToInches(titleBox.y) + 0.06,
      w: emuToInches(titleBox.w),
      h: emuToInches(titleBox.h),
      size: 13,
      color: MVP_THEME.colors.text,
      bold: true,
    });
    addText(slide, node.detail ?? "", {
      x: x + 0.18,
      y: y + 0.66,
      w: w - 0.36,
      h: h - 0.82,
      size: 8.8,
      color: MVP_THEME.colors.textMuted,
    });
  });

  const node5 = nodes[4];
  if (node5) {
    addSoftPanel(slide, {
      x: 1.12,
      y: 6.18,
      w: 11.0,
      h: 0.68,
      fill: "EEF9F4",
      stroke: "D7F5E5",
      radius: 0.16,
    });
    addText(slide, `${node5.year ?? ""} ${node5.title ?? ""}`.trim(), {
      x: 1.34,
      y: 6.34,
      w: 2.6,
      h: 0.16,
      size: 10,
      color: MVP_THEME.colors.primary,
      bold: true,
    });
    addText(slide, node5.detail ?? String(page.slots.summary ?? ""), {
      x: 3.26,
      y: 6.34,
      w: 8.1,
      h: 0.16,
      size: 9,
      color: MVP_THEME.colors.text,
    });
  }

  return true;
}

function renderExtractedTemplateProcess(
  slide: PptxGenJS.Slide,
  page: FittedPageSlots,
  runtime: TemplateLayoutPresetRuntime,
) {
  const preset = runtime.processPreset;
  if (!preset) return false;
  const titleShape = preset.shapes
    .filter((shape) => shape.kind === "text" && shape.y < 1_000_000)
    .sort((a, b) => a.x - b.x || a.y - b.y)[0];
  const steps = Array.isArray(page.slots.steps) ? page.slots.steps as Array<Record<string, string>> : [];
  const columnShapes = preset.shapes
    .filter(
      (shape) =>
        shape.kind === "text" &&
        shape.w >= 1_800_000 &&
        shape.w <= 2_200_000 &&
        shape.h >= 1_800_000 &&
        shape.y >= 3_000_000,
    )
    .sort((a, b) => a.x - b.x)
    .slice(0, 4);
  const topAnchors = preset.shapes
    .filter((shape) => shape.kind === "group" && shape.w >= 1_000_000 && shape.h >= 1_000_000 && shape.y < 3_000_000)
    .sort((a, b) => a.x - b.x)
    .slice(0, 4);

  if (columnShapes.length < 4) return false;
  slide.background = { color: "FFFFFF" };
  if (titleShape) {
    addText(slide, String(page.slots.title ?? ""), {
      x: emuToInches(titleShape.x),
      y: emuToInches(titleShape.y),
      w: 4.8,
      h: emuToInches(titleShape.h),
      size: 23,
      color: MVP_THEME.colors.text,
      bold: true,
    });
  }
  addText(slide, String(page.slots.eyebrow ?? ""), {
    x: titleShape ? emuToInches(titleShape.x) : 1.02,
    y: titleShape ? emuToInches(titleShape.y) + 0.54 : 0.92,
    w: 1.8,
    h: 0.16,
    size: 9,
    color: MVP_THEME.colors.textMuted,
    bold: true,
  });

  steps.slice(0, 4).forEach((step, idx) => {
    const column = columnShapes[idx];
    const anchor = topAnchors[idx];
    const x = emuToInches(column.x);
    const y = emuToInches(column.y);
    const w = emuToInches(column.w);
    const h = emuToInches(column.h);
    addSoftPanel(slide, {
      x,
      y,
      w,
      h,
      fill: "FFFFFF",
      stroke: "E7EEF3",
      radius: 0.14,
    });
    if (anchor) {
      addSoftPanel(slide, {
        x: emuToInches(anchor.x) + 0.12,
        y: emuToInches(anchor.y) + 0.38,
        w: 0.76,
        h: 0.38,
        fill: idx % 2 === 0 ? "2A5BAA" : "91CF50",
        stroke: idx % 2 === 0 ? "2A5BAA" : "91CF50",
        radius: 0.18,
      });
      addText(slide, step.index ?? String(idx + 1).padStart(2, "0"), {
        x: emuToInches(anchor.x) + 0.12,
        y: emuToInches(anchor.y) + 0.48,
        w: 0.76,
        h: 0.12,
        size: 8.5,
        color: "FFFFFF",
        bold: true,
        align: "center",
      });
    }
    addText(slide, step.title ?? "", {
      x: x + 0.18,
      y: y + 0.18,
      w: w - 0.36,
      h: 0.22,
      size: 15,
      color: MVP_THEME.colors.text,
      bold: true,
    });
    addText(slide, step.detail ?? "", {
      x: x + 0.18,
      y: y + 0.5,
      w: w - 0.36,
      h: h - 0.66,
      size: 8.8,
      color: MVP_THEME.colors.textMuted,
    });
  });

  const step5 = steps[4];
  if (step5) {
    addSoftPanel(slide, {
      x: 1.12,
      y: 6.14,
      w: 11.0,
      h: 0.7,
      fill: "EEF9F4",
      stroke: "D7F5E5",
      radius: 0.16,
    });
    addText(slide, `${step5.index ?? "05"} ${step5.title ?? ""}`, {
      x: 1.38,
      y: 6.32,
      w: 2.1,
      h: 0.16,
      size: 10,
      color: MVP_THEME.colors.primary,
      bold: true,
    });
    addText(slide, step5.detail ?? "", {
      x: 3.02,
      y: 6.32,
      w: 8.4,
      h: 0.16,
      size: 9,
      color: MVP_THEME.colors.text,
    });
  }
  return true;
}

function renderExtractedTemplateDevice(
  slide: PptxGenJS.Slide,
  page: FittedPageSlots,
  assets: Record<string, string | undefined>,
  runtime: TemplateLayoutPresetRuntime,
) {
  const preset = runtime.devicePreset;
  if (!preset) return false;
  const titleShape = preset.shapes
    .filter((shape) => shape.kind === "text" && shape.y < 1_000_000)
    .sort((a, b) => a.x - b.x || a.y - b.y)[0];
  const iconGroups = preset.shapes
    .filter(
      (shape) =>
        shape.kind === "group" &&
        shape.w >= 900_000 &&
        shape.w <= 1_300_000 &&
        shape.y >= 1_800_000 &&
        shape.y <= 2_300_000,
    )
    .sort((a, b) => a.x - b.x)
    .slice(0, 4);
  const columns = preset.shapes
    .filter(
      (shape) =>
        shape.kind === "text" &&
        shape.w >= 1_800_000 &&
        shape.w <= 2_200_000 &&
        shape.h >= 1_800_000 &&
        shape.y >= 3_000_000,
    )
    .sort((a, b) => a.x - b.x)
    .slice(0, 4);
  const devices = Array.isArray(page.slots.devices) ? page.slots.devices as Array<Record<string, string>> : [];
  const imageSlots = ["device_image_1", "device_image_2", "device_image_3"] as const;

  if (columns.length < 4 || iconGroups.length < 4) return false;
  slide.background = { color: "FFFFFF" };
  if (titleShape) {
    addText(slide, String(page.slots.title ?? ""), {
      x: emuToInches(titleShape.x),
      y: emuToInches(titleShape.y),
      w: 4.8,
      h: emuToInches(titleShape.h),
      size: 23,
      color: MVP_THEME.colors.text,
      bold: true,
    });
  }
  addText(slide, String(page.slots.eyebrow ?? ""), {
    x: titleShape ? emuToInches(titleShape.x) : 1.02,
    y: titleShape ? emuToInches(titleShape.y) + 0.54 : 0.92,
    w: 2.2,
    h: 0.16,
    size: 9,
    color: MVP_THEME.colors.textMuted,
    bold: true,
  });

  devices.slice(0, 3).forEach((device, idx) => {
    const icon = iconGroups[idx];
    const box = columns[idx];
    const iconX = emuToInches(icon.x + 0.12 * 914400);
    const iconY = emuToInches(icon.y + 0.38 * 914400);
    slide.addShape("ellipse" as never, {
      x: iconX,
      y: iconY,
      w: 0.9,
      h: 0.9,
      fill: { color: idx % 2 === 0 ? "2A5BAA" : "91CF50", transparency: 8 },
      line: { color: idx % 2 === 0 ? "2A5BAA" : "91CF50", width: 1.4 },
    });
    addImageOrPlaceholder(slide, assets[imageSlots[idx]], {
      x: iconX + 0.14,
      y: iconY + 0.14,
      w: 0.62,
      h: 0.62,
    });

    const x = emuToInches(box.x);
    const y = emuToInches(box.y);
    const w = emuToInches(box.w);
    const h = emuToInches(box.h);
    addSoftPanel(slide, {
      x,
      y,
      w,
      h,
      fill: "FFFFFF",
      stroke: "E7EEF3",
      radius: 0.14,
    });
    addText(slide, device.name ?? "", {
      x: x + 0.18,
      y: y + 0.2,
      w: w - 0.36,
      h: 0.22,
      size: 15,
      color: MVP_THEME.colors.text,
      bold: true,
    });
    addText(slide, device.note ?? "", {
      x: x + 0.18,
      y: y + 0.56,
      w: w - 0.36,
      h: 0.84,
      size: 8.8,
      color: MVP_THEME.colors.textMuted,
    });
    const tags = splitScenarioTags(String(device.scenario ?? ""));
    tags.forEach((tag, tagIdx) => {
      addSoftPanel(slide, {
        x: x + 0.18 + tagIdx * 0.92,
        y: y + 1.52,
        w: 0.82,
        h: 0.28,
        fill: "EAF8F0",
        stroke: "D7F5E5",
        radius: 0.16,
      });
      addText(slide, tag, {
        x: x + 0.18 + tagIdx * 0.92,
        y: y + 1.6,
        w: 0.82,
        h: 0.1,
        size: 7.5,
        color: MVP_THEME.colors.primary,
        bold: true,
        align: "center",
      });
    });
  });

  const summaryBox = columns[3];
  if (summaryBox) {
    const x = emuToInches(summaryBox.x);
    const y = emuToInches(summaryBox.y);
    const w = emuToInches(summaryBox.w);
    const h = emuToInches(summaryBox.h);
    const deploymentSummary = devices
      .map((device) => String(device.scenario ?? "").trim())
      .filter(Boolean)
      .join(" · ");
    addSoftPanel(slide, {
      x,
      y,
      w,
      h,
      fill: "EEF9F4",
      stroke: "D7F5E5",
      radius: 0.14,
    });
    addText(slide, "典型部署", {
      x: x + 0.18,
      y: y + 0.2,
      w: w - 0.36,
      h: 0.18,
      size: 12,
      color: MVP_THEME.colors.primary,
      bold: true,
    });
    addText(slide, deploymentSummary, {
      x: x + 0.18,
      y: y + 0.58,
      w: w - 0.36,
      h: 0.9,
      size: 8.8,
      color: MVP_THEME.colors.textMuted,
    });
  }

  return true;
}

export function renderMvpPage(
  slide: PptxGenJS.Slide,
  page: FittedPageSlots,
  assets: Record<string, string | undefined>,
  theme = MVP_THEME,
  nativeTemplate?: NativeTemplate,
  layoutPresetRuntime?: TemplateLayoutPresetRuntime,
) {
  const previousTheme = ACTIVE_THEME;
  const previousTemplate = ACTIVE_TEMPLATE;
  ACTIVE_THEME = theme;
  ACTIVE_TEMPLATE = nativeTemplate;
  setActiveFamilyTemplate(nativeTemplate);
  const MVP_THEME = theme;
  slide.background = { color: MVP_THEME.colors.bg };

  try {
    switch (page.variantId) {
    case "cover_hero_image": {
      if (ACTIVE_TEMPLATE?.source.kind === "ingested_template" && layoutPresetRuntime) {
        const rendered = renderExtractedTemplateCover(slide, page, layoutPresetRuntime);
        if (rendered) break;
      }
      const subtitle = String(page.slots.subtitle ?? "");
      const subtitleParts = splitCoverSubtitle(subtitle);
      const hasInfoRail = ACTIVE_TEMPLATE
        ? hasTemplatePrimitive(ACTIVE_TEMPLATE, page.variantId, "info_rail_right")
        : true;
      const railEnabled = hasInfoRail && getPrimitiveBoolean(ACTIVE_TEMPLATE, "info_rail_right", "enabled", true);
      const railWidth = railEnabled
        ? getPrimitiveNumber(ACTIVE_TEMPLATE, "info_rail_right", "width", 2.14)
        : 0;
      const heroWidth = railEnabled ? 9.18 : 11.08;
      const coverTitleWidth = getPrimitiveNumber(ACTIVE_TEMPLATE, "title_block_top_left", "titleWidth", 6.0);
      const overlayOpacity = getPrimitiveNumber(ACTIVE_TEMPLATE, "hero_panel_image", "overlayOpacity", 48);
      const railX = 12.36 - railWidth;
      addImageCover(slide, assets.hero_bg, { x: 0.92, y: 0.26, w: heroWidth, h: 6.96 });
      slide.addShape("rect" as never, {
        x: 0.92,
        y: 0.26,
        w: heroWidth,
        h: 6.96,
        fill: { color: "102033", transparency: overlayOpacity },
        line: { color: "102033", transparency: 100 },
      });
      slide.addShape("roundRect" as never, {
        x: 0.92,
        y: 0.26,
        w: heroWidth,
        h: 6.96,
        rectRadius: 0.08,
        fill: { color: "FFFFFF", transparency: 100 },
        line: { color: "EEF2F6", width: 1 },
      });
      addText(slide, String(page.slots.eyebrow ?? ""), {
        x: 1.26,
        y: 0.78,
        w: 4.8,
        h: 0.24,
        size: 10,
        color: "F8C04A",
        bold: true,
      });
      addText(slide, String(page.slots.title ?? ""), {
        x: 1.2,
        y: 2.08,
        w: coverTitleWidth,
        h: 1.18,
        size: 31,
        color: "FFFFFF",
        bold: true,
      });
      addText(slide, String(page.slots.subtitle ?? ""), {
        x: 1.26,
        y: 3.54,
        w: 5.5,
        h: 0.34,
        size: 17,
        color: "E8EEF5",
        bold: true,
      });
      slide.addShape("rect" as never, {
        x: 1.24,
        y: 4.24,
        w: 1.72,
        h: 0.06,
        fill: { color: MVP_THEME.colors.primary },
        line: { color: MVP_THEME.colors.primary, transparency: 100 },
      });
      addText(slide, String(page.slots.audienceLine ?? ""), {
        x: 1.26,
        y: 6.34,
        w: 5.2,
        h: 0.22,
        size: 11.5,
        color: "E6ECF3",
      });
      if (railEnabled) {
        addSoftPanel(slide, {
          x: railX,
          y: 0.34,
          w: railWidth,
          h: 6.78,
          fill: "FFFFFF",
          stroke: "F0F4F7",
          radius: 0.08,
        });
        slide.addShape("rect" as never, {
          x: railX + 0.04,
          y: 0.72,
          w: 0.04,
          h: 5.98,
          fill: { color: "E8EFF4" },
          line: { color: "E8EFF4", transparency: 100 },
        });
        addText(slide, String(page.slots.eyebrow ?? ""), {
          x: railX + 0.32,
          y: 0.62,
          w: 1.48,
          h: 0.2,
          size: 7,
          color: MVP_THEME.colors.primary,
          bold: true,
        });
        addText(slide, "GUIDE TRACK", {
          x: railX + 0.32,
          y: 1.18,
          w: 1.1,
          h: 0.18,
          size: 7,
          color: "98A2B3",
          bold: true,
        });
        subtitleParts.forEach((part, idx) => {
          const y = 1.48 + idx * 0.72;
          addSoftPanel(slide, {
            x: railX + 0.2,
            y,
            w: Math.max(railWidth - 0.34, 1.24),
            h: 0.52,
            fill: idx === 0 ? "EAF8F0" : "F8FBFC",
            stroke: idx === 0 ? "D7F5E5" : "E7EEF3",
            radius: 0.12,
          });
          addSoftPanel(slide, {
            x: railX + 0.32,
            y: y + 0.1,
            w: 0.34,
            h: 0.32,
            fill: idx === 0 ? MVP_THEME.colors.primary : "F1F5F8",
            stroke: idx === 0 ? MVP_THEME.colors.primary : "E2E8F0",
            radius: 0.16,
          });
          addText(slide, String(idx + 1).padStart(2, "0"), {
            x: railX + 0.32,
            y: y + 0.11,
            w: 0.34,
            h: 0.13,
            size: 7,
            color: idx === 0 ? "FFFFFF" : MVP_THEME.colors.textMuted,
            bold: true,
            align: "center",
          });
          addText(slide, part, {
            x: railX + 0.74,
            y: y + 0.11,
            w: Math.max(railWidth - 1.0, 0.72),
            h: 0.16,
            size: 7.6,
            color: idx === 0 ? MVP_THEME.colors.primary : MVP_THEME.colors.textMuted,
            bold: idx === 0,
          });
        });
        slide.addShape("rect" as never, {
          x: railX + 0.32,
          y: 4.98,
          w: Math.max(railWidth - 0.62, 0.92),
          h: 0.02,
          fill: { color: "E8EFF4" },
          line: { color: "E8EFF4", transparency: 100 },
        });
        addText(slide, "AUDIENCE", {
          x: railX + 0.32,
          y: 5.2,
          w: 1.0,
          h: 0.18,
          size: 7,
          color: "98A2B3",
          bold: true,
        });
        addSoftPanel(slide, {
          x: railX + 0.22,
          y: 5.52,
          w: Math.max(railWidth - 0.38, 1.14),
          h: 0.94,
          fill: "F8FBFC",
          stroke: "E7EEF3",
          radius: 0.12,
        });
        addText(slide, String(page.slots.audienceLine ?? ""), {
          x: railX + 0.32,
          y: 5.84,
          w: Math.max(railWidth - 0.58, 0.92),
          h: 0.42,
          size: 7.9,
          color: MVP_THEME.colors.textMuted,
        });
      }
      break;
    }
    case "toc_card_grid_8": {
      if (ACTIVE_TEMPLATE?.source.kind === "ingested_template" && layoutPresetRuntime) {
        const rendered = renderExtractedTemplateToc(slide, page, layoutPresetRuntime);
        if (rendered) break;
      }
      addMutedTextureBg(slide, assets.bg_texture);
      const tocLayout = getPrimitiveString(ACTIVE_TEMPLATE, "soft_white_card", "tocLayout", "featured_grid");
      addFamilyTitleBlock(slide, MVP_THEME, {
        title: String(page.slots.title ?? ""),
        eyebrow: String(page.slots.eyebrow ?? ""),
      });
      slide.addShape("rect" as never, {
        x: 1.18,
        y: 1.43,
        w: 10.96,
        h: 0.02,
        fill: { color: "E6EDF3" },
        line: { color: "E6EDF3", transparency: 100 },
      });
      const items = Array.isArray(page.slots.items) ? page.slots.items as Array<Record<string, string>> : [];
      addSoftPanel(slide, {
        x: 10.5,
        y: 0.76,
        w: 1.56,
        h: 0.34,
        fill: "F7FAFB",
        stroke: "E6EDF3",
        radius: 0.17,
      });
      addText(slide, `${items.length} MODULES`, {
        x: 10.5,
        y: 0.84,
        w: 1.56,
        h: 0.12,
        size: 7.2,
        color: MVP_THEME.colors.textMuted,
        bold: true,
        align: "center",
      });
      const renderItem = (
        item: Record<string, string>,
        box: { x: number; y: number; w: number; h: number },
        style: "featured" | "secondary" | "footer",
      ) => {
        if (style === "featured") {
          const badgeSize = 0.84;
          const badgeX = box.x + 0.18;
          const badgeY = box.y + 0.22;
          const titleX = badgeX + badgeSize + 0.2;
          addSoftPanel(slide, {
            ...box,
            fill: "ECFBF2",
            stroke: "BFEECF",
          });
          slide.addShape("ellipse" as never, {
            x: badgeX,
            y: badgeY,
            w: badgeSize,
            h: badgeSize,
            fill: { color: MVP_THEME.colors.primary },
            line: { color: MVP_THEME.colors.primary, transparency: 100 },
          });
          addText(slide, item.index ?? "", {
            x: badgeX - 0.04,
            y: badgeY + 0.02,
            w: badgeSize + 0.08,
            h: badgeSize,
            size: 20,
            color: "FFFFFF",
            bold: true,
            align: "center",
          });
          addText(slide, item.title ?? "", {
            x: titleX,
            y: box.y + 0.22,
            w: box.w - (titleX - box.x) - 0.24,
            h: 0.28,
            size: 18,
            bold: true,
            color: MVP_THEME.colors.text,
          });
          addText(slide, item.subtitle ?? "", {
            x: titleX,
            y: box.y + 0.56,
            w: box.w - (titleX - box.x) - 0.24,
            h: 0.2,
            size: 9,
            color: MVP_THEME.colors.textMuted,
          });
          addText(slide, "KEY SECTION", {
            x: box.x + box.w - 1.16,
            y: box.y + 0.16,
            w: 0.9,
            h: 0.14,
            size: 6.5,
            color: "8FA39A",
            bold: true,
            align: "right",
          });
          return;
        }
        addSoftPanel(slide, {
          ...box,
          fill: "FFFFFF",
          stroke: "EEF2F6",
        });
        slide.addShape("roundRect" as never, {
          x: box.x + 0.16,
          y: box.y + 0.14,
          w: 0.08,
          h: box.h - 0.28,
          rectRadius: 0.04,
          fill: { color: style === "footer" ? "BFEECF" : "E0F3E8" },
          line: { color: style === "footer" ? "BFEECF" : "E0F3E8", transparency: 100 },
        });
        addSoftPanel(slide, {
          x: box.x + 0.3,
          y: box.y + 0.16,
          w: style === "footer" ? 0.76 : 0.66,
          h: 0.28,
          fill: style === "footer" ? "EAF8F0" : "F3FAF6",
          stroke: style === "footer" ? "D7F5E5" : "E4F3EA",
          radius: 0.14,
        });
        addText(slide, item.index ?? "", {
          x: box.x + 0.3,
          y: box.y + 0.22,
          w: style === "footer" ? 0.76 : 0.66,
          h: 0.11,
          size: 8.5,
          color: MVP_THEME.colors.primary,
          bold: true,
          align: "center",
        });
        const titleX = box.x + (style === "footer" ? 1.22 : 1.02);
        addText(slide, item.title ?? "", {
          x: titleX,
          y: box.y + 0.18,
          w: box.w - (titleX - box.x) - 0.24,
          h: 0.2,
          size: style === "footer" ? 13 : 12,
          bold: true,
          color: MVP_THEME.colors.text,
        });
        addText(slide, item.subtitle ?? "", {
          x: titleX,
          y: box.y + 0.38,
          w: box.w - (titleX - box.x) - 0.24,
          h: 0.14,
          size: style === "footer" ? 8 : 7.5,
          color: MVP_THEME.colors.textMuted,
        });
      };

      const leftX = 1.12;
      const rightX = 6.98;
      const topY = 1.72;
      const featuredH = 1.06;
      const secondaryH = 0.7;
      const leftGap = 0.14;
      const rightGap = 0.14;

      if (tocLayout === "balanced_grid") {
        const balancedH = 0.78;
        items.slice(0, 8).forEach((item, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          renderItem(
            item,
            {
              x: col === 0 ? leftX : rightX,
              y: topY + row * (balancedH + 0.18),
              w: col === 0 ? 5.56 : 5.14,
              h: balancedH,
            },
            "secondary",
          );
        });
      } else {
        if (items[0]) renderItem(items[0], { x: leftX, y: topY, w: 5.56, h: featuredH }, "featured");
        if (items[1]) renderItem(items[1], { x: rightX, y: topY, w: 5.14, h: secondaryH }, "secondary");
        if (items[2]) renderItem(items[2], { x: rightX, y: topY + secondaryH + rightGap, w: 5.14, h: secondaryH }, "secondary");
        if (items[3]) renderItem(items[3], { x: leftX, y: topY + featuredH + leftGap, w: 5.56, h: secondaryH }, "secondary");
        if (items[4]) renderItem(items[4], { x: rightX, y: topY + 2 * (secondaryH + rightGap), w: 5.14, h: secondaryH }, "secondary");
        if (items[5]) renderItem(items[5], { x: leftX, y: topY + featuredH + leftGap + secondaryH + leftGap, w: 5.56, h: secondaryH }, "secondary");
        if (items[6]) renderItem(items[6], { x: rightX, y: topY + 3 * (secondaryH + rightGap), w: 5.14, h: secondaryH }, "secondary");
        if (items[7]) renderItem(items[7], { x: leftX, y: 5.74, w: 11.0, h: 0.68 }, "footer");
      }
      break;
    }
    case "comparison_dual_image": {
      if (ACTIVE_TEMPLATE?.source.kind === "ingested_template" && layoutPresetRuntime) {
        const rendered = renderExtractedTemplateComparison(slide, page, assets, layoutPresetRuntime);
        if (rendered) break;
      }
      addMutedTextureBg(slide, assets.bg_texture);
      const comparisonMode = getPrimitiveString(ACTIVE_TEMPLATE, "soft_white_card", "comparisonMode", "versus");
      const showVersus = comparisonMode === "versus";
      addFamilyTitleBlock(slide, MVP_THEME, {
        title: String(page.slots.title ?? ""),
        eyebrow: String(page.slots.eyebrow ?? ""),
      });
      addSoftPanel(slide, {
        x: 10.46,
        y: 0.78,
        w: 1.6,
        h: 0.32,
        fill: "F7FAFB",
        stroke: "E6EDF3",
        radius: 0.16,
      });
      addText(slide, "MOBILITY VS FIXED", {
        x: 10.5,
        y: 0.85,
        w: 1.52,
        h: 0.12,
        size: 6.6,
        color: MVP_THEME.colors.textMuted,
        bold: true,
        align: "center",
      });
      addSoftPanel(slide, { x: 1.15, y: 1.64, w: 5.05, h: 4.7, fill: "FFFFFF", stroke: "EEF2F6" });
      addSoftPanel(slide, { x: 6.98, y: 1.64, w: 5.05, h: 4.7, fill: "FFFFFF", stroke: "EEF2F6" });
      if (showVersus) {
        addSoftPanel(slide, { x: 6.14, y: 2.72, w: 0.62, h: 0.34, fill: "1F3147", stroke: "1F3147", radius: 0.17 });
        addText(slide, "VS", {
          x: 6.14,
          y: 2.8,
          w: 0.62,
          h: 0.12,
          size: 8,
          color: "FFFFFF",
          bold: true,
          align: "center",
        });
        slide.addShape("line" as never, {
          x: 6.45,
          y: 1.9,
          w: 0,
          h: 3.94,
          line: { color: "D9E2EC", width: 1.2, dash: "dash" as never },
        });
      }
      addSoftPanel(slide, { x: 1.34, y: 1.8, w: 4.7, h: 2.16, fill: "FFFFFF", stroke: "EEF2F6" });
      addSoftPanel(slide, { x: 7.17, y: 1.8, w: 4.7, h: 2.16, fill: "FFFFFF", stroke: "EEF2F6" });
      addImageOrPlaceholder(slide, assets.left_illustration, { x: 1.48, y: 1.96, w: 4.42, h: 1.82 });
      addImageOrPlaceholder(slide, assets.right_illustration, { x: 7.31, y: 1.96, w: 4.42, h: 1.82 });
      addSoftPanel(slide, { x: 1.46, y: 4.12, w: 1.14, h: 0.28, fill: "ECFBF2", stroke: "D9F3E3", radius: 0.14 });
      addSoftPanel(slide, { x: 7.28, y: 4.12, w: 1.14, h: 0.28, fill: "FFF5EA", stroke: "F8E4C8", radius: 0.14 });
      addText(slide, "WIRELESS", { x: 1.56, y: 4.18, w: 0.94, h: 0.12, size: 7, color: MVP_THEME.colors.primary, bold: true, align: "center" });
      addText(slide, "WIRED", { x: 7.4, y: 4.18, w: 0.9, h: 0.12, size: 7, color: "F97316", bold: true, align: "center" });
      slide.addShape("roundRect" as never, {
        x: 1.46,
        y: 4.48,
        w: 0.08,
        h: 0.22,
        rectRadius: 0.04,
        fill: { color: MVP_THEME.colors.primary },
        line: { color: MVP_THEME.colors.primary, transparency: 100 },
      });
      slide.addShape("roundRect" as never, {
        x: 7.28,
        y: 4.48,
        w: 0.08,
        h: 0.22,
        rectRadius: 0.04,
        fill: { color: "F97316" },
        line: { color: "F97316", transparency: 100 },
      });
      addText(slide, String(page.slots.leftTitle ?? ""), { x: 1.84, y: 4.5, w: 3.36, h: 0.28, size: 18, color: MVP_THEME.colors.primary, bold: true });
      addText(slide, String(page.slots.rightTitle ?? ""), { x: 7.66, y: 4.5, w: 3.34, h: 0.28, size: 18, color: "F97316", bold: true });
      const left = Array.isArray(page.slots.leftBullets) ? page.slots.leftBullets as string[] : [];
      const right = Array.isArray(page.slots.rightBullets) ? page.slots.rightBullets as string[] : [];
      if (left[0]) {
        addSoftPanel(slide, { x: 1.42, y: 4.84, w: 4.46, h: 0.5, fill: "ECFBF2", stroke: "D9F3E3" });
        addText(slide, left[0], { x: 1.72, y: 4.98, w: 3.9, h: 0.18, size: 11, bold: true });
      }
      if (left[1]) {
        addSoftPanel(slide, { x: 1.42, y: 5.46, w: 2.12, h: 0.56, fill: "F4FBF7", stroke: "DDEFE5" });
        addText(slide, left[1], { x: 1.64, y: 5.6, w: 1.7, h: 0.18, size: 9 });
      }
      if (left[2]) {
        addSoftPanel(slide, { x: 3.76, y: 5.46, w: 2.12, h: 0.56, fill: "F4FBF7", stroke: "DDEFE5" });
        addText(slide, left[2], { x: 3.98, y: 5.6, w: 1.7, h: 0.18, size: 9 });
      }
      if (right[0]) {
        addSoftPanel(slide, { x: 7.24, y: 4.84, w: 4.46, h: 0.5, fill: "FFF5EA", stroke: "F8E4C8" });
        addText(slide, right[0], { x: 7.54, y: 4.98, w: 3.9, h: 0.18, size: 11, bold: true });
      }
      if (right[1]) {
        addSoftPanel(slide, { x: 7.24, y: 5.46, w: 2.12, h: 0.56, fill: "FFF9F2", stroke: "F5E7D3" });
        addText(slide, right[1], { x: 7.46, y: 5.6, w: 1.7, h: 0.18, size: 9 });
      }
      if (right[2]) {
        addSoftPanel(slide, { x: 9.58, y: 5.46, w: 2.12, h: 0.56, fill: "FFF9F2", stroke: "F5E7D3" });
        addText(slide, right[2], { x: 9.8, y: 5.6, w: 1.7, h: 0.18, size: 9 });
      }
      break;
    }
    case "timeline_horizontal_5": {
      if (ACTIVE_TEMPLATE?.source.kind === "ingested_template" && layoutPresetRuntime) {
        const rendered = renderExtractedTemplateTimeline(slide, page, layoutPresetRuntime);
        if (rendered) break;
      }
      addMutedTextureBg(slide, assets.bg_texture);
      const timelineLayout = getPrimitiveString(ACTIVE_TEMPLATE, "timeline_node_milestone", "layoutMode", "alternating");
      addFamilyTitleBlock(slide, MVP_THEME, {
        title: String(page.slots.title ?? ""),
        eyebrow: String(page.slots.eyebrow ?? ""),
        titleWidth: 7.2,
      });
      addSoftPanel(slide, {
        x: 10.52,
        y: 0.78,
        w: 1.5,
        h: 0.32,
        fill: "F7FAFB",
        stroke: "E6EDF3",
        radius: 0.16,
      });
      addText(slide, "1997-2024", {
        x: 10.52,
        y: 0.85,
        w: 1.5,
        h: 0.12,
        size: 7.2,
        color: MVP_THEME.colors.textMuted,
        bold: true,
        align: "center",
      });
      addText(slide, String(page.slots.summary ?? ""), {
        x: 1.18,
        y: 1.34,
        w: 7.6,
        h: 0.3,
        size: 11,
        color: MVP_THEME.colors.textMuted,
      });
      addSoftPanel(slide, { x: 1.12, y: 1.78, w: 11.12, h: 4.36, fill: "FFFFFF", stroke: "EEF2F6" });
      addSoftPanel(slide, { x: 1.34, y: 2.0, w: 1.54, h: 0.34, fill: "F7FAFB", stroke: "E7EEF3", radius: 0.17 });
      addText(slide, "5 MILESTONES", {
        x: 1.34,
        y: 2.08,
        w: 1.54,
        h: 0.12,
        size: 7.2,
        color: MVP_THEME.colors.textMuted,
        bold: true,
        align: "center",
      });
      slide.addShape("rect" as never, {
        x: 1.72,
        y: 3.42,
        w: 9.88,
        h: 0.06,
        fill: { color: "B7C3CF" },
        line: { color: "B7C3CF", transparency: 100 },
      });
      const nodes = Array.isArray(page.slots.nodes) ? page.slots.nodes as Array<Record<string, string>> : [];
      const step = 2.3;
      nodes.slice(0, 5).forEach((node, idx) => {
        const centerX = 2.02 + idx * step;
        const iconPath = assets[`timeline_icon_${idx + 1}`];
        addText(slide, node.year ?? "", {
          x: centerX - 0.42,
          y: 2.46,
          w: 0.84,
          h: 0.18,
          size: 14,
          color: MVP_THEME.colors.primary,
          bold: true,
          align: "center",
        });
        slide.addShape("ellipse" as never, {
          x: centerX - 0.38,
          y: 2.82,
          w: 0.76,
          h: 0.76,
          fill: { color: "E8F8F0" },
          line: { color: MVP_THEME.colors.primary, width: 1.4 },
        });
        if (iconPath) {
          slide.addImage({
            path: iconPath,
            x: centerX - 0.21,
            y: 3.02,
            w: 0.42,
            h: 0.3,
            sizing: {
              type: "contain",
              x: centerX - 0.21,
              y: 3.02,
              w: 0.42,
              h: 0.3,
            },
          });
        }
        const isUpper = timelineLayout === "alternating" ? idx % 2 === 0 : false;
        const cardY = timelineLayout === "bottom_track" ? 4.02 : isUpper ? 2.02 : 4.08;
        const stemTop = timelineLayout === "bottom_track" ? 3.58 : isUpper ? cardY + 0.94 : 3.58;
        const stemHeight = timelineLayout === "bottom_track" ? 0.44 : isUpper ? 0.32 : 0.54;
        slide.addShape("line" as never, {
          x: centerX,
          y: stemTop,
          w: 0,
          h: stemHeight,
          line: { color: "D9E2EC", width: 1.2 },
        });
        addSoftPanel(slide, { x: centerX - 0.9, y: cardY, w: 1.8, h: 0.94, fill: "FFFFFF", stroke: "EEF2F6" });
        addText(slide, node.title ?? "", {
          x: centerX - 0.72,
          y: cardY + 0.14,
          w: 1.44,
          h: 0.18,
          size: 9.5,
          bold: true,
          align: "center",
        });
        addText(slide, node.detail ?? "", {
          x: centerX - 0.68,
          y: cardY + 0.44,
          w: 1.36,
          h: 0.2,
          size: 7.4,
          color: MVP_THEME.colors.textMuted,
          align: "center",
        });
      });
      addSoftPanel(slide, { x: 1.22, y: 6.18, w: 11.0, h: 0.68, fill: "E6FAEC", stroke: "D2F4DD" });
      slide.addShape("roundRect" as never, {
        x: 1.46,
        y: 6.31,
        w: 0.1,
        h: 0.36,
        rectRadius: 0.05,
        fill: { color: MVP_THEME.colors.primary },
        line: { color: MVP_THEME.colors.primary, transparency: 100 },
      });
      addText(slide, "核心发展趋势：", { x: 1.7, y: 6.35, w: 1.7, h: 0.18, size: 10, color: MVP_THEME.colors.primary, bold: true });
      addText(slide, String(page.slots.summary ?? ""), { x: 3.02, y: 6.35, w: 9.0, h: 0.2, size: 10, color: MVP_THEME.colors.text });
      break;
    }
    case "process_flow_5": {
      if (ACTIVE_TEMPLATE?.source.kind === "ingested_template" && layoutPresetRuntime) {
        const rendered = renderExtractedTemplateProcess(slide, page, layoutPresetRuntime);
        if (rendered) break;
      }
      addMutedTextureBg(slide, assets.bg_texture);
      addFamilyTitleBlock(slide, MVP_THEME, {
        title: String(page.slots.title ?? ""),
        eyebrow: String(page.slots.eyebrow ?? ""),
        titleWidth: 7.2,
      });
      addSoftPanel(slide, {
        x: 10.62,
        y: 0.78,
        w: 1.24,
        h: 0.32,
        fill: "F7FAFB",
        stroke: "E6EDF3",
        radius: 0.16,
      });
      addText(slide, "5 STEPS", {
        x: 10.62,
        y: 0.85,
        w: 1.24,
        h: 0.12,
        size: 7.1,
        color: MVP_THEME.colors.textMuted,
        bold: true,
        align: "center",
      });
      addText(slide, String(page.slots.summary ?? ""), {
        x: 1.18,
        y: 1.34,
        w: 6.2,
        h: 0.34,
        size: 11,
        color: MVP_THEME.colors.textMuted,
      });
      addSoftPanel(slide, { x: 1.12, y: 1.82, w: 5.02, h: 4.28, fill: "FFFFFF", stroke: "EEF2F6" });
      addSoftPanel(slide, { x: 1.34, y: 2.04, w: 4.58, h: 2.76, fill: "F7FAFB", stroke: "E7EEF3", radius: 0.08 });
      addImageOrPlaceholder(slide, assets.process_illustration, { x: 1.62, y: 2.22, w: 4.02, h: 2.42 });
      addSoftPanel(slide, { x: 1.34, y: 5.0, w: 4.58, h: 0.74, fill: "EAF8F0", stroke: "D7F5E5", radius: 0.08 });
      slide.addShape("rect" as never, {
        x: 1.52,
        y: 5.16,
        w: 0.1,
        h: 0.42,
        fill: { color: MVP_THEME.colors.primary },
        line: { color: MVP_THEME.colors.primary, transparency: 100 },
      });
      addText(slide, "实施闭环：", {
        x: 1.78,
        y: 5.2,
        w: 1.2,
        h: 0.18,
        size: 9.5,
        color: MVP_THEME.colors.primary,
        bold: true,
      });
      addText(slide, "规划、部署、优化、验收全链路串联推进", {
        x: 2.86,
        y: 5.2,
        w: 2.72,
        h: 0.18,
        size: 8.5,
        color: MVP_THEME.colors.text,
      });
      const steps = Array.isArray(page.slots.steps) ? page.slots.steps as Array<Record<string, string>> : [];
      slide.addShape("line" as never, {
        x: 6.98,
        y: 2.22,
        w: 0,
        h: 3.36,
        line: { color: "D6EDE0", width: 2.2 },
      });
      steps.slice(0, 5).forEach((step, idx) => {
        const y = 1.94 + idx * 0.84;
        addSoftPanel(slide, { x: 7.18, y, w: 5.06, h: 0.62, fill: "FFFFFF", stroke: "EEF2F6" });
        slide.addShape("ellipse" as never, {
          x: 6.74,
          y: y + 0.13,
          w: 0.48,
          h: 0.48,
          fill: { color: idx === 0 ? "E9F9F0" : idx === 4 ? "D9F6E4" : "FFFFFF" },
          line: { color: MVP_THEME.colors.primary, width: 1.2 },
        });
        addText(slide, step.index ?? "", {
          x: 6.7,
          y: y + 0.15,
          w: 0.56,
          h: 0.38,
          size: 10,
          color: MVP_THEME.colors.primary,
          bold: true,
          align: "center",
        });
        addText(slide, step.title ?? "", {
          x: 7.48,
          y: y + 0.06,
          w: 1.82,
          h: 0.22,
          size: 11,
          color: MVP_THEME.colors.text,
          bold: true,
        });
        addText(slide, step.detail ?? "", {
          x: 9.36,
          y: y + 0.14,
          w: 2.52,
          h: 0.18,
          size: 8.2,
          color: MVP_THEME.colors.textMuted,
        });
      });
      break;
    }
    case "device_triptych_3": {
      if (ACTIVE_TEMPLATE?.source.kind === "ingested_template" && layoutPresetRuntime) {
        const rendered = renderExtractedTemplateDevice(slide, page, assets, layoutPresetRuntime);
        if (rendered) break;
      }
      if (assets.scenario_bg) {
        slide.addImage({
          path: assets.scenario_bg,
          x: 0,
          y: 0,
          w: 13.33,
          h: 2.2,
          sizing: { type: "crop", x: 0, y: 0, w: 13.33, h: 2.2 },
          transparency: 74,
        });
      }
      slide.addShape("rect" as never, {
        x: 0,
        y: 0,
        w: 13.33,
        h: 2.2,
        fill: { color: "FFFFFF", transparency: 22 },
        line: { color: "FFFFFF", transparency: 100 },
      });
      addFamilyTitleBlock(slide, MVP_THEME, {
        title: String(page.slots.title ?? ""),
        eyebrow: String(page.slots.eyebrow ?? ""),
        titleWidth: 7.4,
      });
      addSoftPanel(slide, {
        x: 10.6,
        y: 0.78,
        w: 1.3,
        h: 0.32,
        fill: "F7FAFB",
        stroke: "E6EDF3",
        radius: 0.16,
      });
      addText(slide, `${Array.isArray(page.slots.devices) ? page.slots.devices.length : 0} TYPES`, {
        x: 10.6,
        y: 0.85,
        w: 1.3,
        h: 0.12,
        size: 7.1,
        color: MVP_THEME.colors.textMuted,
        bold: true,
        align: "center",
      });
      addText(slide, String(page.slots.summary ?? ""), {
        x: 1.18,
        y: 1.38,
        w: 7.0,
        h: 0.3,
        size: 11,
        color: MVP_THEME.colors.textMuted,
      });
      slide.addShape("rect" as never, {
        x: 1.18,
        y: 1.76,
        w: 11.0,
        h: 0.02,
        fill: { color: "E6EDF3" },
        line: { color: "E6EDF3", transparency: 100 },
      });
      const devices = Array.isArray(page.slots.devices) ? page.slots.devices as Array<Record<string, string>> : [];
      const deploymentSummary = devices
        .map((device) => String(device.scenario ?? "").trim())
        .filter(Boolean)
        .join(" · ");
      const imageSlots = ["device_image_1", "device_image_2", "device_image_3"] as const;
      devices.slice(0, 3).forEach((device, idx) => {
        const x = 1.12 + idx * 4.16;
        addSoftPanel(slide, { x, y: 1.88, w: 3.76, h: 4.14, fill: "FFFFFF", stroke: "EEF2F6" });
        addSoftPanel(slide, { x: x + 0.24, y: 2.0, w: 3.28, h: 1.72, fill: idx === 1 ? "F5F9FA" : "F7FAFB", stroke: "E7EEF3", radius: 0.08 });
        slide.addShape("rect" as never, {
          x: x + 0.24,
          y: 2.0,
          w: 0.1,
          h: 1.72,
          fill: { color: idx === 0 ? "BDEBCF" : idx === 1 ? "CFEDEA" : "D8F3E6" },
          line: { color: "FFFFFF", transparency: 100 },
        });
        slide.addShape("ellipse" as never, {
          x: x + 0.94,
          y: 2.22,
          w: 1.84,
          h: 1.06,
          fill: { color: idx === 0 ? "EAF8F0" : idx === 1 ? "EDF7FA" : "EEF9F4", transparency: 8 },
          line: { color: "FFFFFF", transparency: 100 },
        });
        addImageOrPlaceholder(slide, assets[imageSlots[idx]], { x: x + 0.56, y: 2.08, w: 2.64, h: 1.52 });
        addSoftPanel(slide, {
          x: x + 0.34,
          y: 3.84,
          w: 0.62,
          h: 0.26,
          fill: "F7FAFB",
          stroke: "E7EEF3",
          radius: 0.13,
        });
        addText(slide, String(idx + 1).padStart(2, "0"), {
          x: x + 0.34,
          y: 3.91,
          w: 0.62,
          h: 0.1,
          size: 7,
          color: MVP_THEME.colors.textMuted,
          bold: true,
          align: "center",
        });
        addText(slide, device.name ?? "", {
          x: x + 1.04,
          y: 3.82,
          w: 2.22,
          h: 0.24,
          size: 13,
          color: MVP_THEME.colors.text,
          bold: true,
        });
        const scenarioTags = splitScenarioTags(device.scenario ?? "");
        scenarioTags.forEach((tag, tagIdx) => {
          const tagWidth = scenarioTags.length === 1 ? 1.74 : 1.0 + tagIdx * 0.08;
          addSoftPanel(slide, {
            x: x + 0.34 + tagIdx * 1.16,
            y: 4.16,
            w: tagWidth,
            h: 0.3,
            fill: "E9F9F0",
            stroke: "D7F5E5",
            radius: 0.15,
          });
          addText(slide, tag, {
            x: x + 0.4 + tagIdx * 1.16,
            y: 4.22,
            w: tagWidth - 0.12,
            h: 0.12,
            size: 7.2,
            color: MVP_THEME.colors.primary,
            bold: true,
            align: "center",
          });
        });
        addSoftPanel(slide, {
          x: x + 0.3,
          y: 4.76,
          w: 3.04,
          h: 0.88,
          fill: "F8FBFC",
          stroke: "EDF2F6",
          radius: 0.12,
        });
        addText(slide, device.note ?? "", {
          x: x + 0.44,
          y: 5.02,
          w: 2.76,
          h: 0.26,
          size: 8.2,
          color: MVP_THEME.colors.textMuted,
        });
      });
      addSoftPanel(slide, { x: 1.18, y: 6.48, w: 11.0, h: 0.44, fill: "EEF9F4", stroke: "D7F5E5", radius: 0.14 });
      addText(slide, "典型部署：", {
        x: 1.4,
        y: 6.58,
        w: 1.1,
        h: 0.16,
        size: 8.5,
        color: MVP_THEME.colors.primary,
        bold: true,
      });
      addText(slide, deploymentSummary, {
        x: 2.48,
        y: 6.58,
        w: 8.9,
        h: 0.16,
        size: 8,
        color: MVP_THEME.colors.text,
      });
      break;
    }
      default:
        throw new Error(`Unsupported MVP variant: ${page.variantId}`);
    }

    addFamilyPageMarker(slide, MVP_THEME, page.pageId.toUpperCase());
  } finally {
    setActiveFamilyTemplate(previousTemplate);
    ACTIVE_THEME = previousTheme;
    ACTIVE_TEMPLATE = previousTemplate;
  }
}
