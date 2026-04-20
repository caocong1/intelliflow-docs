import type {
  ArchetypeSlotSchema,
  PageFamilyDefinition,
  PageFamilyId,
  VariantDefinition,
} from "./types";

export const MVP_FAMILY_ID: PageFamilyId = "doubao_light_tech_v1";

function defineVariant(
  variantId: VariantDefinition["variantId"],
  pageType: VariantDefinition["pageType"],
  narrativeRole: string,
  exportComplexity: VariantDefinition["exportComplexity"],
  slots: ArchetypeSlotSchema["slots"],
): VariantDefinition {
  return {
    variantId,
    familyId: MVP_FAMILY_ID,
    pageType,
    narrativeRole,
    exportComplexity,
    schema: {
      variantId,
      pageType,
      slots,
    },
  };
}

export const MVP_VARIANTS: VariantDefinition[] = [
  defineVariant("cover_hero_image", "cover", "deck_opening", "native_editable", [
    { name: "title", kind: "string", required: true, maxChars: 16 },
    { name: "subtitle", kind: "string", required: true, maxChars: 30 },
    { name: "eyebrow", kind: "string", required: true, maxChars: 36 },
    { name: "audienceLine", kind: "string", required: true, maxChars: 28 },
  ]),
  defineVariant("toc_card_grid_8", "toc", "deck_index", "native_editable", [
    { name: "title", kind: "string", required: true, maxChars: 10 },
    { name: "eyebrow", kind: "string", required: true, maxChars: 24 },
    { name: "items", kind: "tocItems", required: true, maxItems: 8 },
  ]),
  defineVariant("comparison_dual_image", "comparison", "core_argument", "native_editable", [
    { name: "title", kind: "string", required: true, maxChars: 22 },
    { name: "eyebrow", kind: "string", required: true, maxChars: 30 },
    { name: "leftTitle", kind: "string", required: true, maxChars: 16 },
    { name: "rightTitle", kind: "string", required: true, maxChars: 16 },
    { name: "leftBullets", kind: "stringArray", required: true, maxItems: 3, maxItemChars: 22 },
    { name: "rightBullets", kind: "stringArray", required: true, maxItems: 3, maxItemChars: 22 },
  ]),
  defineVariant("timeline_horizontal_5", "timeline", "technical_progression", "native_editable", [
    { name: "title", kind: "string", required: true, maxChars: 16 },
    { name: "eyebrow", kind: "string", required: true, maxChars: 32 },
    { name: "summary", kind: "string", required: true, maxChars: 56 },
    { name: "nodes", kind: "timelineNodes", required: true, maxItems: 5 },
  ]),
  defineVariant("process_flow_5", "process", "implementation_playbook", "native_editable", [
    { name: "title", kind: "string", required: true, maxChars: 18 },
    { name: "eyebrow", kind: "string", required: true, maxChars: 32 },
    { name: "summary", kind: "string", required: true, maxChars: 60 },
    { name: "steps", kind: "processSteps", required: true, maxItems: 5 },
  ]),
  defineVariant("device_triptych_3", "device_overview", "device_taxonomy", "native_editable", [
    { name: "title", kind: "string", required: true, maxChars: 18 },
    { name: "eyebrow", kind: "string", required: true, maxChars: 32 },
    { name: "summary", kind: "string", required: true, maxChars: 60 },
    { name: "devices", kind: "deviceItems", required: true, maxItems: 3 },
  ]),
];

export const MVP_VARIANT_SCHEMAS: ArchetypeSlotSchema[] = MVP_VARIANTS.map((variant) => variant.schema);

export const MVP_FAMILY: PageFamilyDefinition = {
  familyId: MVP_FAMILY_ID,
  name: "Doubao Light Tech v1",
  benchmarkSources: [
    "/Users/dongli/Downloads/无线网络建设科普方案.pptx",
    "/Users/dongli/Downloads/无线网络建设科普方案 (1).pptx",
  ],
  description: "浅色电路底纹、左上标题、大白卡、轻阴影、notes-first 的 family contract。",
  visualContract: {
    backgroundMode: "muted_texture",
    titleBlock: "top_left",
    notePolicy: "speaker_notes_first",
    cardStyle: "soft_white_cards",
    imageContainer: "white_panel_image",
  },
  variants: MVP_VARIANTS,
};

export function getMvpVariantDefinition(variantId: string): VariantDefinition | undefined {
  return MVP_VARIANTS.find((variant) => variant.variantId === variantId);
}
