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
        <div class="min-h-screen flex items-center justify-center bg-gray-50">
          <p class="text-base text-gray-500">加载中...</p>
        </div>
      }
    >
      <Show when={auth.user()} fallback={<Navigate href="/login" />}>
        <div class="min-h-screen flex bg-gray-50">
          <Sidebar />
          <main class="flex-1 min-w-0">{props.children}</main>
        </div>
      </Show>
    </Show>
  );
};

export default AppLayout;
