import type { NodeConfig, VariableRef } from "@intelliflow/shared";
import { getSkipStrategyTargets } from "../../../../../shared/src/types";
import { For, Show } from "solid-js";
import type { FlowNodeData } from "../../../lib/flow-engine/types";

interface SkipStrategyEditorProps {
  currentNodeId: string;
  config: NodeConfig;
  upstreamNodes: FlowNodeData[];
  onChange: (config: NodeConfig) => void;
}

export default function SkipStrategyEditor(props: SkipStrategyEditorProps) {
  const targets = () => getSkipStrategyTargets(props.currentNodeId, props.config);

  const sourceOptions = () =>
    props.upstreamNodes.flatMap((node) =>
      node.data.outputs.map((output) => ({
        label: `${node.data.label} / ${output.name}`,
        ref: {
          nodeId: node.id,
          outputId: output.segmentKey ?? output.id,
          variableName: `${node.id}.${output.segmentKey ?? output.id}`,
        } satisfies VariableRef,
      })),
    );

  function updateBinding(
    outputId: string,
    patch: { mode?: "inherit" | "empty"; sourceRef?: VariableRef | undefined },
  ) {
    const currentBindings = props.config.skipStrategy?.bindings ?? {};
    const previous = currentBindings[outputId];
    const nextMode = patch.mode ?? previous?.mode ?? "empty";
    const nextSourceRef =
      nextMode === "inherit" ? (patch.sourceRef ?? previous?.sourceRef) : undefined;

    props.onChange({
      ...props.config,
      skipStrategy: {
        bindings: {
          ...currentBindings,
          [outputId]:
            nextMode === "inherit" && nextSourceRef
              ? { mode: nextMode, sourceRef: nextSourceRef }
              : { mode: nextMode },
        },
      },
    });
  }

  function handleModeChange(outputId: string, mode: "inherit" | "empty") {
    if (mode === "empty") {
      updateBinding(outputId, { mode, sourceRef: undefined });
      return;
    }

    const firstOption = sourceOptions()[0];
    updateBinding(outputId, {
      mode,
      sourceRef: props.config.skipStrategy?.bindings?.[outputId]?.sourceRef ?? firstOption?.ref,
    });
  }

  return (
    <Show when={props.config.skippable && targets().length > 0}>
      <div class="mt-4 border border-slate-200 rounded-md">
        <div class="px-3 py-2 border-b border-slate-100 bg-slate-50">
          <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wide">跳过输出映射</h4>
          <p class="mt-1 text-xs text-slate-500 leading-5">
            运行时点击“跳过”后，系统会按这里的预设把当前节点输出继承上游结果或直接置空。
          </p>
          <Show
            when={
              props.config.type === "model_call" &&
              props.config.namedOutputs &&
              props.config.namedOutputs.length > 0 &&
              props.config.enableUserSelectionOutput
            }
          >
            <p class="mt-1 text-xs text-indigo-600 leading-5">
              命名产物已配置时，“用户选择输出”会自动沿用对应产物的跳过映射，无需重复配置。
            </p>
          </Show>
        </div>

        <div class="px-3 py-3 space-y-3">
          <For each={targets()}>
            {(target) => {
              const outputId = target.segmentKey ?? target.id;
              const binding = () => props.config.skipStrategy?.bindings?.[outputId];
              return (
                <div class="rounded-lg border border-slate-200 bg-white px-3 py-3 space-y-2">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-slate-800">{target.name}</p>
                      <Show when={target.description}>
                        <p class="text-xs text-slate-500 mt-1">{target.description}</p>
                      </Show>
                    </div>
                    <span class="text-[11px] font-mono text-slate-400">{outputId}</span>
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <label class="text-xs text-slate-600">
                      跳过时处理方式
                      <select
                        value={binding()?.mode ?? "empty"}
                        onChange={(e) =>
                          handleModeChange(outputId, e.currentTarget.value as "inherit" | "empty")
                        }
                        class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="empty">置空</option>
                        <option value="inherit">继承上游输出</option>
                      </select>
                    </label>

                    <Show when={binding()?.mode === "inherit"}>
                      <label class="text-xs text-slate-600">
                        上游输出
                        <select
                          value={
                            binding()?.sourceRef
                              ? `${binding()!.sourceRef!.nodeId}::${binding()!.sourceRef!.outputId}`
                              : ""
                          }
                          onChange={(e) => {
                            const selected = sourceOptions().find(
                              (option) =>
                                `${option.ref.nodeId}::${option.ref.outputId}` ===
                                e.currentTarget.value,
                            );
                            updateBinding(outputId, {
                              mode: "inherit",
                              sourceRef: selected?.ref,
                            });
                          }}
                          class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          <option value="">请选择上游输出</option>
                          <For each={sourceOptions()}>
                            {(option) => (
                              <option value={`${option.ref.nodeId}::${option.ref.outputId}`}>
                                {option.label}
                              </option>
                            )}
                          </For>
                        </select>
                      </label>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}
