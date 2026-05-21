import { describe, expect, it } from "vitest";
import { buildDeckOutline, buildDeckStyleDna, reviewDeckCoherence } from "./deck-orchestrator";
import type { DeckPlan } from "./types";

describe("deck-orchestrator", () => {
  it("builds outline sections and narrative", () => {
    const deck = makeDeckPlan();
    const outline = buildDeckOutline(deck);
    expect(outline.narrative).toHaveLength(deck.slides.length);
    expect(outline.sections.length).toBeGreaterThanOrEqual(3);
  });

  it("detects dense runs and weak transitions", () => {
    const deck = makeDeckPlan();
    deck.slides[0].contentDensity = "high";
    deck.slides[1].contentDensity = "high";
    deck.slides[2].contentDensity = "high";
    deck.slides[3].speakerNotes = "没有承接语句";
    const review = reviewDeckCoherence(deck);
    expect(review.issues.length).toBeGreaterThan(0);
    expect(review.slideFixes.length).toBeGreaterThan(0);
  });

  it("infers compact spacing when dense slides dominate", () => {
    const deck = makeDeckPlan();
    for (let i = 0; i < 8; i += 1) deck.slides[i].contentDensity = "high";
    const dna = buildDeckStyleDna(deck);
    expect(dna.spacing).toBe("compact");
  });
});

function makeDeckPlan(): DeckPlan {
  const slides = Array.from({ length: 12 }).map((_, index) => ({
    id: `s-${index + 1}`,
    pageType: "strategy" as const,
    layoutPattern: `layout-${index + 1}`,
    title: `页面 ${index + 1}`,
    keyMessage: `要点 ${index + 1}`,
    contentBlocks: [{ body: `内容 ${index + 1}`, emphasis: "normal" as const }],
    visualPrompt: "clean abstract enterprise background, no text",
    speakerNotes: `承接页面 ${index}`,
    layoutIntent: "left aligned",
    contentDensity: "medium" as const,
    visualHierarchy: "title then points",
  }));
  return {
    title: "t",
    subtitle: "s",
    audience: "a",
    visualDirection: "formal consulting tech",
    theme: {
      palette: ["0B1220", "111827", "38BDF8", "F59E0B"],
      mood: "m",
      referenceKeywords: ["k"],
      visualMotif: "motif",
      paletteDominance: "dom",
    },
    slides,
  };
}
