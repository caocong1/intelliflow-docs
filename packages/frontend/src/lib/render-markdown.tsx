import { For, Match, Switch } from "solid-js";
import { sanitizeHtml } from "./sanitize";

/** Simple markdown to HTML: headers, bold, italic, lists, paragraphs */
export function renderMarkdown(text: string) {
  if (!text) return <div class="text-[#464555] text-sm italic">暂无内容</div>;

  const lines = text.split("\n");
  const elements: Array<{ type: string; content: string; level?: number }> = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      elements.push({ type: "header", content: headerMatch[2], level: headerMatch[1].length });
      continue;
    }

    if (line.match(/^\s*[-*]\s+/)) {
      elements.push({ type: "li", content: line.replace(/^\s*[-*]\s+/, "") });
      continue;
    }

    if (line.match(/^\s*\d+\.\s+/)) {
      elements.push({ type: "oli", content: line.replace(/^\s*\d+\.\s+/, "") });
      continue;
    }

    if (line.trim() === "") {
      elements.push({ type: "br", content: "" });
      continue;
    }

    elements.push({ type: "p", content: line });
  }

  function inlineFormat(text: string) {
    let result = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
    result = result.replace(
      /`(.+?)`/g,
      '<code class="px-1 py-0.5 bg-[#f7f9fb] rounded text-sm font-mono">$1</code>',
    );
    return result;
  }

  return (
    <div class="prose prose-sm max-w-none">
      <For each={elements}>
        {(el) => (
          <Switch
            fallback={
              <p
                class="text-sm text-[#191c1e] leading-relaxed"
                innerHTML={sanitizeHtml(inlineFormat(el.content))}
              />
            }
          >
            <Match when={el.type === "header" && el.level === 1}>
              {/* biome-ignore lint/a11y/useHeadingContent: content injected via innerHTML */}
              <h1
                class="text-xl font-bold text-[#191c1e] mt-4 mb-2"
                innerHTML={sanitizeHtml(inlineFormat(el.content))}
              />
            </Match>
            <Match when={el.type === "header" && el.level === 2}>
              {/* biome-ignore lint/a11y/useHeadingContent: content injected via innerHTML */}
              <h2
                class="text-lg font-semibold text-[#191c1e] mt-3 mb-1.5"
                innerHTML={sanitizeHtml(inlineFormat(el.content))}
              />
            </Match>
            <Match when={el.type === "header" && (el.level ?? 3) >= 3}>
              {/* biome-ignore lint/a11y/useHeadingContent: content injected via innerHTML */}
              <h3
                class="text-base font-medium text-[#191c1e] mt-2 mb-1"
                innerHTML={sanitizeHtml(inlineFormat(el.content))}
              />
            </Match>
            <Match when={el.type === "li"}>
              <div class="flex gap-2 ml-4 text-sm text-[#191c1e]">
                <span class="text-[#464555] select-none">-</span>
                <span innerHTML={sanitizeHtml(inlineFormat(el.content))} />
              </div>
            </Match>
            <Match when={el.type === "oli"}>
              <div class="flex gap-2 ml-4 text-sm text-[#191c1e]">
                <span innerHTML={sanitizeHtml(inlineFormat(el.content))} />
              </div>
            </Match>
            <Match when={el.type === "br"}>
              <div class="h-2" />
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}
