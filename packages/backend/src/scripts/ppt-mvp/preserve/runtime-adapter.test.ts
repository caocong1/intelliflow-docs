import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { ensureFixture } from "./fetch-template-fixture";
import { renderSlidesWithPreserveMode } from "./runtime-adapter";

const REPO_ROOT = resolve(__dirname, "../../../../../..");
const FILL_PLAN = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/templates/wireless-template-fill-plan.json",
);

describe("preserve/runtime-adapter", () => {
  test("renders preserve mode from an in-memory template buffer", async () => {
    const templatePath = ensureFixture("622eee2ab7e6e.pptx");
    const templateBuffer = readFileSync(templatePath);
    const result = await renderSlidesWithPreserveMode({
      templateBuffer,
      fillPlanPath: FILL_PLAN,
      strict: true,
    });
    expect(result.buffer.byteLength).toBeGreaterThan(100_000);
    expect(result.replacedSlotCount).toBeGreaterThan(0);
    expect(result.rewrittenSlotCount).toBe(0);
  }, 60000);
});
