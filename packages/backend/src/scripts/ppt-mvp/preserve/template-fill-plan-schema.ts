import Ajv from "ajv";

export const templateFillPlanJsonSchema = {
  type: "object",
  properties: {
    version: { const: "template_fill_plan/v1" },
    templateId: { type: "string", minLength: 1 },
    templatePath: { type: "string", minLength: 1 },
    slotMapDir: { type: "string", minLength: 1 },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          pageId: { type: "string", minLength: 1 },
          sourceSlideIndex: { type: "integer", minimum: 1 },
          mode: { const: "preserve" },
          expectedTopology: { type: "string" },
          slotAssignments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slotId: { type: "string", minLength: 1 },
                value: { type: "string" },
                paragraphs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      bold: { type: "boolean" },
                    },
                    required: ["text"],
                    additionalProperties: true,
                  },
                },
              },
              required: ["slotId"],
              additionalProperties: false,
            },
          },
          assetAssignments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slotId: { type: "string", minLength: 1 },
                mediaFile: { type: "string", minLength: 1 },
              },
              required: ["slotId", "mediaFile"],
              additionalProperties: false,
            },
          },
        },
        required: ["pageId", "sourceSlideIndex", "mode", "slotAssignments"],
        additionalProperties: false,
      },
    },
  },
  required: ["version", "templateId", "templatePath", "slotMapDir", "pages"],
  additionalProperties: false,
} as const;

export type TemplateFillPlan = {
  version: "template_fill_plan/v1";
  templateId: string;
  templatePath: string;
  slotMapDir: string;
  pages: Array<{
    pageId: string;
    sourceSlideIndex: number;
    mode: "preserve";
    expectedTopology?: string;
    slotAssignments: Array<{
      slotId: string;
      value?: string;
      paragraphs?: Array<{ text: string; bold?: boolean; [k: string]: unknown }>;
    }>;
    assetAssignments?: Array<{ slotId: string; mediaFile: string }>;
  }>;
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(templateFillPlanJsonSchema);

export function validateTemplateFillPlan(value: unknown): {
  valid: boolean;
  errors?: string[];
  data?: TemplateFillPlan;
} {
  const valid = validate(value);
  if (!valid) {
    return {
      valid: false,
      errors: (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`),
    };
  }
  return { valid: true, data: value as TemplateFillPlan };
}
