import { MVP_FAMILY, getMvpVariantDefinition } from "./family-library";
import type {
  CanvasPageFrame,
  CanvasRenderModel,
  FittedPageSlots,
  PresentationOutline,
  VisualBrief,
} from "./types";

type CanvasFamilyContext = {
  familyId: string;
  familyName: string;
  frameContract: CanvasPageFrame["frameContract"];
};

function buildPageFrame(page: FittedPageSlots, context: CanvasFamilyContext): CanvasPageFrame {
  const variant = getMvpVariantDefinition(page.variantId);
  if (!variant) {
    throw new Error(`Missing variant definition for ${page.variantId}`);
  }

  return {
    pageId: page.pageId,
    pageType: page.pageType,
    familyId: context.familyId,
    variantId: variant.variantId,
    narrativeRole: variant.narrativeRole,
    exportComplexity: variant.exportComplexity,
    frameContract: context.frameContract,
  };
}

export function buildCanvasRenderModel(
  outline: PresentationOutline,
  _brief: VisualBrief,
  pages: FittedPageSlots[],
  theme: CanvasRenderModel["theme"],
  familyContext?: Partial<CanvasFamilyContext>,
): CanvasRenderModel {
  const context: CanvasFamilyContext = {
    familyId: familyContext?.familyId ?? MVP_FAMILY.familyId,
    familyName: familyContext?.familyName ?? MVP_FAMILY.name,
    frameContract: familyContext?.frameContract ?? {
      backgroundMode: MVP_FAMILY.visualContract.backgroundMode,
      titleBlock: MVP_FAMILY.visualContract.titleBlock,
      notePolicy: MVP_FAMILY.visualContract.notePolicy,
    },
  };

  return {
    version: "canvas_render_model/v1",
    deckTitle: outline.title,
    language: outline.language,
    familyId: context.familyId,
    familyName: context.familyName,
    theme,
    pageFrames: pages.map((page) => buildPageFrame(page, context)),
    pages,
  };
}
