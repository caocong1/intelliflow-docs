import type { DesensitizeConfig, DesensitizeReviewItem, NodeExecution } from "@intelliflow/shared";
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
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
  registerConfirmAction?: (action: (() => Promise<boolean>) | null) => void;
}

type Phase = "detect" | "review" | "confirmed";
type PreviewMode = "original" | "sanitized" | "compare";

interface SourceEntry {
  outputId: string;
  displayName: string;
  text: string;
  sourceType: "text" | "file" | undefined;
  fileId?: string;
  fileName?: string;
}

interface SourceOffset extends SourceEntry {
  offsetStart: number;
  offsetEnd: number;
}

interface SourceGroup {
  baseOutputId: string;
  displayName: string;
  sources: SourceEntry[];
  isFileGroup: boolean;
}

function groupByType(items: DesensitizeReviewItem[]): Record<string, DesensitizeReviewItem[]> {
  const groups: Record<string, DesensitizeReviewItem[]> = {};
  for (const item of items) {
    if (!groups[item.sensitiveType]) groups[item.sensitiveType] = [];
    groups[item.sensitiveType].push(item);
  }
  return groups;
}

function isMultiSource(inputData: Record<string, unknown> | null): boolean {
  return (
    !!inputData &&
    typeof inputData === "object" &&
    "sources" in inputData &&
    typeof (inputData as Record<string, unknown>).sources === "object"
  );
}

function getBaseOutputId(outputId: string): string {
  return outputId.split("::file::")[0] ?? outputId;
}

function buildConcatenatedText(sources: SourceEntry[]): {
  concatenated: string;
  sources: SourceOffset[];
} {
  const parts: string[] = [];
  const updated: SourceOffset[] = [];
  let currentOffset = 0;

  for (const source of sources) {
    if (!source.text.trim()) continue;
    if (parts.length > 0) {
      currentOffset += 1; // \n separator
    }
    const offsetStart = currentOffset;
    parts.push(source.text);
    currentOffset += source.text.length;
    updated.push({
      ...source,
      offsetStart,
      offsetEnd: currentOffset,
    });
  }

  return { concatenated: parts.join("\n"), sources: updated };
}

function attributeItemsToSources(
  detectedItems: DesensitizeReviewItem[],
  sources: SourceOffset[],
): Record<string, DesensitizeReviewItem[]> {
  const itemsBySource: Record<string, DesensitizeReviewItem[]> = {};

  for (const source of sources) {
    itemsBySource[source.outputId] = [];
  }

  for (const item of detectedItems) {
    const matchedSource = sources.find(
      (source) => item.startIndex >= source.offsetStart && item.startIndex < source.offsetEnd,
    );
    if (!matchedSource) continue;

    itemsBySource[matchedSource.outputId] ??= [];
    itemsBySource[matchedSource.outputId].push({
      ...item,
      startIndex: item.startIndex - matchedSource.offsetStart,
      endIndex: item.endIndex - matchedSource.offsetStart,
    });
  }

  return itemsBySource;
}

export default function DesensitizeExecutor(props: Props) {
  const multiSource = () =>
    isMultiSource(props.nodeExecution.inputData as Record<string, unknown> | null);

  const sourceEntries = createMemo<SourceEntry[]>(() => {
    const input = props.nodeExecution.inputData as Record<string, unknown> | null;
    if (!isMultiSource(input)) return [];

    return Object.entries((input as Record<string, Record<string, unknown>>).sources)
      .map(([outputId, data]) => {
        const source = data as Record<string, unknown>;
        return {
          outputId,
          displayName: (source.displayName as string) ?? outputId,
          text: (source.text as string) ?? "",
          sourceType: (source.sourceType as "text" | "file" | undefined) ?? undefined,
          fileId: source.fileId as string | undefined,
          fileName: source.fileName as string | undefined,
        };
      })
      .filter((source) => source.text.trim());
  });

  const initialPhase = (): Phase => {
    const output = props.nodeExecution.outputData as Record<string, unknown> | null;
    if (output?.confirmedAt || props.nodeExecution.status === "completed") return "confirmed";
    if (output && output._detectPhase === "detected" && Array.isArray(output._detectedItems))
      return "review";
    return "detect";
  };

  const [phase, setPhase] = createSignal<Phase>(initialPhase());
  const [items, setItems] = createSignal<DesensitizeReviewItem[]>([]);
  const [itemsBySource, setItemsBySource] = createSignal<Record<string, DesensitizeReviewItem[]>>(
    {},
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
  const [activeGroupIndex, setActiveGroupIndex] = createSignal(0);
  const [activeFileIndex, setActiveFileIndex] = createSignal(0);
  const [previewMode, setPreviewMode] = createSignal<PreviewMode>("sanitized");
  const [navIndex, setNavIndex] = createSignal(-1);

  const sourceGroups = createMemo<SourceGroup[]>(() => {
    const groups = new Map<string, SourceGroup>();

    for (const source of sourceEntries()) {
      const baseOutputId = getBaseOutputId(source.outputId);
      const existing = groups.get(baseOutputId);
      if (existing) {
        existing.sources.push(source);
        existing.isFileGroup = existing.isFileGroup || source.sourceType === "file";
        continue;
      }

      const configuredDisplayName = props.config.inputSources?.find(
        (input) => input.outputId === baseOutputId,
      )?.displayName;
      groups.set(baseOutputId, {
        baseOutputId,
        displayName: configuredDisplayName ?? source.displayName,
        sources: [source],
        isFileGroup: source.sourceType === "file",
      });
    }

    return [...groups.values()];
  });

  const currentGroup = createMemo(() => {
    const groups = sourceGroups();
    const index = activeGroupIndex();
    if (index >= 0 && index < groups.length) return groups[index];
    return groups[0];
  });

  const currentSource = createMemo(() => {
    const group = currentGroup();
    if (!group) return undefined;
    const index = activeFileIndex();
    if (index >= 0 && index < group.sources.length) return group.sources[index];
    return group.sources[0];
  });

  const currentSourceKey = createMemo(() => currentSource()?.outputId ?? "__single__");

  const currentText = createMemo(() => {
    if (multiSource()) return currentSource()?.text ?? "";
    return ((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ?? "";
  });

  const detectedCount = createMemo(() =>
    Object.values(itemsBySource()).reduce((sum, current) => sum + current.length, 0),
  );
  const selectedCount = createMemo(() =>
    Object.values(itemsBySource()).reduce(
      (sum, current) => sum + current.filter((item) => item.checked).length,
      0,
    ),
  );
  const skippedCount = createMemo(() => detectedCount() - selectedCount());

  const checkedIndices = createMemo(() =>
    items()
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.checked && item.startIndex >= 0)
      .sort((a, b) => a.item.startIndex - b.item.startIndex)
      .map(({ idx }) => idx),
  );

  function navigateItem(direction: "next" | "prev") {
    const indices = checkedIndices();
    if (indices.length === 0) return;

    const current = navIndex();
    let next: number;
    if (current < 0 || current >= indices.length) {
      next = direction === "next" ? 0 : indices.length - 1;
    } else {
      next =
        direction === "next"
          ? (current + 1) % indices.length
          : (current - 1 + indices.length) % indices.length;
    }

    setNavIndex(next);
    setSelectedItemIndex(indices[next]);

    requestAnimationFrame(() => {
      const itemIndex = indices[next];
      const el =
        document.querySelector(`[data-item-index="${itemIndex}"]`) ??
        document.querySelector(`[data-placeholder="${items()[itemIndex]?.placeholder}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function cacheItems(nextItemsBySource: Record<string, DesensitizeReviewItem[]>) {
    setItemsBySource(nextItemsBySource);
    setItems(nextItemsBySource[currentSourceKey()] ?? []);
  }

  function updateCurrentItems(
    updater: DesensitizeReviewItem[] | ((prev: DesensitizeReviewItem[]) => DesensitizeReviewItem[]),
  ) {
    const sourceKey = currentSourceKey();
    const nextItems = typeof updater === "function" ? updater(items()) : updater;
    setItems(nextItems);
    setItemsBySource((prev) => ({
      ...prev,
      [sourceKey]: nextItems,
    }));
  }

  createEffect(
    on(
      () => props.nodeExecution.id,
      (nodeExecutionId) => {
        const nextPhase = initialPhase();
        console.warn("[desensitize:init]", {
          documentId: props.documentId,
          nodeExecutionId,
          nextPhase,
          readOnly: props.readOnly,
          sourceCount: sourceEntries().length,
          hasOutputData: !!props.nodeExecution.outputData,
        });
        setPhase(nextPhase);
        setError(null);
        setShowManualAdd(false);
        setSelectedItemIndex(null);
        setCollapsedTypes(new Set());
        setActiveGroupIndex(0);
        setActiveFileIndex(0);
        setPreviewMode("sanitized");
        setNavIndex(-1);

        if (nextPhase === "review") {
          const output = props.nodeExecution.outputData as Record<string, unknown> | null;
          const cached = output?._detectedItems as DesensitizeReviewItem[] | undefined;
          if (cached?.length) {
            const allSources = sourceEntries();
            if (allSources.length > 0) {
              const { sources } = buildConcatenatedText(allSources);
              cacheItems(
                attributeItemsToSources(
                  cached.map((item) => ({ ...item, checked: true })),
                  sources,
                ),
              );
            } else {
              const initialItems = cached.map((item) => ({ ...item, checked: true }));
              setItems(initialItems);
              setItemsBySource({ [currentSourceKey()]: initialItems });
            }
          } else {
            setItems([]);
            setItemsBySource({});
          }
          return;
        }

        if (nextPhase === "confirmed") {
          setItems([]);
          setItemsBySource({});
          return;
        }

        setItems([]);
        setItemsBySource({});
        if (!props.readOnly) {
          queueMicrotask(() => {
            void handleDetect();
          });
        } else {
          setLoading(false);
        }
      },
      { defer: false },
    ),
  );

  createEffect(() => {
    setSelectedItemIndex(null);
    setNavIndex(-1);
    setItems(itemsBySource()[currentSourceKey()] ?? []);
  });

  createEffect(() => {
    const idx = selectedItemIndex();
    if (idx === null) return;
    queueMicrotask(() => {
      const el = document.querySelector(`[data-item-index="${idx}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  let detectPollTimer: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => {
    if (detectPollTimer) clearInterval(detectPollTimer);
    props.registerConfirmAction?.(null);
  });

  async function handleDetect() {
    const allSources = sourceEntries();
    const { concatenated, sources } = buildConcatenatedText(allSources);
    const singleText =
      allSources[0]?.text ??
      ((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ??
      "";
    const text = allSources.length > 1 ? concatenated : singleText;

    if (!text.trim()) {
      setError("无可检测的输入文本");
      return;
    }

    console.warn("[desensitize:detect] start", {
      documentId: props.documentId,
      nodeExecutionId: props.nodeExecution.id,
      sourceCount: allSources.length,
      textLength: text.length,
    });

    setLoading(true);
    setError(null);

    try {
      const runtimeApi = api.api.runtime as any;
      console.warn("[desensitize:detect] runtime-path", {
        hasRuntimeApi: !!runtimeApi,
        hasDocumentApi: !!runtimeApi?.[props.documentId],
        hasDesensitizeApi: !!runtimeApi?.[props.documentId]?.desensitize,
        hasNodeApi: !!runtimeApi?.[props.documentId]?.desensitize?.[props.nodeExecution.id],
      });

      const res = await runtimeApi[props.documentId].desensitize[
        props.nodeExecution.id
      ].detect.post({ text });
      const data = res.data as Record<string, unknown> | null;
      if (data && "error" in data) {
        setError(typeof data.error === "string" ? data.error : "检测失败，请重试");
        setLoading(false);
        return;
      }
      pollDetectStatus(sources);
    } catch (error) {
      console.error("[desensitize:detect] failed", {
        documentId: props.documentId,
        nodeExecutionId: props.nodeExecution.id,
        error,
      });
      setError("检测失败，请重试");
      setLoading(false);
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

          if (sources.length > 0) {
            cacheItems(attributeItemsToSources(detected, sources));
          } else {
            setItems(detected);
            setItemsBySource({ [currentSourceKey()]: detected });
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

  function toggleItem(index: number) {
    updateCurrentItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)),
    );
  }

  function toggleTypeCollapsed(type: string) {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function handleManualAdd() {
    const form = manualForm();
    if (!form.original.trim()) return;

    const text = currentText();
    const sameType = items().filter((item) => item.sensitiveType === form.sensitiveType);
    let maxN = 0;
    for (const item of sameType) {
      const match = item.placeholder.match(/_(\d+)\]$/);
      if (match) maxN = Math.max(maxN, Number.parseInt(match[1], 10));
    }

    const placeholder = `[${form.sensitiveType.toUpperCase()}_${maxN + 1}]`;
    const startIndex = text.indexOf(form.original);
    const newItem: DesensitizeReviewItem = {
      original: form.original,
      placeholder,
      sensitiveType: form.sensitiveType,
      description: form.sensitiveType,
      startIndex,
      endIndex: startIndex >= 0 ? startIndex + form.original.length : -1,
      checked: true,
    };

    updateCurrentItems((prev) => [...prev, newItem]);
    setManualForm({ original: "", sensitiveType: "person_name" });
    setShowManualAdd(false);
  }

  function getSanitizedPreviewForSource(sourceText: string, sourceItems: DesensitizeReviewItem[]) {
    let text = sourceText;
    const checked = sourceItems
      .filter((item) => item.checked && item.startIndex >= 0)
      .sort((a, b) => b.startIndex - a.startIndex);

    for (const item of checked) {
      text = text.slice(0, item.startIndex) + item.placeholder + text.slice(item.endIndex);
    }

    return text;
  }

  function getSanitizedPreview() {
    return getSanitizedPreviewForSource(currentText(), items());
  }

  async function buildAndSubmitConfirm() {
    const allSources = sourceEntries();
    const confirmedSources: Record<
      string,
      {
        displayName: string;
        items: Array<{ original: string; placeholder: string; sensitiveType: string }>;
        sanitizedText: string;
        reviewSummary: Array<{ placeholder: string; sensitiveType: string; checked: boolean }>;
      }
    > = {};

    for (const source of allSources) {
      const sourceItems = itemsBySource()[source.outputId] ?? [];
      const confirmedItems = sourceItems.filter((item) => item.checked);
      confirmedSources[source.outputId] = {
        displayName: source.displayName,
        items: confirmedItems.map((item) => ({
          original: item.original,
          placeholder: item.placeholder,
          sensitiveType: item.sensitiveType,
        })),
        sanitizedText: getSanitizedPreviewForSource(source.text, sourceItems),
        reviewSummary: sourceItems.map((item) => ({
          placeholder: item.placeholder,
          sensitiveType: item.sensitiveType,
          checked: item.checked,
        })),
      };
    }

    const allDetectedItems = Object.values(itemsBySource()).flat();
    const confirmedItems = allDetectedItems.filter((item) => item.checked);
    const globalSanitized =
      allSources.length > 0
        ? allSources
            .map((source) =>
              getSanitizedPreviewForSource(source.text, itemsBySource()[source.outputId] ?? []),
            )
            .join("\n")
        : getSanitizedPreviewForSource(
            ((props.nodeExecution.inputData as Record<string, unknown>)?.text as string) ?? "",
            items(),
          );

    setLoading(true);
    setError(null);

    try {
      // biome-ignore lint/suspicious/noExplicitAny: matching existing pattern
      const runtimeApi = api.api.runtime as any;
      const res = await runtimeApi[props.documentId].desensitize[
        props.nodeExecution.id
      ].confirm.post({
        items: confirmedItems.map((item) => ({
          original: item.original,
          placeholder: item.placeholder,
          sensitiveType: item.sensitiveType,
        })),
        sanitizedText: globalSanitized,
        reviewSummary: allDetectedItems.map((item) => ({
          placeholder: item.placeholder,
          sensitiveType: item.sensitiveType,
          checked: item.checked,
        })),
        sources: confirmedSources,
      });

      const data = res.data as Record<string, unknown> | null;
      if (data && !("error" in data)) {
        setPhase("confirmed");
        return;
      }

      const errorMessage = data?.error;
      throw new Error(typeof errorMessage === "string" ? errorMessage : "确认失败，请重试");
    } catch (error) {
      const message = error instanceof Error ? error.message : "确认失败，请重试";
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    props.registerConfirmAction?.(
      phase() === "review"
        ? async () => {
            await buildAndSubmitConfirm();
            return true;
          }
        : null,
    );
  });

  function renderHighlightedText() {
    const text = currentText();
    const checked = items()
      .filter((item) => item.checked && item.startIndex >= 0)
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
              data-item-index={part.itemIndex}
              class={`px-0.5 rounded cursor-pointer transition-colors ${selectedItemIndex() === part.itemIndex ? "bg-amber-400 ring-2 ring-amber-500" : "bg-amber-200 hover:bg-amber-300"}`}
              onClick={() => setSelectedItemIndex(part.itemIndex)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedItemIndex(part.itemIndex);
                }
              }}
              title={items()[part.itemIndex]?.placeholder}
              tabindex="0"
            >
              {part.text}
            </span>
          </Show>
        )}
      </For>
    );
  }

  function renderPreviewModeToggle() {
    const options: Array<{ id: PreviewMode; label: string }> = [
      { id: "original", label: "原文" },
      { id: "sanitized", label: "脱敏后" },
      { id: "compare", label: "对比" },
    ];

    return (
      <div class="inline-flex items-center rounded-xl border border-[rgba(199,196,216,0.35)] bg-white p-1">
        <For each={options}>
          {(option) => (
            <button
              type="button"
              class={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                previewMode() === option.id
                  ? "bg-[#f0efff] text-[#4f46e5]"
                  : "text-[#777587] hover:text-[#464555]"
              }`}
              onClick={() => setPreviewMode(option.id)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
    );
  }

  function renderLineAlignedCompare(
    origText: string,
    sanText: string,
    origLineRenderer?: (line: string, lineOffset: number) => ReturnType<typeof HighlightedText>,
  ) {
    const origLines = origText.split("\n");
    const sanLines = sanText.split("\n");
    const lineCount = Math.max(origLines.length, sanLines.length);
    const lineIndices = Array.from({ length: lineCount }, (_, i) => i);

    // Compute cumulative line start offsets for highlight index mapping
    const lineOffsets: number[] = [];
    let off = 0;
    for (const line of origLines) {
      lineOffsets.push(off);
      off += line.length + 1;
    }

    const renderOrig = origLineRenderer ?? ((line: string) => <span>{line}</span>);

    return (
      <div class="space-y-2">
        <div class="grid grid-cols-2 gap-4">
          <h4 class="text-xs font-semibold text-[#464555] uppercase tracking-wide">原文</h4>
          <h4 class="text-xs font-semibold text-[#464555] uppercase tracking-wide">脱敏后</h4>
        </div>
        <div class="max-h-[500px] overflow-y-auto bg-white border border-[rgba(199,196,216,0.35)] rounded-xl p-4">
          <div class="grid grid-cols-2 gap-x-4">
            <For each={lineIndices}>
              {(i) => (
                <>
                  <div class="text-sm text-[#191c1e] min-h-[1.5em] leading-relaxed min-w-0 overflow-hidden">
                    {renderOrig(origLines[i] ?? "", lineOffsets[i] ?? 0)}
                  </div>
                  <div class="text-sm text-[#191c1e] min-h-[1.5em] leading-relaxed min-w-0 overflow-hidden">
                    <HighlightedText text={sanLines[i] ?? ""} />
                  </div>
                </>
              )}
            </For>
          </div>
        </div>
      </div>
    );
  }

  function highlightOriginalLine(line: string, lineOffset: number) {
    const lineEnd = lineOffset + line.length;
    const checkedItems = items()
      .filter((item) => item.checked && item.startIndex >= 0)
      .filter((item) => item.endIndex > lineOffset && item.startIndex < lineEnd)
      .sort((a, b) => a.startIndex - b.startIndex);

    if (checkedItems.length === 0) return <span>{line}</span>;

    const parts: Array<{ text: string; isHighlight: boolean; itemIndex: number }> = [];
    let pos = 0;

    for (const item of checkedItems) {
      const relStart = Math.max(0, item.startIndex - lineOffset);
      const relEnd = Math.min(line.length, item.endIndex - lineOffset);
      if (relStart > pos) {
        parts.push({ text: line.slice(pos, relStart), isHighlight: false, itemIndex: -1 });
      }
      parts.push({
        text: line.slice(relStart, relEnd),
        isHighlight: true,
        itemIndex: items().indexOf(item),
      });
      pos = relEnd;
    }
    if (pos < line.length) {
      parts.push({ text: line.slice(pos), isHighlight: false, itemIndex: -1 });
    }

    return (
      <For each={parts}>
        {(part) => (
          <Show when={part.isHighlight} fallback={<span>{part.text}</span>}>
            <span
              data-item-index={part.itemIndex}
              class={`px-0.5 rounded cursor-pointer transition-colors ${
                selectedItemIndex() === part.itemIndex
                  ? "bg-amber-400 ring-2 ring-amber-500"
                  : "bg-amber-200 hover:bg-amber-300"
              }`}
              onClick={() => setSelectedItemIndex(part.itemIndex)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedItemIndex(part.itemIndex);
                }
              }}
              title={items()[part.itemIndex]?.placeholder}
              tabindex="0"
            >
              {part.text}
            </span>
          </Show>
        )}
      </For>
    );
  }

  function renderSanitizedText() {
    const text = getSanitizedPreview();
    const regex = /\[([A-Z_]+\d*)\]/g;
    const parts: Array<{ text: string; isPlaceholder: boolean; itemIndex: number }> = [];
    let last = 0;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: intentional loop pattern
    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) {
        parts.push({ text: text.slice(last, match.index), isPlaceholder: false, itemIndex: -1 });
      }
      const placeholder = match[0];
      const itemIndex = items().findIndex((item) => item.checked && item.placeholder === placeholder);
      parts.push({ text: placeholder, isPlaceholder: true, itemIndex });
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      parts.push({ text: text.slice(last), isPlaceholder: false, itemIndex: -1 });
    }

    return (
      <For each={parts}>
        {(part) =>
          part.isPlaceholder ? (
            <span
              data-item-index={part.itemIndex >= 0 ? part.itemIndex : undefined}
              class={`px-0.5 rounded font-mono text-xs cursor-pointer transition-colors ${
                selectedItemIndex() === part.itemIndex
                  ? "bg-amber-400 text-amber-900 ring-2 ring-amber-500"
                  : "bg-amber-100 text-amber-800 hover:bg-amber-200"
              }`}
              onClick={() => {
                if (part.itemIndex >= 0) setSelectedItemIndex(part.itemIndex);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && part.itemIndex >= 0) {
                  e.preventDefault();
                  setSelectedItemIndex(part.itemIndex);
                }
              }}
              tabindex="0"
            >
              {part.text}
            </span>
          ) : (
            <span>{part.text}</span>
          )
        }
      </For>
    );
  }

  function renderTextPanel(title: string, content: "original" | "sanitized", selfScroll = true) {
    return (
      <div class="space-y-2 min-w-0">
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-xs font-semibold text-[#464555] uppercase tracking-wide">{title}</h4>
        </div>
        <div class={`bg-white border border-[rgba(199,196,216,0.35)] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed ${selfScroll ? "max-h-[500px] overflow-y-auto" : "overflow-x-auto"}`}>
          <Show
            when={content === "original"}
            fallback={renderSanitizedText()}
          >
            {renderHighlightedText()}
          </Show>
        </div>
      </div>
    );
  }

  if (props.readOnly || phase() === "confirmed") {
    const outputData = props.nodeExecution.outputData as Record<string, unknown> | null;
    const outputText = (outputData?.text as string) ?? "";
    const mappingCount = (outputData?.mappingCount as number) ?? 0;
    const outputSources = outputData?.sources as
      | Record<string, { displayName: string; desensitizedText: string }>
      | undefined;
    const hasMultiOutput = !!outputSources && Object.keys(outputSources).length > 0;
    const currentSanitizedText = hasMultiOutput
      ? (outputSources?.[currentSourceKey()]?.desensitizedText ?? "")
      : outputText;
    const isCompletedState = props.readOnly || props.nodeExecution.status === "completed";
    const statusClass = isCompletedState
      ? "bg-emerald-50 text-emerald-700"
      : "bg-indigo-50 text-indigo-700";
    const statusDotClass = isCompletedState ? "bg-emerald-500" : "bg-indigo-500";
    const statusLabel = isCompletedState
      ? `审核完成 · 已脱敏 ${mappingCount} 项`
      : `已确认 · 已脱敏 ${mappingCount} 项`;

    function renderConfirmedTextPanel(title: string, text: string, highlighted: boolean, selfScroll = true) {
      return (
        <div class="space-y-2 min-w-0">
          <h4 class="text-xs font-semibold text-[#464555] uppercase tracking-wide">{title}</h4>
          <div class={`bg-white border border-[rgba(199,196,216,0.35)] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed ${selfScroll ? "max-h-[500px] overflow-y-auto" : "overflow-x-auto"}`}>
            <Show when={text} fallback={<span class="text-[#9fa0a8]">暂无内容</span>}>
              <Show when={highlighted} fallback={<span>{text}</span>}>
                <HighlightedText text={text} />
              </Show>
            </Show>
          </div>
        </div>
      );
    }

    return (
      <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
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
            <span
              class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}
            >
              <span class={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
              {statusLabel}
            </span>
          </div>
        </div>
        <div class="p-6">
          <Show
            when={hasMultiOutput}
            fallback={
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
                    <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                    文本预览
                  </h3>
                  {renderPreviewModeToggle()}
                </div>
                <Show
                  when={previewMode() === "compare"}
                  fallback={
                    <Show
                      when={previewMode() === "original"}
                      fallback={renderConfirmedTextPanel("脱敏后", outputText, true)}
                    >
                      {renderConfirmedTextPanel(
                        "原文",
                        ((props.nodeExecution.inputData as Record<string, unknown>)
                          ?.text as string) ?? "",
                        false,
                      )}
                    </Show>
                  }
                >
                  {renderLineAlignedCompare(
                    ((props.nodeExecution.inputData as Record<string, unknown>)
                      ?.text as string) ?? "",
                    outputText,
                  )}
                </Show>
              </div>
            }
          >
            <div class="space-y-4">
              <Show when={sourceGroups().length > 1}>
                <div class="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-[rgba(199,196,216,0.2)] pb-0">
                  <For each={sourceGroups()}>
                    {(group, index) => (
                      <button
                        type="button"
                        class={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                          activeGroupIndex() === index()
                            ? "border-[#4f46e5] text-[#4f46e5]"
                            : "border-transparent text-[#9fa0a8] hover:text-[#464555]"
                        }`}
                        onClick={() => {
                          setActiveGroupIndex(index());
                          setActiveFileIndex(0);
                        }}
                      >
                        {group.displayName}
                        <Show when={group.isFileGroup}>
                          <span class="ml-1 text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-500">
                            文件
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={currentGroup()?.isFileGroup && (currentGroup()?.sources.length ?? 0) > 1}>
                <div class="flex gap-2 overflow-x-auto overflow-y-hidden">
                  <For each={currentGroup()?.sources ?? []}>
                    {(source, index) => (
                      <button
                        type="button"
                        class={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-full border transition-colors ${
                          activeFileIndex() === index()
                            ? "border-[#4f46e5] bg-[#f0efff] text-[#4f46e5]"
                            : "border-[rgba(199,196,216,0.35)] bg-white text-[#777587] hover:text-[#464555]"
                        }`}
                        onClick={() => setActiveFileIndex(index())}
                      >
                        {source.fileName ?? source.displayName}
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <Show
                when={
                  currentGroup()?.isFileGroup &&
                  (currentGroup()?.sources.length ?? 0) === 1 &&
                  currentSource()?.fileName
                }
              >
                <div class="inline-flex items-center gap-2 text-xs text-[#777587] bg-[#f7f9fb] rounded-full px-3 py-1.5">
                  <span class="text-[#4f46e5] font-medium">当前文件</span>
                  <span>{currentSource()?.fileName}</span>
                </div>
              </Show>

              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
                  <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                  文本预览
                </h3>
                {renderPreviewModeToggle()}
              </div>

              <Show
                when={previewMode() === "compare"}
                fallback={
                  <Show
                    when={previewMode() === "original"}
                    fallback={renderConfirmedTextPanel("脱敏后", currentSanitizedText, true)}
                  >
                    {renderConfirmedTextPanel("原文", currentText(), false)}
                  </Show>
                }
              >
                {renderLineAlignedCompare(currentText(), currentSanitizedText)}
              </Show>
            </div>
          </Show>
        </div>
      </div>
    );
  }

  const categoriesConfigured = () => props.config?.categories && props.config.categories.length > 0;

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      <div class="px-6 py-4 bg-gradient-to-r from-[#f2f4f6] to-white border-b border-[rgba(199,196,216,0.15)]">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] flex items-center justify-center flex-shrink-0">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 class="text-sm font-semibold text-[#191c1e]">
              {props.nodeExecution.nodeLabel || "信息脱敏"}
            </h2>
          </div>
          <Show when={categoriesConfigured()}>
            <div class="flex flex-wrap gap-1 items-center justify-end">
              <For each={props.config.categories}>
                {(category) => (
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#f0efff] text-[#4f46e5]">
                    {category.name}
                  </span>
                )}
              </For>
              <Show when={phase() === "review"}>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium ml-1">
                  {selectedCount()}/{detectedCount()} 项
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      <div class="p-5 space-y-4">
        <Show when={!categoriesConfigured()}>
          <div class="text-center py-8 text-[#9fa0a8]">
            <p class="text-sm">未配置脱敏类别</p>
            <p class="text-xs mt-1 text-[#c4c4cc]">请在工作流编辑器中配置脱敏类别</p>
          </div>
        </Show>

        <Show when={categoriesConfigured()}>
          <Show when={error()}>
            <div class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
              {error()}
            </div>
          </Show>

          <Show when={phase() === "detect" && loading()}>
            <div class="bg-[#fff7ed] rounded-xl px-4 py-3 flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center animate-pulse flex-shrink-0">
                <svg
                  class="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
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
                <span class="text-sm text-amber-800 font-medium">正在扫描敏感信息...</span>
                <div class="h-1 bg-amber-200 rounded-full overflow-hidden mt-1.5">
                  <div
                    class="h-full bg-amber-500 rounded-full animate-pulse"
                    style={{ width: "75%" }}
                  />
                </div>
              </div>
            </div>
          </Show>

          <Show
            when={
              multiSource() && sourceGroups().length > 1 && !(phase() === "detect" && loading())
            }
          >
            <div class="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-[rgba(199,196,216,0.2)] pb-0">
              <For each={sourceGroups()}>
                {(group, index) => (
                  <button
                    type="button"
                    class={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                      activeGroupIndex() === index()
                        ? "border-[#4f46e5] text-[#4f46e5]"
                        : "border-transparent text-[#9fa0a8] hover:text-[#464555]"
                    }`}
                    onClick={() => {
                      setActiveGroupIndex(index());
                      setActiveFileIndex(0);
                    }}
                  >
                    {group.displayName}
                    <Show when={group.isFileGroup}>
                      <span class="ml-1 text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-500">
                        文件
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>

          <Show
            when={
              multiSource() &&
              currentGroup()?.isFileGroup &&
              (currentGroup()?.sources.length ?? 0) > 1 &&
              !(phase() === "detect" && loading())
            }
          >
            <div class="flex gap-2 overflow-x-auto overflow-y-hidden">
              <For each={currentGroup()?.sources ?? []}>
                {(source, index) => (
                  <button
                    type="button"
                    class={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-full border transition-colors ${
                      activeFileIndex() === index()
                        ? "border-[#4f46e5] bg-[#f0efff] text-[#4f46e5]"
                        : "border-[rgba(199,196,216,0.35)] bg-white text-[#777587] hover:text-[#464555]"
                    }`}
                    onClick={() => setActiveFileIndex(index())}
                  >
                    {source.fileName ?? source.displayName}
                  </button>
                )}
              </For>
            </div>
          </Show>

          <Show
            when={
              multiSource() &&
              currentGroup()?.isFileGroup &&
              (currentGroup()?.sources.length ?? 0) === 1 &&
              currentSource()?.fileName
            }
          >
            <div class="inline-flex items-center gap-2 text-xs text-[#777587] bg-[#f7f9fb] rounded-full px-3 py-1.5">
              <span class="text-[#4f46e5] font-medium">当前文件</span>
              <span>{currentSource()?.fileName}</span>
            </div>
          </Show>

          <Show when={phase() === "detect" && !loading()}>
            <Show
              when={currentText().trim()}
              fallback={
                <p class="text-sm text-[#9fa0a8] text-center py-4">
                  暂无输入文本，请等待上游节点完成
                </p>
              }
            >
              <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                {currentText()}
              </div>
            </Show>
          </Show>

          <Show when={phase() === "review"}>
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-3">
                <span class="flex items-center gap-1.5 text-emerald-700">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  检测 {detectedCount()}
                </span>
                <span class="text-emerald-600">已选 {selectedCount()}</span>
                <span class="text-slate-400">跳过 {skippedCount()}</span>
              </div>
              <button
                type="button"
                class="text-xs text-[#4f46e5] hover:text-[#3525cd] font-medium"
                onClick={() => {
                  setPhase("detect");
                  void handleDetect();
                }}
              >
                重新检测
              </button>
            </div>

            <div
              class={`grid gap-5 ${
                previewMode() === "compare" ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
              }`}
            >
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
                    <span class="w-1 h-4 bg-[#4f46e5] rounded-full" />
                    文本预览
                  </h3>
                  <div class="flex items-center gap-2">
                    <Show when={checkedIndices().length > 0}>
                      <div class="flex items-center gap-0.5 bg-white border border-[rgba(199,196,216,0.35)] rounded-lg px-2 py-1">
                        <span class="text-xs text-[#464555] tabular-nums min-w-[2.5rem] text-center">
                          {navIndex() >= 0 && navIndex() < checkedIndices().length
                            ? `${navIndex() + 1}/${checkedIndices().length}`
                            : `0/${checkedIndices().length}`}
                        </span>
                        <button
                          type="button"
                          class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#f0efff] text-[#777587] hover:text-[#4f46e5] transition-colors"
                          onClick={() => navigateItem("prev")}
                          title="上一个 (↑)"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                        </button>
                        <button
                          type="button"
                          class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#f0efff] text-[#777587] hover:text-[#4f46e5] transition-colors"
                          onClick={() => navigateItem("next")}
                          title="下一个 (↓)"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                      </div>
                    </Show>
                    {renderPreviewModeToggle()}
                  </div>
                </div>
                <Show
                  when={previewMode() === "compare"}
                  fallback={
                    <Show
                      when={previewMode() === "original"}
                      fallback={renderTextPanel("脱敏后", "sanitized")}
                    >
                      {renderTextPanel("原文", "original")}
                    </Show>
                  }
                >
                  {renderLineAlignedCompare(currentText(), getSanitizedPreview(), highlightOriginalLine)}
                </Show>
              </div>

              <Show when={previewMode() !== "compare"}>
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

                  <div class="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
                    <For each={Object.entries(groupByType(items()))}>
                      {([type, typeItems]) => {
                        const checkedCount = () => typeItems.filter((item) => item.checked).length;
                        const isCollapsed = () => collapsedTypes().has(type);
                        return (
                          <div class="rounded-xl border border-[rgba(199,196,216,0.35)] overflow-hidden">
                            <div
                              class="w-full flex items-center justify-between px-3 py-2.5 bg-[#f7f9fb] hover:bg-[#f0efff] transition-colors cursor-pointer"
                              onClick={() => toggleTypeCollapsed(type)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") toggleTypeCollapsed(type);
                              }}
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
                                    updateCurrentItems((prev) =>
                                      prev.map((item) =>
                                        item.sensitiveType === type
                                          ? {
                                              ...item,
                                              checked: !typeItems.every((entry) => entry.checked),
                                            }
                                          : item,
                                      ),
                                    );
                                  }}
                                >
                                  {typeItems.every((item) => item.checked) ? "全不选" : "全选"}
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
                            </div>
                            <Show when={!isCollapsed()}>
                              <div class="divide-y divide-[rgba(199,196,216,0.15)]">
                                <For each={typeItems}>
                                  {(item) => {
                                    const index = () => items().indexOf(item);
                                    return (
                                      <div
                                        class={`flex items-center gap-3 px-3 py-2.5 bg-white cursor-pointer transition-colors ${selectedItemIndex() === index() ? "bg-[#f0efff]" : "hover:bg-[#fafafe]"} ${!item.checked ? "opacity-50" : ""}`}
                                        onClick={() => setSelectedItemIndex(index())}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            setSelectedItemIndex(index());
                                          }
                                        }}
                                        tabindex="0"
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
                                          aria-label={
                                            item.checked ? "禁用此项脱敏" : "启用此项脱敏"
                                          }
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleItem(index());
                                          }}
                                          class={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${item.checked ? "bg-[#4f46e5]" : "bg-[#e6e8ea]"}`}
                                        >
                                          <span
                                            class={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${item.checked ? "translate-x-4" : "translate-x-0.5"}`}
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

                  <div class="pt-3 border-t border-[rgba(199,196,216,0.2)] space-y-3">
                    <div class="flex items-center justify-between text-xs text-[#464555]">
                      <span>
                        已选择 <span class="font-semibold text-[#191c1e]">{selectedCount()}</span> /{" "}
                        {detectedCount()} 项
                      </span>
                      <Show when={selectedCount() === 0}>
                        <span class="text-amber-600">请至少选择一项进行脱敏</span>
                      </Show>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
