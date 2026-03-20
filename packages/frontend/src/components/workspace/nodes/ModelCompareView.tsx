import { createSignal, For, Show } from "solid-js";
import type { ModelOutput } from "@intelliflow/shared";
import type { JSX } from "solid-js";

interface Props {
  models: Record<string, ModelOutput>;
  renderMarkdown: (text: string) => JSX.Element;
  onClose: () => void;
}

export default function ModelCompareView(props: Props) {
  const modelList = () => Object.values(props.models);
  const modelIds = () => Object.keys(props.models);

  const [leftId, setLeftId] = createSignal(modelIds()[0] ?? "");
  const [rightId, setRightId] = createSignal(modelIds()[1] ?? modelIds()[0] ?? "");

  const leftModel = () => props.models[leftId()];
  const rightModel = () => props.models[rightId()];

  return (
    <div class="space-y-3">
      {/* Header */}
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-700">Side-by-Side Comparison</h3>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          onClick={props.onClose}
        >
          Close Compare
        </button>
      </div>

      {/* Two columns */}
      <div class="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div class="space-y-2">
          <select
            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={leftId()}
            onChange={(e) => setLeftId(e.currentTarget.value)}
          >
            <For each={modelList()}>
              {(model) => (
                <option value={model.modelId}>
                  {model.modelDisplayName}
                </option>
              )}
            </For>
          </select>
          <div class="bg-white border border-gray-200 rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
            <Show when={leftModel()} fallback={<div class="text-gray-400 text-sm">Select a model</div>}>
              {(m) => (
                <>
                  <Show when={m().status === "streaming"}>
                    <div class="mb-2">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 animate-pulse">
                        Generating...
                      </span>
                    </div>
                  </Show>
                  {props.renderMarkdown(m().content)}
                  <Show when={m().status === "streaming"}>
                    <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                  </Show>
                </>
              )}
            </Show>
          </div>
        </div>

        {/* Right column */}
        <div class="space-y-2">
          <select
            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={rightId()}
            onChange={(e) => setRightId(e.currentTarget.value)}
          >
            <For each={modelList()}>
              {(model) => (
                <option value={model.modelId}>
                  {model.modelDisplayName}
                </option>
              )}
            </For>
          </select>
          <div class="bg-white border border-gray-200 rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
            <Show when={rightModel()} fallback={<div class="text-gray-400 text-sm">Select a model</div>}>
              {(m) => (
                <>
                  <Show when={m().status === "streaming"}>
                    <div class="mb-2">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 animate-pulse">
                        Generating...
                      </span>
                    </div>
                  </Show>
                  {props.renderMarkdown(m().content)}
                  <Show when={m().status === "streaming"}>
                    <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                  </Show>
                </>
              )}
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
