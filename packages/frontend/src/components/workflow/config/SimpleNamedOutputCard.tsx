import type { NamedOutputDef, SimpleFieldDef, VariableRef } from "@intelliflow/shared";
import { For, Index, Show, createSignal } from "solid-js";
import { buildOutputBlockPreview } from "../../../lib/flow-engine/build-output-preview";
import {
  fieldsToJsonSchema,
  isUniqueFieldName,
  isValidFieldName,
} from "../../../lib/flow-engine/named-output-helpers";
import type { FlowNodeData } from "../../../lib/flow-engine/types";
import PromptEditor from "../prompt/PromptEditor";
import JsonSchemaEditor from "./JsonSchemaEditor";

interface SimpleNamedOutputCardProps {
  output: NamedOutputDef;
  index: number;
  onChange: (patch: Partial<NamedOutputDef>) => void;
  onRemove: () => void;
  availableVariables: VariableRef[];
  upstreamNodes: FlowNodeData[];
}

const FIELD_TYPES: Array<{ value: SimpleFieldDef["type"]; label: string }> = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
];

export default function SimpleNamedOutputCard(props: SimpleNamedOutputCardProps) {
  const [previewExpanded, setPreviewExpanded] = createSignal(false);
  // JSON schema editing mode: "visual" = field builder, "raw" = CodeMirror editor
  const [jsonSchemaMode, setJsonSchemaMode] = createSignal<"visual" | "raw">("visual");

  const fields = () => props.output.simpleFields ?? [];

  function schemaToString(schema: object | undefined): string {
    if (!schema) return "";
    try {
      return JSON.stringify(schema, null, 2);
    } catch {
      return "";
    }
  }

  function parseSchemaString(str: string): object | undefined {
    if (!str.trim()) return undefined;
    try {
      return JSON.parse(str) as object;
    } catch {
      return undefined;
    }
  }

  function updateField(fieldIndex: number, patch: Partial<SimpleFieldDef>) {
    const next = [...fields()];
    next[fieldIndex] = { ...next[fieldIndex], ...patch };
    const schema = fieldsToJsonSchema(next);
    props.onChange({ simpleFields: next, jsonSchema: schema });
  }

  function addField() {
    const next = [...fields(), { name: "", type: "string" as const, required: false }];
    const schema = fieldsToJsonSchema(next);
    props.onChange({ simpleFields: next, jsonSchema: schema });
  }

  function removeField(fieldIndex: number) {
    const next = fields().filter((_, i) => i !== fieldIndex);
    const schema = fieldsToJsonSchema(next);
    props.onChange({ simpleFields: next, jsonSchema: schema });
  }

  function otherFieldNames(fieldIndex: number): string[] {
    return fields()
      .filter((_, i) => i !== fieldIndex)
      .map((f) => f.name);
  }

  const previewText = () => buildOutputBlockPreview(props.output);

  return (
    <div class="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
      {/* Header row: name, format, ID badge, delete */}
      <div class="flex items-center gap-2">
        {/* Name input */}
        <div class="flex-1 min-w-0">
          <input
            type="text"
            value={props.output.name}
            onInput={(e) => props.onChange({ name: e.currentTarget.value })}
            placeholder="产物名称，如 投标蓝图"
            class="w-full h-7 px-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>

        {/* Format dropdown */}
        <select
          value={props.output.format}
          onChange={(e) => {
            const fmt = e.currentTarget.value as "text" | "json" | "markdown";
            const patch: Partial<NamedOutputDef> = { format: fmt };
            if (fmt !== "json") {
              patch.jsonSchema = undefined;
              patch.simpleFields = undefined;
            }
            props.onChange(patch);
          }}
          class="h-7 px-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          <option value="text">文本</option>
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
        </select>

        {/* Read-only ID badge */}
        <span
          class="h-7 px-1.5 text-xs font-mono text-slate-500 bg-slate-100 rounded select-all inline-flex items-center"
          title="系统引用 ID，创建后不可修改"
        >
          ID: {props.output.id}
        </span>

        {/* Delete button */}
        <button
          type="button"
          onClick={props.onRemove}
          class="p-1 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
          title="删除产物"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>删除</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Output prompt */}
      <div>
        <p class="text-xs font-medium text-gray-600 mb-1">产物提示词</p>
        <PromptEditor
          value={props.output.outputPrompt ?? ""}
          availableVariables={props.availableVariables}
          upstreamNodes={props.upstreamNodes}
          onChange={(v) => props.onChange({ outputPrompt: v })}
        />
        <p class="text-[10px] text-slate-400 mt-0.5">
          此提示词将自动与主提示词合并，无需在主提示词中重复
        </p>
      </div>

      {/* JSON configuration (only when format=json) */}
      <Show when={props.output.format === "json"}>
        <div class="space-y-1.5">
          {/* Toggle: 可视化字段 / 手写 Schema */}
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium text-gray-600">JSON 配置</p>
            <div class="inline-flex rounded-md border border-slate-200 text-[10px] overflow-hidden">
              <button
                type="button"
                onClick={() => setJsonSchemaMode("visual")}
                class={`px-2 py-0.5 transition-colors ${
                  jsonSchemaMode() === "visual"
                    ? "bg-purple-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                可视化字段
              </button>
              <button
                type="button"
                onClick={() => setJsonSchemaMode("raw")}
                class={`px-2 py-0.5 transition-colors ${
                  jsonSchemaMode() === "raw"
                    ? "bg-purple-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                手写 Schema
              </button>
            </div>
          </div>

          <Show
            when={jsonSchemaMode() === "visual"}
            fallback={
              /* ── Raw JSON Schema editor ── */
              <div>
                <JsonSchemaEditor
                  value={schemaToString(props.output.jsonSchema)}
                  onChange={(val) => {
                    const parsed = parseSchemaString(val);
                    props.onChange({ jsonSchema: parsed });
                  }}
                />
                <p class="text-[10px] text-slate-400 mt-1">
                  不填则仅做 JSON 语法校验，填写后额外做结构校验
                </p>
              </div>
            }
          >
            {/* ── Visual field builder ── */}

            {/* Field header */}
            <Show when={fields().length > 0}>
              <div class="flex items-center gap-1.5 px-1 text-[10px] text-slate-400 font-medium">
                <span class="w-28">字段名</span>
                <span class="w-20">类型</span>
                <span class="flex-1">描述</span>
                <span class="w-8 text-center">必填</span>
                <span class="w-5" />
              </div>
            </Show>

            {/* Field rows */}
            <Index each={fields()}>
              {(field, fieldIndex) => {
                const nameInvalid = () => field().name !== "" && !isValidFieldName(field().name);
                const nameDuplicate = () =>
                  field().name !== "" &&
                  !isUniqueFieldName(field().name, otherFieldNames(fieldIndex));

                return (
                  <div class="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={field().name}
                      onInput={(e) => updateField(fieldIndex, { name: e.currentTarget.value })}
                      placeholder="fieldName"
                      class={`w-28 px-1.5 py-1 text-xs font-mono border rounded focus:outline-none focus:ring-1 focus:ring-purple-400 ${
                        nameInvalid() || nameDuplicate()
                          ? "border-red-300 bg-red-50"
                          : "border-slate-200"
                      }`}
                    />
                    <select
                      value={field().type}
                      onChange={(e) =>
                        updateField(fieldIndex, {
                          type: e.currentTarget.value as SimpleFieldDef["type"],
                        })
                      }
                      class="w-20 px-1 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                    >
                      <For each={FIELD_TYPES}>
                        {(ft) => <option value={ft.value}>{ft.label}</option>}
                      </For>
                    </select>
                    <input
                      type="text"
                      value={field().description ?? ""}
                      onInput={(e) =>
                        updateField(fieldIndex, {
                          description: e.currentTarget.value || undefined,
                        })
                      }
                      placeholder="字段描述"
                      class="flex-1 px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                    <div class="w-8 flex justify-center">
                      <input
                        type="checkbox"
                        checked={field().required ?? false}
                        onChange={(e) =>
                          updateField(fieldIndex, { required: e.currentTarget.checked })
                        }
                        class="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeField(fieldIndex)}
                      class="w-5 text-slate-300 hover:text-red-500 transition-colors text-xs"
                      title="删除字段"
                    >
                      &times;
                    </button>
                  </div>
                );
              }}
            </Index>

            {/* Validation errors */}
            <Index each={fields()}>
              {(field, fieldIndex) => (
                <>
                  <Show when={field().name !== "" && !isValidFieldName(field().name)}>
                    <p class="text-[10px] text-red-500 pl-1">
                      "{field().name}" — 仅允许字母、数字、下划线，以字母或下划线开头
                    </p>
                  </Show>
                  <Show
                    when={
                      field().name !== "" &&
                      !isUniqueFieldName(field().name, otherFieldNames(fieldIndex))
                    }
                  >
                    <p class="text-[10px] text-red-500 pl-1">"{field().name}" — 字段名重复</p>
                  </Show>
                </>
              )}
            </Index>

            {/* Add field button */}
            <button
              type="button"
              onClick={addField}
              class="text-xs text-purple-600 hover:text-purple-800 font-medium"
            >
              + 添加字段
            </button>
          </Show>
        </div>
      </Show>

      {/* System output instruction preview (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setPreviewExpanded(!previewExpanded())}
          class="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          <span class="text-[10px]">{previewExpanded() ? "\u25BC" : "\u25B6"}</span>
          查看系统输出指令预览
        </button>
        <Show when={previewExpanded()}>
          <div class="mt-1.5 p-2 bg-slate-100 rounded text-[11px] font-mono text-slate-600 whitespace-pre-wrap border border-slate-200">
            <p class="text-[10px] text-slate-400 mb-1 font-sans">
              以下内容将由系统自动添加到提示词末尾，无需手动编写：
            </p>
            {previewText()}
          </div>
        </Show>
      </div>
    </div>
  );
}
