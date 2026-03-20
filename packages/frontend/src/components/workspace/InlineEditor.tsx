import { createSignal, Show } from "solid-js";

interface Props {
  content: string;
  onChange: (content: string) => void;
  readOnly: boolean;
  placeholder?: string;
}

/** Simple markdown to HTML for preview */
function markdownToHtml(text: string): string {
  if (!text) return '<p class="text-gray-400 italic">No content</p>';

  let html = text;

  // Escape HTML entities first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (triple backtick)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-gray-100 rounded-lg p-3 my-2 overflow-x-auto"><code class="text-sm font-mono">$2</code></pre>',
  );

  // Headers
  html = html.replace(
    /^######\s+(.+)$/gm,
    '<h6 class="text-xs font-semibold text-gray-800 mt-3 mb-1">$1</h6>',
  );
  html = html.replace(
    /^#####\s+(.+)$/gm,
    '<h5 class="text-sm font-semibold text-gray-800 mt-3 mb-1">$1</h5>',
  );
  html = html.replace(
    /^####\s+(.+)$/gm,
    '<h4 class="text-sm font-bold text-gray-800 mt-3 mb-1">$1</h4>',
  );
  html = html.replace(
    /^###\s+(.+)$/gm,
    '<h3 class="text-base font-medium text-gray-800 mt-3 mb-1">$1</h3>',
  );
  html = html.replace(
    /^##\s+(.+)$/gm,
    '<h2 class="text-lg font-semibold text-gray-900 mt-4 mb-1.5">$1</h2>',
  );
  html = html.replace(
    /^#\s+(.+)$/gm,
    '<h1 class="text-xl font-bold text-gray-900 mt-4 mb-2">$1</h1>',
  );

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(
    /`(.+?)`/g,
    '<code class="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono">$1</code>',
  );

  // Unordered lists
  html = html.replace(
    /^\s*[-*]\s+(.+)$/gm,
    '<li class="ml-4 text-sm text-gray-800">$1</li>',
  );

  // Ordered lists
  html = html.replace(
    /^\s*\d+\.\s+(.+)$/gm,
    '<li class="ml-4 text-sm text-gray-800 list-decimal">$1</li>',
  );

  // Paragraphs: wrap remaining non-tag lines
  html = html
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<div class="h-2"></div>';
      if (trimmed.startsWith("<")) return line;
      return `<p class="text-sm text-gray-800 leading-relaxed">${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

type ViewMode = "edit" | "preview" | "split";

export default function InlineEditor(props: Props) {
  const [viewMode, setViewMode] = createSignal<ViewMode>(
    props.readOnly ? "preview" : "split",
  );
  const [localContent, setLocalContent] = createSignal(props.content);

  function handleInput(value: string) {
    setLocalContent(value);
    props.onChange(value);
  }

  /** Insert markdown syntax at cursor position in textarea */
  function insertMarkdown(prefix: string, suffix: string) {
    const textarea = document.getElementById("inline-editor-textarea") as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = localContent();
    const selected = text.slice(start, end);

    const newText =
      text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    setLocalContent(newText);
    props.onChange(newText);

    // Restore cursor position after the inserted text
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    });
  }

  function insertLinePrefix(prefix: string) {
    const textarea = document.getElementById("inline-editor-textarea") as HTMLTextAreaElement | null;
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
      <div class="border border-gray-200 rounded-lg p-4 min-h-[200px] max-h-[60vh] overflow-y-auto bg-gray-50">
        <div class="prose prose-sm max-w-none" innerHTML={markdownToHtml(localContent())} />
      </div>
    );
  }

  return (
    <div class="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
      {/* Toolbar */}
      <div class="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200">
        {/* Formatting buttons */}
        <button
          type="button"
          class="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs font-bold transition-colors"
          title="Bold (Ctrl+B)"
          onClick={() => insertMarkdown("**", "**")}
        >
          B
        </button>
        <button
          type="button"
          class="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs italic transition-colors"
          title="Italic (Ctrl+I)"
          onClick={() => insertMarkdown("*", "*")}
        >
          I
        </button>
        <button
          type="button"
          class="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs font-mono transition-colors"
          title="Code"
          onClick={() => insertMarkdown("`", "`")}
        >
          {"<>"}
        </button>

        <div class="w-px h-4 bg-gray-300 mx-1" />

        {/* Heading buttons */}
        <button
          type="button"
          class="px-1.5 py-1 rounded hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-colors"
          title="Heading 1"
          onClick={() => insertLinePrefix("# ")}
        >
          H1
        </button>
        <button
          type="button"
          class="px-1.5 py-1 rounded hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-colors"
          title="Heading 2"
          onClick={() => insertLinePrefix("## ")}
        >
          H2
        </button>
        <button
          type="button"
          class="px-1.5 py-1 rounded hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-colors"
          title="Heading 3"
          onClick={() => insertLinePrefix("### ")}
        >
          H3
        </button>

        <div class="w-px h-4 bg-gray-300 mx-1" />

        {/* List buttons */}
        <button
          type="button"
          class="px-1.5 py-1 rounded hover:bg-gray-200 text-gray-600 text-xs transition-colors"
          title="Bullet list"
          onClick={() => insertLinePrefix("- ")}
        >
          List
        </button>
        <button
          type="button"
          class="px-1.5 py-1 rounded hover:bg-gray-200 text-gray-600 text-xs transition-colors"
          title="Numbered list"
          onClick={() => insertLinePrefix("1. ")}
        >
          1.
        </button>

        {/* View mode toggle — right side */}
        <div class="ml-auto flex items-center gap-1">
          <button
            type="button"
            class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewMode() === "edit"
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-500 hover:bg-gray-200"
            }`}
            onClick={() => setViewMode("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewMode() === "split"
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-500 hover:bg-gray-200"
            }`}
            onClick={() => setViewMode("split")}
          >
            Split
          </button>
          <button
            type="button"
            class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewMode() === "preview"
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-500 hover:bg-gray-200"
            }`}
            onClick={() => setViewMode("preview")}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        class={`${viewMode() === "split" ? "grid grid-cols-2 divide-x divide-gray-200" : ""}`}
      >
        {/* Textarea */}
        <Show when={viewMode() !== "preview"}>
          <textarea
            id="inline-editor-textarea"
            value={localContent()}
            onInput={(e) => handleInput(e.currentTarget.value)}
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
            placeholder={props.placeholder ?? "Enter Markdown content..."}
            class="w-full min-h-[200px] max-h-[60vh] p-4 text-sm font-mono text-gray-800 bg-white border-0 focus:outline-none resize-y"
          />
        </Show>

        {/* Preview */}
        <Show when={viewMode() !== "edit"}>
          <div class="p-4 min-h-[200px] max-h-[60vh] overflow-y-auto bg-white">
            <div
              class="prose prose-sm max-w-none"
              innerHTML={markdownToHtml(localContent())}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
