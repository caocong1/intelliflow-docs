import Ajv from "ajv";

export const SLOT_TYPES = [
  "title",
  "eyebrow",
  "subtitle",
  "body",
  "pill_label",
  "caption",
  "footer_note",
  "hero_bg",
  "brand_icon",
  "image",
  "decoration",
] as const;

export type SlotType = (typeof SLOT_TYPES)[number];

export const REPLACE_STRATEGIES = [
  "replace_runs",
  "replace_text",
  "replace_image",
  "grouped_merge",
  "preserve",
] as const;

export type ReplaceStrategy = (typeof REPLACE_STRATEGIES)[number];

export const TOPOLOGIES = [
  "cover_hero",
  "toc_list_4",
  "section_divider",
  "grid_2x2_symmetric",
  "col_2_symmetric",
  "row_3_cells",
  "row_4_cells",
  "row_5_flow",
  "single_col",
  "single_col_with_dual_image",
  "repeat_2",
  "repeat_3",
  "repeat_4",
  "closing",
  "other",
] as const;

export type Topology = (typeof TOPOLOGIES)[number];

export const templateSlotMapJsonSchema = {
  type: "object",
  properties: {
    version: { const: "template_slot_map/v1" },
    templateId: { type: "string", minLength: 1 },
    templatePath: { type: "string", minLength: 1 },
    slideIndex: { type: "integer", minimum: 1 },
    slideId: { type: "integer" },
    topology: { enum: [...TOPOLOGIES] },
    slots: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          slotId: { type: "string", minLength: 1 },
          slotType: { enum: [...SLOT_TYPES] },
          kind: { enum: ["text", "image", "group"] },
          selector: {
            type: "object",
            properties: {
              creationId: { type: "string", minLength: 1 },
              name: { type: "string", minLength: 1 },
            },
            required: ["creationId", "name"],
            additionalProperties: false,
          },
          bbox: {
            type: "object",
            properties: {
              x: { type: "integer" },
              y: { type: "integer" },
              w: { type: "integer" },
              h: { type: "integer" },
            },
            required: ["x", "y", "w", "h"],
            additionalProperties: false,
          },
          textSample: { type: "string" },
          mediaTarget: { type: "string" },
          replaceStrategy: { enum: [...REPLACE_STRATEGIES] },
          preserveGeometry: { const: true },
          maxWidthUnits: { type: "integer", minimum: 1 },
          maxLines: { type: "integer", minimum: 1 },
          minFontPt: { type: "integer", minimum: 1 },
          widthStretchEmu: { type: "integer" },
          heightStretchEmu: { type: "integer" },
          notes: { type: "string" },
        },
        required: ["slotId", "slotType", "kind", "selector", "replaceStrategy", "preserveGeometry"],
        additionalProperties: false,
      },
    },
  },
  required: ["version", "templateId", "templatePath", "slideIndex", "slots"],
  additionalProperties: false,
} as const;

export type TemplateSlotMap = {
  version: "template_slot_map/v1";
  templateId: string;
  templatePath: string;
  slideIndex: number;
  slideId?: number | string;
  topology?: Topology;
  slots: Array<{
    slotId: string;
    slotType: SlotType;
    kind: "text" | "image" | "group";
    selector: { creationId: string; name: string };
    bbox?: { x: number; y: number; w: number; h: number };
    textSample?: string;
    mediaTarget?: string;
    replaceStrategy: ReplaceStrategy;
    preserveGeometry: true;
    /** Max width per line in CJK-aware units (CJK=2, ASCII=1). Required for text slots that replace. */
    maxWidthUnits?: number;
    /** Max visible line count after auto-wrap. Defaults to 1 when omitted. */
    maxLines?: number;
    /** Shrink font size to this pt value when populating. Preserves geometry, trades visual balance. */
    minFontPt?: number;
    /** Physically stretch the shape's cx (EMU) at render time. Breaks strict preserve geometry; use sparingly. */
    widthStretchEmu?: number;
    /** Physically stretch the shape's cy (EMU) at render time. */
    heightStretchEmu?: number;
    notes?: string;
  }>;
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(templateSlotMapJsonSchema);

export function validateTemplateSlotMap(value: unknown): {
  valid: boolean;
  errors?: string[];
  data?: TemplateSlotMap;
} {
  const valid = validate(value);
  if (!valid) {
    return {
      valid: false,
      errors: (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`),
    };
  }
  return { valid: true, data: value as TemplateSlotMap };
}
