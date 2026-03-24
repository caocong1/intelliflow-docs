import { For, createSignal } from "solid-js";

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

let nextId = 0;

const [toasts, setToasts] = createSignal<Toast[]>([]);

export function showToast(message: string, type: "success" | "error") {
  const id = nextId++;
  setToasts((prev) => [...prev, { id, message, type }]);

  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 3000);
}

export default function ToastContainer() {
  return (
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div
            class={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white animate-slide-in min-w-[240px] max-w-xs ${
              toast.type === "success" ? "bg-emerald-600" : "bg-red-500"
            }`}
            role="alert"
          >
            {toast.type === "success" ? (
              <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <title>成功</title>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
              </svg>
            ) : (
              <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <title>错误</title>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </For>
    </div>
  );
}
