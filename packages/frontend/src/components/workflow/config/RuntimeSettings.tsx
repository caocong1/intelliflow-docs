import { createSignal } from "solid-js";
import type { NodeConfig } from "@intelliflow/shared";

interface RuntimeSettingsProps {
  config: NodeConfig;
  onChange: (updates: Partial<NodeConfig>) => void;
}

export default function RuntimeSettings(props: RuntimeSettingsProps) {
  const [open, setOpen] = createSignal(false);

  const isAuto = () => props.config.autoAdvance ?? false;
  const isInputNode = () => props.config.type === "input_transform";

  function handleAutoAdvanceChange(checked: boolean) {
    if (checked) {
      // Auto mode: force disable allowEdit and skippable
      props.onChange({ autoAdvance: true, allowEdit: false, skippable: false });
    } else {
      props.onChange({ autoAdvance: false });
    }
  }

  return (
    <div class="mt-4 border border-gray-200 rounded-md">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen(!open())}
        class="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none"
      >
        <span>运行时设置</span>
        <svg
          class={`w-3.5 h-3.5 transition-transform ${open() ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <title>展开/收起</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Collapsible body */}
      {open() && (
        <div class="px-3 pb-3 space-y-2.5 border-t border-gray-100">
          {/* autoAdvance */}
          {!isInputNode() && (
            <label class="flex items-center justify-between gap-2 pt-2 cursor-pointer select-none">
              <div>
                <p class="text-xs font-medium text-gray-700">自动推进</p>
                <p class="text-xs text-gray-400">当节点完成后自动进入下一步</p>
              </div>
              <input
                type="checkbox"
                checked={isAuto()}
                onChange={(e) => handleAutoAdvanceChange(e.currentTarget.checked)}
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>
          )}

          {/* allowEdit */}
          {!isInputNode() && (
            <label
              class={`flex items-center justify-between gap-2 select-none ${isAuto() ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div>
                <p class="text-xs font-medium text-gray-700">允许编辑</p>
                <p class="text-xs text-gray-400">
                  {isAuto() ? "自动推进模式下不可编辑" : "用户可在此节点编辑输出内容"}
                </p>
              </div>
              <input
                type="checkbox"
                checked={isAuto() ? false : (props.config.allowEdit ?? true)}
                disabled={isAuto()}
                onChange={(e) => props.onChange({ allowEdit: e.currentTarget.checked })}
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
              />
            </label>
          )}

          {/* skippable */}
          <label
            class={`flex items-center justify-between gap-2 select-none ${!isInputNode() && isAuto() ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div>
              <p class="text-xs font-medium text-gray-700">可跳过</p>
              <p class="text-xs text-gray-400">
                {!isInputNode() && isAuto() ? "自动推进模式下不可跳过" : "用户可跳过此节点"}
              </p>
            </div>
            <input
              type="checkbox"
              checked={!isInputNode() && isAuto() ? false : (props.config.skippable ?? false)}
              disabled={!isInputNode() && isAuto()}
              onChange={(e) => props.onChange({ skippable: e.currentTarget.checked })}
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
            />
          </label>
        </div>
      )}
    </div>
  );
}
