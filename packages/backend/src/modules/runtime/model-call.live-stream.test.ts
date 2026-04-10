import type { ModelOutput } from "@intelliflow/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyDelta,
  clearLiveSessionsForTest,
  createSession,
  flushNow,
  scheduleFlush,
  setModelStatus,
} from "./model-call-live-session";

const baseModels: Record<string, ModelOutput> = {
  "model-1": {
    modelId: "model-1",
    modelDisplayName: "Model One",
    content: "",
    status: "pending",
  },
};

afterEach(() => {
  clearLiveSessionsForTest();
  vi.useRealTimers();
});

describe("model-call live stream flushing", () => {
  it("serializes scheduled and immediate flushes without regressing content", async () => {
    vi.useFakeTimers();

    createSession({
      documentId: "doc-1",
      nodeExecutionId: "node-1",
      models: baseModels,
    });
    setModelStatus("node-1", "model-1", "streaming");

    const writes: string[] = [];
    let releaseFirstFlush: () => void = () => {};
    let callCount = 0;

    const flushFn = vi.fn(async (models: Record<string, ModelOutput>) => {
      writes.push(models["model-1"]?.content ?? "");
      if (callCount === 0) {
        callCount += 1;
        await new Promise<void>((resolve) => {
          releaseFirstFlush = resolve;
        });
      }
    });

    applyDelta("node-1", "model-1", "A");
    scheduleFlush("node-1", flushFn, 500);
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();

    applyDelta("node-1", "model-1", "B");
    const secondFlushPromise = flushNow("node-1", flushFn);
    await Promise.resolve();

    expect(flushFn).toHaveBeenCalledTimes(1);
    releaseFirstFlush();
    await secondFlushPromise;

    expect(writes).toEqual(["A", "AB"]);
  });
});
