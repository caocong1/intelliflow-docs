import { DEFAULT_PPT_AI_CONFIG } from "../ppt-agent-config/defaults";
import type { PptAiRuntimeConfig } from "../ppt-agent-config/types";
import { NO_TEXT_IMAGE_SUFFIX, SUPPORTED_PAGE_TYPES, extractJsonObject } from "./deck-plan-schema";
import type { DeckPlan, DeckSlide, PptAiClient } from "./types";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export class MiniMaxConfigError extends Error {
  constructor(apiKeyEnvVar = DEFAULT_PPT_AI_CONFIG.apiKeyEnvVar) {
    super(`${apiKeyEnvVar} 环境变量未配置，无法启动 PPT 生成任务。`);
    this.name = "MiniMaxConfigError";
  }
}

export class MiniMaxClient implements PptAiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly apiKeyEnvVar: string;
  private readonly textModel: string;
  private readonly textEndpoint: string;
  private readonly imageModel: string;
  private readonly imageEndpoint: string;
  private readonly imageAspectRatio: string;
  private readonly imageResponseFormat: "base64";
  private readonly imagePromptOptimizer: boolean;
  private readonly temperature: number;
  private readonly maxCompletionTokens: number;
  private readonly textTimeoutMs: number;
  private readonly imageTimeoutMs: number;

  constructor(options?: Partial<PptAiRuntimeConfig>) {
    const config = { ...DEFAULT_PPT_AI_CONFIG, ...(options ?? {}) };
    this.baseUrl = normalizeBaseUrl(
      config.baseUrl || process.env.MINIMAX_BASE_URL || DEFAULT_PPT_AI_CONFIG.baseUrl,
    );
    this.apiKeyEnvVar = config.apiKeyEnvVar || DEFAULT_PPT_AI_CONFIG.apiKeyEnvVar;
    this.apiKey = options?.apiKey ?? process.env[this.apiKeyEnvVar];
    this.textModel = config.textModel;
    this.textEndpoint = normalizeEndpoint(config.textEndpoint);
    this.imageModel = config.imageModel;
    this.imageEndpoint = normalizeEndpoint(config.imageEndpoint);
    this.imageAspectRatio = config.imageAspectRatio;
    this.imageResponseFormat = "base64";
    this.imagePromptOptimizer = config.imagePromptOptimizer;
    this.temperature = config.temperature;
    this.maxCompletionTokens = config.maxCompletionTokens;
    this.textTimeoutMs = config.textTimeoutMs;
    this.imageTimeoutMs = config.imageTimeoutMs;
  }

  assertReady(): void {
    if (!this.apiKey?.trim()) {
      throw new MiniMaxConfigError(this.apiKeyEnvVar);
    }
  }

  async createDeckPlan(input: {
    prompt: string;
    slideCount: number;
    style: string;
    validationErrors?: string[];
  }): Promise<unknown> {
    const content = await this.chatJson([
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: buildDirectorPrompt(
          input.prompt,
          input.slideCount,
          input.style,
          input.validationErrors,
        ),
      },
    ]);
    return extractJsonObject(content);
  }

  async rewriteDeckPlan(input: {
    prompt: string;
    slideCount: number;
    style: string;
    deckPlan: DeckPlan;
    critique: string[];
  }): Promise<unknown> {
    const content = await this.chatJson([
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: [
          buildDirectorPrompt(input.prompt, input.slideCount, input.style, input.critique),
          "下面是需要按批评意见重写的 DeckPlan JSON：",
          JSON.stringify(input.deckPlan),
          "只返回修订后的 JSON，不要解释。",
        ].join("\n\n"),
      },
    ]);
    return extractJsonObject(content);
  }

  async generateImage(input: {
    prompt: string;
    slide: DeckSlide;
    deckPlan: DeckPlan;
  }): Promise<string> {
    this.assertReady();
    const prompt = ensureNoTextSuffix(
      [
        input.prompt,
        `Style mood: ${input.deckPlan.theme.mood}`,
        `Visual motif: ${input.deckPlan.theme.visualMotif}`,
        `Slide role: ${input.slide.pageType}`,
      ].join(". "),
    );

    const res = await fetchWithTimeout(
      buildUrl(this.baseUrl, this.imageEndpoint),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.imageModel,
          aspect_ratio: this.imageAspectRatio,
          response_format: this.imageResponseFormat,
          n: 1,
          prompt_optimizer: this.imagePromptOptimizer,
          prompt,
        }),
      },
      this.imageTimeoutMs,
      "MiniMax image_generation",
    );

    if (!res.ok) {
      throw new Error(`MiniMax image_generation failed: HTTP ${res.status}`);
    }

    const payload = (await res.json()) as unknown;
    const base64 = extractImageBase64(payload);
    if (!base64) {
      throw new Error("MiniMax image_generation 返回中未找到 base64 图片");
    }

    return base64.startsWith("data:image/") ? base64 : `data:image/png;base64,${base64}`;
  }

  async composeSlide(input: {
    prompt: string;
    style: string;
    slide: DeckSlide;
    deckPlan: DeckPlan;
    styleDnaSummary: string;
    validationErrors?: string[];
    fixReason?: string;
  }): Promise<unknown> {
    const content = await this.chatJson([
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: buildSlideComposerPrompt(input),
      },
    ]);
    return extractJsonObject(content);
  }

  async reviewDeck(input: { deckPlan: DeckPlan; style: string; prompt: string }): Promise<unknown> {
    const content = await this.chatJson([
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: buildDeckReviewerPrompt(input),
      },
    ]);
    return extractJsonObject(content);
  }

  private async chatJson(messages: ChatMessage[]): Promise<string> {
    this.assertReady();
    const res = await fetchWithTimeout(
      buildUrl(this.baseUrl, this.textEndpoint),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.textModel,
          temperature: this.temperature,
          response_format: { type: "json_object" },
          reasoning_split: true,
          max_completion_tokens: this.maxCompletionTokens,
          messages,
        }),
      },
      this.textTimeoutMs,
      "MiniMax chat/completions",
    );

    if (!res.ok) {
      throw new Error(`MiniMax chat/completions failed: HTTP ${res.status}`);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("MiniMax chat/completions 返回为空");
    return content;
  }

  async testTextConnection(): Promise<{ latencyMs: number; model: string }> {
    this.assertReady();
    const startedAt = Date.now();
    const res = await fetchWithTimeout(
      buildUrl(this.baseUrl, this.textEndpoint),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.textModel,
          temperature: 0.1,
          messages: [{ role: "user", content: 'Return JSON only: {"ok": true}' }],
          max_completion_tokens: 256,
          reasoning_split: true,
        }),
      },
      Math.min(this.textTimeoutMs, 30_000),
      "PPT AI chat/completions",
    );
    if (!res.ok) {
      throw new Error(`PPT AI chat/completions failed: HTTP ${res.status}`);
    }
    return { latencyMs: Date.now() - startedAt, model: this.textModel };
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildUrl(baseUrl: string, endpoint: string): string {
  return `${normalizeBaseUrl(baseUrl)}${normalizeEndpoint(endpoint)}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildSystemPrompt(): string {
  return [
    "You are a senior presentation design director for enterprise executive decks.",
    "Return valid JSON only. Do not include markdown, comments, or explanations.",
    "This is a fixed structured workflow, not an autonomous agent.",
    "Visible slide text must be concise Chinese business copy. Speaker notes carry narrative detail.",
    "Design with a resource-aware mix: semantic line icons, editable diagrams, charts/tables, and only a few high-impact text-free images.",
    "Do not assume every slide needs an AI-generated image. Governance, metrics, risk, table, agenda, architecture, and timeline slides should usually be diagram/icon-first.",
    "Every slide must have visual guidance, but visualPrompt is only for slides that truly need image generation.",
  ].join("\n");
}

function buildDirectorPrompt(
  prompt: string,
  slideCount: number,
  style: string,
  validationErrors?: string[],
): string {
  const requiredTypes =
    slideCount >= 12
      ? "For 12+ slides, use at least 8 clearly different pageType values."
      : "Use as many distinct pageType values as the narrative needs.";

  return [
    `User request:\n${prompt}`,
    `Slide count: ${slideCount}`,
    `Style preference: ${style || "auto"}`,
    validationErrors?.length
      ? `Previous validation/critic issues to fix:\n${validationErrors.map((item) => `- ${item}`).join("\n")}`
      : "",
    "Produce one DeckPlan JSON object with exactly this top-level structure:",
    "title, subtitle, audience, visualDirection, theme, slides.",
    "theme must include palette, mood, referenceKeywords, visualMotif, paletteDominance.",
    "Each slide must include id, pageType, layoutPattern, title, optional subtitle, keyMessage, contentBlocks, optional chart/table/timeline, visualPrompt, speakerNotes, layoutIntent, contentDensity, visualHierarchy.",
    `Allowed pageType values: ${SUPPORTED_PAGE_TYPES.join(", ")}.`,
    requiredTypes,
    "Cover any explicitly requested slide types from the user prompt.",
    "Avoid default blue-white-gray stacked templates. Choose a content-related dominant color plus 1-2 support colors and one accent.",
    "Keep palette dominance stable across the whole deck: one dominant background/color system must carry 60-70% of slides; do not alternate dark blue pages with white/gold pages.",
    "Do not repeat adjacent layoutPattern values.",
    "Do not propose title underline decoration.",
    "Use semantic icon suggestions in layoutIntent or visualHierarchy when a slide is better served by icons/diagrams than generated imagery.",
    "Only use image-style visualPrompt for cover, section divider, closing, or a small number of strategic/scenario slides. For diagram-first slides, describe the desired diagram/icon composition instead of a rendered background.",
    "visualPrompt must describe image/abstract/scene composition only. Do not ask the image model to render text, letters, typography, UI labels, screenshots, logos, or captions.",
    "All visualPrompt values must be suitable for appending: no text / no letters / no typography / no UI labels.",
    "Use Microsoft YaHei as the intended Chinese font in layout notes when relevant.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function ensureNoTextSuffix(prompt: string): string {
  const cleaned = prompt.trim();
  if (cleaned.toLowerCase().includes(NO_TEXT_IMAGE_SUFFIX.toLowerCase())) return cleaned;
  return `${cleaned}, ${NO_TEXT_IMAGE_SUFFIX}`;
}

function buildSlideComposerPrompt(input: {
  prompt: string;
  style: string;
  slide: DeckSlide;
  deckPlan: DeckPlan;
  styleDnaSummary: string;
  validationErrors?: string[];
  fixReason?: string;
}): string {
  return [
    `User request:\n${input.prompt}`,
    `Style preference: ${input.style || "auto"}`,
    `Deck style DNA:\n${input.styleDnaSummary}`,
    input.validationErrors?.length
      ? `Previous validation issues:\n${input.validationErrors.map((item) => `- ${item}`).join("\n")}`
      : "",
    input.fixReason ? `Targeted fix objective:\n${input.fixReason}` : "",
    "Rewrite exactly one slide JSON object using the same schema as DeckPlan.slide.",
    "Do not remove required fields. Keep pageType stable unless current content is obviously mismatched.",
    "Visible text concise Chinese. Speaker notes can be richer.",
    `Current slide JSON:\n${JSON.stringify(input.slide)}`,
    "Return only JSON object for that single slide.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildDeckReviewerPrompt(input: { deckPlan: DeckPlan; style: string; prompt: string }): string {
  return [
    `User request:\n${input.prompt}`,
    `Style preference: ${input.style || "auto"}`,
    "Review and improve full deck coherence while preserving exact slide count and schema.",
    "Fix only cross-slide narrative flow, hierarchy consistency, and density rhythm.",
    "Do not introduce markdown. Return complete DeckPlan JSON only.",
    JSON.stringify(input.deckPlan),
  ].join("\n\n");
}

function extractImageBase64(payload: unknown): string | null {
  const values = collectStringLeaves(payload);
  return (
    values.find((value) => value.startsWith("data:image/")) ??
    values.find((value) => /^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 200) ??
    null
  );
}

function collectStringLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value.trim()];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectStringLeaves);
  return Object.values(value).flatMap(collectStringLeaves);
}
