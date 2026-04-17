import { describe, expect, it } from "vitest";

import {
  RAW_RESPONSE_ARTIFACT_ID,
  diagnoseModelArtifacts,
} from "./model-call-artifact-diagnostics";

const namedOutputDefs = [
  { id: "slides_draft", name: "幻灯片初稿", format: "json" as const },
  { id: "draft_risks", name: "初稿风险", format: "markdown" as const },
  { id: "draft_change_focus", name: "精修焦点", format: "json" as const },
];

describe("diagnoseModelArtifacts", () => {
  it("treats fully parsed named outputs as selectable", () => {
    const result = diagnoseModelArtifacts({
      namedOutputDefs,
      outputs: {
        slides_draft: { content: "{}", format: "json" },
        draft_risks: { content: "# risks", format: "markdown" },
        draft_change_focus: { content: "{}", format: "json" },
      },
      rawContent: "raw",
    });

    expect(result.isSelectable).toBe(true);
    expect(result.issue).toBeUndefined();
    expect(result.rawArtifact).toBeUndefined();
    expect(result.parsedArtifacts).toHaveLength(3);
  });

  it("flags fallback-only outputs and exposes the raw response", () => {
    const result = diagnoseModelArtifacts({
      namedOutputDefs,
      outputs: {
        _default: { content: "raw fallback", format: "text" },
      },
      rawContent: "raw fallback",
    });

    expect(result.isSelectable).toBe(false);
    expect(result.issue?.kind).toBe("fallback_only");
    expect(result.rawArtifact).toEqual({
      artifactId: RAW_RESPONSE_ARTIFACT_ID,
      artifactName: "原始响应（解析异常）",
      content: "raw fallback",
      format: "text",
    });
  });

  it("flags partial outputs and preserves parsed artifacts", () => {
    const result = diagnoseModelArtifacts({
      namedOutputDefs,
      outputs: {
        slides_draft: { content: "{}", format: "json" },
        draft_risks: { content: "# risks", format: "markdown" },
      },
      rawContent: "raw response with delimiters",
    });

    expect(result.isSelectable).toBe(false);
    expect(result.issue?.kind).toBe("partial");
    expect(result.issue?.sourceMeta).toContain("2/3");
    expect(result.parsedArtifacts).toHaveLength(2);
    expect(result.rawArtifact?.artifactId).toBe(RAW_RESPONSE_ARTIFACT_ID);
  });
});
