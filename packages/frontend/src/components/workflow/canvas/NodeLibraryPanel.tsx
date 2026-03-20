import { createSignal, type JSX } from "solid-js";
import { For } from "solid-js";
import type { WorkflowNodeType } from "@intelliflow/shared";

type NodeTypeEntry = {
  type: WorkflowNodeType;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  iconBg: string;
  iconColor: string;
  icon: () => JSX.Element;
};

const NODE_TYPES: NodeTypeEntry[] = [
  {
    type: "input_transform",
    label: "输入转换",
    description: "配置输入表单和文件上传",
    colorClass: "text-blue-700",
    bgClass: "bg-blue-50 hover:bg-blue-100",
    borderClass: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    icon: () => (
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <title>输入转换</title>
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    type: "desensitize",
    label: "信息脱敏",
    description: "识别和替换敏感信息",
    colorClass: "text-orange-700",
    bgClass: "bg-orange-50 hover:bg-orange-100",
    borderClass: "border-orange-200",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    icon: () => (
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <title>信息脱敏</title>
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    type: "model_call",
    label: "模型调用",
    description: "AI 模型生成内容",
    colorClass: "text-purple-700",
    bgClass: "bg-purple-50 hover:bg-purple-100",
    borderClass: "border-purple-200",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    icon: () => (
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <title>模型调用</title>
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a3.187 3.187 0 01-4.508.032L5 14.5m14 0l.044.044a.5.5 0 01-.044.738l-3 2.5" />
      </svg>
    ),
  },
  {
    type: "restore",
    label: "信息恢复",
    description: "恢复脱敏信息",
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-50 hover:bg-emerald-100",
    borderClass: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    icon: () => (
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <title>信息恢复</title>
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    type: "export",
    label: "文件导出",
    description: "导出最终文档",
    colorClass: "text-red-700",
    bgClass: "bg-red-50 hover:bg-red-100",
    borderClass: "border-red-200",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    icon: () => (
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <title>文件导出</title>
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
];

export default function NodeLibraryPanel() {
  const [collapsed, setCollapsed] = createSignal(false);
  const [draggingType, setDraggingType] = createSignal<WorkflowNodeType | null>(null);

  function handleDragStart(e: DragEvent, nodeType: WorkflowNodeType) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData("application/solid-flow-node", nodeType);
    e.dataTransfer.effectAllowed = "move";
    setDraggingType(nodeType);
  }

  function handleDragEnd() {
    setDraggingType(null);
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
          <span class="text-sm font-semibold text-slate-700 tracking-tight">节点库</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          class="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                onDragEnd={handleDragEnd}
                class={`flex items-start gap-2.5 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all duration-150 select-none ${entry.bgClass} ${entry.borderClass} ${
                  draggingType() === entry.type ? "opacity-50 scale-95" : "opacity-100"
                }`}
              >
                <div class={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${entry.iconBg} ${entry.iconColor}`}>
                  {entry.icon()}
                </div>
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
                onDragEnd={handleDragEnd}
                class={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-150 ${entry.bgClass} ${entry.borderClass} ${entry.iconColor} ${
                  draggingType() === entry.type ? "opacity-50 scale-95" : "opacity-100"
                }`}
                title={entry.label}
              >
                {entry.icon()}
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
