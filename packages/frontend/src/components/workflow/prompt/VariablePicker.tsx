import { For, Show, createSignal, createMemo, createEffect } from "solid-js";
import type { VariableRef, OutputDef } from "@intelliflow/shared";
import type { FlowNodeData } from "../../../lib/flow-engine/types";

/** A flat selectable item for keyboard navigation */
export interface PickerItem {
  node: FlowNodeData;
  output: OutputDef;
  key: string; // "nodeId.outputId"
}

interface VariablePickerProps {
  upstreamNodes: FlowNodeData[];
  onSelect: (variableName: string, ref: VariableRef | null) => void;
  onClose: () => void;
  highlightedIndex?: number;
}

/** Build a flat list of all selectable items from upstream nodes */
export function buildPickerItems(upstreamNodes: FlowNodeData[]): PickerItem[] {
  const items: PickerItem[] = [];
  for (const node of upstreamNodes) {
    const outputs = (node.data.outputs as OutputDef[]).filter((o) => o.name);
    for (const output of outputs) {
      items.push({ node, output, key: `${node.id}.${output.id}` });
    }
  }
  return items;
}

export default function VariablePicker(props: VariablePickerProps) {
  const [search, setSearch] = createSignal("");

  function nodeOutputs(node: FlowNodeData): OutputDef[] {
    return (node.data.outputs as OutputDef[]).filter((o) => o.name);
  }

  function matchesSearch(text: string): boolean {
    const q = search().toLowerCase();
    return q === "" || text.toLowerCase().includes(q);
  }

  function handleSelectOutput(node: FlowNodeData, output: OutputDef) {
    const variableKey = `${node.id}.${output.id}`;
    const ref: VariableRef = {
      nodeId: node.id,
      outputId: output.id,
      variableName: variableKey,
    };
    props.onSelect(variableKey, ref);
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

  // Flat list of filtered items to map highlightedIndex to the correct item
  const flatFilteredItems = createMemo(() => {
    const items: PickerItem[] = [];
    for (const node of filteredNodes()) {
      const outputs = nodeOutputs(node);
      const filtered = search() === ""
        ? outputs
        : outputs.filter((o) => matchesSearch(node.data.label) || matchesSearch(o.name));
      for (const output of filtered) {
        items.push({ node, output, key: `${node.id}.${output.id}` });
      }
    }
    return items;
  });

  const hasResults = () => filteredNodes().length > 0;

  let listRef: HTMLDivElement | undefined;

  // Auto-scroll highlighted item into view reactively
  createEffect(() => {
    const idx = props.highlightedIndex;
    if (idx === undefined || idx < 0 || !listRef) return;
    const items = flatFilteredItems();
    if (idx >= items.length) return;
    const el = listRef.querySelector(`[data-picker-key="${items[idx].key}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  });

  return (
    <div class="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
      {/* Search */}
      <div class="p-2 border-b border-slate-100">
        <input
          type="text"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          placeholder="搜索节点输出..."
          class="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
        />
      </div>

      <div ref={listRef} class="max-h-60 overflow-y-auto">
        <Show when={!hasResults()}>
          <p class="text-xs text-slate-400 text-center py-4">无匹配节点输出</p>
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
                  <span class="text-xs font-semibold text-slate-600">插入 {node.data.label} 的输出</span>
                </div>
                {/* Outputs */}
                <For each={outputs()}>
                  {(output) => {
                    const itemKey = `${node.id}.${output.id}`;
                    const isHighlighted = () => {
                      const idx = props.highlightedIndex;
                      if (idx === undefined || idx < 0) return false;
                      const items = flatFilteredItems();
                      return idx < items.length && items[idx].key === itemKey;
                    };
                    return (
                      <button
                        type="button"
                        data-picker-key={itemKey}
                        class={`w-full text-left px-4 py-1.5 text-xs transition-colors cursor-pointer focus:outline-none ${
                          isHighlighted()
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                        onClick={() => handleSelectOutput(node, output)}
                      >
                        <span class="text-slate-400 mr-1">{node.data.label}.</span>
                        <span class="font-medium">{output.name}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            );
          }}
        </For>

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
