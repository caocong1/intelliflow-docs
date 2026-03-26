import { A } from "@solidjs/router";
import type { Component } from "solid-js";
import { createResource, createSignal, For, Show } from "solid-js";
import Badge from "../components/ui/Badge";
import SearchInput from "../components/ui/SearchInput";
import { globalSearch, type SearchResponse } from "../lib/api/search";

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

type GroupKey = "projects" | "documents" | "workflows";

const groupLabels: Record<GroupKey, string> = {
  projects: "项目",
  documents: "文档",
  workflows: "流程",
};

const groupBadgeVariant: Record<GroupKey, "info" | "success" | "warning"> = {
  projects: "info",
  documents: "success",
  workflows: "warning",
};

function itemLink(group: GroupKey, item: { id: string; projectId?: string }): string | undefined {
  if (group === "projects") return `/projects/${item.id}`;
  if (group === "documents") return `/documents/${item.id}`;
  return undefined;
}

function itemName(group: GroupKey, item: { name?: string; title?: string }): string {
  return (group === "documents" ? item.title : item.name) ?? "未命名";
}

const Search: Component = () => {
  const [query, setQuery] = createSignal("");
  const [expandedGroup, setExpandedGroup] = createSignal<GroupKey | null>(null);

  const [results] = createResource(
    () => {
      const q = query();
      const expanded = expandedGroup();
      return q ? { q, expanded } : null;
    },
    async (params) => {
      if (!params) return null;
      const limit = params.expanded ? 50 : 3;
      return globalSearch(params.q, limit);
    },
  );

  const groups: GroupKey[] = ["projects", "documents", "workflows"];

  const getGroupItems = (data: SearchResponse, group: GroupKey) => {
    const g = data[group];
    const expanded = expandedGroup();
    if (expanded === group) return g.items;
    return g.items.slice(0, 3);
  };

  return (
    <div class="p-8">
      <h1 class="text-xl font-bold text-indigo-950 mb-6">搜索</h1>

      <div class="max-w-xl mb-8">
        <SearchInput
          value={query()}
          onChange={(v) => {
            setExpandedGroup(null);
            setQuery(v);
          }}
          placeholder="搜索项目、文档和流程..."
        />
      </div>

      <Show when={!query()}>
        <div class="text-center py-16 text-slate-400 text-sm">
          输入关键词搜索项目、文档和流程
        </div>
      </Show>

      <Show when={query() && results.loading}>
        <div class="text-center py-16 text-slate-400 text-sm">搜索中...</div>
      </Show>

      <Show when={query() && results() !== undefined && !results.loading}>
        {(() => {
          const data = results();
          if (!data) return null;
          const hasResults =
            data.projects.total > 0 ||
            data.documents.total > 0 ||
            data.workflows.total > 0;

          if (!hasResults) {
            return (
              <div class="text-center py-16 text-slate-400 text-sm">
                未找到匹配的结果
              </div>
            );
          }

          return (
            <div class="space-y-6">
              <For each={groups}>
                {(group) => {
                  const groupData = () => data[group];
                  return (
                    <Show when={groupData().total > 0}>
                      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                          <p class="text-sm font-semibold text-slate-700">
                            {groupLabels[group]}
                            <span class="ml-2 text-xs text-slate-400 font-normal">
                              {groupData().total} 条结果
                            </span>
                          </p>
                        </div>
                        <ul class="divide-y divide-slate-50">
                          <For each={getGroupItems(data, group)}>
                            {(item: any) => {
                              const href = itemLink(group, item);
                              const name = itemName(group, item);
                              return (
                                <li class="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                  <div class="flex items-center gap-3 min-w-0">
                                    <Badge
                                      label={groupLabels[group]}
                                      variant={groupBadgeVariant[group]}
                                    />
                                    {href ? (
                                      <A
                                        href={href}
                                        class="text-sm font-medium text-indigo-600 hover:text-indigo-800 truncate"
                                      >
                                        {name}
                                      </A>
                                    ) : (
                                      <span class="text-sm font-medium text-slate-700 truncate">
                                        {name}
                                      </span>
                                    )}
                                  </div>
                                  <span class="text-xs text-slate-400 flex-shrink-0 ml-4">
                                    {relativeTime(item.createdAt)}
                                  </span>
                                </li>
                              );
                            }}
                          </For>
                        </ul>
                        <Show
                          when={
                            groupData().total > 3 &&
                            expandedGroup() !== group
                          }
                        >
                          <button
                            type="button"
                            class="w-full px-5 py-2.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 cursor-pointer transition-colors border-t border-slate-100"
                            onClick={() => setExpandedGroup(group)}
                          >
                            查看全部 {groupData().total} 条结果
                          </button>
                        </Show>
                      </div>
                    </Show>
                  );
                }}
              </For>
            </div>
          );
        })()}
      </Show>
    </div>
  );
};

export default Search;
