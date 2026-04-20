import type PptxGenJS from "pptxgenjs";
import type { CanvasRenderModel, NativeTemplate } from "./types";

let ACTIVE_FAMILY_TEMPLATE: NativeTemplate | undefined;

function radiusPxToInches(px: number | undefined, fallback: number) {
  return px != null ? px / 96 : fallback;
}

export function setActiveFamilyTemplate(template?: NativeTemplate) {
  ACTIVE_FAMILY_TEMPLATE = template;
}

export function addFamilySoftPanel(
  slide: PptxGenJS.Slide,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    fill?: string;
    stroke?: string;
    radius?: number;
  },
) {
  const tokens = ACTIVE_FAMILY_TEMPLATE?.tokens;
  slide.addShape("roundRect" as never, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    rectRadius: opts.radius ?? radiusPxToInches(tokens?.radius.card, 0.06),
    fill: { color: opts.fill ?? "F8FAFC" },
    line: { color: opts.stroke ?? "EEF2F6", width: tokens?.stroke.thin ?? 1 },
    shadow: {
      type: "outer",
      color: "000000",
      opacity: tokens?.shadow.cardOpacity ?? 0.06,
      blur: tokens?.shadow.cardBlur ?? 3,
      offset: tokens?.shadow.cardOffset ?? 1,
    },
  });
}

export function addFamilyText(
  slide: PptxGenJS.Slide,
  theme: CanvasRenderModel["theme"],
  text: string,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    size?: number;
    color?: string;
    bold?: boolean;
    align?: "left" | "center" | "right";
  },
) {
  slide.addText(text, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    fontFace: theme.fonts.body,
    fontSize: opts.size ?? 16,
    color: opts.color ?? theme.colors.text,
    bold: opts.bold ?? false,
    align: opts.align,
    valign: "mid",
    fit: "shrink",
    margin: 0,
  });
}

export function addFamilyTextureBackground(slide: PptxGenJS.Slide, imagePath: string | undefined) {
  if (!imagePath) {
    return;
  }
  slide.addImage({
    path: imagePath,
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
    sizing: { type: "crop", x: 0, y: 0, w: 13.33, h: 7.5 },
    transparency: 6,
  });
}

export function addFamilyTitleBlock(
  slide: PptxGenJS.Slide,
  theme: CanvasRenderModel["theme"],
  opts: {
    title: string;
    eyebrow?: string;
    titleX?: number;
    titleY?: number;
    eyebrowMuted?: boolean;
    titleWidth?: number;
  },
) {
  const titleX = opts.titleX ?? 1.15;
  const titleY = opts.titleY ?? 0.72;
  slide.addText(opts.title, {
    x: titleX,
    y: titleY,
    w: opts.titleWidth ?? 7.6,
    h: 0.58,
    fontFace: theme.fonts.title,
    fontSize: 29,
    color: theme.colors.text,
    bold: true,
    fit: "shrink",
    margin: 0,
  });

  if (opts.eyebrow) {
    slide.addText(opts.eyebrow, {
      x: titleX,
      y: titleY + 0.54,
      w: 4.4,
      h: 0.18,
      fontFace: theme.fonts.body,
      fontSize: 8,
      color: opts.eyebrowMuted ? "98A2B3" : theme.colors.textMuted,
      fit: "shrink",
      margin: 0,
    });
  }
}

export function addImageContainOrPlaceholder(
  slide: PptxGenJS.Slide,
  theme: CanvasRenderModel["theme"],
  imagePath: string | undefined,
  box: { x: number; y: number; w: number; h: number },
) {
  const tokens = ACTIVE_FAMILY_TEMPLATE?.tokens;
  if (imagePath) {
    slide.addImage({
      path: imagePath,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      sizing: { type: "contain", x: box.x, y: box.y, w: box.w, h: box.h },
    });
    return;
  }

  slide.addShape("roundRect" as never, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rectRadius: radiusPxToInches(tokens?.radius.image, 0.08),
    fill: { color: "F3F4F6" },
    line: { color: theme.colors.outline, width: tokens?.stroke.thin ?? 1 },
  });
  addFamilyText(slide, theme, "[图片占位]", {
    ...box,
    size: 14,
    color: theme.colors.textMuted,
    align: "center",
  });
}

export function addImageCover(
  slide: PptxGenJS.Slide,
  imagePath: string | undefined,
  box: { x: number; y: number; w: number; h: number },
) {
  if (!imagePath) {
    return;
  }
  slide.addImage({
    path: imagePath,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    sizing: { type: "crop", x: box.x, y: box.y, w: box.w, h: box.h },
  });
}

export function addFamilyPageMarker(
  slide: PptxGenJS.Slide,
  theme: CanvasRenderModel["theme"],
  label: string,
) {
  slide.addShape("rect" as never, {
    x: 11.48,
    y: 6.95,
    w: 0.22,
    h: 0.04,
    fill: { color: theme.colors.primary },
    line: { color: theme.colors.primary, transparency: 100 },
  });
  slide.addText(label, {
    x: 11.78,
    y: 6.84,
    w: 0.7,
    h: 0.18,
    fontFace: theme.fonts.mono,
    fontSize: 8,
    color: theme.colors.textMuted,
    bold: false,
    align: "left",
    margin: 0,
    fit: "shrink",
  });
}
