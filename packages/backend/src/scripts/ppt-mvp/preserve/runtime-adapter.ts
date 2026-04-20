/**
 * Runtime adapter — exposes preserve-mode builder as a Buffer-returning
 * function that `export.service.ts` can dispatch to when a PPT template's
 * `type === "preserve_slot_map"` (new template type to add to DB schema).
 *
 * This module does NOT modify export.service.ts directly — integration
 * is a separate follow-up because export.service.ts currently has
 * in-progress changes from other work. When ready, wire like this in
 * export.service.ts around line 2637 (next to the native_pptx /
 * code_theme branches):
 *
 *   if (template.type === "preserve_slot_map" && template.preserveConfig) {
 *     const templateBuffer = await readFile(template.templateFilePath);
 *     const buffer = await renderSlidesWithPreserveMode({
 *       templateBuffer,
 *       fillPlanPath: template.preserveConfig.fillPlanPath,
 *       slotMapDir: template.preserveConfig.slotMapDir,
 *       strict: true,  // production default — fail loud on over-budget content
 *     });
 *     return { buffer, renderMode: `preserve_slot_map_${composition.source}`, ... };
 *   }
 *
 * Also needed on the DB side:
 *   - `ppt_templates.type` enum: add "preserve_slot_map"
 *   - `ppt_templates.preserveConfig` JSON column: { fillPlanPath, slotMapDir, expectedPages? }
 *   - A fill-plan file + slot-map dir bundled with the template's media
 *
 * The adapter intentionally keeps a narrow interface (no DeckAssignment,
 * no composition summary) because preserve mode drives its own content
 * via the fill-plan rather than dynamic composition. The trade-off: it
 * cannot be fed arbitrary Markdown/AI output — fill-plan must be
 * pre-authored per template.
 */
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildFromTemplatePreserve,
  type BuildPreserveArgs,
  type BuildPreserveResult,
} from "./build-from-template-preserve";

export type PreserveRenderArgs = {
  /** Raw .pptx bytes for the source template. */
  templateBuffer: Buffer;
  /** Absolute path to a template_fill_plan/v1 JSON. */
  fillPlanPath: string;
  /** Optional override for slot-map dir (otherwise resolved from fill-plan). */
  slotMapDir?: string;
  /** When true, over-budget content throws instead of calling LLM. Default true. */
  strict?: boolean;
  /** Optional rewrite mocks (tests) keyed by slotId. */
  rewriteMocks?: Record<string, string>;
};

export type PreserveRenderResult = {
  buffer: Buffer;
  replacedSlotCount: number;
  preservedSlotCount: number;
  rewrittenSlotCount: number;
  rewrites: BuildPreserveResult["rewrites"];
};

export async function renderSlidesWithPreserveMode(
  args: PreserveRenderArgs,
): Promise<PreserveRenderResult> {
  // buildFromTemplatePreserve expects a filesystem path for the template
  // (it calls readFileSync on templatePath). Stage the buffer into a
  // short-lived tmp file so the existing builder interface works unchanged.
  const tmp = await mkdtemp(join(tmpdir(), "preserve-adapter-"));
  const templatePath = join(tmp, "template.pptx");
  const outPath = join(tmp, "output.pptx");
  await writeFile(templatePath, args.templateBuffer);

  const buildArgs: BuildPreserveArgs = {
    fillPlanPath: args.fillPlanPath,
    outPath,
    templateOverride: templatePath,
    slotMapDirOverride: args.slotMapDir,
    strict: args.strict ?? true,
    rewriteMocks: args.rewriteMocks,
  };

  const result = await buildFromTemplatePreserve(buildArgs);
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(result.outPath);

  return {
    buffer,
    replacedSlotCount: result.replacedSlotCount,
    preservedSlotCount: result.preservedSlotCount,
    rewrittenSlotCount: result.rewrittenSlotCount,
    rewrites: result.rewrites,
  };
}
