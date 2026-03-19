import { A, useLocation } from "@solidjs/router";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { useAuth } from "../../contexts/auth";

const Sidebar: Component = () => {
  const auth = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const linkClass = (path: string) => {
    const base =
      "flex items-center px-4 py-2.5 text-base font-medium rounded-md cursor-pointer transition-colors duration-200";
    return isActive(path)
      ? `${base} bg-blue-50 text-blue-700`
      : `${base} text-gray-700 hover:bg-gray-100 hover:text-gray-900`;
  };

  return (
    <aside class="w-64 flex-shrink-0 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div class="p-4 border-b border-gray-200">
        <h1 class="text-xl font-bold text-gray-900">IntelliFlow</h1>
        <p class="text-sm text-gray-500">智能文档流程平台</p>
      </div>

      <nav class="flex-1 p-4 space-y-1">
        <A href="/" class={linkClass("/")}>
          仪表盘
        </A>

        <Show when={auth.isAdmin()}>
          <div class="pt-4 pb-2">
            <p class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">管理</p>
          </div>
          <A href="/admin/users" class={linkClass("/admin/users")}>
            用户管理
          </A>
          <A href="/admin/document-types" class={linkClass("/admin/document-types")}>
            文档类型管理
          </A>
        </Show>
      </nav>

      <div class="p-4 border-t border-gray-200">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-sm font-medium text-gray-900">{auth.user()?.displayName}</p>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              {auth.user()?.role === "admin" ? "管理员" : "用户"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => auth.logout()}
          class="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
