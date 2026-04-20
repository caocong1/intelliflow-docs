import { describe, expect, test } from "vitest";
import { buildDeckJson } from "./deck-json";
import type { CanvasRenderModel } from "./types";
import { MVP_THEME } from "./variant-library";

describe("ppt-mvp deck json", () => {
  test("serializes canvas and assets into deck_json/v1", () => {
    const canvas: CanvasRenderModel = {
      version: "canvas_render_model/v1",
      deckTitle: "无线网络建设全流程指南",
      language: "zh-CN",
      familyId: "doubao_light_tech_v1",
      familyName: "Doubao Light Tech v1",
      theme: MVP_THEME,
      pageFrames: [
        {
          pageId: "p2",
          pageType: "toc",
          familyId: "doubao_light_tech_v1",
          variantId: "toc_card_grid_8",
          narrativeRole: "deck_index",
          exportComplexity: "native_editable",
          frameContract: {
            backgroundMode: "muted_texture",
            titleBlock: "top_left",
            notePolicy: "speaker_notes_first",
          },
        },
      ],
      pages: [
        {
          pageId: "p2",
          pageType: "toc",
          familyId: "doubao_light_tech_v1",
          variantId: "toc_card_grid_8",
          slots: {
            title: "目录",
          },
          warnings: [],
          speakerNote: "目录讲解",
        },
      ],
    };

    const result = buildDeckJson(
      canvas,
      {
        primaryStrategy: "native_editable",
        notesMode: "ppt_speaker_notes",
        pageStrategies: [
          {
            pageId: "p2",
            variantId: "toc_card_grid_8",
            strategy: "native_editable",
            exportComplexity: "native_editable",
          },
        ],
      },
      {
        p2: {
          bg_texture: "/tmp/bg.jpg",
        },
      },
    );

    expect(result.version).toBe("deck_json/v1");
    expect(result.deck.familyId).toBe("doubao_light_tech_v1");
    expect(result.slides[0]?.notes).toBe("目录讲解");
    expect(result.slides[0]?.assets[0]?.slot).toBe("bg_texture");
  });
});

