import { Show, createSignal } from "solid-js";

interface Props {
  content: string;
  onChange: (content: string) => void;
  readOnly: boolean;
  placeholder?: string;
}

/** Simple markdown to HTML for preview */
function markdownToHtml(text: string): string {
  if (!text) return '<p class="text-[rgba(70,69,85,0.4)] italic">暂无内容</p>';

  let html = text;

  // Escape HTML entities first
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Code blocks (triple backtick)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-[#f7f9fb] rounded-xl p-3 my-2 overflow-x-auto"><code class="text-sm font-mono text-[#464555]">$2</code></pre>',
  );

  // Headers
  html = html.replace(
    /^######\s+(.+)$/gm,
    '<h6 class="text-xs font-semibold text-[#191c1e] mt-3 mb-1">$1</h6>',
  );
  html = html.replace(
    /^#####\s+(.+)$/gm,
    '<h5 class="text-sm font-semibold text-[#191c1e] mt-3 mb-1">$1</h5>',
  );
  html = html.replace(
    /^####\s+(.+)$/gm,
    '<h4 class="text-sm font-bold text-[#191c1e] mt-3 mb-1">$1</h4>',
  );
  html = html.replace(
    /^###\s+(.+)$/gm,
    '<h3 class="text-base font-medium text-[#191c1e] mt-3 mb-1">$1</h3>',
  );
  html = html.replace(
    /^##\s+(.+)$/gm,
    '<h2 class="text-lg font-semibold text-[#191c1e] mt-4 mb-1.5">$1</h2>',
  );
  html = html.replace(
    /^#\s+(.+)$/gm,
    '<h1 class="text-xl font-bold text-[#191c1e] mt-4 mb-2">$1</h1>',
  );

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(
    /`(.+?)`/g,
    '<code class="px-1 py-0.5 bg-[#f7f9fb] rounded text-sm font-mono text-[#464555]">$1</code>',
  );

  // Unordered lists
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 text-sm text-[#191c1e]">$1</li>');

  // Ordered lists
  html = html.replace(
    /^\s*\d+\.\s+(.+)$/gm,
    '<li class="ml-4 text-sm text-[#191c1e] list-decimal">$1</li>',
  );

  // Paragraphs: wrap remaining non-tag lines
  html = html
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<div class="h-2"></div>';
      if (trimmed.startsWith("<")) return line;
      return `<p class="text-sm text-[#191c1e] leading-relaxed">${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

type ViewMode = "edit" | "preview" | "split";

export default function InlineEditor(props: Props) {
  const [viewMode, setViewMode] = createSignal<ViewMode>(props.readOnly ? "preview" : "split");
  const [localContent, setLocalContent] = createSignal(props.content);
  const [focused, setFocused] = createSignal(false);

  function handleInput(value: string) {
    setLocalContent(value);
    props.onChange(value);
  }

  /** Insert markdown syntax at cursor position in textarea */
  function insertMarkdown(prefix: string, suffix: string) {
    const textarea = document.getElementById(
      "inline-editor-textarea",
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = localContent();
    const selected = text.slice(start, end);

    const newText = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    setLocalContent(newText);
    props.onChange(newText);

    // Restore cursor position after the inserted text
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function insertLinePrefix(prefix: string) {
    const textarea = document.getElementById(
      "inline-editor-textarea",
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = localContent();

    // Find line start
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);

    setLocalContent(newText);
    props.onChange(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  // Read-only: just show rendered preview
  if (props.readOnly) {
    return (
      <div class="border border-[rgba(199,196,216,0.3)] rounded-xl p-4 min-h-[200px] max-h-[60vh] overflow-y-auto bg-[#f7f9fb] shadow-[0_4px_16px_rgba(25,28,30,0.04)]">
        <div class="prose prose-sm max-w-none" innerHTML={markdownToHtml(localContent())} />
      </div>
    );
  }

  const wrapperClass = () =>
    [
      "rounded-xl overflow-hidden transition-all duration-150",
      focused()
        ? "ring-2 ring-[#c3c0ff] border border-[#4f46e5] shadow-[0_0_0_4px_rgba(195,192,255,0.15)]"
        : "border border-[rgba(199,196,216,0.3)] shadow-[0_4px_16px_rgba(25,28,30,0.04)] hover:border-[rgba(199,196,216,0.6)]",
    ].join(" ");

  return (
    <div class={wrapperClass()}>
      {/* Toolbar */}
      <div class="flex items-center gap-1 px-3 py-2 bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.2)]">
        {/* Formatting buttons */}
        <button
          type="button"
          class="p-1.5 rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] text-[#464555] text-xs font-bold transition-colors"
          title="加粗 (Ctrl+B)"
          onClick={() => insertMarkdown("**", "**")}
        >
          B
        </button>
        <button
          type="button"
          class="p-1.5 rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] text-[#464555] text-xs italic transition-colors"
          title="斜体 (Ctrl+I)"
          onClick={() => insertMarkdown("*", "*")}
        >
          I
        </button>
        <button
          type="button"
          class="p-1.5 rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] text-[#464555] text-xs font-mono transition-colors"
          title="代码"
          onClick={() => insertMarkdown("`", "`")}
        >
          {"<>"}
        </button>

        <div class="w-px h-4 bg-[rgba(199,196,216,0.4)] mx-1" />

        {/* Heading buttons */}
        <button
          type="button"
          class="px-1.5 py-1 rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] text-[#464555] text-xs font-semibold transition-colors"
          title="标题1"
          onClick={() => insertLinePrefix("# ")}
        >
          H1
        </button>
        <button
          type="button"
          class="px-1.5 py-1 rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] text-[#464555] text-xs font-semibold transition-colors"
          title="标题2"
          onClick={() => insertLinePrefix("## ")}
        >
          H2
        </button>
        <button
          type="button"
          class="px-1.5 py-1 rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] text-[#464555] text-xs font-semibold transition-colors"
          title="标题3"
          onClick={() => insertLinePrefix("### ")}
        >
          H3
        </button>

        <div class="w-px h-4 bg-[rgba(199,196,216,0.4)] mx-1" />

        {/* List buttons */}
        <button
          type="button"
          class="px-1.5 py-1 rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] text-[#464555] text-xs transition-colors"
          title="无序列表"
          onClick={() => insertLinePrefix("- ")}
        >
          列表
        </button>
        <button
          type="button"
          class="px-1.5 py-1 rounded-lg hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5] text-[#464555] text-xs transition-colors"
          title="有序列表"
          onClick={() => insertLinePrefix("1. ")}
        >
          1.
        </button>

        {/* View mode toggle -- right side */}
        <div class="ml-auto flex items-center gap-1">
          <button
            type="button"
            class={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              viewMode() === "edit"
                ? "bg-[#e2dfff] text-[#3525cd]"
                : "text-[#464555] hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5]"
            }`}
            onClick={() => setViewMode("edit")}
          >
            编辑
          </button>
          <button
            type="button"
            class={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              viewMode() === "split"
                ? "bg-[#e2dfff] text-[#3525cd]"
                : "text-[#464555] hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5]"
            }`}
            onClick={() => setViewMode("split")}
          >
            分栏
          </button>
          <button
            type="button"
            class={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              viewMode() === "preview"
                ? "bg-[#e2dfff] text-[#3525cd]"
                : "text-[#464555] hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4f46e5]"
            }`}
            onClick={() => setViewMode("preview")}
          >
            预览
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        class={`${viewMode() === "split" ? "grid grid-cols-2 divide-x divide-[rgba(199,196,216,0.2)]" : ""}`}
      >
        {/* Textarea */}
        <Show when={viewMode() !== "preview"}>
          <textarea
            id="inline-editor-textarea"
            value={localContent()}
            onInput={(e) => handleInput(e.currentTarget.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              // Ctrl+B / Cmd+B for bold
              if ((e.ctrlKey || e.metaKey) && e.key === "b") {
                e.preventDefault();
                insertMarkdown("**", "**");
              }
              // Ctrl+I / Cmd+I for italic
              if ((e.ctrlKey || e.metaKey) && e.key === "i") {
                e.preventDefault();
                insertMarkdown("*", "*");
              }
            }}
            placeholder={props.placeholder ?? "输入 Markdown 内容..."}
            class="w-full min-h-[200px] max-h-[60vh] p-4 text-sm font-mono text-[#191c1e] bg-white border-0 focus:outline-none focus:ring-0 resize-y placeholder:text-[rgba(70,69,85,0.4)]"
          />
        </Show>

        {/* Preview */}
        <Show when={viewMode() !== "edit"}>
          <div class="p-4 min-h-[200px] max-h-[60vh] overflow-y-auto bg-white">
            <div class="prose prose-sm max-w-none" innerHTML={markdownToHtml(localContent())} />
          </div>
        </Show>
      </div>
    </div>
  );
}
