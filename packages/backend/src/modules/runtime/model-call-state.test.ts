import type { ModelOutput } from "@intelliflow/shared";
import { describe, expect, it } from "vitest";
import {
  buildModelCallSnapshotPayload,
  getModelOutputsForDisplay,
  normalizeModelOutputsForCompletedReview,
  normalizeModelCallOutputDataForFailure,
} from "./model-call-state";

const baseModels: Record<string, ModelOutput> = {
  streaming: {
    modelId: "streaming",
    modelDisplayName: "Streaming Model",
    content: "partial",
    status: "streaming",
  },
  completed: {
    modelId: "completed",
    modelDisplayName: "Completed Model",
    content: "done",
    status: "completed",
  },
};

describe("model-call failed-state normalization", () => {
  it("maps pending/streaming models to failed for display when node execution failed", () => {
    const models = getModelOutputsForDisplay({
      outputData: { models: baseModels },
      nodeStatus: "failed",
      errorMessage: "服务器重启，任务中断",
    });

    expect(models.streaming).toMatchObject({
      status: "failed",
      errorMessage: "服务器重启，任务中断",
      content: "partial",
    });
    expect(models.completed).toMatchObject({
      status: "completed",
      content: "done",
    });
  });

  it("maps pending/streaming models to completed when final output already exists", () => {
    const models = getModelOutputsForDisplay({
      outputData: {
        models: baseModels,
        selectedContent: "final text",
        text: "final text",
      },
      nodeStatus: "in_progress",
      errorMessage: null,
    });

    expect(models.streaming).toMatchObject({
      status: "completed",
      content: "partial",
    });
    expect(models.completed).toMatchObject({
      status: "completed",
      content: "done",
    });
  });

  it("rewrites outputData.models in failure cleanup paths", () => {
    const outputData = normalizeModelCallOutputDataForFailure(
      { models: baseModels, text: null },
      "服务器重启，任务中断",
    );

    const models = outputData?.models as Record<string, ModelOutput>;
    expect(models.streaming?.status).toBe("failed");
    expect(models.streaming?.errorMessage).toBe("服务器重启，任务中断");
    expect(models.completed?.status).toBe("completed");
  });

  it("marks failed snapshots done and returns normalized models", () => {
    const snapshot = buildModelCallSnapshotPayload({
      outputData: { models: baseModels },
      nodeStatus: "failed",
      errorMessage: "服务器重启，任务中断",
      selectedOutputKey: null,
    });

    expect(snapshot).toEqual({
      models: {
        streaming: {
          modelId: "streaming",
          modelDisplayName: "Streaming Model",
          content: "partial",
          status: "failed",
          errorMessage: "服务器重启，任务中断",
        },
        completed: {
          modelId: "completed",
          modelDisplayName: "Completed Model",
          content: "done",
          status: "completed",
        },
      },
      selectedModelId: null,
      done: true,
    });
  });

  it("normalizes lingering streaming states after final output is selected", () => {
    expect(
      normalizeModelOutputsForCompletedReview({
        lingering: {
          modelId: "lingering",
          modelDisplayName: "Lingering",
          content: "done already",
          status: "streaming",
        },
      }),
    ).toEqual({
      lingering: {
        modelId: "lingering",
        modelDisplayName: "Lingering",
        content: "done already",
        status: "completed",
        errorMessage: undefined,
      },
    });
  });
});
