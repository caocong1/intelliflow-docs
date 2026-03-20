import { For, Show, createResource } from "solid-js";
import type { ModelCallConfig, VariableRef, OutputDef } from "@intelliflow/shared";
import type { FlowNodeData, FlowEdgeData } from "../../../lib/flow-engine/types";
import { api } from "../../../api/client";
import PromptEditor from "../prompt/PromptEditor";

type ApiModel = {
  id: string;
  displayName: string;
  isActive: boolean;
  isProviderDisabled: boolean;
  deploymentType?: string;
};

type ProviderGroup = {
  providerId: string;
  providerName: string;
  deploymentType: string;
  models: ApiModel[];
};

async function fetchModels(): Promise<ProviderGroup[]> {
  try {
    const res = await (api.api as unknown as {
      models: {
        get: (opts: { query: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>;
      };
    }).models.get({ query: {} });

    if (res.error || !res.data) return [];

    const data = res.data as {
      data: Array<{
        id: string;
        displayName: string;
        providerId: string;
        providerName?: string;
        deploymentType?: string;
        isActive: boolean;
        isProviderDisabled: boolean;
      }>;
    };

    const active = data.data.filter((m) => m.isActive && !m.isProviderDisabled);

    // Group by providerId
    const groups = new Map<string, ProviderGroup>();
    for (const m of active) {
      if (!groups.has(m.providerId)) {
        groups.set(m.providerId, {
          providerId: m.providerId,
          providerName: m.providerName ?? m.providerId,
          deploymentType: m.deploymentType ?? "cloud",
          models: [],
        });
      }
      const group = groups.get(m.providerId);
      if (group) group.models.push(m);
    }
    return Array.from(groups.values());
  } catch {
    return [];
  }
}

/** Compute available variables from upstream nodes */
function computeAvailableVariables(upstreamNodes: FlowNodeData[]): VariableRef[] {
  const refs: VariableRef[] = [];
  for (const node of upstreamNodes) {
    const outputs = node.data.outputs as OutputDef[];
    for (const output of outputs) {
      if (output.name) {
        refs.push({
          nodeId: node.id,
          outputId: output.id,
          variableName: `${node.data.label}.${output.name}`,
        });
      }
    }
  }
  return refs;
}

interface ModelCallConfigProps {
  config: ModelCallConfig;
  upstreamNodes: FlowNodeData[];
  edges: FlowEdgeData[];
  currentNodeId: string;
  onChange: (config: ModelCallConfig) => void;
}

export default function ModelCallConfigPanel(props: ModelCallConfigProps) {
  const [providerGroups] = createResource(fetchModels);

  const availableVariables = () => computeAvailableVariables(props.upstreamNodes);

  const selectedModelIds = () => props.config.modelIds ?? [];

  function toggleModel(modelId: string) {
    const current = selectedModelIds();
    const next = current.includes(modelId)
      ? current.filter((id) => id !== modelId)
      : [...current, modelId];
    props.onChange({ ...props.config, modelIds: next });
  }

  function handlePromptChange(template: string) {
    props.onChange({ ...props.config, promptTemplate: template });
  }

  return (
    <div class="space-y-4">
      {/* Model Selector — multi-select checkbox list */}
      <div>
        <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">选择模型</h4>

        <Show
          when={!providerGroups.loading}
          fallback={<p class="text-xs text-slate-400">加载模型列表...</p>}
        >
          <Show
            when={(providerGroups() ?? []).length > 0}
            fallback={<p class="text-xs text-slate-400 italic">暂无可用模型</p>}
          >
            <div class="space-y-3">
              <For each={providerGroups() ?? []}>
                {(group) => (
                  <div>
                    <div class="flex items-center gap-1.5 mb-1">
                      <span class="text-xs font-medium text-slate-600">{group.providerName}</span>
                      <span class={`px-1.5 py-0.5 text-xs rounded-full ${
                        group.deploymentType === "local"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {group.deploymentType === "local" ? "本地" : "云端"}
                      </span>
                    </div>
                    <div class="space-y-1">
                      <For each={group.models}>
                        {(model) => (
                          <label class="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={selectedModelIds().includes(model.id)}
                              onChange={() => toggleModel(model.id)}
                              class="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <span class="text-xs text-slate-800">{model.displayName}</span>
                          </label>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>

        {selectedModelIds().length === 0 && (
          <p class="text-xs text-amber-600 mt-1.5">请至少选择一个模型</p>
        )}

        {selectedModelIds().length > 1 && (
          <p class="text-xs text-purple-600 mt-1.5">
            已选择 {selectedModelIds().length} 个模型 -- 将并行调用并生成对比结果
          </p>
        )}
      </div>

      {/* Prompt Editor */}
      <div class="border-t border-slate-100 pt-3">
        <p class="text-sm font-medium text-gray-700 mb-1">提示词模板</p>
        <PromptEditor
          value={props.config.promptTemplate}
          availableVariables={availableVariables()}
          upstreamNodes={props.upstreamNodes}
          onChange={handlePromptChange}
        />
      </div>
    </div>
  );
}
