import { For, createResource } from "solid-js";
import type { DesensitizeConfig } from "@intelliflow/shared";
import { api } from "../../../api/client";

const RULE_TYPE_OPTIONS = [
  { value: "姓名", label: "姓名" },
  { value: "身份证号", label: "身份证号" },
  { value: "手机号", label: "手机号" },
  { value: "地址", label: "地址" },
  { value: "银行卡号", label: "银行卡号" },
  { value: "邮箱", label: "邮箱" },
  { value: "自定义", label: "自定义" },
];

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

  function toggleRuleType(ruleType: string) {
    const current = props.config.ruleTypes;
    const next = current.includes(ruleType)
      ? current.filter((r) => r !== ruleType)
      : [...current, ruleType];
    props.onChange({ ...props.config, ruleTypes: next });
  }

  return (
    <div class="space-y-4">
      {/* Rule Types */}
      <div>
        <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">脱敏规则类型</h4>
        <div class="flex flex-wrap gap-1.5">
          <For each={RULE_TYPE_OPTIONS}>
            {(opt) => {
              const selected = () => props.config.ruleTypes.includes(opt.value);
              return (
                <button
                  type="button"
                  onClick={() => toggleRuleType(opt.value)}
                  class={`px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    selected()
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"
                  }`}
                >
                  {opt.label}
                </button>
              );
            }}
          </For>
        </div>
        {props.config.ruleTypes.length === 0 && (
          <p class="text-xs text-amber-600 mt-1.5">请至少选择一种脱敏规则</p>
        )}
      </div>

      {/* Placeholder Format */}
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">
          占位符格式
        </label>
        <input
          type="text"
          value={props.config.placeholderFormat}
          onInput={(e) =>
            props.onChange({ ...props.config, placeholderFormat: e.currentTarget.value })
          }
          placeholder="[MASKED_{type}_{index}]"
          class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
        />
        <p class="text-xs text-slate-400 mt-1">
          变量：{"{type}"} 规则类型，{"{index}"} 序号
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
