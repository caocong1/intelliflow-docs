import { For } from "solid-js";
import type { OutputDef } from "@intelliflow/shared";

interface OutputsEditorProps {
  outputs: OutputDef[];
  onChange: (outputs: OutputDef[]) => void;
}

export default function OutputsEditor(props: OutputsEditorProps) {
  function addOutput() {
    const newOutput: OutputDef = {
      id: crypto.randomUUID(),
      name: "",
      description: "",
    };
    props.onChange([...props.outputs, newOutput]);
  }

  function updateOutput(id: string, field: keyof OutputDef, value: string) {
    props.onChange(
      props.outputs.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  }

  function removeOutput(id: string) {
    props.onChange(props.outputs.filter((o) => o.id !== id));
  }

  return (
    <div class="mt-4 border-t border-slate-100 pt-4">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wide">输出内容块</h4>
        <button
          type="button"
          onClick={addOutput}
          class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>添加</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          添加输出
        </button>
      </div>

      <div class="space-y-2">
        <For
          each={props.outputs}
          fallback={
            <p class="text-xs text-slate-400 italic text-center py-2">
              暂无输出定义 — 点击"添加输出"创建内容块
            </p>
          }
        >
          {(output) => (
            <div class="flex items-start gap-2 p-2 bg-slate-50 rounded-md border border-slate-200">
              <div class="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={output.name}
                  onInput={(e) => updateOutput(output.id, "name", e.currentTarget.value)}
                  placeholder="输出名称（如：处理结果）"
                  class="w-full text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                />
                <input
                  type="text"
                  value={output.description ?? ""}
                  onInput={(e) => updateOutput(output.id, "description", e.currentTarget.value)}
                  placeholder="描述（可选）"
                  class="w-full text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-400 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                />
              </div>
              <button
                type="button"
                onClick={() => removeOutput(output.id)}
                class="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                title="删除此输出"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <title>删除</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
