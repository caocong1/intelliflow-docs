import { describe, expect, it } from "vitest";
import type { ModelCallConfig } from "@intelliflow/shared";
import { buildSkippedNodeOutputData } from "./skip-output.service";

describe("buildSkippedNodeOutputData", () => {
  it("materializes configured named outputs for skipped model_call nodes", () => {
    const config: ModelCallConfig = {
      type: "model_call",
      displayName: "关键页强化委员会",
      modelIds: ["model-a", "model-b"],
      modelNames: { "model-a": "Model A", "model-b": "Model B" },
      promptTemplate: "prompt",
      inputRefs: [],
      outputFormat: "text",
      enableUserSelectionOutput: true,
      namedOutputs: [
        {
          id: "slides_ready",
          name: "关键页强化版幻灯片",
          format: "json",
          outputPrompt: "json output",
        },
      ],
      skipStrategy: {
        bindings: {
          slides_ready: {
            mode: "inherit",
            sourceRef: {
              nodeId: "node_dedup",
              outputId: "slides_compact",
              variableName: "node_dedup.slides_compact",
            },
          },
        },
      },
    };

    const result = buildSkippedNodeOutputData({
      nodeId: "node_keypage",
      config,
      nodeExecs: [
        {
          nodeId: "node_dedup",
          outputData: {
            namedOutputs: {
              slides_compact: {
                content: '{"slides":[{"layout":"title","title":"封面"}]}',
              },
            },
          },
        },
      ],
      skipContext: "manual",
    });

    expect(result.outputData.namedOutputs).toMatchObject({
      slides_ready: {
        content: '{"slides":[{"layout":"title","title":"封面"}]}',
        format: "json",
      },
    });
    expect(result.outputData.outputItems).toMatchObject({
      selected__artifact__slides_ready: {
        content: '{"slides":[{"layout":"title","title":"封面"}]}',
      },
    });
    expect(result.outputData.selectedContent).toBe(
      '{"slides":[{"layout":"title","title":"封面"}]}',
    );
  });

  it("leaves skipped input outputs empty when bindings are configured as empty", () => {
    const result = buildSkippedNodeOutputData({
      nodeId: "node_feedback",
      config: {
        type: "input_transform",
        formFields: [
          {
            id: "field_feedback",
            type: "textarea",
            label: "补充意见",
            required: false,
            machineKey: "feedback",
          },
        ],
        skippable: true,
        skipStrategy: {
          bindings: {
            feedback: {
              mode: "empty",
            },
          },
        },
      },
      nodeExecs: [],
      skipContext: "manual",
    });

    expect(result.outputData.fieldsByKey).toBeUndefined();
    expect(result.outputData.text).toBeUndefined();
    expect(result.outputData.skipType).toBe("manual");
  });
});
