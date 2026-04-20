import Ajv from "ajv";
import type { MvpPageType, MvpVariantId, NativeTemplate } from "./types";

const ALL_VARIANTS: readonly MvpVariantId[] = [
  "cover_hero_image",
  "toc_card_grid_8",
  "comparison_dual_image",
  "timeline_horizontal_5",
  "process_flow_5",
  "device_triptych_3",
];

const VARIANT_PAGE_TYPE: Record<MvpVariantId, MvpPageType> = {
  cover_hero_image: "cover",
  toc_card_grid_8: "toc",
  comparison_dual_image: "comparison",
  timeline_horizontal_5: "timeline",
  process_flow_5: "process",
  device_triptych_3: "device_overview",
};

const ajv = new Ajv({ allErrors: true });

export const nativeTemplateJsonSchema = {
  type: "object",
  properties: {
    version: { const: "native_template/v1" },
    templateId: { type: "string", minLength: 1, maxLength: 80 },
    familyId: { type: "string", minLength: 1, maxLength: 80 },
    familyName: { type: "string", minLength: 1, maxLength: 120 },
    source: {
      type: "object",
      oneOf: [
        {
          properties: {
            kind: { const: "hand_authored" },
            label: { type: "string", minLength: 1, maxLength: 120 },
          },
          required: ["kind", "label"],
          additionalProperties: false,
        },
        {
          properties: {
            kind: { const: "ingested_template" },
            templateJsonPath: { type: "string", minLength: 1, maxLength: 400 },
            presetId: { type: "string", minLength: 1, maxLength: 120 },
          },
          required: ["kind", "templateJsonPath"],
          additionalProperties: false,
        },
        {
          properties: {
            kind: { const: "visual_brief" },
            briefPath: { type: "string", minLength: 1, maxLength: 400 },
          },
          required: ["kind", "briefPath"],
          additionalProperties: false,
        },
      ],
    },
    tokens: {
      type: "object",
      properties: {
        colors: {
          type: "object",
          properties: {
            bg: { type: "string", pattern: "^[A-Fa-f0-9]{6}$" },
            surface: { type: "string", pattern: "^[A-Fa-f0-9]{6}$" },
            text: { type: "string", pattern: "^[A-Fa-f0-9]{6}$" },
            textMuted: { type: "string", pattern: "^[A-Fa-f0-9]{6}$" },
            primary: { type: "string", pattern: "^[A-Fa-f0-9]{6}$" },
            accent: { type: "string", pattern: "^[A-Fa-f0-9]{6}$" },
            outline: { type: "string", pattern: "^[A-Fa-f0-9]{6}$" },
            success: { type: "string", pattern: "^[A-Fa-f0-9]{6}$" },
          },
          required: ["bg", "surface", "text", "textMuted", "primary", "accent", "outline", "success"],
          additionalProperties: false,
        },
        typography: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 80 },
            body: { type: "string", minLength: 1, maxLength: 80 },
            mono: { type: "string", minLength: 1, maxLength: 80 },
            eyebrow: { type: "string", minLength: 1, maxLength: 80 },
          },
          required: ["title", "body", "mono"],
          additionalProperties: false,
        },
        spacing: {
          type: "object",
          properties: {
            pagePadding: { type: "number", minimum: 0 },
            sectionGap: { type: "number", minimum: 0 },
            cardGap: { type: "number", minimum: 0 },
            titleGap: { type: "number", minimum: 0 },
          },
          required: ["pagePadding", "sectionGap", "cardGap", "titleGap"],
          additionalProperties: false,
        },
        radius: {
          type: "object",
          properties: {
            card: { type: "number", minimum: 0 },
            pill: { type: "number", minimum: 0 },
            image: { type: "number", minimum: 0 },
          },
          required: ["card", "pill", "image"],
          additionalProperties: false,
        },
        stroke: {
          type: "object",
          properties: {
            thin: { type: "number", minimum: 0 },
            strong: { type: "number", minimum: 0 },
          },
          required: ["thin", "strong"],
          additionalProperties: false,
        },
        shadow: {
          type: "object",
          properties: {
            cardOpacity: { type: "number", minimum: 0 },
            cardBlur: { type: "number", minimum: 0 },
            cardOffset: { type: "number", minimum: 0 },
          },
          required: ["cardOpacity", "cardBlur", "cardOffset"],
          additionalProperties: false,
        },
      },
      required: ["colors", "typography", "spacing", "radius", "stroke", "shadow"],
      additionalProperties: false,
    },
    primitives: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1, maxLength: 80 },
          kind: {
            enum: [
              "title_block",
              "hero_panel",
              "info_rail",
              "card",
              "image_frame",
              "badge",
              "timeline_node",
              "process_step",
              "footer_summary",
            ],
          },
          description: { type: "string", minLength: 1, maxLength: 240 },
          requiredSlots: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 80 },
          },
          defaults: {
            type: "object",
            additionalProperties: {
              anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
            },
          },
        },
        required: ["id", "kind", "description"],
        additionalProperties: false,
      },
    },
    variantBindings: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          variantId: { enum: [...ALL_VARIANTS] },
          pageType: { enum: ["cover", "toc", "comparison", "timeline", "process", "device_overview"] },
          requiredPrimitives: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 80 },
          },
          optionalPrimitives: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 80 },
          },
          requiredAssetSlots: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 80 },
          },
          contentRules: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1, maxLength: 200 },
          },
          notesPolicy: { const: "speaker_notes_first" },
        },
        required: [
          "variantId",
          "pageType",
          "requiredPrimitives",
          "optionalPrimitives",
          "requiredAssetSlots",
          "contentRules",
          "notesPolicy",
        ],
        additionalProperties: false,
      },
    },
    assetRules: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          slot: { type: "string", minLength: 1, maxLength: 80 },
          usage: { enum: ["required", "optional"] },
          treatment: {
            enum: ["background_cover", "texture_overlay", "image_panel", "image_contain", "icon_badge"],
          },
          variantIds: {
            type: "array",
            minItems: 1,
            items: { enum: [...ALL_VARIANTS] },
          },
        },
        required: ["slot", "usage", "treatment", "variantIds"],
        additionalProperties: false,
      },
    },
    layoutBindings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          variantId: { enum: [...ALL_VARIANTS] },
          sourceSlideIndex: { type: "number", minimum: 1 },
          sourceSlidePath: { type: "string", minLength: 1, maxLength: 200 },
          sourceLayoutPath: { type: "string", minLength: 1, maxLength: 200 },
          sourceLayoutType: { type: "string", minLength: 1, maxLength: 80 },
          sourceLayoutName: { type: "string", minLength: 1, maxLength: 120 },
          candidateRole: { enum: ["cover_candidate", "toc_candidate", "content_candidate", "unknown"] },
          shapes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number", minimum: 0 },
                kind: { enum: ["text", "image", "group", "chart", "shape"] },
                name: { type: "string", minLength: 0, maxLength: 200 },
                x: { type: "number", minimum: 0 },
                y: { type: "number", minimum: 0 },
                w: { type: "number", minimum: 0 },
                h: { type: "number", minimum: 0 },
                placeholderType: { type: "string", minLength: 1, maxLength: 80 },
                textSample: { type: "string", minLength: 1, maxLength: 200 },
                mediaTarget: { type: "string", minLength: 1, maxLength: 200 },
              },
              required: ["id", "kind", "name", "x", "y", "w", "h"],
              additionalProperties: false,
            },
          },
        },
        required: ["variantId", "sourceSlideIndex", "sourceSlidePath", "shapes"],
        additionalProperties: false,
      },
    },
    notes: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 400 },
    },
  },
  required: ["version", "templateId", "familyId", "familyName", "source", "tokens", "primitives", "variantBindings", "assetRules", "layoutBindings", "notes"],
  additionalProperties: false,
} as const;

const validate = ajv.compile(nativeTemplateJsonSchema);

export function validateNativeTemplate(value: unknown): { valid: boolean; errors?: string[]; template?: NativeTemplate } {
  const valid = validate(value);
  if (!valid) {
    return {
      valid: false,
      errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`),
    };
  }

  const template = value as NativeTemplate;
  const errors: string[] = [];
  const primitiveIds = new Set<string>();
  for (const primitive of template.primitives) {
    if (primitiveIds.has(primitive.id)) {
      errors.push(`duplicate primitive id: ${primitive.id}`);
    }
    primitiveIds.add(primitive.id);
  }

  const seenVariants = new Set<MvpVariantId>();
  for (const binding of template.variantBindings) {
    if (seenVariants.has(binding.variantId)) {
      errors.push(`duplicate variant binding: ${binding.variantId}`);
    }
    seenVariants.add(binding.variantId);
    if (VARIANT_PAGE_TYPE[binding.variantId] !== binding.pageType) {
      errors.push(`variant ${binding.variantId} must bind to pageType ${VARIANT_PAGE_TYPE[binding.variantId]}`);
    }
    for (const primitiveId of [...binding.requiredPrimitives, ...binding.optionalPrimitives]) {
      if (!primitiveIds.has(primitiveId)) {
        errors.push(`variant ${binding.variantId} references missing primitive ${primitiveId}`);
      }
    }
  }

  for (const variantId of ALL_VARIANTS) {
    if (!seenVariants.has(variantId)) {
      errors.push(`missing variant binding: ${variantId}`);
    }
  }

  const seenLayoutBindings = new Set<MvpVariantId>();
  for (const binding of template.layoutBindings) {
    if (seenLayoutBindings.has(binding.variantId)) {
      errors.push(`duplicate layout binding: ${binding.variantId}`);
    }
    seenLayoutBindings.add(binding.variantId);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, template };
}
