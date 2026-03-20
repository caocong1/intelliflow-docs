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
      "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-all duration-150";
    return isActive(path)
      ? `${base} bg-white/10 text-white border-l-2 border-indigo-400 pl-[10px]`
      : `${base} text-indigo-200 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-[10px]`;
  };

  const initials = () => {
    const name = auth.user()?.displayName ?? "";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || name.slice(0, 2).toUpperCase();
  };

  return (
    <aside class="w-60 flex-shrink-0 bg-indigo-950 min-h-screen flex flex-col">
      {/* Logo area */}
      <div class="px-4 py-5 border-b border-indigo-900">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>IntelliFlow</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 class="text-sm font-bold text-white leading-tight">IntelliFlow</h1>
            <p class="text-xs text-indigo-400 leading-tight">智能文档流程平台</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav class="flex-1 px-3 py-4 space-y-0.5">
        <A href="/" class={linkClass("/")}>
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>仪表盘</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          仪表盘
        </A>

        <div class="pt-5 pb-1.5 px-3">
          <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest">工作区</p>
        </div>
        <A href="/projects" class={linkClass("/projects")}>
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>项目</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          项目
        </A>

        <Show when={auth.isAdmin()}>
          <div class="pt-5 pb-1.5 px-3">
            <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest">管理</p>
          </div>
          <A href="/admin/users" class={linkClass("/admin/users")}>
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>用户管理</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            用户管理
          </A>
          <A href="/admin/document-types" class={linkClass("/admin/document-types")}>
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>文档类型管理</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            文档类型管理
          </A>
          <A href="/admin/model-config" class={linkClass("/admin/model-config")}>
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>AI 模型配置</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            AI 模型配置
          </A>
          <A href="/admin/workflows" class={linkClass("/admin/workflows")}>
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>流程管理</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            流程管理
          </A>
        </Show>
      </nav>

      {/* User section */}
      <div class="px-3 py-4 border-t border-indigo-900">
        <div class="flex items-center gap-2.5 mb-3 px-1">
          <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            {initials()}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-white truncate">{auth.user()?.displayName}</p>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-800 text-indigo-200">
              {auth.user()?.role === "admin" ? "管理员" : "用户"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => auth.logout()}
          class="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-300 rounded-lg cursor-pointer hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-150"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>退出登录</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          退出登录
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
