/**
 * @vitest-environment jsdom
 */
import type { InputTransformConfig, NodeExecution } from "@intelliflow/shared";
import { createComponent } from "solid-js";
import { render } from "solid-js/web/dist/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InputTransformExecutor from "./InputTransformExecutor";

describe("InputTransformExecutor", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;
  let container: HTMLDivElement;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
    container = document.createElement("div");
    document.body.appendChild(container);
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    container?.remove();
  });

  it("registers a confirm action that persists form data before advance", async () => {
    const registerConfirmAction = vi.fn();
    const onDraftSave = vi.fn();

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, nodeExecution: { id: "node-exec-1" } }),
    });

    const nodeExecution: NodeExecution = {
      id: "node-exec-1",
      documentId: "doc-1",
      nodeId: "node_input",
      nodeLabel: "输入转换",
      nodeType: "input_transform",
      status: "in_progress",
      stepOrder: 0,
      executionRound: 1,
      isCurrent: true,
      inputData: null,
      outputData: null,
      selectedOutputKey: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: "2026-04-15T00:00:00.000Z",
      updatedAt: "2026-04-15T00:00:00.000Z",
    };

    const config: InputTransformConfig = {
      type: "input_transform",
      formFields: [
        {
          id: "field_ppt_request",
          machineKey: "ppt_request",
          label: "PPT生成需求",
          type: "textarea",
          required: true,
        },
      ],
    };

    const dispose = render(
      () =>
        createComponent(InputTransformExecutor, {
          nodeExecution,
          config,
          documentId: "doc-1",
          onDraftSave,
          readOnly: false,
          registerConfirmAction,
        }),
      container,
    );

    await Promise.resolve();

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    if (!textarea) {
      throw new Error("textarea not found");
    }
    textarea.value = "输入转换.PPT生成需求的实际内容";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    await Promise.resolve();

    const registeredAction = registerConfirmAction.mock.calls.at(-1)?.[0] as
      | (() => Promise<boolean>)
      | null;
    expect(typeof registeredAction).toBe("function");

    const shouldAdvance = await registeredAction?.();
    expect(shouldAdvance).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/runtime/doc-1/input-transform/node-exec-1/confirm",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      formData: {
        field_ppt_request: "输入转换.PPT生成需求的实际内容",
      },
      fileOutputs: [],
    });

    dispose();
  });
});
