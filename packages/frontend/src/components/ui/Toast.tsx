import { For, Show, createSignal } from "solid-js";

type ToastAction = {
  label: string;
  href: string;
};

type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  action?: ToastAction;
};

let nextId = 0;

const [toasts, setToasts] = createSignal<Toast[]>([]);

export function showToast(
  message: string,
  type: "success" | "error" | "info",
  action?: ToastAction,
) {
  const id = nextId++;
  setToasts((prev) => [...prev, { id, message, type, action }]);

  // Extended timeout for actionable toasts so user has time to click
  const timeout = action ? 5000 : 3000;
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, timeout);
}

function dismissToast(id: number) {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}

function toastBg(type: Toast["type"]): string {
  switch (type) {
    case "success":
      return "bg-emerald-600";
    case "error":
      return "bg-red-500";
    case "info":
      return "bg-blue-600";
  }
}

export default function ToastContainer() {
  return (
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div
            class={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white animate-slide-in min-w-[240px] max-w-xs ${toastBg(toast.type)}`}
            role="alert"
          >
            {toast.type === "success" ? (
              <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <title>成功</title>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
              </svg>
            ) : toast.type === "error" ? (
              <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <title>错误</title>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
              </svg>
            ) : (
              <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <title>信息</title>
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" />
              </svg>
            )}
            <div class="flex flex-col gap-1 min-w-0">
              <span>{toast.message}</span>
              <Show when={toast.action}>
                {(action) => (
                  <a
                    href={action().href}
                    onClick={(e) => {
                      e.preventDefault();
                      dismissToast(toast.id);
                      window.location.href = action().href;
                    }}
                    class="text-xs underline underline-offset-2 opacity-90 hover:opacity-100 cursor-pointer"
                  >
                    {action().label}
                  </a>
                )}
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
