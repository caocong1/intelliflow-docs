import { For, Show, createSignal } from "solid-js";
import type { VariableRef, OutputDef } from "@intelliflow/shared";
import type { WFNode } from "../../../pages/admin/WorkflowEditor";

const SYSTEM_VARIABLES: Array<{ name: string; label: string }> = [
  { name: "工作目录", label: "工作目录" },
  { name: "输入目录", label: "输入目录" },
  { name: "输出目录", label: "输出目录" },
  { name: "脱敏规则", label: "脱敏规则" },
];

interface VariablePickerProps {
  upstreamNodes: WFNode[];
  onSelect: (variableName: string, ref: VariableRef | null) => void;
  onClose: () => void;
}

export default function VariablePicker(props: VariablePickerProps) {
  const [search, setSearch] = createSignal("");

  function nodeOutputs(node: WFNode): OutputDef[] {
    return (node.data.outputs as OutputDef[]).filter((o) => o.name);
  }

  function matchesSearch(text: string): boolean {
    const q = search().toLowerCase();
    return q === "" || text.toLowerCase().includes(q);
  }

  function handleSelectOutput(node: WFNode, output: OutputDef) {
    const variableName = `${node.data.label}.${output.name}`;
    const ref: VariableRef = {
      nodeId: node.id,
      outputId: output.id,
      variableName,
    };
    props.onSelect(variableName, ref);
  }

  function handleSelectSystem(sysVar: { name: string }) {
    props.onSelect(sysVar.name, null);
  }

  const filteredNodes = () =>
    props.upstreamNodes.filter((node) => {
      const outputs = nodeOutputs(node);
      if (outputs.length === 0) return false;
      if (search() === "") return true;
      return (
        matchesSearch(node.data.label) ||
        outputs.some((o) => matchesSearch(o.name))
      );
    });

  const filteredSystemVars = () =>
    SYSTEM_VARIABLES.filter((v) => matchesSearch(v.name));

  const hasResults = () => filteredNodes().length > 0 || filteredSystemVars().length > 0;

  return (
    <div class="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
      {/* Search */}
      <div class="p-2 border-b border-slate-100">
        <input
          type="text"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          placeholder="搜索变量..."
          autofocus
          class="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
        />
      </div>

      <div class="max-h-60 overflow-y-auto">
        <Show when={!hasResults()}>
          <p class="text-xs text-slate-400 text-center py-4">无匹配变量</p>
        </Show>

        {/* Upstream node variables */}
        <For each={filteredNodes()}>
          {(node) => {
            const outputs = () => {
              const allOutputs = nodeOutputs(node);
              if (search() === "") return allOutputs;
              return allOutputs.filter((o) => matchesSearch(node.data.label) || matchesSearch(o.name));
            };

            return (
              <div>
                {/* Group header */}
                <div class="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5">
                  <span class="text-sm leading-none">{getNodeIcon(node.data.nodeType)}</span>
                  <span class="text-xs font-semibold text-slate-600">{node.data.label}</span>
                </div>
                {/* Outputs */}
                <For each={outputs()}>
                  {(output) => (
                    <button
                      type="button"
                      class="w-full text-left px-4 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer focus:outline-none focus:bg-indigo-50"
                      onClick={() => handleSelectOutput(node, output)}
                    >
                      <span class="text-slate-400 mr-1">{node.data.label}.</span>
                      <span class="font-medium">{output.name}</span>
                    </button>
                  )}
                </For>
              </div>
            );
          }}
        </For>

        {/* System variables */}
        <Show when={filteredSystemVars().length > 0}>
          <div>
            <div class="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
              <span class="text-xs font-semibold text-slate-500">系统变量</span>
            </div>
            <For each={filteredSystemVars()}>
              {(sysVar) => (
                <button
                  type="button"
                  class="w-full text-left px-4 py-1.5 text-xs text-slate-600 hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none focus:bg-gray-50"
                  onClick={() => handleSelectSystem(sysVar)}
                >
                  <span class="font-medium">{sysVar.label}</span>
                  <span class="text-slate-400 ml-1">(系统)</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Footer */}
      <div class="px-3 py-1.5 border-t border-slate-100 bg-slate-50">
        <p class="text-xs text-slate-400">按 Esc 关闭</p>
      </div>
    </div>
  );
}

function getNodeIcon(nodeType: string): string {
  const icons: Record<string, string> = {
    input_transform: "📥",
    desensitize: "🔒",
    model_call: "🤖",
    restore: "🔓",
    export: "📤",
  };
  return icons[nodeType] ?? "⚙️";
}
