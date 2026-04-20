import { describe, expect, test } from "vitest";
import { callClaude, extractFencedCode, extractJson } from "./claude-client";

describe("claude-client mock mode", () => {
  test("returns supplied mockResponse and reports mock mode", async () => {
    const result = await callClaude({
      prompt: "ignored in mock mode",
      mock: true,
      mockResponse: "hello world",
    });

    expect(result.mode).toBe("mock");
    expect(result.content).toBe("hello world");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("throws when mock mode active but no mockResponse", async () => {
    await expect(
      callClaude({ prompt: "x", mock: true }),
    ).rejects.toThrow(/no mockResponse/);
  });
});

describe("extractFencedCode", () => {
  test("extracts a json fence", () => {
    const text = '```json\n{"a":1}\n```';
    expect(extractFencedCode(text, "json")).toBe('{"a":1}');
  });

  test("extracts an html fence with multi-line content", () => {
    const text = "Some prose\n```html\n<!DOCTYPE html>\n<html></html>\n```\nmore prose";
    expect(extractFencedCode(text, "html")).toContain("<!DOCTYPE html>");
  });

  test("returns null when no fence", () => {
    expect(extractFencedCode("plain prose", "json")).toBeNull();
  });
});

describe("extractJson", () => {
  test("parses fenced json", () => {
    const obj = extractJson<{ key: string }>('```json\n{"key":"value"}\n```');
    expect(obj.key).toBe("value");
  });

  test("parses bare json object with surrounding prose", () => {
    const obj = extractJson<{ n: number }>(
      'Here is the result: {"n":42}\nThanks!',
    );
    expect(obj.n).toBe(42);
  });

  test("parses json array", () => {
    const arr = extractJson<number[]>("```json\n[1,2,3]\n```");
    expect(arr).toEqual([1, 2, 3]);
  });

  test("throws on invalid input", () => {
    expect(() => extractJson("no json here at all")).toThrow();
  });
});
