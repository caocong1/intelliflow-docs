import { For, createMemo } from "solid-js";

/** Highlight placeholder tokens like [NAME_1] with amber background */
export default function HighlightedText(props: { text: string }) {
  const parts = createMemo(() => {
    const result: Array<{ type: "text" | "placeholder"; value: string }> = [];
    const regex = /\[([A-Z_]+\d*)\]/g;
    let last = 0;
    let match: RegExpExecArray | null;
    const t = props.text;
    // biome-ignore lint/suspicious/noAssignInExpressions: intentional loop pattern
    while ((match = regex.exec(t)) !== null) {
      if (match.index > last) {
        result.push({ type: "text", value: t.slice(last, match.index) });
      }
      result.push({ type: "placeholder", value: match[0] });
      last = match.index + match[0].length;
    }
    if (last < t.length) {
      result.push({ type: "text", value: t.slice(last) });
    }
    return result;
  });

  return (
    <span>
      <For each={parts()}>
        {(part) =>
          part.type === "placeholder" ? (
            <span class="bg-amber-100 text-amber-800 px-0.5 rounded font-mono text-xs" data-placeholder={part.value}>
              {part.value}
            </span>
          ) : (
            <span>{part.value}</span>
          )
        }
      </For>
    </span>
  );
}
