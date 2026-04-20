import type { CanvasRenderModel, DeckExportPlan, PageExportStrategy } from "./types";

function resolvePageStrategy(
  exportComplexity: CanvasRenderModel["pageFrames"][number]["exportComplexity"],
): PageExportStrategy {
  return exportComplexity === "hybrid_candidate" ? "hybrid" : "native_editable";
}

export function buildDeckExportPlan(canvas: CanvasRenderModel): DeckExportPlan {
  const pageStrategies = canvas.pageFrames.map((frame) => ({
    pageId: frame.pageId,
    variantId: frame.variantId,
    strategy: resolvePageStrategy(frame.exportComplexity),
    exportComplexity: frame.exportComplexity,
  }));

  return {
    primaryStrategy: pageStrategies.some((page) => page.strategy === "hybrid")
      ? "hybrid"
      : "native_editable",
    notesMode: "ppt_speaker_notes",
    pageStrategies,
  };
}

