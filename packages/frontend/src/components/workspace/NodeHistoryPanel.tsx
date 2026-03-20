import { Show } from "solid-js";
import type { NodeExecution } from "@intelliflow/shared";
import Badge from "../ui/Badge";

type NodeHistoryPanelProps = {
  node: NodeExecution;
  isExpanded: boolean;
  onToggle: () => void;
};

const statusBadge: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" }> = {
  completed: { label: "已完成", variant: "success" },
  in_progress: { label: "进行中", variant: "warning" },
  pending: { label: "待执行", variant: "info" },
  skipped: { label: "已跳过", variant: "warning" },
  failed: { label: "失败", variant: "error" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN");
}

function formatJson(data: Record<string, unknown> | null): string {
  if (!data) return "(empty)";
  return JSON.stringify(data, null, 2);
}

export default function NodeHistoryPanel(props: NodeHistoryPanelProps) {
  const badge = () => statusBadge[props.node.status] ?? statusBadge.pending;

  return (
    <div class="border border-gray-200 rounded-lg bg-white">
      {/* Collapsed header */}
      <button
        type="button"
        class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={props.onToggle}
      >
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-800">{props.node.nodeLabel}</span>
          <Badge label={badge().label} variant={badge().variant} />
        </div>
        <div class="flex items-center gap-3">
          <Show when={props.node.completedAt}>
            <span class="text-xs text-gray-400">{formatTime(props.node.completedAt)}</span>
          </Show>
          <svg
            class={`w-4 h-4 text-gray-400 transition-transform ${props.isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      <Show when={props.isExpanded}>
        <div class="border-t border-gray-100 px-4 py-3 space-y-3">
          <Show when={props.node.inputData}>
            <div>
              <p class="text-xs font-medium text-gray-500 mb-1">Input</p>
              <pre class="text-xs bg-gray-50 rounded p-2 overflow-x-auto max-h-48 text-gray-700">
                {formatJson(props.node.inputData)}
              </pre>
            </div>
          </Show>
          <Show when={props.node.outputData}>
            <div>
              <p class="text-xs font-medium text-gray-500 mb-1">Output</p>
              <pre class="text-xs bg-gray-50 rounded p-2 overflow-x-auto max-h-48 text-gray-700">
                {formatJson(props.node.outputData)}
              </pre>
            </div>
          </Show>
          <Show when={props.node.errorMessage}>
            <div>
              <p class="text-xs font-medium text-red-500 mb-1">Error</p>
              <p class="text-xs text-red-600 bg-red-50 rounded p-2">{props.node.errorMessage}</p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
