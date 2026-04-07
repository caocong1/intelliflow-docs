import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { desensitizeMappings, models, nodeExecutions, providers } from "../../db/schema";
import type { DesensitizeRuleDesc, DesensitizeReviewSummaryItem, DetectedSensitiveItem, NodeExecution } from "@intelliflow/shared";

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Detect sensitive info in text using a local model API or regex fallback.
 */
/** System-defined placeholder format: [TYPE_N] */
const PLACEHOLDER_FORMAT = "[{TYPE}_{N}]";

export async function detectSensitiveInfo(
  text: string,
  localModelId: string | null,
  categories: Array<{ name: string; description: string }>,
): Promise<DetectedSensitiveItem[]> {
  const categoryNames = categories.map((c) => c.name);
  let rawItems: Array<{ original: string; type: string; description: string }>;

  if (localModelId) {
    rawItems = await detectViaModel(text, localModelId, categoryNames);
  } else {
    rawItems = detectViaRegex(text, categoryNames);
  }

  // Generate placeholders with incrementing counters per type
  const counters = new Map<string, number>();
  const results: DetectedSensitiveItem[] = [];

  for (const item of rawItems) {
    const count = (counters.get(item.type) ?? 0) + 1;
    counters.set(item.type, count);

    // System-defined placeholder format: [TYPE_N]
    const placeholder = PLACEHOLDER_FORMAT
      .replace("{TYPE}", item.type.toUpperCase())
      .replace("{N}", String(count));

    // Find position in text
    const startIndex = text.indexOf(item.original);
    const endIndex = startIndex >= 0 ? startIndex + item.original.length : -1;

    results.push({
      original: item.original,
      placeholder,
      sensitiveType: item.type,
      description: item.description,
      startIndex,
      endIndex,
    });
  }

  return results;
}

async function detectViaModel(
  text: string,
  localModelId: string,
  categoryNames: string[],
): Promise<Array<{ original: string; type: string; description: string }>> {
  // Look up model + provider
  const rows = await db
    .select({
      modelId: models.modelId,
      baseUrl: providers.baseUrl,
      apiKey: providers.apiKey,
      providerType: providers.type,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.id, localModelId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Model not found for desensitization detection");
  }

  const { modelId, baseUrl, apiKey, providerType } = rows[0];
  const isOllama = providerType === "ollama";

  const hasV1 = baseUrl.endsWith("/v1") || baseUrl.includes("/v1/");
  const url = isOllama && !hasV1
    ? `${baseUrl}/v1/chat/completions`
    : `${baseUrl}/chat/completions`;
  console.log(`[desensitize] Starting model detection: model=${modelId}, url=${url}, textLength=${text.length}, categories=${categoryNames.join(",")}`);
  const t0 = Date.now();

  const typesDesc = categoryNames.join(", ");
  const systemPrompt = `你是一个敏感信息检测工具。请分析以下文本，识别其中属于以下类型的敏感信息：${typesDesc}。

返回一个JSON数组，每个元素包含：
- "original": 原始文本中的敏感信息
- "type": 敏感信息类型（使用英文小写下划线格式，如 person_name, phone_number）
- "description": 对该敏感信息的简短中文描述（如"人名"、"手机号"）

只返回JSON数组，不要包含其他文本。如果没有发现敏感信息，返回空数组 []。`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isOllama && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(600000),
  });

  const fetchMs = Date.now() - t0;

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[desensitize] Model API failed in ${fetchMs}ms: HTTP ${response.status}`);
    throw new Error(`Model API error: HTTP ${response.status} - ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const totalMs = Date.now() - t0;
  const content = data.choices?.[0]?.message?.content ?? "[]";

  // Parse JSON from model response (may have markdown code fences)
  const jsonStr = content.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr) as Array<{ original: string; type: string; description: string }>;
    const items = Array.isArray(parsed) ? parsed : [];
    console.log(`[desensitize] Model detection completed in ${totalMs}ms: found ${items.length} items`);
    return items;
  } catch {
    console.warn(`[desensitize] Model returned unparseable JSON in ${totalMs}ms: ${content.slice(0, 100)}`);
    return [];
  }
}

function detectViaRegex(
  text: string,
  categoryNames: string[],
): Array<{ original: string; type: string; description: string }> {
  const results: Array<{ original: string; type: string; description: string }> = [];
  const seen = new Set<string>();

  const patterns: Record<string, { regex: RegExp; description: string }> = {
    phone_number: {
      regex: /1[3-9]\d{9}/g,
      description: "手机号",
    },
    email: {
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      description: "电子邮箱",
    },
    id_number: {
      regex: /\d{17}[\dXx]|\d{15}/g,
      description: "身份证号",
    },
    bank_card: {
      regex: /\d{16,19}/g,
      description: "银行卡号",
    },
  };

  // Only apply patterns for requested rule types, or all if empty
  const typesToCheck = categoryNames.length > 0 ? categoryNames : Object.keys(patterns);

  for (const ruleType of typesToCheck) {
    const pattern = patterns[ruleType];
    if (!pattern) continue;

    let match: RegExpExecArray | null;
    // Reset lastIndex for global regex
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      if (!seen.has(match[0])) {
        seen.add(match[0]);
        results.push({
          original: match[0],
          type: ruleType,
          description: pattern.description,
        });
      }
    }
  }

  return results;
}

// ─── Confirm & Store ────────────────────────────────────────────────────────

/**
 * Validate confirm inputs and build detectedItems for outputData.
 * Pure function — extracted for testability.
 */
export function validateAndBuildDetectedItems(
  items: Array<{ original: string; placeholder: string; sensitiveType: string }>,
  reviewSummary?: DesensitizeReviewSummaryItem[],
): DesensitizeReviewSummaryItem[] {
  const itemPlaceholders = items.map((it) => it.placeholder);
  if (new Set(itemPlaceholders).size !== itemPlaceholders.length) {
    throw new Error("Duplicate placeholders in confirmed items");
  }

  if (reviewSummary) {
    const summaryPlaceholders = reviewSummary.map((s) => s.placeholder);
    if (new Set(summaryPlaceholders).size !== summaryPlaceholders.length) {
      throw new Error("Duplicate placeholders in reviewSummary");
    }
    const checkedSet = new Set(reviewSummary.filter((s) => s.checked).map((s) => s.placeholder));
    const itemsSet = new Set(itemPlaceholders);
    for (const p of itemsSet) {
      if (!checkedSet.has(p)) throw new Error(`Confirmed item ${p} not marked as checked in reviewSummary`);
    }
    for (const p of checkedSet) {
      if (!itemsSet.has(p)) throw new Error(`Summary checked item ${p} has no corresponding confirmed item`);
    }
  }

  return reviewSummary ?? items.map((it) => ({
    placeholder: it.placeholder,
    sensitiveType: it.sensitiveType,
    checked: true,
  }));
}

/**
 * Store confirmed desensitization mappings and save sanitized text as output.
 */
export async function confirmDesensitization(
  documentId: string,
  nodeExecutionId: string,
  items: Array<{ original: string; placeholder: string; sensitiveType: string }>,
  sanitizedText: string,
  userId: string,
  reviewSummary?: DesensitizeReviewSummaryItem[],
): Promise<NodeExecution> {
  const now = new Date();

  const detectedItems = validateAndBuildDetectedItems(items, reviewSummary);

  // Insert confirmed items into desensitizeMappings table
  if (items.length > 0) {
    await db.insert(desensitizeMappings).values(
      items.map((item) => ({
        documentId,
        nodeExecutionId,
        placeholder: item.placeholder,
        originalValue: item.original,
        sensitiveType: item.sensitiveType,
      })),
    );
  }

  // Atomic write — fully replaces detect-phase temporary state
  const [updated] = await db
    .update(nodeExecutions)
    .set({
      outputData: { text: sanitizedText, mappingCount: items.length, detectedItems },
      updatedAt: now,
    })
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .returning();

  if (!updated) {
    throw new Error("Node execution not found");
  }

  return {
    id: updated.id,
    documentId: updated.documentId,
    nodeId: updated.nodeId,
    nodeLabel: updated.nodeLabel,
    nodeType: updated.nodeType as NodeExecution["nodeType"],
    status: updated.status,
    stepOrder: updated.stepOrder,
    executionRound: updated.executionRound,
    isCurrent: updated.isCurrent,
    inputData: updated.inputData as Record<string, unknown> | null,
    outputData: updated.outputData as Record<string, unknown> | null,
    selectedOutputKey: updated.selectedOutputKey,
    errorMessage: updated.errorMessage,
    startedAt: updated.startedAt?.toISOString() ?? null,
    completedAt: updated.completedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ─── Rule Injection ─────────────────────────────────────────────────────────

/**
 * Get sanitized desensitize rules for prompt injection.
 * Returns ONLY placeholder + type + description — NO original values.
 */
export async function getDesensitizeRules(
  documentId: string,
  nodeExecutionId: string,
): Promise<DesensitizeRuleDesc[]> {
  const mappings = await db
    .select({
      placeholder: desensitizeMappings.placeholder,
      sensitiveType: desensitizeMappings.sensitiveType,
    })
    .from(desensitizeMappings)
    .where(
      and(
        eq(desensitizeMappings.documentId, documentId),
        eq(desensitizeMappings.nodeExecutionId, nodeExecutionId),
      ),
    );

  // Build descriptions from type (no original values exposed)
  const typeDescriptions: Record<string, string> = {
    person_name: "人名（已脱敏）",
    phone_number: "手机号（已脱敏）",
    email: "电子邮箱（已脱敏）",
    id_number: "身份证号（已脱敏）",
    bank_card: "银行卡号（已脱敏）",
    company_name: "公司名称（已脱敏）",
    address: "地址（已脱敏）",
  };

  return mappings.map((m) => ({
    placeholder: m.placeholder,
    sensitiveType: m.sensitiveType,
    description: typeDescriptions[m.sensitiveType] ?? `${m.sensitiveType}（已脱敏）`,
  }));
}
