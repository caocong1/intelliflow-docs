/**
 * @vitest-environment jsdom
 */
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/render-markdown", () => ({
  renderMarkdown: (content: string) => content,
}));

import ContentPreviewModal from "./ContentPreviewModal";

describe("ContentPreviewModal", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container?.remove();
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    vi.clearAllMocks();
  });

  it("renders as a true fullscreen dialog and locks page scroll", () => {
    const dispose = render(
      () =>
        createComponent(ContentPreviewModal, {
          content: "# 标题",
          title: "内容预览",
          onClose: vi.fn(),
        }),
      container,
    );

    const dialog = document.body.querySelector(
      '[data-preview-fullscreen="true"]',
    ) as HTMLDivElement | null;

    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain("fixed");
    expect(dialog?.className).toContain("inset-0");
    expect(dialog?.style.height).toBe("100dvh");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    dispose();

    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("closes when pressing Escape or clicking the close button", () => {
    const onClose = vi.fn();
    render(
      () =>
        createComponent(ContentPreviewModal, {
          content: "preview",
          title: "内容预览",
          onClose,
        }),
      container,
    );

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButton = document.body.querySelector(
      'button[aria-label="关闭预览"]',
    ) as HTMLButtonElement | null;

    expect(closeButton).not.toBeNull();
    closeButton?.click();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
