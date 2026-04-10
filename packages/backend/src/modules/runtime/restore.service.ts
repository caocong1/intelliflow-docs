import type {
  InputSource,
  OutputDef,
  RestorationItem,
  RestoreConfig,
  RestoreOutputData,
  WorkflowNodeDef,
} from "@intelliflow/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { desensitizeMappings, documents, nodeExecutions, workflows } from "../../db/schema";

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

type NamedOutputValue = {
  content?: string;
  format?: string;
};

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

function parseDelimitedOutputs(rawContent: string): Array<{ outputId: string; text: string }> {
  const regex = /===OUTPUT:(\w+)===\n?([\s\S]*?)===END:\1===/g;
  const parts: Array<{ outputId: string; text: string }> = [];

  let match = regex.exec(rawContent);
  while (match !== null) {
    const outputId = match[1];
    const text = match[2]?.trim() ?? "";
    if (text) {
      parts.push({ outputId, text });
    }
    match = regex.exec(rawContent);
  }

  return parts;
}

function stripInternalChapterMarkers(text: string): string {
  return text
    .replace(/^[ \t]*<!--\s*\/?chapter:[^>]+-->\s*\n?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findOutputDef(nodeDef: WorkflowNodeDef | undefined, outputId: string): OutputDef | undefined {
  return nodeDef?.outputs.find((output) => output.id === outputId || output.segmentKey === outputId);
}

function resolveConfiguredSourceText(
  outputData: Record<string, unknown> | null,
  nodeDef: WorkflowNodeDef | undefined,
  outputId: string,
): string {
  if (!outputData) return "";

  const matchedOutput = findOutputDef(nodeDef, outputId);
  const candidateKeys = [
    outputId,
    matchedOutput?.segmentKey,
    matchedOutput?.id,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  const sources = outputData.sources as Record<string, RestoreInputSource> | undefined;
  if (sources && typeof sources === "object" && !Array.isArray(sources)) {
    for (const key of candidateKeys) {
      const sourceText = sources[key] ? getRestoreSourceText(sources[key]) : "";
      if (sourceText.trim()) return sourceText;
    }
  }

  const namedOutputs = outputData.namedOutputs as Record<string, NamedOutputValue> | undefined;
  if (namedOutputs && typeof namedOutputs === "object" && !Array.isArray(namedOutputs)) {
    for (const key of candidateKeys) {
      const content = typeof namedOutputs[key]?.content === "string" ? namedOutputs[key].content : "";
      if (content.trim()) return content;
    }
  }

  const outputItems = outputData.outputItems as
    | Record<string, { content?: string }>
    | undefined;
  if (outputItems && typeof outputItems === "object" && !Array.isArray(outputItems)) {
    for (const key of candidateKeys) {
      const content = typeof outputItems[key]?.content === "string" ? outputItems[key].content : "";
      if (content.trim()) return content;
    }
  }

  for (const rawKey of ["selectedContent", "text"] as const) {
    const rawContent = outputData[rawKey];
    if (typeof rawContent !== "string" || !rawContent.trim()) continue;

    const parts = parseDelimitedOutputs(rawContent);
    for (const key of candidateKeys) {
      const match = parts.find((part) => part.outputId === key);
      if (match?.text.trim()) return match.text;
    }
  }

  const fields = outputData.fields as Record<string, string> | undefined;
  const fieldsByKey = outputData.fieldsByKey as Record<string, string> | undefined;
  for (const key of candidateKeys) {
    const fieldKey = key.match(/-field-(.+)$/)?.[1] ?? key;
    const fieldText = fieldsByKey?.[fieldKey] ?? fields?.[fieldKey];
    if (typeof fieldText === "string" && fieldText.trim()) return fieldText;
  }

  const fileSlots = outputData.fileSlots as Record<string, { text?: string }> | undefined;
  for (const key of candidateKeys) {
    const slotKey = key.match(/-fileslot-(.+)$/)?.[1] ?? key;
    const slotText = fileSlots?.[slotKey]?.text;
    if (typeof slotText === "string" && slotText.trim()) return slotText;
  }

  if (candidateKeys.includes("text")) {
    const text = outputData.text;
    if (typeof text === "string" && text.trim()) return text;
  }

  if (candidateKeys.includes("restored")) {
    const restoredText = outputData.restoredText;
    if (typeof restoredText === "string" && restoredText.trim()) return restoredText;
  }

  if (candidateKeys.includes("desensitized")) {
    const desensitizedText = outputData.desensitizedText;
    if (typeof desensitizedText === "string" && desensitizedText.trim()) return desensitizedText;
  }

  return "";
}

async function collectConfiguredRestoreSources(
  documentId: string,
  nodeExecutionId: string,
  inputSources: InputSource[],
): Promise<RestoreSourceInput[]> {
  const [doc] = await db
    .select({
      nodes: workflows.nodes,
    })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  const workflowNodes = (doc?.nodes as WorkflowNodeDef[] | undefined) ?? [];
  const nodeDefMap = new Map(workflowNodes.map((node) => [node.id, node]));

  const currentExecs = await db
    .select()
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.documentId, documentId),
        eq(nodeExecutions.isCurrent, true),
      ),
    )
    .orderBy(asc(nodeExecutions.stepOrder));

  const currentExec = currentExecs.find((exec) => exec.id === nodeExecutionId);
  const execMap = new Map(currentExecs.map((exec) => [exec.nodeId, exec]));
  const resolved: RestoreSourceInput[] = [];

  for (const src of inputSources) {
    const upstreamExec = execMap.get(src.sourceNodeId);
    if (!upstreamExec) continue;
    if (upstreamExec.status !== "completed" && upstreamExec.status !== "skipped") continue;
    if (currentExec && upstreamExec.stepOrder >= currentExec.stepOrder) continue;

    const text = resolveConfiguredSourceText(
      upstreamExec.outputData as Record<string, unknown> | null,
      nodeDefMap.get(src.sourceNodeId),
      src.outputId,
    );
    if (!text.trim()) continue;

    resolved.push({
      outputId: `${src.sourceNodeId}.${src.outputId}`,
      displayName: src.displayName,
      text: stripInternalChapterMarkers(text),
    });
  }

  return resolved;
}

export function collectWhitelistedOutputParts(
  outputData: Record<string, unknown> | null,
  allowedOutputs: Set<string>,
): Array<{ outputId: string; text: string }> {
  if (!outputData) return [];

  const collected: Array<{ outputId: string; text: string }> = [];
  const seen = new Set<string>();

  const namedOutputs = outputData.namedOutputs as Record<string, NamedOutputValue> | undefined;
  if (namedOutputs && typeof namedOutputs === "object" && !Array.isArray(namedOutputs)) {
    for (const [outputId, value] of Object.entries(namedOutputs)) {
      const text = typeof value?.content === "string" ? value.content.trim() : "";
      if (!allowedOutputs.has(outputId) || !text || seen.has(outputId)) continue;
      collected.push({ outputId, text });
      seen.add(outputId);
    }
  }

  const outputItems = outputData.outputItems as
    | Record<string, { content?: string }>
    | undefined;
  if (outputItems && typeof outputItems === "object" && !Array.isArray(outputItems)) {
    for (const [outputId, value] of Object.entries(outputItems)) {
      const text = typeof value?.content === "string" ? value.content.trim() : "";
      if (!allowedOutputs.has(outputId) || !text || seen.has(outputId)) continue;
      collected.push({ outputId, text });
      seen.add(outputId);
    }
  }

  for (const rawKey of ["selectedContent", "text"] as const) {
    const rawContent = outputData[rawKey];
    if (typeof rawContent !== "string" || !rawContent.trim()) continue;

    for (const part of parseDelimitedOutputs(rawContent)) {
      if (!allowedOutputs.has(part.outputId) || seen.has(part.outputId)) continue;
      collected.push(part);
      seen.add(part.outputId);
    }
  }

  return collected;
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
  const hasExplicitInputSources = config.inputSources && config.inputSources.length > 0;
  const sourceInputs = hasExplicitInputSources
    ? await collectConfiguredRestoreSources(documentId, nodeExecutionId, config.inputSources ?? [])
    : [];

  // Only use inputData.text when restore has explicit inputSources.
  // When no inputSources (whitelist mode), ignore stale inputData and always
  // collect from upstream exportable outputs.
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
      for (const part of collectWhitelistedOutputParts(od, allowedOutputs)) {
        sourceInputs.push({
          outputId: `${ue.nodeId}.${part.outputId}`,
          displayName: part.outputId,
          text: stripInternalChapterMarkers(part.text),
        });
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
          eq(nodeExecutions.status, "completed"),
        ),
      )
      .orderBy(
        desc(nodeExecutions.isCurrent),
        desc(nodeExecutions.completedAt),
        desc(nodeExecutions.createdAt),
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
    source.restoredText = stripInternalChapterMarkers(source.restoredText);
    sources[source.outputId] = {
      displayName: source.displayName,
      originalText: source.text,
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

// ─── Confirm Restore ──────────────────────────────────────────────────────

export async function confirmRestore(
  documentId: string,
  nodeExecutionId: string,
): Promise<RestoreOutputData> {
  const [exec] = await db
    .select({ outputData: nodeExecutions.outputData })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) throw new Error("Node execution not found");
  const currentOutput = exec.outputData as unknown as RestoreOutputData | null;
  if (!currentOutput) throw new Error("No restore output found — execute restore first");

  const outputData: RestoreOutputData = {
    ...currentOutput,
    confirmedAt: new Date().toISOString(),
  };

  await db
    .update(nodeExecutions)
    .set({ outputData: outputData as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  return outputData;
}

// ─── Update Restore Source (Per-Source Edit) ──────────────────────────────

export async function updateRestoreSource(
  documentId: string,
  nodeExecutionId: string,
  sourceId: string,
  restoredText: string,
): Promise<RestoreOutputData> {
  const [exec] = await db
    .select({ outputData: nodeExecutions.outputData })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) throw new Error("Node execution not found");
  const currentOutput = exec.outputData as unknown as RestoreOutputData | null;
  if (!currentOutput?.sources) throw new Error("No restore output found");

  if (!currentOutput.sources[sourceId]) {
    throw new Error(`Source "${sourceId}" not found in restore output`);
  }

  const updatedSources = { ...currentOutput.sources };
  updatedSources[sourceId] = {
    ...updatedSources[sourceId],
    restoredText,
  };

  const allText = Object.values(updatedSources).map((s) => s.restoredText).join("\n");
  const updatedRestorations = currentOutput.restorations.map((r) => ({
    ...r,
    restored: !allText.includes(r.placeholder),
  }));

  const aggregateText = Object.values(updatedSources).map((s) => s.restoredText).join("\n\n");

  const outputData: RestoreOutputData = {
    ...currentOutput,
    restoredText: aggregateText,
    restorations: updatedRestorations,
    sources: updatedSources,
  };

  await db
    .update(nodeExecutions)
    .set({ outputData: outputData as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  return outputData;
}
