import type { CanvasRenderModel } from "./types";

export type DeckJsonAssetRef = {
  slot: string;
  path?: string;
};

export type DeckJsonSlide = {
  id: string;
  pageType: string;
  familyId: string;
  variantId: string;
  narrativeRole: string;
  exportComplexity: string;
  notes?: string;
  slots: Record<string, unknown>;
  assets: DeckJsonAssetRef[];
};

export type DeckJson = {
  version: "deck_json/v1";
  deck: {
    title: string;
    language: string;
    familyId: string;
    familyName: string;
    notesMode: "ppt_speaker_notes";
    primaryExportStrategy: "native_editable" | "hybrid";
    pageSize: {
      layout: "LAYOUT_WIDE";
      widthInches: number;
      heightInches: number;
    };
    theme: CanvasRenderModel["theme"];
  };
  slides: DeckJsonSlide[];
};

export function buildDeckJson(
  canvas: CanvasRenderModel,
  exportPlan: {
    primaryStrategy: "native_editable" | "hybrid";
    notesMode: "ppt_speaker_notes";
    pageStrategies: Array<{
      pageId: string;
      variantId: string;
      strategy: "native_editable" | "hybrid";
      exportComplexity: string;
    }>;
  },
  resolvedAssets: Record<string, Record<string, string | undefined>>,
): DeckJson {
  return {
    version: "deck_json/v1",
    deck: {
      title: canvas.deckTitle,
      language: canvas.language,
      familyId: canvas.familyId,
      familyName: canvas.familyName,
      notesMode: exportPlan.notesMode,
      primaryExportStrategy: exportPlan.primaryStrategy,
      pageSize: {
        layout: "LAYOUT_WIDE",
        widthInches: 13.333,
        heightInches: 7.5,
      },
      theme: canvas.theme,
    },
    slides: canvas.pages.map((page) => {
      const frame = canvas.pageFrames.find((item) => item.pageId === page.pageId);
      if (!frame) {
        throw new Error(`Missing page frame for ${page.pageId}`);
      }

      const assets = Object.entries(resolvedAssets[page.pageId] ?? {}).map(([slot, path]) => ({
        slot,
        path,
      }));

      return {
        id: page.pageId,
        pageType: page.pageType,
        familyId: page.familyId,
        variantId: page.variantId,
        narrativeRole: frame.narrativeRole,
        exportComplexity: frame.exportComplexity,
        notes: page.speakerNote,
        slots: page.slots,
        assets,
      };
    }),
  };
}

