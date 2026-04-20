import Ajv from "ajv";
import type { PagePlan } from "./types";

export const mvpPagePlanJsonSchema = {
  type: "object",
  properties: {
    version: { const: "page_plan/v1" },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        oneOf: [
          {
            properties: {
              pageId: { type: "string" },
              pageType: { const: "cover" },
              variantHint: { const: "cover_hero_image" },
              title: { type: "string", maxLength: 40 },
              subtitle: { type: "string", maxLength: 80 },
              eyebrow: { type: "string", maxLength: 50 },
              audienceLine: { type: "string", maxLength: 50 },
              speakerNote: { type: "string", maxLength: 300 },
            },
            required: ["pageId", "pageType", "variantHint", "title", "subtitle", "eyebrow", "audienceLine"],
            additionalProperties: false,
          },
          {
            properties: {
              pageId: { type: "string" },
              pageType: { const: "toc" },
              variantHint: { const: "toc_card_grid_8" },
              title: { type: "string", maxLength: 20 },
              eyebrow: { type: "string", maxLength: 40 },
              speakerNote: { type: "string", maxLength: 300 },
              items: {
                type: "array",
                maxItems: 8,
                items: {
                  type: "object",
                  properties: {
                    index: { type: "string", maxLength: 4 },
                    title: { type: "string", maxLength: 24 },
                    subtitle: { type: "string", maxLength: 50 },
                  },
                  required: ["index", "title", "subtitle"],
                  additionalProperties: false,
                },
              },
            },
            required: ["pageId", "pageType", "variantHint", "title", "eyebrow", "items"],
            additionalProperties: false,
          },
          {
            properties: {
              pageId: { type: "string" },
              pageType: { const: "comparison" },
              variantHint: { const: "comparison_dual_image" },
              title: { type: "string", maxLength: 36 },
              eyebrow: { type: "string", maxLength: 40 },
              leftTitle: { type: "string", maxLength: 24 },
              rightTitle: { type: "string", maxLength: 24 },
              leftBullets: { type: "array", maxItems: 3, items: { type: "string", maxLength: 40 } },
              rightBullets: { type: "array", maxItems: 3, items: { type: "string", maxLength: 40 } },
              speakerNote: { type: "string", maxLength: 300 },
            },
            required: ["pageId", "pageType", "variantHint", "title", "eyebrow", "leftTitle", "rightTitle", "leftBullets", "rightBullets"],
            additionalProperties: false,
          },
          {
            properties: {
              pageId: { type: "string" },
              pageType: { const: "timeline" },
              variantHint: { const: "timeline_horizontal_5" },
              title: { type: "string", maxLength: 32 },
              eyebrow: { type: "string", maxLength: 40 },
              summary: { type: "string", maxLength: 80 },
              speakerNote: { type: "string", maxLength: 300 },
              nodes: {
                type: "array",
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    year: { type: "string", maxLength: 6 },
                    title: { type: "string", maxLength: 24 },
                    detail: { type: "string", maxLength: 50 },
                  },
                  required: ["year", "title", "detail"],
                  additionalProperties: false,
                },
              },
            },
            required: ["pageId", "pageType", "variantHint", "title", "eyebrow", "summary", "nodes"],
            additionalProperties: false,
          },
          {
            properties: {
              pageId: { type: "string" },
              pageType: { const: "process" },
              variantHint: { const: "process_flow_5" },
              title: { type: "string", maxLength: 32 },
              eyebrow: { type: "string", maxLength: 40 },
              summary: { type: "string", maxLength: 80 },
              speakerNote: { type: "string", maxLength: 300 },
              steps: {
                type: "array",
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    index: { type: "string", maxLength: 4 },
                    title: { type: "string", maxLength: 24 },
                    detail: { type: "string", maxLength: 50 },
                  },
                  required: ["index", "title", "detail"],
                  additionalProperties: false,
                },
              },
            },
            required: ["pageId", "pageType", "variantHint", "title", "eyebrow", "summary", "steps"],
            additionalProperties: false,
          },
          {
            properties: {
              pageId: { type: "string" },
              pageType: { const: "device_overview" },
              variantHint: { const: "device_triptych_3" },
              title: { type: "string", maxLength: 32 },
              eyebrow: { type: "string", maxLength: 40 },
              summary: { type: "string", maxLength: 80 },
              speakerNote: { type: "string", maxLength: 300 },
              devices: {
                type: "array",
                maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", maxLength: 24 },
                    scenario: { type: "string", maxLength: 30 },
                    note: { type: "string", maxLength: 50 },
                  },
                  required: ["name", "scenario", "note"],
                  additionalProperties: false,
                },
              },
            },
            required: ["pageId", "pageType", "variantHint", "title", "eyebrow", "summary", "devices"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["version", "pages"],
  additionalProperties: false,
} as const;

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(mvpPagePlanJsonSchema);

export function validateMvpPagePlan(value: unknown): { valid: boolean; errors?: string[]; plan?: PagePlan } {
  const valid = validate(value);
  if (!valid) {
    return {
      valid: false,
      errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`),
    };
  }

  return {
    valid: true,
    plan: value as PagePlan,
  };
}
