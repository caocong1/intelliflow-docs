/**
 * @vitest-environment jsdom
 */
import type { ModelOutput } from "@intelliflow/shared";
import { describe, expect, it } from "vitest";
import {
  applyModelCallStreamEvent,
  deriveModelCallExecutionPhase,
  hasInProgressModelOutputs,
  mergeModelOutputs,
} from "./ModelCallExecutor";

const baseModel = (overrides: Partial<ModelOutput> = {}): ModelOutput => ({
  modelId: "model-1",
  modelDisplayName: "Model One",
  content: "",
  status: "pending",
  ...overrides,
});

describe("ModelCallExecutor helpers", () => {
  it("keeps manual model-call nodes idle before generation starts", () => {
    expect(
      deriveModelCallExecutionPhase({
        models: {},
        nodeStatus: "in_progress",
        backgroundMode: false,
      }),
    ).toBe("idle");
  });

  it("switches background model-call nodes into polling before first snapshot", () => {
    expect(
      deriveModelCallExecutionPhase({
        models: {},
        nodeStatus: "in_progress",
        backgroundMode: true,
      }),
    ).toBe("polling");
  });

  it("detects in-progress outputs from pending or streaming models", () => {
    expect(hasInProgressModelOutputs({ "model-1": baseModel() })).toBe(true);
    expect(
      hasInProgressModelOutputs({
        "model-1": baseModel({ status: "completed", content: "done" }),
      }),
    ).toBe(false);
  });

  it("replaces local outputs with snapshot payloads", () => {
    const next = applyModelCallStreamEvent(
      { "model-1": baseModel({ content: "stale", status: "streaming" }) },
      {
        type: "snapshot",
        data: {
          models: {
            "model-2": {
              modelId: "model-2",
              modelDisplayName: "Model Two",
              content: "fresh",
              status: "streaming",
            },
          },
          selectedModelId: "model-2",
          done: false,
        },
      },
    );

    expect(next).toEqual({
      "model-2": {
        modelId: "model-2",
        modelDisplayName: "Model Two",
        content: "fresh",
        status: "streaming",
      },
    });
  });

  it("applies delta, complete, and error events to model outputs", () => {
    const afterDelta = applyModelCallStreamEvent(
      { "model-1": baseModel({ status: "streaming" }) },
      {
        type: "delta",
        modelId: "model-1",
        data: "hello",
        timestamp: "2026-04-09T00:00:00.000Z",
      },
    );
    const afterComplete = applyModelCallStreamEvent(afterDelta, {
      type: "complete",
      modelId: "model-1",
      data: "hello world",
      timestamp: "2026-04-09T00:00:01.000Z",
    });
    const afterError = applyModelCallStreamEvent(afterComplete, {
      type: "error",
      modelId: "model-1",
      data: "boom",
      timestamp: "2026-04-09T00:00:02.000Z",
    });

    expect(afterDelta["model-1"]).toMatchObject({
      content: "hello",
      status: "streaming",
    });
    expect(afterComplete["model-1"]).toMatchObject({
      content: "hello world",
      status: "completed",
    });
    expect(afterError["model-1"]).toMatchObject({
      content: "hello world",
      status: "failed",
      errorMessage: "boom",
    });
  });

  it("treats lingering streaming output as done once final output exists", () => {
    expect(
      deriveModelCallExecutionPhase({
        models: {
          "model-1": baseModel({
            status: "completed",
            content: "final text",
          }),
        },
        nodeStatus: "in_progress",
        backgroundMode: true,
      }),
    ).toBe("done");
  });

  describe("mergeModelOutputs", () => {
    it("returns prev reference untouched when nothing changed", () => {
      const prev = {
        "model-1": baseModel({ content: "hello", status: "streaming" }),
        "model-2": baseModel({
          modelId: "model-2",
          modelDisplayName: "Model Two",
          content: "world",
          status: "streaming",
        }),
      };
      const incoming = {
        "model-1": baseModel({ content: "hello", status: "streaming" }),
        "model-2": baseModel({
          modelId: "model-2",
          modelDisplayName: "Model Two",
          content: "world",
          status: "streaming",
        }),
      };

      const merged = mergeModelOutputs(prev, incoming);
      // Same reference → signal subscribers won't fire
      expect(merged).toBe(prev);
    });

    it("preserves references for unchanged models when others change", () => {
      const stableModel = baseModel({
        modelId: "model-1",
        content: "finished",
        status: "completed",
      });
      const prev = {
        "model-1": stableModel,
        "model-2": baseModel({
          modelId: "model-2",
          modelDisplayName: "Model Two",
          content: "old",
          status: "streaming",
        }),
      };
      const incoming = {
        "model-1": baseModel({
          modelId: "model-1",
          content: "finished",
          status: "completed",
        }),
        "model-2": baseModel({
          modelId: "model-2",
          modelDisplayName: "Model Two",
          content: "old + delta",
          status: "streaming",
        }),
      };

      const merged = mergeModelOutputs(prev, incoming);
      expect(merged).not.toBe(prev);
      // Unchanged model keeps its old reference — <For>/<Index> children stay
      expect(merged["model-1"]).toBe(stableModel);
      // Changed model gets a new reference with updated content
      expect(merged["model-2"]).not.toBe(prev["model-2"]);
      expect(merged["model-2"].content).toBe("old + delta");
    });

    it("adds new models and drops removed models from the merged result", () => {
      const prev = {
        "model-1": baseModel({ modelId: "model-1" }),
      };
      const incoming = {
        "model-2": baseModel({
          modelId: "model-2",
          modelDisplayName: "Model Two",
          content: "fresh",
          status: "streaming",
        }),
      };

      const merged = mergeModelOutputs(prev, incoming);
      expect(Object.keys(merged)).toEqual(["model-2"]);
      expect(merged["model-2"].content).toBe("fresh");
    });
  });
});
