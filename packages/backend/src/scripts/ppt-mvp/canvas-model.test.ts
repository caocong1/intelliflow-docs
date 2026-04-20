import { describe, expect, test } from "vitest";
import { buildCanvasRenderModel } from "./canvas-model";
import { MVP_THEME } from "./variant-library";
import type { FittedPageSlots, PresentationOutline, VisualBrief } from "./types";

describe("ppt-mvp canvas model", () => {
  test("builds page frames with family and export metadata", () => {
    const outline: PresentationOutline = {
      version: "presentation_outline/v1",
      title: "无线网络建设全流程指南",
      audience: "采购与 IT 负责人",
      language: "zh-CN",
      sections: [],
    };
    const brief: VisualBrief = {
      version: "visual_brief/v1",
      deckTone: "clean_green_editorial",
      colorMode: "light",
      imageLanguage: "illustration_first",
      iconLanguage: "minimal",
      shapeLanguage: "soft_white_cards",
      density: "medium",
      avoid: [],
    };
    const pages: FittedPageSlots[] = [
      {
        pageId: "p2",
        pageType: "toc",
        familyId: "doubao_light_tech_v1",
        variantId: "toc_card_grid_8",
        slots: {},
        warnings: [],
        speakerNote: "目录页讲解",
      },
    ];

    const canvas = buildCanvasRenderModel(outline, brief, pages, MVP_THEME);

    expect(canvas.familyId).toBe("doubao_light_tech_v1");
    expect(canvas.pageFrames).toHaveLength(1);
    expect(canvas.pageFrames[0]?.variantId).toBe("toc_card_grid_8");
    expect(canvas.pageFrames[0]?.narrativeRole).toBe("deck_index");
    expect(canvas.pageFrames[0]?.exportComplexity).toBe("native_editable");
  });

  test("allows overriding family context for template-driven builds", () => {
    const outline: PresentationOutline = {
      version: "presentation_outline/v1",
      title: "无线网络建设全流程指南",
      audience: "采购与 IT 负责人",
      language: "zh-CN",
      sections: [],
    };
    const brief: VisualBrief = {
      version: "visual_brief/v1",
      deckTone: "clean_green_editorial",
      colorMode: "light",
      imageLanguage: "illustration_first",
      iconLanguage: "minimal",
      shapeLanguage: "soft_white_cards",
      density: "medium",
      avoid: [],
    };
    const pages: FittedPageSlots[] = [
      {
        pageId: "p1",
        pageType: "cover",
        familyId: "ingested_blue_business",
        variantId: "cover_hero_image",
        slots: {},
        warnings: [],
      },
    ];

    const canvas = buildCanvasRenderModel(outline, brief, pages, MVP_THEME, {
      familyId: "ingested_blue_business",
      familyName: "Blue Business Native Template",
    });

    expect(canvas.familyId).toBe("ingested_blue_business");
    expect(canvas.familyName).toBe("Blue Business Native Template");
    expect(canvas.pageFrames[0]?.familyId).toBe("ingested_blue_business");
  });
});
