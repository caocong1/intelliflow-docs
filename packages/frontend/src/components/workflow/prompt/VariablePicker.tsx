import type { ModelCallConfig, NamedOutputDef, OutputDef, VariableRef } from "@intelliflow/shared";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { FlowNodeData } from "../../../lib/flow-engine/types";
import Modal from "../../ui/Modal";

// ─── Schema Tree Types ──────────────────────────────────────────────────────

/** A node in the JSON Schema tree for field selection */
export interface SchemaTreeNode {
  key: string; // property name (e.g. "name", "[0]", "[*]")
  path: string; // full dot-path from root (e.g. "items[0].name")
  type: string; // "object", "array", "string", "number", etc.
  children?: SchemaTreeNode[];
  isLeaf: boolean;
  isArray: boolean;
}

/** Maximum recursion depth for schema tree building */
const MAX_SCHEMA_DEPTH = 5;

/**
 * Recursively build a tree of SchemaTreeNode from a JSON Schema object.
 * Handles object properties, array items (with [0] and [*] children), and primitives.
 * Stops at MAX_SCHEMA_DEPTH or when encountering $ref.
 */
export function buildSchemaTree(
  schema: Record<string, unknown>,
  parentPath = "",
  depth = 0,
): SchemaTreeNode[] {
  if (depth >= MAX_SCHEMA_DEPTH) return [];

  const schemaType = schema.type as string | undefined;

  // Handle $ref — stop recursion
  if (schema.$ref) {
    return [];
  }

  if (schemaType === "object" && schema.properties) {
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    const nodes: SchemaTreeNode[] = [];
    for (const [propName, propSchema] of Object.entries(properties)) {
      const propPath = parentPath ? `${parentPath}.${propName}` : propName;
      const propType = (propSchema.type as string) || "unknown";
      const isArray = propType === "array";
      const isObject = propType === "object";
      const isLeaf = !isArray && !isObject;

      const children = isLeaf ? undefined : buildSchemaTreeForNode(propSchema, propPath, depth + 1);

      nodes.push({
        key: propName,
        path: propPath,
        type: propType,
        children,
        isLeaf,
        isArray,
      });
    }
    return nodes;
  }

  if (schemaType === "array" && schema.items) {
    // Array at root level — create [0] and [*] entries
    return buildArrayChildren(schema.items as Record<string, unknown>, parentPath, depth);
  }

  return [];
}

/** Build children for an array type: [0] (fixed index) and [*] (traversal) */
function buildArrayChildren(
  itemsSchema: Record<string, unknown>,
  parentPath: string,
  depth: number,
): SchemaTreeNode[] {
  if (depth >= MAX_SCHEMA_DEPTH) return [];

  const itemType = (itemsSchema.type as string) || "unknown";
  const isItemLeaf = itemType !== "object" && itemType !== "array";

  const makeChild = (indexKey: string): SchemaTreeNode => {
    const childPath = `${parentPath}${indexKey}`;
    const children = isItemLeaf
      ? undefined
      : buildSchemaTreeForNode(itemsSchema, childPath, depth + 1);
    return {
      key: indexKey,
      path: childPath,
      type: itemType,
      children,
      isLeaf: isItemLeaf,
      isArray: itemType === "array",
    };
  };

  return [makeChild("[0]"), makeChild("[*]")];
}

/** Build tree for a single schema node (object, array, or primitive) */
function buildSchemaTreeForNode(
  schema: Record<string, unknown>,
  path: string,
  depth: number,
): SchemaTreeNode[] | undefined {
  if (depth >= MAX_SCHEMA_DEPTH) return undefined;
  if (schema.$ref) return undefined;

  const schemaType = schema.type as string | undefined;

  if (schemaType === "object" && schema.properties) {
    return buildSchemaTree(schema, path, depth);
  }

  if (schemaType === "array" && schema.items) {
    return buildArrayChildren(schema.items as Record<string, unknown>, path, depth);
  }

  return undefined;
}

// ─── Picker Item Types ──────────────────────────────────────────────────────

/** A flat selectable item for keyboard navigation */
export interface PickerItem {
  node: FlowNodeData;
  output: OutputDef;
  key: string; // "nodeId.outputId"
}

interface VariablePickerProps {
  upstreamNodes: FlowNodeData[];
  onSelect: (variableName: string, ref: VariableRef | null) => void;
  onClose: () => void;
  highlightedIndex?: number;
}

/** Build a flat list of all selectable items from upstream nodes */
export function buildPickerItems(upstreamNodes: FlowNodeData[]): PickerItem[] {
  const items: PickerItem[] = [];
  for (const node of upstreamNodes) {
    const outputs = (node.data.outputs as OutputDef[]).filter((o) => o.name);
    for (const output of outputs) {
      items.push({ node, output, key: `${node.id}.${output.segmentKey || output.id}` });
    }
  }
  return items;
}

// ─── Type Badge Styles ──────────────────────────────────────────────────────

const TYPE_BADGE_CLASSES: Record<string, string> = {
  string: "bg-green-100 text-green-700",
  number: "bg-blue-100 text-blue-700",
  integer: "bg-blue-100 text-blue-700",
  boolean: "bg-yellow-100 text-yellow-700",
  array: "bg-purple-100 text-purple-700",
  object: "bg-slate-100 text-slate-600",
  unknown: "bg-slate-100 text-slate-500",
};

const OUTPUT_GROUP_LABELS: Record<string, string> = {
  field: "文本字段",
  file_slot: "文件输入",
  model: "模型整体输出",
  model_artifact: "模型产物",
  manual_feedback: "人工意见",
  selected: "用户选择输出",
  selected_artifact: "用户选择产物",
  desensitized: "脱敏输出",
  restored: "恢复输出",
};

// ─── Schema Tree Rendering Component ────────────────────────────────────────

function SchemaTreeView(props: {
  nodes: SchemaTreeNode[];
  nodeId: string;
  segmentKey: string;
  level: number;
  onSelectField: (fieldPath: string) => void;
}) {
  return (
    <For each={props.nodes}>
      {(treeNode) => {
        const [expanded, setExpanded] = createSignal(false);
        const hasChildren = () => treeNode.children && treeNode.children.length > 0;

        function handleClick(e: MouseEvent) {
          e.stopPropagation();
          if (treeNode.isLeaf) {
            props.onSelectField(treeNode.path);
          } else {
            setExpanded((v) => !v);
          }
        }

        return (
          <div>
            <button
              type="button"
              class="w-full text-left px-2 py-1 text-[11px] transition-colors cursor-pointer focus:outline-none flex items-center gap-1 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600"
              style={{ "padding-left": `${16 + props.level * 16}px` }}
              onClick={handleClick}
            >
              {/* Expand/collapse chevron or leaf icon */}
              <Show
                when={hasChildren()}
                fallback={
                  <span class="w-3.5 h-3.5 flex items-center justify-center text-[9px] text-amber-500 flex-shrink-0 font-mono">
                    {"{x}"}
                  </span>
                }
              >
                <span class="w-3.5 h-3.5 flex items-center justify-center text-[9px] text-slate-400 flex-shrink-0">
                  {expanded() ? "\u25BE" : "\u25B8"}
                </span>
              </Show>

              {/* Folder/leaf icon */}
              <Show when={!treeNode.isLeaf} fallback={null}>
                <span class="text-[10px] text-slate-400 flex-shrink-0">
                  {treeNode.isArray ? "\u25A4" : "\u25A3"}
                </span>
              </Show>

              {/* Property name */}
              <span class="font-medium truncate">{treeNode.key}</span>

              {/* Type badge */}
              <span
                class={`ml-auto text-[9px] px-1 py-0.5 rounded-sm font-medium flex-shrink-0 ${TYPE_BADGE_CLASSES[treeNode.type] || TYPE_BADGE_CLASSES.unknown}`}
              >
                {treeNode.type}
              </span>
            </button>

            {/* Children (expanded) */}
            <Show when={expanded() && hasChildren()}>
              <SchemaTreeView
                nodes={treeNode.children ?? []}
                nodeId={props.nodeId}
                segmentKey={props.segmentKey}
                level={props.level + 1}
                onSelectField={props.onSelectField}
              />
            </Show>
          </div>
        );
      }}
    </For>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the JSON schema for a given output from a model_call node config.
 * Checks namedOutputs per-artifact schema first, then falls back to node-level jsonSchema.
 */
function getSchemaForOutput(
  config: ModelCallConfig,
  output: OutputDef,
): Record<string, unknown> | null {
  // Check if this output corresponds to a named output with its own schema
  if (config.namedOutputs) {
    const namedOutput = config.namedOutputs.find(
      (no: NamedOutputDef) => no.id === output.segmentKey || no.id === output.name,
    );
    if (namedOutput?.jsonSchema) {
      return namedOutput.jsonSchema as Record<string, unknown>;
    }
  }

  // Check if output is a model output and node has a top-level jsonSchema
  if (config.jsonSchema && output.id.includes("-model-")) {
    return config.jsonSchema as Record<string, unknown>;
  }

  return null;
}

function matchesOutputSearch(node: FlowNodeData, output: OutputDef, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    node.data.label,
    node.data.nodeType,
    output.name,
    output.description,
    output.segmentKey,
    output.groupLabel,
    output.modelId,
    output.artifactId,
    OUTPUT_GROUP_LABELS[output.category ?? ""],
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .some((value) => value.toLowerCase().includes(normalized));
}

function groupOutputs(outputs: OutputDef[]) {
  const groups = new Map<string, { title: string; outputs: OutputDef[] }>();

  for (const output of outputs) {
    const key = `${output.category ?? "default"}::${output.groupLabel ?? ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        title: output.groupLabel ?? OUTPUT_GROUP_LABELS[output.category ?? ""] ?? "节点输出",
        outputs: [],
      });
    }
    groups.get(key)?.outputs.push(output);
  }

  return Array.from(groups.values());
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function VariablePicker(props: VariablePickerProps) {
  const [search, setSearch] = createSignal("");

  function nodeOutputs(node: FlowNodeData): OutputDef[] {
    return (node.data.outputs as OutputDef[]).filter((o) => o.name);
  }

  function handleSelectOutput(node: FlowNodeData, output: OutputDef) {
    // Use segmentKey for outputId (resolveRef compatibility), fall back to output.id
    const resolvedOutputId = output.segmentKey || output.id;
    const variableName = `${node.id}.${output.name}`;
    const ref: VariableRef = {
      nodeId: node.id,
      outputId: resolvedOutputId,
      variableName,
    };
    props.onSelect(variableName, ref);
  }

  function handleSelectField(node: FlowNodeData, output: OutputDef, fieldPath: string) {
    const resolvedOutputId = output.segmentKey || output.id;
    const variableName = `${node.id}.${output.name}.${fieldPath}`;
    const ref: VariableRef = {
      nodeId: node.id,
      outputId: resolvedOutputId,
      variableName,
      fieldPath,
    };
    props.onSelect(variableName, ref);
  }

  function getOutputTypeIcon(output: OutputDef): { icon: string; class: string; title: string } {
    if (output.category === "file_slot" || output.id.includes("-fileslot-"))
      return { icon: "\uD83D\uDCC1", class: "bg-purple-100 text-purple-600", title: "文件槽" };
    if (
      output.category === "model" ||
      output.category === "model_artifact" ||
      output.category === "selected" ||
      output.category === "selected_artifact" ||
      output.id.includes("-model-")
    )
      return { icon: "\uD83E\uDD16", class: "bg-amber-100 text-amber-600", title: "模型输出" };
    if (output.category === "desensitized" || output.id.includes("-desensitized-"))
      return { icon: "\uD83D\uDD12", class: "bg-orange-100 text-orange-600", title: "脱敏" };
    if (output.category === "restored" || output.id.includes("-restored-"))
      return { icon: "\uD83D\uDD13", class: "bg-green-100 text-green-600", title: "恢复" };
    return { icon: "T", class: "bg-slate-100 text-slate-600", title: "文本字段" };
  }

  const filteredNodes = createMemo(() =>
    props.upstreamNodes
      .map((node) => {
        const outputs = nodeOutputs(node).filter((output) =>
          matchesOutputSearch(node, output, search()),
        );
        return { node, outputs, groups: groupOutputs(outputs) };
      })
      .filter((entry) => entry.outputs.length > 0),
  );

  // Flat list of filtered items to map highlightedIndex to the correct item
  const flatFilteredItems = createMemo(() => {
    const items: PickerItem[] = [];
    for (const entry of filteredNodes()) {
      for (const output of entry.outputs) {
        items.push({
          node: entry.node,
          output,
          key: `${entry.node.id}.${output.segmentKey || output.id}`,
        });
      }
    }
    return items;
  });

  const hasResults = () => filteredNodes().length > 0;

  let listRef: HTMLDivElement | undefined;

  // Auto-scroll highlighted item into view reactively
  createEffect(() => {
    const idx = props.highlightedIndex;
    if (idx === undefined || idx < 0 || !listRef) return;
    const items = flatFilteredItems();
    if (idx >= items.length) return;
    const el = listRef.querySelector(`[data-picker-key="${items[idx].key}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  });

  return (
    <Modal
      isOpen={true}
      onClose={props.onClose}
      title="选择节点输出"
      dialogClass="max-w-5xl"
      bodyClass="p-0"
    >
      <div class="border-b border-slate-100 px-6 py-4 space-y-3">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-slate-700">从上游节点中选择可引用输出</p>
            <p class="text-xs text-slate-500 mt-1">
              支持搜索节点名、输出名、产物说明、模型信息和用户选择输出。
            </p>
          </div>
          <span class="text-xs text-slate-400 whitespace-nowrap">
            共 {flatFilteredItems().length} 项
          </span>
        </div>
        <input
          type="text"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          placeholder="搜索节点、输出、产物、模型..."
          class="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
        />
      </div>

      <div ref={listRef} class="max-h-[65vh] overflow-y-auto px-6 py-5 space-y-4">
        <Show when={!hasResults()}>
          <div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p class="text-sm text-slate-500">无匹配节点输出</p>
            <p class="text-xs text-slate-400 mt-1">可以换个关键词，或直接浏览上游节点分组。</p>
          </div>
        </Show>

        <For each={filteredNodes()}>
          {(entry) => {
            const node = entry.node;
            const isModelCall = () => node.data.config.type === "model_call";
            const modelConfig = () =>
              isModelCall() ? (node.data.config as ModelCallConfig) : null;

            return (
              <div class="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.04)] overflow-hidden">
                <div class="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <span class="text-lg leading-none">{getNodeIcon(node.data.nodeType)}</span>
                    <div>
                      <p class="text-sm font-semibold text-slate-800">{node.data.label}</p>
                      <p class="text-xs text-slate-500">{getNodeTypeLabel(node.data.nodeType)}</p>
                    </div>
                  </div>
                  <span class="text-xs text-slate-400">{entry.outputs.length} 项输出</span>
                </div>

                <div class="px-5 py-4 space-y-4">
                  <For each={entry.groups}>
                    {(group) => (
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {group.title}
                          </h4>
                          <span class="text-[11px] text-slate-400">{group.outputs.length} 项</span>
                        </div>

                        <div class="space-y-2">
                          <For each={group.outputs}>
                            {(output) => {
                              const itemKey = `${node.id}.${output.segmentKey || output.id}`;
                              const isHighlighted = () => {
                                const idx = props.highlightedIndex;
                                if (idx === undefined || idx < 0) return false;
                                const items = flatFilteredItems();
                                return idx < items.length && items[idx].key === itemKey;
                              };

                              const schemaTree = createMemo(() => {
                                const cfg = modelConfig();
                                if (!cfg) return null;
                                const schema = getSchemaForOutput(cfg, output);
                                if (!schema) return null;
                                const tree = buildSchemaTree(schema);
                                return tree.length > 0 ? tree : null;
                              });

                              const [treeExpanded, setTreeExpanded] = createSignal(false);

                              return (
                                <div class="rounded-xl border border-slate-200 overflow-hidden">
                                  <div class="flex items-stretch">
                                    <Show when={schemaTree()}>
                                      <button
                                        type="button"
                                        class="px-3 text-xs text-slate-400 hover:text-slate-600 border-r border-slate-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTreeExpanded((v) => !v);
                                        }}
                                      >
                                        {treeExpanded() ? "\u25BE" : "\u25B8"}
                                      </button>
                                    </Show>

                                    <button
                                      type="button"
                                      data-picker-key={itemKey}
                                      class={`flex-1 text-left px-4 py-3 transition-colors cursor-pointer focus:outline-none ${
                                        isHighlighted()
                                          ? "bg-indigo-50 text-indigo-700"
                                          : "bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                                      }`}
                                      onClick={() => handleSelectOutput(node, output)}
                                    >
                                      <div class="flex items-start gap-3">
                                        {(() => {
                                          const typeIcon = getOutputTypeIcon(output);
                                          return (
                                            <span
                                              class={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${typeIcon.class}`}
                                              title={typeIcon.title}
                                            >
                                              {typeIcon.icon}
                                            </span>
                                          );
                                        })()}
                                        <div class="min-w-0 flex-1">
                                          <div class="flex items-center gap-2 flex-wrap">
                                            <span class="text-sm font-semibold">{output.name}</span>
                                            <span class="text-[11px] text-slate-400 font-mono">
                                              {node.data.label}.{output.segmentKey || output.id}
                                            </span>
                                          </div>
                                          <Show when={output.description}>
                                            <p class="text-xs text-slate-500 mt-1">
                                              {output.description}
                                            </p>
                                          </Show>
                                          <div class="flex items-center gap-2 flex-wrap mt-2">
                                            <Show when={output.category}>
                                              <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                {OUTPUT_GROUP_LABELS[output.category ?? ""] ??
                                                  output.category}
                                              </span>
                                            </Show>
                                            <Show when={output.groupLabel}>
                                              <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                                                {output.groupLabel}
                                              </span>
                                            </Show>
                                            <Show when={schemaTree()}>
                                              <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                                可展开 JSON 字段
                                              </span>
                                            </Show>
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  </div>

                                  <Show when={treeExpanded() && schemaTree()}>
                                    <div class="border-t border-slate-100 bg-slate-50 py-2">
                                      <SchemaTreeView
                                        nodes={schemaTree() ?? []}
                                        nodeId={node.id}
                                        segmentKey={output.segmentKey || output.id}
                                        level={0}
                                        onSelectField={(fieldPath) =>
                                          handleSelectField(node, output, fieldPath)
                                        }
                                      />
                                    </div>
                                  </Show>
                                </div>
                              );
                            }}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Modal>
  );
}

function getNodeIcon(nodeType: string): string {
  const icons: Record<string, string> = {
    input_transform: "\uD83D\uDCE5",
    desensitize: "\uD83D\uDD12",
    model_call: "\uD83E\uDD16",
    restore: "\uD83D\uDD13",
    export: "\uD83D\uDCE4",
  };
  return icons[nodeType] ?? "\u2699\uFE0F";
}

function getNodeTypeLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    input_transform: "输入转换",
    desensitize: "信息脱敏",
    model_call: "模型调用",
    restore: "信息恢复",
    export: "文件导出",
  };
  return labels[nodeType] ?? nodeType;
}
