import { Show, createSignal } from "solid-js";
import { renderMarkdown } from "../../lib/render-markdown";

interface Props {
  content: string;
  title?: string;
  onClose: () => void;
}

export default function ContentPreviewModal(props: Props) {
  const [viewMode, setViewMode] = createSignal<"markdown" | "source">("markdown");
  const [copied, setCopied] = createSignal(false);

  function handleCopy() {
    navigator.clipboard.writeText(props.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(25,28,30,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
      }}
    >
      <div
        class="bg-white rounded-2xl w-full max-w-4xl mx-4 flex flex-col"
        style={{
          "max-height": "90vh",
          "box-shadow": "0 24px 64px rgba(25,28,30,0.16)",
        }}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-6 py-4 border-b border-[rgba(199,196,216,0.15)]">
          <h2 class="text-base font-bold text-[#191c1e]">{props.title ?? "内容预览"}</h2>
          <div class="flex items-center gap-2">
            {/* View mode toggle */}
            <div class="flex items-center gap-1 bg-[#f2f4f6] rounded-lg p-0.5">
              <button
                type="button"
                class={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
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
                class={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode() === "source"
                    ? "bg-white text-[#191c1e] shadow-sm"
                    : "text-[#464555] hover:text-[#191c1e]"
                }`}
                onClick={() => setViewMode("source")}
              >
                源码
              </button>
            </div>

            {/* Copy button */}
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#464555] bg-[#f2f4f6] rounded-lg hover:bg-[#e6e8ea] transition-colors"
              onClick={handleCopy}
            >
              <Show when={!copied()} fallback={<span class="text-emerald-600">已复制</span>}>
                <svg
                  class="w-3.5 h-3.5"
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

            {/* Close button */}
            <button
              type="button"
              class="p-1.5 text-[#464555] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-lg transition-colors"
              onClick={props.onClose}
            >
              <svg
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-8">
          <Show
            when={viewMode() === "markdown"}
            fallback={
              <pre class="text-sm text-[#191c1e] whitespace-pre-wrap font-mono leading-relaxed">
                {props.content}
              </pre>
            }
          >
            {renderMarkdown(props.content)}
          </Show>
        </div>
      </div>
    </div>
  );
}
