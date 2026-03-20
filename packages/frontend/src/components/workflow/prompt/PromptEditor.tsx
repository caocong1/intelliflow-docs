import { For, Show, createSignal, onCleanup } from "solid-js";
import type { VariableRef } from "@intelliflow/shared";
import type { FlowNodeData } from "../../../lib/flow-engine/types";
import VariablePicker from "./VariablePicker";
import PromptOptimizeDialog from "./PromptOptimizeDialog";

// Colors per node type for tag rendering in preview
const NODE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  input_transform: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  desensitize: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  model_call: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  restore: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  export: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
  system: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" },
};

const SYSTEM_VAR_NAMES = new Set(["工作目录", "输入目录", "输出目录", "脱敏规则"]);

interface PromptEditorProps {
  value: string;
  availableVariables: VariableRef[];
  upstreamNodes: FlowNodeData[];
  onChange: (value: string) => void;
}

interface ParsedSegment {
  type: "text" | "variable";
  content: string;
  nodeType?: string;
}

/** Parse prompt template string into text/variable segments */
function parsePrompt(template: string, upstreamNodes: FlowNodeData[]): ParsedSegment[] {
  const parts: ParsedSegment[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: template.slice(lastIndex, match.index) });
    }
    const varName = match[1].trim();
    const nodeType = resolveNodeType(varName, upstreamNodes);
    parts.push({ type: "variable", content: varName, nodeType });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < template.length) {
    parts.push({ type: "text", content: template.slice(lastIndex) });
  }

  return parts;
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

export default function PromptEditor(props: PromptEditorProps) {
  const [showPicker, setShowPicker] = createSignal(false);
  const [showOptimize, setShowOptimize] = createSignal(false);
  const [textareaRef, setTextareaRef] = createSignal<HTMLTextAreaElement | null>(null);

  function handleInput(e: InputEvent & { currentTarget: HTMLTextAreaElement }) {
    const newValue = e.currentTarget.value;
    props.onChange(newValue);

    // Detect {{ trigger
    const cursorPos = e.currentTarget.selectionStart ?? newValue.length;
    const textBefore = newValue.slice(0, cursorPos);
    if (textBefore.endsWith("{{")) {
      setShowPicker(true);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && showPicker()) {
      setShowPicker(false);
      e.preventDefault();
    }
  }

  function insertVariable(variableName: string) {
    const textarea = textareaRef();
    if (!textarea) {
      // Append to end
      const currentValue = props.value;
      // Remove the trailing {{ if present
      const newValue = currentValue.endsWith("{{")
        ? currentValue.slice(0, -2) + `{{${variableName}}}`
        : currentValue + `{{${variableName}}}`;
      props.onChange(newValue);
      setShowPicker(false);
      return;
    }

    const cursorPos = textarea.selectionStart ?? props.value.length;
    const before = props.value.slice(0, cursorPos);
    const after = props.value.slice(cursorPos);

    // Remove trailing {{ if present (the trigger)
    const cleanBefore = before.endsWith("{{") ? before.slice(0, -2) : before;
    const newValue = `${cleanBefore}{{${variableName}}}${after}`;
    props.onChange(newValue);
    setShowPicker(false);

    // Restore focus + cursor after variable insertion
    setTimeout(() => {
      textarea.focus();
      const newCursor = cleanBefore.length + variableName.length + 4; // 4 for {{ and }}
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  }

  function handleOpenPicker() {
    setShowPicker(true);
  }

  // Close picker on outside click
  function handleBlur() {
    // Delay so click on picker items can fire first
    setTimeout(() => {
      setShowPicker(false);
    }, 150);
  }

  const segments = () => parsePrompt(props.value, props.upstreamNodes);
  const hasVariables = () => props.availableVariables.length > 0 || true; // always show system vars

  return (
    <div class="space-y-2">
      {/* Textarea with trigger detection */}
      <div class="relative">
        <textarea
          ref={setTextareaRef}
          value={props.value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="输入提示词模板。输入 {{ 可插入节点输出引用，例如：{{输入转换.原始文本}}"
          rows={6}
          class="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-md bg-white text-slate-800 placeholder-slate-400 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
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
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>插入节点输出</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          插入节点输出
        </button>

        <Show when={props.value.trim().length > 0}>
          <button
            type="button"
            onClick={() => setShowOptimize(true)}
            class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>优化提示词</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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
        onAccept={(text) => props.onChange(text)}
      />

      {/* Preview with colored tags */}
      <Show when={props.value.includes("{{")}>
        <div class="border border-slate-100 rounded-md p-2.5 bg-slate-50">
          <p class="text-xs text-slate-400 mb-1.5 font-medium">预览</p>
          <div class="text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap break-all">
            <For each={segments()}>
              {(segment) => {
                if (segment.type === "text") {
                  return <span>{segment.content}</span>;
                }
                const colors = NODE_TYPE_COLORS[segment.nodeType ?? "system"] ?? NODE_TYPE_COLORS.system;
                return (
                  <span
                    class={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mx-0.5 ${colors.bg} ${colors.text} ${colors.border}`}
                  >
                    {segment.content}
                  </span>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      <p class="text-xs text-slate-400">
        输入 <code class="bg-slate-100 px-1 rounded font-mono">{"{{"}  </code> 触发节点输出选择器
      </p>
    </div>
  );
}
