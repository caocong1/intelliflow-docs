import type { DesensitizeConfig, DesensitizeReviewItem, NodeExecution } from "@intelliflow/shared";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { api } from "../../../api/client";
import HighlightedText from "../shared/HighlightedText";
import { getTypeLabel, maskOriginal, typeBadgeClass } from "../shared/desensitize-utils";

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
  onConfirm?: () => void;
}

type Phase = "detect" | "review" | "confirmed";

/** Source entry with computed offset range */
interface SourceOffset {
  outputId: string;
  displayName: string;
  text: string;
  sourceType: "text" | "file" | undefined;
  fileId?: string;
  fileName?: string;
  offsetStart: number;
  offsetEnd: number;
}

/** Per-source detection state with local offsets */
interface SourceDetectionState {
  sourceId: string;
  displayName: string;
  text: string;
  offsetStart: number;
  offsetEnd: number;
  items: DesensitizeReviewItem[];
  sourceType: "text" | "file" | undefined;
  fileId?: string;
  fileName?: string;
}

// Group items by sensitiveType for collapsible category sections
function groupByType(items: DesensitizeReviewItem[]): Record<string, DesensitizeReviewItem[]> {
  const groups: Record<string, DesensitizeReviewItem[]> = {};
  for (const item of items) {
    if (!groups[item.sensitiveType]) groups[item.sensitiveType] = [];
    groups[item.sensitiveType].push(item);
  }
  return groups;
}

/** Check if inputData uses multi-source format */
function isMultiSource(
  inputData: Record<string, unknown> | null,
): inputData is { sources: Record<string, unknown> } {
  return (
    !!inputData &&
    typeof inputData === "object" &&
    "sources" in inputData &&
    typeof inputData.sources === "object"
  );
}

/** Build concatenated text and compute offset ranges for each source */
function buildConcatenatedText(sources: SourceOffset[]): {
  concatenated: string;
  sources: SourceOffset[];
} {
  const parts: string[] = [];
  const updated: SourceOffset[] = [];

  for (const src of sources) {
    if (!src.text?.trim()) continue;
    const offsetStart = parts.join("\n").length;
    parts.push(src.text);
    const offsetEnd = parts.join("\n").length;
    updated.push({ ...src, offsetStart, offsetEnd });
  }

  return { concatenated: parts.join("\n"), sources: updated };
}

/** Attribute global detection items to sources based on offset ranges */
function attributeItemsToSources(
  items: DesensitizeReviewItem[],
  sources: SourceOffset[],
): SourceDetectionState[] {
  return sources.map((src) => {
    const localItems: DesensitizeReviewItem[] = [];

    for (const item of items) {
      if (item.startIndex >= src.offsetStart && item.startIndex < src.offsetEnd) {
        // Convert global offset to local offset within this source
        const localStart = item.startIndex - src.offsetStart;
        const localEnd = item.endIndex - src.offsetStart;
        localItems.push({
          ...item,
          startIndex: localStart,
          endIndex: localEnd,
        });
      }
    }

    return {
      sourceId: src.outputId,
      displayName: src.displayName,
      text: src.text,
      offsetStart: src.offsetStart,
      offsetEnd: src.offsetEnd,
      items: localItems,
      sourceType: src.sourceType,
      fileId: src.fileId,
      fileName: src.fileName,
    };
  });
}

export default function DesensitizeExecutor(props: Props) {
  // Multi-source: parse source entries from inputData
  const multiSource = () =>
    isMultiSource(props.nodeExecution.inputData as Record<string, unknown> | null);
  const sourceEntries = (): SourceOffset[] => {
    const input = props.nodeExecution.inputData as Record<string, unknown> | null;
    if (isMultiSource(input)) {
      const raw = Object.entries(input.sources as Record<string, Record<string, unknown>>);
      // Compute raw offsets (will be recalculated in buildConcatenatedText)
      let offset = 0;
      const results: SourceOffset[] = [];
      for (const [outputId, data] of raw) {
        const text = (data.text as string) ?? "";
        if (!text.trim()) continue;
        results.push({
          outputId,
          displayName: (data.displayName as string) ?? outputId,
          text,
          sourceType: (data.sourceType as "text" | "file" | undefined) ?? undefined,
          fileId: data.fileId as string | undefined,
          fileName: data.fileName as string | undefined,
          offsetStart: offset,
          offsetEnd: offset + text.length,
        });
        offset += text.length + 1; // +1 for newline separator
      }
      return results;
    }
    return [];
  };

  // Determine initial phase from existing outputData
  const initialPhase = (): Phase => {
    const output = props.nodeExecution.outputData as Record<string, unknown> | null;
    if (output && (output.text || output.sources)) {
      return "confirmed";
    }
    // Restore review phase if detection was completed but not yet confirmed
    if (output && output._detectPhase === "detected" && Array.isArray(output._detectedItems)) {
      return "review";
    }
    return "detect";
  };

  const [phase, setPhase] = createSignal<Phase>(initialPhase());
  // Per-source items stored as Map keyed by outputId
  const [sourceItems, setSourceItems] = createSignal<Map<string, DesensitizeReviewItem[]>>(
    new Map(),
  );
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [showManualAdd, setShowManualAdd] = createSignal(false);
  const [manualForm, setManualForm] = createSignal<ManualAddForm>({
    original: "",
    sensitiveType: "person_name",
  });
  const [selectedItemIndex, setSelectedItemIndex] = createSignal<number | null>(null);
  const [collapsedTypes, setCollapsedTypes] = createSignal<Set<string>>(new Set());

  // Sticky nav refs for scroll-into-view
  const sourceRefs = new Map<string, HTMLElement>();

  // onConfirm trigger -- called by parent workspace via onConfirm prop
  const triggerConfirm = () => {
    if (props.onConfirm) {
      props.onConfirm();
    }
  };

  // Auto-detect on mount, or restore cached detection results
  onMount(() => {
    if (phase() === "review") {
      // Restore cached detection items from backend outputData and re-attribute to sources
      const output = props.nodeExecution.outputData as Record<string, unknown> | null;
      const cached = output?._detectedItems as DesensitizeReviewItem[] | undefined;
      if (cached?.length) {
        const sources = sourceEntries();
        if (sources.length > 0) {
          const { sources: updatedSources } = buildConcatenatedText(sources);
          const attributed = attributeItemsToSources(
            cached.map((item) => ({ ...item, checked: true })),
            updatedSources,
          );
          const newMap = new Map<string, DesensitizeReviewItem[]>();
          for (const s of attributed) {
            newMap.set(s.sourceId, s.items);
          }
          setSourceItems(newMap);
        } else {
          setSourceItems(
            new Map([["_single", cached.map((item) => ({ ...item, checked: true }))]]),
          );
        }
      }
    } else if (phase() === "detect" && !props.readOnly) {
      handleDetect();
    }
  });

  // ─── Phase 1: Detection (unified, async with polling) ──────────────────────

  let detectPollTimer: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => {
    if (detectPollTimer) clearInterval(detectPollTimer);
  });

  async function handleDetect() {
    const sources = sourceEntries();
    const hasMultiple = sources.length > 1;

    if (hasMultiple) {
      // Unified detection: concatenate all sources with newline separators
      const { concatenated, sources: updatedSources } = buildConcatenatedText(sources);
      if (!concatenated.trim()) {
        setError("无可检测的输入文本");
        return;
      }
      setLoading(true);
      setError(null);

      try {
        // biome-ignore lint/suspicious/noExplicitAny: matching existing pattern
        const runtimeApi = api.api.runtime as any;
        const res = await runtimeApi[props.documentId].desensitize[
          props.nodeExecution.id
        ].detect.post({ text: concatenated });

        const data = res.data as Record<string, unknown> | null;
        if (data && "error" in data) {
          setError(typeof data.error === "string" ? data.error : "检测失败，请重试");
          setLoading(false);
          return;
        }

        pollDetectStatus(updatedSources);
      } catch {
        setError("检测失败，请重试");
        setLoading(false);
      }
    } else {
      // Single source: original behavior
      const text =
        sources.length === 1
          ? sources[0].text
          : (((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ?? "");
      if (!text.trim()) {
        setError("无可检测的输入文本");
        return;
      }
      setLoading(true);
      setError(null);

      try {
        // biome-ignore lint/suspicious/noExplicitAny: matching existing pattern
        const runtimeApi = api.api.runtime as any;
        const res = await runtimeApi[props.documentId].desensitize[
          props.nodeExecution.id
        ].detect.post({ text });
        const data = res.data as Record<string, unknown> | null;
        if (data && "error" in data) {
          setError(typeof data.error === "string" ? data.error : "检测失败，请重试");
          setLoading(false);
          return;
        }
        pollDetectStatus(
          sources.length === 1 ? [{ ...sources[0], offsetStart: 0, offsetEnd: text.length }] : [],
        );
      } catch {
        setError("检测失败，请重试");
        setLoading(false);
      }
    }
  }

  function pollDetectStatus(sources: SourceOffset[]) {
    if (detectPollTimer) clearInterval(detectPollTimer);

    // biome-ignore lint/suspicious/noExplicitAny: matching existing pattern
    const statusApi = api.api.runtime as any;

    detectPollTimer = setInterval(async () => {
      try {
        const res =
          await statusApi[props.documentId].desensitize[props.nodeExecution.id][
            "detect-status"
          ].get();
        const data = res.data as Record<string, unknown> | null;
        if (!data) return;

        if (data.status === "detected") {
          clearInterval(detectPollTimer);
          detectPollTimer = undefined;
          const detected = (data.items as DesensitizeReviewItem[]).map(
            (item: DesensitizeReviewItem) => ({ ...item, checked: true }),
          );

          if (sources.length > 1) {
            // Attribute items to each source
            const attributed = attributeItemsToSources(detected, sources);
            const newMap = new Map<string, DesensitizeReviewItem[]>();
            for (const s of attributed) {
              newMap.set(s.sourceId, s.items);
            }
            setSourceItems(newMap);
          } else {
            // Single source: store under _single key
            setSourceItems(new Map([["_single", detected]]));
          }

          setPhase("review");
          setLoading(false);
        } else if (data.status === "failed") {
          clearInterval(detectPollTimer);
          detectPollTimer = undefined;
          setError(typeof data.error === "string" ? data.error : "检测失败，请重试");
          setLoading(false);
        }
      } catch {
        clearInterval(detectPollTimer);
        detectPollTimer = undefined;
        setError("检测状态查询失败，请重试");
        setLoading(false);
      }
    }, 2000);
  }

  // ─── Phase 2: Review helpers ──────────────────────────────────────────────

  /** Get all items across all sources (for single-source compatibility) */
  const allItems = createMemo(() => {
    const map = sourceItems();
    if (map.has("_single")) return map.get("_single") as DesensitizeReviewItem[];
    const result: DesensitizeReviewItem[] = [];
    for (const items of map.values()) {
      result.push(...items);
    }
    return result;
  });

  function toggleItemGlobal(globalIndex: number) {
    const map = sourceItems();
    const all = allItems();
    if (globalIndex < 0 || globalIndex >= all.length) return;
    const item = all[globalIndex];
    // Find which source owns this item
    for (const [sourceId, items] of map.entries()) {
      const localIdx = items.indexOf(item);
      if (localIdx >= 0) {
        const newMap = new Map(map);
        newMap.set(
          sourceId,
          items.map((it, i) => (i === localIdx ? { ...it, checked: !it.checked } : it)),
        );
        setSourceItems(newMap);
        return;
      }
    }
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
    const map = sourceItems();
    const all = allItems();
    const text = multiSource()
      ? ""
      : (((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ?? "");
    const sameType = all.filter((it) => it.sensitiveType === form.sensitiveType);
    let maxN = 0;
    for (const item of sameType) {
      const match = item.placeholder.match(/_(\d+)\]$/);
      if (match) maxN = Math.max(maxN, Number.parseInt(match[1], 10));
    }
    const placeholder = `[${form.sensitiveType.toUpperCase()}_${maxN + 1}]`;
    const startIndex = text ? text.indexOf(form.original) : -1;
    const newItem: DesensitizeReviewItem = {
      original: form.original,
      placeholder,
      sensitiveType: form.sensitiveType,
      description: form.sensitiveType,
      startIndex,
      endIndex: startIndex >= 0 ? startIndex + form.original.length : -1,
      checked: true,
    };

    // Add to _single source if available, else first source
    const newMap = new Map(map);
    if (map.has("_single")) {
      newMap.set("_single", [...(map.get("_single") ?? []), newItem]);
    } else if (map.size > 0) {
      const firstKey = map.keys().next().value as string;
      newMap.set(firstKey, [...(map.get(firstKey) ?? []), newItem]);
    } else {
      newMap.set("_single", [newItem]);
    }
    setSourceItems(newMap);
    setManualForm({ original: "", sensitiveType: "person_name" });
    setShowManualAdd(false);
  }

  function getSanitizedPreviewForSource(
    sourceText: string,
    items: DesensitizeReviewItem[],
  ): string {
    let text = sourceText;
    const checked = items
      .filter((it) => it.checked && it.startIndex >= 0)
      .sort((a, b) => b.startIndex - a.startIndex);
    for (const item of checked) {
      text = text.slice(0, item.startIndex) + item.placeholder + text.slice(item.endIndex);
    }
    return text;
  }

  // Build confirm body — used internally and exposed via onConfirm prop
  async function buildAndSubmitConfirm() {
    const map = sourceItems();
    const sources = sourceEntries();
    const confirmedSources: Record<
      string,
      {
        displayName: string;
        items: Array<{ original: string; placeholder: string; sensitiveType: string }>;
        sanitizedText: string;
        reviewSummary: Array<{ placeholder: string; sensitiveType: string; checked: boolean }>;
      }
    > = {};

    if (multiSource() && sources.length > 0) {
      for (const src of sources) {
        const items = map.get(src.outputId) ?? [];
        const confirmed = items.filter((it) => it.checked);
        const sanitized = getSanitizedPreviewForSource(src.text, items);
        confirmedSources[src.outputId] = {
          displayName: src.displayName,
          items: confirmed.map((it) => ({
            original: it.original,
            placeholder: it.placeholder,
            sensitiveType: it.sensitiveType,
          })),
          sanitizedText: sanitized,
          reviewSummary: items.map((it) => ({
            placeholder: it.placeholder,
            sensitiveType: it.sensitiveType,
            checked: it.checked,
          })),
        };
      }
    } else {
      const items = map.get("_single") ?? [];
      const confirmed = items.filter((it) => it.checked);
      const text =
        ((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ?? "";
      const sanitized = getSanitizedPreviewForSource(text, items);
      confirmedSources._default = {
        displayName: "Default",
        items: confirmed.map((it) => ({
          original: it.original,
          placeholder: it.placeholder,
          sensitiveType: it.sensitiveType,
        })),
        sanitizedText: sanitized,
        reviewSummary: items.map((it) => ({
          placeholder: it.placeholder,
          sensitiveType: it.sensitiveType,
          checked: it.checked,
        })),
      };
    }

    // Collect all confirmed items globally for the legacy items field
    const allItems_ = allItems();
    const confirmed = allItems_.filter((it) => it.checked);
    const globalSanitized =
      sources.length > 1
        ? sources
            .map((s) => getSanitizedPreviewForSource(s.text, map.get(s.outputId) ?? []))
            .join("\n")
        : getSanitizedPreviewForSource(
            ((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ?? "",
            map.get("_single") ?? [],
          );

    setLoading(true);
    setError(null);

    try {
      // biome-ignore lint/suspicious/noExplicitAny: matching existing pattern
      const runtimeApi = api.api.runtime as any;
      const res = await runtimeApi[props.documentId].desensitize[
        props.nodeExecution.id
      ].confirm.post({
        items: confirmed.map((it) => ({
          original: it.original,
          placeholder: it.placeholder,
          sensitiveType: it.sensitiveType,
        })),
        sanitizedText: globalSanitized,
        reviewSummary: allItems_.map((it) => ({
          placeholder: it.placeholder,
          sensitiveType: it.sensitiveType,
          checked: it.checked,
        })),
        sources: confirmedSources,
      });

      const data = res.data as Record<string, unknown> | null;
      if (data && !("error" in data)) {
        setPhase("confirmed");
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

  function renderHighlightedTextForSource(sourceText: string, items: DesensitizeReviewItem[]) {
    const checked = items
      .filter((it) => it.checked && it.startIndex >= 0)
      .sort((a, b) => a.startIndex - b.startIndex);

    if (checked.length === 0) {
      return <span>{sourceText}</span>;
    }

    const parts: Array<{ text: string; isHighlight: boolean; itemIndex: number }> = [];
    let lastEnd = 0;

    for (const item of checked) {
      if (item.startIndex > lastEnd) {
        parts.push({
          text: sourceText.slice(lastEnd, item.startIndex),
          isHighlight: false,
          itemIndex: -1,
        });
      }
      const originalIndex = items.indexOf(item);
      parts.push({ text: item.original, isHighlight: true, itemIndex: originalIndex });
      lastEnd = item.endIndex;
    }

    if (lastEnd < sourceText.length) {
      parts.push({ text: sourceText.slice(lastEnd), isHighlight: false, itemIndex: -1 });
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
              title={items[part.itemIndex]?.placeholder}
            >
              {part.text}
            </span>
          </Show>
        )}
      </For>
    );
  }

  // ─── Read-only / confirmed mode ────────────────────────────────────────────

  if (props.readOnly || phase() === "confirmed") {
    const outputData = props.nodeExecution.outputData as Record<string, unknown> | null;
    const outputText = (outputData?.text as string) ?? "";
    const mappingCount = (outputData?.mappingCount as number) ?? 0;
    const outputSources = outputData?.sources as
      | Record<string, { displayName: string; desensitizedText: string }>
      | undefined;
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
          <Show
            when={hasMultiOutput}
            fallback={
              <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                {outputText}
              </div>
            }
          >
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

  // ─── Review panel helper for a given list of items ────────────────────────

  function renderReviewPanelForSource(sourceId: string, sourceText: string) {
    const srcItems = createMemo(() => sourceItems().get(sourceId) ?? []);
    return (
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[#464555]">敏感信息审核</span>
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
        <div class="space-y-2 max-h-[400px] overflow-y-auto pr-0.5">
          <For each={Object.entries(groupByType(srcItems()))}>
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
                      <button
                        type="button"
                        class="text-[10px] text-[#4f46e5] hover:text-[#3525cd] font-medium ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          const allChecked = typeItems.every((it) => it.checked);
                          const map = sourceItems();
                          const newMap = new Map(map);
                          const items = [...(map.get(sourceId) ?? [])];
                          newMap.set(
                            sourceId,
                            items.map((it) =>
                              it.sensitiveType === type ? { ...it, checked: !allChecked } : it,
                            ),
                          );
                          setSourceItems(newMap);
                        }}
                      >
                        {typeItems.every((it) => it.checked) ? "全不选" : "全选"}
                      </button>
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
                          const localIndex = () => srcItems().indexOf(item);
                          const globalIndex = () => allItems().indexOf(item);
                          return (
                            <div
                              class={`flex items-center gap-3 px-3 py-2.5 bg-white cursor-pointer transition-colors ${
                                selectedItemIndex() === globalIndex()
                                  ? "bg-[#f0efff]"
                                  : "hover:bg-[#fafafe]"
                              } ${!item.checked ? "opacity-50" : ""}`}
                              onClick={() => setSelectedItemIndex(globalIndex())}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ")
                                  setSelectedItemIndex(globalIndex());
                              }}
                            >
                              <div class="flex-1 min-w-0 flex items-center gap-2 text-sm">
                                <span class="font-mono text-red-400 line-through truncate">
                                  {maskOriginal(item.original)}
                                </span>
                                <span class="text-[#9fa0a8] flex-shrink-0">→</span>
                                <span class="font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs truncate">
                                  {item.placeholder}
                                </span>
                              </div>
                              <button
                                type="button"
                                aria-label={item.checked ? "禁用此项脱敏" : "启用此项脱敏"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const map = sourceItems();
                                  const newMap = new Map(map);
                                  const items = [...(map.get(sourceId) ?? [])];
                                  items[localIndex()] = {
                                    ...items[localIndex()],
                                    checked: !items[localIndex()].checked,
                                  };
                                  newMap.set(sourceId, items);
                                  setSourceItems(newMap);
                                }}
                                class={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${
                                  item.checked ? "bg-[#4f46e5]" : "bg-[#e6e8ea]"
                                }`}
                              >
                                <span
                                  class={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
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
      </div>
    );
  }

  function renderReviewPanel(items: DesensitizeReviewItem[]) {
    return (
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
          <For each={Object.entries(groupByType(items))}>
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
                      <button
                        type="button"
                        class="text-[10px] text-[#4f46e5] hover:text-[#3525cd] font-medium ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          const allChecked = typeItems.every((it) => it.checked);
                          const map = sourceItems();
                          const newMap = new Map(map);
                          if (map.has("_single")) {
                            newMap.set(
                              "_single",
                              items.map((it) =>
                                it.sensitiveType === type ? { ...it, checked: !allChecked } : it,
                              ),
                            );
                          }
                          setSourceItems(newMap);
                        }}
                      >
                        {typeItems.every((it) => it.checked) ? "全不选" : "全选"}
                      </button>
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
                          const globalIndex = () => allItems().indexOf(item);
                          return (
                            <div
                              class={`flex items-center gap-3 px-3 py-2.5 bg-white cursor-pointer transition-colors ${
                                selectedItemIndex() === globalIndex()
                                  ? "bg-[#f0efff]"
                                  : "hover:bg-[#fafafe]"
                              } ${!item.checked ? "opacity-50" : ""}`}
                              onClick={() => setSelectedItemIndex(globalIndex())}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ")
                                  setSelectedItemIndex(globalIndex());
                              }}
                            >
                              <div class="flex-1 min-w-0 flex items-center gap-2 text-sm">
                                <span class="font-mono text-red-400 line-through truncate">
                                  {maskOriginal(item.original)}
                                </span>
                                <span class="text-[#9fa0a8] flex-shrink-0">→</span>
                                <span class="font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs truncate">
                                  {item.placeholder}
                                </span>
                              </div>
                              <button
                                type="button"
                                aria-label={item.checked ? "禁用此项脱敏" : "启用此项脱敏"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleItemGlobal(globalIndex());
                                }}
                                class={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${
                                  item.checked ? "bg-[#4f46e5]" : "bg-[#e6e8ea]"
                                }`}
                              >
                                <span
                                  class={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
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
      </div>
    );
  }

  // ─── Null guard: no categories configured ─────────────────────────────────

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

          {/* Sticky anchor nav bar (multi-source vertical layout) */}
          <Show when={multiSource() && sourceEntries().length > 1}>
            <div class="sticky top-0 z-10 bg-[#f7f9fb] rounded-xl px-3 py-2 flex flex-wrap gap-1 items-center shadow-sm">
              <span class="text-xs text-[#9fa0a8] pr-1">来源：</span>
              <For each={sourceEntries()}>
                {(src) => (
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-white text-[#191c1e] shadow-sm hover:bg-[#f0efff]"
                    onClick={() => {
                      const el = sourceRefs.get(src.outputId);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
              {/* Scanning animation: pulse shield + progress */}
              <div class="bg-[#fff7ed] rounded-xl px-5 py-4 space-y-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center animate-pulse flex-shrink-0">
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="1.8"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                      />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm text-amber-800 font-semibold">正在扫描敏感信息...</span>
                    <p class="text-xs text-amber-600 mt-0.5">
                      检测类别：{props.config.categories.map((c) => c.name).join("、")}
                    </p>
                  </div>
                </div>
                <div class="h-1 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-amber-500 rounded-full animate-pulse"
                    style={{ width: "75%" }}
                  />
                </div>
              </div>
            </Show>
            <Show when={!loading()}>
              <div class="space-y-3">
                <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
                  <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                  输入文本
                </h3>
                <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  <Show
                    when={multiSource() && sourceEntries().length > 1}
                    fallback={
                      <span>
                        {((props.nodeExecution.inputData as Record<string, unknown>)
                          ?.text as string) ?? ""}
                      </span>
                    }
                  >
                    {/* Vertical stacked sources */}
                    <div class="space-y-4">
                      <For each={sourceEntries()}>
                        {(src) => (
                          <div>
                            <p class="text-xs font-medium text-[#464555] mb-1">{src.displayName}</p>
                            <div class="text-sm whitespace-pre-wrap">{src.text}</div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
                <Show
                  when={
                    !multiSource() &&
                    !(
                      (props.nodeExecution.inputData as Record<string, unknown>)?.text as string
                    )?.trim()
                  }
                >
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
                  检测完成，共发现 {allItems().length} 项敏感信息
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

            {/* Stats cards */}
            {(() => {
              const checkedCount = createMemo(() => allItems().filter((it) => it.checked).length);
              const skippedCount = createMemo(() => allItems().filter((it) => !it.checked).length);
              return (
                <div class="grid grid-cols-3 gap-3">
                  <div class="rounded-xl px-4 py-3 bg-[#f7f9fb]">
                    <p class="text-[10px] font-medium text-[#777587] uppercase tracking-wide mb-1">
                      检测总数
                    </p>
                    <p class="text-2xl font-bold text-[#191c1e]">{allItems().length}</p>
                  </div>
                  <div class="rounded-xl px-4 py-3 bg-emerald-50">
                    <p class="text-[10px] font-medium text-emerald-600 uppercase tracking-wide mb-1">
                      已选脱敏
                    </p>
                    <p class="text-2xl font-bold text-emerald-700">{checkedCount()}</p>
                  </div>
                  <div class="rounded-xl px-4 py-3 bg-slate-50">
                    <p class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                      已跳过
                    </p>
                    <p class="text-2xl font-bold text-slate-600">{skippedCount()}</p>
                  </div>
                </div>
              );
            })()}

            {/* Vertical source cards layout */}
            <Show
              when={multiSource() && sourceEntries().length > 1}
              fallback={
                /* Single-source / legacy layout */
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left: highlighted text */}
                  <div class="space-y-3">
                    <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
                      <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                      文本预览
                    </h3>
                    <div class="bg-white border border-[rgba(199,196,216,0.35)] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                      {multiSource()
                        ? renderHighlightedTextForSource("", sourceItems().get("_single") ?? [])
                        : renderHighlightedTextForSource(
                            ((props.nodeExecution.inputData as Record<string, unknown>)
                              ?.text as string) ?? "",
                            sourceItems().get("_single") ?? [],
                          )}
                    </div>

                    <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2 mt-4">
                      <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                      脱敏预览
                    </h3>
                    <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm text-[#464555] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      <Show
                        when={multiSource()}
                        fallback={
                          <HighlightedText
                            text={getSanitizedPreviewForSource(
                              ((props.nodeExecution.inputData as Record<string, unknown>)
                                ?.text as string) ?? "",
                              sourceItems().get("_single") ?? [],
                            )}
                          />
                        }
                      >
                        <HighlightedText
                          text={getSanitizedPreviewForSource(
                            "",
                            sourceItems().get("_single") ?? [],
                          )}
                        />
                      </Show>
                    </div>
                  </div>

                  {/* Right: category sections + checklist */}
                  {renderReviewPanel(sourceItems().get("_single") ?? [])}
                </div>
              }
            >
              {/* Multi-source vertical layout */}
              <For each={sourceEntries()}>
                {(src) => {
                  const srcItems = createMemo(() => sourceItems().get(src.outputId) ?? []);
                  return (
                    <div
                      class="rounded-xl border border-[rgba(199,196,216,0.25)] overflow-hidden"
                      ref={(el: HTMLElement) => {
                        sourceRefs.set(src.outputId, el);
                      }}
                    >
                      {/* Source card header */}
                      <div class="px-4 py-2.5 bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.15)]">
                        <span class="text-xs font-medium text-[#464555]">{src.displayName}</span>
                      </div>

                      {/* Source content: highlighted text + review */}
                      <div class="p-4 space-y-3">
                        {/* Highlighted text */}
                        <div class="bg-white border border-[rgba(199,196,216,0.35)] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                          {renderHighlightedTextForSource(src.text, srcItems())}
                        </div>

                        {/* Per-source stats */}
                        <div class="grid grid-cols-3 gap-2">
                          <div class="rounded-lg px-3 py-1.5 bg-[#f7f9fb]">
                            <p class="text-[10px] text-[#777587]">检测</p>
                            <p class="text-base font-bold text-[#191c1e]">{srcItems().length}</p>
                          </div>
                          <div class="rounded-lg px-3 py-1.5 bg-emerald-50">
                            <p class="text-[10px] text-emerald-600">已选</p>
                            <p class="text-base font-bold text-emerald-700">
                              {srcItems().filter((it) => it.checked).length}
                            </p>
                          </div>
                          <div class="rounded-lg px-3 py-1.5 bg-slate-50">
                            <p class="text-[10px] text-slate-500">跳过</p>
                            <p class="text-base font-bold text-slate-600">
                              {srcItems().filter((it) => !it.checked).length}
                            </p>
                          </div>
                        </div>

                        {/* Review panel for this source */}
                        <Show
                          when={srcItems().length > 0}
                          fallback={
                            <p class="text-xs text-[#9fa0a8] text-center py-2">
                              该来源未检测到敏感信息
                            </p>
                          }
                        >
                          {renderReviewPanelForSource(src.outputId, src.text)}
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>

            {/* Summary bar (no confirm button - parent ActionBar handles it via onConfirm) */}
            <div class="pt-3 border-t border-[rgba(199,196,216,0.2)]">
              <div class="flex items-center justify-between text-xs text-[#464555]">
                <span>
                  已选择{" "}
                  <span class="font-semibold text-[#191c1e]">
                    {allItems().filter((it) => it.checked).length}
                  </span>{" "}
                  / {allItems().length} 项
                </span>
                <Show when={allItems().filter((it) => it.checked).length === 0}>
                  <span class="text-amber-600">请至少选择一项进行脱敏</span>
                </Show>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
