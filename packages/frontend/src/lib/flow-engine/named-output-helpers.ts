import type { SimpleFieldDef } from "@intelliflow/shared";

// ── Field name validation ────────────────────────────────────────────────────

const FIELD_NAME_RE = /^[a-zA-Z_]\w*$/;

export function isValidFieldName(name: string): boolean {
  return FIELD_NAME_RE.test(name);
}

export function isUniqueFieldName(name: string, others: string[]): boolean {
  return !others.includes(name);
}

// ── Stable ID generation ─────────────────────────────────────────────────────

export function generateStableOutputId(existingIds: string[]): string {
  const idSet = new Set(existingIds);
  let i = 1;
  while (idSet.has(`output_${i}`)) i++;
  return `output_${i}`;
}

// ── SimpleFieldDef[] → JSON Schema ───────────────────────────────────────────

export function fieldsToJsonSchema(fields: SimpleFieldDef[]): object {
  const properties: Record<string, object> = {};
  const required: string[] = [];

  for (const f of fields) {
    properties[f.name] = {
      type: f.type,
      ...(f.description ? { description: f.description } : {}),
    };
    if (f.required) required.push(f.name);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// ── JSON Schema → SimpleFieldDef[] ───────────────────────────────────────────

const ATOMIC_TYPES = new Set(["string", "number", "boolean"]);

export function jsonSchemaToFields(
  schema: object | undefined,
): { fields: SimpleFieldDef[]; lossless: boolean } {
  if (!schema) return { fields: [], lossless: true };

  const s = schema as Record<string, unknown>;
  if (s.type !== "object" || typeof s.properties !== "object" || !s.properties) {
    return { fields: [], lossless: false };
  }

  const props = s.properties as Record<string, Record<string, unknown>>;
  const requiredSet = new Set(
    Array.isArray(s.required) ? (s.required as string[]) : [],
  );

  const fields: SimpleFieldDef[] = [];
  let lossless = true;

  for (const [name, prop] of Object.entries(props)) {
    const propType = prop.type as string;
    if (!ATOMIC_TYPES.has(propType)) {
      lossless = false;
      continue; // skip non-atomic fields
    }
    fields.push({
      name,
      type: propType as "string" | "number" | "boolean",
      description: (prop.description as string) ?? undefined,
      required: requiredSet.has(name),
    });
  }

  // If we skipped any properties, it's lossy
  if (fields.length < Object.keys(props).length) {
    lossless = false;
  }

  return { fields, lossless };
}
