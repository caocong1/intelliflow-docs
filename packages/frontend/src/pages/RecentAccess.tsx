import { A } from "@solidjs/router";
import type { Component } from "solid-js";
import { createResource, For, Show } from "solid-js";
import Badge from "../components/ui/Badge";
import { fetchRecentAccess, type RecentAccessItem } from "../lib/api/user-activity";

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

const typeBadgeVariant: Record<
  RecentAccessItem["targetType"],
  "info" | "success" | "warning"
> = {
  project: "info",
  document: "success",
  workflow: "warning",
};

function itemLink(item: RecentAccessItem): string | undefined {
  if (item.targetType === "project") return `/projects/${item.targetId}`;
  if (item.targetType === "document") return `/documents/${item.targetId}`;
  return undefined;
}

const RecentAccess: Component = () => {
  const [data] = createResource(() => fetchRecentAccess());

  return (
    <div class="p-8">
      <h1 class="text-xl font-bold text-indigo-950 mb-6">最近访问</h1>

      <Show when={data.loading}>
        <div class="text-center py-16 text-slate-400 text-sm">加载中...</div>
      </Show>

      <Show when={data() && data()!.length === 0}>
        <div class="text-center py-16 text-slate-400 text-sm">
          暂无最近访问记录
        </div>
      </Show>

      <Show when={data() && data()!.length > 0}>
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <ul class="divide-y divide-slate-50">
            <For each={data()}>
              {(item) => {
                const href = itemLink(item);
                return (
                  <li class="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                      <Badge
                        label={typeLabels[item.targetType]}
                        variant={typeBadgeVariant[item.targetType]}
                      />
                      {href ? (
                        <A
                          href={href}
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
                      {relativeTime(item.accessedAt)}
                    </span>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
};

export default RecentAccess;
