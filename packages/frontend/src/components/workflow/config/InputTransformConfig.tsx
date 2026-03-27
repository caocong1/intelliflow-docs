import type { FormFieldDef, InputTransformConfig } from "@intelliflow/shared";
import { For, Index, Show, createSignal } from "solid-js";

const FIELD_TYPE_OPTIONS: { value: FormFieldDef["type"]; label: string; icon: string; color: string }[] = [
  { value: "text", label: "单行文本", icon: "T", color: "bg-slate-100 text-slate-600" },
  { value: "textarea", label: "多行文本", icon: "\u00B6", color: "bg-blue-100 text-blue-600" },
  { value: "file", label: "文件上传", icon: "\uD83D\uDCCE", color: "bg-purple-100 text-purple-600" },
  { value: "number", label: "数字", icon: "#", color: "bg-green-100 text-green-600" },
  { value: "date", label: "日期", icon: "\uD83D\uDCC5", color: "bg-amber-100 text-amber-600" },
  { value: "datetime", label: "日期时间", icon: "\uD83D\uDD50", color: "bg-orange-100 text-orange-600" },
  { value: "select", label: "单选", icon: "\u2630", color: "bg-cyan-100 text-cyan-600" },
  { value: "multiselect", label: "多选", icon: "\u2611", color: "bg-teal-100 text-teal-600" },
];

const FILE_TYPE_OPTIONS = [
  { value: ".pdf", label: "PDF" },
  { value: ".doc,.docx", label: "Word" },
  { value: ".xls,.xlsx", label: "Excel" },
  { value: ".txt", label: "文本" },
  { value: ".md", label: "Markdown" },
  { value: ".png,.jpg,.jpeg", label: "图片" },
];

const MACHINE_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface InputTransformConfigProps {
  config: InputTransformConfig;
  onChange: (config: InputTransformConfig) => void;
}

export default function InputTransformConfigPanel(props: InputTransformConfigProps) {
  const [showTypePicker, setShowTypePicker] = createSignal(false);
  // Track which field cards have advanced settings expanded
  const [expandedAdvanced, setExpandedAdvanced] = createSignal<Record<string, boolean>>({});

  function toggleAdvanced(fieldId: string) {
    setExpandedAdvanced((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  }

  function addField(type: FormFieldDef["type"]) {
    const newField: FormFieldDef = {
      id: crypto.randomUUID(),
      label: "",
      type,
      required: false,
      ...(type === "file" ? { fileCountMode: "unlimited" as const, acceptedFileTypes: [] } : {}),
      ...(type === "select" ? { options: [], defaultValue: "" } : {}),
      ...(type === "multiselect" ? { options: [], defaultValues: [] } : {}),
      ...(type === "date" || type === "datetime" ? { defaultValue: "" } : {}),
    };
    props.onChange({ ...props.config, formFields: [...props.config.formFields, newField] });
    setShowTypePicker(false);
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

  function toggleFileType(fieldId: string, fileType: string) {
    const field = props.config.formFields.find((f) => f.id === fieldId);
    if (!field) return;
    const current = field.acceptedFileTypes ?? [];
    const next = current.includes(fileType)
      ? current.filter((t) => t !== fileType)
      : [...current, fileType];
    updateField(fieldId, { acceptedFileTypes: next });
  }

  function getTypeOption(type: FormFieldDef["type"]) {
    return FIELD_TYPE_OPTIONS.find((o) => o.value === type) ?? FIELD_TYPE_OPTIONS[0];
  }

  // --- Select/Multiselect options helpers ---
  function addOption(fieldId: string) {
    const field = props.config.formFields.find((f) => f.id === fieldId);
    if (!field) return;
    const opts = [...(field.options ?? []), ""];
    updateField(fieldId, { options: opts });
  }

  function updateOption(fieldId: string, optIndex: number, value: string) {
    const field = props.config.formFields.find((f) => f.id === fieldId);
    if (!field) return;
    const opts = [...(field.options ?? [])];
    opts[optIndex] = value;
    updateField(fieldId, { options: opts });
  }

  function removeOption(fieldId: string, optIndex: number) {
    const field = props.config.formFields.find((f) => f.id === fieldId);
    if (!field) return;
    const opts = [...(field.options ?? [])];
    const removed = opts.splice(optIndex, 1)[0];
    // Clear default if removed option was the default
    const patch: Partial<FormFieldDef> = { options: opts };
    if (field.type === "select" && field.defaultValue === removed) {
      patch.defaultValue = "";
    }
    if (field.type === "multiselect" && field.defaultValues?.includes(removed)) {
      patch.defaultValues = (field.defaultValues ?? []).filter((v) => v !== removed);
    }
    updateField(fieldId, patch);
  }

  function moveOption(fieldId: string, optIndex: number, direction: -1 | 1) {
    const field = props.config.formFields.find((f) => f.id === fieldId);
    if (!field) return;
    const opts = [...(field.options ?? [])];
    const newIdx = optIndex + direction;
    if (newIdx < 0 || newIdx >= opts.length) return;
    [opts[optIndex], opts[newIdx]] = [opts[newIdx], opts[optIndex]];
    updateField(fieldId, { options: opts });
  }

  function toggleMultiselectDefault(fieldId: string, optValue: string) {
    const field = props.config.formFields.find((f) => f.id === fieldId);
    if (!field) return;
    const defaults = field.defaultValues ?? [];
    const next = defaults.includes(optValue)
      ? defaults.filter((v) => v !== optValue)
      : [...defaults, optValue];
    updateField(fieldId, { defaultValues: next });
  }

  function validateMachineKey(value: string): string | null {
    if (!value) return null;
    if (!MACHINE_KEY_REGEX.test(value)) {
      return "只允许英文字母、数字和下划线，且不能以数字开头";
    }
    return null;
  }

  return (
    <div class="space-y-4">
      {/* Form Fields */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide">用户输入项</h4>
          <div class="relative">
            <button
              type="button"
              onClick={() => setShowTypePicker(!showTypePicker())}
              class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <title>添加</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              添加输入项
            </button>

            {/* Type picker dropdown */}
            <Show when={showTypePicker()}>
              <div class="absolute right-0 top-full mt-1 z-10 bg-white rounded-lg shadow-lg border border-slate-200 py-1 w-36">
                <For each={FIELD_TYPE_OPTIONS}>
                  {(opt) => (
                    <button
                      type="button"
                      onClick={() => addField(opt.value)}
                      class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                      <span class={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${opt.color}`}>
                        {opt.icon}
                      </span>
                      {opt.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        <div class="space-y-2">
          <Index
            each={props.config.formFields}
            fallback={
              <p class="text-xs text-slate-400 italic text-center py-3">
                暂无输入项 -- 点击"添加输入项"选择类型开始
              </p>
            }
          >
            {(field, index) => {
              const typeOpt = () => getTypeOption(field().type);
              const machineKeyError = () => validateMachineKey(field().machineKey ?? "");
              return (
                <div class="bg-slate-50 rounded-lg border border-slate-200 p-3">
                  {/* Top row: move buttons + label input + type badge + delete */}
                  <div class="flex items-center gap-2">
                    {/* Move buttons */}
                    <div class="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
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
                        onClick={() => moveField(index, 1)}
                        disabled={index === props.config.formFields.length - 1}
                        class="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                        title="下移"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <title>下移</title>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Label input */}
                    <input
                      type="text"
                      value={field().label}
                      onInput={(e) => {
                        const label = e.currentTarget.value;
                        const patch: Partial<FormFieldDef> = { label };
                        // Auto-suggest machineKey when label changes and machineKey is empty
                        if (!field().machineKey) {
                          patch.machineKey = `field_${index + 1}`;
                        }
                        updateField(field().id, patch);
                      }}
                      placeholder="显示标签"
                      class="flex-1 min-w-0 text-xs px-2 py-1.5 border border-gray-300 rounded-md bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />

                    {/* Type badge (read-only) */}
                    <span class={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${typeOpt().color}`}>
                      <span class="text-[10px]">{typeOpt().icon}</span>
                      {typeOpt().label}
                    </span>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeField(field().id)}
                      class="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                      title="删除输入项"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <title>删除</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Second row: required checkbox */}
                  <div class="mt-2 pl-7">
                    <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={field().required}
                        onChange={(e) => updateField(field().id, { required: e.currentTarget.checked })}
                        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      必填
                    </label>
                  </div>

                  {/* File-specific config */}
                  <Show when={field().type === "file"}>
                    <div class="mt-3 ml-7 space-y-3 p-3 bg-white rounded-md border border-slate-200">
                      {/* File count mode */}
                      <div>
                        <p class="text-xs font-medium text-slate-600 mb-1.5">文件数量</p>
                        <div class="flex gap-2">
                          <For each={[
                            { value: "single" as const, label: "单文件" },
                            { value: "unlimited" as const, label: "不限制" },
                          ]}>
                            {(opt) => (
                              <button
                                type="button"
                                onClick={() => updateField(field().id, { fileCountMode: opt.value })}
                                class={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                  (field().fileCountMode ?? "unlimited") === opt.value
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                                }`}
                              >
                                {opt.label}
                              </button>
                            )}
                          </For>
                        </div>
                      </div>

                      {/* File type restriction */}
                      <div>
                        <p class="text-xs font-medium text-slate-600 mb-1.5">文件类型</p>
                        <div class="flex gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => updateField(field().id, { acceptedFileTypes: [] })}
                            class={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              (field().acceptedFileTypes ?? []).length === 0
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                            }`}
                          >
                            不限制
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if ((field().acceptedFileTypes ?? []).length === 0) {
                                updateField(field().id, { acceptedFileTypes: [".pdf"] });
                              }
                            }}
                            class={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              (field().acceptedFileTypes ?? []).length > 0
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                            }`}
                          >
                            指定类型
                          </button>
                        </div>
                        <Show when={(field().acceptedFileTypes ?? []).length > 0}>
                          <div class="flex flex-wrap gap-1.5">
                            <For each={FILE_TYPE_OPTIONS}>
                              {(opt) => {
                                const selected = () => (field().acceptedFileTypes ?? []).includes(opt.value);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => toggleFileType(field().id, opt.value)}
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
                        </Show>
                      </div>
                    </div>
                  </Show>

                  {/* Select/Multiselect options management */}
                  <Show when={field().type === "select" || field().type === "multiselect"}>
                    <div class="mt-3 ml-7 space-y-3 p-3 bg-white rounded-md border border-slate-200">
                      <p class="text-xs font-medium text-slate-600 mb-1.5">选项列表</p>
                      <div class="space-y-1.5">
                        <For each={field().options ?? []}>
                          {(opt, optIdx) => {
                            const hasComma = () => opt.includes(",");
                            return (
                              <div class="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={opt}
                                  onInput={(e) => updateOption(field().id, optIdx(), e.currentTarget.value)}
                                  placeholder={`选项 ${optIdx() + 1}`}
                                  class={`flex-1 min-w-0 text-xs px-2 py-1 border rounded-md bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 ${hasComma() ? "border-red-500" : "border-gray-300"}`}
                                />
                                {/* Move up */}
                                <button
                                  type="button"
                                  onClick={() => moveOption(field().id, optIdx(), -1)}
                                  disabled={optIdx() === 0}
                                  class="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                                  title="上移"
                                >
                                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <title>上移</title>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                {/* Move down */}
                                <button
                                  type="button"
                                  onClick={() => moveOption(field().id, optIdx(), 1)}
                                  disabled={optIdx() === (field().options ?? []).length - 1}
                                  class="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                                  title="下移"
                                >
                                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <title>下移</title>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {/* Delete option */}
                                <button
                                  type="button"
                                  onClick={() => removeOption(field().id, optIdx())}
                                  class="p-0.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer focus:outline-none"
                                  title="删除选项"
                                >
                                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <title>删除</title>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <Show when={hasComma()}>
                                  <span class="text-red-500 text-[10px] whitespace-nowrap">不允许逗号</span>
                                </Show>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                      <button
                        type="button"
                        onClick={() => addOption(field().id)}
                        class="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer focus:outline-none"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <title>添加</title>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        添加选项
                      </button>

                      {/* Default value config for select */}
                      <Show when={field().type === "select" && (field().options ?? []).length > 0}>
                        <div>
                          <p class="text-xs font-medium text-slate-600 mb-1">默认值</p>
                          <select
                            value={field().defaultValue ?? ""}
                            onChange={(e) => updateField(field().id, { defaultValue: e.currentTarget.value })}
                            class="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                          >
                            <option value="">无</option>
                            <For each={(field().options ?? []).filter((o) => o.trim() !== "")}>
                              {(opt) => <option value={opt}>{opt}</option>}
                            </For>
                          </select>
                        </div>
                      </Show>

                      {/* Default values config for multiselect */}
                      <Show when={field().type === "multiselect" && (field().options ?? []).length > 0}>
                        <div>
                          <p class="text-xs font-medium text-slate-600 mb-1">默认选中</p>
                          <div class="flex flex-wrap gap-2">
                            <For each={(field().options ?? []).filter((o) => o.trim() !== "")}>
                              {(opt) => (
                                <label class="flex items-center gap-1 text-xs text-slate-600 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={(field().defaultValues ?? []).includes(opt)}
                                    onChange={() => toggleMultiselectDefault(field().id, opt)}
                                    class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  {opt}
                                </label>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Show>

                  {/* Date/Datetime default value config */}
                  <Show when={field().type === "date" || field().type === "datetime"}>
                    <div class="mt-3 ml-7 space-y-2 p-3 bg-white rounded-md border border-slate-200">
                      <p class="text-xs font-medium text-slate-600 mb-1">默认值</p>
                      <select
                        value={field().defaultValue ?? ""}
                        onChange={(e) => updateField(field().id, { defaultValue: e.currentTarget.value })}
                        class="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      >
                        <option value="">无</option>
                        <option value="today">今天</option>
                      </select>
                    </div>
                  </Show>

                  {/* Advanced Settings (machineKey) */}
                  <div class="mt-2 pl-7">
                    <button
                      type="button"
                      onClick={() => toggleAdvanced(field().id)}
                      class="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer focus:outline-none"
                    >
                      <svg
                        class={`w-3 h-3 transition-transform ${expandedAdvanced()[field().id] ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <title>展开</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                      高级设置
                    </button>
                    <Show when={expandedAdvanced()[field().id]}>
                      <div class="mt-2 space-y-1.5">
                        <label for={`machinekey-${field().id}`} class="block text-xs text-slate-600">
                          机器标识 (machineKey)
                        </label>
                        <input
                          id={`machinekey-${field().id}`}
                          type="text"
                          value={field().machineKey ?? ""}
                          onInput={(e) => updateField(field().id, { machineKey: e.currentTarget.value || undefined })}
                          placeholder={`如: field_${index + 1}`}
                          class={`w-full text-xs px-2 py-1.5 border rounded-md bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 ${machineKeyError() ? "border-red-500" : "border-gray-300"}`}
                        />
                        <Show when={machineKeyError()}>
                          <p class="text-red-500 text-[10px]">{machineKeyError()}</p>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </Index>
        </div>
      </div>
    </div>
  );
}
