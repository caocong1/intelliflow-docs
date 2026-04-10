/**
 * Migration: Extract ===NAMED_OUTPUT:xxx=== blocks from promptTemplate
 * and move them to each namedOutput's outputPrompt field.
 *
 * Usage: bun --env-file=../../.env run src/scripts/migrate-named-output-prompts.ts
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://dongli@localhost:5432/intelliflow";
const sql = postgres(DATABASE_URL);

interface NamedOutputDef {
  id: string;
  name: string;
  format: string;
  jsonSchema?: object;
  simpleFields?: unknown[];
  outputPrompt?: string;
}

interface NodeDef {
  id: string;
  type: string;
  label: string;
  config: {
    type: string;
    promptTemplate?: string;
    namedOutputs?: NamedOutputDef[];
    namedOutputMode?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function migrateNode(node: NodeDef): { changed: boolean; node: NodeDef } {
  const config = node.config;
  if (config.type !== "model_call" || !config.namedOutputs?.length || !config.promptTemplate) {
    return { changed: false, node };
  }

  const prompt = config.promptTemplate;

  // Find delimiter: try ===NAMED_OUTPUT: first, then ===OUTPUT:
  let delimiterPrefix = "===NAMED_OUTPUT:";
  let delimiterIdx = prompt.indexOf(delimiterPrefix);
  if (delimiterIdx === -1) {
    delimiterPrefix = "===OUTPUT:";
    delimiterIdx = prompt.indexOf(delimiterPrefix);
  }
  if (delimiterIdx === -1) return { changed: false, node };

  // Extract main prompt: everything before the --- separator + intro text
  let mainPromptEnd = delimiterIdx;
  const beforeDelimiter = prompt.substring(0, delimiterIdx);
  const lastDashLine = beforeDelimiter.lastIndexOf("---");
  if (lastDashLine !== -1) {
    const introPart = beforeDelimiter.substring(lastDashLine).trim();
    if (introPart.length < 200 && !introPart.includes("{{")) {
      mainPromptEnd = lastDashLine;
    }
  }
  const mainPrompt = prompt.substring(0, mainPromptEnd).trimEnd();

  // Parse delimiter blocks
  const delimiterSection = prompt.substring(delimiterIdx);
  const escaped = delimiterPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}(\\w+)===`, "g");
  const ids: string[] = [];
  const positions: number[] = [];
  let match: RegExpExecArray | null;
  match = regex.exec(delimiterSection);
  while (match !== null) {
    ids.push(match[1]);
    positions.push(match.index + match[0].length);
    match = regex.exec(delimiterSection);
  }

  if (ids.length === 0) return { changed: false, node };

  // Extract content between delimiters
  const outputPrompts = new Map<string, string>();
  for (let i = 0; i < ids.length; i++) {
    const start = positions[i];
    const end =
      i + 1 < ids.length
        ? delimiterSection.indexOf(delimiterPrefix, start)
        : delimiterSection.length;
    outputPrompts.set(ids[i], delimiterSection.substring(start, end).trim());
  }

  // Update namedOutputs
  const updatedOutputs = config.namedOutputs.map((o) => {
    const extracted = outputPrompts.get(o.id);
    if (extracted && !o.outputPrompt?.trim()) {
      return { ...o, outputPrompt: extracted };
    }
    return o;
  });

  // Remove namedOutputMode
  const { namedOutputMode: _, ...restConfig } = config;

  return {
    changed: true,
    node: {
      ...node,
      config: { ...restConfig, promptTemplate: mainPrompt, namedOutputs: updatedOutputs },
    },
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
      const m = migrateNode(node);
      if (m.changed) {
        changed = true;
        console.log(`[${wf.name}] "${node.label}" migrated:`);
        for (const o of m.node.config.namedOutputs ?? []) {
          if (o.outputPrompt) console.log(`  ${o.id}: ${o.outputPrompt.substring(0, 70)}...`);
        }
        const pt = m.node.config.promptTemplate ?? "";
        console.log(`  prompt ends: ...${pt.substring(Math.max(0, pt.length - 50))}`);
      }
      result.push(m.node);
    }

    if (changed) {
      await sql`UPDATE workflows SET nodes = ${sql.json(result as unknown as Parameters<typeof sql.json>[0])} WHERE id = ${wf.id}`;
      updated++;
      console.log("  -> Updated\n");
    }
  }

  console.log(`Done. ${updated} workflow(s) updated.`);
  await sql.end();
}

main().catch(console.error);
