import { createSignal, Show, For } from "solid-js";
import type { NodeCondition, NodeExecutionRule, VariableRef } from "@intelliflow/shared";
import type { FlowNodeData, FlowEdgeData } from "../../../lib/flow-engine/types";
import VariablePicker from "../prompt/VariablePicker";

interface ExecutionRuleEditorProps {
  rule: NodeExecutionRule | undefined;
  upstreamNodes: FlowNodeData[];
  edges: FlowEdgeData[];
  currentNodeId: string;
  onChange: (rule: NodeExecutionRule | undefined) => void;
}

const OPERATOR_OPTIONS: Array<{ value: NodeCondition["operator"]; label: string }> = [
  { value: "equals", label: "等于" },
  { value: "not_equals", label: "不等于" },
  { value: "exists", label: "存在" },
  { value: "not_exists", label: "不存在" },
  { value: "contains", label: "包含" },
];

function createEmptyCondition(): NodeCondition {
  return {
    sourceRef: { nodeId: "", outputId: "", variableName: "" },
    operator: "equals",
  };
}

function buildNewRule(conditions: NodeCondition[]): NodeExecutionRule {
  return {
    action: "skip",
    conditions,
    logic: "and",
  };
}

export default function ExecutionRuleEditor(props: ExecutionRuleEditorProps) {
  const [expanded, setExpanded] = createSignal(false);
  // Track which condition row has its picker open and which has its dropdown open
  const [openPickerFor, setOpenPickerFor] = createSignal<number | null>(null);
  const [openDropdownFor, setOpenDropdownFor] = createSignal<number | null>(null);
  // Track focused input ids for smart suggestion dropdown visibility
  const [focusedInputFor, setFocusedInputFor] = createSignal<number | null>(null);

  const hasRule = () => props.rule !== undefined;
  const conditions = () => props.rule?.conditions ?? [];
  const conditionCount = () => conditions().length;

  // Expand panel if rule exists
  const isInitiallyExpanded = () => hasRule();

  function ensureExpanded() {
    if (!expanded()) setExpanded(true);
  }

  function handleAddFirstCondition() {
    const newRule = buildNewRule([createEmptyCondition()]);
    props.onChange(newRule);
    setExpanded(true);
  }

  function handleAddCondition() {
    const current = props.rule;
    if (!current) return;
    props.onChange({
      ...current,
      conditions: [...current.conditions, createEmptyCondition()],
    });
    ensureExpanded();
  }

  function handleRemoveCondition(index: number) {
    const current = props.rule;
    if (!current) return;
    const newConditions = current.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      props.onChange(undefined);
    } else {
      props.onChange({ ...current, conditions: newConditions });
    }
  }

  function handleRemoveRule() {
    props.onChange(undefined);
  }

  function handleActionChange(action: "skip" | "block") {
    const current = props.rule;
    if (!current) return;
    props.onChange({ ...current, action });
  }

  function handleLogicChange(logic: "and" | "or") {
    const current = props.rule;
    if (!current) return;
    props.onChange({ ...current, logic });
  }

  function handleConditionChange(index: number, patch: Partial<NodeCondition>) {
    const current = props.rule;
    if (!current) return;
    const newConditions = current.conditions.map((c, i) =>
      i === index ? { ...c, ...patch } : c,
    );
    props.onChange({ ...current, conditions: newConditions });
  }

  /** Get smart suggestion value for a condition row */
  function getSuggestionForCondition(condition: NodeCondition): string | null {
    if (
      !condition.sourceRef.nodeId ||
      (condition.operator !== "equals" && condition.operator !== "not_equals" && condition.operator !== "contains")
    ) {
      return null;
    }
    const upstreamNode = props.upstreamNodes.find((n) => n.id === condition.sourceRef.nodeId);
    if (!upstreamNode) return null;
    const outputData = (upstreamNode as any).outputData as Record<string, unknown> | null | undefined;
    if (!outputData) return null;
    // Get the raw value from outputData using fieldPath if present, else the whole object
    let value: unknown = outputData;
    if (condition.sourceRef.fieldPath) {
      const parts = condition.sourceRef.fieldPath.split(".");
      for (const part of parts) {
        if (value && typeof value === "object" && part in (value as Record<string, unknown>)) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return null;
        }
      }
    }
    if (value === null || value === undefined) return null;
    return String(value);
  }

  function handlePickerSelect(index: number, variableName: string, ref: VariableRef | null) {
    if (ref) {
      handleConditionChange(index, {
        sourceRef: ref,
        value: undefined, // clear value when source changes
      });
    }
    setOpenPickerFor(null);
  }

  function handleSuggestionClick(index: number, suggestion: string) {
    handleConditionChange(index, { value: suggestion });
    setFocusedInputFor(null);
    setOpenDropdownFor(null);
  }

  function handleValueInput(index: number, value: string) {
    handleConditionChange(index, { value });
  }

  function handleOperatorChange(index: number, operator: NodeCondition["operator"]) {
    const current = props.rule?.conditions[index];
    if (!current) return;
    // Clear value when switching to exists/not_exists
    const patch: Partial<NodeCondition> = { operator };
    if (operator === "exists" || operator === "not_exists") {
      patch.value = undefined;
    }
    handleConditionChange(index, patch);
    if (operator === "exists" || operator === "not_exists") {
      setOpenDropdownFor(null);
      setFocusedInputFor(null);
    }
  }

  function handlePickerClose() {
    setOpenPickerFor(null);
  }

  // Determine effective expanded state: show expanded if rule exists or user expanded manually
  const effectiveExpanded = () => expanded() || isInitiallyExpanded();

  return (
    <div class="mt-4 border border-slate-200 rounded-md">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        class="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none"
      >
        <div class="flex items-center gap-1.5">
          <span>执行条件</span>
          <Show when={conditionCount() > 0}>
            <span class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-600">
              {conditionCount()}
            </span>
          </Show>
        </div>
        <svg
          class={`w-3.5 h-3.5 transition-transform ${effectiveExpanded() ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      <Show when={effectiveExpanded()}>
        <div class="px-3 pb-3 border-t border-slate-100">
          <Show
            when={hasRule()}
            fallback={
              /* No rule yet — show add button */
              <div class="pt-3">
                <button
                  type="button"
                  onClick={handleAddFirstCondition}
                  class="w-full px-3 py-2 text-xs text-indigo-600 border border-dashed border-indigo-300 rounded hover:bg-indigo-50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  + 添加执行条件
                </button>
              </div>
            }
          >
            {/* SolidJS Show render-prop children receive the unwrapped value (not an accessor) */}
            <div>
              {/* Action selector */}
              <div class="pt-3 mb-3">
                <p class="text-[11px] text-slate-500 mb-1.5">满足条件时执行</p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleActionChange("skip")}
                    class={`flex-1 px-3 py-1.5 text-xs rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors ${
                      props.rule!.action === "skip"
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <span class="block font-medium">跳过</span>
                    <span class="block text-[10px] opacity-75">条件满足时自动跳过此节点</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActionChange("block")}
                    class={`flex-1 px-3 py-1.5 text-xs rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors ${
                      props.rule!.action === "block"
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <span class="block font-medium">阻断</span>
                    <span class="block text-[10px] opacity-75">条件满足时停止流程</span>
                  </button>
                </div>
              </div>

              {/* Condition rows */}
              <div class="space-y-2">
                <For each={conditions()}>
                  {(condition) => {
                    const idx = conditions().indexOf(condition);
                    const hasValue = () =>
                      condition.operator !== "exists" && condition.operator !== "not_exists";
                    const suggestion = () => getSuggestionForCondition(condition);
                    const showDropdown = () =>
                      hasValue() &&
                      (focusedInputFor() === idx || openDropdownFor() === idx) &&
                      suggestion() !== null;
                    const isPickerOpen = () => openPickerFor() === idx;

                    // Determine selected variable display
                    const selectedVariableDisplay = () => {
                      if (!condition.sourceRef.variableName) return null;
                      // Extract readable label: "nodeId.outputName" → "nodeLabel.outputName"
                      const parts = condition.sourceRef.variableName.split(".");
                      const upstreamNode = props.upstreamNodes.find(
                        (n) => n.id === condition.sourceRef.nodeId,
                      );
                      const nodeLabel = upstreamNode?.data.label ?? condition.sourceRef.nodeId;
                      return `${nodeLabel}.${parts.slice(1).join(".")}`;
                    };

                    return (
                      <div class="border border-slate-100 rounded bg-slate-50 p-2 space-y-1.5 relative">
                        {/* Variable selector */}
                        <div class="flex items-center gap-1">
                          <span class="text-[11px] text-slate-500 flex-shrink-0 w-10">变量</span>
                          <div class="relative flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenPickerFor(isPickerOpen() ? null : idx);
                              }}
                              class={`w-full text-left text-xs px-2 py-1 rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors ${
                                selectedVariableDisplay()
                                  ? "border-indigo-300 bg-white text-slate-700"
                                  : "border-dashed border-slate-300 bg-white text-slate-400"
                              }`}
                            >
                              {selectedVariableDisplay() ?? "选择变量"}
                            </button>
                            <Show when={isPickerOpen()}>
                              <div class="absolute z-50 top-full left-0 mt-1 w-64">
                                <VariablePicker
                                  upstreamNodes={props.upstreamNodes}
                                  onSelect={(varName, ref) => handlePickerSelect(idx, varName, ref)}
                                  onClose={handlePickerClose}
                                />
                              </div>
                            </Show>
                          </div>
                        </div>

                        {/* Operator */}
                        <div class="flex items-center gap-1">
                          <span class="text-[11px] text-slate-500 flex-shrink-0 w-10">运算符</span>
                          <select
                            value={condition.operator}
                            onChange={(e) =>
                              handleOperatorChange(idx, e.currentTarget.value as NodeCondition["operator"])
                            }
                            class="flex-1 text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                          >
                            <For each={OPERATOR_OPTIONS}>
                              {(opt) => <option value={opt.value}>{opt.label}</option>}
                            </For>
                          </select>
                        </div>

                        {/* Value input with smart suggestion dropdown */}
                        <Show when={hasValue()}>
                          <div class="flex items-center gap-1">
                            <span class="text-[11px] text-slate-500 flex-shrink-0 w-10">值</span>
                            <div class="relative flex-1">
                              <input
                                type="text"
                                value={condition.value ?? ""}
                                onInput={(e) => handleValueInput(idx, e.currentTarget.value)}
                                onFocus={() => {
                                  setFocusedInputFor(idx);
                                  if (suggestion() !== null) setOpenDropdownFor(idx);
                                }}
                                onBlur={() => {
                                  setFocusedInputFor(null);
                                  // Delay to allow click on suggestion
                                  setTimeout(() => {
                                    if (focusedInputFor() !== idx) setOpenDropdownFor(null);
                                  }, 150);
                                }}
                                placeholder="输入或选择值"
                                class="w-full text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              />
                              <Show when={showDropdown()}>
                                <div class="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-md max-h-36 overflow-y-auto">
                                  <button
                                    type="button"
                                    class="w-full text-left px-2 py-1.5 text-xs text-slate-600 hover:bg-indigo-50 cursor-pointer focus:outline-none"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const s = suggestion();
                                      if (s !== null) handleSuggestionClick(idx, s);
                                    }}
                                  >
                                    <span class="text-[10px] text-slate-400 mr-1">建议:</span>
                                    {suggestion()}
                                  </button>
                                </div>
                              </Show>
                            </div>
                          </div>
                        </Show>

                        {/* Remove condition */}
                        <div class="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveCondition(idx)}
                            class="text-[10px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>

              {/* Logic selector (AND/OR) when multiple conditions */}
              <Show when={conditionCount() > 1}>
                <div class="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                  <span class="text-[11px] text-slate-500">条件逻辑</span>
                  <div class="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleLogicChange("and")}
                      class={`px-2 py-0.5 text-[10px] rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors ${
                        props.rule!.logic === "and"
                          ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      全部满足 (AND)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLogicChange("or")}
                      class={`px-2 py-0.5 text-[10px] rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors ${
                        props.rule!.logic === "or"
                          ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      任一满足 (OR)
                    </button>
                  </div>
                </div>
              </Show>

              {/* Add condition */}
              <button
                type="button"
                onClick={handleAddCondition}
                class="mt-2 w-full px-3 py-1.5 text-xs text-indigo-600 border border-dashed border-indigo-300 rounded hover:bg-indigo-50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                + 添加条件
              </button>

              {/* Remove rule */}
              <div class="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleRemoveRule}
                  class="text-[10px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5"
                >
                  删除执行条件
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
