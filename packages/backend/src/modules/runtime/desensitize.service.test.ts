import { describe, it, expect, vi } from "vitest";

vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../db/schema", () => ({
  desensitizeMappings: {},
  models: {},
  nodeExecutions: {},
  providers: {},
}));

import { buildConfirmOutputData, validateAndBuildDetectedItems } from "./desensitize.service";

import { extractStructuredJson } from "./desensitize.service";

describe("confirmDesensitization validation", () => {
  const baseItems = [
    { original: "张三", placeholder: "[NAME_1]", sensitiveType: "person_name" },
    { original: "13812345678", placeholder: "[PHONE_1]", sensitiveType: "phone_number" },
  ];

  it("rejects duplicate placeholders in items", () => {
    const dupeItems = [
      { original: "张三", placeholder: "[NAME_1]", sensitiveType: "person_name" },
      { original: "李四", placeholder: "[NAME_1]", sensitiveType: "person_name" },
    ];
    expect(() => validateAndBuildDetectedItems(dupeItems)).toThrow(
      "Duplicate placeholders in confirmed items",
    );
  });

  it("rejects duplicate placeholders in reviewSummary", () => {
    const summary = [
      { placeholder: "[NAME_1]", sensitiveType: "person_name", checked: true },
      { placeholder: "[NAME_1]", sensitiveType: "person_name", checked: false },
    ];
    expect(() => validateAndBuildDetectedItems(baseItems, summary)).toThrow(
      "Duplicate placeholders in reviewSummary",
    );
  });

  it("rejects mismatched reviewSummary: confirmed item not checked", () => {
    const summary = [
      { placeholder: "[NAME_1]", sensitiveType: "person_name", checked: false },
      { placeholder: "[PHONE_1]", sensitiveType: "phone_number", checked: true },
    ];
    expect(() => validateAndBuildDetectedItems(baseItems, summary)).toThrow(
      "Confirmed item [NAME_1] not marked as checked",
    );
  });

  it("rejects mismatched reviewSummary: checked item has no confirmed item", () => {
    const summary = [
      { placeholder: "[NAME_1]", sensitiveType: "person_name", checked: true },
      { placeholder: "[PHONE_1]", sensitiveType: "phone_number", checked: true },
      { placeholder: "[EMAIL_1]", sensitiveType: "email", checked: true },
    ];
    expect(() => validateAndBuildDetectedItems(baseItems, summary)).toThrow(
      "Summary checked item [EMAIL_1] has no corresponding confirmed item",
    );
  });

  it("falls back to all-checked summary when reviewSummary omitted", () => {
    const result = validateAndBuildDetectedItems(baseItems);
    expect(result).toEqual([
      { placeholder: "[NAME_1]", sensitiveType: "person_name", checked: true },
      { placeholder: "[PHONE_1]", sensitiveType: "phone_number", checked: true },
    ]);
  });

  it("outputData.detectedItems does not contain original field", () => {
    const result = validateAndBuildDetectedItems(baseItems);
    for (const item of result) {
      expect(item).not.toHaveProperty("original");
    }
  });
});

describe("background autoAdvance contract", () => {
  it("passes reviewSummary with all items checked=true", () => {
    const items = [{ original: "张三", placeholder: "[NAME_1]", sensitiveType: "person_name" }];
    const reviewSummary = items.map((it) => ({
      placeholder: it.placeholder,
      sensitiveType: it.sensitiveType,
      checked: true,
    }));
    const result = validateAndBuildDetectedItems(items, reviewSummary);
    expect(result.every((r) => r.checked)).toBe(true);
  });

  it("empty text produces detectedItems=[]", () => {
    const result = validateAndBuildDetectedItems([]);
    expect(result).toEqual([]);
  });
});

describe("buildConfirmOutputData", () => {
  const baseItems = [
    { original: "张三", placeholder: "[NAME_1]", sensitiveType: "person_name" },
    { original: "13812345678", placeholder: "[PHONE_1]", sensitiveType: "phone_number" },
  ];

  it("keeps the legacy flat outputData shape when sources are omitted", () => {
    const { confirmedItems, outputData } = buildConfirmOutputData(
      baseItems,
      "[NAME_1] 的电话是 [PHONE_1]",
    );

    expect(confirmedItems).toEqual(baseItems);
    expect(outputData).toEqual({
      text: "[NAME_1] 的电话是 [PHONE_1]",
      mappingCount: 2,
      detectedItems: [
        { placeholder: "[NAME_1]", sensitiveType: "person_name", checked: true },
        { placeholder: "[PHONE_1]", sensitiveType: "phone_number", checked: true },
      ],
      confirmedAt: expect.any(String),
    });
  });

  it("builds per-source outputData and aggregates confirmed items when sources are provided", () => {
    const { confirmedItems, outputData } = buildConfirmOutputData(
      [{ original: "legacy", placeholder: "[LEGACY_1]", sensitiveType: "legacy" }],
      "legacy text",
      undefined,
      {
        "source-a": {
          displayName: "正文",
          items: [baseItems[0]],
          sanitizedText: "[NAME_1] 已脱敏",
          reviewSummary: [{ placeholder: "[NAME_1]", sensitiveType: "person_name", checked: true }],
          files: [{ fileId: "file-1", name: "a.txt", desensitizedText: "[NAME_1] 已脱敏" }],
        },
        "source-b": {
          displayName: "电话",
          items: [baseItems[1]],
          sanitizedText: "电话 [PHONE_1]",
        },
      },
    );

    expect(confirmedItems).toEqual(baseItems);
    expect(outputData).toEqual({
      mappingCount: 2,
      detectedItems: [
        { placeholder: "[NAME_1]", sensitiveType: "person_name", checked: true },
        { placeholder: "[PHONE_1]", sensitiveType: "phone_number", checked: true },
      ],
      confirmedAt: expect.any(String),
      sources: {
        "source-a": {
          displayName: "正文",
          desensitizedText: "[NAME_1] 已脱敏",
          files: [{ fileId: "file-1", name: "a.txt", desensitizedText: "[NAME_1] 已脱敏" }],
        },
        "source-b": {
          displayName: "电话",
          desensitizedText: "电话 [PHONE_1]",
        },
      },
    });
  });

  it("validates duplicate placeholders across aggregated source items", () => {
    expect(() =>
      buildConfirmOutputData([], "", undefined, {
        "source-a": {
          displayName: "正文",
          items: [{ original: "张三", placeholder: "[NAME_1]", sensitiveType: "person_name" }],
          sanitizedText: "[NAME_1]",
        },
        "source-b": {
          displayName: "附件",
          items: [{ original: "李四", placeholder: "[NAME_1]", sensitiveType: "person_name" }],
          sanitizedText: "[NAME_1]",
        },
      }),
    ).toThrow("Duplicate placeholders in confirmed items");
  });
});

describe("extractStructuredJson", () => {
  it("extracts fenced json even when prefixed by markdown separators", () => {
    const raw = `---
\`\`\`json
[
  {
    "original": "韩总",
    "type": "person_name",
    "description": "人名"
  }
]
\`\`\``;

    expect(extractStructuredJson(raw)).toBe(`[
  {
    "original": "韩总",
    "type": "person_name",
    "description": "人名"
  }
]`);
  });
});
