import type { VariableRef } from "@intelliflow/shared";
import { Show, createSignal, onCleanup } from "solid-js";
import type { FlowNodeData } from "../../../lib/flow-engine/types";
import PromptOptimizeDialog from "./PromptOptimizeDialog";
import VariablePicker from "./VariablePicker";

// Colors per node type for inline tag rendering
const NODE_TYPE_TAG_CLASSES: Record<string, string> = {
  input_transform: "bg-blue-100 text-blue-700 border-blue-200",
  desensitize: "bg-orange-100 text-orange-700 border-orange-200",
  model_call: "bg-purple-100 text-purple-700 border-purple-200",
  restore: "bg-green-100 text-green-700 border-green-200",
  export: "bg-red-100 text-red-700 border-red-200",
  system: "bg-gray-100 text-gray-600 border-gray-200",
};

const SYSTEM_VAR_NAMES = new Set(["工作目录", "输入目录", "输出目录", "脱敏规则"]);

interface PromptEditorProps {
  value: string;
  availableVariables: VariableRef[];
  upstreamNodes: FlowNodeData[];
  onChange: (value: string) => void;
}

/** Resolve which node type owns this variable name */
function resolveNodeType(varName: string, upstreamNodes: FlowNodeData[]): string {
  if (SYSTEM_VAR_NAMES.has(varName)) return "system";
  for (const node of upstreamNodes) {
    const nodePrefix = `${node.data.label}.`;
    if (varName.startsWith(nodePrefix)) {
      return node.data.nodeType;
    }
  }
  return "system";
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
    const varName = match[1].trim();
    const nodeType = resolveNodeType(varName, upstreamNodes);
    const tagClasses = NODE_TYPE_TAG_CLASSES[nodeType] ?? NODE_TYPE_TAG_CLASSES.system;
    // data-var stores the raw template token for serialization
    result += `<span contenteditable="false" data-var="${escapeAttr(varName)}" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mx-0.5 cursor-default select-none ${tagClasses}">${escapeHtml(varName)}</span>`;
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

/**
 * Serialize the contentEditable DOM back to a raw template string.
 * Iterates child nodes: text nodes → plain text, span[data-var] → {{varName}}, br → \n.
 */
function serializeEditorContent(el: HTMLElement): string {
  let result = "";
  for (const child of Array.from(el.childNodes)) {
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
        result += `\n${serializeEditorContent(elem)}`;
      }
    }
  }
  return result;
}

export default function PromptEditor(props: PromptEditorProps) {
  const [showPicker, setShowPicker] = createSignal(false);
  const [showOptimize, setShowOptimize] = createSignal(false);
  let editorRef: HTMLDivElement | undefined;
  // Track if we're updating programmatically to avoid re-entrant updates
  let isUpdatingFromProp = false;

  // Update DOM when value prop changes externally (e.g. after optimize)
  // We use a simple comparison — only update if serialized content differs
  function syncEditorFromProp() {
    if (!editorRef) return;
    const current = serializeEditorContent(editorRef);
    if (current !== props.value) {
      isUpdatingFromProp = true;
      const html = buildEditorHTML(props.value, props.upstreamNodes);
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
          setShowPicker(true);
        }
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && showPicker()) {
      setShowPicker(false);
      e.preventDefault();
      return;
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
    setTimeout(() => setShowPicker(false), 150);
  }

  function insertVariable(variableName: string) {
    if (!editorRef) {
      // Fallback: append to raw value
      const currentValue = props.value;
      const newValue = currentValue.endsWith("{{")
        ? `${currentValue.slice(0, -2)}{{${variableName}}}`
        : `${currentValue}{{${variableName}}}`;
      props.onChange(newValue);
      setShowPicker(false);
      // Trigger sync
      setTimeout(syncEditorFromProp, 0);
      return;
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Remove trailing {{ from text node if present
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer as Text;
        const text = textNode.textContent ?? "";
        if (text.endsWith("{{")) {
          textNode.textContent = text.slice(0, -2);
          range.setStart(textNode, textNode.length);
          range.collapse(true);
        }
      }
      range.deleteContents();

      // Create tag span
      const nodeType = resolveNodeType(variableName, props.upstreamNodes);
      const tagClasses = NODE_TYPE_TAG_CLASSES[nodeType] ?? NODE_TYPE_TAG_CLASSES.system;
      const span = document.createElement("span");
      span.contentEditable = "false";
      span.dataset.var = variableName;
      span.className = `inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mx-0.5 cursor-default select-none ${tagClasses}`;
      span.textContent = variableName;
      range.insertNode(span);

      // Move cursor after the span
      const newRange = document.createRange();
      newRange.setStartAfter(span);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    // Sync raw value
    const raw = serializeEditorContent(editorRef);
    props.onChange(raw);
    setShowPicker(false);
    editorRef.focus();
  }

  function handleOpenPicker() {
    setShowPicker(true);
  }

  // Initialize editor content on mount
  function initEditor(el: HTMLDivElement) {
    editorRef = el;
    el.innerHTML = buildEditorHTML(props.value, props.upstreamNodes);
  }

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
          onBlur={handleBlur}
          data-placeholder="输入提示词模板。输入 {{ 可插入节点输出引用"
          class="w-full min-h-[120px] text-xs px-2.5 py-2 border border-slate-200 rounded-md bg-white text-slate-800 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 whitespace-pre-wrap break-words [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-slate-400 [&:empty]:before:pointer-events-none"
          style={{ "min-height": "120px" }}
        />

        {/* Variable Picker dropdown */}
        <Show when={showPicker() && hasVariables()}>
          <VariablePicker
            upstreamNodes={props.upstreamNodes}
            onSelect={(name) => insertVariable(name)}
            onClose={() => setShowPicker(false)}
          />
        </Show>
      </div>

      {/* Action Buttons */}
      <div class="flex items-center gap-2">
        <button
          type="button"
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
