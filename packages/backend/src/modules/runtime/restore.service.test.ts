import { describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../db/schema", () => ({
  desensitizeMappings: {},
  nodeExecutions: {},
}));

import { collectWhitelistedOutputParts } from "./restore.service";

describe("collectWhitelistedOutputParts", () => {
  it("collects allowed outputs from namedOutputs", () => {
    const parts = collectWhitelistedOutputParts(
      {
        namedOutputs: {
          form_fills: { content: "# 表单", format: "markdown" },
          qa_report: { content: "# 质检", format: "markdown" },
        },
      },
      new Set(["form_fills"]),
    );

    expect(parts).toEqual([{ outputId: "form_fills", text: "# 表单" }]);
  });

  it("falls back to parsing delimited selectedContent when namedOutputs is absent", () => {
    const parts = collectWhitelistedOutputParts(
      {
        selectedContent:
          "===OUTPUT:group1_delivery===\n# 第一章\n===END:group1_delivery===\n\n" +
          "===OUTPUT:group2_implementation===\n# 第二章\n===END:group2_implementation===",
      },
      new Set(["group1_delivery", "group2_implementation"]),
    );

    expect(parts).toEqual([
      { outputId: "group1_delivery", text: "# 第一章" },
      { outputId: "group2_implementation", text: "# 第二章" },
    ]);
  });

  it("deduplicates outputs already present in namedOutputs", () => {
    const parts = collectWhitelistedOutputParts(
      {
        namedOutputs: {
          form_fills: { content: "# 表单", format: "markdown" },
        },
        selectedContent:
          "===OUTPUT:form_fills===\n# 重复表单\n===END:form_fills===\n\n" +
          "===OUTPUT:group1_delivery===\n# 第一章\n===END:group1_delivery===",
      },
      new Set(["form_fills", "group1_delivery"]),
    );

    expect(parts).toEqual([
      { outputId: "form_fills", text: "# 表单" },
      { outputId: "group1_delivery", text: "# 第一章" },
    ]);
  });

  it("strips internal chapter marker comments from parsed text parts", () => {
    const parts = collectWhitelistedOutputParts(
      {
        selectedContent:
          "===OUTPUT:group1_delivery===\n" +
          "<!-- chapter:CH-01-01 -->\n## 供货方案\n<!-- /chapter:CH-01-01 -->\n" +
          "===END:group1_delivery===",
      },
      new Set(["group1_delivery"]),
    );

    expect(parts).toEqual([
      {
        outputId: "group1_delivery",
        text: "<!-- chapter:CH-01-01 -->\n## 供货方案\n<!-- /chapter:CH-01-01 -->",
      },
    ]);
  });
});
