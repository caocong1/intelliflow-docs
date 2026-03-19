import { Show, Switch, Match } from "solid-js";
import type {
  OutputDef,
  InputTransformConfig,
  DesensitizeConfig,
  ModelCallConfig,
  RestoreConfig,
  ExportConfig,
} from "@intelliflow/shared";
import type { WFNode, WFEdge } from "../../../pages/admin/WorkflowEditor";
import OutputsEditor from "./OutputsEditor";
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
  onOutputsChange: (nodeId: string, outputs: OutputDef[]) => void;
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
  const nodeOutputs = () => (props.selectedNode?.data.outputs ?? []) as OutputDef[];

  function handleConfigChange(config: Record<string, unknown>) {
    if (props.selectedNode) {
      props.onConfigChange(props.selectedNode.id, config);
    }
  }

  function handleOutputsChange(outputs: OutputDef[]) {
    if (props.selectedNode) {
      props.onOutputsChange(props.selectedNode.id, outputs);
    }
  }

  function handleLabelChange(label: string) {
    if (props.selectedNode) {
      props.onLabelChange(props.selectedNode.id, label);
    }
  }

  const nodeType = () => props.selectedNode?.data.nodeType ?? "input_transform";

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

              {/* Outputs Editor — common to all node types */}
              <OutputsEditor
                outputs={nodeOutputs()}
                onChange={handleOutputsChange}
              />
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
