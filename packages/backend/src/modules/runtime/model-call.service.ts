import { asc, eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import { desensitizeMappings, modelCallLogs, models, nodeExecutions, providers, documents, workflows } from "../../db/schema";
import type { DesensitizeRuleDesc, ModelCallConfig, ModelOutput, NamedOutputDef, NodeExecution, SSEEvent, WorkflowNodeDef } from "@intelliflow/shared";
import { getStrategy } from "./strategies";
import type { ModelCallInput } from "./strategies";
import Ajv from "ajv";

// ─── Prompt Resolution ──────────────────────────────────────────────────────

/** Result of resolving a prompt template */
export interface ResolvedPromptResult {
  resolved: string;
  mapping: Record<string, string>;
}

/**
 * Resolve a deep field path on a parsed JSON value.
 * Supports dot-separated keys, bracket[N] numeric indices, and [*] array traversal.
 * Examples: "items[0].name", "clauses[*].title", "nested.deep.key"
 */
export function resolveFieldPath(obj: unknown, fieldPath: string): string | undefined {
  // Parse fieldPath into segments: "items[0].name" -> ["items", 0, "name"], "a[*].b" -> ["a", "*", "b"]
  const segments: Array<string | number> = [];
  const tokenRegex = /([^.\[\]]+)|\[(\d+)\]|\[\*\]/g;
  let match: RegExpExecArray | null;
  match = tokenRegex.exec(fieldPath);
  while (match !== null) {
    if (match[1] !== undefined) {
      segments.push(match[1]);
    } else if (match[2] !== undefined) {
      segments.push(Number(match[2]));
    } else {
      segments.push("*");
    }
    match = tokenRegex.exec(fieldPath);
  }

  function resolve(current: unknown, segIdx: number): unknown {
    if (current === undefined || current === null || segIdx >= segments.length) {
      return current;
    }

    const seg = segments[segIdx];

    if (seg === "*") {
      if (!Array.isArray(current)) return undefined;
      const results = current.map((item) => resolve(item, segIdx + 1));
      return results;
    }

    if (typeof seg === "number") {
      if (!Array.isArray(current)) return undefined;
      return resolve(current[seg], segIdx + 1);
    }

    if (typeof current === "object" && current !== null) {
      return resolve((current as Record<string, unknown>)[seg], segIdx + 1);
    }

    return undefined;
  }

  const result = resolve(obj, 0);
  if (result === undefined || result === null) return undefined;
  if (typeof result === "string") return result;
  return JSON.stringify(result);
}

/**
 * Resolve a single variable reference against upstream node outputs.
 * Uses a 6-level priority chain for segmentKey-based lookup:
 * 1. fieldsByKey[segmentKey] — machineKey lookup
 * 2. fields[segmentKey] — UUID fallback
 * 3. fileSlots[segmentKey] — file slot (.text)
 * 4. namedOutputs[segmentKey] — named outputs (.content, Phase 24 stub)
 * 5. models[segmentKey] — model output (.content)
 * 6. od[segmentKey] — direct property (text, confirmedAt, etc.)
 */
export function resolveRef(
  ref: { nodeId: string; outputId: string; fieldPath?: string },
  nodeExecs: Array<{ nodeId: string; outputData: Record<string, unknown> | null }>,
): string | undefined {
  const exec = nodeExecs.find((ne) => ne.nodeId === ref.nodeId);
  if (!exec?.outputData) return undefined;

  const od = exec.outputData as Record<string, unknown>;
  const segmentKey = ref.outputId;

  // 1. fieldsByKey (machineKey lookup)
  const fieldsByKey = od.fieldsByKey as Record<string, unknown> | undefined;
  if (fieldsByKey?.[segmentKey] !== undefined && fieldsByKey[segmentKey] !== null) {
    const v = fieldsByKey[segmentKey];
    return typeof v === "string" ? v : JSON.stringify(v);
  }

  // 2. fields (UUID fallback)
  const fields = od.fields as Record<string, unknown> | undefined;
  if (fields?.[segmentKey] !== undefined && fields[segmentKey] !== null) {
    const v = fields[segmentKey];
    return typeof v === "string" ? v : JSON.stringify(v);
  }

  // 3. fileSlots (file slot — returns .text)
  const fileSlots = od.fileSlots as Record<string, { text?: string }> | undefined;
  if (fileSlots?.[segmentKey]) {
    return fileSlots[segmentKey].text;
  }

  // 4. namedOutputs (returns .content, supports fieldPath for JSON access)
  const namedOutputs = od.namedOutputs as Record<string, { content?: string }> | undefined;
  if (namedOutputs?.[segmentKey]) {
    const baseContent = namedOutputs[segmentKey].content;
    if (ref.fieldPath && baseContent) {
      try {
        const parsed = JSON.parse(baseContent);
        return resolveFieldPath(parsed, ref.fieldPath);
      } catch {
        console.warn(`resolveRef: failed to parse namedOutput "${segmentKey}" as JSON for fieldPath "${ref.fieldPath}"`);
        return undefined;
      }
    }
    return baseContent;
  }

  // 5. models (model output — returns .content, supports fieldPath for JSON access)
  const modelsMap = od.models as Record<string, { content?: string }> | undefined;
  if (modelsMap?.[segmentKey]) {
    const baseContent = modelsMap[segmentKey].content;
    if (ref.fieldPath && baseContent) {
      try {
        const parsed = JSON.parse(baseContent);
        return resolveFieldPath(parsed, ref.fieldPath);
      } catch {
        console.warn(`resolveRef: failed to parse model output "${segmentKey}" as JSON for fieldPath "${ref.fieldPath}"`);
        return undefined;
      }
    }
    return baseContent;
  }

  // 6. Direct property (text, confirmedAt, selectedContent, etc.)
  if (od[segmentKey] !== undefined && od[segmentKey] !== null) {
    const v = od[segmentKey];
    const baseValue = typeof v === "string" ? v : JSON.stringify(v);
    if (ref.fieldPath) {
      try {
        const parsed = JSON.parse(baseValue);
        return resolveFieldPath(parsed, ref.fieldPath);
      } catch {
        console.warn(`resolveRef: failed to parse property "${segmentKey}" as JSON for fieldPath "${ref.fieldPath}"`);
        return undefined;
      }
    }
    return baseValue;
  }

  return undefined;
}

/**
 * Resolve a prompt template by replacing {{nodeId.segmentKey}} with upstream output data
 * and appending desensitize rules if present.
 * Delegates variable lookup to resolveRef() for each match.
 */
export async function resolvePromptTemplate(
  template: string,
  documentId: string,
  nodeExecs: Array<{ nodeId: string; nodeLabel: string; outputData: Record<string, unknown> | null }>,
  desensitizeRules: DesensitizeRuleDesc[],
  config?: ModelCallConfig,
): Promise<ResolvedPromptResult> {
  let resolved = template;
  const mapping: Record<string, string> = {};

  // Replace {{nodeId.segmentKey}} or {{nodeId.segmentKey.field.path}} with upstream node output values
  resolved = resolved.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
    const dotIndex = varName.indexOf(".");
    if (dotIndex < 0) return _match;

    const nodeId = varName.slice(0, dotIndex).trim();
    const rest = varName.slice(dotIndex + 1).trim();

    // Parse segmentKey and optional fieldPath
    // segmentKey is the first segment, remaining segments form fieldPath
    // But segmentKey could contain bracket notation like "items[0]", so we split on first plain dot
    const secondDotIndex = rest.indexOf(".");
    let segmentKey: string;
    let fieldPath: string | undefined;

    if (secondDotIndex >= 0) {
      // Check if there's a fieldPath portion after segmentKey
      segmentKey = rest.slice(0, secondDotIndex);
      fieldPath = rest.slice(secondDotIndex + 1);
    } else {
      segmentKey = rest;
      fieldPath = undefined;
    }

    const value = resolveRef({ nodeId, outputId: segmentKey, fieldPath }, nodeExecs);
    if (value === undefined) return _match;

    mapping[`{{${varName}}}`] = value;
    return value;
  });

  // Append desensitize rule descriptions if present
  if (desensitizeRules.length > 0) {
    const rulesText = desensitizeRules
      .map((r) => `- ${r.placeholder}: ${r.description}`)
      .join("\n");
    resolved += `\n\n注意：以下文本中包含已脱敏的占位符，请保留这些占位符不要修改：\n${rulesText}`;
  }

  // Inject JSON Schema instruction when configured
  if (config?.jsonSchema) {
    resolved += `\n\n请严格按照以下 JSON Schema 格式输出：\n\`\`\`json\n${JSON.stringify(config.jsonSchema, null, 2)}\n\`\`\``;
  }

  // Inject named output delimiter format when configured
  if (config?.namedOutputs?.length) {
    const format = config.namedOutputs
      .map((o) => `===OUTPUT:${o.id}===\n[${o.name}内容]\n===END:${o.id}===`)
      .join("\n\n");
    resolved += `\n\n请按以下格式分段输出，每个产物用指定分隔符包裹：\n${format}`;
  }

  return { resolved, mapping };
}

// ─── JSON Validation & Named Output Parsing ─────────────────────────────────

/**
 * Validate model output content against format and optional JSON Schema.
 * Layer 1: JSON.parse syntax check
 * Layer 2: ajv schema validation (if jsonSchema provided)
 */
export function validateModelOutput(
  content: string,
  config: ModelCallConfig,
): { status: "completed" | "format_error"; errors?: string[] } {
  if (config.outputFormat !== "json") {
    return { status: "completed" };
  }

  // Layer 1: JSON syntax check
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "format_error", errors: [`JSON 语法错误: ${message}`] };
  }

  // Layer 2: JSON Schema validation
  if (config.jsonSchema) {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(config.jsonSchema);
    const valid = validate(parsed);
    if (!valid && validate.errors) {
      const schemaErrors = validate.errors.map(
        (e) => `${e.instancePath || "/"}: ${e.message ?? "unknown error"}`,
      );
      return { status: "format_error", errors: schemaErrors };
    }
  }

  return { status: "completed" };
}

/**
 * Parse named output delimiters from raw model content.
 * Expected format: ===OUTPUT:id===\n...content...\n===END:id===
 * Falls back to storing entire content as _default when delimiters not found.
 */
export function parseNamedOutputs(
  rawContent: string,
  expectedDefs: NamedOutputDef[],
): {
  namedOutputs: Record<string, { content: string; format: string }>;
  fallback: boolean;
} {
  const expectedIds = expectedDefs.map((d) => d.id);
  const formatMap = new Map(expectedDefs.map((d) => [d.id, d.format]));
  const result: Record<string, { content: string; format: string }> = {};

  const regex = /===OUTPUT:(\w+)===\n?([\s\S]*?)===END:\1===/g;
  let match: RegExpExecArray | null;
  match = regex.exec(rawContent);
  while (match !== null) {
    const id = match[1];
    const content = match[2].trim();
    result[id] = {
      content,
      format: formatMap.get(id) ?? "text",
    };
    match = regex.exec(rawContent);
  }

  // Check if all expected IDs were found
  const allFound = expectedIds.every((id) => id in result);
  if (allFound) {
    return { namedOutputs: result, fallback: false };
  }

  // Fallback: store entire content as _default
  return {
    namedOutputs: { _default: { content: rawContent, format: "text" } },
    fallback: true,
  };
}

// ─── Model Execution ────────────────────────────────────────────────────────

/**
 * Execute model calls for one or more models in parallel, returning a multiplexed SSE ReadableStream.
 */
export async function executeModelCall(
  documentId: string,
  nodeExecutionId: string,
  modelIds: string[],
  resolvedPrompt: string,
  promptTemplate?: string,
  systemPromptTemplate?: string,
  resolvedSystemPrompt?: string,
  variableMapping?: Record<string, string>,
  userId?: string,
  config?: ModelCallConfig,
): Promise<ReadableStream<Uint8Array>> {
  // Look up all models + providers
  const modelRows = await db
    .select({
      id: models.id,
      modelId: models.modelId,
      displayName: models.displayName,
      temperature: models.temperature,
      maxTokens: models.maxTokens,
      topP: models.topP,
      baseUrl: providers.baseUrl,
      apiKey: providers.apiKey,
      providerType: providers.type,
      providerId: providers.id,
      providerName: providers.name,
      agentMode: models.agentMode,
      agentMaxTurns: models.agentMaxTurns,
      agentMaxBudgetUsd: models.agentMaxBudgetUsd,
      agentAllowedTools: models.agentAllowedTools,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(inArray(models.id, modelIds));

  // Filter to only requested model IDs
  const requestedModels = modelRows.filter((m) => modelIds.includes(m.id));

  if (requestedModels.length === 0) {
    throw new Error("No models found for the given IDs");
  }

  // Initialize outputData with pending status for each model
  const initialModels: Record<string, ModelOutput> = {};
  for (const m of requestedModels) {
    initialModels[m.id] = {
      modelId: m.id,
      modelDisplayName: m.displayName,
      content: "",
      status: "pending",
    };
  }

  await db
    .update(nodeExecutions)
    .set({
      outputData: { models: initialModels },
      updatedAt: new Date(),
    })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  // Create multiplexed SSE stream
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      function sendEvent(event: SSEEvent) {
        const line = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(line));
        } catch {
          // Stream may be closed
        }
      }

      // Run all models in parallel
      const results = await Promise.allSettled(
        requestedModels.map(async (model) => {
          const startTime = Date.now();
          // Send status event
          sendEvent({
            type: "status",
            modelId: model.id,
            data: "streaming",
            timestamp: new Date().toISOString(),
          });

          let fullContent = "";

          try {
            const strategy = getStrategy(model.providerType);
            const strategyInput: ModelCallInput = {
              ...model,
              providerType: model.providerType,
            };
            const result = await strategy.execute({
              model: strategyInput,
              resolvedPrompt,
              resolvedSystemPrompt,
              sendEvent,
            });
            fullContent = result.content;

            if (result.status === "failed") {
              throw new Error(result.errorMessage ?? "Model call failed");
            }

            // Send complete event
            sendEvent({
              type: "complete",
              modelId: model.id,
              data: fullContent,
              timestamp: new Date().toISOString(),
            });

            // Log model call
            await db.insert(modelCallLogs).values({
              documentId,
              nodeExecutionId,
              userId: userId ?? null,
              providerId: model.providerId,
              providerName: model.providerName,
              modelId: model.id,
              modelName: model.displayName,
              callSource: "runtime",
              promptTemplate: promptTemplate ?? null,
              systemPrompt: resolvedSystemPrompt ?? null,
              resolvedPrompt,
              variableMapping: variableMapping ?? null,
              temperature: model.temperature,
              maxTokens: model.maxTokens,
              responseStatus: "completed",
              responseContent: fullContent,
              contentLength: fullContent.length,
              tokenUsage: null,
              duration: Date.now() - startTime,
              errorMessage: null,
            });

            return { modelId: model.id, content: fullContent, status: "completed" as const };
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            sendEvent({
              type: "error",
              modelId: model.id,
              data: errorMessage,
              timestamp: new Date().toISOString(),
            });

            // Log failed model call
            await db.insert(modelCallLogs).values({
              documentId,
              nodeExecutionId,
              userId: userId ?? null,
              providerId: model.providerId,
              providerName: model.providerName,
              modelId: model.id,
              modelName: model.displayName,
              callSource: "runtime",
              promptTemplate: promptTemplate ?? null,
              systemPrompt: resolvedSystemPrompt ?? null,
              resolvedPrompt,
              variableMapping: variableMapping ?? null,
              temperature: model.temperature,
              maxTokens: model.maxTokens,
              responseStatus: "failed",
              responseContent: fullContent || null,
              contentLength: fullContent.length || null,
              tokenUsage: null,
              duration: Date.now() - startTime,
              errorMessage,
            });

            return { modelId: model.id, content: fullContent, status: "failed" as const, errorMessage };
          }
        }),
      );

      // Update nodeExecution.outputData with final results
      const finalModels: Record<string, ModelOutput> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          const r = result.value;
          let modelStatus: ModelOutput["status"] = r.status;
          let formatErrors: string[] | undefined;

          // Validate JSON output if configured
          if (r.status === "completed" && config?.outputFormat === "json") {
            const validation = validateModelOutput(r.content, config);
            if (validation.status === "format_error") {
              modelStatus = "format_error";
              formatErrors = validation.errors;
            }
          }

          finalModels[r.modelId] = {
            modelId: r.modelId,
            modelDisplayName: requestedModels.find((m) => m.id === r.modelId)?.displayName ?? "",
            content: r.content,
            status: modelStatus,
            errorMessage: "errorMessage" in r ? r.errorMessage : undefined,
            formatErrors,
          };
        }
      }

      // Parse named outputs if configured
      const outputDataPayload: Record<string, unknown> = { models: finalModels };
      if (config?.namedOutputs?.length) {
        // Use the first completed model's content for named output parsing
        const firstCompleted = Object.values(finalModels).find((m) => m.status === "completed" || m.status === "format_error");
        if (firstCompleted) {
          const parsed = parseNamedOutputs(firstCompleted.content, config.namedOutputs);
          outputDataPayload.namedOutputs = parsed.namedOutputs;
          if (parsed.fallback) {
            outputDataPayload.fallbackWarning = true;
          }
        }
      }

      await db
        .update(nodeExecutions)
        .set({
          outputData: outputDataPayload,
          updatedAt: new Date(),
        })
        .where(eq(nodeExecutions.id, nodeExecutionId));

      controller.close();
    },
  });
}

// ─── Background (non-streaming) Model Execution ─────────────────────────────

/**
 * Execute model calls for background pipeline — collects full response without SSE streaming.
 * Writes results to nodeExecutions.outputData and auto-selects the first model output.
 */
export async function executeModelCallBackground(
  documentId: string,
  nodeExecutionId: string,
  userId: string,
): Promise<void> {
  // Load node config to get model IDs and prompt
  const config = await getModelCallConfig(nodeExecutionId);
  if (!config || config.type !== "model_call") {
    throw new Error("Model call config not found for node execution");
  }

  const mcConfig = config as import("@intelliflow/shared").ModelCallConfig;
  const modelIds = mcConfig.modelIds.length > 0
    ? mcConfig.modelIds
    : mcConfig.modelId ? [mcConfig.modelId] : [];

  if (modelIds.length === 0) {
    throw new Error("No models configured for model_call node");
  }

  // Resolve prompt
  const allExecs = await getUpstreamNodeExecutions(documentId);
  const desensitizeRules = await getUpstreamDesensitizeRules(documentId);
  const { resolved: resolvedPrompt, mapping: variableMapping } = await resolvePromptTemplate(
    mcConfig.promptTemplate,
    documentId,
    allExecs.map((e) => ({
      nodeId: e.nodeId,
      nodeLabel: e.nodeLabel,
      outputData: e.outputData as Record<string, unknown> | null,
    })),
    desensitizeRules,
    mcConfig,
  );

  // Resolve system prompt (no desensitize rules per user decision)
  let resolvedSystemPrompt: string | undefined;
  if (mcConfig.systemPromptTemplate) {
    const { resolved } = await resolvePromptTemplate(
      mcConfig.systemPromptTemplate,
      documentId,
      allExecs.map((e) => ({
        nodeId: e.nodeId,
        nodeLabel: e.nodeLabel,
        outputData: e.outputData as Record<string, unknown> | null,
      })),
      [],  // No desensitize rules — system prompt stays clean
    );
    resolvedSystemPrompt = resolved;
  }

  // Look up all models + providers
  const modelRows = await db
    .select({
      id: models.id,
      modelId: models.modelId,
      displayName: models.displayName,
      temperature: models.temperature,
      maxTokens: models.maxTokens,
      topP: models.topP,
      baseUrl: providers.baseUrl,
      apiKey: providers.apiKey,
      providerType: providers.type,
      providerId: providers.id,
      providerName: providers.name,
      agentMode: models.agentMode,
      agentMaxTurns: models.agentMaxTurns,
      agentMaxBudgetUsd: models.agentMaxBudgetUsd,
      agentAllowedTools: models.agentAllowedTools,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(inArray(models.id, modelIds));

  if (modelRows.length === 0) {
    throw new Error("No models found for the given IDs");
  }

  // Execute all models in parallel, collect full responses (no SSE)
  const results = await Promise.allSettled(
    modelRows.map(async (model) => {
      const startTime = Date.now();
      let fullContent = "";

      try {
        const strategy = getStrategy(model.providerType);
        const strategyInput: ModelCallInput = {
          ...model,
          providerType: model.providerType,
        };

        // Use a no-op sendEvent since we don't need SSE in background mode
        const noopSendEvent = () => {};
        const result = await strategy.execute({
          model: strategyInput,
          resolvedPrompt,
          resolvedSystemPrompt,
          sendEvent: noopSendEvent,
        });
        fullContent = result.content;

        if (result.status === "failed") {
          throw new Error(result.errorMessage ?? "Model call failed");
        }

        // Log successful call
        await db.insert(modelCallLogs).values({
          documentId,
          nodeExecutionId,
          userId,
          providerId: model.providerId,
          providerName: model.providerName,
          modelId: model.id,
          modelName: model.displayName,
          callSource: "runtime",
          promptTemplate: mcConfig.promptTemplate,
          systemPrompt: resolvedSystemPrompt ?? null,
          resolvedPrompt,
          variableMapping: variableMapping ?? null,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          responseStatus: "completed",
          responseContent: fullContent,
          contentLength: fullContent.length,
          tokenUsage: null,
          duration: Date.now() - startTime,
          errorMessage: null,
        });

        return {
          modelId: model.id,
          displayName: model.displayName,
          content: fullContent,
          status: "completed" as const,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Log failed call
        await db.insert(modelCallLogs).values({
          documentId,
          nodeExecutionId,
          userId,
          providerId: model.providerId,
          providerName: model.providerName,
          modelId: model.id,
          modelName: model.displayName,
          callSource: "runtime",
          promptTemplate: mcConfig.promptTemplate,
          systemPrompt: resolvedSystemPrompt ?? null,
          resolvedPrompt,
          variableMapping: variableMapping ?? null,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          responseStatus: "failed",
          responseContent: fullContent || null,
          contentLength: fullContent.length || null,
          tokenUsage: null,
          duration: Date.now() - startTime,
          errorMessage,
        });

        return {
          modelId: model.id,
          displayName: model.displayName,
          content: fullContent,
          status: "failed" as const,
          errorMessage,
        };
      }
    }),
  );

  // Build final output data
  const finalModels: Record<string, ModelOutput> = {};
  let firstCompletedModelId: string | null = null;

  for (const result of results) {
    if (result.status === "fulfilled") {
      const r = result.value;
      let modelStatus: ModelOutput["status"] = r.status;
      let formatErrors: string[] | undefined;

      // Validate JSON output if configured
      if (r.status === "completed" && mcConfig.outputFormat === "json") {
        const validation = validateModelOutput(r.content, mcConfig);
        if (validation.status === "format_error") {
          modelStatus = "format_error";
          formatErrors = validation.errors;
        }
      }

      finalModels[r.modelId] = {
        modelId: r.modelId,
        modelDisplayName: r.displayName,
        content: r.content,
        status: modelStatus,
        errorMessage: "errorMessage" in r ? r.errorMessage : undefined,
        formatErrors,
      };

      if ((modelStatus === "completed" || modelStatus === "format_error") && !firstCompletedModelId) {
        firstCompletedModelId = r.modelId;
      }
    }
  }

  // Check if at least one model succeeded
  if (!firstCompletedModelId) {
    // All models failed — collect error messages
    const errors = results
      .map((r) => r.status === "fulfilled" && r.value.status === "failed" ? r.value.errorMessage : null)
      .filter(Boolean)
      .join("; ");
    throw new Error(`All model calls failed: ${errors}`);
  }

  // Auto-select first completed model output
  const selectedContent = finalModels[firstCompletedModelId]?.content ?? "";

  // Parse named outputs if configured
  const bgOutputData: Record<string, unknown> = {
    models: finalModels,
    selectedContent,
    text: selectedContent,
  };
  if (mcConfig.namedOutputs?.length) {
    const parsed = parseNamedOutputs(selectedContent, mcConfig.namedOutputs);
    bgOutputData.namedOutputs = parsed.namedOutputs;
    if (parsed.fallback) {
      bgOutputData.fallbackWarning = true;
    }
  }

  await db
    .update(nodeExecutions)
    .set({
      outputData: bgOutputData,
      selectedOutputKey: firstCompletedModelId,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(nodeExecutions.id, nodeExecutionId));
}

// ─── Retry ──────────────────────────────────────────────────────────────────

/**
 * Retry a single model, preserving other model outputs.
 */
export async function retryModelCall(
  documentId: string,
  nodeExecutionId: string,
  modelId: string,
  resolvedPrompt: string,
  promptTemplate?: string,
  systemPromptTemplate?: string,
  resolvedSystemPrompt?: string,
  variableMapping?: Record<string, string>,
  userId?: string,
): Promise<ReadableStream<Uint8Array>> {
  // Get current outputData to preserve other models
  const [exec] = await db
    .select({ outputData: nodeExecutions.outputData })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  const currentOutput = (exec?.outputData as Record<string, unknown>) ?? {};
  const currentModels = (currentOutput.models as Record<string, ModelOutput>) ?? {};

  // Look up model + provider
  const [model] = await db
    .select({
      id: models.id,
      modelId: models.modelId,
      displayName: models.displayName,
      temperature: models.temperature,
      maxTokens: models.maxTokens,
      topP: models.topP,
      baseUrl: providers.baseUrl,
      apiKey: providers.apiKey,
      providerType: providers.type,
      providerId: providers.id,
      providerName: providers.name,
      agentMode: models.agentMode,
      agentMaxTurns: models.agentMaxTurns,
      agentMaxBudgetUsd: models.agentMaxBudgetUsd,
      agentAllowedTools: models.agentAllowedTools,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.id, modelId))
    .limit(1);

  if (!model) throw new Error("Model not found");

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const startTime = Date.now();

      function sendEvent(event: SSEEvent) {
        const line = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(line));
        } catch {
          // Stream may be closed
        }
      }

      sendEvent({
        type: "status",
        modelId: model.id,
        data: "streaming",
        timestamp: new Date().toISOString(),
      });

      let fullContent = "";

      try {
        const strategy = getStrategy(model.providerType);
        const strategyInput: ModelCallInput = {
          ...model,
          providerType: model.providerType,
        };
        const result = await strategy.execute({
          model: strategyInput,
          resolvedPrompt,
          resolvedSystemPrompt,
          sendEvent,
        });
        fullContent = result.content;

        if (result.status === "failed") {
          throw new Error(result.errorMessage ?? "Model call failed");
        }

        sendEvent({
          type: "complete",
          modelId: model.id,
          data: fullContent,
          timestamp: new Date().toISOString(),
        });

        // Update only this model in outputData
        currentModels[model.id] = {
          modelId: model.id,
          modelDisplayName: model.displayName,
          content: fullContent,
          status: "completed",
        };

        // Log retry model call
        await db.insert(modelCallLogs).values({
          documentId,
          nodeExecutionId,
          userId: userId ?? null,
          providerId: model.providerId,
          providerName: model.providerName,
          modelId: model.id,
          modelName: model.displayName,
          callSource: "runtime",
          promptTemplate: promptTemplate ?? null,
          systemPrompt: resolvedSystemPrompt ?? null,
          resolvedPrompt,
          variableMapping: variableMapping ?? null,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          responseStatus: "completed",
          responseContent: fullContent,
          contentLength: fullContent.length,
          tokenUsage: null,
          duration: Date.now() - startTime,
          errorMessage: null,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        sendEvent({
          type: "error",
          modelId: model.id,
          data: errorMessage,
          timestamp: new Date().toISOString(),
        });

        currentModels[model.id] = {
          modelId: model.id,
          modelDisplayName: model.displayName,
          content: fullContent,
          status: "failed",
          errorMessage,
        };

        // Log failed retry model call
        await db.insert(modelCallLogs).values({
          documentId,
          nodeExecutionId,
          userId: userId ?? null,
          providerId: model.providerId,
          providerName: model.providerName,
          modelId: model.id,
          modelName: model.displayName,
          callSource: "runtime",
          promptTemplate: promptTemplate ?? null,
          systemPrompt: resolvedSystemPrompt ?? null,
          resolvedPrompt,
          variableMapping: variableMapping ?? null,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          responseStatus: "failed",
          responseContent: fullContent || null,
          contentLength: fullContent.length || null,
          tokenUsage: null,
          duration: Date.now() - startTime,
          errorMessage,
        });
      }

      await db
        .update(nodeExecutions)
        .set({
          outputData: { ...currentOutput, models: currentModels },
          updatedAt: new Date(),
        })
        .where(eq(nodeExecutions.id, nodeExecutionId));

      controller.close();
    },
  });
}

// ─── Output Selection ───────────────────────────────────────────────────────

/**
 * Select a model's output as the final output for this node.
 */
export async function selectModelOutput(
  documentId: string,
  nodeExecutionId: string,
  selectedModelId: string,
): Promise<void> {
  const [exec] = await db
    .select({ outputData: nodeExecutions.outputData })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) throw new Error("Node execution not found");

  const outputData = (exec.outputData as Record<string, unknown>) ?? {};
  const modelsMap = (outputData.models as Record<string, ModelOutput>) ?? {};
  const selected = modelsMap[selectedModelId];

  if (!selected) throw new Error("Selected model output not found");

  // Copy selected content to selectedContent + set selectedOutputKey
  await db
    .update(nodeExecutions)
    .set({
      selectedOutputKey: selectedModelId,
      outputData: {
        ...outputData,
        selectedContent: selected.content,
        text: selected.content,
      },
      updatedAt: new Date(),
    })
    .where(eq(nodeExecutions.id, nodeExecutionId));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the model call config for a node execution.
 */
export async function getModelCallConfig(nodeExecutionId: string) {
  const [exec] = await db
    .select({
      nodeId: nodeExecutions.nodeId,
      documentId: nodeExecutions.documentId,
    })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) return null;

  const [doc] = await db
    .select({ nodes: workflows.nodes })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, exec.documentId))
    .limit(1);

  if (!doc) return null;

  const nodes = doc.nodes as WorkflowNodeDef[];
  const nodeDef = nodes.find((n) => n.id === exec.nodeId);
  if (!nodeDef || nodeDef.config.type !== "model_call") return null;

  return nodeDef.config;
}

/**
 * Get all upstream node executions for a document (for prompt variable resolution).
 */
export async function getUpstreamNodeExecutions(documentId: string) {
  return db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId))
    .orderBy(asc(nodeExecutions.stepOrder));
}

/**
 * Get desensitize rules from any upstream desensitize node.
 */
export async function getUpstreamDesensitizeRules(
  documentId: string,
): Promise<DesensitizeRuleDesc[]> {
  // Find any completed desensitize node executions for this document
  const desensitizeExecs = await db
    .select({ id: nodeExecutions.id })
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.nodeType, "desensitize"),
      ),
    );

  if (desensitizeExecs.length === 0) return [];

  // Get all mappings for these executions
  const allRules: DesensitizeRuleDesc[] = [];
  const typeDescriptions: Record<string, string> = {
    person_name: "人名（已脱敏）",
    phone_number: "手机号（已脱敏）",
    email: "电子邮箱（已脱敏）",
    id_number: "身份证号（已脱敏）",
    bank_card: "银行卡号（已脱敏）",
    company_name: "公司名称（已脱敏）",
    address: "地址（已脱敏）",
  };

  for (const exec of desensitizeExecs) {
    const mappings = await db
      .select({
        placeholder: desensitizeMappings.placeholder,
        sensitiveType: desensitizeMappings.sensitiveType,
      })
      .from(desensitizeMappings)
      .where(
        and(
          eq(desensitizeMappings.documentId, documentId),
          eq(desensitizeMappings.nodeExecutionId, exec.id),
        ),
      );

    for (const m of mappings) {
      allRules.push({
        placeholder: m.placeholder,
        sensitiveType: m.sensitiveType,
        description: typeDescriptions[m.sensitiveType] ?? `${m.sensitiveType}（已脱敏）`,
      });
    }
  }

  return allRules;
}
