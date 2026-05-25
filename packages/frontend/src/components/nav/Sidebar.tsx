import { A, useLocation } from "@solidjs/router";
import type { Component } from "solid-js";
import { Show, createSignal, onCleanup } from "solid-js";
import { api } from "../../api/client";
import { useAuth } from "../../contexts/auth";
import NotificationBell from "../notifications/NotificationBell";
import NotificationDrawer from "../notifications/NotificationDrawer";
import Modal from "../ui/Modal";
import { showToast } from "../ui/Toast";

const Sidebar: Component = () => {
  const auth = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [collapsed, setCollapsed] = createSignal(false);
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const [showChangePw, setShowChangePw] = createSignal(false);
  const [oldPw, setOldPw] = createSignal("");
  const [newPw, setNewPw] = createSignal("");
  const [pwError, setPwError] = createSignal("");
  const [pwSubmitting, setPwSubmitting] = createSignal(false);

  // Close user menu on outside click
  const handleOutsideClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-user-menu]")) {
      setUserMenuOpen(false);
    }
  };
  document.addEventListener("click", handleOutsideClick);
  onCleanup(() => document.removeEventListener("click", handleOutsideClick));

  async function handleChangePw() {
    if (newPw().length < 6) {
      setPwError("新密码长度至少 6 个字符");
      return;
    }
    setPwSubmitting(true);
    try {
      const { error } = await api.api.auth["change-password"].patch({
        oldPassword: oldPw(),
        newPassword: newPw(),
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        setPwError(errData?.error ?? "修改密码失败");
        return;
      }
      showToast("密码修改成功", "success");
      setShowChangePw(false);
      setOldPw("");
      setNewPw("");
      setPwError("");
    } catch {
      setPwError("网络错误，请稍后重试");
    } finally {
      setPwSubmitting(false);
    }
  }

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const linkClass = (path: string) => {
    const base = collapsed()
      ? "flex items-center justify-center p-2.5 text-sm font-medium rounded-lg cursor-pointer transition-all duration-150"
      : "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-all duration-150";
    return isActive(path)
      ? `${base} bg-indigo-800/50 text-white`
      : `${base} text-indigo-200 hover:bg-white/5 hover:text-white`;
  };

  const initials = () => {
    const name = auth.user()?.displayName ?? "";
    return (
      name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || name.slice(0, 2).toUpperCase()
    );
  };

  return (
    <aside
      class={`${collapsed() ? "w-16" : "w-60"} flex-shrink-0 bg-indigo-950 h-full overflow-y-auto flex flex-col transition-all duration-200`}
    >
      {/* Logo area */}
      <div class="px-4 py-5 border-b border-indigo-900">
        <div class={`flex items-center ${collapsed() ? "justify-center" : "gap-2.5"}`}>
          <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <svg
              class="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>IntelliFlow</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.75"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <Show when={!collapsed()}>
            <div>
              <h1 class="text-sm font-bold text-white leading-tight">IntelliFlow</h1>
              <p class="text-xs text-indigo-400 leading-tight">智能文档流程平台</p>
            </div>
          </Show>
        </div>
      </div>

      {/* Nav */}
      <nav class={`flex-1 ${collapsed() ? "px-2" : "px-3"} py-4 space-y-0.5`}>
        <A href="/" class={linkClass("/")} title="仪表盘">
          <svg
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>仪表盘</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <Show when={!collapsed()}>仪表盘</Show>
        </A>

        <Show when={!collapsed()}>
          <div class="pt-5 pb-1.5 px-3">
            <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest">效率工具</p>
          </div>
        </Show>
        <Show when={collapsed()}>
          <div class="pt-3" />
        </Show>
        <A href="/search" class={linkClass("/search")} title="搜索">
          <svg
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>搜索</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Show when={!collapsed()}>搜索</Show>
        </A>
        <A href="/favorites" class={linkClass("/favorites")} title="收藏">
          <svg
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>收藏</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
          <Show when={!collapsed()}>收藏</Show>
        </A>
        <A href="/recent" class={linkClass("/recent")} title="最近访问">
          <svg
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>最近访问</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <Show when={!collapsed()}>最近访问</Show>
        </A>
        <A href="/ppt-generator" class={linkClass("/ppt-generator")} title="PPT生成">
          <svg
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>PPT生成</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zm2 4h6m-6 4h3m-3 4h6"
            />
          </svg>
          <Show when={!collapsed()}>PPT生成</Show>
        </A>

        <Show when={!collapsed()}>
          <div class="pt-5 pb-1.5 px-3">
            <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest">工作区</p>
          </div>
        </Show>
        <Show when={collapsed()}>
          <div class="pt-3" />
        </Show>
        <A href="/projects" class={linkClass("/projects")} title="项目">
          <svg
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>项目</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <Show when={!collapsed()}>项目</Show>
        </A>

        <Show when={auth.isAdmin()}>
          <Show when={!collapsed()}>
            <div class="pt-5 pb-1.5 px-3">
              <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest">管理</p>
            </div>
          </Show>
          <Show when={collapsed()}>
            <div class="pt-3" />
          </Show>
          <A href="/admin/users" class={linkClass("/admin/users")} title="用户管理">
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>用户管理</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <Show when={!collapsed()}>用户管理</Show>
          </A>
          <A
            href="/admin/document-types"
            class={linkClass("/admin/document-types")}
            title="文档类型管理"
          >
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>文档类型管理</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <Show when={!collapsed()}>文档类型管理</Show>
          </A>
          <A
            href="/admin/model-config"
            class={linkClass("/admin/model-config")}
            title="AI 模型配置"
          >
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>AI 模型配置</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
            <Show when={!collapsed()}>AI 模型配置</Show>
          </A>
          <A
            href="/admin/ppt-agent-config"
            class={linkClass("/admin/ppt-agent-config")}
            title="PPT Agent 配置"
          >
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>PPT Agent 配置</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 8h10M7 12h10M7 16h6M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
              />
            </svg>
            <Show when={!collapsed()}>PPT Agent 配置</Show>
          </A>
          <A href="/admin/stats" class={linkClass("/admin/stats")} title="统计面板">
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>统计面板</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <Show when={!collapsed()}>统计面板</Show>
          </A>
          <A
            href="/admin/model-call-logs"
            class={linkClass("/admin/model-call-logs")}
            title="模型调用日志"
          >
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>模型调用日志</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            <Show when={!collapsed()}>模型调用日志</Show>
          </A>
          {/* PPT 模板管理已迁移到内置风格包，导航入口隐藏；路由保留供内部访问 */}
          <A href="/admin/workflows" class={linkClass("/admin/workflows")} title="流程管理">
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>流程管理</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <Show when={!collapsed()}>流程管理</Show>
          </A>
        </Show>
      </nav>

      {/* Collapse toggle */}
      <div class={`${collapsed() ? "px-2" : "px-3"} py-2`}>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          class={`w-full flex items-center ${collapsed() ? "justify-center p-2.5" : "gap-2 px-3 py-2"} text-sm font-medium text-indigo-300 rounded-lg cursor-pointer hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-150`}
          title={collapsed() ? "展开侧栏" : "收起侧栏"}
        >
          <svg
            class={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${collapsed() ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>{collapsed() ? "展开侧栏" : "收起侧栏"}</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
          <Show when={!collapsed()}>收起侧栏</Show>
        </button>
      </div>

      {/* User section */}
      <div
        class={`${collapsed() ? "px-2" : "px-3"} py-4 border-t border-indigo-900`}
        data-user-menu
      >
        <div class={`flex items-center ${collapsed() ? "justify-center" : "gap-2"}`}>
          <div class="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              class={`w-full flex items-center ${collapsed() ? "justify-center p-2.5" : "gap-2.5 px-1 py-1.5"} rounded-lg cursor-pointer hover:bg-white/5 transition-colors duration-150`}
            >
              {auth.user()?.avatar ? (
                <img
                  src={auth.user()?.avatar ?? ""}
                  alt={auth.user()?.displayName ?? ""}
                  class="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                />
              ) : (
                <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                  {initials()}
                </div>
              )}
              <Show when={!collapsed()}>
                <div class="min-w-0 flex-1 text-left">
                  <p class="text-sm font-medium text-white truncate">{auth.user()?.displayName}</p>
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-800 text-indigo-200">
                    {auth.user()?.role === "admin" ? "管理员" : "用户"}
                  </span>
                </div>
                <svg
                  class="w-4 h-4 text-indigo-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <title>菜单</title>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </Show>
            </button>

            {/* Popup menu */}
            <Show when={userMenuOpen()}>
              <div
                class={`absolute ${collapsed() ? "left-full ml-2" : "left-0 right-0"} bottom-full mb-1 bg-indigo-900 rounded-lg shadow-lg border border-indigo-800 py-1 z-50`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setShowChangePw(true);
                    setOldPw("");
                    setNewPw("");
                    setPwError("");
                  }}
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <svg
                    class="w-4 h-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <title>修改密码</title>
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  <Show when={!collapsed()}>修改密码</Show>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    auth.logout();
                  }}
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <svg
                    class="w-4 h-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <title>退出登录</title>
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <Show when={!collapsed()}>退出登录</Show>
                </button>
              </div>
            </Show>
          </div>
          <Show when={!collapsed()}>
            <NotificationBell onOpen={() => setDrawerOpen(true)} />
          </Show>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal isOpen={showChangePw()} onClose={() => setShowChangePw(false)} title="修改密码">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePw();
          }}
          class="space-y-4"
        >
          <div>
            <label for="old-password" class="block text-sm font-medium text-slate-700 mb-1.5">
              原密码
            </label>
            <input
              id="old-password"
              type="password"
              value={oldPw()}
              onInput={(e) => {
                setOldPw(e.currentTarget.value);
                setPwError("");
              }}
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              required
            />
          </div>
          <div>
            <label for="new-password" class="block text-sm font-medium text-slate-700 mb-1.5">
              新密码
            </label>
            <input
              id="new-password"
              type="password"
              value={newPw()}
              onInput={(e) => {
                setNewPw(e.currentTarget.value);
                setPwError("");
              }}
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              placeholder="至少 6 个字符"
              required
            />
          </div>
          {pwError() && <p class="text-xs text-red-600">{pwError()}</p>}
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowChangePw(false)}
              class="px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={pwSubmitting()}
              class="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {pwSubmitting() ? "修改中..." : "确认修改"}
            </button>
          </div>
        </form>
      </Modal>
      <NotificationDrawer isOpen={drawerOpen()} onClose={() => setDrawerOpen(false)} />
    </aside>
  );
};

export default Sidebar;
