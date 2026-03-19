import { For } from "solid-js";
import type { RestoreConfig } from "@intelliflow/shared";
import type { WFNode } from "../../../pages/admin/WorkflowEditor";

interface RestoreConfigProps {
  config: RestoreConfig;
  allNodes: WFNode[];
  onChange: (config: RestoreConfig) => void;
}

export default function RestoreConfigPanel(props: RestoreConfigProps) {
  const desensitizeNodes = () =>
    props.allNodes.filter((n) => n.data.nodeType === "desensitize");

  const pairedNode = () =>
    props.allNodes.find((n) => n.id === props.config.pairedDesensitizeNodeId);

  const isPaired = () => !!pairedNode();

  return (
    <div class="space-y-4">
      {/* Paired Node Selector */}
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">
          配对的脱敏节点
        </label>
        <select
          value={props.config.pairedDesensitizeNodeId ?? ""}
          onChange={(e) =>
            props.onChange({
              ...props.config,
              pairedDesensitizeNodeId: e.currentTarget.value || null,
            })
          }
          class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
        >
          <option value="">(未选择)</option>
          <For each={desensitizeNodes()}>
            {(node) => (
              <option value={node.id}>{node.data.label}</option>
            )}
          </For>
        </select>
      </div>

      {/* Pairing Status */}
      <div
        class={`flex items-center gap-2 p-3 rounded-md border ${
          isPaired()
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        <div
          class={`w-2 h-2 rounded-full flex-shrink-0 ${
            isPaired() ? "bg-emerald-500" : "bg-amber-400"
          }`}
        />
        <div>
          <p
            class={`text-xs font-medium ${
              isPaired() ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {isPaired() ? "已配对" : "未配对"}
          </p>
          <p class={`text-xs mt-0.5 ${isPaired() ? "text-emerald-600" : "text-amber-600"}`}>
            {isPaired()
              ? `已配对到：${pairedNode()?.data.label ?? ""}`
              : "请选择配对的脱敏节点，恢复节点将自动解除对应的脱敏映射"}
          </p>
        </div>
      </div>

      {desensitizeNodes().length === 0 && (
        <p class="text-xs text-slate-400 italic">
          当前流程中没有脱敏节点。请先添加信息脱敏节点。
        </p>
      )}
    </div>
  );
}
