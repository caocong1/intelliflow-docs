import { Handle, type NodeProps } from "@dschz/solid-flow";
import type { WorkflowNodeType } from "@intelliflow/shared";

type WorkflowNodeData = {
  nodeType: WorkflowNodeType;
  label: string;
  config: Record<string, unknown>;
  outputs: unknown[];
  onSelect?: (id: string) => void;
};

function isConfigured(config: Record<string, unknown>): boolean {
  return config.modelId != null && config.modelId !== "";
}

export default function ModelCallNode(props: NodeProps<WorkflowNodeData, "model_call">) {
  const configured = () => isConfigured(props.data.config ?? {});

  return (
    <div
      class="min-w-[180px] bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      style={{ "border-left": "4px solid #a855f7" }}
      onClick={() => props.data.onSelect?.(props.id)}
    >
      <Handle type="target" position="left" />

      <div class="px-3 py-2.5">
        <div class="flex items-center gap-2">
          <span class="text-base leading-none">🤖</span>
          <span class="text-xs font-semibold text-purple-700 flex-1 truncate">{props.data.label}</span>
          <span
            class={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
              configured()
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
            }`}
          >
            {configured() ? "已配置" : "未配置"}
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">模型调用</p>
      </div>

      <Handle type="source" position="right" />
    </div>
  );
}
