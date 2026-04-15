import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { renderMarkdown } from "../../lib/render-markdown";

interface Props {
  content: string;
  title?: string;
  onClose: () => void;
}

export default function ContentPreviewModal(props: Props) {
  const [viewMode, setViewMode] = createSignal<"markdown" | "source">("markdown");
  const [copied, setCopied] = createSignal(false);
  let restoreCopyStateTimer: ReturnType<typeof setTimeout> | undefined;
  let previousBodyOverflow = "";
  let previousHtmlOverflow = "";

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  async function handleCopy() {
    if (!navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(props.content);
      setCopied(true);
      clearTimeout(restoreCopyStateTimer);
      restoreCopyStateTimer = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  onMount(() => {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    clearTimeout(restoreCopyStateTimer);
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Portal>
      <div
        class="fixed inset-0 z-[100] bg-[rgba(15,23,42,0.36)] backdrop-blur-sm"
        data-preview-fullscreen="true"
        role="dialog"
        aria-modal="true"
        aria-label={props.title ?? "内容预览"}
        style={{ height: "100dvh" }}
      >
        <div class="flex h-full min-h-0 w-full flex-col bg-[#f8fafc] text-[#191c1e]">
          <div class="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(199,196,216,0.3)] bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
            <div class="min-w-0">
              <h2 class="truncate text-base font-bold text-[#191c1e] sm:text-lg">
                {props.title ?? "内容预览"}
              </h2>
              <p class="mt-1 text-xs text-[#6b7280]">
                沉浸式全屏查看，支持 Markdown 渲染与源码切换，按 ESC 可关闭。
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <div class="flex items-center gap-1 rounded-xl bg-[#f2f4f6] p-1">
                <button
                  type="button"
                  class={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode() === "markdown"
                      ? "bg-white text-[#191c1e] shadow-sm"
                      : "text-[#464555] hover:text-[#191c1e]"
                  }`}
                  onClick={() => setViewMode("markdown")}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  class={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode() === "source"
                      ? "bg-white text-[#191c1e] shadow-sm"
                      : "text-[#464555] hover:text-[#191c1e]"
                  }`}
                  onClick={() => setViewMode("source")}
                >
                  源码
                </button>
              </div>

              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3 py-2 text-xs font-medium text-[#464555] transition-colors hover:bg-[#e6e8ea]"
                onClick={handleCopy}
              >
                <Show when={!copied()} fallback={<span class="text-emerald-600">已复制</span>}>
                  <svg
                    class="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  复制
                </Show>
              </button>

              <button
                type="button"
                aria-label="关闭预览"
                class="inline-flex items-center gap-1.5 rounded-xl bg-[#191c1e] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2f3336]"
                onclick={props.onClose}
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                关闭
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div class="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-[1.75rem] border border-[rgba(199,196,216,0.28)] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div class="flex items-center justify-between gap-3 border-b border-[rgba(199,196,216,0.18)] bg-[rgba(248,250,252,0.95)] px-5 py-3">
                <span class="text-xs font-medium text-[#6b7280]">
                  当前模式: {viewMode() === "markdown" ? "Markdown 渲染" : "源码查看"}
                </span>
                <span class="text-xs text-[#9aa1ad]">{props.content.length.toLocaleString()} 字</span>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
                <Show
                  when={viewMode() === "markdown"}
                  fallback={
                    <pre class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[#191c1e]">
                      {props.content}
                    </pre>
                  }
                >
                  {renderMarkdown(props.content)}
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
