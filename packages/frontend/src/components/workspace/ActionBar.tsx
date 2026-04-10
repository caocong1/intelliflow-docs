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
  /** Render as a vertical stack inside the right sidebar */
  vertical?: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onRollback: () => void;
}

function ArrowRightIcon() {
  return (
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
  );
}

function CheckIconTiny() {
  return (
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
  );
}

function RollbackIcon() {
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
        stroke-width="2"
        d="M3 10h11a4 4 0 014 4v3M3 10l4-4M3 10l4 4"
      />
    </svg>
  );
}

function SaveStatusIndicator(props: { isSaving?: boolean; hasSaved?: boolean }) {
  return (
    <>
      <Show when={props.isSaving}>
        <span class="text-[11px] flex items-center gap-1" style={{ color: "#8b8a99" }}>
          <svg
            class="w-3 h-3 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          保存中
        </span>
      </Show>
      <Show when={!props.isSaving && props.hasSaved}>
        <span class="text-[11px] font-medium flex items-center gap-1" style={{ color: "#22c55e" }}>
          <CheckIconTiny />
          已自动保存
        </span>
      </Show>
    </>
  );
}

// ─── Vertical (sidebar) layout ─────────────────────────────────────

function VerticalActionBar(props: ActionBarProps) {
  return (
    <div
      class="flex flex-col gap-2.5 px-3 py-3"
      style={{
        background: "linear-gradient(180deg, rgba(247,249,251,0) 0%, #f7f9fb 24%)",
        "border-top": "1px solid rgba(199,196,216,0.2)",
      }}
    >
      {/* Auto-save status row */}
      <div
        class="flex items-center justify-center min-h-[14px]"
        aria-live="polite"
      >
        <SaveStatusIndicator isSaving={props.isSaving} hasSaved={props.hasSaved} />
      </div>

      {/* Primary action — confirm */}
      <button
        type="button"
        class="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-white transition-all disabled:opacity-50 cursor-pointer"
        style={{
          background: props.loading
            ? "#a5b4fc"
            : "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)",
          border: "none",
          padding: "0.625rem 0.75rem",
          "border-radius": "0.875rem",
          "box-shadow": props.loading
            ? "none"
            : "0 4px 12px rgba(53,37,205,0.18)",
        }}
        disabled={props.loading}
        onClick={props.onConfirm}
        onMouseEnter={(e) => {
          if (!props.loading) {
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 6px 16px rgba(53,37,205,0.24)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = props.loading
            ? "none"
            : "0 4px 12px rgba(53,37,205,0.18)";
        }}
      >
        {props.loading ? "处理中..." : "确认并继续"}
        {!props.loading && <ArrowRightIcon />}
      </button>

      {/* Secondary action — skip (always reserves space for layout stability) */}
      <Show when={props.canSkip}>
        <button
          type="button"
          class="w-full text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
          style={{
            background: "#ffffff",
            color: "#464555",
            border: "1px solid rgba(199,196,216,0.5)",
            padding: "0.5rem 0.75rem",
            "border-radius": "0.75rem",
          }}
          disabled={props.loading}
          onClick={props.onSkip}
          onMouseEnter={(e) => {
            if (!props.loading) {
              (e.currentTarget as HTMLElement).style.background = "#f7f9fb";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(79,70,229,0.4)";
              (e.currentTarget as HTMLElement).style.color = "#3525cd";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#ffffff";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(199,196,216,0.5)";
            (e.currentTarget as HTMLElement).style.color = "#464555";
          }}
        >
          跳过此节点
        </button>
      </Show>

      {/* Tertiary — rollback as subtle text link with icon */}
      <Show when={props.canRollback}>
        <button
          type="button"
          class="w-full flex items-center justify-center gap-1 text-[11px] font-medium bg-transparent border-0 transition-colors disabled:opacity-50 cursor-pointer"
          style={{
            color: "#8b8a99",
            padding: "0.25rem 0.5rem",
          }}
          disabled={props.loading}
          onClick={props.onRollback}
          onMouseEnter={(e) => {
            if (!props.loading) (e.currentTarget as HTMLElement).style.color = "#dc2626";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#8b8a99";
          }}
        >
          <RollbackIcon />
          回退到之前节点
        </button>
      </Show>
    </div>
  );
}

// ─── Horizontal (footer) layout — kept for backward compatibility ──

function HorizontalActionBar(props: ActionBarProps) {
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
        <SaveStatusIndicator isSaving={props.isSaving} hasSaved={props.hasSaved} />
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
          }}
          disabled={props.loading}
          onClick={props.onConfirm}
        >
          {props.loading ? "处理中..." : "确认并继续"}
          {!props.loading && <ArrowRightIcon />}
        </button>
      </div>
    </div>
  );
}

export default function ActionBar(props: ActionBarProps) {
  return props.vertical ? <VerticalActionBar {...props} /> : <HorizontalActionBar {...props} />;
}
