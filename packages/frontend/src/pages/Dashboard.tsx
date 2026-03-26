import { A } from "@solidjs/router";
import type { Component } from "solid-js";
import { createResource, For, Show } from "solid-js";
import Badge from "../components/ui/Badge";
import { useAuth } from "../contexts/auth";
import {
  fetchFavorites,
  fetchRecentAccess,
  type RecentAccessItem,
  type FavoritesResponse,
} from "../lib/api/user-activity";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  return `${months} 个月前`;
}

const typeLabels: Record<RecentAccessItem["targetType"], string> = {
  project: "项目",
  document: "文档",
  workflow: "流程",
};

const typeBadgeVariant: Record<RecentAccessItem["targetType"], "info" | "success" | "warning"> = {
  project: "info",
  document: "success",
  workflow: "warning",
};

function targetLink(targetType: string, targetId: string): string | undefined {
  if (targetType === "project") return `/projects/${targetId}`;
  if (targetType === "document") return `/documents/${targetId}`;
  return undefined;
}

type FlatFavorite = { targetId: string; name: string; targetType: string; createdAt: string };

function flattenFavorites(data: FavoritesResponse): FlatFavorite[] {
  const all: FlatFavorite[] = [
    ...data.projects.map((p) => ({ ...p, targetType: "project" })),
    ...data.documents.map((d) => ({ ...d, targetType: "document" })),
    ...data.workflows.map((w) => ({ ...w, targetType: "workflow" })),
  ];
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all.slice(0, 5);
}

const Dashboard: Component = () => {
  const auth = useAuth();
  const user = auth.user;
  const [recentData] = createResource(() => fetchRecentAccess(5));
  const [favData] = createResource(fetchFavorites);

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

      {/* Summary cards */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Recent Access card */}
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">最近访问</p>
            <A href="/recent" class="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer">查看全部</A>
          </div>
          <Show when={!recentData.loading && recentData()} fallback={<p class="text-sm text-slate-400">加载中...</p>}>
            <Show when={(recentData() ?? []).length > 0} fallback={<p class="text-sm text-slate-400">暂无最近访问</p>}>
              <ul class="space-y-2">
                <For each={recentData()}>
                  {(item) => {
                    const href = targetLink(item.targetType, item.targetId);
                    return (
                      <li class="flex items-center justify-between">
                        <div class="flex items-center gap-2 min-w-0">
                          <Badge label={typeLabels[item.targetType]} variant={typeBadgeVariant[item.targetType]} />
                          {href ? (
                            <A href={href} class="text-sm text-indigo-600 hover:text-indigo-800 truncate">{item.name}</A>
                          ) : (
                            <span class="text-sm text-slate-700 truncate">{item.name}</span>
                          )}
                        </div>
                        <span class="text-xs text-slate-400 flex-shrink-0 ml-3">{relativeTime(item.accessedAt)}</span>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </Show>
          </Show>
        </div>

        {/* Favorites card */}
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">我的收藏</p>
            <A href="/favorites" class="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer">查看全部</A>
          </div>
          <Show when={!favData.loading && favData()} fallback={<p class="text-sm text-slate-400">加载中...</p>}>
            {(() => {
              const flat = () => {
                const d = favData();
                if (!d) return [];
                return flattenFavorites(d);
              };
              return (
                <Show when={flat().length > 0} fallback={<p class="text-sm text-slate-400">暂无收藏</p>}>
                  <ul class="space-y-2">
                    <For each={flat()}>
                      {(item) => {
                        const href = targetLink(item.targetType, item.targetId);
                        const label = typeLabels[item.targetType as RecentAccessItem["targetType"]] ?? item.targetType;
                        const variant = typeBadgeVariant[item.targetType as RecentAccessItem["targetType"]] ?? "info";
                        return (
                          <li class="flex items-center gap-2 min-w-0">
                            <Badge label={label} variant={variant} />
                            {href ? (
                              <A href={href} class="text-sm text-indigo-600 hover:text-indigo-800 truncate">{item.name}</A>
                            ) : (
                              <span class="text-sm text-slate-700 truncate">{item.name}</span>
                            )}
                          </li>
                        );
                      }}
                    </For>
                  </ul>
                </Show>
              );
            })()}
          </Show>
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
