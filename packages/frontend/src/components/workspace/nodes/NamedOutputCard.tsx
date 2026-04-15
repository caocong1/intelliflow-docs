import { Show, createEffect, createSignal } from "solid-js";
import { renderMarkdown } from "../../../lib/render-markdown";

interface NamedOutputCardProps {
  artifactId: string;
  artifactName: string;
  content: string;
  format: string;
  modelId: string;
  onContentChange?: (params: {
    artifactId: string;
    modelId: string;
    newContent: string;
  }) => void;
  readonly?: boolean;
}

const FORMAT_BADGES: Record<string, { label: string; class: string }> = {
  json: { label: "JSON", class: "bg-amber-50 text-amber-700 ring-amber-200" },
  markdown: { label: "Markdown", class: "bg-indigo-50 text-indigo-600 ring-indigo-200" },
  text: { label: "Text", class: "bg-gray-50 text-gray-600 ring-gray-200" },
};

export default function NamedOutputCard(props: NamedOutputCardProps) {
  const [editing, setEditing] = createSignal(false);
  const [localContent, setLocalContent] = createSignal(props.content);

  const badge = () => FORMAT_BADGES[props.format] ?? FORMAT_BADGES.text;
  const isJson = () => props.format === "json";

  createEffect(() => {
    if (!editing()) {
      setLocalContent(props.content);
    }
  });

  function handleSave() {
    props.onContentChange?.({
      artifactId: props.artifactId,
      modelId: props.modelId,
      newContent: localContent(),
    });
    setEditing(false);
  }

  function handleCancel() {
    setLocalContent(props.content);
    setEditing(false);
  }

  return (
    <div class="border border-[rgba(199,196,216,0.3)] rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(25,28,30,0.04)]">
      {/* Title bar */}
      <div class="flex items-center justify-between px-4 py-2.5 bg-[#f7f9fb] border-b border-[rgba(199,196,216,0.2)]">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-[#191c1e]">{props.artifactName}</span>
          <Show when={props.artifactId !== "_default"}>
            <span class="text-xs text-[#464555] font-mono">({props.artifactId})</span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${badge().class}`}
          >
            {badge().label}
          </span>
          <Show when={!props.readonly && !editing()}>
            <button
              type="button"
              class="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              onClick={() => setEditing(true)}
            >
              编辑
            </button>
          </Show>
        </div>
      </div>

      {/* Body */}
      <div class={`p-4 ${isJson() ? "bg-[#fafaf9]" : "bg-white"}`}>
        <Show
          when={editing()}
          fallback={
            <Show
              when={isJson()}
              fallback={
                <div class="min-h-[80px] max-h-[400px] overflow-y-auto">
                  {renderMarkdown(props.content || "(empty)")}
                </div>
              }
            >
              <pre class="text-sm font-mono text-[#191c1e] whitespace-pre-wrap leading-relaxed min-h-[80px] max-h-[400px] overflow-y-auto">
                {props.content || "(empty)"}
              </pre>
            </Show>
          }
        >
          <textarea
            value={localContent()}
            onInput={(e) => setLocalContent(e.currentTarget.value)}
            class={`w-full min-h-[120px] max-h-[400px] p-3 text-sm border border-[rgba(199,196,216,0.3)] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y ${
              isJson() ? "font-mono bg-[#fafaf9]" : "bg-white"
            }`}
          />
          <div class="flex items-center gap-2 mt-2">
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              onClick={handleSave}
            >
              保存
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium text-[#464555] border border-[rgba(199,196,216,0.3)] rounded-lg hover:bg-[#f7f9fb] transition-colors"
              onClick={handleCancel}
            >
              取消
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
