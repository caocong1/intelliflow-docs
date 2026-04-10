import { describe, expect, it } from "vitest";
import { shouldAutoSyncInputSources } from "./input-source-sync";

describe("shouldAutoSyncInputSources", () => {
  it("always auto-syncs desensitize nodes", () => {
    expect(
      shouldAutoSyncInputSources({
        type: "desensitize",
        categories: [],
        localModelId: null,
      }),
    ).toBe(true);
  });

  it("never auto-syncs restore nodes", () => {
    expect(
      shouldAutoSyncInputSources({
        type: "restore",
        pairedDesensitizeNodeId: "node_desens",
      }),
    ).toBe(false);

    expect(
      shouldAutoSyncInputSources({
        type: "restore",
        pairedDesensitizeNodeId: "node_desens",
        inputSources: [],
      }),
    ).toBe(false);
    expect(
      shouldAutoSyncInputSources({
        type: "restore",
        pairedDesensitizeNodeId: "node_desens",
        inputSources: [
          {
            sourceNodeId: "node_qa",
            outputId: "node_qa-namedoutput-qa_report",
            displayName: "质检报告",
          },
        ],
      }),
    ).toBe(false);
  });
});
