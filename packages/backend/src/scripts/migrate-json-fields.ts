/**
 * Migration: Extract field definitions from JSON output prompts into simpleFields.
 * Cleans outputPrompt to keep only the high-level instruction.
 *
 * Usage: bun --env-file=../../.env run src/scripts/migrate-json-fields.ts
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://dongli@localhost:5432/intelliflow";
const sql = postgres(DATABASE_URL);

interface SimpleFieldDef {
  name: string;
  type: "string" | "number" | "boolean";
  description?: string;
  required?: boolean;
}

interface NamedOutputDef {
  id: string;
  name: string;
  format: string;
  jsonSchema?: object;
  simpleFields?: SimpleFieldDef[];
  outputPrompt?: string;
}

interface NodeDef {
  id: string;
  type: string;
  label: string;
  config: {
    type: string;
    namedOutputs?: NamedOutputDef[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Parse field names from outputPrompt text.
 * Handles patterns like:
 * - "每条含：\nfield1, field2 (type), field3"
 * - "- field1, field2, field3"
 * - "包含以下字段：\n- field1 (type): desc"
 */
function extractFields(prompt: string): { fields: SimpleFieldDef[]; cleanedPrompt: string } | null {
  // Pattern 1: "每条含：\nfield1, field2 (type), field3"
  const match1 = prompt.match(/[每含].*[含：:]\s*\n([\s\S]*?)(?:\n[^\n]*(?:输出|降级|如无)|$)/);
  // Pattern 2: "格式：\n{...}" - structured format description
  const match2 = prompt.match(/格式[：:]\s*\n\{/);

  let fieldLine: string | null = null;
  let cleanedPrompt = prompt;

  if (match1) {
    fieldLine = match1[1].trim();
    // Clean: remove field listing lines, keep first line and trailing instructions
    const lines = prompt.split("\n");
    const cleaned: string[] = [];
    let skipFields = false;
    for (const line of lines) {
      if (line.includes(fieldLine.split("\n")[0].trim().substring(0, 20))) {
        skipFields = true;
        continue;
      }
      if (skipFields && (line.startsWith("-") || line.match(/^\w+[,，]/))) {
        continue;
      }
      skipFields = false;
      cleaned.push(line);
    }
    cleanedPrompt = cleaned.join("\n").trim();
  }

  if (!fieldLine) {
    // Try: lines starting with "- " that contain comma-separated field names
    const dashMatch = prompt.match(/- ([a-zA-Z_]\w*(?:\s*\([^)]*\))?,\s*[a-zA-Z_][\w\s(),/*]*)/);
    if (dashMatch) {
      fieldLine = dashMatch[1];
    }
  }

  if (!fieldLine) return null;

  // Parse individual fields from the field line
  // Handle: "clause_id, clause_text, priority (★必须/重要/普通), category"
  // Handle: "clause_id, clause_text, is_met (boolean), deviation_note"
  const rawFields = fieldLine
    .replace(/^[-•]\s*/, "")
    .split(/,\s*/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && /^[a-zA-Z_]/.test(f));

  if (rawFields.length === 0) return null;

  const fields: SimpleFieldDef[] = rawFields.map((raw) => {
    // Extract type hint: "is_met (boolean)" or "quantity (number)"
    const typeMatch = raw.match(/^(\w+)\s*\(boolean\)/i);
    const numMatch = raw.match(/^(\w+)\s*\(number\)/i);
    const descMatch = raw.match(/^(\w+)\s*\(([^)]+)\)/);

    if (typeMatch) {
      return { name: typeMatch[1], type: "boolean" as const };
    }
    if (numMatch) {
      return { name: numMatch[1], type: "number" as const };
    }

    // Check for known numeric fields
    const fieldName = raw.match(/^(\w+)/)?.[1] ?? raw;
    const isNumeric = /price|quantity|count|amount|weight|blocking_count/i.test(fieldName);

    const field: SimpleFieldDef = {
      name: fieldName,
      type: isNumeric ? "number" : "string",
    };

    // If there was a parenthetical description (not a type), use it
    if (descMatch && !typeMatch && !numMatch) {
      field.description = descMatch[2];
    }

    return field;
  });

  return { fields, cleanedPrompt };
}

// Known field definitions for this workflow (manually verified)
const KNOWN_FIELDS: Record<string, { fields: SimpleFieldDef[]; prompt: string }> = {
  clause_list: {
    fields: [
      { name: "clause_id", type: "string" },
      { name: "clause_text", type: "string" },
      { name: "priority", type: "string", description: "★必须/重要/普通" },
      { name: "category", type: "string" },
    ],
    prompt: "输出技术要求条款清单（JSON 数组）。如无招标文件，输出空数组 []",
  },
  scoring_matrix: {
    fields: [
      { name: "categories", type: "string", description: "评分大类" },
      { name: "items", type: "string", description: "评分项" },
      { name: "weights", type: "string" },
    ],
    prompt: "输出评分标准矩阵（JSON）。如无招标文件，输出空对象 {}",
  },
  mode: {
    fields: [{ name: "mode", type: "string", description: "normal 或 degraded", required: true }],
    prompt: "有招标文件时输出 normal，仅有需求文档等时输出 degraded",
  },
  technical_response: {
    fields: [
      { name: "clause_id", type: "string" },
      { name: "clause_text", type: "string" },
      { name: "is_met", type: "boolean" },
      { name: "deviation_note", type: "string" },
      { name: "response_summary", type: "string" },
      { name: "evidence_ref", type: "string" },
    ],
    prompt: "逐条生成技术应答表（JSON 数组）。降级模式下输出空数组。",
  },
  deviation_table: {
    fields: [
      { name: "item", type: "string" },
      { name: "requirement", type: "string" },
      { name: "actual_response", type: "string" },
      { name: "deviation_type", type: "string" },
      { name: "explanation", type: "string" },
    ],
    prompt: "生成偏差表（JSON 数组）。降级模式下输出空数组。",
  },
  equipment_list: {
    fields: [
      { name: "category", type: "string" },
      { name: "name", type: "string" },
      { name: "brand", type: "string" },
      { name: "model", type: "string" },
      { name: "specs", type: "string" },
      { name: "quantity", type: "number" },
      { name: "unit_price", type: "number" },
    ],
    prompt: "生成设备清单（JSON 数组）。降级模式下输出空数组。",
  },
  evidence_index: {
    fields: [
      { name: "clause_id", type: "string" },
      { name: "evidence_file", type: "string" },
      { name: "evidence_location", type: "string" },
      { name: "match_basis", type: "string" },
    ],
    prompt: "生成证据附件索引（JSON 数组）。降级模式下输出空数组。",
  },
  chapter_map: {
    fields: [
      { name: "chapter_id", type: "string" },
      { name: "title", type: "string" },
      { name: "source_file", type: "string", description: "如 group1_delivery" },
      { name: "volume", type: "string" },
    ],
    prompt: "输出章节索引（JSON 数组）",
  },
  issue_list: {
    fields: [
      { name: "issue_id", type: "string" },
      { name: "severity", type: "string", description: "critical/major/minor" },
      { name: "category", type: "string", description: "合规/一致性/完整性" },
      { name: "description", type: "string" },
      { name: "affected_section", type: "string" },
      { name: "suggestion", type: "string" },
    ],
    prompt: "输出问题清单（JSON 数组）",
  },
  qa_gate: {
    fields: [
      { name: "can_export", type: "boolean", required: true },
      { name: "blocking_count", type: "number" },
      { name: "reason", type: "string" },
    ],
    prompt: "输出质检门控（JSON）。当存在 critical 问题时 can_export=false。",
  },
};

function fieldsToJsonSchema(fields: SimpleFieldDef[]): object {
  return {
    type: "object",
    properties: Object.fromEntries(
      fields.map((f) => [
        f.name,
        { type: f.type, ...(f.description ? { description: f.description } : {}) },
      ]),
    ),
    required: fields.filter((f) => f.required).map((f) => f.name),
  };
}

async function main() {
  const rows = await sql`SELECT id, name, nodes FROM workflows`;
  let updated = 0;

  for (const wf of rows) {
    const nodes = wf.nodes as NodeDef[];
    let changed = false;
    const result: NodeDef[] = [];

    for (const node of nodes) {
      if (node.config.type !== "model_call" || !node.config.namedOutputs?.length) {
        result.push(node);
        continue;
      }

      let nodeChanged = false;
      const updatedOutputs = node.config.namedOutputs.map((o) => {
        if (o.format !== "json") return o;
        if (o.simpleFields?.length && o.simpleFields.some((f) => f.name)) return o; // Already has real simpleFields

        const known = KNOWN_FIELDS[o.id];
        if (known) {
          nodeChanged = true;
          console.log(`  [${node.label}] ${o.id}: ${known.fields.length} fields extracted`);
          return {
            ...o,
            simpleFields: known.fields,
            jsonSchema: fieldsToJsonSchema(known.fields),
            outputPrompt: known.prompt,
          };
        }

        return o;
      });

      if (nodeChanged) {
        changed = true;
        result.push({ ...node, config: { ...node.config, namedOutputs: updatedOutputs } });
      } else {
        result.push(node);
      }
    }

    if (changed) {
      await sql`UPDATE workflows SET nodes = ${sql.json(result as unknown as Parameters<typeof sql.json>[0])} WHERE id = ${wf.id}`;
      updated++;
      console.log(`  -> ${wf.name} updated\n`);
    }
  }

  console.log(`Done. ${updated} workflow(s) updated.`);
  await sql.end();
}

main().catch(console.error);
