import type { InputTransformConfig, NodeConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";
import { formatDuration } from "../../../lib/format-utils";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onReexecute?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtColor(ext: string): string {
  const map: Record<string, { bg: string; text: string }> = {
    pdf: { bg: "bg-red-100", text: "text-red-700" },
    docx: { bg: "bg-blue-100", text: "text-blue-700" },
    doc: { bg: "bg-blue-100", text: "text-blue-700" },
    txt: { bg: "bg-gray-100", text: "text-gray-600" },
    png: { bg: "bg-purple-100", text: "text-purple-700" },
    jpg: { bg: "bg-purple-100", text: "text-purple-700" },
    jpeg: { bg: "bg-purple-100", text: "text-purple-700" },
  };
  const colors = map[ext.toLowerCase()] ?? {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
  };
  return `${colors.bg} ${colors.text}`;
}

export default function InputTransformCompleted(props: Props) {
  const [expandedFile, setExpandedFile] = createSignal<string | null>(null);

  const outputData = () =>
    props.node.outputData as {
      fields?: Record<string, string>;
      files?: Array<{
        fileId: string;
        name: string;
        parsedText: string;
        mimeType?: string;
        fileSize?: number;
      }>;
      fileSlots?: Record<
        string,
        { text?: string; files?: Array<{ fileId: string; name: string }> }
      >;
    } | null;

  const config = () => props.config as InputTransformConfig | undefined;

  /** All form fields in defined order, with file fields showing associated files */
  const allFieldEntries = () => {
    const od = outputData();
    const fieldDefs = config()?.formFields ?? [];
    if (!od || fieldDefs.length === 0) return [];

    // Build fileSlot → files mapping
    const slotFileMap = new Map<
      string,
      Array<{ fileId: string; name: string; parsedText: string; fileSize?: number }>
    >();
    if (od.fileSlots && od.files) {
      for (const [slotId, slot] of Object.entries(od.fileSlots)) {
        const slotFileIds = new Set((slot.files ?? []).map((f) => f.fileId));
        slotFileMap.set(
          slotId,
          od.files.filter((f) => slotFileIds.has(f.fileId)),
        );
      }
    }

    return fieldDefs.map((def) => {
      if (def.type === "file") {
        const slotId = (def as { fileSlotId?: string }).fileSlotId ?? def.id;
        const slotFiles = slotFileMap.get(slotId) ?? [];
        return {
          label: (def as { fileSlotLabel?: string }).fileSlotLabel || def.label,
          value: "",
          type: "file" as const,
          files: slotFiles,
        };
      }
      return {
        label: def.label,
        value: od.fields?.[def.id] ?? "",
        type: (def.type ?? "text") as string,
        files: [] as Array<{ fileId: string; name: string; parsedText: string; fileSize?: number }>,
      };
    });
  };

  /** Unmatched files (no slot association — legacy data) */
  const unmatchedFiles = () => {
    const od = outputData();
    if (!od?.files) return [];
    const matchedIds = new Set<string>();
    if (od.fileSlots) {
      for (const slot of Object.values(od.fileSlots)) {
        for (const f of slot.files ?? []) matchedIds.add(f.fileId);
      }
    }
    return od.files.filter((f) => !matchedIds.has(f.fileId));
  };

  const duration = () => formatDuration(props.node.startedAt, props.node.completedAt);

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-b from-[#f2f4f6] to-white px-8 py-6 border-b border-slate-100 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)" }}
          >
            <svg
              class="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M12 18v-6 M9 15h6"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-[#191c1e]">{props.node.nodeLabel}</h2>
            <span class="inline-block mt-1 px-2.5 py-0.5 bg-[#e2dfff] text-[#3525cd] text-[11px] font-bold rounded-full">
              输入转换
            </span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full">
            <div class="w-2 h-2 rounded-full bg-green-500" />
            <span class="text-green-700 text-xs font-semibold">已完成</span>
          </div>
          <Show when={duration()}>
            <div class="px-3 py-1 bg-slate-100 rounded-full">
              <span class="text-[#464555] text-xs font-medium">耗时 {duration()}</span>
            </div>
          </Show>
        </div>
      </div>

      {/* Body */}
      <div class="p-8 space-y-10">
        {/* All form fields in defined order (text + file fields inline) */}
        <Show when={allFieldEntries().length > 0}>
          <section>
            <div class="flex items-center gap-3 mb-4">
              <h3 class="text-[13px] font-bold text-[#191c1e] uppercase tracking-wider">
                表单字段
              </h3>
              <div class="flex-1 h-[1px] bg-slate-100" />
            </div>
            <div>
              <For each={allFieldEntries()}>
                {(entry) => (
                  <Show
                    when={entry.type === "file"}
                    fallback={
                      <div class="flex py-3 border-b border-slate-50 items-start hover:bg-slate-50/50 transition-colors px-2 -mx-2 rounded-md">
                        <span class="text-sm text-[#464555] w-[160px] flex-shrink-0">
                          {entry.label}
                        </span>
                        {entry.type === "multiselect" && entry.value ? (
                          <div class="flex flex-wrap gap-1">
                            <For each={entry.value.split(",").filter(Boolean)}>
                              {(tag) => (
                                <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                                  {tag}
                                </span>
                              )}
                            </For>
                          </div>
                        ) : (
                          <span class="text-sm text-[#191c1e] font-medium whitespace-pre-wrap">
                            {entry.value}
                          </span>
                        )}
                      </div>
                    }
                  >
                    {/* File field — show associated files inline */}
                    <div class="py-3 border-b border-slate-50 px-2 -mx-2 rounded-md">
                      <span class="text-sm text-[#464555]">{entry.label}</span>
                      <Show
                        when={entry.files.length > 0}
                        fallback={<p class="text-xs text-[#9fa0a8] mt-1 italic">未上传文件</p>}
                      >
                        <div class="mt-2 space-y-2">
                          <For each={entry.files}>
                            {(file) => {
                              const ext = file.name.split(".").pop() ?? "";
                              const isExpanded = () => expandedFile() === file.fileId;
                              return (
                                <div>
                                  <button
                                    type="button"
                                    class={`w-full bg-[#f2f4f6] p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#eceef0] transition-colors border-0 text-left ${isExpanded() ? "rounded-b-none" : ""}`}
                                    onClick={() =>
                                      setExpandedFile(isExpanded() ? null : file.fileId)
                                    }
                                  >
                                    <div class="flex items-center gap-3">
                                      <div
                                        class={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-[10px] ${getFileExtColor(ext)}`}
                                      >
                                        {ext.toUpperCase()}
                                      </div>
                                      <div>
                                        <p class="text-sm font-medium text-[#191c1e] truncate max-w-[240px]">
                                          {file.name}
                                        </p>
                                        <span class="text-[11px] text-[#4f46e5] font-medium flex items-center gap-0.5">
                                          {isExpanded() ? "收起" : "查看解析内容"}
                                          <svg
                                            class={`w-3 h-3 transition-transform ${isExpanded() ? "rotate-90" : ""}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M9 5l7 7-7 7"
                                            />
                                          </svg>
                                        </span>
                                      </div>
                                    </div>
                                    <Show when={file.fileSize}>
                                      <span class="text-[11px] text-[#777587]">
                                        {formatFileSize(file.fileSize ?? 0)}
                                      </span>
                                    </Show>
                                  </button>
                                  <Show when={isExpanded() && file.parsedText}>
                                    <div class="bg-[#f7f9fb] rounded-b-xl p-4 border border-t-0 border-[#eceef0] max-h-[200px] overflow-y-auto">
                                      <pre class="text-xs text-[#464555] whitespace-pre-wrap leading-relaxed">
                                        {file.parsedText}
                                      </pre>
                                    </div>
                                  </Show>
                                </div>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>
                )}
              </For>
            </div>
          </section>
        </Show>

        <Show when={unmatchedFiles().length > 0}>
          <section>
            <div class="flex items-center gap-3 mb-4">
              <h3 class="text-[13px] font-bold text-[#8a5a00] uppercase tracking-wider">
                历史上传文件
              </h3>
              <div class="flex-1 h-[1px] bg-amber-100" />
            </div>
            <div class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
              <p class="text-xs text-[#8a5a00]">
                这些文件来自旧数据，缺少上传槽位信息。重新确认输入转换步骤后会恢复到对应上传框。
              </p>
              <For each={unmatchedFiles()}>
                {(file) => {
                  const ext = file.name.split(".").pop() ?? "";
                  const isExpanded = () => expandedFile() === file.fileId;
                  return (
                    <div>
                      <button
                        type="button"
                        class={`w-full bg-white p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#fffaf0] transition-colors border border-amber-100 text-left ${isExpanded() ? "rounded-b-none" : ""}`}
                        onClick={() => setExpandedFile(isExpanded() ? null : file.fileId)}
                      >
                        <div class="flex items-center gap-3">
                          <div
                            class={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-[10px] ${getFileExtColor(ext)}`}
                          >
                            {ext.toUpperCase()}
                          </div>
                          <div>
                            <p class="text-sm font-medium text-[#191c1e] truncate max-w-[240px]">
                              {file.name}
                            </p>
                            <span class="text-[11px] text-[#4f46e5] font-medium flex items-center gap-0.5">
                              {isExpanded() ? "收起" : "查看解析内容"}
                              <svg
                                class={`w-3 h-3 transition-transform ${isExpanded() ? "rotate-90" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </span>
                          </div>
                        </div>
                        <Show when={file.fileSize}>
                          <span class="text-[11px] text-[#777587]">
                            {formatFileSize(file.fileSize ?? 0)}
                          </span>
                        </Show>
                      </button>
                      <Show when={isExpanded() && file.parsedText}>
                        <div class="bg-[#fffaf0] rounded-b-xl p-4 border border-t-0 border-amber-100 max-h-[200px] overflow-y-auto">
                          <pre class="text-xs text-[#464555] whitespace-pre-wrap leading-relaxed">
                            {file.parsedText}
                          </pre>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </section>
        </Show>
      </div>

      {/* Action Bar */}
      <div class="px-8 py-6 bg-slate-50/50 flex justify-end items-center gap-4">
        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
          onClick={() => props.onReexecute?.()}
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          重新输入
        </button>
      </div>
    </div>
  );
}
