/**
 * @vitest-environment jsdom
 */
import { createComponent, createSignal } from "solid-js";
import { render } from "solid-js/web/dist/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/render-markdown", () => ({
  renderMarkdown: (content: string) => content,
}));

import NamedOutputCard from "./NamedOutputCard";

describe("NamedOutputCard", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container?.remove();
  });

  it("exits editing and resets content when switching artifact target", async () => {
    let setArtifactId!: (value: string) => void;
    let setArtifactName!: (value: string) => void;
    let setContent!: (value: string) => void;
    let setModelId!: (value: string) => void;

    const Harness = () => {
      const [artifactId, updateArtifactId] = createSignal("slides_final");
      const [artifactName, updateArtifactName] = createSignal("最终幻灯片");
      const [content, updateContent] = createSignal('{"title":"A"}');
      const [modelId, updateModelId] = createSignal("model-a");

      setArtifactId = updateArtifactId;
      setArtifactName = updateArtifactName;
      setContent = updateContent;
      setModelId = updateModelId;

      return createComponent(NamedOutputCard, {
        get artifactId() {
          return artifactId();
        },
        get artifactName() {
          return artifactName();
        },
        get content() {
          return content();
        },
        format: "text",
        get modelId() {
          return modelId();
        },
        readonly: false,
      });
    };

    const dispose = render(() => createComponent(Harness, {}), container);

    const editButton = container.querySelector("button") as HTMLButtonElement | null;
    expect(editButton?.textContent).toContain("编辑");
    editButton?.click();

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    if (!textarea) throw new Error("textarea not found");
    textarea.value = "draft content";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    setArtifactId("summary");
    setArtifactName("摘要");
    setContent("new target content");
    setModelId("model-b");
    await Promise.resolve();

    expect(container.querySelector("textarea")).toBeNull();
    expect(container.textContent).toContain("摘要");
    expect(container.textContent).toContain("new target content");
    expect(container.textContent).not.toContain("draft content");

    dispose();
  });

  it("blocks saving invalid JSON content and shows a parse error", async () => {
    const onContentChange = vi.fn();

    const dispose = render(
      () =>
        createComponent(NamedOutputCard, {
          artifactId: "slides_final",
          artifactName: "最终幻灯片",
          content: '{"title":"A"}',
          format: "json",
          modelId: "model-a",
          readonly: false,
          onContentChange,
        }),
      container,
    );

    const editButton = container.querySelector("button") as HTMLButtonElement | null;
    editButton?.click();

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    if (!textarea) throw new Error("textarea not found");
    textarea.value = '{"title":"broken\njson"';
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("保存"),
    );
    saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onContentChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain("JSON 语法错误");

    dispose();
  });
});
