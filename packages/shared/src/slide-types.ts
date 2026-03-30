// ─── Slide Schema types (canonical, shared between frontend & backend) ───────
// See docs/design/ppt-export-design.md §4 for full specification.

export interface SlidePresentation {
  metadata?: {
    aspectRatio?: "16:9" | "4:3";
    language?: string;
  };
  slides: Slide[];
}

export type Slide =
  | TitleSlide
  | ContentSlide
  | TwoColumnSlide
  | TableSlide
  | ImageSlide
  | BlankSlide;

export interface TitleSlide {
  layout: "title";
  title: string; // max 60 chars
  subtitle?: string; // max 120 chars
  notes?: string; // max 500 chars
}

export interface ContentSlide {
  layout: "content";
  title: string; // max 50 chars
  bullets: string[]; // max 8 items, each max 120 chars
  notes?: string;
}

export interface TwoColumnSlide {
  layout: "two_column";
  title: string; // max 50 chars
  left: { title?: string; bullets: string[] }; // max 5 items, 80 chars/item
  right: { title?: string; bullets: string[] }; // max 5 items, 80 chars/item
  notes?: string;
}

export interface TableSlide {
  layout: "table";
  title: string; // max 50 chars
  headers: string[]; // max 6 columns, 30 chars/col
  rows: string[][]; // max 8 rows, 50 chars/cell
  notes?: string;
}

export interface ImageSlide {
  layout: "image";
  title: string;
  imageRef?: string;
  caption?: string; // max 100 chars
  notes?: string;
}

export interface BlankSlide {
  layout: "blank";
  elements?: unknown[];
  notes?: string;
}

/** JSON Schema for SlidePresentation — usable as a model call JSON Schema preset */
export const slidePresentationJsonSchema = {
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
        oneOf: [
          {
            properties: {
              layout: { const: "title" },
              title: { type: "string", maxLength: 60 },
              subtitle: { type: "string", maxLength: 120 },
              notes: { type: "string", maxLength: 500 },
            },
            required: ["layout", "title"],
            additionalProperties: false,
          },
          {
            properties: {
              layout: { const: "content" },
              title: { type: "string", maxLength: 50 },
              bullets: { type: "array", maxItems: 8, items: { type: "string", maxLength: 120 } },
              notes: { type: "string", maxLength: 500 },
            },
            required: ["layout", "title", "bullets"],
            additionalProperties: false,
          },
          {
            properties: {
              layout: { const: "two_column" },
              title: { type: "string", maxLength: 50 },
              left: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  bullets: { type: "array", maxItems: 5, items: { type: "string", maxLength: 80 } },
                },
                required: ["bullets"],
                additionalProperties: false,
              },
              right: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  bullets: { type: "array", maxItems: 5, items: { type: "string", maxLength: 80 } },
                },
                required: ["bullets"],
                additionalProperties: false,
              },
              notes: { type: "string", maxLength: 500 },
            },
            required: ["layout", "title", "left", "right"],
            additionalProperties: false,
          },
          {
            properties: {
              layout: { const: "table" },
              title: { type: "string", maxLength: 50 },
              headers: { type: "array", maxItems: 6, items: { type: "string", maxLength: 30 } },
              rows: {
                type: "array",
                maxItems: 8,
                items: { type: "array", items: { type: "string", maxLength: 50 } },
              },
              notes: { type: "string", maxLength: 500 },
            },
            required: ["layout", "title", "headers", "rows"],
            additionalProperties: false,
          },
          {
            properties: {
              layout: { const: "image" },
              title: { type: "string" },
              imageRef: { type: "string" },
              caption: { type: "string", maxLength: 100 },
              notes: { type: "string", maxLength: 500 },
            },
            required: ["layout", "title"],
            additionalProperties: false,
          },
          {
            properties: {
              layout: { const: "blank" },
              elements: { type: "array" },
              notes: { type: "string", maxLength: 500 },
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
