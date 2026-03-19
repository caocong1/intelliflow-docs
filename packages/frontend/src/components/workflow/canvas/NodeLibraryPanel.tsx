import { createSignal } from "solid-js";
import { For } from "solid-js";
import type { WorkflowNodeType } from "@intelliflow/shared";

type NodeTypeEntry = {
  type: WorkflowNodeType;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: string;
};

const NODE_TYPES: NodeTypeEntry[] = [
  {
    type: "input_transform",
    label: "输入转换",
    description: "配置输入表单和文件上传",
    colorClass: "text-blue-700",
    bgClass: "bg-blue-50 hover:bg-blue-100",
    borderClass: "border-blue-200",
    icon: "📥",
  },
  {
    type: "desensitize",
    label: "信息脱敏",
    description: "识别和替换敏感信息",
    colorClass: "text-orange-700",
    bgClass: "bg-orange-50 hover:bg-orange-100",
    borderClass: "border-orange-200",
    icon: "🔒",
  },
  {
    type: "model_call",
    label: "模型调用",
    description: "AI 模型生成内容",
    colorClass: "text-purple-700",
    bgClass: "bg-purple-50 hover:bg-purple-100",
    borderClass: "border-purple-200",
    icon: "🤖",
  },
  {
    type: "restore",
    label: "信息恢复",
    description: "恢复脱敏信息",
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-50 hover:bg-emerald-100",
    borderClass: "border-emerald-200",
    icon: "🔓",
  },
  {
    type: "export",
    label: "文件导出",
    description: "导出最终文档",
    colorClass: "text-red-700",
    bgClass: "bg-red-50 hover:bg-red-100",
    borderClass: "border-red-200",
    icon: "📤",
  },
];

export default function NodeLibraryPanel() {
  const [collapsed, setCollapsed] = createSignal(false);

  function handleDragStart(e: DragEvent, nodeType: WorkflowNodeType) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData("application/solid-flow-node", nodeType);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      class={`flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ${
        collapsed() ? "w-10" : "w-60"
      }`}
    >
      {/* Panel Header */}
      <div class="flex items-center justify-between px-3 py-3 border-b border-slate-100 flex-shrink-0">
        {!collapsed() && (
          <span class="text-sm font-semibold text-slate-700">节点库</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          class="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title={collapsed() ? "展开节点库" : "收起节点库"}
        >
          <svg
            class={`w-4 h-4 transition-transform duration-200 ${collapsed() ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>{collapsed() ? "展开" : "收起"}</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Node Type Cards */}
      {!collapsed() && (
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <p class="text-xs text-slate-400 mb-3">拖拽节点到画布</p>
          <For each={NODE_TYPES}>
            {(entry) => (
              <div
                draggable="true"
                onDragStart={(e) => handleDragStart(e, entry.type)}
                class={`flex items-start gap-2.5 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-colors select-none ${entry.bgClass} ${entry.borderClass}`}
              >
                <span class="text-lg leading-none mt-0.5 flex-shrink-0">{entry.icon}</span>
                <div class="min-w-0 flex-1">
                  <p class={`text-xs font-semibold ${entry.colorClass}`}>{entry.label}</p>
                  <p class="text-xs text-slate-500 mt-0.5 leading-tight">{entry.description}</p>
                </div>
              </div>
            )}
          </For>
        </div>
      )}

      {/* Collapsed: show icons only */}
      {collapsed() && (
        <div class="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1">
          <For each={NODE_TYPES}>
            {(entry) => (
              <div
                draggable="true"
                onDragStart={(e) => handleDragStart(e, entry.type)}
                class={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors ${entry.bgClass} ${entry.borderClass}`}
                title={entry.label}
              >
                <span class="text-base leading-none">{entry.icon}</span>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
