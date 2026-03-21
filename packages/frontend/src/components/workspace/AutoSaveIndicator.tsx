import { Show } from "solid-js";

export type SaveStatus = "idle" | "saving" | "saved";

interface AutoSaveIndicatorProps {
  status: SaveStatus;
}

/**
 * Small indicator showing auto-save status.
 * - "saving" -> spinner + "保存中..."
 * - "saved" -> checkmark + "已自动保存"
 * - "idle" -> hidden
 */
export default function AutoSaveIndicator(props: AutoSaveIndicatorProps) {
  return (
    <>
      <Show when={props.status === "saving"}>
        <div class="flex items-center gap-1.5 text-xs text-gray-400">
          <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <title>saving</title>
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>保存中...</span>
        </div>
      </Show>
      <Show when={props.status === "saved"}>
        <div class="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>saved</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>已自动保存</span>
        </div>
      </Show>
    </>
  );
}
