import { createSignal, onCleanup, onMount } from "solid-js";

export interface SelectionState {
  text: string;
  start: number;
  end: number;
  /** Position relative to the textarea's offsetParent for toolbar placement */
  rect: { top: number; left: number; width: number };
}

/**
 * Reactive hook tracking textarea selection range and position.
 * Listens to mouseup and keyup events on the textarea (not selectionchange
 * on document -- that fires too frequently and doesn't reliably fire for
 * textareas in all browsers).
 *
 * Critical: Toolbar buttons must use onMouseDown with preventDefault()
 * to avoid textarea blur which would clear the selection.
 */
export function useTextSelection(
  textareaRef: () => HTMLTextAreaElement | undefined,
) {
  const [selection, setSelection] = createSignal<SelectionState | null>(null);

  function updateSelection() {
    const textarea = textareaRef();
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      setSelection(null);
      return;
    }

    const text = textarea.value.slice(start, end);
    const textareaRect = textarea.getBoundingClientRect();
    const parent = textarea.offsetParent;
    const parentRect = parent
      ? parent.getBoundingClientRect()
      : { top: 0, left: 0 };

    setSelection({
      text,
      start,
      end,
      rect: {
        top: textareaRect.top - parentRect.top,
        left: textareaRect.left - parentRect.left,
        width: textareaRect.width,
      },
    });
  }

  onMount(() => {
    const textarea = textareaRef();
    if (!textarea) return;

    const handler = () => updateSelection();
    textarea.addEventListener("mouseup", handler);
    textarea.addEventListener("keyup", handler);

    onCleanup(() => {
      textarea.removeEventListener("mouseup", handler);
      textarea.removeEventListener("keyup", handler);
    });
  });

  return selection;
}
