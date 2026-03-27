import { For, Show, createResource, createSignal } from "solid-js";
import type { ModelCallConfig, VariableRef, OutputDef, NamedOutputDef } from "@intelliflow/shared";
import type { FlowNodeData, FlowEdgeData } from "../../../lib/flow-engine/types";
import { api } from "../../../api/client";
import PromptEditor from "../prompt/PromptEditor";
import JsonSchemaEditor from "./JsonSchemaEditor";

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

    const active = data.data.filter((m) => m.isActive && !m.isProviderDisabled && m.deploymentType !== "local");

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
          variableName: `${node.id}.${output.id}`,
        });
      }
    }
  }
  return refs;
}

const NAMED_OUTPUT_ID_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

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

  // System Prompt collapse state
  const [systemPromptExpanded, setSystemPromptExpanded] = createSignal(false);
  const hasSystemPrompt = () => props.config.systemPromptTemplate !== undefined;

  function toggleModel(modelId: string, displayName?: string) {
    const current = selectedModelIds();
    const isRemoving = current.includes(modelId);
    const next = isRemoving
      ? current.filter((id) => id !== modelId)
      : [...current, modelId];
    const names = { ...(props.config.modelNames ?? {}) };
    if (isRemoving) {
      delete names[modelId];
    } else if (displayName) {
      names[modelId] = displayName;
    }
    props.onChange({ ...props.config, modelIds: next, modelNames: names });
  }

  function handlePromptChange(template: string) {
    props.onChange({ ...props.config, promptTemplate: template });
  }

  // --- JSON Schema helpers ---
  function schemaToString(schema: object | undefined): string {
    if (!schema) return "";
    try {
      return JSON.stringify(schema, null, 2);
    } catch {
      return "";
    }
  }

  function parseSchemaString(str: string): object | undefined {
    if (!str.trim()) return undefined;
    try {
      return JSON.parse(str) as object;
    } catch {
      return undefined;
    }
  }

  // --- Named outputs helpers ---
  function addNamedOutput() {
    const current = props.config.namedOutputs ?? [];
    const newOutput: NamedOutputDef = {
      id: "",
      name: "",
      format: "text",
    };
    props.onChange({ ...props.config, namedOutputs: [...current, newOutput] });
  }

  function updateNamedOutput(index: number, patch: Partial<NamedOutputDef>) {
    const current = [...(props.config.namedOutputs ?? [])];
    current[index] = { ...current[index], ...patch };
    props.onChange({ ...props.config, namedOutputs: current });
  }

  function removeNamedOutput(index: number) {
    const current = [...(props.config.namedOutputs ?? [])];
    current.splice(index, 1);
    props.onChange({ ...props.config, namedOutputs: current });
  }

  // Track which named output schema sections are expanded
  const [expandedSchemas, setExpandedSchemas] = createSignal<Set<number>>(new Set());

  function toggleSchemaExpand(index: number) {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div class="space-y-4">
      {/* Model Selector -- multi-select checkbox list */}
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
                              onChange={() => toggleModel(model.id, model.displayName)}
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

      {/* Step Description */}
      <div class="border-t border-slate-100 pt-3">
        <label class="text-sm font-medium text-gray-700 mb-1 block">
          步骤描述
          <input
            type="text"
            value={props.config.stepDescription ?? ""}
            onInput={(e) => props.onChange({ ...props.config, stepDescription: e.currentTarget.value || undefined })}
            placeholder="可选：描述此步骤的用途"
            class="mt-1 w-full px-3 py-1.5 text-sm font-normal border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
          />
        </label>
      </div>

      {/* System Prompt — collapsible */}
      <div class="border-t border-slate-100 pt-3">
        <Show when={hasSystemPrompt()} fallback={
          <button
            type="button"
            class="text-xs text-purple-600 hover:text-purple-800 font-medium cursor-pointer"
            onClick={() => {
              props.onChange({ ...props.config, systemPromptTemplate: "" });
              setSystemPromptExpanded(true);
            }}
          >
            + 添加 System Prompt
          </button>
        }>
          {/* Header with expand/collapse toggle */}
          <div class="flex items-center justify-between mb-1">
            <button type="button" class="flex items-center gap-1 cursor-pointer" onClick={() => setSystemPromptExpanded(!systemPromptExpanded())}>
              <span class="text-xs text-gray-500">{systemPromptExpanded() ? "▼" : "▶"}</span>
              <span class="text-sm font-medium text-gray-700">System Prompt</span>
            </button>
            <button type="button" class="text-xs text-red-400 hover:text-red-600 cursor-pointer" onClick={() => {
              props.onChange({ ...props.config, systemPromptTemplate: undefined });
              setSystemPromptExpanded(false);
            }}>移除</button>
          </div>
          {/* Collapsed summary */}
          <Show when={!systemPromptExpanded()}>
            <p class="text-xs text-gray-400 truncate pl-4">
              {(props.config.systemPromptTemplate ?? "").slice(0, 50) || "(空)"}
              {(props.config.systemPromptTemplate ?? "").length > 50 ? "..." : ""}
            </p>
          </Show>
          {/* Expanded editor */}
          <Show when={systemPromptExpanded()}>
            <PromptEditor
              value={props.config.systemPromptTemplate ?? ""}
              availableVariables={availableVariables()}
              upstreamNodes={props.upstreamNodes}
              onChange={(v) => props.onChange({ ...props.config, systemPromptTemplate: v })}
            />
          </Show>
        </Show>
      </div>

      {/* User Prompt Editor */}
      <div class="border-t border-slate-100 pt-3">
        <p class="text-sm font-medium text-gray-700 mb-1">
          {hasSystemPrompt() ? "User Prompt" : "提示词模板"}
        </p>
        <PromptEditor
          value={props.config.promptTemplate}
          availableVariables={availableVariables()}
          upstreamNodes={props.upstreamNodes}
          onChange={handlePromptChange}
        />
      </div>

      {/* Output Format */}
      <div class="border-t border-slate-100 pt-3">
        <label class="text-sm font-medium text-gray-700 mb-1 block">
          输出格式
          <select
            value={props.config.outputFormat ?? "text"}
            onChange={(e) => {
              const value = e.currentTarget.value as "text" | "json" | "markdown";
              const update: Partial<ModelCallConfig> = { outputFormat: value };
              // Clear jsonSchema when switching away from json
              if (value !== "json") {
                update.jsonSchema = undefined;
              }
              props.onChange({ ...props.config, ...update });
            }}
            class="mt-1 w-full px-3 py-1.5 text-sm font-normal border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
          >
            <option value="text">文本</option>
            <option value="json">JSON</option>
            <option value="markdown">Markdown</option>
          </select>
        </label>
      </div>

      {/* JSON Schema Editor (conditional) */}
      <Show when={(props.config.outputFormat ?? "text") === "json"}>
        <div class="border-t border-slate-100 pt-3">
          <span class="text-sm font-medium text-gray-700 mb-1 block">JSON Schema (可选)</span>
          <JsonSchemaEditor
            value={schemaToString(props.config.jsonSchema)}
            onChange={(val) => {
              const parsed = parseSchemaString(val);
              props.onChange({ ...props.config, jsonSchema: parsed });
            }}
          />
          <p class="text-xs text-slate-400 mt-1">不填则仅做 JSON 语法校验，填写后额外做结构校验</p>
        </div>
      </Show>

      {/* Named Outputs */}
      <div class="border-t border-slate-100 pt-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">命名产物</span>
          <button
            type="button"
            onClick={addNamedOutput}
            class="px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors"
          >
            + 添加产物
          </button>
        </div>

        <Show
          when={(props.config.namedOutputs ?? []).length > 0}
          fallback={
            <p class="text-xs text-slate-400 italic py-2">
              未配置命名产物时，模型输出作为单个整体
            </p>
          }
        >
          <div class="space-y-3">
            <For each={props.config.namedOutputs ?? []}>
              {(output, index) => (
                <div class="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  <div class="flex items-start gap-2">
                    {/* ID input */}
                    <div class="flex-1 min-w-0">
                      <input
                        type="text"
                        value={output.id}
                        onInput={(e) => updateNamedOutput(index(), { id: e.currentTarget.value })}
                        placeholder="标识符, 如 blueprint"
                        class={`w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-400 ${
                          output.id && !NAMED_OUTPUT_ID_PATTERN.test(output.id)
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200"
                        }`}
                      />
                      <Show when={output.id && !NAMED_OUTPUT_ID_PATTERN.test(output.id)}>
                        <p class="text-xs text-red-500 mt-0.5">仅允许字母、数字、下划线，以字母或下划线开头</p>
                      </Show>
                    </div>

                    {/* Name input */}
                    <div class="flex-1 min-w-0">
                      <input
                        type="text"
                        value={output.name}
                        onInput={(e) => updateNamedOutput(index(), { name: e.currentTarget.value })}
                        placeholder="显示名称, 如 投标蓝图"
                        class="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    </div>

                    {/* Format dropdown */}
                    <select
                      value={output.format}
                      onChange={(e) => {
                        const fmt = e.currentTarget.value as "text" | "json" | "markdown";
                        const patch: Partial<NamedOutputDef> = { format: fmt };
                        if (fmt !== "json") {
                          patch.jsonSchema = undefined;
                        }
                        updateNamedOutput(index(), patch);
                      }}
                      class="px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                    >
                      <option value="text">文本</option>
                      <option value="json">JSON</option>
                      <option value="markdown">Markdown</option>
                    </select>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeNamedOutput(index())}
                      class="p-1 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="删除产物"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <title>删除</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Per-artifact JSON Schema (when format is json) */}
                  <Show when={output.format === "json"}>
                    <div class="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleSchemaExpand(index())}
                        class="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                      >
                        <svg
                          class={`w-3 h-3 transition-transform ${expandedSchemas().has(index()) ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                        >
                          <title>展开</title>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                        配置 Schema
                      </button>
                      <Show when={expandedSchemas().has(index())}>
                        <div class="mt-1.5">
                          <JsonSchemaEditor
                            value={schemaToString(output.jsonSchema)}
                            onChange={(val) => {
                              const parsed = parseSchemaString(val);
                              updateNamedOutput(index(), { jsonSchema: parsed });
                            }}
                          />
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
