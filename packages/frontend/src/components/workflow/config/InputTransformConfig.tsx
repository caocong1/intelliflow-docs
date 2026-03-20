import { For, Show, createSignal } from "solid-js";
import type { InputTransformConfig, FormFieldDef } from "@intelliflow/shared";

const FILE_TYPE_OPTIONS = [
  { value: ".pdf", label: "PDF" },
  { value: ".doc,.docx", label: "Word" },
  { value: ".xls,.xlsx", label: "Excel" },
  { value: ".txt", label: "文本" },
  { value: ".md", label: "Markdown" },
  { value: ".png,.jpg,.jpeg", label: "图片" },
];

const FIELD_TYPE_OPTIONS: { value: FormFieldDef["type"]; label: string }[] = [
  { value: "text", label: "单行文本" },
  { value: "textarea", label: "多行文本" },
  { value: "file", label: "文件上传" },
];

interface InputTransformConfigProps {
  config: InputTransformConfig;
  onChange: (config: InputTransformConfig) => void;
}

export default function InputTransformConfigPanel(props: InputTransformConfigProps) {
  function addField() {
    const newField: FormFieldDef = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
    };
    props.onChange({ ...props.config, formFields: [...props.config.formFields, newField] });
  }

  function updateField(id: string, patch: Partial<FormFieldDef>) {
    props.onChange({
      ...props.config,
      formFields: props.config.formFields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }

  function removeField(id: string) {
    props.onChange({
      ...props.config,
      formFields: props.config.formFields.filter((f) => f.id !== id),
    });
  }

  function moveField(index: number, direction: -1 | 1) {
    const fields = [...props.config.formFields];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
    props.onChange({ ...props.config, formFields: fields });
  }

  function toggleFileType(fileType: string) {
    const current = props.config.acceptedFileTypes ?? [];
    const next = current.includes(fileType)
      ? current.filter((t) => t !== fileType)
      : [...current, fileType];
    props.onChange({ ...props.config, acceptedFileTypes: next });
  }

  return (
    <div class="space-y-4">
      {/* Form Fields */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wide">表单字段</h4>
          <button
            type="button"
            onClick={addField}
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>添加</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            添加字段
          </button>
        </div>

        <div class="space-y-2">
          <For
            each={props.config.formFields}
            fallback={
              <p class="text-xs text-slate-400 italic text-center py-3">
                暂无字段 — 点击"添加字段"开始
              </p>
            }
          >
            {(field, index) => (
              <div class="p-2.5 bg-slate-50 rounded-md border border-slate-200 space-y-2">
                <div class="flex items-center gap-1.5">
                  {/* Move buttons */}
                  <div class="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveField(index(), -1)}
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
                      onClick={() => moveField(index(), 1)}
                      disabled={index() === props.config.formFields.length - 1}
                      class="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                      title="下移"
                    >
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <title>下移</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Label (primary identifier, name auto-derived) */}
                  <input
                    type="text"
                    value={field.label}
                    onInput={(e) => updateField(field.id, { label: e.currentTarget.value })}
                    placeholder="显示标签"
                    class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    class="p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                    title="删除字段"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <title>删除</title>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div class="flex items-center gap-2 pl-7">
                  <select
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.currentTarget.value as FormFieldDef["type"] })}
                    class="text-xs px-1.5 py-1 border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                  >
                    <For each={FIELD_TYPE_OPTIONS}>
                      {(opt) => <option value={opt.value}>{opt.label}</option>}
                    </For>
                  </select>

                  <label class="flex items-center gap-1 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.id, { required: e.currentTarget.checked })}
                      class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    必填
                  </label>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* File Upload Toggle */}
      <div class="border-t border-slate-100 pt-3">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={props.config.allowFileUpload}
            onChange={(e) =>
              props.onChange({ ...props.config, allowFileUpload: e.currentTarget.checked })
            }
            class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <span class="text-sm font-medium text-slate-700">允许文件上传</span>
        </label>

        <Show when={props.config.allowFileUpload}>
          <div class="mt-2 pl-6">
            <p class="text-xs text-slate-500 mb-1.5">允许的文件类型：</p>
            <div class="flex flex-wrap gap-1.5">
              <For each={FILE_TYPE_OPTIONS}>
                {(opt) => {
                  const selected = () => (props.config.acceptedFileTypes ?? []).includes(opt.value);
                  return (
                    <button
                      type="button"
                      onClick={() => toggleFileType(opt.value)}
                      class={`px-2 py-0.5 text-xs rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        selected()
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
