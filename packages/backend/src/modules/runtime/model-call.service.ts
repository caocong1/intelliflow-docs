import { asc, eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import { desensitizeMappings, modelCallLogs, models, nodeExecutions, providers, documents, workflows } from "../../db/schema";
import type { DesensitizeRuleDesc, ModelOutput, NodeExecution, SSEEvent, WorkflowNodeDef } from "@intelliflow/shared";
import { getStrategy } from "./strategies";
import type { ModelCallInput } from "./strategies";

// ─── Prompt Resolution ──────────────────────────────────────────────────────

/** Result of resolving a prompt template */
export interface ResolvedPromptResult {
  resolved: string;
  mapping: Record<string, string>;
}

/**
 * Resolve a prompt template by replacing {{nodeId.outputId}} with upstream output data
 * and appending desensitize rules if present.
 */
export async function resolvePromptTemplate(
  template: string,
  documentId: string,
  nodeExecs: Array<{ nodeId: string; nodeLabel: string; outputData: Record<string, unknown> | null }>,
  desensitizeRules: DesensitizeRuleDesc[],
): Promise<ResolvedPromptResult> {
  let resolved = template;
  const mapping: Record<string, string> = {};

  // Replace {{nodeId.outputId}} with upstream node output values
  resolved = resolved.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
    const dotIndex = varName.indexOf(".");
    if (dotIndex < 0) return _match;

    const nodeId = varName.slice(0, dotIndex).trim();
    const outputId = varName.slice(dotIndex + 1).trim();

    // Find matching node execution by nodeId
    const exec = nodeExecs.find((ne) => ne.nodeId === nodeId);
    if (!exec?.outputData) return _match;

    // Extract value from outputData — check direct key first, then nested fields
    const od = exec.outputData as Record<string, unknown>;
    let value = od[outputId];
    if (value === undefined || value === null) {
      // Try inside "fields" object (input_transform stores form data under fields.{fieldId})
      const fields = od.fields as Record<string, unknown> | undefined;
      if (fields) {
        // outputId may be like "n1-field-f1", extract the field key after last "-"
        const fieldKey = outputId.replace(/^.*-field-/, "");
        value = fields[fieldKey] ?? fields[outputId];
      }
    }
    if (value === undefined || value === null) return _match;
    const resolvedValue = typeof value === "string" ? value : JSON.stringify(value);
    mapping[`{{${varName}}}`] = resolvedValue;
    return resolvedValue;
  });

  // Append desensitize rule descriptions if present
  if (desensitizeRules.length > 0) {
    const rulesText = desensitizeRules
      .map((r) => `- ${r.placeholder}: ${r.description}`)
      .join("\n");
    resolved += `\n\n注意：以下文本中包含已脱敏的占位符，请保留这些占位符不要修改：\n${rulesText}`;
  }

  return { resolved, mapping };
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
  variableMapping?: Record<string, string>,
  userId?: string,
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
          finalModels[r.modelId] = {
            modelId: r.modelId,
            modelDisplayName: requestedModels.find((m) => m.id === r.modelId)?.displayName ?? "",
            content: r.content,
            status: r.status,
            errorMessage: "errorMessage" in r ? r.errorMessage : undefined,
          };
        }
      }

      await db
        .update(nodeExecutions)
        .set({
          outputData: { models: finalModels },
          updatedAt: new Date(),
        })
        .where(eq(nodeExecutions.id, nodeExecutionId));

      controller.close();
    },
  });
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
