// ─── Slide Schema types (canonical, shared between frontend & backend) ───────
// See docs/design/ppt-export-design.md §4 for full specification.

export const SLIDE_SEMANTIC_ROLES = [
  "cover",
  "toc",
  "section_break",
  "bullet_list",
  "comparison",
  "timeline",
  "table",
  "image_focus",
  "summary",
  "qna",
  "closing",
] as const;

export type SlideSemanticRole = (typeof SLIDE_SEMANTIC_ROLES)[number];

export interface SlideCommonFields {
  semanticRole?: SlideSemanticRole;
  sectionKey?: string;
  visualIntent?: string;
  notes?: string;
}

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

export interface TitleSlide extends SlideCommonFields {
  layout: "title";
  title: string; // max 60 chars
  subtitle?: string; // max 120 chars
}

export interface ContentSlide extends SlideCommonFields {
  layout: "content";
  title: string; // max 50 chars
  bullets: string[]; // max 8 items, each max 120 chars
}

export interface TwoColumnSlide extends SlideCommonFields {
  layout: "two_column";
  title: string; // max 50 chars
  left: { title?: string; bullets: string[] }; // max 5 items, 80 chars/item
  right: { title?: string; bullets: string[] }; // max 5 items, 80 chars/item
}

export interface TableSlide extends SlideCommonFields {
  layout: "table";
  title: string; // max 50 chars
  headers: string[]; // max 6 columns, 30 chars/col
  rows: string[][]; // max 8 rows, 50 chars/cell
}

export interface ImageSlide extends SlideCommonFields {
  layout: "image";
  title: string;
  imageRef?: string;
  caption?: string; // max 100 chars
}

export interface BlankSlide extends SlideCommonFields {
  layout: "blank";
  elements?: unknown[];
}

/** JSON Schema for SlidePresentation — usable as a model call JSON Schema preset */
const sharedSlideProperties = {
  semanticRole: { type: "string", enum: [...SLIDE_SEMANTIC_ROLES] },
  sectionKey: { type: "string", maxLength: 120 },
  visualIntent: { type: "string", maxLength: 120 },
  notes: { type: "string", maxLength: 500 },
} as const;

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
              ...sharedSlideProperties,
            },
            required: ["layout", "title"],
            additionalProperties: false,
          },
          {
            properties: {
              layout: { const: "content" },
              title: { type: "string", maxLength: 50 },
              bullets: { type: "array", maxItems: 8, items: { type: "string", maxLength: 120 } },
              ...sharedSlideProperties,
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
              ...sharedSlideProperties,
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
              ...sharedSlideProperties,
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
              ...sharedSlideProperties,
            },
            required: ["layout", "title"],
            additionalProperties: false,
          },
          {
            properties: {
              layout: { const: "blank" },
              elements: { type: "array" },
              ...sharedSlideProperties,
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
