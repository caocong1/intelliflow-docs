import DiffMatchPatch from "diff-match-patch";
import { For, Match, Switch, createMemo, createSignal } from "solid-js";

interface AIEditDiffPreviewProps {
  originalText: string;
  modifiedText: string;
  onAccept: () => void;
  onReject: () => void;
}

type ViewMode = "inline" | "side-by-side";

const dmp = new DiffMatchPatch();

/**
 * Inline and side-by-side diff rendering with accept/reject controls.
 * Uses diff-match-patch for character-level diff computation with
 * semantic cleanup (critical for CJK text readability).
 */
export default function AIEditDiffPreview(props: AIEditDiffPreviewProps) {
  const [viewMode, setViewMode] = createSignal<ViewMode>("inline");

  const diffs = createMemo(() => {
    const result = dmp.diff_main(props.originalText, props.modifiedText);
    dmp.diff_cleanupSemantic(result);
    return result;
  });

  /** Extract only deletions + equal parts (left column in side-by-side) */
  const originalParts = createMemo(() =>
    diffs().filter(([op]) => op !== DiffMatchPatch.DIFF_INSERT),
  );

  /** Extract only insertions + equal parts (right column in side-by-side) */
  const modifiedParts = createMemo(() =>
    diffs().filter(([op]) => op !== DiffMatchPatch.DIFF_DELETE),
  );

  return (
    <div class="bg-white rounded-xl border border-[rgba(199,196,216,0.3)] shadow-[0_4px_16px_rgba(25,28,30,0.04)] overflow-hidden">
      {/* Header with view mode toggle */}
      <div class="flex items-center justify-between px-4 py-2.5 bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.2)]">
        <span class="text-xs font-medium text-[#464555]">AI 编辑预览</span>
        <div class="flex items-center gap-1 bg-[#eceef0] rounded-lg p-0.5">
          <button
            type="button"
            class={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode() === "inline"
                ? "bg-white text-[#191c1e] shadow-sm"
                : "text-[#464555] hover:text-[#191c1e]"
            }`}
            onClick={() => setViewMode("inline")}
          >
            内联对比
          </button>
          <button
            type="button"
            class={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode() === "side-by-side"
                ? "bg-white text-[#191c1e] shadow-sm"
                : "text-[#464555] hover:text-[#191c1e]"
            }`}
            onClick={() => setViewMode("side-by-side")}
          >
            并排对比
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div class="p-4 max-h-[400px] overflow-y-auto">
        <Switch>
          {/* Inline diff view */}
          <Match when={viewMode() === "inline"}>
            <div class="text-sm leading-relaxed whitespace-pre-wrap font-mono">
              <For each={diffs()}>
                {([op, text]) => (
                  <Switch>
                    <Match when={op === DiffMatchPatch.DIFF_DELETE}>
                      <span class="bg-red-100 text-red-800 line-through">{text}</span>
                    </Match>
                    <Match when={op === DiffMatchPatch.DIFF_INSERT}>
                      <span class="bg-green-100 text-green-800">{text}</span>
                    </Match>
                    <Match when={op === DiffMatchPatch.DIFF_EQUAL}>
                      <span>{text}</span>
                    </Match>
                  </Switch>
                )}
              </For>
            </div>
          </Match>

          {/* Side-by-side diff view */}
          <Match when={viewMode() === "side-by-side"}>
            <div class="grid grid-cols-2 gap-3">
              {/* Original (left) */}
              <div class="space-y-1">
                <div class="text-xs font-medium text-[#464555] mb-2">原文</div>
                <div class="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-[#f7f9fb] rounded-lg p-3">
                  <For each={originalParts()}>
                    {([op, text]) => (
                      <Switch>
                        <Match when={op === DiffMatchPatch.DIFF_DELETE}>
                          <span class="bg-red-100 text-red-800">{text}</span>
                        </Match>
                        <Match when={op === DiffMatchPatch.DIFF_EQUAL}>
                          <span>{text}</span>
                        </Match>
                      </Switch>
                    )}
                  </For>
                </div>
              </div>

              {/* Modified (right) */}
              <div class="space-y-1">
                <div class="text-xs font-medium text-[#464555] mb-2">修改后</div>
                <div class="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-[#f7f9fb] rounded-lg p-3">
                  <For each={modifiedParts()}>
                    {([op, text]) => (
                      <Switch>
                        <Match when={op === DiffMatchPatch.DIFF_INSERT}>
                          <span class="bg-green-100 text-green-800">{text}</span>
                        </Match>
                        <Match when={op === DiffMatchPatch.DIFF_EQUAL}>
                          <span>{text}</span>
                        </Match>
                      </Switch>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </Match>
        </Switch>
      </div>

      {/* Accept / Reject buttons */}
      <div class="flex items-center justify-end gap-2 px-4 py-3 bg-[#f7f9fb] border-t border-[rgba(199,196,216,0.2)]">
        <button
          type="button"
          class="px-4 py-2 text-xs font-medium text-[#464555] bg-white border border-[rgba(199,196,216,0.4)] rounded-lg hover:bg-[#f7f9fb] transition-colors"
          onClick={() => props.onReject()}
        >
          拒绝
        </button>
        <button
          type="button"
          class="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          onClick={() => props.onAccept()}
        >
          接受
        </button>
      </div>
    </div>
  );
}
