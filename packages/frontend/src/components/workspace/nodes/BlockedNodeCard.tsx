import type { NodeExecution } from "@intelliflow/shared";

export interface BlockedNodeCardProps {
  node: NodeExecution;
  /** Called after confirmation — parent computes rollback target from workflowNodes config */
  onRollback: () => void;
}

/**
 * Inline warning card shown in the workspace content area when a node is blocked
 * by a conditional execution rule. Pure display component — does NOT access
 * workflowNodes config. Rollback target is computed by the parent (DocumentWorkspace).
 */
export default function BlockedNodeCard(props: BlockedNodeCardProps) {
  const blockReason = (): string => {
    const data = props.node.outputData as Record<string, unknown> | null;
    return (data?.blockReason as string) ?? "触发条件阻断";
  };

  const handleRollback = () => {
    const confirmed = window.confirm(
      "回退将清除当前节点及中间节点的输出数据，确定要返回修改上游节点吗？",
    );
    if (confirmed) {
      props.onRollback();
    }
  };

  return (
    <div
      class="rounded-xl p-6"
      style={{
        background: "#fef2f2",
        border: "1px solid rgba(239,68,68,0.2)",
        "border-left": "4px solid #ef4444",
        "box-shadow": "0 2px 8px rgba(239,68,68,0.08)",
      }}
    >
      <div class="flex items-start gap-4">
        {/* Warning icon */}
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(239,68,68,0.1)" }}
        >
          <svg
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#ef4444"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <div class="flex-1 min-w-0">
          {/* Heading */}
          <h3 class="text-base font-bold mb-1" style={{ color: "#991b1b" }}>
            节点已被条件阻断
          </h3>

          {/* Block reason */}
          <p class="text-sm mb-4" style={{ color: "#b91c1c" }}>
            {blockReason()}
          </p>

          {/* Rollback button */}
          <button
            type="button"
            class="px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all cursor-pointer border-0 flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
              "box-shadow": "0 4px 12px rgba(220,38,38,0.25)",
            }}
            onClick={handleRollback}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            返回修改上游
          </button>
        </div>
      </div>
    </div>
  );
}
