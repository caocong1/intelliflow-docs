import { createSignal, For, Match, Show, Switch } from "solid-js";
import { api } from "../../../api/client";
import type { NodeExecution, RestoreConfig } from "@intelliflow/shared";

interface RestorationItem {
  placeholder: string;
  originalValue: string;
  sensitiveType: string;
  restored: boolean;
}

interface RestoreOutputData {
  originalText: string;
  restoredText: string;
  restorations: RestorationItem[];
}

interface Props {
  nodeExecution: NodeExecution;
  config: RestoreConfig;
  documentId: string;
  onDraftSave: (data: Record<string, unknown>) => void;
  readOnly: boolean;
}

export default function RestoreExecutor(props: Props) {
  const [phase, setPhase] = createSignal<"init" | "review" | "done">(
    props.nodeExecution.outputData ? "review" : "init",
  );
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [outputData, setOutputData] = createSignal<RestoreOutputData | null>(
    (props.nodeExecution.outputData as unknown as RestoreOutputData) ?? null,
  );
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [editValue, setEditValue] = createSignal("");
  const [showWarningDialog, setShowWarningDialog] = createSignal(false);

  // ─── Execute restore ────────────────────────────────────────────────────

  async function handleExecute() {
    setLoading(true);
    setError(null);
    try {
      const res = await (api.api.runtime as any)[props.documentId].restore[
        props.nodeExecution.id
      ].execute.post();

      if (res.data && !("error" in res.data)) {
        const data = res.data as unknown as RestoreOutputData;
        setOutputData(data);
        setPhase("review");
      } else {
        setError((res.data as any)?.error ?? "Failed to execute restore");
      }
    } catch {
      setError("Failed to execute restore");
    } finally {
      setLoading(false);
    }
  }

  // ─── Manual correction ──────────────────────────────────────────────────

  function startEdit(index: number, placeholder: string) {
    setEditingIndex(index);
    setEditValue(placeholder);
  }

  async function commitEdit() {
    const idx = editingIndex();
    if (idx === null) return;

    const data = outputData();
    if (!data) return;

    const item = data.restorations[idx];
    if (!item) return;

    // Replace the placeholder in the restored text with the user's correction
    const updatedText = data.restoredText.replaceAll(item.placeholder, editValue());

    setLoading(true);
    try {
      const res = await (api.api.runtime as any)[props.documentId].restore[
        props.nodeExecution.id
      ].text.put({ updatedText });

      if (res.data && !("error" in res.data)) {
        setOutputData(res.data as unknown as RestoreOutputData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setEditingIndex(null);
    }
  }

  function cancelEdit() {
    setEditingIndex(null);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  const restoredCount = () => outputData()?.restorations.filter((r) => r.restored).length ?? 0;
  const failedCount = () => outputData()?.restorations.filter((r) => !r.restored).length ?? 0;
  const allRestored = () => outputData()?.restorations.every((r) => r.restored) ?? false;

  // ─── Highlight rendering ────────────────────────────────────────────────

  function renderHighlightedText(
    text: string,
    items: RestorationItem[],
    side: "left" | "right",
  ) {
    if (!items.length) return <span>{text}</span>;

    // Build a list of segments to highlight
    const tokens: Array<{ text: string; type: "normal" | "restored" | "failed" | "placeholder" }> = [];

    if (side === "left") {
      // Left side: highlight placeholders in amber
      let remaining = text;
      const sortedItems = [...items].sort((a, b) => {
        const posA = remaining.indexOf(a.placeholder);
        const posB = remaining.indexOf(b.placeholder);
        return posA - posB;
      });

      let lastEnd = 0;
      const fullText = text;
      for (const item of sortedItems) {
        const pos = fullText.indexOf(item.placeholder, lastEnd);
        if (pos === -1) continue;
        if (pos > lastEnd) {
          tokens.push({ text: fullText.slice(lastEnd, pos), type: "normal" });
        }
        tokens.push({ text: item.placeholder, type: "placeholder" });
        lastEnd = pos + item.placeholder.length;
      }
      if (lastEnd < fullText.length) {
        tokens.push({ text: fullText.slice(lastEnd), type: "normal" });
      }
    } else {
      // Right side: highlight restored values in green, failed placeholders in red
      // Build search targets: for restored items, search for originalValue; for failed, search for placeholder
      type Target = { search: string; item: RestorationItem };
      const targets: Target[] = items.map((item) => ({
        search: item.restored ? item.originalValue : item.placeholder,
        item,
      }));

      // Find all occurrences and sort by position
      const occurrences: Array<{ start: number; end: number; item: RestorationItem }> = [];
      for (const target of targets) {
        let searchFrom = 0;
        while (true) {
          const pos = text.indexOf(target.search, searchFrom);
          if (pos === -1) break;
          occurrences.push({
            start: pos,
            end: pos + target.search.length,
            item: target.item,
          });
          searchFrom = pos + target.search.length;
        }
      }

      occurrences.sort((a, b) => a.start - b.start);

      let lastEnd = 0;
      for (const occ of occurrences) {
        if (occ.start < lastEnd) continue; // skip overlapping
        if (occ.start > lastEnd) {
          tokens.push({ text: text.slice(lastEnd, occ.start), type: "normal" });
        }
        tokens.push({
          text: text.slice(occ.start, occ.end),
          type: occ.item.restored ? "restored" : "failed",
        });
        lastEnd = occ.end;
      }
      if (lastEnd < text.length) {
        tokens.push({ text: text.slice(lastEnd), type: "normal" });
      }
    }

    if (tokens.length === 0) {
      return <span>{text}</span>;
    }

    return (
      <span>
        <For each={tokens}>
          {(token) => (
            <Switch fallback={<span>{token.text}</span>}>
              <Match when={token.type === "placeholder"}>
                <span class="bg-amber-100 text-amber-800 px-0.5 rounded">{token.text}</span>
              </Match>
              <Match when={token.type === "restored"}>
                <span class="bg-green-100 text-green-800 px-0.5 rounded">{token.text}</span>
              </Match>
              <Match when={token.type === "failed"}>
                <span class="bg-red-100 text-red-800 px-0.5 rounded">{token.text}</span>
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
      <div class="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">Information Restore (Read-only)</h2>
          <div class="text-xs text-gray-500">
            Restored {restoredCount()} items
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {renderHighlightedText(data.restoredText, data.restorations, "right")}
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div class="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-700">Information Restore</h2>
        <div class="inline-flex px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
          restore
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error()}</div>
      </Show>

      <Switch>
        {/* Phase 1: Execute */}
        <Match when={phase() === "init"}>
          <div class="text-center py-8">
            <p class="text-sm text-gray-500 mb-4">
              Click to replace desensitized placeholders with real values.
            </p>
            <button
              type="button"
              class="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              disabled={loading()}
              onClick={handleExecute}
            >
              {loading() ? "Processing..." : "Start Restore"}
            </button>
          </div>
        </Match>

        {/* Phase 2: Review diff */}
        <Match when={phase() === "review" && outputData()}>
          <div class="space-y-4">
            {/* Side-by-side diff */}
            <div class="grid grid-cols-2 gap-4">
              {/* Left: desensitized version */}
              <div class="space-y-2">
                <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Desensitized Version
                </div>
                <div class="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-[200px] max-h-[400px] overflow-y-auto border border-gray-200">
                  {renderHighlightedText(
                    outputData()!.originalText,
                    outputData()!.restorations,
                    "left",
                  )}
                </div>
              </div>

              {/* Right: restored version */}
              <div class="space-y-2">
                <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Restored Version
                </div>
                <div class="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-[200px] max-h-[400px] overflow-y-auto border border-gray-200">
                  {renderHighlightedText(
                    outputData()!.restoredText,
                    outputData()!.restorations,
                    "right",
                  )}
                </div>
              </div>
            </div>

            {/* Summary bar */}
            <div class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
              <div class="text-sm text-gray-600">
                <span class="text-green-600 font-medium">Restored {restoredCount()} items</span>
                <Show when={failedCount() > 0}>
                  <span class="text-gray-400 mx-2">|</span>
                  <span class="text-red-600 font-medium">Failed {failedCount()} items</span>
                </Show>
              </div>
            </div>

            {/* Failed items list with inline editing */}
            <Show when={failedCount() > 0}>
              <div class="space-y-2">
                <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Failed Restorations (click to correct)
                </h3>
                <For each={outputData()!.restorations.filter((r) => !r.restored)}>
                  {(item) => {
                    const idx = () => outputData()!.restorations.indexOf(item);
                    return (
                      <div class="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
                        <div class="flex-1">
                          <div class="text-xs text-gray-500 mb-1">
                            {item.sensitiveType}: <span class="font-mono text-red-600">{item.placeholder}</span>
                          </div>
                          <Show
                            when={editingIndex() === idx()}
                            fallback={
                              <button
                                type="button"
                                class="text-sm text-red-700 hover:text-red-800 underline decoration-dashed"
                                onClick={() => startEdit(idx(), item.placeholder)}
                              >
                                Click to enter correct value
                              </button>
                            }
                          >
                            <div class="flex items-center gap-2">
                              <input
                                type="text"
                                class="flex-1 px-3 py-1.5 text-sm border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={editValue()}
                                onInput={(e) => setEditValue(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitEdit();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <button
                                type="button"
                                class="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                disabled={loading()}
                                onClick={commitEdit}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </Match>
      </Switch>

      {/* Warning dialog for unrestored items */}
      <Show when={showWarningDialog()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Unrestored Items</h3>
            <p class="text-sm text-gray-500 mb-4">
              There are still {failedCount()} unrestored items. Are you sure you want to continue?
            </p>
            <div class="flex justify-end gap-3">
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={() => setShowWarningDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                onClick={() => {
                  setShowWarningDialog(false);
                  props.onDraftSave(outputData() as unknown as Record<string, unknown>);
                }}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
