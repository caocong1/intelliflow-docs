import { For, createResource, createSignal } from "solid-js";
import type { DesensitizeConfig } from "@intelliflow/shared";
import { api } from "../../../api/client";

type LocalModel = {
  id: string;
  displayName: string;
};

async function fetchLocalModels(): Promise<LocalModel[]> {
  try {
    const res = await (api.api as unknown as {
      models: {
        get: (opts: { query: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>;
      };
    }).models.get({ query: {} });

    if (res.error || !res.data) return [];

    const data = res.data as { data: Array<{ id: string; displayName: string; isActive: boolean; isProviderDisabled: boolean }> };
    return data.data.filter((m) => m.isActive && !m.isProviderDisabled);
  } catch {
    return [];
  }
}

interface DesensitizeConfigProps {
  config: DesensitizeConfig;
  onChange: (config: DesensitizeConfig) => void;
}

export default function DesensitizeConfigPanel(props: DesensitizeConfigProps) {
  const [localModels] = createResource(fetchLocalModels);
  const [newCategoryName, setNewCategoryName] = createSignal("");
  const [newCategoryDesc, setNewCategoryDesc] = createSignal("");

  function addCategory() {
    const name = newCategoryName().trim();
    const description = newCategoryDesc().trim();
    if (!name) return;
    const current = props.config.categories ?? [];
    props.onChange({
      ...props.config,
      categories: [...current, { name, description: description || name }],
    });
    setNewCategoryName("");
    setNewCategoryDesc("");
  }

  function removeCategory(index: number) {
    const current = [...(props.config.categories ?? [])];
    current.splice(index, 1);
    props.onChange({ ...props.config, categories: current });
  }

  return (
    <div class="space-y-4">
      {/* Categories */}
      <div>
        <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">脱敏类别</h4>

        <div class="space-y-1.5 mb-2">
          <For
            each={props.config.categories ?? []}
            fallback={
              <p class="text-xs text-slate-400 italic text-center py-2">
                暂无类别 — 请添加脱敏类别
              </p>
            }
          >
            {(cat, index) => (
              <div class="flex items-center gap-1.5 p-1.5 bg-orange-50 rounded border border-orange-200">
                <div class="flex-1 min-w-0">
                  <span class="text-xs font-medium text-orange-800">{cat.name}</span>
                  <span class="text-xs text-orange-600 ml-1">— {cat.description}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeCategory(index())}
                  class="p-0.5 text-orange-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none"
                  title="删除类别"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <title>删除</title>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </For>
        </div>

        {/* Add new category */}
        <div class="flex items-end gap-1.5">
          <div class="flex-1">
            <input
              type="text"
              value={newCategoryName()}
              onInput={(e) => setNewCategoryName(e.currentTarget.value)}
              placeholder="类别名称"
              class="w-full text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
            />
          </div>
          <div class="flex-1">
            <input
              type="text"
              value={newCategoryDesc()}
              onInput={(e) => setNewCategoryDesc(e.currentTarget.value)}
              placeholder="描述"
              class="w-full text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
            />
          </div>
          <button
            type="button"
            onClick={addCategory}
            class="px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            添加
          </button>
        </div>

        {(props.config.categories ?? []).length === 0 && (
          <p class="text-xs text-amber-600 mt-1.5">请至少添加一种脱敏类别</p>
        )}
      </div>

      {/* Placeholder format info */}
      <div class="bg-slate-50 rounded-md p-2 border border-slate-100">
        <p class="text-xs text-slate-500">
          占位符格式：<code class="font-mono text-slate-700">[TYPE_N]</code>（系统内定，不可配置）
        </p>
      </div>

      {/* Local Model Selector */}
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">
          本地模型（用于脱敏处理）
        </label>
        <select
          value={props.config.localModelId ?? ""}
          onChange={(e) =>
            props.onChange({
              ...props.config,
              localModelId: e.currentTarget.value || null,
            })
          }
          class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
        >
          <option value="">(未选择)</option>
          <For each={localModels() ?? []}>
            {(model) => (
              <option value={model.id}>{model.displayName}</option>
            )}
          </For>
        </select>
        {localModels.loading && (
          <p class="text-xs text-slate-400 mt-1">加载模型列表...</p>
        )}
      </div>
    </div>
  );
}
