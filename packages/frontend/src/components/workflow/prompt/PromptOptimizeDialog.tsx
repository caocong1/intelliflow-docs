import { Show, createSignal, onMount, For } from "solid-js";

const DEFAULT_META_PROMPT_PLACEHOLDER = `你是一个提示词优化专家。请优化以下提示词，使其更加清晰、具体、结构化。
保留原始意图和所有变量引用（如 {{节点名.输出名}}），不要改变变量格式。
只返回优化后的提示词文本，不要添加解释。`;

interface ModelOption {
  id: string;
  displayName: string;
  providerName: string | null;
}

interface PromptOptimizeDialogProps {
  open: boolean;
  currentPrompt: string;
  onClose: () => void;
  onAccept: (optimizedText: string) => void;
}

export default function PromptOptimizeDialog(props: PromptOptimizeDialogProps) {
  const [models, setModels] = createSignal<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = createSignal("");
  const [metaPrompt, setMetaPrompt] = createSignal("");
  const [showMetaPrompt, setShowMetaPrompt] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [optimizedText, setOptimizedText] = createSignal("");

  onMount(async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/models", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch models");
      const json = (await res.json()) as { data: ModelOption[] };
      setModels(json.data ?? []);
      if (json.data?.length > 0) {
        setSelectedModelId(json.data[0].id);
      }
    } catch {
      setError("无法获取模型列表");
    }
  });

  async function handleOptimize() {
    setLoading(true);
    setError("");
    setOptimizedText("");

    try {
      const token = localStorage.getItem("auth_token");
      const body: Record<string, string> = {
        promptText: props.currentPrompt,
        modelId: selectedModelId(),
      };
      const mp = metaPrompt().trim();
      if (mp) body.metaPrompt = mp;

      const res = await fetch("/api/prompts/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as { optimizedText?: string; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "优化失败");
        return;
      }

      setOptimizedText(json.optimizedText ?? "");
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    props.onAccept(optimizedText());
    handleReset();
    props.onClose();
  }

  function handleDiscard() {
    handleReset();
    props.onClose();
  }

  function handleReset() {
    setOptimizedText("");
    setError("");
    setMetaPrompt("");
    setShowMetaPrompt(false);
  }

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleDiscard();
        }}
      >
        {/* Dialog */}
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-800">优化提示词</h3>
            <button
              type="button"
              onClick={handleDiscard}
              class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>关闭</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div class="px-5 py-4 space-y-4">
            {/* Model selector */}
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">选择模型</label>
              <select
                value={selectedModelId()}
                onChange={(e) => setSelectedModelId(e.currentTarget.value)}
                class="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
              >
                <For each={models()}>
                  {(m) => (
                    <option value={m.id}>
                      {m.displayName}
                      {m.providerName ? ` (${m.providerName})` : ""}
                    </option>
                  )}
                </For>
              </select>
            </div>

            {/* Meta-prompt toggle + field */}
            <div>
              <button
                type="button"
                onClick={() => setShowMetaPrompt(!showMetaPrompt())}
                class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <svg
                  class={`w-3 h-3 transition-transform ${showMetaPrompt() ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <title>展开</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                优化指令（可选）
              </button>
              <Show when={showMetaPrompt()}>
                <textarea
                  value={metaPrompt()}
                  onInput={(e) => setMetaPrompt(e.currentTarget.value)}
                  placeholder={DEFAULT_META_PROMPT_PLACEHOLDER}
                  rows={4}
                  class="mt-2 w-full text-xs px-2.5 py-2 border border-slate-200 rounded-md bg-white text-slate-800 placeholder-slate-400 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                />
              </Show>
            </div>

            {/* Current prompt preview */}
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">当前提示词</label>
              <div class="text-xs text-slate-700 font-mono bg-slate-50 border border-slate-100 rounded-md p-2.5 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                {props.currentPrompt}
              </div>
            </div>

            {/* Error display */}
            <Show when={error()}>
              <div class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error()}
              </div>
            </Show>

            {/* Optimized result */}
            <Show when={optimizedText()}>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1.5">优化结果</label>
                <div class="text-xs text-slate-800 font-mono bg-green-50 border border-green-200 rounded-md p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                  {optimizedText()}
                </div>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
            <Show
              when={optimizedText()}
              fallback={
                <>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleOptimize}
                    disabled={loading() || models().length === 0}
                    class="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Show when={loading()}>
                      <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <title>加载中</title>
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </Show>
                    {loading() ? "优化中..." : "开始优化"}
                  </button>
                </>
              }
            >
              <button
                type="button"
                onClick={handleDiscard}
                class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
              >
                放弃
              </button>
              <button
                type="button"
                onClick={handleAccept}
                class="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer"
              >
                采用
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
