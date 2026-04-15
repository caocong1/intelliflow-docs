import { describe, expect, test } from "vitest";
import {
  extractNativeTemplateProfile,
  mergeNativeTemplateProfiles,
  type NativeTemplateProfile,
} from "./native-template-profile";

function createProfile(): NativeTemplateProfile {
  return {
    kind: "native_template_profile_v2",
    version: 2,
    summary: {
      slideCount: 2,
      placeholderTags: ["TITLE", "BODY"],
      recognizedRoleCounts: { title: 1, content: 1 },
      semanticRoleCounts: { cover: 1, bullet_list: 1 },
      editableSlideCount: 2,
    },
    slides: [
      {
        slideId: 1,
        slideNumber: 1,
        layoutName: "封面",
        hasFullBleedImage: false,
        selectors: [],
        roleHints: ["title"],
        semanticRole: "cover",
        semanticRoleSource: "auto",
        semanticRoleConfidence: 0.9,
        semanticRoleCandidates: [{ role: "cover", score: 100 }],
        contentDensity: "sparse",
        autoUse: true,
        sampleTextSummary: ["输入标题文字"],
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
        semanticRoleConfidence: 0.8,
        semanticRoleCandidates: [{ role: "bullet_list", score: 80 }],
        contentDensity: "medium",
        autoUse: true,
        sampleTextSummary: ["您的内容打在这里"],
        bodySlot: {
          selector: "body",
          position: { x: 1, y: 1, cx: 1, cy: 1 },
        },
      },
    ],
  };
}

describe("native template profile v2", () => {
  test("mergeNativeTemplateProfiles preserves manual semantic role and slot overrides", () => {
    const autoProfile = createProfile();
    const existingProfile = createProfile();
    existingProfile.slides[1] = {
      ...existingProfile.slides[1],
      semanticRole: "summary",
      semanticRoleSource: "manual",
      autoUse: false,
      slotOverrides: { titleSlot: "bodySlot" },
    };

    const merged = mergeNativeTemplateProfiles(autoProfile, existingProfile);
    expect(merged.slides[1].semanticRole).toBe("summary");
    expect(merged.slides[1].semanticRoleSource).toBe("manual");
    expect(merged.slides[1].autoUse).toBe(false);
    expect(merged.slides[1].slotOverrides).toEqual({ titleSlot: "bodySlot" });
  });

  test("extractNativeTemplateProfile migrates v1 payloads into v2", () => {
    const legacy = {
      kind: "native_template_profile_v1",
      version: 1,
      slides: [
        {
          slideId: 1,
          slideNumber: 1,
          layoutName: "空白",
          hasFullBleedImage: false,
          selectors: [],
          roleHints: ["title"],
        },
      ],
    };

    const extracted = extractNativeTemplateProfile(legacy);
    expect(extracted?.kind).toBe("native_template_profile_v2");
    expect(extracted?.version).toBe(2);
    expect(extracted?.slides[0].semanticRole).toBeTruthy();
  });
});

