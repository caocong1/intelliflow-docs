import type { ModelOutput } from "@intelliflow/shared";
import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { JSX } from "solid-js";

interface Props {
  models: Record<string, ModelOutput>;
  renderMarkdown: (text: string) => JSX.Element;
  viewMode: "markdown" | "source";
  onClose: () => void;
  onSelect?: (modelId: string) => void;
}

type PanelSide = "left" | "right";

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string; pulse: boolean }> = {
  pending: {
    label: "等待中",
    cls: "bg-[#eceef0] text-[#464555]",
    dot: "bg-[#c7c4d8]",
    pulse: false,
  },
  streaming: {
    label: "生成中",
    cls: "bg-indigo-50 text-indigo-600",
    dot: "bg-indigo-500",
    pulse: true,
  },
  completed: {
    label: "已完成",
    cls: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
    pulse: false,
  },
  failed: {
    label: "失败",
    cls: "bg-red-50 text-red-500",
    dot: "bg-red-400",
    pulse: false,
  },
  format_error: {
    label: "格式错误",
    cls: "bg-amber-50 text-amber-600",
    dot: "bg-amber-500",
    pulse: false,
  },
};

export default function ModelCompareView(props: Props) {
  const modelList = () => Object.values(props.models);
  const modelKeys = () => modelList().map((m) => m.modelId);

  const [leftId, setLeftId] = createSignal<string>("");
  const [rightId, setRightId] = createSignal<string>("");
  const [openDropdown, setOpenDropdown] = createSignal<PanelSide | null>(null);

  // Initialize or repair selection whenever the available models change
  createEffect(() => {
    const keys = modelKeys();
    if (keys.length === 0) return;

    if (!keys.includes(leftId())) {
      setLeftId(keys[0] ?? "");
    }
    if (!keys.includes(rightId()) || rightId() === leftId()) {
      setRightId(keys.find((k) => k !== leftId()) ?? keys[0] ?? "");
    }
  });

  const leftModel = () => props.models[leftId()] ?? null;
  const rightModel = () => props.models[rightId()] ?? null;

  // Auto-scroll to bottom during streaming, per panel
  const scrollers = new Map<PanelSide, HTMLDivElement>();
  createEffect(() => {
    const panels: Array<[PanelSide, ModelOutput | null]> = [
      ["left", leftModel()],
      ["right", rightModel()],
    ];
    for (const [side, model] of panels) {
      if (!model) continue;
      if (model.status !== "streaming" && model.status !== "pending") continue;

      // Reactive keys — force effect to re-run on content/status changes
      const key = `${side}:${model.content.length}:${model.status}:${props.viewMode}`;
      void key;

      requestAnimationFrame(() => {
        const scroller = scrollers.get(side);
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
    }
  });

  // Close dropdown on outside click
  createEffect(() => {
    if (openDropdown() === null) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-compare-dropdown]")) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("click", handler);
    onCleanup(() => document.removeEventListener("click", handler));
  });

  function statusBadge(status: ModelOutput["status"]) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
      <span
        class={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${config.cls}`}
      >
        <span class={`w-1 h-1 rounded-full ${config.dot} ${config.pulse ? "animate-ping" : ""}`} />
        {config.label}
      </span>
    );
  }

  function handleSelectModel(side: PanelSide, modelId: string) {
    // If picking a model already on the other side, swap them
    if (side === "left") {
      if (modelId === rightId()) setRightId(leftId());
      setLeftId(modelId);
    } else {
      if (modelId === leftId()) setLeftId(rightId());
      setRightId(modelId);
    }
    setOpenDropdown(null);
  }

  function handleSwap() {
    const l = leftId();
    setLeftId(rightId());
    setRightId(l);
  }

  return (
    <div class="space-y-3">
      {/* Inline toolbar — no card chrome, so it feels part of the parent */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-[#8b8a99] tracking-wide uppercase whitespace-nowrap">
            并排对比
          </span>
          <ModelSelectorPill
            side="left"
            model={leftModel()}
            isOpen={openDropdown() === "left"}
            onToggle={() => setOpenDropdown(openDropdown() === "left" ? null : "left")}
            onSelect={(id) => handleSelectModel("left", id)}
            allModels={modelList()}
            otherId={rightId()}
          />
          <button
            type="button"
            class="p-1.5 rounded-lg text-[#8b8a99] hover:bg-[#f2f4f6] hover:text-[#191c1e] transition-colors"
            onClick={handleSwap}
            title="交换两侧"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </button>
          <ModelSelectorPill
            side="right"
            model={rightModel()}
            isOpen={openDropdown() === "right"}
            onToggle={() => setOpenDropdown(openDropdown() === "right" ? null : "right")}
            onSelect={(id) => handleSelectModel("right", id)}
            allModels={modelList()}
            otherId={leftId()}
          />
        </div>
        <button
          type="button"
          class="flex items-center gap-1 text-xs font-medium text-[#464555] hover:text-[#191c1e] px-2.5 py-1.5 rounded-lg hover:bg-[#f2f4f6] transition-colors"
          onClick={props.onClose}
        >
          <svg
            class="w-3 h-3"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          关闭对比
        </button>
      </div>

      {/* Two-panel content — fixed 50/50 grid */}
      <div class="grid grid-cols-2 gap-3">
        <For
          each={[
            { side: "left" as const, accent: "bg-indigo-500", label: "A" },
            { side: "right" as const, accent: "bg-purple-500", label: "B" },
          ]}
        >
          {(panel) => {
            const model = () => (panel.side === "left" ? leftModel() : rightModel());
            return (
              <div class="flex flex-col rounded-xl bg-[#f7f9fb] overflow-hidden border border-[rgba(199,196,216,0.2)]">
                {/* Minimal panel header */}
                <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-white border-b border-[rgba(199,196,216,0.15)]">
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold text-white ${panel.accent}`}
                    >
                      {panel.label}
                    </span>
                    <span class="text-sm font-semibold text-[#191c1e] truncate">
                      {model()?.modelDisplayName ?? "未选择"}
                    </span>
                    <Show when={model()}>{(m) => statusBadge(m().status)}</Show>
                  </div>
                  <Show
                    when={(() => {
                      const m = model();
                      return props.onSelect && m?.status === "completed" ? m : null;
                    })()}
                  >
                    {(m) => (
                      <button
                        type="button"
                        class="flex-shrink-0 px-2 py-1 text-[11px] font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                        onClick={() => props.onSelect?.(m().modelId)}
                      >
                        选择此输出
                      </button>
                    )}
                  </Show>
                </div>

                {/* Panel content */}
                <div
                  ref={(el) => scrollers.set(panel.side, el)}
                  class="flex-1 p-4 min-h-[320px] max-h-[560px] overflow-y-auto"
                >
                  <Show
                    when={model()}
                    fallback={
                      <div class="flex items-center justify-center h-full text-sm text-[#8b8a99]">
                        请从上方选择模型
                      </div>
                    }
                  >
                    {(m) => (
                      <Show
                        when={m().status === "failed"}
                        fallback={
                          <Show
                            when={
                              m().content || m().status === "streaming" || m().status === "pending"
                            }
                            fallback={
                              <div class="flex items-center justify-center h-full">
                                <span class="text-sm text-[#464555]">暂无内容</span>
                              </div>
                            }
                          >
                            <Show
                              when={m().content}
                              fallback={
                                <div class="flex items-center gap-2 text-sm text-[#464555]">
                                  <div class="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                  {m().status === "pending" ? "准备中..." : "正在生成中..."}
                                </div>
                              }
                            >
                              <Show
                                when={props.viewMode === "markdown"}
                                fallback={
                                  <pre class="text-xs font-mono text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                                    {m().content}
                                  </pre>
                                }
                              >
                                {props.renderMarkdown(m().content)}
                              </Show>
                              <Show when={m().status === "streaming"}>
                                <span class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                              </Show>
                            </Show>
                          </Show>
                        }
                      >
                        <div class="bg-red-50 rounded-lg p-3 border border-red-100">
                          <p class="text-sm text-red-600">
                            {m().errorMessage ?? "生成失败，请重试。"}
                          </p>
                        </div>
                      </Show>
                    )}
                  </Show>
                </div>

                {/* Panel footer: char count */}
                <Show when={model()?.content}>
                  {(content) => (
                    <div class="px-4 py-1.5 text-[11px] text-[#8b8a99] border-t border-[rgba(199,196,216,0.15)] bg-white">
                      {content().length.toLocaleString()} 字符
                    </div>
                  )}
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Model selector pill (inline dropdown)

interface PillProps {
  side: PanelSide;
  model: ModelOutput | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (modelId: string) => void;
  allModels: ModelOutput[];
  otherId: string;
}

function ModelSelectorPill(props: PillProps) {
  return (
    <div class="relative" data-compare-dropdown>
      <button
        type="button"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#191c1e] bg-white border border-[rgba(199,196,216,0.4)] hover:border-indigo-300 hover:shadow-sm transition-all"
        onClick={props.onToggle}
      >
        <span
          class={`w-1.5 h-1.5 rounded-full ${props.side === "left" ? "bg-indigo-500" : "bg-purple-500"}`}
        />
        <span class="truncate max-w-[140px]">{props.model?.modelDisplayName ?? "未选择"}</span>
        <svg
          class={`w-3 h-3 text-[#464555] transition-transform ${props.isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <Show when={props.isOpen}>
        <div class="absolute left-0 top-full mt-1 z-20 min-w-[200px] rounded-xl bg-white border border-[rgba(199,196,216,0.3)] shadow-[0_8px_24px_rgba(25,28,30,0.12)] py-1 overflow-hidden">
          <For each={props.allModels}>
            {(model) => {
              const isCurrent = () => model.modelId === props.model?.modelId;
              const isOther = () => model.modelId === props.otherId && !isCurrent();
              return (
                <button
                  type="button"
                  class={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors ${
                    isCurrent()
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-[#191c1e] font-medium hover:bg-[#f7f9fb]"
                  }`}
                  onClick={() => props.onSelect(model.modelId)}
                >
                  <span class="truncate">{model.modelDisplayName}</span>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <Show when={isOther()}>
                      <span class="text-[9px] px-1.5 py-0.5 rounded bg-[#eceef0] text-[#464555]">
                        对侧
                      </span>
                    </Show>
                    <Show when={isCurrent()}>
                      <svg
                        class="w-3 h-3 text-indigo-600"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </Show>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
