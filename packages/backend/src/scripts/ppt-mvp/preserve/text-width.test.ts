import { describe, expect, test } from "vitest";
import { validateParagraphs, validateSingleLine, widthUnits } from "./text-width";

describe("widthUnits", () => {
  test("ASCII chars count as 1 each", () => {
    expect(widthUnits("hello")).toBe(5);
    expect(widthUnits("WIRELESS NETWORK")).toBe(16);
    expect(widthUnits("2026.04")).toBe(7);
  });

  test("CJK ideographs count as 2 each", () => {
    expect(widthUnits("无线")).toBe(4);
    expect(widthUnits("部门复盘总结")).toBe(12);
    expect(widthUnits("无线网络建设科普方案")).toBe(20);
  });

  test("fullwidth punctuation counts as 2", () => {
    expect(widthUnits("汇报人：")).toBe(8);
    expect(widthUnits("小包")).toBe(4);
  });

  test("mixed CJK + ASCII + spaces", () => {
    // 汇 报 人 ：   I T _   基 础 设 施 团 队
    // 2  2  2  2   1 1 1   2  2  2  2  2  2  = 23
    expect(widthUnits("汇报人：IT 基础设施团队")).toBe(23);
  });

  test("empty string is 0", () => {
    expect(widthUnits("")).toBe(0);
  });
});

describe("validateSingleLine", () => {
  test("fits under limit", () => {
    expect(validateSingleLine("hello", 10)).toEqual({ fits: true });
  });

  test("rejects over-wide", () => {
    const result = validateSingleLine("无线网络建设科普方案", 12);
    expect(result.fits).toBe(false);
    if (!result.fits) {
      expect(result.violations[0].actualWidthUnits).toBe(20);
      expect(result.violations[0].reason).toMatch(/20.*12/);
    }
  });
});

describe("validateParagraphs", () => {
  test("fits within width + line budget", () => {
    const result = validateParagraphs(
      [{ text: "场景选型 · 品牌选择" }, { text: "建设运维全指南" }],
      40,
      2,
    );
    expect(result.fits).toBe(true);
  });

  test("rejects when one paragraph exceeds width", () => {
    const result = validateParagraphs(
      [{ text: "无线网络建设科普方案无线网络建设科普方案" }],
      12,
      1,
    );
    expect(result.fits).toBe(false);
    if (!result.fits) {
      expect(result.violations.some((v) => /width/.test(v.reason))).toBe(true);
    }
  });

  test("rejects when line count exceeds maxLines", () => {
    const result = validateParagraphs(
      [{ text: "one" }, { text: "two" }, { text: "three" }],
      40,
      2,
    );
    expect(result.fits).toBe(false);
    if (!result.fits) {
      expect(result.actualLines).toBe(3);
      expect(result.violations.some((v) => /line count 3/.test(v.reason))).toBe(true);
    }
  });

  test("counts auto-wrap as additional lines", () => {
    const result = validateParagraphs(
      [{ text: "a".repeat(80) }],
      40,
      1,
    );
    expect(result.fits).toBe(false);
    if (!result.fits) {
      expect(result.actualLines).toBe(2);
    }
  });
});
