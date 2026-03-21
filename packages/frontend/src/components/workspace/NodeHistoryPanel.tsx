import { createSignal, For, Show } from "solid-js";
import type { NodeExecution } from "@intelliflow/shared";
import Badge from "../ui/Badge";

type NodeHistoryPanelProps = {
  node: NodeExecution;
  isExpanded: boolean;
  onToggle: () => void;
  /** All executions for this nodeId across rounds (optional, for round selector) */
  allExecutions?: NodeExecution[];
};

const statusBadge: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" }> = {
  completed: { label: "已完成", variant: "success" },
  in_progress: { label: "执行中", variant: "warning" },
  pending: { label: "待执行", variant: "info" },
  skipped: { label: "已跳过", variant: "warning" },
  failed: { label: "失败", variant: "error" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN");
}

function formatJson(data: Record<string, unknown> | null): string {
  if (!data) return "(空)";
  return JSON.stringify(data, null, 2);
}

export default function NodeHistoryPanel(props: NodeHistoryPanelProps) {
  const badge = () => statusBadge[props.node.status] ?? statusBadge.pending;

  // Execution round selector state
  const [selectedRound, setSelectedRound] = createSignal(props.node.executionRound ?? 1);

  /** Get the execution for the selected round */
  const displayedNode = (): NodeExecution => {
    if (!props.allExecutions || props.allExecutions.length <= 1) return props.node;
    const found = props.allExecutions.find((e) => e.executionRound === selectedRound());
    return found ?? props.node;
  };

  /** Check if multiple rounds exist */
  const hasMultipleRounds = (): boolean => {
    if (props.allExecutions && props.allExecutions.length > 1) return true;
    return (props.node.executionRound ?? 1) > 1;
  };

  /** Get max round number */
  const maxRound = (): number => {
    if (props.allExecutions) {
      return Math.max(...props.allExecutions.map((e) => e.executionRound ?? 1));
    }
    return props.node.executionRound ?? 1;
  };

  return (
    <div class="border border-gray-200 rounded-lg bg-white">
      {/* Collapsed header */}
      <button
        type="button"
        class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer"
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
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      <Show when={props.isExpanded}>
        <div class="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Execution round selector */}
          <Show when={hasMultipleRounds()}>
            <div class="flex items-center gap-2 mb-2">
              <label for="exec-round-select" class="text-xs font-medium text-gray-500">执行轮次:</label>
              <select
                id="exec-round-select"
                class="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700"
                value={selectedRound()}
                onChange={(e) => setSelectedRound(Number(e.currentTarget.value))}
              >
                <For each={Array.from({ length: maxRound() }, (_, i) => i + 1)}>
                  {(round) => (
                    <option value={round}>第{round}次</option>
                  )}
                </For>
              </select>
            </div>
          </Show>

          {/* Status */}
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-500">状态:</span>
            <Badge
              label={(statusBadge[displayedNode().status] ?? statusBadge.pending).label}
              variant={(statusBadge[displayedNode().status] ?? statusBadge.pending).variant}
            />
          </div>

          {/* Execution time */}
          <Show when={displayedNode().startedAt || displayedNode().completedAt}>
            <div>
              <p class="text-xs font-medium text-gray-500 mb-1">执行时间</p>
              <div class="text-xs text-gray-600">
                <Show when={displayedNode().startedAt}>
                  <span>开始: {formatTime(displayedNode().startedAt)}</span>
                </Show>
                <Show when={displayedNode().completedAt}>
                  <span class="ml-3">完成: {formatTime(displayedNode().completedAt)}</span>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={displayedNode().inputData}>
            <div>
              <p class="text-xs font-medium text-gray-500 mb-1">输入数据</p>
              <pre class="text-xs bg-gray-50 rounded p-2 overflow-x-auto max-h-48 text-gray-700">
                {formatJson(displayedNode().inputData)}
              </pre>
            </div>
          </Show>
          <Show when={displayedNode().outputData}>
            <div>
              <p class="text-xs font-medium text-gray-500 mb-1">输出数据</p>
              <pre class="text-xs bg-gray-50 rounded p-2 overflow-x-auto max-h-48 text-gray-700">
                {formatJson(displayedNode().outputData)}
              </pre>
            </div>
          </Show>
          <Show when={displayedNode().errorMessage}>
            <div>
              <p class="text-xs font-medium text-red-500 mb-1">错误信息</p>
              <p class="text-xs text-red-600 bg-red-50 rounded p-2">{displayedNode().errorMessage}</p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
