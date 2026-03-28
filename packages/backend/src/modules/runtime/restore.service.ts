import { eq, and, asc } from "drizzle-orm";
import { db } from "../../db";
import { desensitizeMappings, nodeExecutions } from "../../db/schema";
import type { NodeExecution, RestoreConfig } from "@intelliflow/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RestorationItem {
  placeholder: string;
  originalValue: string;
  sensitiveType: string;
  restored: boolean;
}

export interface RestoreOutputData {
  originalText: string;
  restoredText: string;
  restorations: RestorationItem[];
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
  // Get input text from this node's inputData (upstream model call output)
  const [exec] = await db
    .select({
      inputData: nodeExecutions.inputData,
      nodeId: nodeExecutions.nodeId,
    })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) throw new Error("Node execution not found");

  const inputData = exec.inputData as Record<string, unknown> | null;
  // Only use inputData.text when restore has explicit inputSources.
  // When no inputSources (whitelist mode), always collect from upstream namedOutputs.
  const hasExplicitInputSources = config.inputSources && config.inputSources.length > 0;
  let originalText = hasExplicitInputSources ? ((inputData?.text as string) ?? "") : "";

  // When no explicit input text, collect exportable upstream namedOutputs via whitelist
  if (!originalText) {
    const EXPORTABLE_OUTPUTS: Record<string, Set<string>> = {
      node_techresp: new Set(["form_fills"]),
      node_solution: new Set([
        "group1_delivery", "group2_implementation", "group3_service",
        "group4_training", "group5_quality", "group6_construction", "group7_extras",
      ]),
    };

    const upstreamExecs = await db.select()
      .from(nodeExecutions)
      .where(and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.isCurrent, true),
        eq(nodeExecutions.status, "completed"),
      ))
      .orderBy(asc(nodeExecutions.stepOrder));

    const currentExec = upstreamExecs.find(e => e.id === nodeExecutionId);
    const parts: string[] = [];

    for (const ue of upstreamExecs) {
      if (currentExec && ue.stepOrder >= currentExec.stepOrder) break;

      const allowedOutputs = EXPORTABLE_OUTPUTS[ue.nodeId];
      if (!allowedOutputs) continue;

      const od = ue.outputData as Record<string, unknown> | null;
      if (!od?.namedOutputs) continue;

      const namedOutputs = od.namedOutputs as Record<string, { content: string; format: string }>;
      for (const [key, val] of Object.entries(namedOutputs)) {
        if (allowedOutputs.has(key) && val?.content && typeof val.content === "string") {
          parts.push(val.content);
        }
      }
    }
    originalText = parts.join("\n\n");
  }

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

  // Replace placeholders with original values
  let restoredText = originalText;
  const restorations: RestorationItem[] = [];

  for (const mapping of mappings) {
    const found = restoredText.includes(mapping.placeholder);
    if (found) {
      restoredText = restoredText.replaceAll(mapping.placeholder, mapping.originalValue);
    }
    restorations.push({
      placeholder: mapping.placeholder,
      originalValue: mapping.originalValue,
      sensitiveType: mapping.sensitiveType,
      restored: found,
    });
  }

  // Store output
  const outputData: RestoreOutputData = {
    originalText,
    restoredText,
    restorations,
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
    originalText: currentOutput.originalText,
    restoredText: updatedText,
    restorations: updatedRestorations,
  };

  const now = new Date();
  await db
    .update(nodeExecutions)
    .set({ outputData: outputData as unknown as Record<string, unknown>, updatedAt: now })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  return outputData;
}
