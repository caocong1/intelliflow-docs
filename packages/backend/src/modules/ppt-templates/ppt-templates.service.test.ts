import { describe, expect, test } from "vitest";
import { validateParsedNativeTemplate } from "./ppt-template-validation";

describe("validateParsedNativeTemplate", () => {
  test("accepts ordinary design templates when profile recognition finds usable slides", () => {
    const result = validateParsedNativeTemplate({
      layouts: new Map(),
      allPlaceholders: new Set(),
      warnings: [],
      profile: {
        kind: "native_template_profile_v2",
        version: 2,
        summary: {
          slideCount: 2,
          placeholderTags: [],
          recognizedRoleCounts: {},
          semanticRoleCounts: { cover: 1, bullet_list: 1 },
          editableSlideCount: 2,
        },
        slides: [
          {
            slideId: 1,
            slideNumber: 1,
            layoutName: "封面",
            hasFullBleedImage: true,
            selectors: [],
            roleHints: ["image"],
            semanticRole: "cover",
            semanticRoleSource: "auto",
            semanticRoleConfidence: 0.9,
            semanticRoleCandidates: [{ role: "cover", score: 100 }],
            contentDensity: "sparse",
            autoUse: true,
            sampleTextSummary: ["部门复盘总结"],
            imageSlot: {
              selector: "image-1",
              position: { x: 0, y: 0, cx: 1, cy: 1 },
            },
            subtitleSlot: {
              selector: "subtitle-1",
              position: { x: 0, y: 0, cx: 1, cy: 1 },
            },
          },
          {
            slideId: 2,
            slideNumber: 2,
            layoutName: "正文",
            hasFullBleedImage: false,
            selectors: [],
            roleHints: ["content"],
            semanticRole: "bullet_list",
            semanticRoleSource: "auto",
            semanticRoleConfidence: 0.85,
            semanticRoleCandidates: [{ role: "bullet_list", score: 85 }],
            contentDensity: "medium",
            autoUse: true,
            sampleTextSummary: ["添加标题", "请您单击此处添加合适文字加以说明"],
            bodySlot: {
              selector: "body-2",
              position: { x: 0, y: 0, cx: 1, cy: 1 },
            },
          },
        ],
      },
    } as any);

    expect(result.usable).toBe(true);
    expect(result.details.hasProfileTitleLikeSlide).toBe(true);
    expect(result.details.hasProfileContentLikeSlide).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("rejects templates with neither placeholders nor usable recognized slides", () => {
    const result = validateParsedNativeTemplate({
      layouts: new Map(),
      allPlaceholders: new Set(),
      warnings: [],
      profile: {
        kind: "native_template_profile_v2",
        version: 2,
        summary: {
          slideCount: 1,
          placeholderTags: [],
          recognizedRoleCounts: { blank: 1 },
          semanticRoleCounts: {},
          editableSlideCount: 1,
        },
        slides: [
          {
            slideId: 1,
            slideNumber: 1,
            layoutName: "空白",
            hasFullBleedImage: false,
            selectors: [],
            roleHints: ["blank"],
            semanticRole: null,
            semanticRoleSource: "auto",
            semanticRoleConfidence: 0,
            semanticRoleCandidates: [],
            contentDensity: "sparse",
            autoUse: true,
            sampleTextSummary: [],
          },
        ],
      },
    } as any);

    expect(result.usable).toBe(false);
  });
});
