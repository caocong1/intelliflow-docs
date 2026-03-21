import { For, Show } from "solid-js";
import type { WorkflowNodeDef, WorkflowNodeType } from "@intelliflow/shared";

/** Chinese labels for each node type */
const nodeTypeLabels: Record<WorkflowNodeType, string> = {
  input_transform: "输入转换",
  desensitize: "信息脱敏",
  model_call: "模型调用",
  restore: "信息恢复",
  export: "文件导出",
};

/** Color classes per node type */
const nodeTypeColors: Record<WorkflowNodeType, { bg: string; text: string; border: string }> = {
  input_transform: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  desensitize: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  model_call: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  restore: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  export: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

/** SVG icon per node type */
function NodeTypeIcon(props: { type: WorkflowNodeType }) {
  const iconClass = "w-4 h-4 shrink-0";
  switch (props.type) {
    case "input_transform":
      return (
        <svg class={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <title>输入转换</title>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      );
    case "desensitize":
      return (
        <svg class={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <title>信息脱敏</title>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case "model_call":
      return (
        <svg class={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <title>模型调用</title>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case "restore":
      return (
        <svg class={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <title>信息恢复</title>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case "export":
      return (
        <svg class={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <title>文件导出</title>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
}

interface WorkflowPreviewProps {
  nodes: WorkflowNodeDef[];
  description?: string;
}

export default function WorkflowPreview(props: WorkflowPreviewProps) {
  return (
    <div class="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">流程预览</h4>

      <Show when={props.description}>
        <p class="text-sm text-slate-600 mb-3">{props.description}</p>
      </Show>

      <div class="space-y-0">
        <For each={props.nodes}>
          {(node, index) => {
            const colors = () => nodeTypeColors[node.type];
            return (
              <div class="flex items-stretch gap-3">
                {/* Vertical connecting line + dot */}
                <div class="flex flex-col items-center w-5 shrink-0">
                  {/* Top connector line */}
                  <div class={`w-px flex-1 ${index() === 0 ? "bg-transparent" : "bg-slate-300"}`} />
                  {/* Dot */}
                  <div class={`w-2.5 h-2.5 rounded-full shrink-0 border-2 ${colors().border} ${colors().bg}`} />
                  {/* Bottom connector line */}
                  <div class={`w-px flex-1 ${index() === props.nodes.length - 1 ? "bg-transparent" : "bg-slate-300"}`} />
                </div>

                {/* Node card */}
                <div class="flex items-center gap-2 py-1.5 flex-1 min-w-0">
                  <span class={`${colors().text}`}>
                    <NodeTypeIcon type={node.type} />
                  </span>
                  <span class="text-sm text-slate-800 truncate">{node.label}</span>
                  <span class={`ml-auto text-xs px-1.5 py-0.5 rounded ${colors().bg} ${colors().text} ${colors().border} border shrink-0`}>
                    {nodeTypeLabels[node.type]}
                  </span>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <div class="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-400">
        共 {props.nodes.length} 个节点
      </div>
    </div>
  );
}

export { nodeTypeLabels };
