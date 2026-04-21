import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { HtmlFillPlan } from "../../scripts/ppt-mvp/preserve/html-fill-plan-schema";
import {
  parseHtmlFidelityDeckContent,
  renderHtmlFidelityDeckToBuffer,
} from "./html-editable-adapter";

const REPO_ROOT = resolve(__dirname, "../../../../..");

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

  // 6-page fully-covered deck — exercises every HTML template currently
  // authored for the 622eee2ab7e6e family (cover/toc/comparison/timeline/
  // process/device). Skipped when any fixture is missing.
  const timelinePlan = join(FIXTURE_DIR, "timeline-live-v5.fillplan.json");
  const processPlan = join(FIXTURE_DIR, "process-live.fillplan.json");
  const devicePlan = join(FIXTURE_DIR, "device-live.fillplan.json");
  const haveSix = havePlans && [timelinePlan, processPlan, devicePlan].every((p) => existsSync(p));

  test.skipIf(!haveSix)(
    "builds a 6-slide editable pptx buffer covering every authored template",
    async () => {
      const deck: Parameters<typeof renderHtmlFidelityDeckToBuffer>[0] = {
        version: "html_fidelity_deck/v1",
        templateId: "622eee2ab7e6e",
        htmlStylesDir: join(REPO_ROOT, "docs/design/ppt-mvp/html-styles"),
        pages: [
          { pageId: "p1", template: "cover", content: {} },
          { pageId: "p2", template: "toc", content: {} },
          { pageId: "p3", template: "comparison", content: {} },
          { pageId: "p4", template: "timeline", content: {} },
          { pageId: "p5", template: "process", content: {} },
          { pageId: "p6", template: "device", content: {} },
        ],
      };
      const overrides: Record<string, HtmlFillPlan> = {
        p1: JSON.parse(readFileSync(coverPlan, "utf8")) as HtmlFillPlan,
        p2: JSON.parse(readFileSync(tocPlan, "utf8")) as HtmlFillPlan,
        p3: JSON.parse(readFileSync(comparisonPlan, "utf8")) as HtmlFillPlan,
        p4: JSON.parse(readFileSync(timelinePlan, "utf8")) as HtmlFillPlan,
        p5: JSON.parse(readFileSync(processPlan, "utf8")) as HtmlFillPlan,
        p6: JSON.parse(readFileSync(devicePlan, "utf8")) as HtmlFillPlan,
      };
      const scratch = mkdtempSync(join(tmpdir(), "html-fidelity-6page-test-"));
      const result = await renderHtmlFidelityDeckToBuffer(deck, {
        scratchDir: scratch,
        fillPlanOverrides: overrides,
      });
      expect(result.buffer.length).toBeGreaterThan(50_000);
      expect(result.compositionSummary.totalSlides).toBe(6);
      const roles = result.compositionSummary.semanticRoleCounts;
      expect(roles.cover).toBe(1);
      expect(roles.toc).toBe(1);
      expect(roles.comparison).toBe(1);
      expect(roles.timeline).toBe(1);
      // process + device should map to their specific roles now, not bullet_list.
      expect((roles as Record<string, number>).process).toBe(1);
      expect((roles as Record<string, number>).device_overview).toBe(1);
      expect((roles as Record<string, number>).bullet_list ?? 0).toBe(0);
    },
    240_000,
  );

  // 8-page Phase-2 deck — adds feature_grid + summary on top of the 6-page
  // core. This is the Phase 2.1 milestone check.
  const featureGridPlan = join(FIXTURE_DIR, "feature-grid-live.fillplan.json");
  const summaryPlan = join(FIXTURE_DIR, "summary-live.fillplan.json");
  const haveEight = haveSix && [featureGridPlan, summaryPlan].every((p) => existsSync(p));

  test.skipIf(!haveEight)(
    "builds an 8-slide editable pptx buffer with phase-2 templates",
    async () => {
      const deck: Parameters<typeof renderHtmlFidelityDeckToBuffer>[0] = {
        version: "html_fidelity_deck/v1",
        templateId: "622eee2ab7e6e",
        htmlStylesDir: join(REPO_ROOT, "docs/design/ppt-mvp/html-styles"),
        pages: [
          { pageId: "p1", template: "cover", content: {} },
          { pageId: "p2", template: "toc", content: {} },
          { pageId: "p3", template: "comparison", content: {} },
          { pageId: "p4", template: "timeline", content: {} },
          { pageId: "p5", template: "process", content: {} },
          { pageId: "p6", template: "device", content: {} },
          { pageId: "p7", template: "feature_grid", content: {} },
          { pageId: "p8", template: "summary", content: {} },
        ],
      };
      const overrides: Record<string, HtmlFillPlan> = {
        p1: JSON.parse(readFileSync(coverPlan, "utf8")) as HtmlFillPlan,
        p2: JSON.parse(readFileSync(tocPlan, "utf8")) as HtmlFillPlan,
        p3: JSON.parse(readFileSync(comparisonPlan, "utf8")) as HtmlFillPlan,
        p4: JSON.parse(readFileSync(timelinePlan, "utf8")) as HtmlFillPlan,
        p5: JSON.parse(readFileSync(processPlan, "utf8")) as HtmlFillPlan,
        p6: JSON.parse(readFileSync(devicePlan, "utf8")) as HtmlFillPlan,
        p7: JSON.parse(readFileSync(featureGridPlan, "utf8")) as HtmlFillPlan,
        p8: JSON.parse(readFileSync(summaryPlan, "utf8")) as HtmlFillPlan,
      };
      const scratch = mkdtempSync(join(tmpdir(), "html-fidelity-8page-test-"));
      const result = await renderHtmlFidelityDeckToBuffer(deck, {
        scratchDir: scratch,
        fillPlanOverrides: overrides,
      });
      expect(result.buffer.length).toBeGreaterThan(50_000);
      expect(result.compositionSummary.totalSlides).toBe(8);
      const roles = result.compositionSummary.semanticRoleCounts as Record<string, number>;
      expect(roles.cover).toBe(1);
      expect(roles.toc).toBe(1);
      expect(roles.comparison).toBe(1);
      expect(roles.timeline).toBe(1);
      expect(roles.process).toBe(1);
      expect(roles.device_overview).toBe(1);
      expect(roles.feature_grid).toBe(1);
      expect(roles.summary).toBe(1);
      expect(roles.bullet_list ?? 0).toBe(0);
    },
    300_000,
  );

  // 10-page Phase-2.2 deck — adds closing + section_break on top of Phase 2.1.
  const closingPlan = join(FIXTURE_DIR, "closing-live.fillplan.json");
  const sectionBreakPlan = join(FIXTURE_DIR, "section-break-live.fillplan.json");
  const haveTen = haveEight && [closingPlan, sectionBreakPlan].every((p) => existsSync(p));

  test.skipIf(!haveTen)(
    "builds a 10-slide editable pptx buffer with phase-2.2 templates",
    async () => {
      const deck: Parameters<typeof renderHtmlFidelityDeckToBuffer>[0] = {
        version: "html_fidelity_deck/v1",
        templateId: "622eee2ab7e6e",
        htmlStylesDir: join(REPO_ROOT, "docs/design/ppt-mvp/html-styles"),
        pages: [
          { pageId: "p1", template: "cover", content: {} },
          { pageId: "p2", template: "toc", content: {} },
          { pageId: "p3", template: "comparison", content: {} },
          { pageId: "p4", template: "timeline", content: {} },
          { pageId: "p5", template: "process", content: {} },
          { pageId: "p6", template: "device", content: {} },
          { pageId: "p7", template: "feature_grid", content: {} },
          { pageId: "p8", template: "summary", content: {} },
          { pageId: "p9", template: "section_break", content: {} },
          { pageId: "p10", template: "closing", content: {} },
        ],
      };
      const overrides: Record<string, HtmlFillPlan> = {
        p1: JSON.parse(readFileSync(coverPlan, "utf8")) as HtmlFillPlan,
        p2: JSON.parse(readFileSync(tocPlan, "utf8")) as HtmlFillPlan,
        p3: JSON.parse(readFileSync(comparisonPlan, "utf8")) as HtmlFillPlan,
        p4: JSON.parse(readFileSync(timelinePlan, "utf8")) as HtmlFillPlan,
        p5: JSON.parse(readFileSync(processPlan, "utf8")) as HtmlFillPlan,
        p6: JSON.parse(readFileSync(devicePlan, "utf8")) as HtmlFillPlan,
        p7: JSON.parse(readFileSync(featureGridPlan, "utf8")) as HtmlFillPlan,
        p8: JSON.parse(readFileSync(summaryPlan, "utf8")) as HtmlFillPlan,
        p9: JSON.parse(readFileSync(sectionBreakPlan, "utf8")) as HtmlFillPlan,
        p10: JSON.parse(readFileSync(closingPlan, "utf8")) as HtmlFillPlan,
      };
      const scratch = mkdtempSync(join(tmpdir(), "html-fidelity-10page-test-"));
      const result = await renderHtmlFidelityDeckToBuffer(deck, {
        scratchDir: scratch,
        fillPlanOverrides: overrides,
      });
      expect(result.buffer.length).toBeGreaterThan(50_000);
      expect(result.compositionSummary.totalSlides).toBe(10);
      const roles = result.compositionSummary.semanticRoleCounts as Record<string, number>;
      expect(roles.cover).toBe(1);
      expect(roles.closing).toBe(1);
      expect(roles.section_break).toBe(1);
      expect(roles.feature_grid).toBe(1);
      expect(roles.summary).toBe(1);
      expect(roles.bullet_list ?? 0).toBe(0);
    },
    360_000,
  );
});
