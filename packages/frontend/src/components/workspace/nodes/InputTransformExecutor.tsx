import type { FormFieldDef, InputTransformConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createEffect, createSignal } from "solid-js";

interface UploadedFile {
  fileId: string;
  originalName: string;
  parsedText: string;
  mimeType: string;
  fileSize: number;
  uploading: boolean;
  progress: number;
  error: string | null;
  showParsed: boolean;
  /** Which file slot this file belongs to (undefined = unslotted / "other files") */
  slotId?: string;
}

interface Props {
  nodeExecution: NodeExecution;
  config: InputTransformConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  readOnly: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtColor(ext: string): string {
  const map: Record<string, string> = {
    pdf: "bg-red-100 text-red-700",
    docx: "bg-blue-100 text-blue-700",
    doc: "bg-blue-100 text-blue-700",
    txt: "bg-gray-100 text-gray-600",
    png: "bg-purple-100 text-purple-700",
    jpg: "bg-purple-100 text-purple-700",
    jpeg: "bg-purple-100 text-purple-700",
    mp3: "bg-amber-100 text-amber-700",
    mp4: "bg-amber-100 text-amber-700",
  };
  return map[ext.toLowerCase()] ?? "bg-indigo-100 text-indigo-700";
}

export default function InputTransformExecutor(props: Props) {
  // Initialize form data from existing outputData (resume case) or empty
  const existingOutput = props.nodeExecution.outputData as {
    fields?: Record<string, string>;
    files?: Array<{ fileId: string; name: string; parsedText: string }>;
  } | null;

  const initialFields: Record<string, string> = {};
  for (const field of props.config?.formFields ?? []) {
    initialFields[field.id] = existingOutput?.fields?.[field.id] ?? "";
  }

  const [formData, setFormData] = createSignal<Record<string, string>>(initialFields);
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string>>({});
  const [files, setFiles] = createSignal<UploadedFile[]>(
    (existingOutput?.files ?? []).map((f) => ({
      fileId: f.fileId,
      originalName: f.name,
      parsedText: f.parsedText,
      mimeType: "",
      fileSize: 0,
      uploading: false,
      progress: 100,
      error: null,
      showParsed: false,
    })),
  );
  const [dragOver, setDragOver] = createSignal(false);
  const [confirmError, setConfirmError] = createSignal<string | null>(null);

  // Initialize default values for fields that have defaultValue/defaultValues
  createEffect(() => {
    const fields = props.config?.formFields ?? [];
    const current = formData();
    const updates: Record<string, string> = {};
    for (const field of fields) {
      // Only set defaults if no existing value
      if (current[field.id]) continue;

      if (field.type === "date" && field.defaultValue === "today") {
        updates[field.id] = new Date().toISOString().slice(0, 10);
      } else if (field.type === "datetime" && field.defaultValue === "today") {
        updates[field.id] = new Date().toISOString().slice(0, 16);
      } else if (field.type === "select" && field.defaultValue) {
        updates[field.id] = field.defaultValue;
      } else if (field.type === "multiselect" && field.defaultValues && field.defaultValues.length > 0) {
        updates[field.id] = field.defaultValues.join(",");
      }
    }
    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({ ...prev, ...updates }));
    }
  });

  // Debounced draft save
  let draftTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleDraftSave() {
    if (props.readOnly) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      props.onDraftSave({
        fields: formData(),
        files: files()
          .filter((f) => !f.uploading && !f.error)
          .map((f) => ({
            fileId: f.fileId,
            name: f.originalName,
            parsedText: f.parsedText,
          })),
      });
    }, 1000);
  }

  function handleFieldChange(fieldId: string, value: string) {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error on change
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
    scheduleDraftSave();
  }

  function validateField(field: FormFieldDef, value: string): string | null {
    if (field.required && !value?.trim()) {
      return "此字段为必填项";
    }
    if (!value) return null;

    switch (field.type) {
      case "number":
        if (Number.isNaN(Number(value))) return "请输入有效的数字";
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "请输入有效的日期";
        break;
      case "datetime":
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return "请输入有效的日期时间";
        break;
      case "select":
        if (field.options && !field.options.includes(value)) return "请选择有效的选项";
        break;
      case "multiselect": {
        if (field.options) {
          const vals = value.split(",").filter(Boolean);
          for (const v of vals) {
            if (!field.options.includes(v)) return `"${v}" 不是有效的选项`;
          }
        }
        break;
      }
    }
    return null;
  }

  function handleBlur(field: FormFieldDef) {
    const value = formData()[field.id] ?? "";
    const error = validateField(field, value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field.id] = error;
      } else {
        delete next[field.id];
      }
      return next;
    });
  }

  function validateAllFields(): boolean {
    const errors: Record<string, string> = {};
    for (const field of props.config?.formFields ?? []) {
      if (field.type === "file") continue;
      const value = formData()[field.id] ?? "";
      const error = validateField(field, value);
      if (error) errors[field.id] = error;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleParsedTextEdit(fileId: string, newText: string) {
    setFiles((prev) => prev.map((f) => (f.fileId === fileId ? { ...f, parsedText: newText } : f)));
    scheduleDraftSave();
  }

  function toggleParsedView(fileId: string) {
    setFiles((prev) =>
      prev.map((f) => (f.fileId === fileId ? { ...f, showParsed: !f.showParsed } : f)),
    );
  }

  async function uploadFile(file: File, slotId?: string) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const placeholder: UploadedFile = {
      fileId: tempId,
      originalName: file.name,
      parsedText: "",
      mimeType: file.type,
      fileSize: file.size,
      uploading: true,
      progress: 0,
      error: null,
      showParsed: false,
      slotId,
    };

    setFiles((prev) => [...prev, placeholder]);

    try {
      // Use XMLHttpRequest for progress tracking
      const result = await new Promise<UploadedFile>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `/api/runtime/${props.documentId}/input-transform/${props.nodeExecution.id}/upload`,
        );

        const token = localStorage.getItem("auth_token");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setFiles((prev) =>
              prev.map((f) => (f.fileId === tempId ? { ...f, progress: pct } : f)),
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            resolve({
              fileId: data.fileId,
              originalName: data.originalName,
              parsedText: data.parsedText,
              mimeType: data.mimeType,
              fileSize: data.fileSize,
              uploading: false,
              progress: 100,
              error: null,
              showParsed: false,
              slotId,
            });
          } else {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error ?? "上传失败"));
          }
        };

        xhr.onerror = () => reject(new Error("网络错误"));

        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      });

      // Replace placeholder with real result
      setFiles((prev) => prev.map((f) => (f.fileId === tempId ? result : f)));
      scheduleDraftSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : "上传失败";
      setFiles((prev) =>
        prev.map((f) => (f.fileId === tempId ? { ...f, uploading: false, error: message } : f)),
      );
    }
  }

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles) return;
    for (let i = 0; i < droppedFiles.length; i++) {
      uploadFile(droppedFiles[i]);
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const selectedFiles = input.files;
    if (!selectedFiles) return;
    for (let i = 0; i < selectedFiles.length; i++) {
      uploadFile(selectedFiles[i]);
    }
    input.value = "";
  }

  function removeFile(fileId: string) {
    setFiles((prev) => prev.filter((f) => f.fileId !== fileId));
    scheduleDraftSave();
  }

  async function handleConfirm() {
    // Validate all fields first
    if (!validateAllFields()) {
      setConfirmError("请修正表单中的错误后再提交");
      return;
    }

    setConfirmError(null);

    const data = formData();
    const fileOutputs = files()
      .filter((f) => !f.uploading && !f.error)
      .map((f) => ({
        fileId: f.fileId,
        name: f.originalName,
        parsedText: f.parsedText,
        ...(f.slotId ? { slotId: f.slotId } : {}),
      }));

    try {
      const res = await fetch(
        `/api/runtime/${props.documentId}/input-transform/${props.nodeExecution.id}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
          },
          body: JSON.stringify({ formData: data, fileOutputs }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        setConfirmError(err.error ?? "确认失败");
        return;
      }

      // Trigger page-level advance after confirm succeeds
      // The parent DocumentWorkspace handles advancing via its own handleAdvance
    } catch {
      setConfirmError("网络错误，请重试");
    }
  }

  /** Merge accepted file types from all file-type fields */
  const acceptedTypes = () => {
    const fileFields = (props.config?.formFields ?? []).filter((f) => f.type === "file");
    const allTypes = fileFields.flatMap((f) => f.acceptedFileTypes ?? []);
    // If no restrictions on any field, allow all common types
    if (allTypes.length === 0) return "";
    return [...new Set(allTypes)].join(",");
  };

  /** Max file count across all file fields (0 = unlimited) */
  const maxFileCount = () => {
    const fileFields = (props.config?.formFields ?? []).filter((f) => f.type === "file");
    if (fileFields.length === 0) return 0;
    // If any field is unlimited, total is unlimited
    if (fileFields.some((f) => (f.fileCountMode ?? "unlimited") === "unlimited")) return 0;
    // All fields are "single"
    return fileFields.length;
  };

  // Render form field based on type
  function renderField(field: FormFieldDef, isWide: boolean) {
    const inputClass =
      "w-full bg-white px-4 py-3 border border-[rgba(199,196,216,0.35)] rounded-xl text-sm text-[#191c1e] placeholder-[#9fa0a8] focus:outline-none focus:ring-2 focus:ring-[#c3c0ff] focus:border-[#4f46e5] disabled:bg-[#f7f9fb] disabled:text-[#9fa0a8] transition-all";
    const errorInputClass =
      "w-full bg-white px-4 py-3 border border-red-500 rounded-xl text-sm text-[#191c1e] placeholder-[#9fa0a8] focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-500 disabled:bg-[#f7f9fb] disabled:text-[#9fa0a8] transition-all";
    const hasError = () => !!fieldErrors()[field.id];
    const currentInputClass = () => (hasError() ? errorInputClass : inputClass);

    const labelEl = (
      <label for={`field-${field.id}`} class="block text-sm font-medium text-[#191c1e]">
        {field.label}
        <Show when={field.required}>
          <span class="text-red-500 ml-0.5">*</span>
        </Show>
      </label>
    );

    const errorEl = (
      <Show when={fieldErrors()[field.id]}>
        <p class="text-red-500 text-xs mt-1">{fieldErrors()[field.id]}</p>
      </Show>
    );

    // Textarea
    if (field.type === "textarea") {
      return (
        <div class="col-span-2 space-y-1.5">
          {labelEl}
          <textarea
            id={`field-${field.id}`}
            value={formData()[field.id] ?? ""}
            onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
            onBlur={() => handleBlur(field)}
            disabled={props.readOnly}
            rows={4}
            class={`${currentInputClass()} resize-y`}
            placeholder={`请输入${field.label}`}
          />
          {errorEl}
        </div>
      );
    }

    // Number
    if (field.type === "number") {
      return (
        <div class="space-y-1.5">
          {labelEl}
          <input
            id={`field-${field.id}`}
            type="number"
            value={formData()[field.id] ?? ""}
            onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
            onBlur={() => handleBlur(field)}
            disabled={props.readOnly}
            class={currentInputClass()}
            placeholder={`请输入${field.label}`}
          />
          {errorEl}
        </div>
      );
    }

    // Date
    if (field.type === "date") {
      return (
        <div class="space-y-1.5">
          {labelEl}
          <input
            id={`field-${field.id}`}
            type="date"
            value={formData()[field.id] ?? ""}
            onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
            onBlur={() => handleBlur(field)}
            disabled={props.readOnly}
            class={currentInputClass()}
          />
          {errorEl}
        </div>
      );
    }

    // Datetime
    if (field.type === "datetime") {
      return (
        <div class="space-y-1.5">
          {labelEl}
          <input
            id={`field-${field.id}`}
            type="datetime-local"
            value={formData()[field.id] ?? ""}
            onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
            onBlur={() => handleBlur(field)}
            disabled={props.readOnly}
            class={currentInputClass()}
          />
          {errorEl}
        </div>
      );
    }

    // Select
    if (field.type === "select") {
      return (
        <div class="space-y-1.5">
          {labelEl}
          <select
            id={`field-${field.id}`}
            value={formData()[field.id] ?? ""}
            onChange={(e) => handleFieldChange(field.id, e.currentTarget.value)}
            onBlur={() => handleBlur(field)}
            disabled={props.readOnly}
            class={currentInputClass()}
          >
            <option value="">请选择...</option>
            <For each={field.options ?? []}>
              {(opt) => <option value={opt}>{opt}</option>}
            </For>
          </select>
          {errorEl}
        </div>
      );
    }

    // Multiselect (checkbox group)
    if (field.type === "multiselect") {
      const selectedValues = () => (formData()[field.id] ?? "").split(",").filter(Boolean);

      function toggleMultiValue(optValue: string) {
        const current = selectedValues();
        const next = current.includes(optValue)
          ? current.filter((v) => v !== optValue)
          : [...current, optValue];
        handleFieldChange(field.id, next.join(","));
      }

      return (
        <div class={`space-y-1.5 ${isWide ? "col-span-2" : ""}`}>
          {labelEl}
          <div class={`flex flex-wrap gap-2 px-4 py-3 border rounded-xl bg-white transition-all ${hasError() ? "border-red-500" : "border-[rgba(199,196,216,0.35)]"}`}>
            <For each={field.options ?? []}>
              {(opt) => (
                <label class="flex items-center gap-1.5 text-sm text-[#191c1e] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedValues().includes(opt)}
                    onChange={() => toggleMultiValue(opt)}
                    onBlur={() => handleBlur(field)}
                    disabled={props.readOnly}
                    class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  {opt}
                </label>
              )}
            </For>
          </div>
          {errorEl}
        </div>
      );
    }

    // Default: text
    return (
      <div class="space-y-1.5">
        {labelEl}
        <input
          id={`field-${field.id}`}
          type="text"
          value={formData()[field.id] ?? ""}
          onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
          onBlur={() => handleBlur(field)}
          disabled={props.readOnly}
          class={currentInputClass()}
          placeholder={`请输入${field.label}`}
        />
        {errorEl}
      </div>
    );
  }

  const hasFileFields = () =>
    (props.config?.formFields ?? []).some((f) => f.type === "file");

  const textFields = () => (props.config?.formFields ?? []).filter((f) => f.type !== "file");

  /** File fields with fileSlotId configured — render as independent slot cards */
  const slotFileFields = () => (props.config?.formFields ?? []).filter((f) => f.type === "file" && f.fileSlotId);

  /** File fields without fileSlotId — render in "other files" area */
  const nonSlotFileFields = () => (props.config?.formFields ?? []).filter((f) => f.type === "file" && !f.fileSlotId);

  /** Whether we have any file slots configured */
  const hasFileSlots = () => slotFileFields().length > 0;

  /** Get files for a specific slot */
  function filesForSlot(slotId: string) {
    return files().filter((f) => f.slotId === slotId);
  }

  /** Get files not assigned to any slot */
  function unslottedFiles() {
    return files().filter((f) => !f.slotId);
  }

  /** Handle file drop for a specific slot */
  function handleSlotFileDrop(e: DragEvent, slotId: string) {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles) return;
    for (let i = 0; i < droppedFiles.length; i++) {
      uploadFile(droppedFiles[i], slotId);
    }
  }

  /** Handle file select for a specific slot */
  function handleSlotFileSelect(e: Event, slotId: string) {
    const input = e.target as HTMLInputElement;
    const selectedFiles = input.files;
    if (!selectedFiles) return;
    for (let i = 0; i < selectedFiles.length; i++) {
      uploadFile(selectedFiles[i], slotId);
    }
    input.value = "";
  }

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="px-6 py-5 bg-gradient-to-r from-[#f2f4f6] to-white border-b border-[rgba(199,196,216,0.15)]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] flex items-center justify-center flex-shrink-0">
            {/* Document / upload icon */}
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-[#191c1e]">
              {props.nodeExecution.nodeLabel || "输入转换"}
            </h2>
            <p class="text-xs text-[#464555] mt-0.5">
              填写表单信息并上传所需文件，AI 将自动分析文档结构并准备后续处理
            </p>
          </div>
        </div>
      </div>

      <div class="p-6 space-y-6">
        {/* Null guard: no form fields configured */}
        <Show when={!props.config?.formFields || props.config.formFields.length === 0}>
          <div class="text-center py-10 text-[#9fa0a8]">
            <div class="w-12 h-12 rounded-full bg-[#f7f9fb] flex items-center justify-center mx-auto mb-3">
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p class="text-sm">未配置表单字段</p>
            <p class="text-xs mt-1 text-[#c4c4cc]">请在工作流编辑器中添加表单字段配置</p>
          </div>
        </Show>

        {/* Form fields section */}
        <Show when={textFields().length > 0}>
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
              <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
              表单填写
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <For each={textFields()}>
                {(field) => renderField(field, field.type === "textarea" || field.type === "multiselect")}
              </For>
            </div>
          </div>
        </Show>

        {/* File upload area — mixed layout: slot cards first, then "other files" */}
        <Show when={hasFileFields() && !props.readOnly}>
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
              <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
              文件上传
            </h3>

            {/* File slot cards */}
            <Show when={hasFileSlots()}>
              <For each={slotFileFields()}>
                {(slotField) => {
                  const slotId = slotField.fileSlotId ?? slotField.id;
                  const slotFiles = () => filesForSlot(slotId);
                  const slotInputId = () => `file-slot-${slotId}`;
                  return (
                    <div class="rounded-xl border border-slate-200 bg-[#fafafe] overflow-hidden">
                      {/* Slot card header */}
                      <div class="px-4 py-3 bg-gradient-to-r from-[#f0efff] to-white border-b border-slate-100 flex items-center gap-2">
                        <span class="w-6 h-6 rounded-md bg-[#4f46e5] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {"\uD83D\uDCC1"}
                        </span>
                        <span class="text-sm font-medium text-[#191c1e]">
                          {slotField.fileSlotLabel || slotField.label}
                        </span>
                        <Show when={slotFiles().length > 0}>
                          <span class="text-xs text-[#9fa0a8]">({slotFiles().length})</span>
                        </Show>
                      </div>
                      {/* Slot drop zone */}
                      <div class="p-3">
                        <button
                          type="button"
                          class="w-full border-2 border-dashed rounded-lg py-6 text-center transition-all cursor-pointer border-[rgba(199,196,216,0.5)] hover:border-[#4f46e5] hover:bg-[#f0efff]"
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => handleSlotFileDrop(e, slotId)}
                          onClick={() => {
                            const input = document.getElementById(slotInputId()) as HTMLInputElement;
                            input?.click();
                          }}
                        >
                          <p class="text-xs text-[#9fa0a8]">拖拽或点击上传文件到此槽位</p>
                          <input
                            id={slotInputId()}
                            type="file"
                            multiple={(slotField.fileCountMode ?? "unlimited") !== "single"}
                            accept={slotField.acceptedFileTypes?.join(",") || undefined}
                            class="hidden"
                            onChange={(e) => handleSlotFileSelect(e, slotId)}
                          />
                        </button>
                        {/* Slot uploaded files */}
                        <Show when={slotFiles().length > 0}>
                          <div class="mt-2 space-y-1.5">
                            <For each={slotFiles()}>
                              {(file) => {
                                const ext = file.originalName.split(".").pop()?.toLowerCase() ?? "";
                                return (
                                  <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-100">
                                    <div class="flex items-center gap-2 min-w-0">
                                      <span class={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold ${getFileExtColor(ext)}`}>
                                        {ext.toUpperCase().slice(0, 4) || "?"}
                                      </span>
                                      <span class="text-xs text-[#191c1e] truncate">{file.originalName}</span>
                                    </div>
                                    <div class="flex items-center gap-2 flex-shrink-0">
                                      <Show when={file.uploading}>
                                        <span class="text-xs text-blue-600">{file.progress}%</span>
                                      </Show>
                                      <Show when={!file.uploading && !file.error}>
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      </Show>
                                      <button type="button" class="text-xs text-[#9fa0a8] hover:text-red-500" onClick={() => removeFile(file.fileId)}>
                                        移除
                                      </button>
                                    </div>
                                  </div>
                                );
                              }}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>

            {/* "Other files" area — non-slot file fields or all file fields when no slots configured */}
            <Show when={!hasFileSlots() || nonSlotFileFields().length > 0}>
              <div>
                <Show when={hasFileSlots()}>
                  <p class="text-xs font-medium text-slate-500 mb-2">其他文件</p>
                </Show>
                <button
                  type="button"
                  class={`w-full border-2 border-dashed rounded-xl py-10 text-center transition-all cursor-pointer ${
                    dragOver()
                      ? "border-[#4f46e5] bg-[#f0efff] scale-[1.01]"
                      : "border-[rgba(199,196,216,0.6)] hover:border-[#4f46e5] hover:bg-[#fafafe]"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => {
                    const input = document.getElementById("file-input-transform") as HTMLInputElement;
                    input?.click();
                  }}
                >
                  <div class="flex flex-col items-center gap-2">
                    <div class="w-10 h-10 rounded-full bg-[#f0efff] flex items-center justify-center">
                      <svg
                        aria-hidden="true"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#4f46e5"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="16 16 12 12 8 16" />
                        <line x1="12" y1="12" x2="12" y2="21" />
                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                      </svg>
                    </div>
                    <p class="text-sm font-medium text-[#464555]">拖拽文件到此处，或点击选择文件</p>
                    <p class="text-xs text-[#9fa0a8]">支持格式：{acceptedTypes()}</p>
                  </div>
                  <input
                    id="file-input-transform"
                    type="file"
                    multiple={maxFileCount() !== 1}
                    accept={acceptedTypes() || undefined}
                    class="hidden"
                    onChange={handleFileSelect}
                  />
                </button>
              </div>
            </Show>
          </div>
        </Show>

        {/* Uploaded files list */}
        <Show when={files().length > 0}>
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
              <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
              已上传文件
              <span class="text-xs text-[#9fa0a8] font-normal">({files().length})</span>
            </h3>
            <div class="space-y-2">
              <For each={files()}>
                {(file) => {
                  const ext = file.originalName.split(".").pop()?.toLowerCase() ?? "";
                  const extLabel = ext.toUpperCase().slice(0, 4) || "?";
                  const extColor = getFileExtColor(ext);
                  return (
                    <div class="rounded-xl bg-[#f7f9fb] px-4 py-3 space-y-2">
                      {/* File header */}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3 min-w-0">
                          <div
                            class={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${extColor}`}
                          >
                            {extLabel}
                          </div>
                          <div class="min-w-0">
                            <p class="text-sm font-medium text-[#191c1e] truncate">
                              {file.originalName}
                            </p>
                            <Show when={file.fileSize > 0}>
                              <p class="text-xs text-[#9fa0a8]">{formatFileSize(file.fileSize)}</p>
                            </Show>
                          </div>
                        </div>

                        <div class="flex items-center gap-2 flex-shrink-0">
                          {/* Status badge */}
                          <Show when={file.uploading}>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                              上传中 {file.progress}%
                            </span>
                          </Show>
                          <Show when={!file.uploading && !file.error}>
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">
                              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              解析完成
                            </span>
                          </Show>
                          <Show when={file.error}>
                            <span class="inline-flex px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                              上传失败
                            </span>
                          </Show>

                          {/* View parsed button */}
                          <Show when={!file.uploading && !file.error}>
                            <button
                              type="button"
                              class="text-xs text-[#4f46e5] hover:text-[#3525cd] font-medium transition-colors"
                              onClick={() => toggleParsedView(file.fileId)}
                            >
                              {file.showParsed ? "收起" : "查看解析结果"}
                            </button>
                          </Show>

                          {/* Remove button */}
                          <Show when={!props.readOnly}>
                            <button
                              type="button"
                              class="text-xs text-[#9fa0a8] hover:text-red-500 transition-colors"
                              onClick={() => removeFile(file.fileId)}
                            >
                              移除
                            </button>
                          </Show>
                        </div>
                      </div>

                      {/* Upload progress bar */}
                      <Show when={file.uploading}>
                        <div class="w-full bg-[#e6e8ea] rounded-full h-1.5">
                          <div
                            class="bg-gradient-to-r from-[#3525cd] to-[#4f46e5] h-1.5 rounded-full transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </Show>

                      {/* Error message */}
                      <Show when={file.error}>
                        <p class="text-xs text-red-500">{file.error}</p>
                      </Show>

                      {/* Parsed text preview / edit */}
                      <Show when={file.showParsed && !file.uploading}>
                        <div class="mt-2">
                          <p class="block text-xs font-medium text-[#464555] mb-1.5">
                            解析内容（可编辑）
                          </p>
                          <textarea
                            value={file.parsedText}
                            onInput={(e) =>
                              handleParsedTextEdit(file.fileId, e.currentTarget.value)
                            }
                            disabled={props.readOnly}
                            rows={6}
                            aria-label={`${file.originalName} 解析内容`}
                            class="w-full px-4 py-3 border border-[rgba(199,196,216,0.35)] rounded-xl text-sm font-mono bg-white text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#c3c0ff] focus:border-[#4f46e5] disabled:bg-[#f7f9fb] disabled:text-[#9fa0a8] resize-y transition-all"
                          />
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Confirm error */}
        <Show when={confirmError()}>
          <div class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
            {confirmError()}
          </div>
        </Show>
      </div>
    </div>
  );
}
