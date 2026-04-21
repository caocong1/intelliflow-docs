import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { HtmlFillPlan } from "./html-fill-plan-schema";
import {
  parseHtmlFidelityDeckContent,
  renderHtmlFidelityDeckToBuffer,
} from "./html-editable-runtime-adapter";

const REPO_ROOT = resolve(__dirname, "../../../../../..");

describe("parseHtmlFidelityDeckContent", () => {
  test("accepts a well-formed html_fidelity_deck/v1 object", () => {
    const deck = parseHtmlFidelityDeckContent({
      version: "html_fidelity_deck/v1",
      templateId: "622eee2ab7e6e",
      pages: [{ pageId: "p1", template: "cover", content: { title: "x" } }],
    });
    expect(deck).not.toBeNull();
    expect(deck?.templateId).toBe("622eee2ab7e6e");
    expect(deck?.pages[0].template).toBe("cover");
  });

  test("accepts a JSON string", () => {
    const deck = parseHtmlFidelityDeckContent(
      JSON.stringify({
        version: "html_fidelity_deck/v1",
        templateId: "622eee2ab7e6e",
        pages: [{ pageId: "p1", template: "cover", content: {} }],
      }),
    );
    expect(deck).not.toBeNull();
  });

  test("rejects mismatched version", () => {
    expect(
      parseHtmlFidelityDeckContent({
        version: "ppt_scene/v1",
        templateId: "x",
        pages: [{ pageId: "p1", template: "cover", content: {} }],
      }),
    ).toBeNull();
  });

  test("rejects missing pages", () => {
    expect(
      parseHtmlFidelityDeckContent({
        version: "html_fidelity_deck/v1",
        templateId: "x",
        pages: [],
      }),
    ).toBeNull();
  });

  test("rejects non-object content", () => {
    expect(parseHtmlFidelityDeckContent("not json")).toBeNull();
    expect(parseHtmlFidelityDeckContent(null)).toBeNull();
    expect(parseHtmlFidelityDeckContent(undefined)).toBeNull();
    expect(parseHtmlFidelityDeckContent([])).toBeNull();
  });

  test("rejects page missing content field", () => {
    expect(
      parseHtmlFidelityDeckContent({
        version: "html_fidelity_deck/v1",
        templateId: "x",
        pages: [{ pageId: "p1", template: "cover" }],
      }),
    ).toBeNull();
  });
});

describe("renderHtmlFidelityDeckToBuffer (with fill-plan overrides)", () => {
  // Fixture fill plans produced by a prior live html-roundtrip run.
  // Paths are stable because the artifacts are checked into /tmp between
  // sessions on the dev machine; skip the test when they're missing.
  const FIXTURE_DIR = "/tmp/intelliflow-html-roundtrip";
  const coverPlan = join(FIXTURE_DIR, "cover-live-v3.fillplan.json");
  const tocPlan = join(FIXTURE_DIR, "toc-live-v2.fillplan.json");
  const comparisonPlan = join(FIXTURE_DIR, "comparison-live.fillplan.json");

  const havePlans = [coverPlan, tocPlan, comparisonPlan].every((p) => existsSync(p));

  test.skipIf(!havePlans)(
    "builds a 3-slide editable pptx buffer from cover + toc + comparison plans",
    async () => {
      const deck: Parameters<typeof renderHtmlFidelityDeckToBuffer>[0] = {
        version: "html_fidelity_deck/v1",
        templateId: "622eee2ab7e6e",
        htmlStylesDir: join(REPO_ROOT, "docs/design/ppt-mvp/html-styles"),
        pages: [
          { pageId: "p1", template: "cover", content: {} },
          { pageId: "p2", template: "toc", content: {} },
          { pageId: "p3", template: "comparison", content: {} },
        ],
      };

      const overrides: Record<string, HtmlFillPlan> = {
        p1: JSON.parse(readFileSync(coverPlan, "utf8")) as HtmlFillPlan,
        p2: JSON.parse(readFileSync(tocPlan, "utf8")) as HtmlFillPlan,
        p3: JSON.parse(readFileSync(comparisonPlan, "utf8")) as HtmlFillPlan,
      };

      const scratch = mkdtempSync(join(tmpdir(), "html-fidelity-test-"));
      const result = await renderHtmlFidelityDeckToBuffer(deck, {
        scratchDir: scratch,
        fillPlanOverrides: overrides,
      });

      // Buffer is a real .pptx (starts with PK zip signature).
      expect(result.buffer.length).toBeGreaterThan(10_000);
      expect(result.buffer[0]).toBe(0x50); // 'P'
      expect(result.buffer[1]).toBe(0x4b); // 'K'
      expect(result.compositionSummary.totalSlides).toBe(3);
      expect(result.compositionSummary.source).toBe("structured");
      expect(result.renderMode).toBe("html_fidelity_622eee2ab7e6e");
      // All three pages should have role counts.
      const roles = result.compositionSummary.semanticRoleCounts;
      expect(roles.cover).toBe(1);
      expect(roles.toc).toBe(1);
      expect(roles.comparison).toBe(1);
    },
    120_000,
  );
});
