import type { NodeExecution, RestoreConfig } from "@intelliflow/shared";
import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { api, confirmRestore, updateRestoreSource } from "../../../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestorationItem {
  placeholder: string;
  originalValue: string;
  sensitiveType: string;
  restored: boolean;
}

interface RestoreSourceData {
  displayName: string;
  originalText: string;
  restoredText: string;
}

interface RestoreOutputData {
  originalText: string;
  restoredText: string;
  restorations: RestorationItem[];
  sources?: Record<string, RestoreSourceData>;
  confirmedAt?: string;
}

type Phase = "init" | "executing" | "review" | "confirming" | "done";

interface Props {
  nodeExecution: NodeExecution;
  config: RestoreConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  readOnly: boolean;
  registerConfirmAction?: (action: (() => Promise<boolean>) | null) => void;
  onAdvanceAfterConfirm?: () => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RestoreExecutor(props: Props) {
  if (!props.config) {
    return (
      <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] p-8 text-center">
        <div class="text-[#464555] text-sm">正在加载恢复配置...</div>
      </div>
    );
  }

  // ─── Initial phase ──────────────────────────────────────────────────────

  function getInitialPhase(): Phase {
    const od = props.nodeExecution.outputData as unknown as RestoreOutputData | null;
    if (!od) return "init";
    if (od.confirmedAt) return "done";
    return "review";
  }

  // ─── State ──────────────────────────────────────────────────────────────

  const [phase, setPhase] = createSignal<Phase>(getInitialPhase());
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [outputData, setOutputData] = createSignal<RestoreOutputData | null>(
    (props.nodeExecution.outputData as unknown as RestoreOutputData) ?? null,
  );
  const [activeSourceId, setActiveSourceId] = createSignal("");
  const [editedTexts, setEditedTexts] = createSignal<Record<string, string>>({});
  const [showWarningDialog, setShowWarningDialog] = createSignal(false);

  // Init active source from existing outputData
  {
    const data = outputData();
    if (data?.sources) {
      const ids = Object.keys(data.sources);
      if (ids.length > 0) setActiveSourceId(ids[0]);
    }
  }

  // ─── Computed ───────────────────────────────────────────────────────────

  const hasMultiSource = createMemo(() => {
    const s = outputData()?.sources;
    return !!s && Object.keys(s).length > 0;
  });

  const sourceIds = createMemo(() => Object.keys(outputData()?.sources ?? {}));

  const activeSource = createMemo(
    (): RestoreSourceData | null => outputData()?.sources?.[activeSourceId()] ?? null,
  );

  const displayedText = createMemo(
    () => editedTexts()[activeSourceId()] ?? activeSource()?.restoredText ?? "",
  );

  const restoredCount = createMemo(
    () => outputData()?.restorations?.filter((r) => r.restored).length ?? 0,
  );
  const failedCount = createMemo(
    () => outputData()?.restorations?.filter((r) => !r.restored).length ?? 0,
  );

  /** Restorations relevant to the active source */
  const sourceRestorations = createMemo(() => {
    const data = outputData();
    if (!data?.restorations) return [];
    if (!hasMultiSource()) return data.restorations;
    const src = activeSource();
    if (!src) return [];
    return data.restorations.filter((r) => src.originalText.includes(r.placeholder));
  });

  // ─── Debounced source edit ──────────────────────────────────────────────

  let saveTimer: ReturnType<typeof setTimeout>;
  onCleanup(() => clearTimeout(saveTimer));
  onCleanup(() => props.registerConfirmAction?.(null));

  async function flushEdit(sourceId: string, text: string) {
    try {
      await updateRestoreSource(props.documentId, props.nodeExecution.id, sourceId, text);
      setOutputData((prev) => {
        if (!prev?.sources?.[sourceId]) return prev;
        return {
          ...prev,
          sources: {
            ...prev.sources,
            [sourceId]: { ...prev.sources[sourceId], restoredText: text },
          },
        };
      });
      setEditedTexts((prev) => {
        const next = { ...prev };
        delete next[sourceId];
        return next;
      });
    } catch {
      // user can retry
    }
  }

  function handleEdit(text: string) {
    const id = activeSourceId();
    if (!id) return;
    setEditedTexts((prev) => ({ ...prev, [id]: text }));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => flushEdit(id, text), 500);
  }

  function switchSource(newId: string) {
    const curId = activeSourceId();
    const pending = editedTexts()[curId];
    if (pending !== undefined) {
      clearTimeout(saveTimer);
      flushEdit(curId, pending);
    }
    setActiveSourceId(newId);
  }

  // ─── Execute ────────────────────────────────────────────────────────────

  async function handleExecute() {
    setPhase("executing");
    setLoading(true);
    setError(null);
    try {
      // biome-ignore lint/suspicious/noExplicitAny: eden treaty dynamic path
      const runtimeApi = api.api.runtime as any;
      const res = await runtimeApi[props.documentId].restore[
        props.nodeExecution.id
      ].execute.post();

      if (res.data && !("error" in res.data)) {
        const data = res.data as unknown as RestoreOutputData;
        setOutputData(data);
        const ids = Object.keys(data.sources ?? {});
        if (ids.length > 0) setActiveSourceId(ids[0]);
        setPhase("review");
      } else {
        setError((res.data as Record<string, string>)?.error ?? "恢复失败，请重试");
        setPhase("init");
      }
    } catch {
      setError("恢复失败，请重试");
      setPhase("init");
    } finally {
      setLoading(false);
    }
  }

  // ─── Confirm ────────────────────────────────────────────────────────────

  async function doConfirm() {
    setPhase("confirming");
    setLoading(true);
    setError(null);

    // Flush all pending edits first
    for (const [sid, text] of Object.entries(editedTexts())) {
      await flushEdit(sid, text);
    }

    try {
      await confirmRestore(props.documentId, props.nodeExecution.id);
      const data = outputData();
      if (data) setOutputData({ ...data, confirmedAt: new Date().toISOString() });
      setPhase("done");
      props.onDraftSave(outputData() as unknown as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认失败，请重试");
      setPhase("review");
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    props.registerConfirmAction?.(
      phase() === "review"
        ? async () => {
            if (failedCount() > 0) {
              setShowWarningDialog(true);
              return false;
            }
            await doConfirm();
            return true;
          }
        : null,
    );
  });

  // ─── Highlight rendering ────────────────────────────────────────────────

  function renderHighlighted(text: string, items: RestorationItem[], side: "before" | "after") {
    if (!items.length || !text) return <span>{text}</span>;

    type Token = { text: string; type: "normal" | "placeholder" | "restored" | "failed" };
    const tokens: Token[] = [];

    if (side === "before") {
      const sorted = [...items].sort(
        (a, b) => text.indexOf(a.placeholder) - text.indexOf(b.placeholder),
      );
      let lastEnd = 0;
      for (const item of sorted) {
        const pos = text.indexOf(item.placeholder, lastEnd);
        if (pos === -1) continue;
        if (pos > lastEnd) tokens.push({ text: text.slice(lastEnd, pos), type: "normal" });
        tokens.push({ text: item.placeholder, type: "placeholder" });
        lastEnd = pos + item.placeholder.length;
      }
      if (lastEnd < text.length) tokens.push({ text: text.slice(lastEnd), type: "normal" });
    } else {
      const targets = items.map((item) => ({
        search: item.restored ? item.originalValue : item.placeholder,
        item,
      }));
      const occs: Array<{ start: number; end: number; item: RestorationItem }> = [];
      for (const t of targets) {
        let from = 0;
        while (true) {
          const pos = text.indexOf(t.search, from);
          if (pos === -1) break;
          occs.push({ start: pos, end: pos + t.search.length, item: t.item });
          from = pos + t.search.length;
        }
      }
      occs.sort((a, b) => a.start - b.start);
      let lastEnd = 0;
      for (const occ of occs) {
        if (occ.start < lastEnd) continue;
        if (occ.start > lastEnd)
          tokens.push({ text: text.slice(lastEnd, occ.start), type: "normal" });
        tokens.push({
          text: text.slice(occ.start, occ.end),
          type: occ.item.restored ? "restored" : "failed",
        });
        lastEnd = occ.end;
      }
      if (lastEnd < text.length) tokens.push({ text: text.slice(lastEnd), type: "normal" });
    }

    if (!tokens.length) return <span>{text}</span>;

    return (
      <span>
        <For each={tokens}>
          {(t) => (
            <Switch fallback={<span>{t.text}</span>}>
              <Match when={t.type === "placeholder"}>
                <span class="bg-amber-100 text-amber-800 px-0.5 rounded font-medium">
                  {t.text}
                </span>
              </Match>
              <Match when={t.type === "restored"}>
                <span class="bg-green-100 text-green-800 px-0.5 rounded font-medium">
                  {t.text}
                </span>
              </Match>
              <Match when={t.type === "failed"}>
                <span class="bg-red-100 text-red-800 px-0.5 rounded font-medium">{t.text}</span>
              </Match>
            </Switch>
          )}
        </For>
      </span>
    );
  }

  // ─── Read-only mode ─────────────────────────────────────────────────────

  if (props.readOnly && outputData()) {
    const data = outputData()!;
    return (
      <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-1 h-4 bg-emerald-500 rounded-full" />
            <h2 class="text-sm font-semibold text-[#191c1e]">信息恢复（只读）</h2>
          </div>
          <div class="text-xs text-[#464555] px-3 py-1 bg-emerald-50 rounded-full">
            已恢复 {restoredCount()} 处
          </div>
        </div>
        <Show
          when={hasMultiSource()}
          fallback={
            <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed text-[#191c1e]">
              {renderHighlighted(data.restoredText, data.restorations ?? [], "after")}
            </div>
          }
        >
          <div class="space-y-3">
            <For each={Object.entries(data.sources ?? {})}>
              {([_id, src]) => (
                <div class="rounded-xl border border-[rgba(199,196,216,0.25)] overflow-hidden">
                  <div class="px-4 py-2 bg-emerald-50/50 border-b border-[rgba(199,196,216,0.15)]">
                    <span class="text-xs font-medium text-[#464555]">{src.displayName}</span>
                  </div>
                  <div class="p-4 text-sm text-[#191c1e] whitespace-pre-wrap leading-relaxed">
                    {src.restoredText}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  const restoreIcon = (
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  );

  return (
    <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] overflow-hidden">
      {/* Header */}
      <div class="px-6 py-4 border-b border-[rgba(199,196,216,0.15)] flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg
              class="w-5 h-5 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              {restoreIcon}
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <div class="w-1 h-4 bg-emerald-500 rounded-full" />
              <h2 class="text-sm font-semibold text-[#191c1e]">信息恢复</h2>
            </div>
            <p class="text-xs text-[#464555] mt-0.5">将脱敏占位符替换为真实敏感信息</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50">
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span class="text-xs text-emerald-600 font-medium">恢复</span>
        </div>
      </div>

      <Show when={error()}>
        <div class="mx-6 mt-4 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error()}</div>
      </Show>

      <Switch>
        {/* ── Init ─────────────────────────────────────────────────────── */}
        <Match when={phase() === "init"}>
          <div class="px-6 py-10 text-center">
            <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg
                class="w-6 h-6 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                {restoreIcon}
              </svg>
            </div>
            <p class="text-sm text-[#464555] mb-5">
              将脱敏占位符替换为真实敏感信息，恢复文档原始内容。
            </p>
            <button
              type="button"
              class="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#3525cd] to-[#4f46e5] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={loading()}
              onClick={handleExecute}
            >
              开始恢复
            </button>
          </div>
        </Match>

        {/* ── Executing ────────────────────────────────────────────────── */}
        <Match when={phase() === "executing"}>
          <div class="px-6 py-10 text-center">
            <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg
                class="w-6 h-6 text-emerald-500 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                {restoreIcon}
              </svg>
            </div>
            <p class="text-sm text-[#464555]">正在执行恢复...</p>
          </div>
        </Match>

        {/* ── Review / Confirming ──────────────────────────────────────── */}
        <Match when={(phase() === "review" || phase() === "confirming") && outputData()}>
          <div class="p-6 space-y-4">
            {/* No restorations */}
            <Show when={restoredCount() === 0 && failedCount() === 0}>
              <div class="text-center py-6">
                <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg
                    class="w-6 h-6 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p class="text-sm font-medium text-[#191c1e] mb-1">上游无脱敏项，无需恢复</p>
                <p class="text-xs text-[#464555]">文本内容保持不变，可直接继续下一步</p>
              </div>
            </Show>

            {/* Has restorations */}
            <Show when={restoredCount() > 0 || failedCount() > 0}>
              {/* Summary bar */}
              <div class="flex items-center gap-3 bg-[#f7f9fb] rounded-xl px-4 py-3">
                <div class="text-sm text-[#191c1e]">
                  <span class="text-emerald-600 font-medium">
                    {restoredCount()} 处恢复成功
                  </span>
                  <Show when={failedCount() > 0}>
                    <span class="text-[rgba(199,196,216,0.6)] mx-2">|</span>
                    <span class="text-red-600 font-medium">{failedCount()} 处需手动修正</span>
                  </Show>
                </div>
              </div>

              {/* Source tabs (multi-source only) */}
              <Show when={hasMultiSource()}>
                <div class="flex items-center gap-0.5 bg-[#eceef0] rounded-lg p-0.5">
                  <For each={sourceIds()}>
                    {(id) => (
                      <button
                        type="button"
                        class={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          activeSourceId() === id
                            ? "bg-white text-[#191c1e] shadow-sm"
                            : "text-[#464555] hover:text-[#191c1e]"
                        }`}
                        onClick={() => switchSource(id)}
                      >
                        {outputData()?.sources?.[id]?.displayName ?? id}
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              {/* Before / After comparison */}
              <Show
                when={hasMultiSource()}
                fallback={
                  /* Old data fallback: aggregated view (read-only) */
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <div class="text-xs font-semibold text-[#464555] mb-2 uppercase tracking-wider">
                        恢复前
                      </div>
                      <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed text-[#191c1e]">
                        {renderHighlighted(
                          outputData()?.originalText ?? "",
                          outputData()?.restorations ?? [],
                          "before",
                        )}
                      </div>
                    </div>
                    <div>
                      <div class="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wider">
                        恢复后
                      </div>
                      <div class="bg-emerald-50/30 rounded-xl p-4 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed text-[#191c1e] border border-emerald-200">
                        {renderHighlighted(
                          outputData()?.restoredText ?? "",
                          outputData()?.restorations ?? [],
                          "after",
                        )}
                      </div>
                    </div>
                  </div>
                }
              >
                {/* Multi-source: per-source before/after */}
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <div class="text-xs font-semibold text-[#464555] mb-2 uppercase tracking-wider">
                      恢复前
                    </div>
                    <div class="bg-[#f7f9fb] rounded-xl p-4 text-sm text-[#464555] whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed">
                      <Show
                        when={activeSource()?.originalText}
                        fallback={
                          <span class="italic text-[#9fa0a8]">
                            （旧版数据，无恢复前文本）
                          </span>
                        }
                      >
                        {renderHighlighted(
                          activeSource()?.originalText ?? "",
                          sourceRestorations(),
                          "before",
                        )}
                      </Show>
                    </div>
                  </div>
                  <div>
                    <div class="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wider">
                      恢复后
                    </div>
                    <textarea
                      class="w-full bg-emerald-50/30 rounded-xl p-4 text-sm text-[#191c1e] whitespace-pre-wrap border border-emerald-200 focus:ring-2 focus:ring-emerald-300 focus:outline-none min-h-[200px] max-h-[400px] overflow-y-auto resize-none leading-relaxed"
                      value={displayedText()}
                      onInput={(e) => handleEdit(e.currentTarget.value)}
                    />
                  </div>
                </div>
              </Show>

              {/* Restoration items table */}
              <Show when={sourceRestorations().length > 0}>
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <div class="w-1 h-4 bg-emerald-500 rounded-full" />
                    <h3 class="text-xs font-medium text-[#191c1e]">恢复项明细</h3>
                  </div>
                  <div class="rounded-xl overflow-hidden border border-[rgba(199,196,216,0.15)]">
                    <div class="grid grid-cols-[2fr_2fr_80px] bg-[#f2f4f6] px-4 py-2">
                      <span class="text-[11px] font-bold text-[#464555] uppercase tracking-wider">
                        占位符
                      </span>
                      <span class="text-[11px] font-bold text-[#464555] uppercase tracking-wider">
                        真实值
                      </span>
                      <span class="text-[11px] font-bold text-[#464555] uppercase tracking-wider text-center">
                        状态
                      </span>
                    </div>
                    <For each={sourceRestorations()}>
                      {(item) => (
                        <div
                          class={`grid grid-cols-[2fr_2fr_80px] px-4 py-2.5 border-t border-slate-50 items-center border-l-2 ${
                            item.restored
                              ? "border-l-emerald-500"
                              : "border-l-red-400 bg-red-50/20"
                          }`}
                        >
                          <span class="font-mono text-[12px] text-[#464555] truncate pr-2">
                            {item.placeholder}
                          </span>
                          <span class="text-sm font-semibold text-[#191c1e] truncate pr-2">
                            {item.originalValue}
                          </span>
                          <div class="flex justify-center">
                            <Show
                              when={item.restored}
                              fallback={
                                <div class="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg
                                    class="w-3 h-3 text-red-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2.5"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </div>
                              }
                            >
                              <div class="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                                <svg
                                  class="w-3 h-3 text-emerald-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2.5"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>

            <div class="pt-2 text-xs text-[#777587] text-center">
              请检查恢复前 / 恢复后内容，然后使用底部操作栏确认并继续。
            </div>
          </div>
        </Match>

        {/* ── Done ─────────────────────────────────────────────────────── */}
        <Match when={phase() === "done" && outputData()}>
          {(_data) => (
            <div class="px-6 py-10 text-center">
              <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg
                  class="w-6 h-6 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p class="text-sm font-medium text-[#191c1e] mb-1">恢复已确认</p>
              <Show when={restoredCount() > 0 || failedCount() > 0}>
                <p class="text-xs text-[#464555]">
                  已恢复 {restoredCount()} 处
                  <Show when={failedCount() > 0}>
                    <span>，{failedCount()} 处未恢复</span>
                  </Show>
                </p>
              </Show>
            </div>
          )}
        </Match>
      </Switch>

      {/* Warning dialog */}
      <Show when={showWarningDialog()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.12)] p-6 w-full max-w-md mx-4">
            <h3 class="text-lg font-semibold text-[#191c1e] mb-2">存在未恢复项</h3>
            <p class="text-sm text-[#464555] mb-4">
              仍有 {failedCount()} 处未恢复，确定要继续吗？
            </p>
            <div class="flex justify-end gap-3">
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium text-[#464555] bg-[#e6e8ea] rounded-xl hover:bg-[#d8dadc]"
                onClick={() => setShowWarningDialog(false)}
              >
                取消
              </button>
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3525cd] to-[#4f46e5] rounded-xl hover:opacity-90"
                onClick={async () => {
                  setShowWarningDialog(false);
                  await doConfirm();
                  if (props.onAdvanceAfterConfirm) {
                    await props.onAdvanceAfterConfirm();
                  }
                }}
              >
                继续
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
