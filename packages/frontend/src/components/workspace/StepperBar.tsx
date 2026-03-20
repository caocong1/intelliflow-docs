import { For } from "solid-js";
import type { NodeExecution } from "@intelliflow/shared";

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
            <div
              class="flex flex-col items-center cursor-pointer group"
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
              >
                {index() + 1}
              </div>
              <span
                class={`mt-1.5 text-xs max-w-[80px] text-center truncate ${
                  index() === props.currentIndex
                    ? "text-indigo-700 font-semibold"
                    : "text-gray-500"
                }`}
                title={node.nodeLabel}
              >
                {node.nodeLabel}
              </span>
            </div>

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
