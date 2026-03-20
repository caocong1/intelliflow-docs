import { Show, Switch, Match, For } from "solid-js";
import type {
  NodeConfig,
  InputTransformConfig,
  DesensitizeConfig,
  ModelCallConfig,
  RestoreConfig,
  ExportConfig,
} from "@intelliflow/shared";
import type { WFNode, WFEdge } from "../../../pages/admin/WorkflowEditor";
import { deriveOutputs } from "../../../lib/flow-engine/derive-outputs";
import RuntimeSettings from "./RuntimeSettings";
import InputTransformConfigPanel from "./InputTransformConfig";
import DesensitizeConfigPanel from "./DesensitizeConfig";
import RestoreConfigPanel from "./RestoreConfig";
import ExportConfigPanel from "./ExportConfig";
import ModelCallConfigPanel from "./ModelCallConfig";

const NODE_TYPE_LABELS: Record<string, string> = {
  input_transform: "输入转换",
  desensitize: "信息脱敏",
  model_call: "模型调用",
  restore: "信息恢复",
  export: "文件导出",
};

const NODE_TYPE_ICONS: Record<string, string> = {
  input_transform: "📥",
  desensitize: "🔒",
  model_call: "🤖",
  restore: "🔓",
  export: "📤",
};

const NODE_TYPE_COLORS: Record<string, string> = {
  input_transform: "border-blue-500",
  desensitize: "border-orange-500",
  model_call: "border-purple-500",
  restore: "border-green-500",
  export: "border-red-500",
};

interface ConfigPanelProps {
  selectedNode: WFNode | null;
  allNodes: WFNode[];
  edges: WFEdge[];
  onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
  onLabelChange: (nodeId: string, label: string) => void;
  onClose: () => void;
}

/** Traverse edges backward from nodeId to find all upstream node IDs */
function getUpstreamNodeIds(nodeId: string, edges: WFEdge[]): Set<string> {
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const edge of edges) {
      if (edge.target === current && !visited.has(edge.source)) {
        visited.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return visited;
}

export default function ConfigPanel(props: ConfigPanelProps) {
  const isOpen = () => props.selectedNode !== null;

  const upstreamNodes = () => {
    if (!props.selectedNode) return [];
    const upstreamIds = getUpstreamNodeIds(props.selectedNode.id, props.edges);
    return props.allNodes.filter((n) => upstreamIds.has(n.id));
  };

  const nodeConfig = () => props.selectedNode?.data.config as Record<string, unknown> | undefined;

  function handleConfigChange(config: Record<string, unknown>) {
    if (props.selectedNode) {
      props.onConfigChange(props.selectedNode.id, config);
    }
  }

  function handleRuntimeChange(updates: Partial<NodeConfig>) {
    const current = nodeConfig();
    if (props.selectedNode && current) {
      props.onConfigChange(props.selectedNode.id, { ...current, ...updates });
    }
  }

  function handleLabelChange(label: string) {
    if (props.selectedNode) {
      props.onLabelChange(props.selectedNode.id, label);
    }
  }

  const nodeType = () => props.selectedNode?.data.nodeType ?? "input_transform";

  /** Auto-derived outputs from node config */
  const derivedOutputs = () => {
    const config = nodeConfig();
    const node = props.selectedNode;
    if (!node || !config) return [];
    return deriveOutputs(node.id, config as unknown as NodeConfig);
  };

  return (
    <div
      class={`flex-shrink-0 bg-white border-l border-slate-200 flex flex-col transition-all duration-200 overflow-hidden ${
        isOpen() ? "w-80" : "w-0"
      }`}
    >
      <Show when={props.selectedNode}>
        {(node) => (
          <>
            {/* Panel Header */}
            <div class={`flex items-center gap-2 px-4 py-3 border-b border-slate-100 border-l-4 ${NODE_TYPE_COLORS[nodeType()] ?? "border-slate-400"}`}>
              <span class="text-lg leading-none flex-shrink-0">
                {NODE_TYPE_ICONS[nodeType()] ?? "⚙️"}
              </span>
              <input
                type="text"
                value={node().data.label}
                onInput={(e) => handleLabelChange(e.currentTarget.value)}
                class="flex-1 text-sm font-semibold text-slate-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 min-w-0"
                placeholder="节点名称"
              />
              <button
                type="button"
                onClick={props.onClose}
                class="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
                title="关闭配置面板"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <title>关闭</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Node Type Label */}
            <div class="px-4 py-1.5 bg-slate-50 border-b border-slate-100">
              <span class="text-xs text-slate-400">{NODE_TYPE_LABELS[nodeType()] ?? nodeType()}</span>
            </div>

            {/* Panel Body (scrollable) */}
            <div class="flex-1 overflow-y-auto px-4 py-4">
              <Switch>
                <Match when={nodeType() === "input_transform" && nodeConfig()}>
                  <InputTransformConfigPanel
                    config={nodeConfig() as unknown as InputTransformConfig}
                    onChange={(c) => handleConfigChange(c as unknown as Record<string, unknown>)}
                  />
                </Match>

                <Match when={nodeType() === "desensitize" && nodeConfig()}>
                  <DesensitizeConfigPanel
                    config={nodeConfig() as unknown as DesensitizeConfig}
                    onChange={(c) => handleConfigChange(c as unknown as Record<string, unknown>)}
                  />
                </Match>

                <Match when={nodeType() === "model_call" && nodeConfig()}>
                  <ModelCallConfigPanel
                    config={nodeConfig() as unknown as ModelCallConfig}
                    upstreamNodes={upstreamNodes()}
                    edges={props.edges}
                    currentNodeId={node().id}
                    onChange={(c) => handleConfigChange(c as unknown as Record<string, unknown>)}
                  />
                </Match>

                <Match when={nodeType() === "restore" && nodeConfig()}>
                  <RestoreConfigPanel
                    config={nodeConfig() as unknown as RestoreConfig}
                    allNodes={props.allNodes}
                    onChange={(c) => handleConfigChange(c as unknown as Record<string, unknown>)}
                  />
                </Match>

                <Match when={nodeType() === "export" && nodeConfig()}>
                  <ExportConfigPanel
                    config={nodeConfig() as unknown as ExportConfig}
                    allNodes={props.allNodes}
                    upstreamNodes={upstreamNodes()}
                    onChange={(c) => handleConfigChange(c as unknown as Record<string, unknown>)}
                  />
                </Match>
              </Switch>

              {/* Runtime Settings — common to all node types */}
              <Show when={nodeConfig()}>
                <RuntimeSettings
                  config={nodeConfig() as unknown as NodeConfig}
                  onChange={handleRuntimeChange}
                />
              </Show>

              {/* Auto-derived outputs — read-only display */}
              <div class="mt-4 border-t border-slate-100 pt-4">
                <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">节点输出</h4>
                <Show
                  when={derivedOutputs().length > 0}
                  fallback={
                    <p class="text-xs text-slate-400 italic text-center py-2">
                      无输出（请先完成节点配置）
                    </p>
                  }
                >
                  <div class="flex flex-wrap gap-1.5">
                    <For each={derivedOutputs()}>
                      {(output) => (
                        <span
                          class="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                          title={output.description ?? output.name}
                        >
                          {output.name}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </>
        )}
      </Show>

      {/* Empty state hint when panel is open but no node selected */}
      <Show when={!isOpen()}>
        <div class="flex items-center justify-center h-full">
          <p class="text-xs text-slate-400 text-center px-4">选择节点以配置参数</p>
        </div>
      </Show>
    </div>
  );
}
