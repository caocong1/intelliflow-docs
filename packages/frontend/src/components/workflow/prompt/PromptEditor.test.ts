/**
 * @vitest-environment jsdom
 */
import type { VariableRef } from "@intelliflow/shared";
import { createComponent, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FlowNodeData } from "../../../lib/flow-engine/types";
import PromptEditor from "./PromptEditor";

function flushTimers() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createUpstreamNode(): FlowNodeData {
  return {
    id: "node-1",
    type: "model_call",
    position: { x: 0, y: 0 },
    size: { width: 320, height: 160 },
    sourceHandle: "right",
    targetHandle: "left",
    data: {
      nodeType: "model_call",
      label: "上游节点",
      config: {
        type: "model_call",
        promptTemplate: "",
        modelIds: [],
      } as FlowNodeData["data"]["config"],
      outputs: [
        {
          id: "output-1",
          name: "摘要",
          segmentKey: "summary",
          category: "model",
        },
      ],
    },
  };
}

describe("PromptEditor", () => {
  let container: HTMLDivElement | undefined;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: () => {},
    });
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    container?.remove();
    container = undefined;
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
      return;
    }
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: undefined,
    });
  });

  it("inserts the picked output at the saved caret position after the picker steals focus", async () => {
    const upstreamNodes = [createUpstreamNode()];
    const availableVariables: VariableRef[] = [
      {
        nodeId: "node-1",
        outputId: "summary",
        variableName: "node-1.summary",
      },
    ];
    let latestValue = "alpha beta";

    function TestHarness() {
      const [value, setValue] = createSignal(latestValue);

      return createComponent(PromptEditor, {
        get value() {
          return value();
        },
        availableVariables,
        upstreamNodes,
        onChange: (nextValue: string) => {
          latestValue = nextValue;
          setValue(nextValue);
        },
      });
    }

    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(() => createComponent(TestHarness, {}), container);

    await flushTimers();

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement | null;
    expect(editor).not.toBeNull();
    if (!editor) {
      throw new Error("editor not found");
    }

    const textNode = editor.firstChild as Text | null;
    expect(textNode?.nodeType).toBe(Node.TEXT_NODE);
    if (!textNode) {
      throw new Error("editor text node not found");
    }

    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    const openButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("插入节点输出"),
    ) as HTMLButtonElement | undefined;
    expect(openButton).toBeDefined();
    if (!openButton) {
      throw new Error("open picker button not found");
    }

    openButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    openButton.click();
    await flushTimers();

    // Emulate the modal taking focus away from the editor.
    window.getSelection()?.removeAllRanges();

    const outputButton = document.querySelector(
      '[data-picker-key="node-1.summary"]',
    ) as HTMLButtonElement | null;
    expect(outputButton).not.toBeNull();
    if (!outputButton) {
      throw new Error("picker output button not found");
    }

    outputButton.click();
    await flushTimers();
    await flushTimers();

    expect(latestValue).toBe("alpha {{node-1.summary}}beta");
    await flushTimers();

    const updatedEditor = container.querySelector(
      '[contenteditable="true"]',
    ) as HTMLDivElement | null;
    expect(updatedEditor).not.toBeNull();
    expect(updatedEditor?.querySelector('[data-var="node-1.summary"]')).not.toBeNull();

    dispose();
  });
});
