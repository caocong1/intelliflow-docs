import type { ModelOutput, NamedOutputDef } from "@intelliflow/shared";
import { describe, expect, it } from "vitest";
import {
  buildModelCallOutputData,
  buildSelectedModelOutputData,
  parseNamedOutputs,
} from "./model-call-output";

const namedOutputDefs: NamedOutputDef[] = [
  { id: "prd_v1", name: "PRD V1", format: "markdown" },
  { id: "open_items_v1", name: "未决事项", format: "markdown" },
  { id: "decision_log_v1", name: "决策日志", format: "markdown" },
];

function buildDelimitedContent(prefix: string): string {
  return [
    "===OUTPUT:prd_v1===",
    `# ${prefix} PRD`,
    "===END:prd_v1===",
    "===OUTPUT:open_items_v1===",
    `## ${prefix} Open Items`,
    "===END:open_items_v1===",
    "===OUTPUT:decision_log_v1===",
    `## ${prefix} Decision Log`,
    "===END:decision_log_v1===",
  ].join("\n");
}

describe("model-call output helpers", () => {
  it("parses all named outputs when delimiters are complete", () => {
    const parsed = parseNamedOutputs(buildDelimitedContent("Alpha"), namedOutputDefs);

    expect(parsed.fallback).toBe(false);
    expect(parsed.namedOutputs.prd_v1).toEqual({
      content: "# Alpha PRD",
      format: "markdown",
    });
    expect(parsed.namedOutputs.open_items_v1?.content).toContain("Alpha Open Items");
    expect(parsed.namedOutputs.decision_log_v1?.content).toContain("Alpha Decision Log");
  });

  it("rebuilds named outputs from the newly selected compare result", () => {
    const models: Record<string, ModelOutput> = {
      alpha: {
        modelId: "alpha",
        modelDisplayName: "Alpha Model",
        content: buildDelimitedContent("Alpha"),
        status: "completed",
      },
      beta: {
        modelId: "beta",
        modelDisplayName: "Beta Model",
        content: buildDelimitedContent("Beta"),
        status: "completed",
      },
    };

    const next = buildSelectedModelOutputData(
      {
        models,
        selectedContent: models.alpha.content,
        text: models.alpha.content,
        namedOutputs: {
          prd_v1: { content: "# Alpha PRD", format: "markdown" },
          open_items_v1: { content: "## Alpha Open Items", format: "markdown" },
          decision_log_v1: { content: "## Alpha Decision Log", format: "markdown" },
        },
        fallbackWarning: true,
      },
      ["beta"],
      {
        namedOutputs: namedOutputDefs,
        outputFormat: "markdown",
      },
    );

    expect(next.selectedOutputKey).toBe("beta");
    expect(next.outputData.selectedContent).toBe(models.beta.content);
    expect(next.outputData.text).toBe(models.beta.content);
    expect(next.outputData.namedOutputs).toMatchObject({
      prd_v1: { content: "# Beta PRD", format: "markdown", modelId: "beta" },
      open_items_v1: { content: "## Beta Open Items", format: "markdown", modelId: "beta" },
      decision_log_v1: {
        content: "## Beta Decision Log",
        format: "markdown",
        modelId: "beta",
      },
    });
    expect("fallbackWarning" in next.outputData).toBe(false);
  });

  it("builds aggregated selected artifact outputs when user selection output is enabled", () => {
    const models: Record<string, ModelOutput> = {
      alpha: {
        modelId: "alpha",
        modelDisplayName: "Alpha Model",
        content: buildDelimitedContent("Alpha"),
        status: "completed",
      },
      beta: {
        modelId: "beta",
        modelDisplayName: "Beta Model",
        content: buildDelimitedContent("Beta"),
        status: "completed",
      },
    };

    const next = buildModelCallOutputData({
      models,
      config: {
        namedOutputs: namedOutputDefs,
        outputFormat: "markdown",
        enableUserSelectionOutput: true,
      },
      selectedModelIds: ["alpha", "beta"],
    });

    expect(next.selectedOutputKey).toBe("alpha");
    expect(next.outputData.selectedModelIds).toEqual(["alpha", "beta"]);
    expect(next.outputData.outputItems).toMatchObject({
      selected__artifact__prd_v1: {
        kind: "selected_artifact",
        artifactId: "prd_v1",
        modelIds: ["alpha", "beta"],
      },
    });
    expect(next.outputData.namedOutputs).toEqual({
      prd_v1: {
        content: "### Alpha Model\n\n# Alpha PRD\n\n---\n\n### Beta Model\n\n# Beta PRD",
        format: "markdown",
        modelIds: ["alpha", "beta"],
      },
      open_items_v1: {
        content:
          "### Alpha Model\n\n## Alpha Open Items\n\n---\n\n### Beta Model\n\n## Beta Open Items",
        format: "markdown",
        modelIds: ["alpha", "beta"],
      },
      decision_log_v1: {
        content:
          "### Alpha Model\n\n## Alpha Decision Log\n\n---\n\n### Beta Model\n\n## Beta Decision Log",
        format: "markdown",
        modelIds: ["alpha", "beta"],
      },
    });
  });

  it("preserves manual feedback and exposes it as a flattened output item", () => {
    const models: Record<string, ModelOutput> = {
      alpha: {
        modelId: "alpha",
        modelDisplayName: "Alpha Model",
        content: buildDelimitedContent("Alpha"),
        status: "completed",
      },
    };

    const next = buildModelCallOutputData({
      models,
      config: {
        namedOutputs: namedOutputDefs,
        outputFormat: "markdown",
      },
      previousOutputData: {
        manualFeedback: {
          content: "请把 PRD 的风险说明写得更具体。",
          updatedAt: "2026-04-14T10:00:00.000Z",
          appliedAt: null,
        },
      },
      markManualFeedbackApplied: true,
    });

    expect(next.outputData.manualFeedback).toEqual({
      content: "请把 PRD 的风险说明写得更具体。",
      updatedAt: "2026-04-14T10:00:00.000Z",
      appliedAt: "2026-04-14T10:00:00.000Z",
    });
    expect(next.outputData.outputItems).toMatchObject({
      manual_feedback: {
        content: "请把 PRD 的风险说明写得更具体。",
        format: "text",
        kind: "manual_feedback",
      },
    });
  });
});
