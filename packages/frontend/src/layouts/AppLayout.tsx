import { Navigate } from "@solidjs/router";
import type { ParentComponent } from "solid-js";
import { Show } from "solid-js";
import Sidebar from "../components/nav/Sidebar";
import { useAuth } from "../contexts/auth";

const AppLayout: ParentComponent = (props) => {
  const auth = useAuth();

  return (
    <Show
      when={!auth.loading()}
      fallback={
        <div class="min-h-screen flex items-center justify-center bg-slate-50">
          <div class="flex flex-col items-center gap-3">
            <svg
              class="w-8 h-8 text-indigo-500 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>加载中</title>
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p class="text-sm text-slate-400">正在加载...</p>
          </div>
        </div>
      }
    >
      <Show when={auth.user()} fallback={<Navigate href="/login" />}>
        <div class="h-screen flex overflow-hidden bg-slate-50">
          <Sidebar />
          <main class="flex-1 min-w-0 overflow-y-auto">{props.children}</main>
        </div>
      </Show>
    </Show>
  );
};

export default AppLayout;
