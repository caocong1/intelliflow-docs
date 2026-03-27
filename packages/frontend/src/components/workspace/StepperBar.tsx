import type { NodeExecution, WorkflowNodeType } from "@intelliflow/shared";
import { For, Show } from "solid-js";

type StepperBarProps = {
  nodes: NodeExecution[];
  currentIndex: number;
  onNodeClick: (index: number) => void;
  /** Show a virtual "结果" step at the end when all nodes are done */
  showResultStep?: boolean;
  /** Called when the virtual result step is clicked */
  onResultClick?: () => void;
};

const nodeTypeLabels: Record<WorkflowNodeType, string> = {
  input_transform: "输入转换",
  desensitize: "信息脱敏",
  model_call: "模型调用",
  restore: "信息恢复",
  export: "文件导出",
};

const nodeTypeIcons: Record<WorkflowNodeType, string> = {
  input_transform: "M4 6h16M4 12h8m-8 6h16",
  desensitize:
    "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  model_call:
    "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  restore:
    "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  export: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
};

function CheckIcon() {
  return (
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Trophy icon for the virtual result step */
function TrophyIcon() {
  return (
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M5 3h14M9 3v2a3 3 0 006 0V3M7 3H5a2 2 0 00-2 2v2a4 4 0 004 4h0M17 3h2a2 2 0 012 2v2a4 4 0 01-4 4h0M12 15v4M8 19h8"
      />
    </svg>
  );
}

function NodeIcon(props: { nodeType: WorkflowNodeType }) {
  const d = nodeTypeIcons[props.nodeType] ?? nodeTypeIcons.model_call;
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={d} />
    </svg>
  );
}

function getCircleStyle(
  status: string,
  isActive: boolean,
): { bg: string; color: string; ring?: string } {
  if (status === "completed") return { bg: "#22c55e", color: "#ffffff" };
  if (status === "skipped") return { bg: "#f59e0b", color: "#ffffff" };
  if (status === "failed" || status === "blocked") return { bg: "#ef4444", color: "#ffffff" };
  if (isActive || status === "in_progress")
    return { bg: "#4f46e5", color: "#ffffff", ring: "0 0 0 4px rgba(99,102,241,0.2)" };
  return { bg: "#e6e8ea", color: "#464555" };
}

function getLineStyle(status: string, _nextStatus: string): string {
  if (status === "completed" || status === "skipped") return "#22c55e";
  if (status === "blocked") return "#ef4444";
  if (status === "in_progress") return "#c7c4d8";
  return "#e0e3e5";
}

export default function StepperBar(props: StepperBarProps) {
  const resultIndex = () => props.nodes.length;
  const isResultActive = () => props.showResultStep && props.currentIndex === resultIndex();

  return (
    <div class="flex items-start overflow-x-auto pt-1 pb-2 px-1">
      <For each={props.nodes}>
        {(node, index) => {
          const isActive = () => index() === props.currentIndex;
          const circleStyle = () => getCircleStyle(node.status, isActive());
          const isClickable = node.status === "completed" || node.status === "skipped";
          const nextNode = () => props.nodes[index() + 1];
          const isLast = () => index() === props.nodes.length - 1;

          return (
            <div class="flex items-start flex-shrink-0">
              {/* Step circle + labels */}
              <button
                type="button"
                class="flex flex-col items-center bg-transparent border-0 p-0 group"
                style={{ cursor: isClickable ? "pointer" : "default", "min-width": "5rem" }}
                onClick={() => {
                  if (isClickable) props.onNodeClick(index());
                }}
                title={`${node.nodeLabel} (${nodeTypeLabels[node.nodeType] ?? node.nodeType})`}
              >
                {/* Circle */}
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center transition-transform"
                  style={{
                    background: circleStyle().bg,
                    color: circleStyle().color,
                    "box-shadow": circleStyle().ring ? "0 0 0 4px rgba(99,102,241,0.2)" : "none",
                    transform: isClickable ? undefined : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (isClickable)
                      (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                  }}
                >
                  {node.status === "completed" ? (
                    <CheckIcon />
                  ) : (
                    <NodeIcon nodeType={node.nodeType} />
                  )}
                </div>

                {/* Node label */}
                <span
                  class="mt-2 text-xs text-center leading-tight max-w-[72px] line-clamp-2"
                  style={{
                    color: isActive() ? "#3525cd" : "#191c1e",
                    "font-weight": isActive() ? "600" : "500",
                  }}
                >
                  {node.nodeLabel}
                </span>

                {/* Status label for blocked nodes */}
                <Show when={node.status === "blocked"}>
                  <span class="text-[10px] text-center font-medium" style={{ color: "#dc2626" }}>
                    (已阻断)
                  </span>
                </Show>

                {/* Node type badge */}
                <span class="mt-0.5 text-[10px] text-center" style={{ color: "#464555" }}>
                  {nodeTypeLabels[node.nodeType] ?? node.nodeType}
                </span>
              </button>

              {/* Connecting line — always show if not the very last element (accounting for result step) */}
              {(!isLast() || props.showResultStep) && (
                <div class="flex items-center mt-5 mx-1 flex-shrink-0">
                  <div
                    class="h-0.5 w-8 rounded-full transition-colors"
                    style={{
                      background:
                        isLast() && props.showResultStep
                          ? node.status === "completed" || node.status === "skipped"
                            ? "#c7c4d8"
                            : "#e0e3e5"
                          : getLineStyle(node.status, nextNode()?.status ?? "pending"),
                    }}
                  />
                </div>
              )}
            </div>
          );
        }}
      </For>

      {/* Virtual "结果" step */}
      <Show when={props.showResultStep}>
        <div class="flex items-start flex-shrink-0">
          <button
            type="button"
            class="flex flex-col items-center bg-transparent border-0 p-0 group"
            style={{ cursor: "pointer", "min-width": "5rem" }}
            onClick={() => props.onResultClick?.()}
            title="查看结果总览"
          >
            {/* Circle — gradient bg when active, gray when not */}
            <div
              class="w-11 h-11 rounded-full flex items-center justify-center transition-transform"
              style={{
                background: isResultActive()
                  ? "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)"
                  : "#e6e8ea",
                color: isResultActive() ? "#ffffff" : "#464555",
                "box-shadow": isResultActive() ? "0 0 0 4px rgba(99,102,241,0.2)" : "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }}
            >
              <TrophyIcon />
            </div>

            {/* Label */}
            <span
              class="mt-2 text-xs text-center leading-tight font-semibold"
              style={{ color: isResultActive() ? "#3525cd" : "#191c1e" }}
            >
              结果
            </span>

            {/* Type badge */}
            <span class="mt-0.5 text-[10px] text-center" style={{ color: "#464555" }}>
              总览
            </span>
          </button>
        </div>
      </Show>
    </div>
  );
}
