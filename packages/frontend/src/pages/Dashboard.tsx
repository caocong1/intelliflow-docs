import type { Component } from "solid-js";
import { useAuth } from "../contexts/auth";

const Dashboard: Component = () => {
  const auth = useAuth();
  const user = auth.user;

  return (
    <div class="p-8">
      {/* Welcome card */}
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-8">
        <div class="h-1.5 bg-gradient-to-r from-indigo-600 to-indigo-400" />
        <div class="px-6 py-5 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-indigo-950">
              欢迎回来，{user()?.displayName}
            </h1>
            <p class="mt-1 text-sm text-slate-500">今天是个高效工作的好日子</p>
          </div>
          <span class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            user()?.role === "admin"
              ? "bg-indigo-100 text-indigo-700"
              : "bg-emerald-50 text-emerald-700"
          }`}>
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <title>角色</title>
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
            {user()?.role === "admin" ? "管理员" : "普通用户"}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">总用户数</p>
            <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg class="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>用户</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <p class="text-2xl font-bold text-indigo-950">—</p>
          <p class="mt-1 text-xs text-slate-400">数据加载中</p>
        </div>

        <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">文档类型</p>
            <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>文档</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
          <p class="text-2xl font-bold text-indigo-950">—</p>
          <p class="mt-1 text-xs text-slate-400">数据加载中</p>
        </div>

        <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">活跃会话</p>
            <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>会话</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p class="text-2xl font-bold text-indigo-950">—</p>
          <p class="mt-1 text-xs text-slate-400">数据加载中</p>
        </div>
      </div>

      {/* Placeholder content */}
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>信息</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm font-medium text-slate-500">仪表盘功能正在开发中，敬请期待</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
