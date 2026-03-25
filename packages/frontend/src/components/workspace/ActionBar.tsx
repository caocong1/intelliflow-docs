import { Show } from "solid-js";

interface ActionBarProps {
  /** Whether any action is in progress */
  loading: boolean;
  /** Whether the current node can be skipped (non-export nodes) */
  canSkip: boolean;
  /** Whether rollback is available (not the first node) */
  canRollback: boolean;
  /** Whether auto-save is currently in progress */
  isSaving?: boolean;
  /** Whether auto-save just completed */
  hasSaved?: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onRollback: () => void;
}

export default function ActionBar(props: ActionBarProps) {
  return (
    <div
      class="sticky bottom-0 z-40 px-6 py-4 flex items-center justify-between"
      style={{
        background: "#ffffff",
        "box-shadow": "0 -4px 20px rgba(25,28,30,0.04)",
        "border-top": "1px solid rgba(199,196,216,0.15)",
      }}
    >
      {/* Left: rollback */}
      <div class="flex items-center gap-3">
        <Show when={props.canRollback}>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer"
            style={{
              background: "#e6e8ea",
              color: "#191c1e",
              border: "none",
              "border-radius": "1rem",
            }}
            disabled={props.loading}
            onClick={props.onRollback}
          >
            回退
          </button>
        </Show>

        {/* Auto-save indicator */}
        <Show when={props.isSaving}>
          <span class="text-xs" style={{ color: "#464555" }}>
            保存中...
          </span>
        </Show>
        <Show when={!props.isSaving && props.hasSaved}>
          <span class="text-xs text-green-600 font-medium flex items-center gap-1">
            <svg
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
            已自动保存
          </span>
        </Show>
      </div>

      {/* Right: skip + confirm */}
      <div class="flex items-center gap-3">
        <Show when={props.canSkip}>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer"
            style={{
              background: "#e6e8ea",
              color: "#191c1e",
              border: "none",
              "border-radius": "1rem",
            }}
            disabled={props.loading}
            onClick={props.onSkip}
          >
            跳过此节点
          </button>
        </Show>
        <button
          type="button"
          class="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
          style={{
            background: props.loading
              ? "#a5b4fc"
              : "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)",
            border: "none",
            "border-radius": "1rem",
            transform: props.loading ? "none" : undefined,
          }}
          disabled={props.loading}
          onClick={props.onConfirm}
          onMouseEnter={(e) => {
            if (!props.loading) (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          }}
        >
          {props.loading ? "处理中..." : "确认并继续"}
          {!props.loading && (
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
