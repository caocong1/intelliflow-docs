import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DeckJson } from "./deck-json";

const VARIANT_BUDGETS: Record<string, { maxSlotTextChars: number; minAssetCount: number; requireNotes: boolean }> = {
  cover_hero_image: { maxSlotTextChars: 100, minAssetCount: 1, requireNotes: true },
  toc_card_grid_8: { maxSlotTextChars: 180, minAssetCount: 1, requireNotes: true },
  comparison_dual_image: { maxSlotTextChars: 140, minAssetCount: 4, requireNotes: true },
  timeline_horizontal_5: { maxSlotTextChars: 160, minAssetCount: 3, requireNotes: true },
  process_flow_5: { maxSlotTextChars: 180, minAssetCount: 1, requireNotes: true },
  device_triptych_3: { maxSlotTextChars: 180, minAssetCount: 3, requireNotes: true },
};

function countChars(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countChars(item), 0);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce((sum, item) => sum + countChars(item), 0);
  }
  return 0;
}

function evaluate(deck: DeckJson) {
  const violations: Array<{ slideId: string; variantId: string; reason: string }> = [];

  for (const slide of deck.slides) {
    const budget = VARIANT_BUDGETS[slide.variantId];
    if (!budget) continue;

    const slotChars = countChars(slide.slots);
    if (slotChars > budget.maxSlotTextChars) {
      violations.push({
        slideId: slide.id,
        variantId: slide.variantId,
        reason: `slot_text_chars ${slotChars} > budget ${budget.maxSlotTextChars}`,
      });
    }
    if (slide.assets.length < budget.minAssetCount) {
      violations.push({
        slideId: slide.id,
        variantId: slide.variantId,
        reason: `asset_count ${slide.assets.length} < minimum ${budget.minAssetCount}`,
      });
    }
    if (budget.requireNotes && !slide.notes?.trim()) {
      violations.push({
        slideId: slide.id,
        variantId: slide.variantId,
        reason: "missing speaker notes",
      });
    }
  }

  return {
    version: "deck_quality_gates/v1",
    slideCount: deck.slides.length,
    violationCount: violations.length,
    passed: violations.length === 0,
    violations,
  };
}

async function main() {
  const [, , inputArg] = process.argv;
  if (!inputArg) {
    throw new Error("Usage: bun packages/backend/src/scripts/ppt-mvp/quality-gates.ts <deck-json>");
  }
  const inputPath = resolve(process.cwd(), inputArg);
  const deck = JSON.parse(await readFile(inputPath, "utf-8")) as DeckJson;
  const result = evaluate(deck);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
