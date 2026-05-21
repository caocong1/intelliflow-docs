import Ajv, { type ErrorObject } from "ajv";
import type { DeckPlan, DeckSlide } from "./types";

export const SUPPORTED_PAGE_TYPES = [
  "cover",
  "agenda",
  "section",
  "problem",
  "strategy",
  "architecture",
  "capability",
  "governance",
  "scenario",
  "timeline",
  "metrics",
  "table",
  "risk",
  "summary",
  "closing",
] as const;

export const NO_TEXT_IMAGE_SUFFIX = "no text / no letters / no typography / no UI labels";

const slideSchema = {
  type: "object",
  additionalProperties: true,
  required: [
    "id",
    "pageType",
    "layoutPattern",
    "title",
    "keyMessage",
    "contentBlocks",
    "visualPrompt",
    "speakerNotes",
    "layoutIntent",
    "contentDensity",
    "visualHierarchy",
  ],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    pageType: { type: "string", enum: SUPPORTED_PAGE_TYPES },
    layoutPattern: { type: "string", minLength: 1, maxLength: 120 },
    title: { type: "string", minLength: 1, maxLength: 160 },
    subtitle: { type: "string", maxLength: 240 },
    keyMessage: { type: "string", minLength: 1, maxLength: 500 },
    contentBlocks: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: true,
        required: ["body"],
        properties: {
          heading: { type: "string", maxLength: 100 },
          body: { type: "string", minLength: 1, maxLength: 500 },
          emphasis: { anyOf: [{ type: "string", maxLength: 40 }, { type: "null" }] },
        },
      },
    },
    chart: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: true,
          required: ["title", "labels", "values"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 120 },
            labels: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
            values: { type: "array", minItems: 1, maxItems: 8, items: { type: "number" } },
            unit: { type: "string", maxLength: 20 },
          },
        },
      ],
    },
    table: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: true,
          required: ["headers", "rows"],
          properties: {
            title: { type: "string", maxLength: 120 },
            headers: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
            rows: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
            },
          },
        },
      ],
    },
    timeline: {
      anyOf: [
        { type: "null" },
        {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: true,
            required: ["label", "description"],
            properties: {
              label: { type: "string", minLength: 1, maxLength: 80 },
              description: { type: "string", minLength: 1, maxLength: 240 },
              date: { type: "string", maxLength: 40 },
            },
          },
        },
      ],
    },
    visualPrompt: { type: "string", minLength: 1, maxLength: 900 },
    speakerNotes: { type: "string", minLength: 1, maxLength: 1200 },
    layoutIntent: { type: "string", minLength: 1, maxLength: 320 },
    contentDensity: { anyOf: [{ type: "string", minLength: 1, maxLength: 40 }, { type: "null" }] },
    visualHierarchy: { type: "string", minLength: 1, maxLength: 320 },
  },
};

const deckPlanSchema = {
  type: "object",
  additionalProperties: true,
  required: ["title", "subtitle", "audience", "visualDirection", "theme", "slides"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 160 },
    subtitle: { type: "string", minLength: 1, maxLength: 240 },
    audience: { type: "string", minLength: 1, maxLength: 240 },
    visualDirection: { type: "string", minLength: 1, maxLength: 500 },
    theme: {
      type: "object",
      additionalProperties: true,
      required: ["palette", "mood", "referenceKeywords", "visualMotif", "paletteDominance"],
      properties: {
        palette: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: { type: "string", minLength: 3, maxLength: 20 },
        },
        mood: { type: "string", minLength: 1, maxLength: 120 },
        referenceKeywords: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "string", minLength: 1, maxLength: 80 },
        },
        visualMotif: { type: "string", minLength: 1, maxLength: 180 },
        paletteDominance: { type: "string", minLength: 1, maxLength: 180 },
      },
    },
    slides: { type: "array", minItems: 1, maxItems: 30, items: slideSchema },
  },
};

const ajv = new Ajv({ allErrors: true });
const validateDeckPlanSchema = ajv.compile(deckPlanSchema);

export type DeckPlanValidationResult =
  | { ok: true; deckPlan: DeckPlan }
  | { ok: false; errors: string[] };

export function defaultSlideCount(slideCount?: number): number {
  if (!Number.isFinite(slideCount)) return 12;
  return Math.max(1, Math.min(30, Math.round(slideCount ?? 12)));
}

function describeAjvError(error: ErrorObject): string {
  const path = error.instancePath || "/";
  return `${path} ${error.message ?? "不符合结构要求"}`;
}

function normalizeHexColor(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/^#/, "")
    .replace(/[^0-9a-f]/gi, "");
  if (cleaned.length === 3) {
    return cleaned
      .split("")
      .map((ch) => `${ch}${ch}`)
      .join("")
      .toUpperCase();
  }
  if (cleaned.length >= 6) return cleaned.slice(0, 6).toUpperCase();
  return fallback;
}

function normalizeVisualPrompt(prompt: string): string {
  const stripped = prompt
    .replace(
      /\b(add|include|with|show|display|render)\s+(text|letters|typography|labels|words)\b/gi,
      "",
    )
    .replace(/文字|字幕|标题字|英文单词|中文字符|标签/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.toLowerCase().includes(NO_TEXT_IMAGE_SUFFIX.toLowerCase())) {
    return stripped;
  }
  return `${stripped}, ${NO_TEXT_IMAGE_SUFFIX}`;
}

function normalizeSlide(slide: DeckSlide, index: number): DeckSlide {
  const contentBlocks = slide.contentBlocks
    .filter((block) => block.body.trim())
    .slice(0, 6)
    .map((block) => ({
      heading: block.heading?.trim() || undefined,
      body: block.body.trim(),
      emphasis: normalizeEmphasis(block.emphasis, block.body),
    }));

  return {
    ...slide,
    id: slide.id.trim() || `slide-${index + 1}`,
    layoutPattern: slide.layoutPattern.trim() || `pattern-${index + 1}`,
    title: slide.title.trim(),
    subtitle: slide.subtitle?.trim() || undefined,
    keyMessage: slide.keyMessage.trim(),
    contentBlocks:
      contentBlocks.length > 0
        ? contentBlocks
        : [{ body: slide.keyMessage.trim() || slide.title.trim(), emphasis: "normal" }],
    chart: slide.chart ?? undefined,
    table: slide.table ?? undefined,
    timeline: slide.timeline ?? undefined,
    visualPrompt: normalizeVisualPrompt(slide.visualPrompt),
    speakerNotes: slide.speakerNotes.trim(),
    layoutIntent: slide.layoutIntent.trim(),
    contentDensity: normalizeContentDensity(slide.contentDensity),
    visualHierarchy: slide.visualHierarchy.trim(),
  };
}

function normalizeContentDensity(value: string): "low" | "medium" | "high" {
  const text = String(value ?? "").toLowerCase();
  if (/low|轻|低|sparse|少/.test(text)) return "low";
  if (/high|重|高|dense|多|拥挤/.test(text)) return "high";
  return "medium";
}

function normalizeEmphasis(
  value: "normal" | "strong" | "metric" | null | undefined | string,
  body: string,
): "normal" | "strong" | "metric" {
  const text = String(value ?? "").toLowerCase();
  if (/metric|number|kpi|指标|数字|数据|量化/.test(text) || /\d/.test(body)) return "metric";
  if (/strong|bold|重点|强调|核心|关键/.test(text)) return "strong";
  return "normal";
}

function unwrapDeckPlan(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.slides) && record.title && record.theme) return raw;

  for (const key of ["deckPlan", "DeckPlan", "plan", "presentation", "deck"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestedRecord = nested as Record<string, unknown>;
      if (Array.isArray(nestedRecord.slides)) return nested;
    }
  }

  return raw;
}

export function normalizeDeckPlan(raw: DeckPlan): DeckPlan {
  const fallbackPalette = ["0B1220", "111827", "38BDF8", "F59E0B"];
  const palette = raw.theme.palette.map((value, index) =>
    normalizeHexColor(value, fallbackPalette[index] ?? fallbackPalette[0]),
  );

  return {
    ...raw,
    title: raw.title.trim(),
    subtitle: raw.subtitle.trim(),
    audience: raw.audience.trim(),
    visualDirection: raw.visualDirection.trim(),
    theme: {
      palette,
      mood: raw.theme.mood.trim(),
      referenceKeywords: raw.theme.referenceKeywords.map((item) => item.trim()).filter(Boolean),
      visualMotif: raw.theme.visualMotif.trim(),
      paletteDominance: raw.theme.paletteDominance.trim(),
    },
    slides: raw.slides.map(normalizeSlide),
  };
}

export function validateDeckPlan(raw: unknown, slideCount: number): DeckPlanValidationResult {
  const candidate = unwrapDeckPlan(raw);

  if (!validateDeckPlanSchema(candidate)) {
    return {
      ok: false,
      errors: (validateDeckPlanSchema.errors ?? []).map(describeAjvError).slice(0, 12),
    };
  }

  const deckPlan = normalizeDeckPlan(candidate as DeckPlan);
  const errors: string[] = [];

  if (deckPlan.slides.length !== slideCount) {
    errors.push(`slides 页数必须为 ${slideCount}，当前为 ${deckPlan.slides.length}`);
  }

  const uniquePageTypes = new Set(deckPlan.slides.map((slide) => slide.pageType));
  if (slideCount >= 12 && uniquePageTypes.size < 8) {
    errors.push(`12 页方案至少需要 8 种 pageType，当前为 ${uniquePageTypes.size}`);
  }

  const repeatedLayout = findAdjacentRepeat(deckPlan.slides, (slide) => slide.layoutPattern);
  if (repeatedLayout) {
    errors.push(`相邻页 layoutPattern 不应重复：${repeatedLayout}`);
  }

  const pureTextSlides = deckPlan.slides
    .filter(
      (slide) => !slide.visualPrompt.trim() && !slide.chart && !slide.table && !slide.timeline,
    )
    .map((slide) => slide.id);
  if (pureTextSlides.length > 0) {
    errors.push(`每页必须有视觉元素，缺少 visualPrompt 的页：${pureTextSlides.join(", ")}`);
  }

  const visualTextIntent = deckPlan.slides
    .filter((slide) =>
      /文字|字幕|标题字|typography|letters|labels|words/i.test(
        slide.visualPrompt.replace(NO_TEXT_IMAGE_SUFFIX, ""),
      ),
    )
    .map((slide) => slide.id);
  if (visualTextIntent.length > 0) {
    errors.push(`visualPrompt 不允许包含生成文字/字母意图：${visualTextIntent.join(", ")}`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, deckPlan };
}

export function critiqueDeckPlan(deckPlan: DeckPlan, slideCount: number): string[] {
  const issues: string[] = [];
  const pageTypeCount = new Set(deckPlan.slides.map((slide) => slide.pageType)).size;
  if (slideCount >= 12 && pageTypeCount < 8) {
    issues.push(`pageType 不足：12 页至少 8 种，当前 ${pageTypeCount} 种`);
  }

  const palette = deckPlan.theme.palette.map((color) => color.toUpperCase());
  const blueGrayColors = palette.filter((color) =>
    /^(0F172A|1E293B|334155|475569|64748B|94A3B8|CBD5E1|E2E8F0|F1F5F9|FFFFFF|2563EB|3B82F6|1D4ED8)$/.test(
      color,
    ),
  );
  if (blueGrayColors.length >= Math.min(3, palette.length)) {
    issues.push("主题配色接近默认蓝白灰堆叠，需要使用与内容相关的主色、辅助色和 accent");
  }

  const adjacentPageType = findAdjacentRepeat(deckPlan.slides, (slide) => slide.pageType);
  if (adjacentPageType) {
    issues.push(`相邻页 pageType 重复：${adjacentPageType}`);
  }

  const adjacentLayout = findAdjacentRepeat(deckPlan.slides, (slide) => slide.layoutPattern);
  if (adjacentLayout) {
    issues.push(`相邻页布局重复：${adjacentLayout}`);
  }

  const denseSlides = deckPlan.slides
    .filter((slide) => {
      const textLength = [
        slide.title,
        slide.keyMessage,
        ...slide.contentBlocks.map((block) => `${block.heading ?? ""}${block.body}`),
      ].join("").length;
      return slide.contentDensity === "high" || textLength > 520 || slide.contentBlocks.length > 5;
    })
    .map((slide) => slide.id);
  if (denseSlides.length > Math.max(2, Math.floor(slideCount / 4))) {
    issues.push(`文字拥挤页偏多：${denseSlides.join(", ")}`);
  }

  const weakNarrative = deckPlan.slides
    .filter((slide) => slide.keyMessage.trim().length < 12)
    .map((slide) => slide.id);
  if (weakNarrative.length > 0) {
    issues.push(`叙事 keyMessage 偏弱：${weakNarrative.join(", ")}`);
  }

  const underlines = deckPlan.slides
    .filter((slide) =>
      /underline|下划线|标题线|横线装饰/i.test(`${slide.layoutIntent} ${slide.visualHierarchy}`),
    )
    .map((slide) => slide.id);
  if (underlines.length > 0) {
    issues.push(`避免标题下划线式装饰：${underlines.join(", ")}`);
  }

  return issues;
}

function findAdjacentRepeat(
  slides: DeckSlide[],
  pick: (slide: DeckSlide) => string,
): string | null {
  for (let index = 1; index < slides.length; index += 1) {
    const previous = pick(slides[index - 1]);
    const current = pick(slides[index]);
    if (previous && current && previous === current) {
      return `${slides[index - 1].id}/${slides[index].id} (${current})`;
    }
  }
  return null;
}

export function extractJsonObject(content: string): unknown {
  const trimmed = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!trimmed) throw new Error("EMPTY_MODEL_RESPONSE");

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) {
    try {
      return JSON.parse(fenced);
    } catch {
      // Fall through to balanced-object scanning; some models emit malformed
      // fenced drafts followed by a valid compact JSON object.
    }
  }

  const parsed = parseLastJsonObject(trimmed);
  if (parsed === undefined) throw new Error("MODEL_RESPONSE_NOT_JSON");
  return parsed;
}

function parseLastJsonObject(text: string): unknown {
  let parsed: unknown;
  let found = false;

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    const end = findBalancedObjectEnd(text, start);
    if (end < 0) continue;

    try {
      parsed = JSON.parse(text.slice(start, end + 1));
      found = true;
      start = end;
    } catch {
      // keep scanning; reasoning text may contain brace-like fragments
    }
  }

  return found ? parsed : undefined;
}

function findBalancedObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const ch = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}
