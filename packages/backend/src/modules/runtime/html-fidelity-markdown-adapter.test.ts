import { describe, expect, test } from "vitest";
import { markdownToHtmlFidelityDeck } from "./html-fidelity-markdown-adapter";

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
