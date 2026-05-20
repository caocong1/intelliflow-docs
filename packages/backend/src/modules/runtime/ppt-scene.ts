import { existsSync } from "node:fs";
import { join } from "node:path";
import PptxGenJS from "pptxgenjs";
import type { DeckCompositionSummary } from "./ppt-deck-composition";

type JsonRecord = Record<string, unknown>;

type SceneTextStyle = {
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  lineHeight?: number;
  align?: "left" | "center" | "right" | "justify";
  valign?: "top" | "mid" | "bottom";
  tracking?: number;
  uppercase?: boolean;
};

type SceneShapeStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  shadow?: {
    color?: string;
    opacity?: number;
    blur?: number;
    distance?: number;
    angle?: number;
  };
};

type SceneTheme = {
  palette?: Record<string, string>;
  fonts?: Record<string, string>;
  textStyles?: Record<string, SceneTextStyle>;
  shapeStyles?: Record<string, SceneShapeStyle>;
};

type SceneAsset = {
  type?: string;
  src?: string;
};

export type SceneAssetManifest = Record<string, SceneAsset>;

type SceneCommonElement = {
  id?: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  rotate?: number;
  opacity?: number;
};

type SceneTextElement = SceneCommonElement & {
  type: "text";
  styleRef?: string;
  paragraphs?: Array<{
    align?: "left" | "center" | "right" | "justify";
    valign?: "top" | "mid" | "bottom";
    runs?: Array<{
      text: string;
      font?: string;
      size?: number;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      color?: string;
      highlight?: string;
      tracking?: number;
      uppercase?: boolean;
    }>;
  }>;
  fit?: "shrink" | "clip";
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
};

type SceneShapeElement = SceneCommonElement & {
  type: "shape";
  shape?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: "solid" | "dash" | "dot";
  radius?: number;
  shadow?: SceneShapeStyle["shadow"];
};

type SceneImageElement = SceneCommonElement & {
  type: "image";
  assetRef?: string;
  src?: string;
  fit?: "cover" | "contain" | "stretch";
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  shadow?: SceneShapeStyle["shadow"];
};

type SceneTableCell = {
  text: string;
  fill?: string;
  color?: string;
  align?: "left" | "center" | "right";
};

type SceneTableElement = SceneCommonElement & {
  type: "table";
  columns?: number[];
  header?: SceneTableCell[];
  rows?: Array<Array<string | SceneTableCell>>;
  cellStyle?: {
    font?: string;
    size?: number;
    color?: string;
    padding?: number;
    fill?: string;
    borderColor?: string;
    borderWidth?: number;
    align?: "left" | "center" | "right";
    valign?: "top" | "mid" | "bottom";
  };
  stripe?: {
    enabled?: boolean;
    fill?: string;
  };
};

type SceneGroupElement = SceneCommonElement & {
  type: "group";
  children?: SceneElement[];
};

type SceneElement =
  | SceneTextElement
  | SceneShapeElement
  | SceneImageElement
  | SceneTableElement
  | SceneGroupElement;

type SceneSlide = {
  id?: string;
  name?: string;
  notes?: string;
  background?: {
    fill?: string;
  };
  elements?: SceneElement[];
};

type SceneDocument = {
  version: "ppt_scene/v1";
  meta?: {
    title?: string;
    subject?: string;
    language?: string;
    canvas?: { width?: number; height?: number; unit?: string };
  };
  theme?: SceneTheme;
  assets?: Record<string, SceneAsset>;
  slides: SceneSlide[];
};

type SceneFamilyDocument = {
  version: "ppt_scene_family/v1";
  familyId?: string;
  familyLabel?: string;
  pages: Array<{
    pageType?: string;
    scene?: SceneDocument;
  }>;
};

type RenderableSceneSlide = {
  id: string;
  name?: string;
  notes?: string;
  backgroundFill?: string;
  theme: SceneTheme;
  assets: Record<string, SceneAsset>;
  elements: SceneElement[];
  pageType?: string;
};

export type PptSceneDeck = {
  source: "scene" | "family";
  slides: RenderableSceneSlide[];
};

type SceneRenderResult = {
  buffer: Buffer;
  warnings: string[];
  renderMode: string;
  compositionSummary: DeckCompositionSummary;
};

const PPT_CANVAS_WIDTH = 13.333;
const PPT_CANVAS_HEIGHT = 7.5;
const DEFAULT_CANVAS_WIDTH = 1600;
const DEFAULT_CANVAS_HEIGHT = 900;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSceneElementLike(value: unknown): value is SceneElement {
  return isRecord(value) && typeof value.type === "string";
}

function normalizeSceneSlideEntry(
  rawSlide: unknown,
  index: number,
  doc: SceneDocument,
): RenderableSceneSlide | null {
  if (!isRecord(rawSlide)) return null;

  if (Array.isArray(rawSlide.elements)) {
    const slide = rawSlide as SceneSlide;
    return {
      id: slide.id ?? `scene-slide-${index + 1}`,
      name: slide.name,
      notes: slide.notes,
      backgroundFill: slide.background?.fill,
      theme: doc.theme ?? {},
      assets: doc.assets ?? {},
      elements: slide.elements,
    };
  }

  // Some Gemini lock outputs accidentally place element objects directly into
  // `slides[]`. Normalize them into a single-element slide instead of
  // rendering a blank page.
  if (isSceneElementLike(rawSlide)) {
    const element = rawSlide as SceneElement;
    return {
      id: typeof rawSlide.id === "string" ? rawSlide.id : `scene-slide-${index + 1}`,
      name: typeof rawSlide.id === "string" ? rawSlide.id : undefined,
      theme: doc.theme ?? {},
      assets: doc.assets ?? {},
      backgroundFill: undefined,
      elements: [element],
    };
  }

  return null;
}

function getSceneSlidesFromDocument(doc: SceneDocument): RenderableSceneSlide[] {
  return (doc.slides ?? [])
    .map((slide, index) => normalizeSceneSlideEntry(slide, index, doc))
    .filter((slide): slide is RenderableSceneSlide => Boolean(slide));
}

export function parsePptSceneContent(content: string): PptSceneDeck | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.version !== "string") return null;

  if (parsed.version === "ppt_scene/v1" && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
    return {
      source: "scene",
      slides: getSceneSlidesFromDocument(parsed as SceneDocument),
    };
  }

  if (parsed.version === "ppt_scene_family/v1" && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
    const slides: RenderableSceneSlide[] = [];
    for (const page of parsed.pages) {
      if (!isRecord(page) || !isRecord(page.scene) || page.scene.version !== "ppt_scene/v1") {
        continue;
      }
      for (const slide of getSceneSlidesFromDocument(page.scene as SceneDocument)) {
        slides.push({
          ...slide,
          pageType: typeof page.pageType === "string" ? page.pageType : undefined,
        });
      }
    }

    if (slides.length === 0) return null;

    return {
      source: "family",
      slides,
    };
  }

  return null;
}

export function collectPptSceneAssetRefs(deck: PptSceneDeck): string[] {
  const refs = new Set<string>();

  const walk = (elements: SceneElement[]) => {
    for (const element of elements) {
      if (element.type === "image" && element.assetRef) {
        refs.add(element.assetRef);
      }
      if (element.type === "group" && element.children) {
        walk(element.children);
      }
    }
  };

  for (const slide of deck.slides) {
    walk(slide.elements);
  }

  return [...refs].sort();
}

export function mergePptSceneAssetManifest(
  deck: PptSceneDeck,
  manifest: SceneAssetManifest,
): PptSceneDeck {
  return {
    ...deck,
    slides: deck.slides.map((slide) => ({
      ...slide,
      assets: {
        ...manifest,
        ...slide.assets,
      },
    })),
  };
}

function canvasX(value: number): number {
  return (value / DEFAULT_CANVAS_WIDTH) * PPT_CANVAS_WIDTH;
}

function canvasY(value: number): number {
  return (value / DEFAULT_CANVAS_HEIGHT) * PPT_CANVAS_HEIGHT;
}

function resolveThemeToken(value: string | undefined, theme: SceneTheme): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const tokenMatch = trimmed.match(/^\{([^.}]+)\.([^.}]+)\}$/);
  if (tokenMatch) {
    const [, section, key] = tokenMatch;
    const source = (theme as Record<string, unknown>)[section];
    if (isRecord(source) && typeof source[key] === "string") {
      return source[key] as string;
    }
  }
  return trimmed;
}

function toPptColor(value: string | undefined, theme: SceneTheme): string | undefined {
  const resolved = resolveThemeToken(value, theme);
  if (!resolved) return undefined;
  const normalized = resolved.startsWith("#") ? resolved.slice(1) : resolved;
  if (/^[0-9a-fA-F]{8}$/.test(normalized)) {
    return normalized.slice(0, 6);
  }
  return normalized;
}

function toTransparency(opacity?: number): number | undefined {
  if (opacity == null || opacity >= 1) return undefined;
  if (opacity <= 0) return 100;
  return Math.round((1 - opacity) * 100);
}

function resolveFont(font: string | undefined, theme: SceneTheme): string | undefined {
  if (!font) return undefined;
  return theme.fonts?.[font] ?? font;
}

function containsCjk(text: string): boolean {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
}

function resolveFontForText(font: string | undefined, text: string, theme: SceneTheme): string | undefined {
  const resolved = resolveFont(font, theme);
  if (!resolved) return undefined;

  const monoFont = theme.fonts?.mono;
  if (monoFont && resolved === monoFont && containsCjk(text)) {
    return theme.fonts?.heading ?? theme.fonts?.body ?? resolved;
  }

  return resolved;
}

function mapAlign(value: string | undefined): "left" | "center" | "right" | "justify" | undefined {
  if (value === "left" || value === "center" || value === "right" || value === "justify") {
    return value;
  }
  return undefined;
}

function mapValign(value: string | undefined): "top" | "mid" | "bottom" | undefined {
  if (value === "top" || value === "mid" || value === "bottom") {
    return value;
  }
  return undefined;
}

function resolveTextStyle(styleRef: string | undefined, theme: SceneTheme): SceneTextStyle {
  if (!styleRef) return {};
  const style = theme.textStyles?.[styleRef];
  return style ? { ...style } : {};
}

function buildTextRuns(element: SceneTextElement, theme: SceneTheme): Array<{ text: string; options?: Record<string, unknown> }> {
  const baseStyle = resolveTextStyle(element.styleRef, theme);
  const paragraphs = element.paragraphs ?? [];
  const rows: Array<{ text: string; options?: Record<string, unknown> }> = [];

  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    const runs = paragraph.runs ?? [];
    for (const [runIndex, run] of runs.entries()) {
      const text = (run.uppercase ?? baseStyle.uppercase) ? run.text.toUpperCase() : run.text;
      rows.push({
        text,
        options: {
          fontFace: resolveFontForText(run.font ?? baseStyle.font, text, theme),
          fontSize: run.size ?? baseStyle.size,
          bold: run.bold ?? baseStyle.bold,
          italic: run.italic ?? baseStyle.italic,
          underline: run.underline ?? baseStyle.underline,
          color: toPptColor(run.color ?? baseStyle.color, theme),
          highlight: toPptColor(run.highlight, theme),
          charSpace: run.tracking ?? baseStyle.tracking,
          breakLine:
            paragraphIndex < paragraphs.length - 1 && runIndex === runs.length - 1 ? true : undefined,
        },
      });
    }
  }

  return rows;
}

function buildPlainSceneText(element: SceneTextElement): string {
  const paragraphs = element.paragraphs ?? [];
  return paragraphs
    .map((paragraph) =>
      (paragraph.runs ?? [])
        .map((run) => run.text)
        .join(""),
    )
    .join("\n");
}

function pickRepresentativeRun(element: SceneTextElement): SceneTextElement["paragraphs"][number]["runs"][number] | null {
  for (const paragraph of element.paragraphs ?? []) {
    for (const run of paragraph.runs ?? []) {
      if (run.text) return run;
    }
  }
  return null;
}

function resolveBox(element: SceneCommonElement, offsetX = 0, offsetY = 0) {
  return {
    x: canvasX(offsetX + element.x),
    y: canvasY(offsetY + element.y),
    w: canvasX(element.w),
    h: canvasY(element.h),
  };
}

function resolveImageSource(element: SceneImageElement, assets: Record<string, SceneAsset>): { path?: string; data?: string } | null {
  const candidate = element.src ?? (element.assetRef ? assets[element.assetRef]?.src : undefined);
  if (!candidate) return null;
  if (candidate.startsWith("data:image/")) {
    return { data: candidate };
  }
  const normalized = candidate.startsWith("file://") ? candidate.slice(7) : candidate;
  if (existsSync(normalized)) return { path: normalized };
  const cwdPath = join(process.cwd(), normalized);
  if (existsSync(cwdPath)) return { path: cwdPath };
  return null;
}

function renderSceneText(
  pptSlide: PptxGenJS.Slide,
  element: SceneTextElement,
  theme: SceneTheme,
  offsetX = 0,
  offsetY = 0,
) {
  const style = resolveTextStyle(element.styleRef, theme);
  const representativeRun = pickRepresentativeRun(element);
  const plainText = buildPlainSceneText(element);
  if (!plainText.trim()) return;
  const box = resolveBox(element, offsetX, offsetY);
  const options: Record<string, unknown> = {
    ...box,
    align: mapAlign(element.paragraphs?.[0]?.align ?? style.align),
    valign: mapValign(element.paragraphs?.[0]?.valign ?? style.valign),
    fontFace: resolveFontForText(representativeRun?.font ?? style.font, plainText, theme),
    fontSize: representativeRun?.size ?? style.size,
    bold: representativeRun?.bold ?? style.bold,
    italic: representativeRun?.italic ?? style.italic,
    underline: representativeRun?.underline ?? style.underline,
    color: toPptColor(representativeRun?.color ?? style.color, theme),
    fit: element.fit === "clip" ? undefined : "shrink",
    rotate: element.rotate,
    transparency: toTransparency(element.opacity),
    margin: 0,
  };

  pptSlide.addText(plainText, options);
}

function renderSceneShape(
  pptSlide: PptxGenJS.Slide,
  element: SceneShapeElement,
  theme: SceneTheme,
  offsetX = 0,
  offsetY = 0,
) {
  const box = resolveBox(element, offsetX, offsetY);
  const rawShapeType = element.shape ?? "rect";
  const shapeType = rawShapeType === "rect" && (element.radius ?? 0) > 0 ? "roundRect" : rawShapeType;
  const options: Record<string, unknown> = {
    ...box,
    rotate: element.rotate,
    transparency: toTransparency(element.opacity),
  };

  if (shapeType === "line") {
    const lineColor = toPptColor(element.stroke ?? element.fill, theme);
    const lineWidth = Math.max(element.strokeWidth ?? 1, 1);
    const isVertical = box.w === 0 && box.h > 0;
    const isHorizontal = box.h === 0 && box.w > 0;

    if (isVertical || isHorizontal) {
      pptSlide.addShape("rect" as never, {
        x: box.x,
        y: box.y,
        w: isVertical ? Math.max(lineWidth / 72, 0.02) : box.w,
        h: isHorizontal ? Math.max(lineWidth / 72, 0.02) : box.h,
        fill: {
          color: lineColor,
          transparency: toTransparency(element.opacity),
        },
        line: {
          color: lineColor ?? "000000",
          transparency: 100,
        },
        rotate: element.rotate,
      });
      return;
    }

    options.line = {
      color: lineColor,
      width: lineWidth,
      dash: element.strokeDash ?? "solid",
      transparency: toTransparency(element.opacity),
    };
  } else {
    options.fill = {
      color: toPptColor(element.fill, theme),
      transparency: toTransparency(element.opacity),
    };
    options.line = {
      color: toPptColor(element.stroke, theme) ?? "000000",
      width: element.strokeWidth ?? 0,
      dash: element.strokeDash ?? "solid",
      transparency: element.stroke ? toTransparency(element.opacity) : 100,
    };
  }

  if (element.shadow) {
    options.shadow = {
      type: "outer",
      color: toPptColor(element.shadow.color, theme) ?? "000000",
      opacity: element.shadow.opacity ?? 0.12,
      blur: element.shadow.blur,
      distance: element.shadow.distance,
      angle: element.shadow.angle,
    };
  }

  pptSlide.addShape(shapeType as never, options);
}

function renderSceneImage(
  pptSlide: PptxGenJS.Slide,
  element: SceneImageElement,
  theme: SceneTheme,
  assets: Record<string, SceneAsset>,
  warnings: string[],
  offsetX = 0,
  offsetY = 0,
) {
  const box = resolveBox(element, offsetX, offsetY);
  const imageSource = resolveImageSource(element, assets);
  if (imageSource) {
    pptSlide.addImage({
      ...box,
      path: imageSource.path,
      data: imageSource.data,
    });
  } else {
    warnings.push(`Scene image "${element.id ?? element.assetRef ?? "unknown"}" could not be resolved; placeholder rendered.`);
    pptSlide.addShape("rect" as never, {
      ...box,
      fill: { color: toPptColor("{palette.surface}", theme) ?? "F5F5F5" },
      line: { color: toPptColor("{palette.border}", theme) ?? "D9D9D9", width: 1 },
    });
    pptSlide.addText(element.assetRef ?? "[image]", {
      ...box,
      fontSize: 12,
      color: toPptColor("{palette.muted}", theme) ?? "777777",
      align: "center",
      valign: "middle",
      margin: 0,
    });
  }

  if (element.stroke || element.strokeWidth) {
    pptSlide.addShape("rect" as never, {
      ...box,
      fill: { color: "FFFFFF", transparency: 100 },
      line: {
        color: toPptColor(element.stroke, theme) ?? "000000",
        width: element.strokeWidth ?? 1,
      },
    });
  }
}

function renderSceneTable(
  pptSlide: PptxGenJS.Slide,
  element: SceneTableElement,
  theme: SceneTheme,
  offsetX = 0,
  offsetY = 0,
) {
  const box = resolveBox(element, offsetX, offsetY);
  const columns = element.columns?.length ? element.columns.map((col) => canvasX(col)) : undefined;
  const headerRow = (element.header ?? []).map((cell) => ({
    text: cell.text,
    options: {
      bold: true,
      color: toPptColor(cell.color ?? "{palette.surface}", theme),
      fill: toPptColor(cell.fill ?? "{palette.primary}", theme),
      align: cell.align ?? "center",
      valign: "mid",
      margin: element.cellStyle?.padding ?? 6,
      border: {
        type: "solid",
        pt: element.cellStyle?.borderWidth ?? 1,
        color: toPptColor(element.cellStyle?.borderColor ?? "{palette.border}", theme) ?? "DDDDDD",
      },
    },
  }));

  const dataRows = (element.rows ?? []).map((row, rowIndex) =>
    row.map((rawCell) => {
      const cell = typeof rawCell === "string" ? { text: rawCell } : rawCell;
      const fill =
        cell.fill ??
        (element.stripe?.enabled && rowIndex % 2 === 1 ? element.stripe.fill : undefined) ??
        element.cellStyle?.fill;
      return {
        text: cell.text,
        options: {
          color: toPptColor(cell.color ?? element.cellStyle?.color ?? "{palette.text}", theme),
          fill: fill ? toPptColor(fill, theme) : undefined,
          align: cell.align ?? element.cellStyle?.align ?? "left",
          valign: element.cellStyle?.valign ?? "mid",
          margin: element.cellStyle?.padding ?? 6,
          border: {
            type: "solid",
            pt: element.cellStyle?.borderWidth ?? 1,
            color: toPptColor(element.cellStyle?.borderColor ?? "{palette.border}", theme) ?? "DDDDDD",
          },
        },
      };
    }),
  );

  pptSlide.addTable([headerRow, ...dataRows], {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    colW: columns,
    border: {
      type: "solid",
      pt: element.cellStyle?.borderWidth ?? 1,
      color: toPptColor(element.cellStyle?.borderColor ?? "{palette.border}", theme) ?? "DDDDDD",
    },
    margin: element.cellStyle?.padding ?? 6,
  });
}

function renderSceneGroup(
  pptSlide: PptxGenJS.Slide,
  element: SceneGroupElement,
  theme: SceneTheme,
  assets: Record<string, SceneAsset>,
  warnings: string[],
  offsetX = 0,
  offsetY = 0,
) {
  const groupOffsetX = offsetX + element.x;
  const groupOffsetY = offsetY + element.y;
  const children = [...(element.children ?? [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  for (const child of children) {
    renderSceneElement(pptSlide, child, theme, assets, warnings, groupOffsetX, groupOffsetY);
  }
}

function renderSceneElement(
  pptSlide: PptxGenJS.Slide,
  element: SceneElement,
  theme: SceneTheme,
  assets: Record<string, SceneAsset>,
  warnings: string[],
  offsetX = 0,
  offsetY = 0,
) {
  switch (element.type) {
    case "text":
      renderSceneText(pptSlide, element, theme, offsetX, offsetY);
      break;
    case "shape":
      renderSceneShape(pptSlide, element, theme, offsetX, offsetY);
      break;
    case "image":
      renderSceneImage(pptSlide, element, theme, assets, warnings, offsetX, offsetY);
      break;
    case "table":
      renderSceneTable(pptSlide, element, theme, offsetX, offsetY);
      break;
    case "group":
      renderSceneGroup(pptSlide, element, theme, assets, warnings, offsetX, offsetY);
      break;
    default:
      warnings.push(`Unsupported scene element type "${element.type}" skipped.`);
  }
}

function inferSemanticRole(pageType?: string): string | undefined {
  if (!pageType) return undefined;
  if (pageType.startsWith("cover")) return "cover";
  if (pageType.startsWith("toc")) return "toc";
  if (pageType.startsWith("section_break")) return "section_break";
  if (pageType.startsWith("comparison")) return "comparison";
  if (pageType.startsWith("timeline")) return "timeline";
  if (pageType.startsWith("table")) return "table";
  if (pageType.startsWith("image_focus")) return "image_focus";
  if (pageType.startsWith("summary")) return "summary";
  if (pageType.startsWith("closing")) return "closing";
  return "bullet_list";
}

export function buildPptSceneDeckSummary(deck: PptSceneDeck): DeckCompositionSummary {
  const semanticRoleCounts: Record<string, number> = {};
  for (const slide of deck.slides) {
    const role = inferSemanticRole(slide.pageType);
    if (role) semanticRoleCounts[role] = (semanticRoleCounts[role] ?? 0) + 1;
  }

  return {
    source: "structured",
    totalSlides: deck.slides.length,
    semanticRoleCounts,
  };
}

export async function renderPptSceneDeckToBuffer(deck: PptSceneDeck): Promise<SceneRenderResult> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const warnings: string[] = [];
  for (const slide of deck.slides) {
    const pptSlide = pptx.addSlide();
    const backgroundFill = toPptColor(slide.backgroundFill, slide.theme);
    if (backgroundFill) {
      pptSlide.background = { color: backgroundFill };
    }

    const elements = [...slide.elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    for (const element of elements) {
      renderSceneElement(pptSlide, element, slide.theme, slide.assets, warnings);
    }

    if (slide.notes) {
      pptSlide.addNotes?.(slide.notes.slice(0, 1000));
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as unknown as Buffer;
  return {
    buffer,
    warnings: [...new Set(warnings)],
    renderMode: deck.source === "family" ? "scene_family_v1" : "scene_canvas_v1",
    compositionSummary: buildPptSceneDeckSummary(deck),
  };
}
