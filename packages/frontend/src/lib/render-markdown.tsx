import { For, Match, Show, Switch } from "solid-js";
import { sanitizeHtml } from "./sanitize";

/** Simple markdown to HTML: headers, bold, italic, lists, paragraphs */
export function renderMarkdown(text: string) {
  if (!text) return <div class="text-[#464555] text-sm italic">暂无内容</div>;

  const lines = text.split("\n");
  const elements: Array<{ type: string; content: string; level?: number; headers?: string[]; rows?: string[][] }> = [];

  const parseRow = (line: string) =>
    line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const isSep = (line: string) =>
    /^\|?[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|?$/.test(line.trim());

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Table block
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const hasSep = tableLines.length >= 2 && isSep(tableLines[1]);
      elements.push({
        type: "table",
        content: "",
        headers: hasSep ? parseRow(tableLines[0]) : [],
        rows: (hasSep ? tableLines.slice(2) : tableLines).filter((l) => !isSep(l)).map(parseRow),
      });
      continue;
    }

    // Code block
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      elements.push({ type: "code", content: codeLines.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push({ type: "hr", content: "" });
      i++;
      continue;
    }

    // Blockquote
    const bqMatch = line.match(/^>\s(.*)/);
    if (bqMatch) {
      elements.push({ type: "bq", content: bqMatch[1] });
      i++;
      continue;
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      elements.push({ type: "header", content: headerMatch[2], level: headerMatch[1].length });
      i++;
      continue;
    }

    if (line.match(/^\s*[-*]\s+/)) {
      elements.push({ type: "li", content: line.replace(/^\s*[-*]\s+/, "") });
      i++;
      continue;
    }

    if (line.match(/^\s*\d+\.\s+/)) {
      elements.push({ type: "oli", content: line.replace(/^\s*\d+\.\s+/, "") });
      i++;
      continue;
    }

    if (line.trim() === "") {
      elements.push({ type: "br", content: "" });
      i++;
      continue;
    }

    elements.push({ type: "p", content: line });
    i++;
  }

  function inlineFormat(text: string) {
    let result = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
    result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");
    result = result.replace(
      /`(.+?)`/g,
      '<code class="px-1 py-0.5 bg-[#f7f9fb] rounded text-sm font-mono">$1</code>',
    );
    result = result.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-[#4f46e5] underline">$1</a>',
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
            <Match when={el.type === "hr"}>
              <hr class="my-4 border-[rgba(199,196,216,0.3)]" />
            </Match>
            <Match when={el.type === "bq"}>
              <blockquote class="pl-3 border-l-4 border-[rgba(199,196,216,0.4)] text-[#464555] my-1 text-sm">
                <span innerHTML={sanitizeHtml(inlineFormat(el.content))} />
              </blockquote>
            </Match>
            <Match when={el.type === "code"}>
              <pre class="bg-[#f1f3f5] rounded-lg p-3 my-2 overflow-x-auto">
                <code class="text-sm font-mono whitespace-pre">{el.content}</code>
              </pre>
            </Match>
            <Match when={el.type === "table" && "headers" in el}>
              <div class="overflow-x-auto my-3">
                <table class="w-full text-sm border-collapse border border-[rgba(199,196,216,0.3)]">
                  <Show when={el.headers && el.headers.length > 0}>
                    <thead>
                      <tr>
                        <For each={el.headers}>
                          {(h) => (
                            <th
                              class="px-3 py-2 text-left font-semibold bg-[#f1f3f5] border border-[rgba(199,196,216,0.3)]"
                              innerHTML={sanitizeHtml(inlineFormat(h))}
                            />
                          )}
                        </For>
                      </tr>
                    </thead>
                  </Show>
                  <tbody>
                    <For each={el.rows}>
                      {(row) => (
                        <tr>
                          <For each={row}>
                            {(cell) => (
                              <td
                                class="px-3 py-2 border border-[rgba(199,196,216,0.3)]"
                                innerHTML={sanitizeHtml(inlineFormat(cell))}
                              />
                            )}
                          </For>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}
