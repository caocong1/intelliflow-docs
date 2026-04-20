import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DeckJson } from "./deck-json";

type SlideMetrics = {
  id: string;
  pageType: string;
  variantId: string;
  slotTextChars: number;
  noteChars: number;
  assetCount: number;
  hasNotes: boolean;
};

function countChars(value: unknown): number {
  if (typeof value === "string") {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countChars(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce((sum, item) => sum + countChars(item), 0);
  }
  return 0;
}

function buildMetrics(deck: DeckJson) {
  const slides: SlideMetrics[] = deck.slides.map((slide) => ({
    id: slide.id,
    pageType: slide.pageType,
    variantId: slide.variantId,
    slotTextChars: countChars(slide.slots),
    noteChars: slide.notes?.length ?? 0,
    assetCount: slide.assets.length,
    hasNotes: Boolean(slide.notes?.trim()),
  }));

  const totalSlotChars = slides.reduce((sum, slide) => sum + slide.slotTextChars, 0);
  const totalNoteChars = slides.reduce((sum, slide) => sum + slide.noteChars, 0);

  return {
    version: "deck_quality_metrics/v1",
    slideCount: slides.length,
    notesCoverage: slides.length === 0 ? 0 : slides.filter((slide) => slide.hasNotes).length / slides.length,
    avgSlotTextCharsPerSlide: slides.length === 0 ? 0 : Math.round(totalSlotChars / slides.length),
    avgNoteCharsPerSlide: slides.length === 0 ? 0 : Math.round(totalNoteChars / slides.length),
    totalAssetCount: slides.reduce((sum, slide) => sum + slide.assetCount, 0),
    maxSlotTextChars: slides.reduce((max, slide) => Math.max(max, slide.slotTextChars), 0),
    slides,
  };
}

async function main() {
  const [, , inputArg] = process.argv;
  if (!inputArg) {
    throw new Error("Usage: bun packages/backend/src/scripts/ppt-mvp/quality-metrics.ts <deck-json>");
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const content = await readFile(inputPath, "utf-8");
  const deck = JSON.parse(content) as DeckJson;
  console.log(JSON.stringify(buildMetrics(deck), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

