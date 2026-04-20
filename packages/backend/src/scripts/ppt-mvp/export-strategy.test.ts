import { describe, expect, test } from "vitest";
import { buildDeckExportPlan } from "./export-strategy";
import type { CanvasRenderModel } from "./types";
import { MVP_THEME } from "./variant-library";

describe("ppt-mvp export strategy", () => {
  test("keeps deck native when all variants are native editable", () => {
    const canvas: CanvasRenderModel = {
      version: "canvas_render_model/v1",
      deckTitle: "test",
      language: "zh-CN",
      familyId: "doubao_light_tech_v1",
      familyName: "Doubao Light Tech v1",
      theme: MVP_THEME,
      pageFrames: [
        {
          pageId: "p1",
          pageType: "cover",
          familyId: "doubao_light_tech_v1",
          variantId: "cover_hero_image",
          narrativeRole: "deck_opening",
          exportComplexity: "native_editable",
          frameContract: {
            backgroundMode: "muted_texture",
            titleBlock: "top_left",
            notePolicy: "speaker_notes_first",
          },
        },
      ],
      pages: [],
    };

    const plan = buildDeckExportPlan(canvas);
    expect(plan.primaryStrategy).toBe("native_editable");
    expect(plan.notesMode).toBe("ppt_speaker_notes");
    expect(plan.pageStrategies[0]?.strategy).toBe("native_editable");
  });

  test("switches deck to hybrid when a page is marked hybrid candidate", () => {
    const canvas: CanvasRenderModel = {
      version: "canvas_render_model/v1",
      deckTitle: "test",
      language: "zh-CN",
      familyId: "doubao_light_tech_v1",
      familyName: "Doubao Light Tech v1",
      theme: MVP_THEME,
      pageFrames: [
        {
          pageId: "p4",
          pageType: "timeline",
          familyId: "doubao_light_tech_v1",
          variantId: "timeline_horizontal_5",
          narrativeRole: "technical_progression",
          exportComplexity: "hybrid_candidate",
          frameContract: {
            backgroundMode: "muted_texture",
            titleBlock: "top_left",
            notePolicy: "speaker_notes_first",
          },
        },
      ],
      pages: [],
    };

    const plan = buildDeckExportPlan(canvas);
    expect(plan.primaryStrategy).toBe("hybrid");
    expect(plan.pageStrategies[0]?.strategy).toBe("hybrid");
  });
});
