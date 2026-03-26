import { A } from "@solidjs/router";
import type { Component } from "solid-js";
import { createResource, For, Show } from "solid-js";
import Badge from "../components/ui/Badge";
import { fetchFavorites } from "../lib/api/user-activity";

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

type GroupConfig = {
  key: "projects" | "documents" | "workflows";
  label: string;
  emptyLabel: string;
  badgeVariant: "info" | "success" | "warning";
  linkPrefix: string;
};

const groups: GroupConfig[] = [
  {
    key: "projects",
    label: "收藏的项目",
    emptyLabel: "暂无收藏的项目",
    badgeVariant: "info",
    linkPrefix: "/projects",
  },
  {
    key: "documents",
    label: "收藏的文档",
    emptyLabel: "暂无收藏的文档",
    badgeVariant: "success",
    linkPrefix: "/documents",
  },
  {
    key: "workflows",
    label: "收藏的流程",
    emptyLabel: "暂无收藏的流程",
    badgeVariant: "warning",
    linkPrefix: "",
  },
];

const Favorites: Component = () => {
  const [data] = createResource(fetchFavorites);

  const isEmpty = () => {
    const d = data();
    if (!d) return false;
    return (
      d.projects.length === 0 &&
      d.documents.length === 0 &&
      d.workflows.length === 0
    );
  };

  return (
    <div class="p-8">
      <h1 class="text-xl font-bold text-indigo-950 mb-6">我的收藏</h1>

      <Show when={data.loading}>
        <div class="text-center py-16 text-slate-400 text-sm">加载中...</div>
      </Show>

      <Show when={data() && isEmpty()}>
        <div class="text-center py-16 text-slate-400 text-sm">
          还没有收藏任何内容
        </div>
      </Show>

      <Show when={data() && !isEmpty()}>
        <div class="space-y-6">
          <For each={groups}>
            {(group) => {
              const items = () => data()![group.key];
              return (
                <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div class="px-5 py-3 border-b border-slate-100">
                    <p class="text-sm font-semibold text-slate-700">
                      {group.label}
                      <span class="ml-2 text-xs text-slate-400 font-normal">
                        {items().length} 项
                      </span>
                    </p>
                  </div>
                  <Show
                    when={items().length > 0}
                    fallback={
                      <div class="px-5 py-6 text-center text-sm text-slate-400">
                        {group.emptyLabel}
                      </div>
                    }
                  >
                    <ul class="divide-y divide-slate-50">
                      <For each={items()}>
                        {(item) => (
                          <li class="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div class="flex items-center gap-3 min-w-0">
                              <Badge
                                label={group.label.replace("收藏的", "")}
                                variant={group.badgeVariant}
                              />
                              {group.linkPrefix ? (
                                <A
                                  href={`${group.linkPrefix}/${item.targetId}`}
                                  class="text-sm font-medium text-indigo-600 hover:text-indigo-800 truncate"
                                >
                                  {item.name}
                                </A>
                              ) : (
                                <span class="text-sm font-medium text-slate-700 truncate">
                                  {item.name}
                                </span>
                              )}
                            </div>
                            <span class="text-xs text-slate-400 flex-shrink-0 ml-4">
                              {relativeTime(item.createdAt)}
                            </span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default Favorites;
