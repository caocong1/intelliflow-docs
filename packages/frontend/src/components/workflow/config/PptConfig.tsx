import type { OutputDef, PptConfig, PptStyleSelectionMode, VariableRef } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";
import type { FlowNodeData } from "../../../lib/flow-engine/types";
import VariablePicker from "../prompt/VariablePicker";

const STYLE_SELECTION_OPTIONS: Array<{
  value: PptStyleSelectionMode;
  label: string;
  desc: string;
}> = [
  { value: "runtime_select", label: "运行时选择", desc: "默认自动推荐，用户生成前可手动切换风格" },
  { value: "auto", label: "自动推荐", desc: "按内容自动选择风格，不要求用户选择" },
  { value: "fixed", label: "固定风格", desc: "始终使用默认风格 ID" },
];

interface PptConfigProps {
  config: PptConfig;
  upstreamNodes: FlowNodeData[];
  onChange: (config: PptConfig) => void;
}

export default function PptConfigPanel(props: PptConfigProps) {
  const [showPicker, setShowPicker] = createSignal(false);
  const [dragIndex, setDragIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  const mapping = () => props.config.contentMapping ?? [];
  const styleMode = () => props.config.styleSelectionMode ?? "runtime_select";

  function addMapping(ref: VariableRef) {
    const exists = mapping().some(
      (item) => item.nodeId === ref.nodeId && item.outputId === ref.outputId,
    );
    if (!exists) {
      props.onChange({ ...props.config, contentMapping: [...mapping(), ref] });
    }
  }

  function removeMapping(index: number) {
    const next = [...mapping()];
    next.splice(index, 1);
    props.onChange({ ...props.config, contentMapping: next });
  }

  function resolveLabel(ref: VariableRef): string {
    const node = props.upstreamNodes.find((item) => item.id === ref.nodeId);
    if (!node) return `${ref.nodeId}.${ref.outputId}`;
    const outputs = node.data.outputs as OutputDef[];
    const output =
      outputs.find((item) => item.segmentKey === ref.outputId) ??
      outputs.find((item) => item.id === ref.outputId);
    return `${node.data.label}.${output?.name ?? ref.outputId}`;
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(targetIndex: number) {
    const from = dragIndex();
    if (from === null || from === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const items = [...mapping()];
    const [moved] = items.splice(from, 1);
    items.splice(targetIndex, 0, moved);
    props.onChange({ ...props.config, contentMapping: items });
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div class="space-y-4">
      <div>
        <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          PPT 风格策略
        </h4>
        <div class="space-y-1.5">
          <For each={STYLE_SELECTION_OPTIONS}>
            {(option) => {
              const selected = () => styleMode() === option.value;
              return (
                <label
                  class="flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer select-none transition-colors hover:bg-slate-50"
                  classList={{
                    "border-indigo-400 bg-indigo-50": selected(),
                    "border-slate-200": !selected(),
                  }}
                >
                  <input
                    type="radio"
                    name="pptStyleSelectionMode"
                    checked={selected()}
                    onChange={() =>
                      props.onChange({ ...props.config, styleSelectionMode: option.value })
                    }
                    class="mt-0.5 border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>
                    <span class="block text-xs font-medium text-slate-800">{option.label}</span>
                    <span class="block text-xs text-slate-500 leading-4">{option.desc}</span>
                  </span>
                </label>
              );
            }}
          </For>
        </div>

        <div class="mt-3">
          <label class="block text-xs font-medium text-gray-600 mb-1" for="ppt-default-style">
            默认风格 ID
          </label>
          <input
            id="ppt-default-style"
            type="text"
            value={props.config.defaultStyleId ?? ""}
            placeholder="corporate_blue"
            onInput={(e) =>
              props.onChange({
                ...props.config,
                defaultStyleId: e.currentTarget.value || undefined,
              })
            }
            class="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <p class="text-[11px] text-slate-500 mt-1 leading-4">
            留空时按内容自动推荐。固定风格模式会强制使用这里的 ID。
          </p>
        </div>
      </div>

      <div class="border-t border-slate-100 pt-3">
        <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          PPT 内容来源
        </h4>
        <p class="text-xs text-slate-500 mb-2">选择用于编排 PPT 的上游输出，拖拽调整顺序：</p>

        <Show when={mapping().length > 0}>
          <div class="space-y-1 mb-3">
            <For each={mapping()}>
              {(ref, index) => (
                <div
                  draggable={true}
                  onDragStart={() => handleDragStart(index())}
                  onDragOver={(e) => handleDragOver(e, index())}
                  onDrop={() => handleDrop(index())}
                  onDragEnd={handleDragEnd}
                  class={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs transition-all cursor-grab active:cursor-grabbing ${
                    dragOverIndex() === index() && dragIndex() !== index()
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  } ${dragIndex() === index() ? "opacity-40" : ""}`}
                >
                  <span class="text-slate-300 flex-shrink-0 select-none">
                    <svg
                      class="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <title>拖拽排序</title>
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </span>
                  <span class="w-5 h-5 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {index() + 1}
                  </span>
                  <span class="flex-1 text-slate-700 font-medium truncate">
                    {resolveLabel(ref)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMapping(index())}
                    class="flex-shrink-0 p-0.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none"
                    title="移除"
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <title>移除</title>
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>

        <div class="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker())}
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>添加内容</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            添加输出内容
          </button>

          <Show when={showPicker()}>
            <VariablePicker
              upstreamNodes={props.upstreamNodes}
              onSelect={(_name, ref) => {
                if (ref) addMapping(ref);
                setShowPicker(false);
              }}
              onClose={() => setShowPicker(false)}
            />
          </Show>
        </div>

        <Show when={mapping().length === 0}>
          <p class="text-xs text-slate-400 italic text-center py-3 mt-2">
            尚未选择 PPT 内容。点击上方按钮添加上游输出。
          </p>
        </Show>
      </div>
    </div>
  );
}
