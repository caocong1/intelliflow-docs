import Ajv from "ajv";

export const htmlFillPlanJsonSchema = {
  type: "object",
  properties: {
    version: { const: "html_to_ppt_fill_plan/v1" },
    templateId: { type: "string", minLength: 1 },
    htmlPath: { type: "string", minLength: 1 },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          pageId: { type: "string", minLength: 1 },
          regionAssignments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                regionId: { type: "string", minLength: 1 },
                text: { type: "string" },
                paragraphs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { text: { type: "string" } },
                    required: ["text"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["regionId"],
              additionalProperties: false,
            },
          },
        },
        required: ["pageId", "regionAssignments"],
        additionalProperties: false,
      },
    },
  },
  required: ["version", "templateId", "htmlPath", "pages"],
  additionalProperties: false,
} as const;

export type HtmlFillPlan = {
  version: "html_to_ppt_fill_plan/v1";
  templateId: string;
  htmlPath: string;
  pages: Array<{
    pageId: string;
    regionAssignments: Array<{
      regionId: string;
      text?: string;
      paragraphs?: Array<{ text: string }>;
    }>;
  }>;
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(htmlFillPlanJsonSchema);

export function validateHtmlFillPlan(value: unknown): {
  valid: boolean;
  errors?: string[];
  data?: HtmlFillPlan;
} {
  const valid = validate(value);
  if (!valid) {
    return {
      valid: false,
      errors: (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`),
    };
  }
  return { valid: true, data: value as HtmlFillPlan };
}

export type RegionDescriptor = {
  regionId: string;
  maxWidthUnits?: number;
  maxLines?: number;
  originalText?: string;
};

/**
 * Extract `data-region` / `data-max-width-units` / `data-max-lines` from
 * HTML. Regex-based — good enough since our template-style HTML is
 * hand-authored and simple.
 */
export function extractRegionsFromHtml(html: string): RegionDescriptor[] {
  const out: RegionDescriptor[] = [];
  const tagRe = /<(\w+)\b([^>]*)\bdata-region="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g;
  for (const m of html.matchAll(tagRe)) {
    const attrs = `${m[2]}${m[4]}`;
    const widthMatch = attrs.match(/\bdata-max-width-units="(\d+)"/);
    const linesMatch = attrs.match(/\bdata-max-lines="(\d+)"/);
    // Strip nested tags + whitespace collapse — gives an approximate original text.
    const innerText = m[5]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out.push({
      regionId: m[3],
      maxWidthUnits: widthMatch ? Number(widthMatch[1]) : undefined,
      maxLines: linesMatch ? Number(linesMatch[1]) : undefined,
      originalText: innerText || undefined,
    });
  }
  return out;
}
