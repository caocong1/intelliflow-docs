/**
 * Resolve a deep field path on a parsed JSON value.
 * Supports dot-separated keys, bracket[N] numeric indices, and [*] array traversal.
 * Examples: "items[0].name", "clauses[*].title", "nested.deep.key"
 */
export function resolveFieldPath(obj: unknown, fieldPath: string): string | undefined {
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
      return current.map((item) => resolve(item, segIdx + 1));
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
 * Uses a priority chain for segmentKey-based lookup across common node output shapes.
 */
export function resolveRef(
  ref: { nodeId: string; outputId: string; fieldPath?: string },
  nodeExecs: Array<{ nodeId: string; outputData: Record<string, unknown> | null }>,
): string | undefined {
  const exec = nodeExecs.find((ne) => ne.nodeId === ref.nodeId);
  if (!exec?.outputData) return undefined;

  const od = exec.outputData as Record<string, unknown>;
  const segmentKey = ref.outputId;

  const fieldsByKey = od.fieldsByKey as Record<string, unknown> | undefined;
  if (fieldsByKey?.[segmentKey] !== undefined && fieldsByKey[segmentKey] !== null) {
    const value = fieldsByKey[segmentKey];
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  const fields = od.fields as Record<string, unknown> | undefined;
  if (fields?.[segmentKey] !== undefined && fields[segmentKey] !== null) {
    const value = fields[segmentKey];
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  const fileSlots = od.fileSlots as Record<string, { text?: string }> | undefined;
  if (fileSlots?.[segmentKey]) {
    return fileSlots[segmentKey].text;
  }

  const namedOutputs = od.namedOutputs as Record<string, { content?: string }> | undefined;
  if (namedOutputs?.[segmentKey]) {
    const baseContent = namedOutputs[segmentKey].content;
    if (ref.fieldPath && baseContent) {
      try {
        return resolveFieldPath(JSON.parse(baseContent), ref.fieldPath);
      } catch {
        console.warn(
          `resolveRef: failed to parse namedOutput "${segmentKey}" as JSON for fieldPath "${ref.fieldPath}"`,
        );
        return undefined;
      }
    }
    return baseContent;
  }

  const outputItems = od.outputItems as Record<string, { content?: string }> | undefined;
  if (outputItems?.[segmentKey]) {
    const baseContent = outputItems[segmentKey].content;
    if (ref.fieldPath && baseContent) {
      try {
        return resolveFieldPath(JSON.parse(baseContent), ref.fieldPath);
      } catch {
        console.warn(
          `resolveRef: failed to parse outputItem "${segmentKey}" as JSON for fieldPath "${ref.fieldPath}"`,
        );
        return undefined;
      }
    }
    return baseContent;
  }

  const sources = od.sources as
    | Record<string, { restoredText?: string; content?: string }>
    | undefined;
  if (sources?.[segmentKey]) {
    return sources[segmentKey].restoredText ?? sources[segmentKey].content;
  }
  if (sources && ref.fieldPath) {
    const compoundKey = `${segmentKey}.${ref.fieldPath}`;
    if (sources[compoundKey]) {
      return sources[compoundKey].restoredText ?? sources[compoundKey].content;
    }
  }

  const modelsMap = od.models as Record<string, { content?: string }> | undefined;
  if (modelsMap?.[segmentKey]) {
    const baseContent = modelsMap[segmentKey].content;
    if (ref.fieldPath && baseContent) {
      try {
        return resolveFieldPath(JSON.parse(baseContent), ref.fieldPath);
      } catch {
        console.warn(
          `resolveRef: failed to parse model output "${segmentKey}" as JSON for fieldPath "${ref.fieldPath}"`,
        );
        return undefined;
      }
    }
    return baseContent;
  }

  if (od[segmentKey] !== undefined && od[segmentKey] !== null) {
    const value = od[segmentKey];
    const baseValue = typeof value === "string" ? value : JSON.stringify(value);
    if (ref.fieldPath) {
      try {
        return resolveFieldPath(JSON.parse(baseValue), ref.fieldPath);
      } catch {
        console.warn(
          `resolveRef: failed to parse property "${segmentKey}" as JSON for fieldPath "${ref.fieldPath}"`,
        );
        return undefined;
      }
    }
    return baseValue;
  }

  return undefined;
}
