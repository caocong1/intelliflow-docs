/**
 * Thin wrapper that invokes build-from-template-preserve.ts with the
 * wireless deck's fixed template + fill-plan + slot-map defaults.
 *
 * Usage:
 *   bun build-wireless-template-preserve.ts [output.pptx]
 *
 * Defaults to /tmp/intelliflow-ppt-mvp-wireless-preserve-v1.pptx.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureLiveClaudeEnvFromDb } from "../ai-pipeline/live-config";
import { ensureFixture } from "./fetch-template-fixture";
import { buildFromTemplatePreserve } from "./build-from-template-preserve";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(MODULE_DIR, "../../../../../..");
const FILL_PLAN = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/templates/wireless-template-fill-plan.json",
);

async function main() {
  const outPath = process.argv[2] ?? "/tmp/intelliflow-ppt-mvp-wireless-preserve-v1.pptx";
  const strict = process.argv.includes("--strict");
  const templatePath = ensureFixture("622eee2ab7e6e.pptx");

  // Pre-load LLM credentials unless we're in strict (no-rewrite) mode or
  // explicitly mocking via CLAUDE_MOCK=1.
  if (!strict && process.env.CLAUDE_MOCK !== "1") {
    try {
      const liveConfig = await ensureLiveClaudeEnvFromDb();
      console.error(
        `[wireless-preserve] LLM rewrite enabled — source=${liveConfig.source}, model=${liveConfig.modelId ?? "?"}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[wireless-preserve] Could not auto-load LLM config (${msg}); will fail on first overflow. Pass --strict to skip rewrite, or set CLAUDE_MOCK=1.`,
      );
    }
  }

  const result = await buildFromTemplatePreserve({
    fillPlanPath: FILL_PLAN,
    outPath,
    templateOverride: templatePath,
    strict,
  });
  console.log(
    `[wireless-preserve] wrote ${result.outPath}\n` +
      `  template: ${result.templatePath}\n` +
      `  pages: ${result.pageCount}\n` +
      `  replaced slots: ${result.replacedSlotCount}\n` +
      `  preserved slots: ${result.preservedSlotCount}\n` +
      `  LLM-rewritten slots: ${result.rewrittenSlotCount}`,
  );
  for (const r of result.rewrites) {
    console.log(`    rewrite[${r.pageId}/${r.slotId}]: ${r.before} → ${r.after}`);
  }
}

main().catch((err) => {
  console.error("[wireless-preserve] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
