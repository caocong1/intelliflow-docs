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
  /** Render as vertical sidebar instead of horizontal bar */
  vertical?: boolean;
};

export const nodeTypeLabels: Record<WorkflowNodeType, string> = {
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

function CheckIconSmall() {
  return (
    <svg
      class="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
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

function TrophyIconSmall() {
  return (
    <svg
      class="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2.5"
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

function NodeIconSmall(props: { nodeType: WorkflowNodeType }) {
  const d = nodeTypeIcons[props.nodeType] ?? nodeTypeIcons.model_call;
  return (
    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d={d} />
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
  if (status === "completed") return "#22c55e";
  if (status === "skipped") return "#f59e0b";
  if (status === "blocked") return "#ef4444";
  if (status === "in_progress") return "#c7c4d8";
  return "#e0e3e5";
}

function isNodeClickable(status: NodeExecution["status"]): boolean {
  return (
    status === "completed" ||
    status === "skipped" ||
    status === "in_progress" ||
    status === "failed" ||
    status === "blocked"
  );
}

function getNodeStatusLabel(node: NodeExecution): { text: string; color: string } | null {
  if (node.status === "blocked") return { text: "已阻断", color: "#dc2626" };
  if (node.status === "skipped") {
    const skipType = (node.outputData as Record<string, unknown> | null)?.skipType;
    if (skipType === "conditional") return { text: "条件跳过", color: "#d97706" };
    if (skipType === "automatic") return { text: "自动跳过", color: "#d97706" };
    return { text: "已跳过", color: "#d97706" };
  }
  return null;
}

// ─── Vertical (sidebar) layout ─────────────────────────────────────

function VerticalStepper(props: StepperBarProps) {
  const resultIndex = () => props.nodes.length;
  const isResultActive = () => props.showResultStep && props.currentIndex === resultIndex();

  return (
    <div class="flex flex-col py-3 px-3 overflow-y-auto">
      <For each={props.nodes}>
        {(node, index) => {
          const isActive = () => index() === props.currentIndex;
          const circleStyle = () => getCircleStyle(node.status, isActive());
          const isClickable = isNodeClickable(node.status);
          const nextNode = () => props.nodes[index() + 1];
          const isLast = () => index() === props.nodes.length - 1;

          return (
            <>
              <button
                type="button"
                class="flex items-center gap-2.5 bg-transparent border-0 py-1 px-1.5 rounded-lg w-full text-left group"
                data-step-status={node.status}
                aria-current={isActive() ? "step" : undefined}
                style={{
                  cursor: isClickable ? "pointer" : "default",
                  background: isActive() ? "rgba(79,70,229,0.06)" : "transparent",
                }}
                onClick={() => {
                  if (isClickable) props.onNodeClick(index());
                }}
                title={`${node.nodeLabel} (${nodeTypeLabels[node.nodeType] ?? node.nodeType})`}
                onMouseEnter={(e) => {
                  if (isClickable)
                    (e.currentTarget as HTMLElement).style.background = "rgba(79,70,229,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = isActive()
                    ? "rgba(79,70,229,0.06)"
                    : "transparent";
                }}
              >
                {/* Circle */}
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: circleStyle().bg,
                    color: circleStyle().color,
                    "box-shadow": circleStyle().ring ?? "none",
                  }}
                >
                  {node.status === "completed" ? (
                    <CheckIconSmall />
                  ) : (
                    <NodeIconSmall nodeType={node.nodeType} />
                  )}
                </div>

                {/* Labels */}
                <div class="flex flex-col min-w-0">
                  <span
                    class="text-xs leading-tight truncate"
                    style={{
                      color: isActive() ? "#3525cd" : "#191c1e",
                      "font-weight": isActive() ? "600" : "500",
                    }}
                  >
                    {node.nodeLabel}
                  </span>
                  <span class="text-[10px] leading-tight" style={{ color: "#8b8a99" }}>
                    {nodeTypeLabels[node.nodeType] ?? node.nodeType}
                    <Show when={getNodeStatusLabel(node)}>
                      {(statusLabel) => (
                        <span style={{ color: statusLabel().color }}> ({statusLabel().text})</span>
                      )}
                    </Show>
                  </span>
                </div>
              </button>

              {/* Vertical connecting line */}
              <Show when={!isLast() || props.showResultStep}>
                <div
                  class="flex-shrink-0"
                  style={{ "padding-left": "calc(0.375rem + 0.875rem - 1px)", height: "12px" }}
                >
                  <div
                    class="rounded-full h-full"
                    style={{
                      width: "2px",
                      background:
                        isLast() && props.showResultStep
                          ? node.status === "completed" || node.status === "skipped"
                            ? "#c7c4d8"
                            : "#e0e3e5"
                          : getLineStyle(node.status, nextNode()?.status ?? "pending"),
                    }}
                  />
                </div>
              </Show>
            </>
          );
        }}
      </For>

      {/* Virtual "结果" step */}
      <Show when={props.showResultStep}>
        <button
          type="button"
          class="flex items-center gap-2.5 bg-transparent border-0 py-1 px-1.5 rounded-lg w-full text-left group"
          style={{
            cursor: "pointer",
            background: isResultActive() ? "rgba(79,70,229,0.06)" : "transparent",
          }}
          onClick={() => props.onResultClick?.()}
          title="查看结果总览"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(79,70,229,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = isResultActive()
              ? "rgba(79,70,229,0.06)"
              : "transparent";
          }}
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: isResultActive()
                ? "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)"
                : "#e6e8ea",
              color: isResultActive() ? "#ffffff" : "#464555",
              "box-shadow": isResultActive() ? "0 0 0 4px rgba(99,102,241,0.2)" : "none",
            }}
          >
            <TrophyIconSmall />
          </div>
          <span
            class="text-xs leading-tight font-semibold"
            style={{ color: isResultActive() ? "#3525cd" : "#191c1e" }}
          >
            结果总览
          </span>
        </button>
      </Show>
    </div>
  );
}

// ─── Horizontal (header) layout ────────────────────────────────────

function HorizontalStepper(props: StepperBarProps) {
  const resultIndex = () => props.nodes.length;
  const isResultActive = () => props.showResultStep && props.currentIndex === resultIndex();

  return (
    <div class="flex items-start overflow-x-auto pt-1 pb-2 px-1">
      <For each={props.nodes}>
        {(node, index) => {
          const isActive = () => index() === props.currentIndex;
          const circleStyle = () => getCircleStyle(node.status, isActive());
          const isClickable = isNodeClickable(node.status);
          const nextNode = () => props.nodes[index() + 1];
          const isLast = () => index() === props.nodes.length - 1;

          return (
            <div class="flex items-start flex-shrink-0">
              {/* Step circle + labels */}
              <button
                type="button"
                class="flex flex-col items-center bg-transparent border-0 p-0 group"
                data-step-status={node.status}
                aria-current={isActive() ? "step" : undefined}
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

                {/* Status label for blocked / skipped nodes */}
                <Show when={getNodeStatusLabel(node)}>
                  {(statusLabel) => (
                    <span
                      class="text-[10px] text-center font-medium"
                      style={{ color: statusLabel().color }}
                    >
                      ({statusLabel().text})
                    </span>
                  )}
                </Show>

                {/* Node type badge */}
                <span class="mt-0.5 text-[10px] text-center" style={{ color: "#464555" }}>
                  {nodeTypeLabels[node.nodeType] ?? node.nodeType}
                </span>
              </button>

              {/* Connecting line */}
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
            <span
              class="mt-2 text-xs text-center leading-tight font-semibold"
              style={{ color: isResultActive() ? "#3525cd" : "#191c1e" }}
            >
              结果
            </span>
            <span class="mt-0.5 text-[10px] text-center" style={{ color: "#464555" }}>
              总览
            </span>
          </button>
        </div>
      </Show>
    </div>
  );
}

// ─── Entry point ───────────────────────────────────────────────────

export default function StepperBar(props: StepperBarProps) {
  return props.vertical ? <VerticalStepper {...props} /> : <HorizontalStepper {...props} />;
}
