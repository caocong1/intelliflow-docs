import type { FormFieldDef, InputTransformConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";

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
    scheduleDraftSave();
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

  async function uploadFile(file: File) {
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
    // Validate required fields
    const data = formData();
    for (const field of props.config?.formFields ?? []) {
      if (field.required && !data[field.id]?.trim()) {
        setConfirmError(`"${field.label}" 为必填项`);
        return;
      }
    }

    setConfirmError(null);

    const fileOutputs = files()
      .filter((f) => !f.uploading && !f.error)
      .map((f) => ({
        fileId: f.fileId,
        name: f.originalName,
        parsedText: f.parsedText,
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

    if (field.type === "textarea" || isWide) {
      if (field.type === "textarea") {
        return (
          <div class="col-span-2 space-y-1.5">
            <label for={`field-${field.id}`} class="block text-sm font-medium text-[#191c1e]">
              {field.label}
              <Show when={field.required}>
                <span class="text-red-500 ml-0.5">*</span>
              </Show>
            </label>
            <textarea
              id={`field-${field.id}`}
              value={formData()[field.id] ?? ""}
              onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
              disabled={props.readOnly}
              rows={4}
              class={`${inputClass} resize-y`}
              placeholder={`请输入${field.label}`}
            />
          </div>
        );
      }
    }

    return (
      <div class="space-y-1.5">
        <label for={`field-${field.id}`} class="block text-sm font-medium text-[#191c1e]">
          {field.label}
          <Show when={field.required}>
            <span class="text-red-500 ml-0.5">*</span>
          </Show>
        </label>
        <input
          id={`field-${field.id}`}
          type="text"
          value={formData()[field.id] ?? ""}
          onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
          disabled={props.readOnly}
          class={inputClass}
          placeholder={`请输入${field.label}`}
        />
      </div>
    );
  }

  const hasFileFields = () =>
    (props.config?.formFields ?? []).some((f) => f.type === "file");

  const textFields = () => (props.config?.formFields ?? []).filter((f) => f.type !== "file");

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
                {(field) => renderField(field, field.type === "textarea")}
              </For>
            </div>
          </div>
        </Show>

        {/* File upload area */}
        <Show when={hasFileFields() && !props.readOnly}>
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
              <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
              文件上传
            </h3>

            {/* Drop zone */}
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
