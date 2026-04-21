import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { HtmlFillPlan } from "../../scripts/ppt-mvp/preserve/html-fill-plan-schema";
import { renderHtmlFidelityDeckToBuffer } from "./html-editable-adapter";
import { markdownToHtmlFidelityDeck } from "./html-fidelity-markdown-adapter";

const REPO_ROOT = resolve(__dirname, "../../../../..");

describe("markdownToHtmlFidelityDeck", () => {
  test("produces a valid HtmlFidelityDeck from a mock LLM response", async () => {
    const mock = JSON.stringify({
      version: "html_fidelity_deck/v1",
      templateId: "622eee2ab7e6e",
      pages: [
        {
          pageId: "p1",
          template: "cover",
          content: { title: "测试", subtitle: "s" },
        },
        {
          pageId: "p2",
          template: "toc",
          content: {
            title: "目录",
            items: [{ index: "01", title: "a", subtitle: "b" }],
          },
        },
      ],
    });
    const deck = await markdownToHtmlFidelityDeck({
      markdown: "主题：测试\n章节：\n- 目录\n",
      mockResponse: mock,
    });
    expect(deck.version).toBe("html_fidelity_deck/v1");
    expect(deck.templateId).toBe("622eee2ab7e6e");
    expect(deck.pages).toHaveLength(2);
    expect(deck.pages[0].template).toBe("cover");
    expect(deck.pages[1].template).toBe("toc");
  }, 10_000);

  test("forces caller-requested templateId even if LLM echoes wrong one", async () => {
    const mock = JSON.stringify({
      version: "html_fidelity_deck/v1",
      templateId: "wrong_id",
      pages: [
        { pageId: "p1", template: "cover", content: { title: "x" } },
      ],
    });
    const deck = await markdownToHtmlFidelityDeck({
      markdown: "anything",
      templateId: "622eee2ab7e6e",
      mockResponse: mock,
    });
    expect(deck.templateId).toBe("622eee2ab7e6e");
  }, 10_000);

  test("throws a helpful error when LLM produces non-schema output", async () => {
    const badMock = JSON.stringify({ not: "a deck" });
    await expect(
      markdownToHtmlFidelityDeck({
        markdown: "anything",
        mockResponse: badMock,
      }),
    ).rejects.toThrow(/did not parse as html_fidelity_deck/);
  }, 10_000);

  // End-to-end chain test: markdown → deck (mock LLM) → editable .pptx
  // buffer (using pre-existing fill-plan fixtures). Exercises the full
  // Phase 4 + Phase 3 + core renderer integration deterministically.
  const FIXTURE_DIR = "/tmp/intelliflow-html-roundtrip";
  const coverPlan = join(FIXTURE_DIR, "cover-live-v3.fillplan.json");
  const tocPlan = join(FIXTURE_DIR, "toc-live-v2.fillplan.json");
  const haveE2eFixtures = [coverPlan, tocPlan].every((p) => existsSync(p));

  test.skipIf(!haveE2eFixtures)(
    "E2E: markdown → deck → renderer → editable pptx buffer",
    async () => {
      // Step 1: markdown → deck (via mock LLM response)
      const deckMock = JSON.stringify({
        version: "html_fidelity_deck/v1",
        templateId: "622eee2ab7e6e",
        pages: [
          { pageId: "p1", template: "cover", content: {} },
          { pageId: "p2", template: "toc", content: {} },
        ],
      });
      const deck = await markdownToHtmlFidelityDeck({
        markdown: "主题：测试\n受众：E2E",
        mockResponse: deckMock,
      });
      expect(deck.pages).toHaveLength(2);

      // Step 2: render deck → editable buffer (using fixture fill plans)
      const overrides: Record<string, HtmlFillPlan> = {
        p1: JSON.parse(readFileSync(coverPlan, "utf8")) as HtmlFillPlan,
        p2: JSON.parse(readFileSync(tocPlan, "utf8")) as HtmlFillPlan,
      };
      const scratch = mkdtempSync(join(tmpdir(), "html-fidelity-e2e-"));
      const result = await renderHtmlFidelityDeckToBuffer(
        { ...deck, htmlStylesDir: join(REPO_ROOT, "docs/design/ppt-mvp/html-styles") },
        { scratchDir: scratch, fillPlanOverrides: overrides },
      );
      expect(result.buffer.length).toBeGreaterThan(10_000);
      expect(result.buffer[0]).toBe(0x50); // 'P'
      expect(result.buffer[1]).toBe(0x4b); // 'K'
      expect(result.compositionSummary.totalSlides).toBe(2);
      expect(result.renderMode).toBe("html_fidelity_622eee2ab7e6e");
    },
    120_000,
  );

  // Live smoke — skipped in CI / when no provider credentials exist.
  // Guarded by env so running the full suite on a laptop with DB creds
  // actually hits the LLM and validates the full chain.
  test.skipIf(process.env.HTML_FIDELITY_LIVE !== "1")(
    "LIVE: terse outline → valid multi-page deck via Bailian qwen3.6-plus",
    async () => {
      const deck = await markdownToHtmlFidelityDeck({
        markdown: [
          "主题：客户成功团队运营手册",
          "受众：CSM / 客户成功经理",
          "",
          "要覆盖的章节:",
          "- 目录（三大关键循环）",
          "- 目标设定 vs 结果导向对比",
          "- 客户旅程五个关键阶段: 启用 → 采用 → 价值实现 → 续约 → 推荐",
          "- 感谢页",
        ].join("\n"),
      });
      expect(deck.pages.length).toBeGreaterThanOrEqual(3);
      expect(deck.pages[0].template).toBe("cover");
    },
    180_000,
  );
});
