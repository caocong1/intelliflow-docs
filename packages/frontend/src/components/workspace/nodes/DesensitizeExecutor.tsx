import type { DesensitizeConfig, NodeExecution } from "@intelliflow/shared";
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

export default function DesensitizeExecutor(props: Props) {
  // Determine initial phase from existing outputData
  const initialPhase = (): Phase => {
    if (
      props.nodeExecution.outputData &&
      (props.nodeExecution.outputData as Record<string, unknown>).text
    ) {
      return "confirmed";
    }
    return "detect";
  };

  const [phase, setPhase] = createSignal<Phase>(initialPhase());
  const [inputText, setInputText] = createSignal(
    ((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ?? "",
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
      const res = await (
        api.api.runtime as unknown as Record<
          string,
          Record<string, Record<string, { post: (body: unknown) => Promise<{ data: unknown }> }>>
        >
      )[props.documentId].desensitize[props.nodeExecution.id].detect.post({ text });

      if (res.data && !("error" in res.data)) {
        const detected = (res.data as { items: DetectedItem[] }).items.map(
          (item: DetectedItem) => ({ ...item, checked: true }),
        );
        setItems(detected);
        setPhase("review");
      } else {
        setError((res.data as Record<string, unknown> | undefined)?.error ?? "检测失败，请重试");
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
      const res = await (
        api.api.runtime as unknown as Record<
          string,
          Record<string, Record<string, { post: (body: unknown) => Promise<{ data: unknown }> }>>
        >
      )[props.documentId].desensitize[props.nodeExecution.id].confirm.post({
        items: confirmed.map((it) => ({
          original: it.original,
          placeholder: it.placeholder,
          sensitiveType: it.sensitiveType,
        })),
        sanitizedText,
      });

      if (res.data && !("error" in res.data)) {
        setPhase("confirmed");
        props.onDraftSave({ text: sanitizedText, mappingCount: confirmed.length });
      } else {
        setError((res.data as Record<string, unknown> | undefined)?.error ?? "确认失败，请重试");
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

  // ─── Type badge color ─────────────────────────────────────────────────────

  const typeLabels: Record<string, string> = {
    person_name: "姓名",
    phone_number: "手机号",
    email: "邮箱",
    id_number: "身份证号",
    bank_card: "银行卡号",
    company_name: "公司名",
    address: "地址",
  };

  function typeBadgeColor(type: string): string {
    const colors: Record<string, string> = {
      person_name: "bg-blue-100 text-blue-700",
      phone_number: "bg-green-100 text-green-700",
      email: "bg-purple-100 text-purple-700",
      id_number: "bg-red-100 text-red-700",
      bank_card: "bg-orange-100 text-orange-700",
      company_name: "bg-teal-100 text-teal-700",
      address: "bg-pink-100 text-pink-700",
    };
    return colors[type] ?? "bg-gray-100 text-gray-700";
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
    const outputText =
      ((props.nodeExecution.outputData as Record<string, unknown>)?.text as string) ?? "";
    const mappingCount =
      ((props.nodeExecution.outputData as Record<string, unknown>)?.mappingCount as number) ?? 0;

    return (
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="px-6 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-gray-100">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold text-gray-800">信息脱敏</h2>
            <span class="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              审核完成 - 已脱敏 {mappingCount} 项
            </span>
          </div>
        </div>
        <div class="p-6">
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {outputText}
          </div>
        </div>
      </div>
    );
  }

  // ─── Null guard: no categories configured ─────────────────────────────────

  const categoriesConfigured = () => props.config?.categories && props.config.categories.length > 0;

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div class="px-6 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800">
          {props.nodeExecution.nodeLabel || "信息脱敏"}
        </h2>
        <p class="text-sm text-gray-500 mt-0.5">自动检测并脱敏敏感信息</p>
      </div>

      <div class="p-6 space-y-4">
        {/* Null guard */}
        <Show when={!categoriesConfigured()}>
          <div class="text-center py-8 text-gray-400">
            <div class="text-4xl mb-3">-</div>
            <p class="text-sm">未配置脱敏类别</p>
            <p class="text-xs mt-1 text-gray-300">请在工作流编辑器中配置脱敏类别</p>
          </div>
        </Show>

        <Show when={categoriesConfigured()}>
          {/* Configured categories display */}
          <div class="flex flex-wrap gap-1.5">
            <span class="text-xs text-gray-500 mr-1 leading-6">检测类别：</span>
            <For each={props.config.categories}>
              {(cat) => (
                <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {cat.name}
                </span>
              )}
            </For>
          </div>

          {/* Error display */}
          <Show when={error()}>
            <div class="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">
              {error()}
            </div>
          </Show>

          {/* Phase 1: Detection (auto-triggered, show loading state) */}
          <Show when={phase() === "detect"}>
            <div class="space-y-4">
              <Show when={loading()}>
                <div class="flex flex-col items-center py-12 gap-3">
                  <div class="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p class="text-sm text-gray-500">正在检测敏感信息...</p>
                </div>
              </Show>
              <Show when={!loading()}>
                <div class="space-y-3">
                  <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span class="w-1 h-4 bg-amber-500 rounded-full" />
                    输入文本
                  </h3>
                  <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                    {inputText()}
                  </div>
                  <Show when={!inputText().trim()}>
                    <p class="text-sm text-gray-400 text-center py-4">
                      暂无输入文本，请等待上游节点完成
                    </p>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>

          {/* Phase 2: Review */}
          <Show when={phase() === "review"}>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left panel: highlighted text */}
              <div class="space-y-3">
                <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span class="w-1 h-4 bg-amber-500 rounded-full" />
                  文本预览
                </h3>
                <div class="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                  {renderHighlightedText()}
                </div>

                {/* Sanitized preview */}
                <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2 mt-4">
                  <span class="w-1 h-4 bg-amber-500 rounded-full" />
                  脱敏预览
                </h3>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {getSanitizedPreview()}
                </div>
              </div>

              {/* Right panel: checklist */}
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span class="w-1 h-4 bg-amber-500 rounded-full" />
                    敏感信息审核
                    <span class="text-xs text-gray-400 font-normal">
                      ({items().filter((it) => it.checked).length}/{items().length})
                    </span>
                  </h3>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="text-xs text-amber-600 hover:text-amber-700 font-medium"
                      onClick={() => {
                        setPhase("detect");
                        handleDetect();
                      }}
                    >
                      重新检测
                    </button>
                    <button
                      type="button"
                      class="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      onClick={() => setShowManualAdd(!showManualAdd())}
                    >
                      {showManualAdd() ? "取消" : "手动添加"}
                    </button>
                  </div>
                </div>

                {/* Status summary */}
                <div class="px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-700">
                  <Show when={items().length > 0} fallback={<span>未检测到敏感信息</span>}>
                    已检测到 {items().length} 条敏感信息，已勾选{" "}
                    {items().filter((it) => it.checked).length} 条
                  </Show>
                </div>

                {/* Manual add form */}
                <Show when={showManualAdd()}>
                  <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      placeholder="输入需要脱敏的文本..."
                      class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={manualForm().original}
                      onInput={(e) =>
                        setManualForm((prev) => ({ ...prev, original: e.currentTarget.value }))
                      }
                    />
                    <div class="flex gap-2">
                      <select
                        class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                        class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                        onClick={handleManualAdd}
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </Show>

                {/* Item checklist */}
                <div class="space-y-1 max-h-[500px] overflow-y-auto">
                  <For each={items()}>
                    {(item, index) => (
                      <div
                        class={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          selectedItemIndex() === index()
                            ? "border-amber-400 bg-amber-50"
                            : item.checked
                              ? "border-gray-200 bg-white hover:bg-gray-50"
                              : "border-gray-100 bg-gray-50 opacity-60"
                        }`}
                        onClick={() => setSelectedItemIndex(index())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedItemIndex(index());
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(index())}
                          class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label={`${item.checked ? "保留原文" : "确认脱敏"}: ${maskOriginal(item.original)}`}
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-mono text-gray-700 truncate">
                              {maskOriginal(item.original)}
                            </span>
                            <span
                              class={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeBadgeColor(item.sensitiveType)}`}
                            >
                              {getTypeLabel(item.sensitiveType)}
                            </span>
                          </div>
                          <div class="text-xs text-gray-400 mt-0.5 font-mono">
                            -&gt; {item.placeholder}
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>

                {/* Confirm button */}
                <div class="pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    class="w-full px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 active:bg-amber-800 transition-colors disabled:opacity-50 shadow-sm"
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
