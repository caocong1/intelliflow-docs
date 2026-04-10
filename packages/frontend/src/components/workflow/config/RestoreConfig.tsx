import { For, Show } from "solid-js";
import type { InputSource, RestoreConfig } from "@intelliflow/shared";
import type { FlowNodeData } from "../../../lib/flow-engine/types";

interface RestoreConfigProps {
  config: RestoreConfig;
  allNodes: FlowNodeData[];
  upstreamNodes: FlowNodeData[];
  onChange: (config: RestoreConfig) => void;
}

export default function RestoreConfigPanel(props: RestoreConfigProps) {
  const desensitizeNodes = () =>
    props.allNodes.filter((n) => n.data.nodeType === "desensitize");

  const pairedNode = () =>
    props.allNodes.find((n) => n.id === props.config.pairedDesensitizeNodeId);

  const isPaired = () => !!pairedNode();

  const inputSources = () => props.config.inputSources ?? [];

  const sourceCandidates = () =>
    props.upstreamNodes.flatMap((node) =>
      (node.data.outputs ?? []).map((output) => ({
        key: `${node.id}:${output.segmentKey ?? output.id}`,
        sourceNodeId: node.id,
        outputId: output.segmentKey ?? output.id,
        displayName: `${node.data.label} · ${output.name}`,
        nodeLabel: node.data.label,
        outputName: output.name,
      })),
    );

  function updateInputSources(next: InputSource[]) {
    props.onChange({
      ...props.config,
      inputSources: next,
    });
  }

  function addInputSource(candidate: {
    sourceNodeId: string;
    outputId: string;
    displayName: string;
  }) {
    const current = inputSources();
    if (current.some((src) => src.sourceNodeId === candidate.sourceNodeId && src.outputId === candidate.outputId)) {
      return;
    }
    updateInputSources([
      ...current,
      {
        sourceNodeId: candidate.sourceNodeId,
        outputId: candidate.outputId,
        displayName: candidate.displayName,
      },
    ]);
  }

  function removeInputSource(index: number) {
    const current = [...inputSources()];
    current.splice(index, 1);
    updateInputSources(current);
  }

  function moveInputSource(index: number, direction: -1 | 1) {
    const current = [...inputSources()];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= current.length) return;
    [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
    updateInputSources(current);
  }

  return (
    <div class="space-y-4">
      {/* Input Sources (manual order) */}
      <div>
        <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          恢复来源
        </h4>
        <Show
          when={inputSources().length > 0}
          fallback={
            <p class="text-xs text-slate-500 italic text-center py-2">
              当前未配置恢复来源。建议手动选择要进入最终正文的上游输出，并按顺序排列。
            </p>
          }
        >
          <div class="space-y-1">
            <For each={inputSources()}>
              {(src, index) => (
                <div class="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-md border border-slate-200">
                  <div class="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => moveInputSource(index(), -1)}
                      disabled={index() === 0}
                      class="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                      title="上移"
                    >
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <title>上移</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveInputSource(index(), 1)}
                      disabled={index() === inputSources().length - 1}
                      class="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                      title="下移"
                    >
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <title>下移</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <div class="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span class="flex-1 text-xs text-slate-700 truncate">{src.displayName}</span>
                  <button
                    type="button"
                    onClick={() => removeInputSource(index())}
                    class="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                    title="移除来源"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <title>移除</title>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div>
        <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          可选上游输出
        </h4>
        <Show
          when={sourceCandidates().length > 0}
          fallback={
            <p class="text-xs text-amber-600 italic text-center py-2">
              当前没有可选的上游输出。请先连接并配置上游节点。
            </p>
          }
        >
          <div class="space-y-2">
            <For each={sourceCandidates()}>
              {(candidate) => {
                const alreadyAdded = () =>
                  inputSources().some(
                    (src) =>
                      src.sourceNodeId === candidate.sourceNodeId &&
                      src.outputId === candidate.outputId,
                  );
                return (
                  <button
                    type="button"
                    onClick={() => addInputSource(candidate)}
                    disabled={alreadyAdded()}
                    class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title={candidate.displayName}
                  >
                    <span class="min-w-0">
                      <span class="block text-xs font-medium text-slate-700 truncate">{candidate.outputName}</span>
                      <span class="block text-[11px] text-slate-500 truncate">{candidate.nodeLabel}</span>
                    </span>
                    <span class="text-[11px] text-slate-400 flex-shrink-0">
                      {alreadyAdded() ? "已添加" : "添加"}
                    </span>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Description */}
      <div class="bg-slate-50 rounded-md p-2.5 border border-slate-100">
        <p class="text-xs text-slate-500">
          恢复节点会按上面的顺序读取上游内容，再结合配对脱敏节点的映射把占位符恢复成真实值。
        </p>
      </div>

      {/* Paired Node Selector */}
      <div>
        <label for="restore-paired-node" class="block text-sm font-medium text-gray-700 mb-1">
          配对的脱敏节点
        </label>
        <select
          id="restore-paired-node"
          value={props.config.pairedDesensitizeNodeId ?? ""}
          onChange={(e) =>
            props.onChange({
              ...props.config,
              pairedDesensitizeNodeId: e.currentTarget.value || null,
            })
          }
          class="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
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
