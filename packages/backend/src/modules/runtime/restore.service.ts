import type { RestorationItem, RestoreConfig, RestoreOutputData } from "@intelliflow/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { desensitizeMappings, nodeExecutions } from "../../db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

type RestoreInputSource = {
  displayName?: string;
  text?: string;
  desensitizedText?: string;
  restoredText?: string;
  content?: string;
};

interface RestoreSourceInput {
  outputId: string;
  displayName: string;
  text: string;
}

function getRestoreSourceText(source: RestoreInputSource): string {
  return source.text ?? source.desensitizedText ?? source.restoredText ?? source.content ?? "";
}

function collectRestoreInputSources(
  inputData: Record<string, unknown> | null,
): RestoreSourceInput[] {
  if (
    !inputData?.sources ||
    typeof inputData.sources !== "object" ||
    Array.isArray(inputData.sources)
  ) {
    return [];
  }

  const sources = inputData.sources as Record<string, unknown>;
  return Object.entries(sources).flatMap(([outputId, rawSource]) => {
    if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
      return [];
    }

    const source = rawSource as RestoreInputSource;
    const text = getRestoreSourceText(source);
    if (!text.trim()) return [];

    return [
      {
        outputId,
        displayName: source.displayName?.trim() || outputId,
        text,
      },
    ];
  });
}

function updateSourcesFromAggregate(
  sources: RestoreOutputData["sources"] | undefined,
  previousRestoredText: string,
  updatedText: string,
): RestoreOutputData["sources"] {
  if (!sources) return {};

  const entries = Object.entries(sources);
  if (entries.length === 0) return {};

  const previousParts = entries.map(([, source]) => source.restoredText);
  if (previousParts.join("\n\n") !== previousRestoredText) {
    return sources;
  }

  const updatedParts = updatedText.split("\n\n");
  if (updatedParts.length !== entries.length) {
    return sources;
  }

  const updatedSources: RestoreOutputData["sources"] = {};
  for (const [index, [outputId, source]] of entries.entries()) {
    updatedSources[outputId] = {
      ...source,
      restoredText: updatedParts[index] ?? "",
    };
  }
  return updatedSources;
}

// ─── Execute Restore ────────────────────────────────────────────────────────

/**
 * Replace desensitized placeholders with real values using stored mappings.
 */
export async function executeRestore(
  documentId: string,
  nodeExecutionId: string,
  config: RestoreConfig,
): Promise<RestoreOutputData> {
  // Get input sources from this node's inputData.
  const [exec] = await db
    .select({
      inputData: nodeExecutions.inputData,
    })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) throw new Error("Node execution not found");

  const inputData = exec.inputData as Record<string, unknown> | null;
  const sourceInputs = collectRestoreInputSources(inputData);

  // Only use inputData.text when restore has explicit inputSources.
  // When no inputSources (whitelist mode), always collect from upstream namedOutputs.
  const hasExplicitInputSources = config.inputSources && config.inputSources.length > 0;
  const legacyText = hasExplicitInputSources ? ((inputData?.text as string) ?? "") : "";
  if (sourceInputs.length === 0 && legacyText.trim()) {
    sourceInputs.push({ outputId: "__legacy_text", displayName: "恢复文本", text: legacyText });
  }

  // When no explicit input sources, collect exportable upstream namedOutputs via whitelist.
  if (sourceInputs.length === 0) {
    const EXPORTABLE_OUTPUTS: Record<string, Set<string>> = {
      node_techresp: new Set(["form_fills"]),
      node_solution: new Set([
        "group1_delivery",
        "group2_implementation",
        "group3_service",
        "group4_training",
        "group5_quality",
        "group6_construction",
        "group7_extras",
      ]),
    };

    const upstreamExecs = await db
      .select()
      .from(nodeExecutions)
      .where(
        and(
          eq(nodeExecutions.documentId, documentId),
          eq(nodeExecutions.isCurrent, true),
          eq(nodeExecutions.status, "completed"),
        ),
      )
      .orderBy(asc(nodeExecutions.stepOrder));

    const currentExec = upstreamExecs.find((e) => e.id === nodeExecutionId);

    for (const ue of upstreamExecs) {
      if (currentExec && ue.stepOrder >= currentExec.stepOrder) break;

      const allowedOutputs = EXPORTABLE_OUTPUTS[ue.nodeId];
      if (!allowedOutputs) continue;

      const od = ue.outputData as Record<string, unknown> | null;
      if (!od?.namedOutputs) continue;

      const namedOutputs = od.namedOutputs as Record<string, { content: string; format: string }>;
      for (const [key, val] of Object.entries(namedOutputs)) {
        if (
          allowedOutputs.has(key) &&
          val?.content &&
          typeof val.content === "string" &&
          val.content.trim()
        ) {
          sourceInputs.push({
            outputId: `${ue.nodeId}.${key}`,
            displayName: key,
            text: val.content,
          });
        }
      }
    }
  }

  const originalText = sourceInputs.map((source) => source.text).join("\n\n");
  if (!originalText) {
    throw new Error("No input text found for restore node");
  }

  // Load desensitize mappings from DB
  let mappings: Array<{
    placeholder: string;
    originalValue: string;
    sensitiveType: string;
  }>;

  if (config.pairedDesensitizeNodeId) {
    // Find the nodeExecution for the paired desensitize workflow nodeId
    const [pairedExec] = await db
      .select({ id: nodeExecutions.id })
      .from(nodeExecutions)
      .where(
        and(
          eq(nodeExecutions.documentId, documentId),
          eq(nodeExecutions.nodeId, config.pairedDesensitizeNodeId),
        ),
      )
      .limit(1);

    if (pairedExec) {
      mappings = await db
        .select({
          placeholder: desensitizeMappings.placeholder,
          originalValue: desensitizeMappings.originalValue,
          sensitiveType: desensitizeMappings.sensitiveType,
        })
        .from(desensitizeMappings)
        .where(
          and(
            eq(desensitizeMappings.documentId, documentId),
            eq(desensitizeMappings.nodeExecutionId, pairedExec.id),
          ),
        );
    } else {
      mappings = [];
    }
  } else {
    // Load ALL desensitize mappings for this document
    mappings = await db
      .select({
        placeholder: desensitizeMappings.placeholder,
        originalValue: desensitizeMappings.originalValue,
        sensitiveType: desensitizeMappings.sensitiveType,
      })
      .from(desensitizeMappings)
      .where(eq(desensitizeMappings.documentId, documentId));
  }

  // Replace placeholders with original values for every source.
  const sourceStates = sourceInputs.map((source) => ({
    ...source,
    restoredText: source.text,
  }));
  const restorations: RestorationItem[] = [];

  for (const mapping of mappings) {
    let found = false;
    for (const source of sourceStates) {
      if (source.restoredText.includes(mapping.placeholder)) {
        found = true;
        source.restoredText = source.restoredText.replaceAll(
          mapping.placeholder,
          mapping.originalValue,
        );
      }
    }
    restorations.push({
      placeholder: mapping.placeholder,
      originalValue: mapping.originalValue,
      sensitiveType: mapping.sensitiveType,
      restored: found,
    });
  }

  const sources: RestoreOutputData["sources"] = {};
  for (const source of sourceStates) {
    sources[source.outputId] = {
      displayName: source.displayName,
      restoredText: source.restoredText,
    };
  }
  const restoredText = sourceStates.map((source) => source.restoredText).join("\n\n");

  // Store output
  const outputData: RestoreOutputData = {
    originalText,
    restoredText,
    restorations,
    sources,
  };

  const now = new Date();
  await db
    .update(nodeExecutions)
    .set({ outputData: outputData as unknown as Record<string, unknown>, updatedAt: now })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  return outputData;
}

// ─── Update Restored Text (Manual Correction) ──────────────────────────────

/**
 * User manually corrected failed restorations via inline editing.
 * Re-check all restorations to update restored status.
 */
export async function updateRestoredText(
  documentId: string,
  nodeExecutionId: string,
  updatedText: string,
): Promise<RestoreOutputData> {
  // Load current outputData
  const [exec] = await db
    .select({ outputData: nodeExecutions.outputData })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) throw new Error("Node execution not found");

  const currentOutput = exec.outputData as unknown as RestoreOutputData | null;
  if (!currentOutput) throw new Error("No restore output found — execute restore first");

  // Re-check restorations: a placeholder is "restored" if it no longer appears in the text
  const updatedRestorations: RestorationItem[] = currentOutput.restorations.map((r) => ({
    ...r,
    restored: !updatedText.includes(r.placeholder),
  }));

  const outputData: RestoreOutputData = {
    originalText: currentOutput.originalText ?? "",
    restoredText: updatedText,
    restorations: updatedRestorations,
    sources: updateSourcesFromAggregate(
      currentOutput.sources,
      currentOutput.restoredText ?? "",
      updatedText,
    ),
  };

  const now = new Date();
  await db
    .update(nodeExecutions)
    .set({ outputData: outputData as unknown as Record<string, unknown>, updatedAt: now })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  return outputData;
}
