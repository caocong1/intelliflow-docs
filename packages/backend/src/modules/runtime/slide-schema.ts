import Ajv from "ajv";
import { SLIDE_SEMANTIC_ROLES } from "../../../../shared/src/slide-types";

// ─── SlidePresentation JSON Schema (ajv format) ─────────────────────────────

const slideBaseProperties = {
  semanticRole: { type: "string", enum: [...SLIDE_SEMANTIC_ROLES] },
  sectionKey: { type: "string", maxLength: 120 },
  visualIntent: { type: "string", maxLength: 120 },
  notes: { type: "string", maxLength: 500 },
};

const slidePresentationSchema = {
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: {
        aspectRatio: { type: "string", enum: ["16:9", "4:3"] },
        language: { type: "string" },
      },
      additionalProperties: false,
    },
    slides: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        discriminator: { propertyName: "layout" },
        oneOf: [
          // TitleSlide
          {
            type: "object",
            properties: {
              layout: { const: "title" },
              title: { type: "string", maxLength: 60 },
              subtitle: { type: "string", maxLength: 120 },
              ...slideBaseProperties,
            },
            required: ["layout", "title"],
            additionalProperties: false,
          },
          // ContentSlide
          {
            type: "object",
            properties: {
              layout: { const: "content" },
              title: { type: "string", maxLength: 50 },
              bullets: {
                type: "array",
                maxItems: 8,
                items: { type: "string", maxLength: 120 },
              },
              ...slideBaseProperties,
            },
            required: ["layout", "title", "bullets"],
            additionalProperties: false,
          },
          // TwoColumnSlide
          {
            type: "object",
            properties: {
              layout: { const: "two_column" },
              title: { type: "string", maxLength: 50 },
              left: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  bullets: {
                    type: "array",
                    maxItems: 5,
                    items: { type: "string", maxLength: 80 },
                  },
                },
                required: ["bullets"],
                additionalProperties: false,
              },
              right: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  bullets: {
                    type: "array",
                    maxItems: 5,
                    items: { type: "string", maxLength: 80 },
                  },
                },
                required: ["bullets"],
                additionalProperties: false,
              },
              ...slideBaseProperties,
            },
            required: ["layout", "title", "left", "right"],
            additionalProperties: false,
          },
          // TableSlide
          {
            type: "object",
            properties: {
              layout: { const: "table" },
              title: { type: "string", maxLength: 50 },
              headers: {
                type: "array",
                maxItems: 6,
                items: { type: "string", maxLength: 30 },
              },
              rows: {
                type: "array",
                maxItems: 8,
                items: {
                  type: "array",
                  items: { type: "string", maxLength: 50 },
                },
              },
              ...slideBaseProperties,
            },
            required: ["layout", "title", "headers", "rows"],
            additionalProperties: false,
          },
          // ImageSlide
          {
            type: "object",
            properties: {
              layout: { const: "image" },
              title: { type: "string" },
              imageRef: { type: "string" },
              caption: { type: "string", maxLength: 100 },
              ...slideBaseProperties,
            },
            required: ["layout", "title"],
            additionalProperties: false,
          },
          // BlankSlide
          {
            type: "object",
            properties: {
              layout: { const: "blank" },
              elements: { type: "array" },
              ...slideBaseProperties,
            },
            required: ["layout"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["slides"],
  additionalProperties: false,
} as const;

// ─── Compiled validator ──────────────────────────────────────────────────────

const ajv = new Ajv({ allErrors: true, discriminator: true });
const validate = ajv.compile(slidePresentationSchema);

export function validateSlidePresentation(data: unknown): {
  valid: boolean;
  errors?: string[];
} {
  const valid = validate(data);
  if (valid) return { valid: true };

  const errors = (validate.errors ?? []).map((err) => {
    const path = err.instancePath || "/";
    return `${path}: ${err.message}`;
  });
  return { valid: false, errors };
}

/** Raw schema object — can be used as JSON Schema preset in model call config */
export { slidePresentationSchema };
