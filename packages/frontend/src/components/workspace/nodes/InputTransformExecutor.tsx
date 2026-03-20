import { createSignal, For, Show } from "solid-js";
import type { InputTransformConfig, NodeExecution, FormFieldDef } from "@intelliflow/shared";

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

export default function InputTransformExecutor(props: Props) {
  // Initialize form data from existing outputData (resume case) or empty
  const existingOutput = props.nodeExecution.outputData as {
    fields?: Record<string, string>;
    files?: Array<{ fileId: string; name: string; parsedText: string }>;
  } | null;

  const initialFields: Record<string, string> = {};
  for (const field of props.config.formFields ?? []) {
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

  function handleFieldChange(fieldName: string, value: string) {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    scheduleDraftSave();
  }

  function handleParsedTextEdit(fileId: string, newText: string) {
    setFiles((prev) =>
      prev.map((f) => (f.fileId === fileId ? { ...f, parsedText: newText } : f)),
    );
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
            reject(new Error(err.error ?? "Upload failed"));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));

        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      });

      // Replace placeholder with real result
      setFiles((prev) => prev.map((f) => (f.fileId === tempId ? result : f)));
      scheduleDraftSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setFiles((prev) =>
        prev.map((f) =>
          f.fileId === tempId ? { ...f, uploading: false, error: message } : f,
        ),
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
    for (const field of props.config.formFields ?? []) {
      if (field.required && !data[field.id]?.trim()) {
        setConfirmError(`"${field.label}" is required`);
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
        setConfirmError(err.error ?? "Confirm failed");
        return;
      }

      // Trigger page-level advance after confirm succeeds
      // The parent DocumentWorkspace handles advancing via its own handleAdvance
    } catch {
      setConfirmError("Network error");
    }
  }

  const acceptedTypes = () =>
    (props.config.acceptedFileTypes ?? [".docx", ".pdf", ".txt", ".png", ".jpg", ".mp3", ".mp4"]).join(",");

  // Render form field based on type
  function renderField(field: FormFieldDef) {
    if (field.type === "text") {
      return (
        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700">
            {field.label}
            <Show when={field.required}>
              <span class="text-red-500 ml-0.5">*</span>
            </Show>
          </label>
          <input
            type="text"
            value={formData()[field.id] ?? ""}
            onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
            disabled={props.readOnly}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
            placeholder={field.label}
          />
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700">
            {field.label}
            <Show when={field.required}>
              <span class="text-red-500 ml-0.5">*</span>
            </Show>
          </label>
          <textarea
            value={formData()[field.id] ?? ""}
            onInput={(e) => handleFieldChange(field.id, e.currentTarget.value)}
            disabled={props.readOnly}
            rows={4}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 resize-y"
            placeholder={field.label}
          />
        </div>
      );
    }

    // field.type === "file" is handled by the upload area below
    return null;
  }

  const hasFileFields = () =>
    props.config.allowFileUpload || (props.config.formFields ?? []).some((f) => f.type === "file");

  return (
    <div class="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 class="text-lg font-semibold text-gray-800">{props.nodeExecution.nodeLabel}</h2>
        <p class="text-sm text-gray-500 mt-1">Fill in the form fields and upload any required files.</p>
      </div>

      {/* Form fields */}
      <Show when={(props.config.formFields ?? []).length > 0}>
        <div class="space-y-4">
          <For each={props.config.formFields?.filter((f) => f.type !== "file") ?? []}>
            {(field) => renderField(field)}
          </For>
        </div>
      </Show>

      {/* File upload area */}
      <Show when={hasFileFields() && !props.readOnly}>
        <div class="space-y-3">
          <label class="block text-sm font-medium text-gray-700">File Upload</label>

          {/* Drop zone */}
          <div
            class={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              dragOver()
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-300 hover:border-gray-400"
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
            <div class="text-gray-400 text-sm">
              <p class="font-medium">Drag & drop files here, or click to select</p>
              <p class="mt-1 text-xs text-gray-400">
                Supported: {acceptedTypes()}
              </p>
            </div>
            <input
              id="file-input-transform"
              type="file"
              multiple
              accept={acceptedTypes()}
              class="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
      </Show>

      {/* Uploaded files list */}
      <Show when={files().length > 0}>
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-gray-700">
            Uploaded Files ({files().length})
          </h3>
          <For each={files()}>
            {(file) => (
              <div class="border border-gray-200 rounded-lg p-4 space-y-2">
                {/* File header */}
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">
                      {file.originalName.split(".").pop()?.toUpperCase()?.slice(0, 3) ?? "?"}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-gray-800 truncate">{file.originalName}</p>
                      <Show when={file.fileSize > 0}>
                        <p class="text-xs text-gray-400">{formatFileSize(file.fileSize)}</p>
                      </Show>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 flex-shrink-0">
                    {/* Status badge */}
                    <Show when={file.uploading}>
                      <span class="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">
                        Uploading {file.progress}%
                      </span>
                    </Show>
                    <Show when={!file.uploading && !file.error}>
                      <span class="inline-flex px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs">
                        Done
                      </span>
                    </Show>
                    <Show when={file.error}>
                      <span class="inline-flex px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs">
                        Error
                      </span>
                    </Show>

                    {/* View parsed button */}
                    <Show when={!file.uploading && !file.error}>
                      <button
                        type="button"
                        class="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        onClick={() => toggleParsedView(file.fileId)}
                      >
                        {file.showParsed ? "Hide" : "View parsed"}
                      </button>
                    </Show>

                    {/* Remove button */}
                    <Show when={!props.readOnly}>
                      <button
                        type="button"
                        class="text-xs text-red-500 hover:text-red-600"
                        onClick={() => removeFile(file.fileId)}
                      >
                        Remove
                      </button>
                    </Show>
                  </div>
                </div>

                {/* Upload progress bar */}
                <Show when={file.uploading}>
                  <div class="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      class="bg-indigo-500 h-1.5 rounded-full transition-all"
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
                    <label class="block text-xs font-medium text-gray-600 mb-1">
                      Parsed content (editable)
                    </label>
                    <textarea
                      value={file.parsedText}
                      onInput={(e) =>
                        handleParsedTextEdit(file.fileId, e.currentTarget.value)
                      }
                      disabled={props.readOnly}
                      rows={6}
                      class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 resize-y"
                    />
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Confirm error */}
      <Show when={confirmError()}>
        <div class="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{confirmError()}</div>
      </Show>

      {/* Confirm button (only in active mode, not readOnly) */}
      <Show when={!props.readOnly}>
        <div class="flex justify-end">
          <button
            type="button"
            class="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            disabled={files().some((f) => f.uploading)}
            onClick={handleConfirm}
          >
            Confirm Input
          </button>
        </div>
      </Show>
    </div>
  );
}
