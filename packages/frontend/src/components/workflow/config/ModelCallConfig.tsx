import { For, createResource } from "solid-js";
import type { ModelCallConfig, VariableRef, OutputDef } from "@intelliflow/shared";
import type { WFNode, WFEdge } from "../../../pages/admin/WorkflowEditor";
import { api } from "../../../api/client";
import PromptEditor from "../prompt/PromptEditor";

type ApiModel = {
  id: string;
  displayName: string;
  isActive: boolean;
  isProviderDisabled: boolean;
};

type ProviderGroup = {
  providerId: string;
  providerName: string;
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
          models: [],
        });
      }
      groups.get(m.providerId)!.models.push(m);
    }
    return Array.from(groups.values());
  } catch {
    return [];
  }
}

/** Compute available variables from upstream nodes */
function computeAvailableVariables(upstreamNodes: WFNode[]): VariableRef[] {
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
  upstreamNodes: WFNode[];
  edges: WFEdge[];
  currentNodeId: string;
  onChange: (config: ModelCallConfig) => void;
}

export default function ModelCallConfigPanel(props: ModelCallConfigProps) {
  const [providerGroups] = createResource(fetchModels);

  const availableVariables = () => computeAvailableVariables(props.upstreamNodes);

  function handlePromptChange(template: string) {
    props.onChange({ ...props.config, promptTemplate: template });
  }

  return (
    <div class="space-y-4">
      {/* Display Name */}
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">节点显示名称</label>
        <input
          type="text"
          value={props.config.displayName}
          onInput={(e) =>
            props.onChange({ ...props.config, displayName: e.currentTarget.value })
          }
          placeholder="模型调用"
          class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
        />
      </div>

      {/* Model Selector */}
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">选择模型</label>
        <select
          value={props.config.modelId ?? ""}
          onChange={(e) =>
            props.onChange({
              ...props.config,
              modelId: e.currentTarget.value || null,
            })
          }
          class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
        >
          <option value="">(未选择)</option>
          <For each={providerGroups() ?? []}>
            {(group) => (
              <optgroup label={group.providerName}>
                <For each={group.models}>
                  {(model) => (
                    <option value={model.id}>{model.displayName}</option>
                  )}
                </For>
              </optgroup>
            )}
          </For>
        </select>
        {providerGroups.loading && (
          <p class="text-xs text-slate-400 mt-1">加载模型列表...</p>
        )}
        {!props.config.modelId && (
          <p class="text-xs text-amber-600 mt-1">请选择要调用的模型</p>
        )}
      </div>

      {/* Prompt Editor */}
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">提示词模板</label>
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
