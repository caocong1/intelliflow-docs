import { describe, expect, test } from "vitest";
import { truncateText } from "./format-utils";

describe("truncateText", () => {
  test("returns text unchanged when shorter than maxLen", () => {
    expect(truncateText("hello", 10)).toBe("hello");
  });

  test("returns text unchanged when exactly maxLen", () => {
    expect(truncateText("hello", 5)).toBe("hello");
  });

  test("truncates and appends ellipsis when text exceeds maxLen", () => {
    expect(truncateText("hello", 4)).toBe("hel…");
  });

  test("returns ellipsis when maxLen is 1", () => {
    expect(truncateText("hello", 1)).toBe("…");
  });

  test("returns empty string when maxLen is 0", () => {
    expect(truncateText("hello", 0)).toBe("");
  });

  test("returns empty string when maxLen is negative", () => {
    expect(truncateText("hello", -1)).toBe("");
  });

  test("returns empty string for empty input", () => {
    expect(truncateText("", 5)).toBe("");
  });
});
