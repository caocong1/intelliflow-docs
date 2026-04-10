import type { ModelCallLiveEvent, ModelOutput } from "@intelliflow/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  broadcast,
  buildSnapshotEvent,
  clearLiveSessionsForTest,
  createSession,
  disposeSessionLater,
  getSession,
  getSessionSnapshot,
  markDone,
  subscribe,
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

describe("model-call live session store", () => {
  it("creates a session and returns snapshot payloads", () => {
    createSession({
      documentId: "doc-1",
      nodeExecutionId: "node-1",
      models: baseModels,
    });

    expect(getSession("node-1")).not.toBeNull();
    expect(getSessionSnapshot("node-1")).toEqual({
      models: baseModels,
      selectedModelId: null,
      done: false,
    });
    expect(buildSnapshotEvent("node-1")).toEqual({
      type: "snapshot",
      data: {
        models: baseModels,
        selectedModelId: null,
        done: false,
      },
    });
  });

  it("broadcasts events to subscribers and stops after unsubscribe", () => {
    createSession({
      documentId: "doc-1",
      nodeExecutionId: "node-1",
      models: baseModels,
    });

    const events: ModelCallLiveEvent[] = [];
    const unsubscribe = subscribe("node-1", (event) => {
      events.push(event);
    });

    broadcast("node-1", {
      type: "status",
      modelId: "model-1",
      data: "streaming",
      timestamp: "2026-04-09T00:00:00.000Z",
    });
    unsubscribe?.();
    broadcast("node-1", {
      type: "delta",
      modelId: "model-1",
      data: "ignored",
      timestamp: "2026-04-09T00:00:01.000Z",
    });

    expect(events).toEqual([
      {
        type: "status",
        modelId: "model-1",
        data: "streaming",
        timestamp: "2026-04-09T00:00:00.000Z",
      },
    ]);
  });

  it("marks sessions done and disposes them after ttl", async () => {
    vi.useFakeTimers();

    createSession({
      documentId: "doc-1",
      nodeExecutionId: "node-1",
      models: baseModels,
    });
    markDone("node-1", "completed");
    disposeSessionLater("node-1", 1000);

    expect(getSessionSnapshot("node-1")?.done).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(getSession("node-1")).toBeNull();
  });
});
