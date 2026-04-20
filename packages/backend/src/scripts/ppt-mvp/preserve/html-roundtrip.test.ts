import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  extractRegionsFromHtml,
  validateHtmlFillPlan,
} from "./html-fill-plan-schema";
import {
  applyFillPlanToHtml,
  generateHtmlFillPlan,
} from "./html-roundtrip";

const REPO_ROOT = resolve(__dirname, "../../../../../..");
const COVER_HTML = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/html-styles/622eee2ab7e6e/cover.html",
);

describe("preserve/html-fill-plan-schema", () => {
  test("extractRegionsFromHtml pulls data-region + budgets", () => {
    const html = readFileSync(COVER_HTML, "utf8");
    const regions = extractRegionsFromHtml(html);
    const byId = new Map(regions.map((r) => [r.regionId, r]));
    expect(byId.has("title")).toBe(true);
    expect(byId.has("eyebrow")).toBe(true);
    expect(byId.has("body")).toBe(true);
    expect(byId.has("pill_1")).toBe(true);
    expect(byId.has("pill_2")).toBe(true);
    // Cover's title has data-max-width-units="12" data-max-lines="1"
    expect(byId.get("title")?.maxWidthUnits).toBe(12);
    expect(byId.get("title")?.maxLines).toBe(1);
  });

  test("schema rejects missing required fields", () => {
    const r = validateHtmlFillPlan({ version: "html_to_ppt_fill_plan/v1" });
    expect(r.valid).toBe(false);
  });
});

describe("preserve/html-roundtrip", () => {
  test("generateHtmlFillPlan with mockResponse produces valid plan", async () => {
    const mock = JSON.stringify({
      version: "html_to_ppt_fill_plan/v1",
      templateId: "622eee2ab7e6e",
      htmlPath: "cover.html",
      pages: [
        {
          pageId: "p1",
          regionAssignments: [
            { regionId: "title", text: "测试标题" },
            { regionId: "pill_1", text: "测试 Pill" },
          ],
        },
      ],
    });
    const plan = await generateHtmlFillPlan({
      templateId: "622eee2ab7e6e",
      htmlPath: COVER_HTML,
      pageId: "p1",
      pageContent: { title: "X", eyebrow: "Y" },
      mockResponse: mock,
    });
    expect(plan.pages[0].regionAssignments.length).toBe(2);
  }, 20000);

  test("applyFillPlanToHtml substitutes into data-region elements", () => {
    const html = readFileSync(COVER_HTML, "utf8");
    const plan = {
      version: "html_to_ppt_fill_plan/v1" as const,
      templateId: "622eee2ab7e6e",
      htmlPath: "cover.html",
      pages: [
        {
          pageId: "p1",
          regionAssignments: [
            { regionId: "title", text: "NEW TITLE" },
            { regionId: "pill_1", text: "NEW PILL" },
            {
              regionId: "body",
              paragraphs: [{ text: "bullet A" }, { text: "bullet B" }],
            },
          ],
        },
      ],
    };
    const filled = applyFillPlanToHtml(html, plan, "p1");
    expect(filled).toContain("NEW TITLE");
    expect(filled).toContain("NEW PILL");
    expect(filled).toContain("<p>bullet A</p>");
    expect(filled).toContain("<p>bullet B</p>");
    expect(filled).not.toContain("无线网络科普");
  });
});
