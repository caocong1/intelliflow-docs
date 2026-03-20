import type { DesensitizeConfig } from "@intelliflow/shared";
import { For, createResource } from "solid-js";
import { api } from "../../../api/client";

type LocalModel = {
  id: string;
  displayName: string;
  deploymentType?: string;
};

async function fetchLocalModels(): Promise<LocalModel[]> {
  try {
    const res = await (
      api.api as unknown as {
        models: {
          get: (opts: { query: Record<string, unknown> }) => Promise<{
            data: unknown;
            error: unknown;
          }>;
        };
      }
    ).models.get({ query: {} });

    if (res.error || !res.data) return [];

    const data = res.data as {
      data: Array<{
        id: string;
        displayName: string;
        isActive: boolean;
        isProviderDisabled: boolean;
        deploymentType?: string;
      }>;
    };
    // Filter to local deployment models only
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

  function addCategory() {
    const current = props.config.categories ?? [];
    props.onChange({
      ...props.config,
      categories: [...current, { name: "", description: "" }],
    });
  }

  function updateCategory(index: number, patch: Partial<{ name: string; description: string }>) {
    const current = [...(props.config.categories ?? [])];
    current[index] = { ...current[index], ...patch };
    props.onChange({ ...props.config, categories: current });
  }

  function removeCategory(index: number) {
    const current = [...(props.config.categories ?? [])];
    current.splice(index, 1);
    props.onChange({ ...props.config, categories: current });
  }

  function moveCategory(index: number, direction: -1 | 1) {
    const current = [...(props.config.categories ?? [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= current.length) return;
    [current[index], current[newIndex]] = [current[newIndex], current[index]];
    props.onChange({ ...props.config, categories: current });
  }

  return (
    <div class="space-y-4">
      {/* Categories */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide">脱敏类别</h4>
          <button
            type="button"
            onClick={addCategory}
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>添加</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            添加类别
          </button>
        </div>

        <div class="space-y-2">
          <For
            each={props.config.categories ?? []}
            fallback={
              <p class="text-xs text-slate-400 italic text-center py-2">
                暂无类别 -- 请添加脱敏类别
              </p>
            }
          >
            {(cat, index) => (
              <div class="bg-slate-50 rounded-lg border border-slate-200 p-3">
                {/* Top row: move + name input + delete */}
                <div class="flex items-center gap-2">
                  {/* Move buttons */}
                  <div class="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => moveCategory(index(), -1)}
                      disabled={index() === 0}
                      class="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                      title="上移"
                    >
                      <svg
                        class="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <title>上移</title>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(index(), 1)}
                      disabled={index() === (props.config.categories ?? []).length - 1}
                      class="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                      title="下移"
                    >
                      <svg
                        class="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <title>下移</title>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Category name input */}
                  <input
                    type="text"
                    value={cat.name}
                    onInput={(e) => updateCategory(index(), { name: e.currentTarget.value })}
                    placeholder="类别名称（如：公司名称）"
                    class="flex-1 min-w-0 text-xs px-2 py-1.5 border border-gray-300 rounded-md bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                  />

                  {/* Delete button — top-right corner of card */}
                  <button
                    type="button"
                    onClick={() => removeCategory(index())}
                    class="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                    title="删除类别"
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <title>删除</title>
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Description textarea */}
                <div class="mt-2 pl-7">
                  <textarea
                    value={cat.description}
                    onInput={(e) => updateCategory(index(), { description: e.currentTarget.value })}
                    placeholder="描述（如：识别并脱敏所有公司和组织名称）"
                    rows={2}
                    class="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-md bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400 resize-none"
                  />
                </div>
              </div>
            )}
          </For>
        </div>

        {(props.config.categories ?? []).length === 0 && (
          <p class="text-xs text-amber-600 mt-1.5">请至少添加一种脱敏类别</p>
        )}
      </div>

      {/* Placeholder format info */}
      <div class="bg-slate-50 rounded-md p-2.5 border border-slate-100">
        <p class="text-xs text-slate-500">
          占位符格式: <code class="font-mono text-slate-700">[TYPE_N]</code>，如{" "}
          <code class="font-mono text-slate-700">[COMPANY_1]</code>、
          <code class="font-mono text-slate-700">[PERSON_1]</code>（系统自动生成）
        </p>
      </div>

      {/* Local Model Selector */}
      <div class="border-t border-slate-100 pt-3">
        <label for="desensitize-local-model" class="block text-sm font-medium text-gray-700 mb-1">
          本地模型（用于脱敏处理）
        </label>
        <select
          id="desensitize-local-model"
          value={props.config.localModelId ?? ""}
          onChange={(e) =>
            props.onChange({
              ...props.config,
              localModelId: e.currentTarget.value || null,
            })
          }
          class="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
        >
          <option value="">(未选择)</option>
          <For each={localModels() ?? []}>
            {(model) => <option value={model.id}>{model.displayName}</option>}
          </For>
        </select>
        {localModels.loading && <p class="text-xs text-slate-400 mt-1">加载模型列表...</p>}
      </div>
    </div>
  );
}
