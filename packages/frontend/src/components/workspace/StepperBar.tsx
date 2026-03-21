import { For } from "solid-js";
import type { NodeExecution, WorkflowNodeType } from "@intelliflow/shared";

type StepperBarProps = {
  nodes: NodeExecution[];
  currentIndex: number;
  onNodeClick: (index: number) => void;
};

const statusStyles: Record<string, string> = {
  completed: "bg-green-500 text-white",
  in_progress: "bg-indigo-500 text-white animate-pulse",
  pending: "bg-gray-300 text-gray-600",
  skipped: "bg-yellow-400 text-white",
  failed: "bg-red-500 text-white",
};

const statusLabels: Record<string, string> = {
  completed: "已完成",
  in_progress: "执行中",
  pending: "待执行",
  skipped: "已跳过",
  failed: "失败",
};

const nodeTypeLabels: Record<WorkflowNodeType, string> = {
  input_transform: "输入转换",
  desensitize: "信息脱敏",
  model_call: "模型调用",
  restore: "信息恢复",
  export: "文件导出",
};

const lineStyles: Record<string, string> = {
  completed: "bg-green-400",
  skipped: "bg-yellow-300",
  in_progress: "bg-gray-300",
  pending: "bg-gray-300",
  failed: "bg-red-300",
};

export default function StepperBar(props: StepperBarProps) {
  return (
    <div class="flex items-start overflow-x-auto pb-2 px-2">
      <For each={props.nodes}>
        {(node, index) => (
          <div class="flex items-start flex-shrink-0">
            {/* Step circle + label */}
            <button
              type="button"
              class="flex flex-col items-center cursor-pointer group bg-transparent border-0 p-0"
              onClick={() => {
                if (node.status === "completed" || node.status === "skipped") {
                  props.onNodeClick(index());
                }
              }}
            >
              <div
                class={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-transform ${
                  statusStyles[node.status] ?? statusStyles.pending
                } ${
                  node.status === "completed" || node.status === "skipped"
                    ? "group-hover:scale-110"
                    : ""
                }`}
                title={`${statusLabels[node.status] ?? node.status}`}
              >
                {index() + 1}
              </div>
              <span
                class={`mt-1.5 text-xs max-w-[80px] text-center truncate ${
                  index() === props.currentIndex
                    ? "text-indigo-700 font-semibold"
                    : "text-gray-500"
                }`}
                title={`${node.nodeLabel} (${nodeTypeLabels[node.nodeType] ?? node.nodeType})`}
              >
                {node.nodeLabel}
              </span>
              <span class="text-[10px] text-gray-400 mt-0.5">
                {statusLabels[node.status] ?? node.status}
              </span>
            </button>

            {/* Connecting line */}
            {index() < props.nodes.length - 1 && (
              <div class="flex items-center mt-4 mx-1">
                <div
                  class={`h-0.5 w-8 ${
                    lineStyles[node.status] ?? lineStyles.pending
                  }`}
                />
              </div>
            )}
          </div>
        )}
      </For>
    </div>
  );
}
