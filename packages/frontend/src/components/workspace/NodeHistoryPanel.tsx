import type { NodeExecution } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";
import Badge from "../ui/Badge";

type NodeHistoryPanelProps = {
  node: NodeExecution;
  isExpanded: boolean;
  onToggle: () => void;
  /** All executions for this nodeId across rounds (optional, for round selector) */
  allExecutions?: NodeExecution[];
};

const statusBadge: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" | "info" }
> = {
  completed: { label: "已完成", variant: "success" },
  in_progress: { label: "执行中", variant: "warning" },
  pending: { label: "待执行", variant: "info" },
  skipped: { label: "已跳过", variant: "warning" },
  failed: { label: "失败", variant: "error" },
  blocked: { label: "已阻断", variant: "error" },
};

/** Get the badge for a node, with conditional skip differentiation */
function getNodeBadge(node: NodeExecution) {
  const base = statusBadge[node.status] ?? statusBadge.pending;
  if (node.status === "skipped") {
    const skipType = (node.outputData as Record<string, unknown> | null)?.skipType;
    if (skipType === "conditional") {
      return { label: "条件跳过", variant: "warning" as const };
    }
    return { label: "用户跳过", variant: "warning" as const };
  }
  return base;
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN");
}

function formatJson(data: Record<string, unknown> | null): string {
  if (!data) return "(空)";
  return JSON.stringify(data, null, 2);
}

export default function NodeHistoryPanel(props: NodeHistoryPanelProps) {
  const badge = () => getNodeBadge(props.node);

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
    <div class="rounded-xl bg-[#f7f9fb] overflow-hidden transition-all">
      {/* Collapsed header */}
      <button
        type="button"
        class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[rgba(199,196,216,0.12)] transition-colors cursor-pointer"
        onClick={props.onToggle}
      >
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-[#191c1e]">{props.node.nodeLabel}</span>
          <Badge label={badge().label} variant={badge().variant} />
        </div>
        <div class="flex items-center gap-3">
          <Show when={props.node.completedAt}>
            <span class="text-xs text-[#464555] opacity-60">
              {formatTime(props.node.completedAt)}
            </span>
          </Show>
          <svg
            class={`w-4 h-4 text-[#464555] transition-transform duration-200 ${props.isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      <Show when={props.isExpanded}>
        <div class="px-4 pb-4 space-y-3">
          {/* Divider */}
          <div class="h-px bg-[rgba(199,196,216,0.2)]" />

          {/* Execution round selector */}
          <Show when={hasMultipleRounds()}>
            <div class="flex items-center gap-2 mb-2">
              <label for="exec-round-select" class="text-xs font-medium text-[#464555]">
                执行轮次:
              </label>
              <select
                id="exec-round-select"
                class="text-xs border border-[rgba(199,196,216,0.3)] rounded-lg px-2 py-1 bg-white text-[#464555] focus:outline-none focus:ring-2 focus:ring-[#c3c0ff] focus:border-[#4f46e5]"
                value={selectedRound()}
                onChange={(e) => setSelectedRound(Number(e.currentTarget.value))}
              >
                <For each={Array.from({ length: maxRound() }, (_, i) => i + 1)}>
                  {(round) => <option value={round}>第{round}次</option>}
                </For>
              </select>
            </div>
          </Show>

          {/* Status */}
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-[#464555]">状态:</span>
            <Badge
              label={getNodeBadge(displayedNode()).label}
              variant={getNodeBadge(displayedNode()).variant}
            />
          </div>

          {/* Execution time */}
          <Show when={displayedNode().startedAt || displayedNode().completedAt}>
            <div>
              <p class="text-xs font-medium text-[#464555] mb-1">执行时间</p>
              <div class="text-xs text-[#464555]">
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
              <div class="flex items-center gap-1.5 mb-1">
                <div class="w-1 h-3 bg-[#4f46e5] rounded-full" />
                <p class="text-xs font-medium text-[#191c1e]">输入数据</p>
              </div>
              <pre class="text-xs bg-white rounded-xl p-3 overflow-x-auto max-h-48 text-[#464555] border border-[rgba(199,196,216,0.15)]">
                {formatJson(displayedNode().inputData)}
              </pre>
            </div>
          </Show>
          <Show when={displayedNode().outputData}>
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <div class="w-1 h-3 bg-[#4f46e5] rounded-full" />
                <p class="text-xs font-medium text-[#191c1e]">输出数据</p>
              </div>
              <pre class="text-xs bg-white rounded-xl p-3 overflow-x-auto max-h-48 text-[#464555] border border-[rgba(199,196,216,0.15)]">
                {formatJson(displayedNode().outputData)}
              </pre>
            </div>
          </Show>
          <Show when={displayedNode().errorMessage}>
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <div class="w-1 h-3 bg-red-500 rounded-full" />
                <p class="text-xs font-medium text-red-600">错误信息</p>
              </div>
              <p class="text-xs text-red-600 bg-red-50 rounded-xl p-3">
                {displayedNode().errorMessage}
              </p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
