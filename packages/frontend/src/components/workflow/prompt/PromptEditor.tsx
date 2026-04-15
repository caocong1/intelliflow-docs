import type { OutputDef, VariableRef } from "@intelliflow/shared";
import { Show, createEffect, createSignal } from "solid-js";
import type { FlowNodeData } from "../../../lib/flow-engine/types";
import { sanitizeHtml } from "../../../lib/sanitize";
import PromptOptimizeDialog from "./PromptOptimizeDialog";
import VariablePicker, { buildPickerItems } from "./VariablePicker";

// Colors per node type for inline tag rendering
const NODE_TYPE_TAG_CLASSES: Record<string, string> = {
  input_transform: "bg-blue-100 text-blue-700 border-blue-200",
  desensitize: "bg-orange-100 text-orange-700 border-orange-200",
  model_call: "bg-purple-100 text-purple-700 border-purple-200",
  restore: "bg-green-100 text-green-700 border-green-200",
  export: "bg-red-100 text-red-700 border-red-200",
  system: "bg-gray-100 text-gray-600 border-gray-200",
};

interface PromptEditorProps {
  value: string;
  availableVariables: VariableRef[];
  upstreamNodes: FlowNodeData[];
  onChange: (value: string) => void;
}

/**
 * Parse a variable key into its components: nodeId, segmentKey, and optional fieldPath.
 * Supports: "nodeId.segmentKey" and "nodeId.segmentKey.field.path[0].nested"
 */
function parseVarKey(varKey: string): { nodeId: string; segmentKey: string; fieldPath: string } {
  const firstDot = varKey.indexOf(".");
  if (firstDot < 0) return { nodeId: varKey, segmentKey: "", fieldPath: "" };
  const nodeId = varKey.slice(0, firstDot);
  const rest = varKey.slice(firstDot + 1);
  // Second dot separates segmentKey from fieldPath
  const secondDot = rest.indexOf(".");
  // Also check for bracket notation directly after segmentKey (e.g. "output[0].name")
  const bracketIndex = rest.indexOf("[");
  // Find the earliest separator (dot or bracket)
  let splitAt = -1;
  if (secondDot >= 0 && bracketIndex >= 0) {
    splitAt = Math.min(secondDot, bracketIndex);
  } else if (secondDot >= 0) {
    splitAt = secondDot;
  } else if (bracketIndex >= 0) {
    splitAt = bracketIndex;
  }

  if (splitAt < 0) {
    return { nodeId, segmentKey: rest, fieldPath: "" };
  }
  const segmentKey = rest.slice(0, splitAt);
  // For dot separator, skip the dot; for bracket, keep it
  const fieldPath = rest[splitAt] === "." ? rest.slice(splitAt + 1) : rest.slice(splitAt);
  return { nodeId, segmentKey, fieldPath };
}

/**
 * Resolve a variable key to its display name.
 * Supports multi-level fieldPath: "nodeId.segmentKey.field.path" -> "nodeLabel.outputName.field.path"
 * Falls back to the raw key if the node/output can't be found.
 */
function resolveVarDisplayName(varKey: string, upstreamNodes: FlowNodeData[]): string {
  const { nodeId, segmentKey, fieldPath } = parseVarKey(varKey);
  if (!segmentKey) return varKey;

  const node = upstreamNodes.find((n) => n.id === nodeId);
  if (!node) return varKey;
  const outputs = node.data.outputs as OutputDef[];
  // Look up by segmentKey first, then by id for backward compatibility
  const output =
    outputs.find((o) => o.segmentKey === segmentKey) ?? outputs.find((o) => o.id === segmentKey);
  const baseName = output
    ? `${node.data.label}.${output.name}`
    : `${node.data.label}.${segmentKey}`;

  if (!fieldPath) return baseName;
  // For long paths, abbreviate: "nodeLabel.output...leafField"
  const fullDisplay = `${baseName}.${fieldPath}`;
  if (fullDisplay.length > 35) {
    const lastDot = fieldPath.lastIndexOf(".");
    const lastBracket = fieldPath.lastIndexOf("].");
    const leafStart = Math.max(lastDot, lastBracket >= 0 ? lastBracket + 1 : -1);
    const leaf = leafStart >= 0 ? fieldPath.slice(leafStart + 1) : fieldPath;
    return `${baseName}...${leaf}`;
  }
  return fullDisplay;
}

/**
 * Resolve a variable key to its full (non-abbreviated) display name.
 * Used for tooltips when the abbreviated display name is truncated.
 */
function resolveVarFullDisplayName(varKey: string, upstreamNodes: FlowNodeData[]): string {
  const { nodeId, segmentKey, fieldPath } = parseVarKey(varKey);
  if (!segmentKey) return varKey;

  const node = upstreamNodes.find((n) => n.id === nodeId);
  if (!node) return varKey;
  const outputs = node.data.outputs as OutputDef[];
  const output =
    outputs.find((o) => o.segmentKey === segmentKey) ?? outputs.find((o) => o.id === segmentKey);
  const baseName = output
    ? `${node.data.label}.${output.name}`
    : `${node.data.label}.${segmentKey}`;
  return fieldPath ? `${baseName}.${fieldPath}` : baseName;
}

/** Resolve which node type owns this variable key (nodeId.segmentKey) */
function resolveNodeType(varKey: string, upstreamNodes: FlowNodeData[]): string {
  const dotIndex = varKey.indexOf(".");
  if (dotIndex < 0) return "system";
  const nodeId = varKey.slice(0, dotIndex);
  const node = upstreamNodes.find((n) => n.id === nodeId);
  return node ? node.data.nodeType : "system";
}

/**
 * Build innerHTML for the contentEditable div from a raw template string.
 * Variables `{{...}}` become non-editable colored span tags.
 */
function buildEditorHTML(template: string, upstreamNodes: FlowNodeData[]): string {
  const regex = /\{\{([^}]+)\}\}/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  match = regex.exec(template);
  while (match !== null) {
    if (match.index > lastIndex) {
      // Escape plain text
      result += escapeHtml(template.slice(lastIndex, match.index));
    }
    const varKey = match[1].trim();
    const nodeType = resolveNodeType(varKey, upstreamNodes);
    const tagClasses = NODE_TYPE_TAG_CLASSES[nodeType] ?? NODE_TYPE_TAG_CLASSES.system;
    const displayName = resolveVarDisplayName(varKey, upstreamNodes);
    // For multi-level paths, add tooltip with full path when display is abbreviated
    const fullDisplayName = resolveVarFullDisplayName(varKey, upstreamNodes);
    const tooltipAttr =
      fullDisplayName !== displayName ? ` title="${escapeAttr(fullDisplayName)}"` : "";
    // data-var stores the stable ID key for serialization; text shows human-readable name
    result += `<span contenteditable="false" data-var="${escapeAttr(varKey)}"${tooltipAttr} class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mx-0.5 cursor-default select-none ${tagClasses}">${escapeHtml(displayName)}</span>`;
    lastIndex = match.index + match[0].length;
    match = regex.exec(template);
  }

  if (lastIndex < template.length) {
    result += escapeHtml(template.slice(lastIndex));
  }

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function serializeNodes(nodes: Iterable<Node>): string {
  let result = "";
  for (const child of Array.from(nodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent ?? "";
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const elem = child as HTMLElement;
      if (elem.tagName === "BR") {
        result += "\n";
      } else if (elem.dataset.var !== undefined) {
        result += `{{${elem.dataset.var}}}`;
      } else {
        // Recurse into other elements (e.g. div inserted by browser on Enter)
        result += `\n${serializeNodes(elem.childNodes)}`;
      }
    }
  }
  return result;
}

/**
 * Serialize the contentEditable DOM back to a raw template string.
 * Iterates child nodes: text nodes → plain text, span[data-var] → {{varName}}, br → \n.
 */
function serializeEditorContent(el: ParentNode): string {
  return serializeNodes(el.childNodes);
}

export default function PromptEditor(props: PromptEditorProps) {
  const [showPicker, setShowPicker] = createSignal(false);
  const [showOptimize, setShowOptimize] = createSignal(false);
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  let editorRef: HTMLDivElement | undefined;
  // Track if we're updating programmatically to avoid re-entrant updates
  let isUpdatingFromProp = false;
  let blurTimer: ReturnType<typeof setTimeout> | undefined;
  // Preserve the editor caret across picker modal open/close. Opening the Modal
  // moves focus away from the contentEditable, so keep the caret as a raw
  // template offset instead of depending on a stale DOM Range object.
  let savedCaretOffset: number | null = null;

  function isRangeInsideEditor(range: Range): boolean {
    if (!editorRef) return false;
    const start = range.startContainer;
    return start === editorRef || editorRef.contains(start);
  }

  function getNodeRawLength(node: Node): number {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.length ?? 0;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return 0;
    }

    const elem = node as HTMLElement;
    if (elem.tagName === "BR") {
      return 1;
    }
    if (elem.dataset.var !== undefined) {
      return `{{${elem.dataset.var}}}`.length;
    }
    return 1 + serializeNodes(elem.childNodes).length;
  }

  function getPointOffsetWithinNode(node: Node, offset: number): number {
    if (node.nodeType === Node.TEXT_NODE) {
      return Math.min(offset, node.textContent?.length ?? 0);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return 0;
    }

    const elem = node as HTMLElement;
    if (elem.tagName === "BR") {
      return offset > 0 ? 1 : 0;
    }
    if (elem.dataset.var !== undefined) {
      return offset > 0 ? `{{${elem.dataset.var}}}`.length : 0;
    }

    let total = 1;
    const childNodes = Array.from(elem.childNodes);
    for (let i = 0; i < Math.min(offset, childNodes.length); i += 1) {
      total += getNodeRawLength(childNodes[i]);
    }
    return total;
  }

  function getPointOffset(
    container: Node,
    offset: number,
    root: ParentNode | undefined = editorRef,
  ): number | null {
    if (!editorRef || !root) return null;

    if (root === container) {
      let total = 0;
      const childNodes = Array.from(root.childNodes);
      for (let i = 0; i < Math.min(offset, childNodes.length); i += 1) {
        total += getNodeRawLength(childNodes[i]);
      }
      return total;
    }

    let total = 0;
    for (const child of Array.from(root.childNodes)) {
      if (child === container) {
        return total + getPointOffsetWithinNode(child, offset);
      }

      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (child as HTMLElement).dataset.var === undefined &&
        (child as HTMLElement).tagName !== "BR" &&
        (child as HTMLElement).contains(container)
      ) {
        const nestedOffset = getPointOffset(container, offset, child as ParentNode);
        if (nestedOffset !== null) {
          return total + 1 + nestedOffset;
        }
      }

      total += getNodeRawLength(child);
    }

    return null;
  }

  function getRangeOffsets(range: Range): { start: number; end: number } | null {
    if (!editorRef || !isRangeInsideEditor(range)) return null;
    const start = getPointOffset(range.startContainer, range.startOffset);
    const end = getPointOffset(range.endContainer, range.endOffset);
    if (start === null || end === null) return null;

    return {
      start,
      end,
    };
  }

  function saveEditorCaret() {
    if (!editorRef) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const offsets = getRangeOffsets(range);
    if (offsets) {
      savedCaretOffset = offsets.start;
    }
  }

  function restoreCaret(offset: number) {
    if (!editorRef) return;

    let remaining = Math.max(0, offset);
    const parentOffsets = new Map<Node, number>();

    for (const child of Array.from(editorRef.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? "";
        if (remaining <= text.length) {
          const range = document.createRange();
          range.setStart(child, remaining);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          return;
        }
        remaining -= text.length;
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const elem = child as HTMLElement;
      const parent = elem.parentNode ?? editorRef;
      const nodeIndex =
        parentOffsets.get(parent) ?? Array.prototype.indexOf.call(parent.childNodes, child);
      parentOffsets.set(parent, nodeIndex + 1);

      if (elem.dataset.var !== undefined) {
        const tokenLength = `{{${elem.dataset.var}}}`.length;
        if (remaining <= tokenLength) {
          const range = document.createRange();
          range.setStart(parent, remaining === 0 ? nodeIndex : nodeIndex + 1);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          return;
        }
        remaining -= tokenLength;
        continue;
      }

      if (elem.tagName === "BR") {
        if (remaining <= 1) {
          const range = document.createRange();
          range.setStart(parent, nodeIndex + 1);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          return;
        }
        remaining -= 1;
      }
    }

    const range = document.createRange();
    range.selectNodeContents(editorRef);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  /** Convert a VariableRef to the storage key used in {{...}}. Includes fieldPath if present. */
  function refToStorageKey(ref: VariableRef): string {
    const base = `${ref.nodeId}.${ref.outputId}`;
    return ref.fieldPath ? `${base}.${ref.fieldPath}` : base;
  }

  // Update DOM when value prop changes externally (e.g. after optimize)
  // We use a simple comparison — only update if serialized content differs
  function syncEditorFromProp() {
    if (!editorRef) return;
    const current = serializeEditorContent(editorRef);
    if (current !== props.value) {
      isUpdatingFromProp = true;
      const html = sanitizeHtml(buildEditorHTML(props.value, props.upstreamNodes));
      editorRef.innerHTML = html;
      // Move cursor to end
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(editorRef);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      isUpdatingFromProp = false;
    }
  }

  function handleInput() {
    if (isUpdatingFromProp || !editorRef) return;
    const raw = serializeEditorContent(editorRef);
    props.onChange(raw);

    // Detect {{ trigger for picker
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const textBefore = (node.textContent ?? "").slice(0, range.startOffset);
        if (textBefore.endsWith("{{")) {
          // Remove the {{ trigger characters immediately
          const textNode = node as Text;
          textNode.textContent =
            textBefore.slice(0, -2) + (textNode.textContent ?? "").slice(range.startOffset);
          // Reposition cursor where {{ was
          const newOffset = textBefore.length - 2;
          range.setStart(textNode, newOffset);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          // Sync the raw value without {{
          if (editorRef) {
            const raw = serializeEditorContent(editorRef);
            props.onChange(raw);
          }

          setHighlightedIndex(0);
          setShowPicker(true);
          saveEditorCaret();
        }
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Keyboard navigation when picker is open
    if (showPicker()) {
      const items = buildPickerItems(props.upstreamNodes);
      if (e.key === "Escape") {
        setShowPicker(false);
        e.preventDefault();
        return;
      }
      if (items.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter" && items.length > 0) {
        e.preventDefault();
        const item = items[highlightedIndex()];
        if (item) {
          // Use segmentKey for storage, fall back to output.id
          const storageKey = `${item.node.id}.${item.output.segmentKey || item.output.id}`;
          insertVariable(storageKey);
        }
        return;
      }
    }

    // Handle backspace/delete near tag spans
    if ((e.key === "Backspace" || e.key === "Delete") && editorRef) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      if (range.collapsed) {
        let targetNode: Node | null = null;

        if (e.key === "Backspace") {
          // Check node immediately before cursor
          if (range.startOffset === 0) {
            targetNode = range.startContainer.previousSibling;
          } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
            // Normal backspace in text — let browser handle it
            return;
          }
        } else {
          // Delete: check node immediately after cursor
          if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
            const elem = range.startContainer as HTMLElement;
            targetNode = elem.childNodes[range.startOffset] ?? null;
          }
        }

        if (targetNode && (targetNode as HTMLElement).dataset?.var !== undefined) {
          e.preventDefault();
          targetNode.parentNode?.removeChild(targetNode);
          // Notify parent
          const raw = serializeEditorContent(editorRef);
          props.onChange(raw);
        }
      } else {
        // Selection spans content — let browser handle, then sync
        setTimeout(() => {
          if (editorRef) {
            const raw = serializeEditorContent(editorRef);
            props.onChange(raw);
          }
        }, 0);
      }
    }
  }

  function handleBlur() {
    clearTimeout(blurTimer);
    if (showPicker()) return;
    blurTimer = setTimeout(() => setShowPicker(false), 150);
  }

  function insertVariable(variableName: string) {
    const variableToken = `{{${variableName}}}`;

    if (!editorRef) {
      // Fallback: append to raw value
      props.onChange(`${props.value}${variableToken}`);
      setShowPicker(false);
      savedCaretOffset = null;
      setTimeout(syncEditorFromProp, 0);
      return;
    }

    const sel = window.getSelection();
    const currentRange =
      sel && sel.rangeCount > 0 && isRangeInsideEditor(sel.getRangeAt(0))
        ? sel.getRangeAt(0)
        : null;
    const currentOffsets = currentRange ? getRangeOffsets(currentRange) : null;
    const insertStart =
      currentOffsets?.start ?? savedCaretOffset ?? serializeEditorContent(editorRef).length;
    const insertEnd = currentOffsets?.end ?? insertStart;
    const raw = serializeEditorContent(editorRef);
    const nextValue = `${raw.slice(0, insertStart)}${variableToken}${raw.slice(insertEnd)}`;

    props.onChange(nextValue);
    setShowPicker(false);
    savedCaretOffset = null;
    setTimeout(() => {
      syncEditorFromProp();
      editorRef?.focus();
      restoreCaret(insertStart + variableToken.length);
    }, 0);
  }

  function handleOpenPicker() {
    clearTimeout(blurTimer);
    setHighlightedIndex(0);
    setShowPicker(true);
  }

  // Initialize editor content on mount
  function initEditor(el: HTMLDivElement) {
    editorRef = el;
    el.innerHTML = sanitizeHtml(buildEditorHTML(props.value, props.upstreamNodes));
  }

  // Reactively sync editor when value or upstream node outputs change
  // JSON.stringify ensures deep tracking of output names through SolidJS store proxies
  createEffect(() => {
    const _value = props.value;
    const _outputs = JSON.stringify(props.upstreamNodes.map((n) => n.data.outputs));
    if (!editorRef) return;
    // Only rebuild innerHTML when the external value differs from what the editor has,
    // avoiding cursor-position destruction on every keystroke
    syncEditorFromProp();
  });

  const hasVariables = () => props.availableVariables.length > 0 || true;

  return (
    <div class="space-y-2">
      {/* contentEditable prompt editor */}
      <div class="relative">
        <div
          ref={initEditor}
          contentEditable={true}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={saveEditorCaret}
          onMouseUp={saveEditorCaret}
          onBlur={handleBlur}
          data-placeholder="输入提示词模板。输入 {{ 可插入节点输出引用"
          class="w-full min-h-[120px] text-xs px-2.5 py-2 border border-slate-200 rounded-md bg-white text-slate-800 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 whitespace-pre-wrap break-words [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-slate-400 [&:empty]:before:pointer-events-none"
          style={{ "min-height": "120px" }}
        />

        {/* Variable Picker dropdown */}
        <Show when={showPicker() && hasVariables()}>
          <VariablePicker
            upstreamNodes={props.upstreamNodes}
            highlightedIndex={highlightedIndex()}
            onSelect={(_name, ref) => {
              if (ref) {
                insertVariable(refToStorageKey(ref));
              }
            }}
            onClose={() => setShowPicker(false)}
          />
        </Show>
      </div>

      {/* Action Buttons */}
      <div class="flex items-center gap-2">
        <button
          type="button"
          onMouseDown={saveEditorCaret}
          onClick={handleOpenPicker}
          class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>插入节点输出</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
            />
          </svg>
          插入节点输出
        </button>

        <Show when={props.value.trim().length > 0}>
          <button
            type="button"
            onClick={() => setShowOptimize(true)}
            class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>优化提示词</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            优化提示词
          </button>
        </Show>
      </div>

      {/* Prompt Optimize Dialog */}
      <PromptOptimizeDialog
        open={showOptimize()}
        currentPrompt={props.value}
        onClose={() => setShowOptimize(false)}
        onAccept={(text) => {
          props.onChange(text);
          // Sync editor display after external update
          setTimeout(syncEditorFromProp, 0);
        }}
      />

      <p class="text-xs text-slate-400">
        输入 <code class="bg-slate-100 px-1 rounded font-mono">{"{{"} </code> 触发节点输出选择器
      </p>
    </div>
  );
}
