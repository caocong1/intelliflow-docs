import { describe, expect, it } from "vitest";
import { DEFAULT_PPT_STYLE_PACK_ID, isPptExportResultStale, normalizePptStylePackId } from "./ppt-export";

describe("ppt-export helpers", () => {
  it("normalizes missing style pack ids to the shared default", () => {
    expect(normalizePptStylePackId()).toBe(DEFAULT_PPT_STYLE_PACK_ID);
    expect(normalizePptStylePackId(null)).toBe(DEFAULT_PPT_STYLE_PACK_ID);
    expect(normalizePptStylePackId("minimal_gold")).toBe("minimal_gold");
  });

  it("does not mark default-style exports as stale when frontend selection is implicit", () => {
    expect(isPptExportResultStale(undefined, DEFAULT_PPT_STYLE_PACK_ID)).toBe(false);
    expect(isPptExportResultStale(null, DEFAULT_PPT_STYLE_PACK_ID)).toBe(false);
    expect(isPptExportResultStale("minimal_gold", DEFAULT_PPT_STYLE_PACK_ID)).toBe(true);
  });
});
