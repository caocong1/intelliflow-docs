import { For } from "solid-js";
import type { ExportConfig, VariableRef, OutputDef } from "@intelliflow/shared";
import type { FlowNodeData } from "../../../lib/flow-engine/types";

type ExportFormat = "word" | "pdf" | "markdown";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: "word", label: "Word", desc: ".docx 格式，适合正式文档" },
  { value: "pdf", label: "PDF", desc: ".pdf 格式，适合固定版式" },
  { value: "markdown", label: "Markdown", desc: ".md 格式，适合技术文档" },
];

interface ExportConfigProps {
  config: ExportConfig;
  allNodes: FlowNodeData[];
  upstreamNodes: FlowNodeData[];
  onChange: (config: ExportConfig) => void;
}

function getAvailableOutputs(nodes: FlowNodeData[]): Array<{ ref: VariableRef; outputDef: OutputDef; nodeLabel: string }> {
  const result: Array<{ ref: VariableRef; outputDef: OutputDef; nodeLabel: string }> = [];
  for (const node of nodes) {
    const outputs = node.data.outputs as OutputDef[];
    for (const output of outputs) {
      if (output.name) {
        result.push({
          ref: {
            nodeId: node.id,
            outputId: output.id,
            variableName: `${node.id}.${output.id}`,
          },
          outputDef: output,
          nodeLabel: node.data.label,
        });
      }
    }
  }
  return result;
}

export default function ExportConfigPanel(props: ExportConfigProps) {
  const availableOutputs = () => getAvailableOutputs(props.upstreamNodes);

  function isSelected(ref: VariableRef) {
    return props.config.contentMapping.some(
      (r) => r.nodeId === ref.nodeId && r.outputId === ref.outputId
    );
  }

  function toggleOutput(ref: VariableRef) {
    const selected = isSelected(ref);
    const next = selected
      ? props.config.contentMapping.filter(
          (r) => !(r.nodeId === ref.nodeId && r.outputId === ref.outputId)
        )
      : [...props.config.contentMapping, ref];
    props.onChange({ ...props.config, contentMapping: next });
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

      {/* Template Selector */}
      <div class="border-t border-slate-100 pt-3">
        <label for="export-template" class="block text-sm font-medium text-gray-700 mb-1">文档模板</label>
        <select
          id="export-template"
          value={props.config.templateId ?? ""}
          onChange={(e) =>
            props.onChange({ ...props.config, templateId: e.currentTarget.value || null })
          }
          class="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
        >
          <option value="">默认模板</option>
        </select>
        <p class="text-xs text-slate-400 mt-1">模板系统将在后续版本中支持</p>
      </div>

      {/* Content Mapping */}
      <div class="border-t border-slate-100 pt-3">
        <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">导出内容</h4>
        <p class="text-xs text-slate-500 mb-2">选择要包含在导出文件中的上游输出内容：</p>

        {availableOutputs().length === 0 ? (
          <p class="text-xs text-slate-400 italic text-center py-3">
            暂无可用的上游输出。请先为上游节点定义输出内容块。
          </p>
        ) : (
          <div class="space-y-1">
            <For each={availableOutputs()}>
              {({ ref, outputDef, nodeLabel }) => (
                <label class="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSelected(ref)}
                    onChange={() => toggleOutput(ref)}
                    class="rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span class="text-xs text-slate-400">{nodeLabel}</span>
                  <span class="text-slate-300 text-xs">&rsaquo;</span>
                  <span class="text-xs text-slate-700 font-medium">{outputDef.name}</span>
                </label>
              )}
            </For>
          </div>
        )}
      </div>
    </div>
  );
}
