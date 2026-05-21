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

export type DeckSlideValidationResult =
  | { ok: true; slide: DeckSlide }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function coerceString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

function coerceNonEmptyString(value: unknown, fallback: string): string {
  return coerceString(value, fallback).trim() || fallback;
}

function coerceOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  return coerceString(value);
}

function coercePaletteColor(value: unknown, fallback: string): string {
  if (typeof value === "string") return normalizeHexColor(value, fallback);
  if (!isRecord(value)) return fallback;

  for (const key of ["hex", "color", "value", "code", "rgb"]) {
    const candidate = value[key];
    if (typeof candidate === "string") return normalizeHexColor(candidate, fallback);
  }

  return fallback;
}

function coercePalette(value: unknown): string[] {
  const fallbackPalette = ["0B1220", "111827", "38BDF8", "F59E0B"];
  const rawValues = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  const palette = rawValues
    .slice(0, 6)
    .map((item, index) => coercePaletteColor(item, fallbackPalette[index] ?? fallbackPalette[0]));

  while (palette.length < 3) {
    palette.push(fallbackPalette[palette.length] ?? fallbackPalette[0]);
  }

  return palette;
}

function coerceStringArray(value: unknown): string[] | unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => coerceString(item).trim()).filter(Boolean);
}

function coerceNumberArray(value: unknown): number[] | unknown {
  if (!Array.isArray(value)) return value;
  return value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item));
}

function coerceRows(value: unknown): string[][] | unknown {
  if (!Array.isArray(value)) return value;
  return value
    .filter(Array.isArray)
    .map((row) => row.map((item) => coerceString(item).trim()).filter(Boolean))
    .filter((row) => row.length > 0);
}

function coerceContentBlocks(value: unknown, fallbackBody: string): unknown {
  const safeFallback = fallbackBody.trim() || "围绕本页主题提炼关键判断和管理动作。";
  if (!Array.isArray(value) || value.length === 0) return [{ body: safeFallback }];

  const blocks = value.map((block) => {
    if (!isRecord(block)) return { body: coerceNonEmptyString(block, safeFallback) };
    return {
      ...block,
      heading: coerceOptionalString(block.heading),
      body: coerceNonEmptyString(block.body, safeFallback),
      emphasis: block.emphasis == null ? block.emphasis : coerceString(block.emphasis),
    };
  });
  return blocks.some((block) => isRecord(block) && coerceString(block.body).trim())
    ? blocks
    : [{ body: safeFallback }];
}

function coerceChart(value: unknown): unknown {
  if (value == null) return value;
  if (!isRecord(value)) return null;
  const labels = coerceStringArray(value.labels);
  const values = coerceNumberArray(value.values);
  if (
    !Array.isArray(labels) ||
    labels.length === 0 ||
    !Array.isArray(values) ||
    values.length === 0
  ) {
    return null;
  }

  return {
    ...value,
    title: coerceNonEmptyString(value.title, "关键指标"),
    labels: labels.slice(0, 8),
    values: values.slice(0, 8),
    unit: coerceOptionalString(value.unit),
  };
}

function coerceTable(value: unknown): unknown {
  if (value == null) return value;
  if (!isRecord(value)) return null;
  const headers = coerceStringArray(value.headers);
  const rows = coerceRows(value.rows);
  if (
    !Array.isArray(headers) ||
    headers.length === 0 ||
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return null;
  }

  return {
    ...value,
    title: coerceOptionalString(value.title),
    headers: headers.slice(0, 5),
    rows: rows.slice(0, 8).map((row) => row.slice(0, 5)),
  };
}

function coerceTimeline(value: unknown): unknown {
  if (value == null) return value;
  const items = Array.isArray(value)
    ? value
    : isRecord(value)
      ? (["items", "steps", "milestones", "events", "nodes", "timeline"]
          .map((key) => value[key])
          .find(Array.isArray) as unknown[] | undefined)
      : undefined;

  if (!items || items.length === 0) return null;

  const timeline = items.map((item, index) => {
    if (!isRecord(item)) return item;
    const label = coerceNonEmptyString(item.label, `阶段 ${index + 1}`);
    return {
      ...item,
      label,
      description: coerceNonEmptyString(item.description, label),
      date: coerceOptionalString(item.date),
    };
  });
  return timeline.some((item) => isRecord(item) && coerceString(item.label).trim())
    ? timeline
    : null;
}

function fallbackVisualPrompt(pageType: string, title: string, keyMessage: string): string {
  const subject = [title, keyMessage].filter(Boolean).join(" - ").slice(0, 140);
  return [
    "premium enterprise presentation visual system",
    `${pageType || "business"} slide`,
    subject || "strategic management theme",
    "abstract diagram composition, semantic line icons, layered shapes, executive consulting style",
  ].join(", ");
}

function coerceSlide(value: unknown, index: number): unknown {
  if (!isRecord(value)) return value;
  const title = coerceNonEmptyString(value.title, `第 ${index + 1} 页`);
  const keyMessage = coerceNonEmptyString(value.keyMessage, title);
  const pageType = coerceString(value.pageType);
  const visualPrompt = coerceString(value.visualPrompt).trim();

  return {
    ...value,
    id: coerceString(value.id, `slide-${index + 1}`),
    pageType,
    layoutPattern: coerceString(value.layoutPattern, `layout-${index + 1}`),
    title,
    subtitle: coerceOptionalString(value.subtitle),
    keyMessage,
    contentBlocks: coerceContentBlocks(value.contentBlocks, keyMessage || title),
    chart: coerceChart(value.chart),
    table: coerceTable(value.table),
    timeline: coerceTimeline(value.timeline),
    visualPrompt: visualPrompt || fallbackVisualPrompt(pageType, title, keyMessage),
    speakerNotes: coerceNonEmptyString(value.speakerNotes, keyMessage),
    layoutIntent: coerceNonEmptyString(
      value.layoutIntent,
      "正文左对齐，使用图标、图解或数据组件承载视觉重点。",
    ),
    contentDensity:
      value.contentDensity == null ? value.contentDensity : coerceString(value.contentDensity),
    visualHierarchy: coerceNonEmptyString(
      value.visualHierarchy,
      "标题、关键判断、内容块与视觉元素形成清晰层级。",
    ),
  };
}

function coerceDeckPlanCandidate(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const candidate: Record<string, unknown> = { ...raw };

  candidate.title = coerceNonEmptyString(candidate.title, "企业专题汇报");
  candidate.subtitle = coerceNonEmptyString(candidate.subtitle, "结构化汇报材料");
  candidate.audience = coerceNonEmptyString(candidate.audience, "管理层与项目相关方");
  candidate.visualDirection = coerceNonEmptyString(
    candidate.visualDirection,
    "正式商务、清晰图解、稳定配色的企业级演示风格。",
  );

  if (isRecord(candidate.theme)) {
    const theme: Record<string, unknown> = { ...candidate.theme };
    theme.palette = coercePalette(theme.palette);
    theme.mood = coerceNonEmptyString(theme.mood, "正式、稳健、清晰");
    const referenceKeywords = coerceStringArray(theme.referenceKeywords);
    theme.referenceKeywords =
      Array.isArray(referenceKeywords) && referenceKeywords.length > 0
        ? referenceKeywords
        : ["enterprise presentation", "consulting deck"];
    theme.visualMotif = coerceNonEmptyString(theme.visualMotif, "企业能力图解与治理网络");
    theme.paletteDominance = coerceNonEmptyString(
      theme.paletteDominance,
      "主色 65%，辅助色 25%，强调色 10%",
    );
    candidate.theme = theme;
  }

  if (Array.isArray(candidate.slides)) {
    candidate.slides = candidate.slides.map(coerceSlide);
  }

  return candidate;
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

export function validateDeckSlide(raw: unknown): DeckSlideValidationResult {
  const wrapped = { ...(raw as Record<string, unknown>) };
  const result = validateDeckPlan(
    {
      title: "slide-validate",
      subtitle: "slide-validate",
      audience: "slide-validate",
      visualDirection: "slide-validate",
      theme: {
        palette: ["0B1220", "111827", "38BDF8"],
        mood: "professional",
        referenceKeywords: ["business"],
        visualMotif: "clean geometry",
        paletteDominance: "dark base with cool accents",
      },
      slides: [wrapped],
    } as unknown,
    1,
  );
  if (!result.ok) return { ok: false, errors: result.errors };
  return { ok: true, slide: result.deckPlan.slides[0] };
}

export function validateDeckPlan(raw: unknown, slideCount: number): DeckPlanValidationResult {
  const candidate = coerceDeckPlanCandidate(unwrapDeckPlan(raw));

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
      hasUnderlineDecorationIntent(`${slide.layoutIntent} ${slide.visualHierarchy}`),
    )
    .map((slide) => slide.id);
  if (underlines.length > 0) {
    issues.push(`避免标题下划线式装饰：${underlines.join(", ")}`);
  }

  return issues;
}

function hasUnderlineDecorationIntent(text: string): boolean {
  const normalized = text.replace(/\s+/g, "");
  if (
    /不(使用|采用|要|做|设置|添加|出现)?(标题)?(下划线|标题线|横线装饰)/i.test(normalized) ||
    /避免(标题)?(下划线|标题线|横线装饰|underline)/i.test(normalized) ||
    /(?:do\s*not|don't|no)(?:\w|\W){0,24}underline/i.test(text)
  ) {
    return false;
  }

  return /underline|下划线|标题线|横线装饰/i.test(text);
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
