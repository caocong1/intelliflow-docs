import { createSignal } from "solid-js";
import type { NodeConfig } from "@intelliflow/shared";

interface RuntimeSettingsProps {
  config: NodeConfig;
  onChange: (updates: Partial<NodeConfig>) => void;
}

export default function RuntimeSettings(props: RuntimeSettingsProps) {
  const [open, setOpen] = createSignal(false);

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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {open() && (
        <div class="px-3 pb-3 space-y-2.5 border-t border-gray-100">
          {/* autoAdvance */}
          <label class="flex items-center justify-between gap-2 pt-2 cursor-pointer select-none">
            <div>
              <p class="text-xs font-medium text-gray-700">自动推进</p>
              <p class="text-xs text-gray-400">当节点完成后自动进入下一步</p>
            </div>
            <input
              type="checkbox"
              checked={props.config.autoAdvance ?? false}
              onChange={(e) => props.onChange({ autoAdvance: e.currentTarget.checked })}
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </label>

          {/* allowEdit */}
          <label class="flex items-center justify-between gap-2 cursor-pointer select-none">
            <div>
              <p class="text-xs font-medium text-gray-700">允许编辑</p>
              <p class="text-xs text-gray-400">用户可在此节点编辑输出内容</p>
            </div>
            <input
              type="checkbox"
              checked={props.config.allowEdit ?? true}
              onChange={(e) => props.onChange({ allowEdit: e.currentTarget.checked })}
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </label>

          {/* skippable */}
          <label class="flex items-center justify-between gap-2 cursor-pointer select-none">
            <div>
              <p class="text-xs font-medium text-gray-700">可跳过</p>
              <p class="text-xs text-gray-400">用户可跳过此节点</p>
            </div>
            <input
              type="checkbox"
              checked={props.config.skippable ?? false}
              onChange={(e) => props.onChange({ skippable: e.currentTarget.checked })}
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
}
