import { DEFAULT_PPT_AI_CONFIG } from "./defaults";
import type {
  PptAiConfig,
  PptAiConfigUpdate,
  PptAiPublicConfig,
  PptAiRuntimeConfig,
} from "./types";

type PptAiConfigRow = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string | null;
  apiKeyEnvVar: string;
  textModel: string;
  textEndpoint: string;
  imageModel: string;
  imageEndpoint: string;
  imageAspectRatio: string;
  imagePromptOptimizer: boolean;
  temperature: number | null;
  maxCompletionTokens: number;
  textTimeoutMs: number;
  imageTimeoutMs: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function loadDb() {
  const [{ db }, { pptAiConfigs }, drizzle] = await Promise.all([
    import("../../db"),
    import("../../db/schema"),
    import("drizzle-orm"),
  ]);
  return { db, pptAiConfigs, desc: drizzle.desc, eq: drizzle.eq };
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function positiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value ?? fallback));
}

function normalizeTemperature(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(2, value ?? fallback));
}

function fromRow(row: PptAiConfigRow): PptAiConfig {
  return {
    id: row.id,
    name: row.name,
    providerType: "openai_compatible",
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    apiKeyEnvVar: row.apiKeyEnvVar,
    textModel: row.textModel,
    textEndpoint: row.textEndpoint,
    imageModel: row.imageModel,
    imageEndpoint: row.imageEndpoint,
    imageAspectRatio: row.imageAspectRatio,
    imageResponseFormat: "base64",
    imagePromptOptimizer: row.imagePromptOptimizer,
    temperature: row.temperature ?? DEFAULT_PPT_AI_CONFIG.temperature,
    maxCompletionTokens: row.maxCompletionTokens,
    textTimeoutMs: row.textTimeoutMs,
    imageTimeoutMs: row.imageTimeoutMs,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function normalizePptAiConfigUpdate(input: PptAiConfigUpdate): PptAiConfigUpdate {
  const normalized: PptAiConfigUpdate = {};
  if (input.name !== undefined) normalized.name = input.name.trim();
  if (input.providerType !== undefined) normalized.providerType = "openai_compatible";
  if (input.baseUrl !== undefined) normalized.baseUrl = stripTrailingSlashes(input.baseUrl.trim());
  if (input.apiKey !== undefined) normalized.apiKey = input.apiKey?.trim() || null;
  if (input.apiKeyEnvVar !== undefined) normalized.apiKeyEnvVar = input.apiKeyEnvVar.trim();
  if (input.textModel !== undefined) normalized.textModel = input.textModel.trim();
  if (input.textEndpoint !== undefined)
    normalized.textEndpoint = normalizeEndpoint(input.textEndpoint);
  if (input.imageModel !== undefined) normalized.imageModel = input.imageModel.trim();
  if (input.imageEndpoint !== undefined)
    normalized.imageEndpoint = normalizeEndpoint(input.imageEndpoint);
  if (input.imageAspectRatio !== undefined)
    normalized.imageAspectRatio = input.imageAspectRatio.trim();
  if (input.imageResponseFormat !== undefined) normalized.imageResponseFormat = "base64";
  if (input.imagePromptOptimizer !== undefined)
    normalized.imagePromptOptimizer = input.imagePromptOptimizer;
  if (input.temperature !== undefined) {
    normalized.temperature = normalizeTemperature(
      input.temperature,
      DEFAULT_PPT_AI_CONFIG.temperature,
    );
  }
  if (input.maxCompletionTokens !== undefined) {
    normalized.maxCompletionTokens = positiveInt(
      input.maxCompletionTokens,
      DEFAULT_PPT_AI_CONFIG.maxCompletionTokens,
    );
  }
  if (input.textTimeoutMs !== undefined) {
    normalized.textTimeoutMs = positiveInt(
      input.textTimeoutMs,
      DEFAULT_PPT_AI_CONFIG.textTimeoutMs,
    );
  }
  if (input.imageTimeoutMs !== undefined) {
    normalized.imageTimeoutMs = positiveInt(
      input.imageTimeoutMs,
      DEFAULT_PPT_AI_CONFIG.imageTimeoutMs,
    );
  }
  if (input.isActive !== undefined) normalized.isActive = input.isActive;
  return normalized;
}

function mergeWithDefaults(input?: Partial<PptAiConfig>): PptAiConfig {
  const merged = { ...DEFAULT_PPT_AI_CONFIG, ...(input ?? {}) };
  return {
    ...merged,
    providerType: "openai_compatible",
    baseUrl: stripTrailingSlashes(merged.baseUrl),
    textEndpoint: normalizeEndpoint(merged.textEndpoint),
    imageEndpoint: normalizeEndpoint(merged.imageEndpoint),
    temperature: normalizeTemperature(merged.temperature, DEFAULT_PPT_AI_CONFIG.temperature),
    maxCompletionTokens: positiveInt(
      merged.maxCompletionTokens,
      DEFAULT_PPT_AI_CONFIG.maxCompletionTokens,
    ),
    textTimeoutMs: positiveInt(merged.textTimeoutMs, DEFAULT_PPT_AI_CONFIG.textTimeoutMs),
    imageTimeoutMs: positiveInt(merged.imageTimeoutMs, DEFAULT_PPT_AI_CONFIG.imageTimeoutMs),
    imageResponseFormat: "base64",
  };
}

export function resolvePptAiRuntimeConfig(
  config: PptAiConfig = DEFAULT_PPT_AI_CONFIG,
  env: Record<string, string | undefined> = process.env,
): PptAiRuntimeConfig {
  const normalized = mergeWithDefaults(config);
  return {
    ...normalized,
    apiKey: normalized.apiKey?.trim() || env[normalized.apiKeyEnvVar],
  };
}

export function toPublicPptAiConfig(
  config: PptAiConfig = DEFAULT_PPT_AI_CONFIG,
  env: Record<string, string | undefined> = process.env,
): PptAiPublicConfig {
  const normalized = mergeWithDefaults(config);
  const { apiKey: _apiKey, ...publicConfig } = normalized;
  return {
    ...publicConfig,
    createdAt: normalized.createdAt?.toISOString(),
    updatedAt: normalized.updatedAt?.toISOString(),
    apiKeyConfigured: Boolean(normalized.apiKey?.trim() || env[normalized.apiKeyEnvVar]?.trim()),
  };
}

export async function getActivePptAiConfig(): Promise<PptAiConfig> {
  const { db, pptAiConfigs, desc } = await loadDb();
  const [row] = await db.select().from(pptAiConfigs).orderBy(desc(pptAiConfigs.updatedAt)).limit(1);

  return row ? mergeWithDefaults(fromRow(row)) : DEFAULT_PPT_AI_CONFIG;
}

export async function getActivePptAiRuntimeConfig(): Promise<PptAiRuntimeConfig> {
  return resolvePptAiRuntimeConfig(await getActivePptAiConfig());
}

export async function getPublicPptAiConfig(): Promise<PptAiPublicConfig> {
  return toPublicPptAiConfig(await getActivePptAiConfig());
}

export async function updatePptAiConfig(input: PptAiConfigUpdate): Promise<PptAiPublicConfig> {
  const { db, pptAiConfigs, eq } = await loadDb();
  const patch = normalizePptAiConfigUpdate(input);
  const current = await getActivePptAiConfig();
  const values = mergeWithDefaults({ ...current, ...patch });

  if (current.id) {
    const [row] = await db
      .update(pptAiConfigs)
      .set({
        name: values.name,
        providerType: values.providerType,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        apiKeyEnvVar: values.apiKeyEnvVar,
        textModel: values.textModel,
        textEndpoint: values.textEndpoint,
        imageModel: values.imageModel,
        imageEndpoint: values.imageEndpoint,
        imageAspectRatio: values.imageAspectRatio,
        imageResponseFormat: values.imageResponseFormat,
        imagePromptOptimizer: values.imagePromptOptimizer,
        temperature: values.temperature,
        maxCompletionTokens: values.maxCompletionTokens,
        textTimeoutMs: values.textTimeoutMs,
        imageTimeoutMs: values.imageTimeoutMs,
        isActive: values.isActive,
        updatedAt: new Date(),
      })
      .where(eq(pptAiConfigs.id, current.id))
      .returning();
    return toPublicPptAiConfig(fromRow(row));
  }

  const [row] = await db
    .insert(pptAiConfigs)
    .values({
      name: values.name,
      providerType: values.providerType,
      baseUrl: values.baseUrl,
      apiKey: values.apiKey,
      apiKeyEnvVar: values.apiKeyEnvVar,
      textModel: values.textModel,
      textEndpoint: values.textEndpoint,
      imageModel: values.imageModel,
      imageEndpoint: values.imageEndpoint,
      imageAspectRatio: values.imageAspectRatio,
      imageResponseFormat: values.imageResponseFormat,
      imagePromptOptimizer: values.imagePromptOptimizer,
      temperature: values.temperature,
      maxCompletionTokens: values.maxCompletionTokens,
      textTimeoutMs: values.textTimeoutMs,
      imageTimeoutMs: values.imageTimeoutMs,
      isActive: values.isActive,
    })
    .returning();

  return toPublicPptAiConfig(fromRow(row));
}
