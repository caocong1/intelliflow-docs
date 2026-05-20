import type { WorkflowNodeType } from "@intelliflow/shared";
import { type JSX, createSignal } from "solid-js";
import { For } from "solid-js";

type NodeTypeEntry = {
  type: WorkflowNodeType;
  label: string;
  accentBg: string;
  iconBg: string;
  iconColor: string;
  icon: () => JSX.Element;
};

const NODE_TYPES: NodeTypeEntry[] = [
  {
    type: "input_transform",
    label: "输入转换",
    accentBg: "bg-blue-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    icon: () => (
      <svg
        class="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <title>输入转换</title>
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    type: "desensitize",
    label: "信息脱敏",
    accentBg: "bg-orange-500",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    icon: () => (
      <svg
        class="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <title>信息脱敏</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
  {
    type: "model_call",
    label: "模型调用",
    accentBg: "bg-purple-500",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    icon: () => (
      <svg
        class="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <title>模型调用</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a3.187 3.187 0 01-4.508.032L5 14.5m14 0l.044.044a.5.5 0 01-.044.738l-3 2.5"
        />
      </svg>
    ),
  },
  {
    type: "restore",
    label: "信息恢复",
    accentBg: "bg-green-500",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    icon: () => (
      <svg
        class="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <title>信息恢复</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    type: "export",
    label: "文件导出",
    accentBg: "bg-rose-500",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    icon: () => (
      <svg
        class="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <title>文件导出</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
    ),
  },
  {
    type: "ppt",
    label: "PPT 生成",
    accentBg: "bg-sky-500",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    icon: () => (
      <svg
        class="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <title>PPT 生成</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 4.5A1.5 1.5 0 014.5 3h15A1.5 1.5 0 0121 4.5v11A1.5 1.5 0 0119.5 17H13v2.25l3 1.5M11 17v2.25l-3 1.5M7 8h5M7 11h8m2-3h.01"
        />
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

      {/* Node Type Cards — same visual structure as canvas nodes */}
      {!collapsed() && (
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <p class="text-xs text-slate-400 mb-3">拖拽节点到画布</p>
          <For each={NODE_TYPES}>
            {(entry) => (
              <div
                draggable="true"
                onDragStart={(e) => handleDragStart(e, entry.type)}
                onDragEnd={handleDragEnd}
                class={`rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm cursor-grab active:cursor-grabbing transition-all duration-150 select-none hover:shadow-md ${
                  draggingType() === entry.type ? "opacity-50 scale-95" : "opacity-100"
                }`}
              >
                {/* Top accent bar */}
                <div class={`h-[3px] w-full ${entry.accentBg}`} />
                <div class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <div
                      class={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${entry.iconBg} ${entry.iconColor}`}
                    >
                      {entry.icon()}
                    </div>
                    <span class="text-xs font-medium text-slate-700 flex-1 truncate">
                      {entry.label}
                    </span>
                  </div>
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
                class={`w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-150 ${entry.iconColor} ${
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
