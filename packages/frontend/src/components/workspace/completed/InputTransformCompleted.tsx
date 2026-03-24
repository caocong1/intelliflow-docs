import type { InputTransformConfig, NodeConfig, NodeExecution } from "@intelliflow/shared";
import { For, Show, createSignal } from "solid-js";
import { formatDuration } from "../../../lib/format-utils";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
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
    } | null;

  const config = () => props.config as InputTransformConfig | undefined;

  const fieldEntries = () => {
    const od = outputData();
    if (!od?.fields) return [];
    const fieldDefs = config()?.formFields ?? [];
    return Object.entries(od.fields).map(([key, value]) => {
      const def = fieldDefs.find((f: { id: string; label: string }) => f.id === key);
      return { label: def?.label ?? key, value };
    });
  };

  const files = () => outputData()?.files ?? [];

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
        {/* Form Fields Section */}
        <Show when={fieldEntries().length > 0}>
          <section>
            <div class="flex items-center gap-3 mb-4">
              <h3 class="text-[13px] font-bold text-[#191c1e] uppercase tracking-wider">
                表单字段
              </h3>
              <div class="flex-1 h-[1px] bg-slate-100" />
            </div>
            <div>
              <For each={fieldEntries()}>
                {(entry) => (
                  <div class="flex py-3 border-b border-slate-50 items-start hover:bg-slate-50/50 transition-colors px-2 -mx-2 rounded-md">
                    <span class="text-sm text-[#464555] w-[160px] flex-shrink-0">
                      {entry.label}
                    </span>
                    <span class="text-sm text-[#191c1e] font-medium whitespace-pre-wrap">
                      {entry.value}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>

        {/* Uploaded Files Section */}
        <Show when={files().length > 0}>
          <section>
            <div class="flex items-center gap-3 mb-6">
              <div class="flex items-center gap-2">
                <h3 class="text-[13px] font-bold text-[#191c1e] uppercase tracking-wider">
                  上传文件
                </h3>
                <span class="text-[11px] font-medium text-[#464555] bg-[#e6e8ea] px-1.5 py-0.5 rounded-md">
                  ({files().length} 个文件)
                </span>
              </div>
              <div class="flex-1 h-[1px] bg-slate-100" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <For each={files()}>
                {(file) => {
                  const ext = file.name.split(".").pop() ?? "";
                  const isExpanded = () => expandedFile() === file.fileId;

                  return (
                    <div class="space-y-0">
                      <button
                        type="button"
                        class={`w-full bg-[#f2f4f6] p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-[#eceef0] transition-colors border-0 text-left ${isExpanded() ? "rounded-b-none" : ""}`}
                        onClick={() => setExpandedFile(isExpanded() ? null : file.fileId)}
                      >
                        <div class="flex items-center gap-4">
                          <div
                            class={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-[10px] tracking-tighter ${getFileExtColor(ext)}`}
                          >
                            {ext.toUpperCase()}
                          </div>
                          <div>
                            <p class="text-sm font-semibold text-[#191c1e] truncate max-w-[180px]">
                              {file.name}
                            </p>
                            <span class="text-[11px] text-[#4f46e5] font-medium mt-1 flex items-center gap-0.5 hover:underline cursor-pointer">
                              {isExpanded() ? "收起" : "查看解析内容"}
                              <svg
                                class={`w-3.5 h-3.5 transition-transform ${isExpanded() ? "rotate-90" : ""}`}
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
                        <span class="text-[11px] text-[#777587] font-medium">
                          {file.fileSize ? formatFileSize(file.fileSize) : ""}
                        </span>
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
          </section>
        </Show>
      </div>

      {/* Action Bar */}
      <div class="px-8 py-6 bg-slate-50/50 flex justify-end items-center gap-4">
        <button
          type="button"
          class="px-5 py-2.5 text-[13px] font-semibold text-[#464555] hover:text-[#191c1e] transition-colors flex items-center gap-2 bg-transparent border-0 cursor-pointer"
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
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          复制输入内容
        </button>
      </div>
    </div>
  );
}
