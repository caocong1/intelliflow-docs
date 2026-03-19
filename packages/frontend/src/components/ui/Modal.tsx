import type { ParentComponent } from "solid-js";
import { Show, onCleanup, onMount } from "solid-js";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

const Modal: ParentComponent<ModalProps> = (props) => {
  let dialogRef: HTMLElement | undefined;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  const handleBackdropKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Focus first input when modal opens
  const setDialogRef = (el: HTMLElement) => {
    dialogRef = el;
    setTimeout(() => {
      const firstInput = dialogRef?.querySelector<HTMLElement>(
        'input, select, textarea, button[type="submit"]',
      );
      firstInput?.focus();
    }, 50);
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity"
        onClick={handleBackdropClick}
        onKeyDown={handleBackdropKeyDown}
        role="presentation"
      >
        <dialog
          ref={setDialogRef}
          open
          class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all p-0"
          aria-label={props.title}
        >
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">{props.title}</h2>
            <button
              type="button"
              onClick={props.onClose}
              class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Close"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Close</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div class="px-6 py-4">{props.children}</div>
        </dialog>
      </div>
    </Show>
  );
};

export default Modal;
