import type { ParentComponent } from "solid-js";
import { Show, onCleanup, onMount } from "solid-js";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  dialogClass?: string;
  bodyClass?: string;
};

const Modal: ParentComponent<ModalProps> = (props) => {
  let dialogRef: HTMLElement | undefined;
  let mouseDownOnBackdrop = false;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  const handleBackdropMouseDown = (e: MouseEvent) => {
    mouseDownOnBackdrop = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownOnBackdrop) {
      props.onClose();
    }
    mouseDownOnBackdrop = false;
  };

  const handleBackdropKeyDown = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity"
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
        onKeyDown={handleBackdropKeyDown}
        role="presentation"
      >
        <dialog
          ref={setDialogRef}
          open
          class={`relative inset-auto bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all p-0 m-0 max-h-[90vh] flex flex-col ${props.dialogClass ?? ""}`}
          aria-label={props.title}
        >
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 class="text-base font-semibold text-indigo-950">{props.title}</h2>
            <button
              type="button"
              onClick={props.onClose}
              class="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="关闭"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>关闭</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div class={props.bodyClass ?? "px-6 py-5 overflow-y-auto"}>{props.children}</div>
        </dialog>
      </div>
    </Show>
  );
};

export default Modal;
