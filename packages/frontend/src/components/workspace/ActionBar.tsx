import { createSignal, onCleanup, Show } from "solid-js";

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
    <div class="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
      {/* Left: rollback + auto-save indicator */}
      <div class="flex items-center gap-3">
        <Show when={props.canRollback}>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
            disabled={props.loading}
            onClick={props.onRollback}
          >
            回退
          </button>
        </Show>

        {/* Auto-save indicator */}
        <Show when={props.isSaving}>
          <span class="text-xs text-gray-400">保存中...</span>
        </Show>
        <Show when={!props.isSaving && props.hasSaved}>
          <span class="text-xs text-green-600 font-medium flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
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
            class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
            disabled={props.loading}
            onClick={props.onSkip}
          >
            跳过此节点
          </button>
        </Show>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
          disabled={props.loading}
          onClick={props.onConfirm}
        >
          {props.loading ? "处理中..." : "确认并继续"}
        </button>
      </div>
    </div>
  );
}
