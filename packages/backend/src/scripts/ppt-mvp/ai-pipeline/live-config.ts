import { and, desc, eq } from "drizzle-orm";

import { models, providers } from "../../../db/schema";

export type LiveClaudeModelRow = {
  modelId: string;
  displayName: string;
  providerName: string;
  providerType: "openai_compatible" | "opencode" | "claude_agent_sdk" | "ollama";
  baseUrl: string;
  apiKey: string | null;
};

export type LiveClaudeConfigResult = {
  source: "env" | "db";
  modelId: string | null;
  displayName?: string;
  providerName?: string;
};

export function hasExplicitLiveClaudeEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.ANTHROPIC_BASE_URL && (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN));
}

export function pickLiveClaudeModel(
  rows: LiveClaudeModelRow[],
  preferredModelId?: string | null,
): LiveClaudeModelRow | null {
  const compatible = rows.filter(
    (row) => row.providerType === "claude_agent_sdk" && typeof row.apiKey === "string" && row.apiKey.length > 0,
  );

  if (preferredModelId) {
    return compatible.find((row) => row.modelId === preferredModelId) ?? null;
  }

  return compatible[0] ?? null;
}

export async function ensureLiveClaudeEnvFromDb(opts: {
  preferredModelId?: string | null;
} = {}): Promise<LiveClaudeConfigResult> {
  if (hasExplicitLiveClaudeEnv()) {
    if (opts.preferredModelId) {
      process.env.ANTHROPIC_MODEL = opts.preferredModelId;
    }
    return {
      source: "env",
      modelId: process.env.ANTHROPIC_MODEL ?? null,
    };
  }

  const { db } = await import("../../../db");
  const rows = await db
    .select({
      modelId: models.modelId,
      displayName: models.displayName,
      providerName: providers.name,
      providerType: providers.type,
      baseUrl: providers.baseUrl,
      apiKey: providers.apiKey,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(
      and(
        eq(models.isActive, true),
        eq(models.isProviderDisabled, false),
        eq(providers.isActive, true),
        eq(providers.deploymentType, "cloud"),
      ),
    )
    .orderBy(desc(models.createdAt));

  const selected = pickLiveClaudeModel(rows, opts.preferredModelId);
  if (!selected) {
    const available = rows
      .filter((row) => row.providerType === "claude_agent_sdk")
      .map((row) => row.modelId);
    const preferredMsg = opts.preferredModelId ? ` for model "${opts.preferredModelId}"` : "";
    throw new Error(
      `No active claude_agent_sdk cloud model found${preferredMsg}. ` +
        `Available compatible modelIds: ${available.join(", ") || "(none)"}`,
    );
  }

  process.env.ANTHROPIC_BASE_URL = selected.baseUrl;
  process.env.ANTHROPIC_API_KEY = selected.apiKey!;
  process.env.ANTHROPIC_MODEL = opts.preferredModelId ?? process.env.ANTHROPIC_MODEL ?? selected.modelId;

  return {
    source: "db",
    modelId: process.env.ANTHROPIC_MODEL ?? selected.modelId,
    displayName: selected.displayName,
    providerName: selected.providerName,
  };
}
