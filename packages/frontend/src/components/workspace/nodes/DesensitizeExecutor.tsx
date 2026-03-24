import type { DesensitizeConfig, InputSource, NodeExecution } from "@intelliflow/shared";
import { For, Show, createSignal, onMount } from "solid-js";
import { api } from "../../../api/client";

interface DetectedItem {
  original: string;
  placeholder: string;
  sensitiveType: string;
  description: string;
  startIndex: number;
  endIndex: number;
  checked: boolean;
}

interface ManualAddForm {
  original: string;
  sensitiveType: string;
}

interface Props {
  nodeExecution: NodeExecution;
  config: DesensitizeConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  readOnly: boolean;
}

type Phase = "detect" | "review" | "confirmed";

// Group items by sensitiveType for collapsible category sections
function groupByType(items: DetectedItem[]): Record<string, DetectedItem[]> {
  const groups: Record<string, DetectedItem[]> = {};
  for (const item of items) {
    if (!groups[item.sensitiveType]) groups[item.sensitiveType] = [];
    groups[item.sensitiveType].push(item);
  }
  return groups;
}

/** Check if inputData uses multi-source format */
function isMultiSource(inputData: Record<string, unknown> | null): inputData is { sources: Record<string, { displayName: string; text: string }> } {
  return !!inputData && typeof inputData === "object" && "sources" in inputData && typeof inputData.sources === "object";
}

export default function DesensitizeExecutor(props: Props) {
  // Multi-source support
  const multiSource = () => isMultiSource(props.nodeExecution.inputData as Record<string, unknown> | null);
  const sourceEntries = () => {
    const input = props.nodeExecution.inputData as Record<string, unknown> | null;
    if (isMultiSource(input)) {
      return Object.entries(input.sources).map(([outputId, data]) => ({
        outputId,
        displayName: data.displayName,
        text: data.text,
      }));
    }
    return [];
  };
  const [activeSourceIndex, setActiveSourceIndex] = createSignal(0);

  // Determine initial phase from existing outputData
  const initialPhase = (): Phase => {
    const output = props.nodeExecution.outputData as Record<string, unknown> | null;
    if (output && (output.text || output.sources)) {
      return "confirmed";
    }
    return "detect";
  };

  const [phase, setPhase] = createSignal<Phase>(initialPhase());
  const [inputText, setInputText] = createSignal(
    multiSource()
      ? (sourceEntries()[0]?.text ?? "")
      : (((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ?? ""),
  );
  const [items, setItems] = createSignal<DetectedItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [showManualAdd, setShowManualAdd] = createSignal(false);
  const [manualForm, setManualForm] = createSignal<ManualAddForm>({
    original: "",
    sensitiveType: "person_name",
  });
  const [selectedItemIndex, setSelectedItemIndex] = createSignal<number | null>(null);
  const [collapsedTypes, setCollapsedTypes] = createSignal<Set<string>>(new Set());

  // Auto-detect on mount when in detect phase with input text
  onMount(() => {
    if (phase() === "detect" && inputText().trim() && !props.readOnly) {
      handleDetect();
    }
  });

  // ─── Phase 1: Detection ───────────────────────────────────────────────────

  async function handleDetect() {
    const text = inputText();
    if (!text.trim()) {
      setError("无可检测的输入文本");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const runtimeApi = api.api.runtime as unknown as Record<
        string,
        Record<
          string,
          Record<string, Record<string, { post: (body: unknown) => Promise<{ data: unknown }> }>>
        >
      >;
      const res = await runtimeApi[props.documentId].desensitize[
        props.nodeExecution.id
      ].detect.post({ text });

      const data = res.data as Record<string, unknown> | null;
      if (data && !("error" in data)) {
        const detected = (data as unknown as { items: DetectedItem[] }).items.map(
          (item: DetectedItem) => ({ ...item, checked: true }),
        );
        setItems(detected);
        setPhase("review");
      } else {
        const errMsg = data?.error;
        setError(typeof errMsg === "string" ? errMsg : "检测失败，请重试");
      }
    } catch {
      setError("检测失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  // ─── Phase 2: Review helpers ──────────────────────────────────────────────

  function toggleItem(index: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)),
    );
  }

  function toggleTypeCollapsed(type: string) {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleManualAdd() {
    const form = manualForm();
    if (!form.original.trim()) return;

    const text = inputText();
    const startIndex = text.indexOf(form.original);
    const checkedOfType = items().filter(
      (it) => it.sensitiveType === form.sensitiveType && it.checked,
    ).length;
    const count = checkedOfType + 1;

    // System-defined placeholder format: [TYPE_N]
    const placeholder = `[${form.sensitiveType.toUpperCase()}_${count}]`;

    const newItem: DetectedItem = {
      original: form.original,
      placeholder,
      sensitiveType: form.sensitiveType,
      description: form.sensitiveType,
      startIndex,
      endIndex: startIndex >= 0 ? startIndex + form.original.length : -1,
      checked: true,
    };

    setItems((prev) => [...prev, newItem]);
    setManualForm({ original: "", sensitiveType: "person_name" });
    setShowManualAdd(false);
  }

  function getSanitizedPreview(): string {
    let text = inputText();
    // Apply checked items in reverse order of startIndex to preserve positions
    const checked = items()
      .filter((it) => it.checked && it.startIndex >= 0)
      .sort((a, b) => b.startIndex - a.startIndex);

    for (const item of checked) {
      text = text.slice(0, item.startIndex) + item.placeholder + text.slice(item.endIndex);
    }
    return text;
  }

  // ─── Phase 3: Confirm ────────────────────────────────────────────────────

  async function handleConfirm() {
    const confirmed = items().filter((it) => it.checked);
    const sanitizedText = getSanitizedPreview();

    setLoading(true);
    setError(null);

    try {
      const runtimeApi = api.api.runtime as unknown as Record<
        string,
        Record<
          string,
          Record<string, Record<string, { post: (body: unknown) => Promise<{ data: unknown }> }>>
        >
      >;
      const res = await runtimeApi[props.documentId].desensitize[
        props.nodeExecution.id
      ].confirm.post({
        items: confirmed.map((it) => ({
          original: it.original,
          placeholder: it.placeholder,
          sensitiveType: it.sensitiveType,
        })),
        sanitizedText,
      });

      const data = res.data as Record<string, unknown> | null;
      if (data && !("error" in data)) {
        setPhase("confirmed");
        props.onDraftSave({ text: sanitizedText, mappingCount: confirmed.length });
      } else {
        const errMsg = data?.error;
        setError(typeof errMsg === "string" ? errMsg : "确认失败，请重试");
      }
    } catch {
      setError("确认失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  // ─── Highlight rendering ──────────────────────────────────────────────────

  function renderHighlightedText() {
    const text = inputText();
    const checked = items()
      .filter((it) => it.checked && it.startIndex >= 0)
      .sort((a, b) => a.startIndex - b.startIndex);

    if (checked.length === 0) {
      return <span>{text}</span>;
    }

    const parts: Array<{ text: string; isHighlight: boolean; itemIndex: number }> = [];
    let lastEnd = 0;

    for (const item of checked) {
      if (item.startIndex > lastEnd) {
        parts.push({
          text: text.slice(lastEnd, item.startIndex),
          isHighlight: false,
          itemIndex: -1,
        });
      }
      const originalIndex = items().indexOf(item);
      parts.push({ text: item.original, isHighlight: true, itemIndex: originalIndex });
      lastEnd = item.endIndex;
    }

    if (lastEnd < text.length) {
      parts.push({ text: text.slice(lastEnd), isHighlight: false, itemIndex: -1 });
    }

    return (
      <For each={parts}>
        {(part) => (
          <Show when={part.isHighlight} fallback={<span>{part.text}</span>}>
            <span
              class={`px-0.5 rounded cursor-pointer transition-colors ${
                selectedItemIndex() === part.itemIndex
                  ? "bg-amber-400 ring-2 ring-amber-500"
                  : "bg-amber-200 hover:bg-amber-300"
              }`}
              onClick={() => setSelectedItemIndex(part.itemIndex)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedItemIndex(part.itemIndex);
              }}
              title={items()[part.itemIndex]?.placeholder}
            >
              {part.text}
            </span>
          </Show>
        )}
      </For>
    );
  }

  // ─── Type label / badge ───────────────────────────────────────────────────

  const typeLabels: Record<string, string> = {
    person_name: "姓名",
    phone_number: "手机号",
    email: "邮箱",
    id_number: "身份证号",
    bank_card: "银行卡号",
    company_name: "公司名",
    address: "地址",
  };

  // Surface-tone pills per design system — no hard colored badges
  function typeBadgeClass(type: string): string {
    const map: Record<string, string> = {
      person_name: "bg-indigo-50 text-indigo-700",
      phone_number: "bg-emerald-50 text-emerald-700",
      email: "bg-violet-50 text-violet-700",
      id_number: "bg-rose-50 text-rose-700",
      bank_card: "bg-amber-50 text-amber-700",
      company_name: "bg-teal-50 text-teal-700",
      address: "bg-pink-50 text-pink-700",
    };
    return map[type] ?? "bg-[#f7f9fb] text-[#464555]";
  }

  function getTypeLabel(type: string): string {
    return typeLabels[type] ?? type;
  }

  function maskOriginal(text: string): string {
    if (text.length <= 2) return text;
    const visible = Math.max(1, Math.floor(text.length / 3));
    return text.slice(0, visible) + "*".repeat(text.length - visible * 2) + text.slice(-visible);
  }

  // ─── Read-only / confirmed mode ────────────────────────────────────────────

  if (props.readOnly || phase() === "confirmed") {
    const outputData = props.nodeExecution.outputData as Record<string, unknown> | null;
    const outputText = (outputData?.text as string) ?? "";
    const mappingCount = (outputData?.mappingCount as number) ?? 0;
    const outputSources = outputData?.sources as Record<string, { displayName: string; desensitizedText: string }> | undefined;
    const hasMultiOutput = !!outputSources && Object.keys(outputSources).length > 0;

    return (
      <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
        {/* Header */}
        <div class="px-6 py-5 bg-gradient-to-r from-[#f2f4f6] to-white border-b border-[rgba(199,196,216,0.15)]">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] flex items-center justify-center flex-shrink-0">
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-base font-semibold text-[#191c1e]">信息脱敏</h2>
              <p class="text-xs text-[#464555] mt-0.5">自动检测敏感信息并进行脱敏处理</p>
            </div>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              审核完成 · 已脱敏 {mappingCount} 项
            </span>
          </div>
        </div>
        <div class="p-6">
          <Show when={hasMultiOutput} fallback={
            <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed">
              {outputText}
            </div>
          }>
            <div class="space-y-3">
              <For each={Object.entries(outputSources ?? {})}>
                {([_outputId, src]) => (
                  <div class="rounded-xl border border-[rgba(199,196,216,0.25)] overflow-hidden">
                    <div class="px-4 py-2 bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.15)]">
                      <span class="text-xs font-medium text-[#464555]">{src.displayName}</span>
                    </div>
                    <div class="p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                      {src.desensitizedText}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    );
  }

  // ─── Null guard: no categories configured ─────────────────────────────────

  const categoriesConfigured = () => props.config?.categories && props.config.categories.length > 0;

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="px-6 py-5 bg-gradient-to-r from-[#f2f4f6] to-white border-b border-[rgba(199,196,216,0.15)]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] flex items-center justify-center flex-shrink-0">
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-[#191c1e]">
              {props.nodeExecution.nodeLabel || "信息脱敏"}
            </h2>
            <p class="text-xs text-[#464555] mt-0.5">自动检测敏感信息并进行脱敏处理</p>
          </div>
        </div>
      </div>

      <div class="p-6 space-y-5">
        {/* Null guard */}
        <Show when={!categoriesConfigured()}>
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
            <p class="text-sm">未配置脱敏类别</p>
            <p class="text-xs mt-1 text-[#c4c4cc]">请在工作流编辑器中配置脱敏类别</p>
          </div>
        </Show>

        <Show when={categoriesConfigured()}>
          {/* Configured categories chips */}
          <div class="flex flex-wrap gap-1.5 items-center">
            <span class="text-xs text-[#9fa0a8]">检测类别：</span>
            <For each={props.config.categories}>
              {(cat) => (
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#f7f9fb] text-[#464555]">
                  {cat.name}
                </span>
              )}
            </For>
          </div>

          {/* Multi-source tab bar */}
          <Show when={multiSource() && sourceEntries().length > 1}>
            <div class="flex gap-1 bg-[#f7f9fb] rounded-xl p-1">
              <For each={sourceEntries()}>
                {(src, index) => (
                  <button
                    type="button"
                    class={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      activeSourceIndex() === index()
                        ? "bg-white text-[#191c1e] shadow-sm"
                        : "text-[#9fa0a8] hover:text-[#464555]"
                    }`}
                    onClick={() => {
                      setActiveSourceIndex(index());
                      setInputText(src.text);
                      // Reset to detect phase for this source
                      if (phase() !== "confirmed") {
                        setPhase("detect");
                        setItems([]);
                      }
                    }}
                  >
                    {src.displayName}
                  </button>
                )}
              </For>
            </div>
          </Show>

          {/* Error display */}
          <Show when={error()}>
            <div class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
              {error()}
            </div>
          </Show>

          {/* ── Phase 1: Detection (auto-triggered) ── */}
          <Show when={phase() === "detect"}>
            <Show when={loading()}>
              {/* Status banner: scanning */}
              <div class="bg-[#fff7ed] rounded-xl px-4 py-3 flex items-center gap-3">
                <div class="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span class="text-sm text-amber-700 font-medium">正在扫描敏感信息...</span>
              </div>
            </Show>
            <Show when={!loading()}>
              <div class="space-y-3">
                <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
                  <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                  输入文本
                </h3>
                <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {inputText()}
                </div>
                <Show when={!inputText().trim()}>
                  <p class="text-sm text-[#9fa0a8] text-center py-4">
                    暂无输入文本，请等待上游节点完成
                  </p>
                </Show>
              </div>
            </Show>
          </Show>

          {/* ── Phase 2: Review ── */}
          <Show when={phase() === "review"}>
            {/* Status banner */}
            <div class="bg-[#f0fdf4] rounded-xl px-4 py-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span class="text-sm text-emerald-700 font-medium">
                  检测完成，共发现 {items().length} 项敏感信息
                </span>
              </div>
              <button
                type="button"
                class="text-xs text-[#4f46e5] hover:text-[#3525cd] font-medium transition-colors"
                onClick={() => {
                  setPhase("detect");
                  handleDetect();
                }}
              >
                重新检测
              </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left panel: highlighted text */}
              <div class="space-y-3">
                <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
                  <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                  文本预览
                </h3>
                <div class="bg-white border border-[rgba(199,196,216,0.35)] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                  {renderHighlightedText()}
                </div>

                <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2 mt-4">
                  <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                  脱敏预览
                </h3>
                <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm text-[#464555] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {getSanitizedPreview()}
                </div>
              </div>

              {/* Right panel: category sections + checklist */}
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
                    <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                    敏感信息审核
                  </h3>
                  <button
                    type="button"
                    class="text-xs text-[#4f46e5] hover:text-[#3525cd] font-medium transition-colors"
                    onClick={() => setShowManualAdd(!showManualAdd())}
                  >
                    {showManualAdd() ? "取消" : "手动添加"}
                  </button>
                </div>

                {/* Manual add form */}
                <Show when={showManualAdd()}>
                  <div class="bg-[#f7f9fb] rounded-xl p-3 space-y-2 border border-[rgba(199,196,216,0.35)]">
                    <input
                      type="text"
                      placeholder="输入需要脱敏的文本..."
                      class="w-full px-4 py-2.5 text-sm bg-white border border-[rgba(199,196,216,0.35)] rounded-xl text-[#191c1e] placeholder-[#9fa0a8] focus:outline-none focus:ring-2 focus:ring-[#c3c0ff] focus:border-[#4f46e5] transition-all"
                      value={manualForm().original}
                      onInput={(e) =>
                        setManualForm((prev) => ({ ...prev, original: e.currentTarget.value }))
                      }
                    />
                    <div class="flex gap-2">
                      <select
                        class="flex-1 px-3 py-2 text-sm bg-white border border-[rgba(199,196,216,0.35)] rounded-xl text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#c3c0ff] focus:border-[#4f46e5] transition-all"
                        value={manualForm().sensitiveType}
                        onChange={(e) =>
                          setManualForm((prev) => ({
                            ...prev,
                            sensitiveType: e.currentTarget.value,
                          }))
                        }
                        aria-label="敏感信息类型"
                      >
                        <option value="person_name">姓名</option>
                        <option value="phone_number">手机号</option>
                        <option value="email">邮箱</option>
                        <option value="id_number">身份证号</option>
                        <option value="bank_card">银行卡号</option>
                        <option value="company_name">公司名</option>
                        <option value="address">地址</option>
                      </select>
                      <button
                        type="button"
                        class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3525cd] to-[#4f46e5] rounded-lg hover:scale-[1.02] transition-transform"
                        onClick={handleManualAdd}
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </Show>

                {/* Category sections */}
                <div class="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
                  <For each={Object.entries(groupByType(items()))}>
                    {([type, typeItems]) => {
                      const checkedCount = () => typeItems.filter((it) => it.checked).length;
                      const isCollapsed = () => collapsedTypes().has(type);
                      return (
                        <div class="rounded-xl border border-[rgba(199,196,216,0.35)] overflow-hidden">
                          {/* Category header */}
                          <button
                            type="button"
                            class="w-full flex items-center justify-between px-3 py-2.5 bg-[#f7f9fb] hover:bg-[#f0efff] transition-colors"
                            onClick={() => toggleTypeCollapsed(type)}
                          >
                            <div class="flex items-center gap-2">
                              <span
                                class={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeClass(type)}`}
                              >
                                {getTypeLabel(type)}
                              </span>
                              <span class="text-xs text-[#9fa0a8]">
                                ({checkedCount()}/{typeItems.length} 项)
                              </span>
                            </div>
                            <svg
                              aria-hidden="true"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              class={`text-[#9fa0a8] transition-transform ${isCollapsed() ? "" : "rotate-180"}`}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>

                          {/* Items list */}
                          <Show when={!isCollapsed()}>
                            <div class="divide-y divide-[rgba(199,196,216,0.15)]">
                              <For each={typeItems}>
                                {(item) => {
                                  const index = () => items().indexOf(item);
                                  return (
                                    <div
                                      class={`flex items-center gap-3 px-3 py-2.5 bg-white cursor-pointer transition-colors ${
                                        selectedItemIndex() === index()
                                          ? "bg-[#f0efff]"
                                          : "hover:bg-[#fafafe]"
                                      } ${!item.checked ? "opacity-50" : ""}`}
                                      onClick={() => setSelectedItemIndex(index())}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ")
                                          setSelectedItemIndex(index());
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={item.checked}
                                        onChange={() => toggleItem(index())}
                                        class="w-4 h-4 rounded border-[rgba(199,196,216,0.6)] text-[#4f46e5] focus:ring-[#c3c0ff] flex-shrink-0"
                                        aria-label={`${item.checked ? "取消脱敏" : "确认脱敏"}: ${maskOriginal(item.original)}`}
                                      />
                                      {/* original with line-through → masked replacement */}
                                      <div class="flex-1 min-w-0 flex items-center gap-2 text-sm">
                                        <span class="font-mono text-red-400 line-through truncate">
                                          {maskOriginal(item.original)}
                                        </span>
                                        <span class="text-[#9fa0a8] flex-shrink-0">→</span>
                                        <span class="font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs truncate">
                                          {item.placeholder}
                                        </span>
                                      </div>
                                      {/* Toggle switch */}
                                      <button
                                        type="button"
                                        aria-label={item.checked ? "禁用此项脱敏" : "启用此项脱敏"}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleItem(index());
                                        }}
                                        class={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${
                                          item.checked ? "bg-[#4f46e5]" : "bg-[#e6e8ea]"
                                        }`}
                                      >
                                        <span
                                          class={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                            item.checked ? "translate-x-4" : "translate-x-0.5"
                                          }`}
                                        />
                                      </button>
                                    </div>
                                  );
                                }}
                              </For>
                            </div>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>

                {/* Summary bar + confirm */}
                <div class="pt-3 border-t border-[rgba(199,196,216,0.2)] space-y-3">
                  <div class="flex items-center justify-between text-xs text-[#464555]">
                    <span>
                      已选择{" "}
                      <span class="font-semibold text-[#191c1e]">
                        {items().filter((it) => it.checked).length}
                      </span>{" "}
                      / {items().length} 项
                    </span>
                    <Show when={items().filter((it) => it.checked).length === 0}>
                      <span class="text-amber-600">请至少选择一项进行脱敏</span>
                    </Show>
                  </div>
                  <button
                    type="button"
                    class="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#3525cd] to-[#4f46e5] rounded-lg hover:scale-[1.02] active:scale-[0.99] transition-transform disabled:opacity-50 disabled:scale-100 shadow-sm"
                    disabled={loading() || items().filter((it) => it.checked).length === 0}
                    onClick={handleConfirm}
                  >
                    <Show
                      when={loading()}
                      fallback={<>确认脱敏（{items().filter((it) => it.checked).length} 项）</>}
                    >
                      正在确认...
                    </Show>
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
