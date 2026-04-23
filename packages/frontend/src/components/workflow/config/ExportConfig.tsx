import { For, Show, createSignal } from "solid-js";
import type { ExportConfig, VariableRef, OutputDef } from "@intelliflow/shared";
import type { FlowNodeData } from "../../../lib/flow-engine/types";
import VariablePicker from "../prompt/VariablePicker";

type ExportFormat = "word" | "pdf" | "markdown" | "pptx";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: "word", label: "Word", desc: ".docx 格式，适合正式文档" },
  { value: "pdf", label: "PDF", desc: ".pdf 格式，适合固定版式" },
  { value: "markdown", label: "Markdown", desc: ".md 格式，适合技术文档" },
  { value: "pptx", label: "PPT", desc: ".pptx 格式，适合演示汇报" },
];

interface ExportConfigProps {
  config: ExportConfig;
  allNodes: FlowNodeData[];
  upstreamNodes: FlowNodeData[];
  onChange: (config: ExportConfig) => void;
}

export default function ExportConfigPanel(props: ExportConfigProps) {
  const [showPicker, setShowPicker] = createSignal(false);
  const [dragIndex, setDragIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  const mapping = () => props.config.contentMapping ?? [];
  const formats = () => props.config.formats ?? [];
  const hasDocFormat = () => formats().includes("word") || formats().includes("pdf");
  const hasPptx = () => formats().includes("pptx");

  function addMapping(ref: VariableRef) {
    // Avoid duplicates
    const exists = mapping().some(
      (r) => r.nodeId === ref.nodeId && r.outputId === ref.outputId,
    );
    if (exists) return;
    props.onChange({ ...props.config, contentMapping: [...mapping(), ref] });
  }

  function removeMapping(index: number) {
    const next = [...mapping()];
    next.splice(index, 1);
    props.onChange({ ...props.config, contentMapping: next });
  }

  /** Resolve a VariableRef to a display label using upstream node data */
  function resolveLabel(ref: VariableRef): string {
    const node = props.upstreamNodes.find((n) => n.id === ref.nodeId);
    if (!node) return `${ref.nodeId}.${ref.outputId}`;
    const outputs = node.data.outputs as OutputDef[];
    const output = outputs.find((o) => o.segmentKey === ref.outputId) ?? outputs.find((o) => o.id === ref.outputId);
    return `${node.data.label}.${output?.name ?? ref.outputId}`;
  }

  // --- Drag reorder handlers ---
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(targetIndex: number) {
    const from = dragIndex();
    if (from === null || from === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const items = [...mapping()];
    const [moved] = items.splice(from, 1);
    items.splice(targetIndex, 0, moved);
    props.onChange({ ...props.config, contentMapping: items });
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div class="space-y-4">
      {/* Format Selector (multi-select) */}
      <div>
        <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">导出格式</h4>
        <p class="text-xs text-slate-500 mb-2">选择允许的导出格式（运行时用户从中选一个）：</p>
        <div class="space-y-1.5">
          <For each={FORMAT_OPTIONS}>
            {(opt) => {
              const selected = () => (props.config.formats ?? []).includes(opt.value);
              return (
                <label class="flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer select-none transition-colors hover:bg-slate-50"
                  classList={{
                    "border-red-400 bg-red-50": selected(),
                    "border-slate-200": !selected(),
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected()}
                    onChange={() => {
                      const current = props.config.formats ?? [];
                      const next = selected()
                        ? current.filter((f) => f !== opt.value)
                        : [...current, opt.value];
                      props.onChange({ ...props.config, formats: next });
                    }}
                    class="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <div>
                    <p class="text-xs font-medium text-slate-800">{opt.label}</p>
                    <p class="text-xs text-slate-400">{opt.desc}</p>
                  </div>
                </label>
              );
            }}
          </For>
        </div>
        {(props.config.formats ?? []).length === 0 && (
          <p class="text-xs text-amber-600 mt-1.5">请至少选择一种导出格式</p>
        )}
      </div>

      {/* Template Bindings — dynamic per selected formats */}
      <Show when={hasDocFormat() || hasPptx()}>
        <div class="border-t border-slate-100 pt-3 space-y-3">
          <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide">模板配置</h4>

          {/* Word/PDF template (legacy templateId compat) */}
          <Show when={hasDocFormat()}>
            <div>
              <label for="export-template-doc" class="block text-xs font-medium text-gray-600 mb-1">文档模板（Word/PDF）</label>
              <select
                id="export-template-doc"
                value={props.config.templateBindings?.word ?? props.config.templateId ?? ""}
                onChange={(e) => {
                  const val = e.currentTarget.value || undefined;
                  const bindings = { ...props.config.templateBindings };
                  if (val) {
                    bindings.word = val;
                    if (formats().includes("pdf")) bindings.pdf = val;
                  } else {
                    bindings.word = undefined;
                    bindings.pdf = undefined;
                  }
                  props.onChange({ ...props.config, templateBindings: bindings });
                }}
                class="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
              >
                <option value="">默认模板</option>
              </select>
            </div>
          </Show>

          <Show when={hasPptx()}>
            <div class="space-y-2">
              <p class="text-xs text-slate-500 leading-5">
                PPT 导出主流程已切换为内置 style-pack 风格系统。流程里不再预绑定 PPT 模板，
                运行时用户只需选择一种演示风格并导出下载；历史 `templateBindings.pptx` /
                `templateId` 仅作兼容保留，不再影响主导出路径。
              </p>

              {/* Render engine selector — opt-in HTML-fidelity pipeline */}
              <div class="border border-slate-200 rounded-md p-3 bg-slate-50" role="radiogroup" aria-label="PPT 渲染引擎">
                <div class="block text-xs font-semibold text-gray-700 mb-1">
                  PPT 渲染引擎
                </div>
                <div class="space-y-1">
                  <label class="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="pptRenderEngine"
                      value="archetype"
                      checked={(props.config.pptRenderEngine ?? "archetype") === "archetype"}
                      onChange={() => props.onChange({ ...props.config, pptRenderEngine: "archetype" })}
                      class="mt-0.5"
                    />
                    <span>
                      <span class="font-medium text-slate-700">默认引擎（Archetype）</span>
                      <span class="block text-[11px] text-slate-500 leading-4">
                        style-pack 驱动，秒级出片，视觉偏干净企业风。无外部依赖。
                      </span>
                    </span>
                  </label>
                  <label class="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="pptRenderEngine"
                      value="html_fidelity"
                      checked={props.config.pptRenderEngine === "html_fidelity"}
                      onChange={() => props.onChange({ ...props.config, pptRenderEngine: "html_fidelity" })}
                      class="mt-0.5"
                    />
                    <span>
                      <span class="font-medium text-slate-700">HTML 保真引擎（可编辑）</span>
                      <span class="block text-[11px] text-slate-500 leading-4">
                        HTML 模板家族 + LLM 组版 + Chrome 渲染，非对称版式、可编辑文本框。
                        耗时 10-30s/页，依赖 LLM provider。
                      </span>
                    </span>
                  </label>
                </div>

                <Show when={props.config.pptRenderEngine === "html_fidelity"}>
                  <div class="mt-2 pt-2 border-t border-slate-200">
                    <label for="ppt-html-template-id-input" class="block text-xs font-semibold text-gray-700 mb-1">
                      HTML 模板家族 ID
                    </label>
                    <input
                      id="ppt-html-template-id-input"
                      type="text"
                      value={props.config.pptHtmlFidelityTemplateId ?? ""}
                      placeholder="622eee2ab7e6e"
                      onInput={(e) =>
                        props.onChange({
                          ...props.config,
                          pptHtmlFidelityTemplateId: (e.currentTarget as HTMLInputElement).value || undefined,
                        })
                      }
                      class="w-full px-2 py-1 text-xs border border-slate-300 rounded font-mono"
                    />
                    <p class="text-[11px] text-slate-500 mt-1 leading-4">
                      留空使用默认 <code class="font-mono">622eee2ab7e6e</code>。模板文件位于
                      <code class="font-mono">docs/design/ppt-mvp/html-styles/&lt;id&gt;/</code>。
                    </p>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Content Mapping with VariablePicker + drag reorder */}
      <div class="border-t border-slate-100 pt-3">
        <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">导出内容</h4>
        <p class="text-xs text-slate-500 mb-2">选择要包含在导出文件中的上游输出，拖拽调整顺序：</p>

        {/* Selected content mapping items (drag reorderable) */}
        <Show when={mapping().length > 0}>
          <div class="space-y-1 mb-3">
            <For each={mapping()}>
              {(ref, index) => (
                <div
                  draggable={true}
                  onDragStart={() => handleDragStart(index())}
                  onDragOver={(e) => handleDragOver(e, index())}
                  onDrop={() => handleDrop(index())}
                  onDragEnd={handleDragEnd}
                  class={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs transition-all cursor-grab active:cursor-grabbing ${
                    dragOverIndex() === index() && dragIndex() !== index()
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  } ${dragIndex() === index() ? "opacity-40" : ""}`}
                >
                  {/* Drag handle */}
                  <span class="text-slate-300 flex-shrink-0 select-none">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <title>拖拽排序</title>
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </span>
                  {/* Order number */}
                  <span class="w-5 h-5 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {index() + 1}
                  </span>
                  {/* Variable label */}
                  <span class="flex-1 text-slate-700 font-medium truncate">{resolveLabel(ref)}</span>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeMapping(index())}
                    class="flex-shrink-0 p-0.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none"
                    title="移除"
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

        {/* Add variable button + VariablePicker */}
        <div class="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker())}
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>添加内容</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            添加输出内容
          </button>

          <Show when={showPicker()}>
            <VariablePicker
              upstreamNodes={props.upstreamNodes}
              onSelect={(_name, ref) => {
                if (ref) {
                  addMapping(ref);
                }
                setShowPicker(false);
              }}
              onClose={() => setShowPicker(false)}
            />
          </Show>
        </div>

        <Show when={mapping().length === 0}>
          <p class="text-xs text-slate-400 italic text-center py-3 mt-2">
            尚未选择导出内容。点击上方按钮添加上游输出。
          </p>
        </Show>
      </div>
    </div>
  );
}
