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
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div
            class={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
            role="alert"
          >
            {toast.message}
          </div>
        )}
      </For>
    </div>
  );
}
