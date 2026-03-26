import { For, Show, createSignal } from "solid-js";

interface AIEditToolbarProps {
  selectionRect: { top: number; left: number; width: number };
  onAction: (action: string, customInstruction?: string) => void;
  models: Array<{ id: string; name: string; deploymentType: "cloud" | "local" }>;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  isPostRestore: boolean;
  isStreaming: boolean;
  onCancel: () => void;
}

const PRESET_ACTIONS = [
  { key: "rewrite", label: "改写" },
  { key: "simplify", label: "精简" },
  { key: "expand", label: "扩写" },
  { key: "fix", label: "纠错" },
] as const;

/**
 * Floating toolbar with AI editing actions, custom instruction input,
 * and model selector with security-context filtering.
 *
 * All action buttons use onMouseDown + preventDefault to prevent
 * textarea blur which would clear the selection.
 */
export default function AIEditToolbar(props: AIEditToolbarProps) {
  const [showCustomInput, setShowCustomInput] = createSignal(false);
  const [customText, setCustomText] = createSignal("");
  const [showModelDropdown, setShowModelDropdown] = createSignal(false);

  const availableModels = () => {
    if (props.isPostRestore) {
      return props.models.filter((m) => m.deploymentType === "local");
    }
    return props.models;
  };

  const selectedModelName = () => {
    const model = props.models.find((m) => m.id === props.selectedModelId);
    return model?.name ?? "选择模型";
  };

  function handlePresetAction(action: string, e: MouseEvent) {
    e.preventDefault();
    props.onAction(action);
  }

  function handleCustomSubmit(e: MouseEvent) {
    e.preventDefault();
    const text = customText().trim();
    if (text) {
      props.onAction("custom", text);
      setCustomText("");
      setShowCustomInput(false);
    }
  }

  function handleCustomKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = customText().trim();
      if (text) {
        props.onAction("custom", text);
        setCustomText("");
        setShowCustomInput(false);
      }
    }
    if (e.key === "Escape") {
      setShowCustomInput(false);
    }
  }

  function handleModelSelect(modelId: string, e: MouseEvent) {
    e.preventDefault();
    props.onModelChange(modelId);
    setShowModelDropdown(false);
  }

  function handleCancel(e: MouseEvent) {
    e.preventDefault();
    props.onCancel();
  }

  return (
    <div
      class="absolute z-50 flex items-center gap-1 px-2 py-1.5 bg-white rounded-xl shadow-[0_4px_24px_rgba(25,28,30,0.12)] border border-[rgba(199,196,216,0.3)]"
      style={{
        top: `${props.selectionRect.top - 48}px`,
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <Show
        when={!props.isStreaming}
        fallback={
          /* Cancel button during streaming */
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            onMouseDown={handleCancel}
          >
            取消
          </button>
        }
      >
        {/* Preset action buttons */}
        <For each={PRESET_ACTIONS}>
          {(action) => (
            <button
              type="button"
              class="px-2.5 py-1.5 text-xs font-medium text-[#464555] rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] transition-colors whitespace-nowrap"
              onMouseDown={(e) => handlePresetAction(action.key, e)}
            >
              {action.label}
            </button>
          )}
        </For>

        {/* Custom instruction button / input */}
        <Show
          when={showCustomInput()}
          fallback={
            <button
              type="button"
              class="px-2.5 py-1.5 text-xs font-medium text-[#4f46e5] rounded-lg hover:bg-[rgba(79,70,229,0.08)] transition-colors whitespace-nowrap"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowCustomInput(true);
              }}
            >
              自定义
            </button>
          }
        >
          <div class="flex items-center gap-1">
            <input
              type="text"
              class="w-40 px-2 py-1 text-xs border border-[rgba(199,196,216,0.4)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4f46e5] focus:border-[#4f46e5] text-[#191c1e]"
              placeholder="输入编辑指令..."
              value={customText()}
              onInput={(e) => setCustomText(e.currentTarget.value)}
              onKeyDown={handleCustomKeyDown}
              autofocus
            />
            <button
              type="button"
              class="px-2 py-1 text-xs font-medium text-white bg-[#4f46e5] rounded-lg hover:bg-[#3525cd] transition-colors"
              onMouseDown={handleCustomSubmit}
            >
              发送
            </button>
          </div>
        </Show>

        {/* Divider */}
        <div class="w-px h-5 bg-[rgba(199,196,216,0.4)] mx-1" />

        {/* Model selector dropdown */}
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#464555] rounded-lg hover:bg-[rgba(79,70,229,0.08)] transition-colors whitespace-nowrap"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowModelDropdown(!showModelDropdown());
            }}
          >
            <Show when={props.isPostRestore}>
              {/* Lock icon for post-restore security context */}
              <svg
                class="w-3.5 h-3.5 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </Show>
            <span>{selectedModelName()}</span>
            {/* Chevron down */}
            <svg
              class="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Dropdown */}
          <Show when={showModelDropdown()}>
            <div class="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-[0_8px_32px_rgba(25,28,30,0.12)] border border-[rgba(199,196,216,0.3)] py-1 z-50">
              {/* Security hint for post-restore context */}
              <Show when={props.isPostRestore}>
                <div class="px-3 py-2 text-xs text-amber-600 bg-amber-50 border-b border-[rgba(199,196,216,0.2)] flex items-center gap-1.5">
                  <svg
                    class="w-3.5 h-3.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  <span>当前节点包含恢复数据，仅显示本地模型</span>
                </div>
              </Show>

              <For each={availableModels()}>
                {(model) => (
                  <button
                    type="button"
                    class={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      model.id === props.selectedModelId
                        ? "bg-[#e2dfff] text-[#3525cd] font-medium"
                        : "text-[#464555] hover:bg-[#f7f9fb]"
                    }`}
                    onMouseDown={(e) => handleModelSelect(model.id, e)}
                  >
                    <div class="flex items-center justify-between">
                      <span>{model.name}</span>
                      <Show when={model.id === props.selectedModelId}>
                        <svg
                          class="w-3.5 h-3.5 text-[#4f46e5]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                          aria-hidden="true"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </Show>
                    </div>
                  </button>
                )}
              </For>

              <Show when={availableModels().length === 0}>
                <div class="px-3 py-2 text-xs text-[rgba(70,69,85,0.4)] italic">
                  无可用模型
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
