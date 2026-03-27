import type { ModelCallConfig, NamedOutputDef, OutputDef, VariableRef } from "@intelliflow/shared";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { FlowNodeData } from "../../../lib/flow-engine/types";

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
      items.push({ node, output, key: `${node.id}.${output.name}` });
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

// ─── Main Component ─────────────────────────────────────────────────────────

export default function VariablePicker(props: VariablePickerProps) {
  const [search, setSearch] = createSignal("");

  function nodeOutputs(node: FlowNodeData): OutputDef[] {
    return (node.data.outputs as OutputDef[]).filter((o) => o.name);
  }

  function matchesSearch(text: string): boolean {
    const q = search().toLowerCase();
    return q === "" || text.toLowerCase().includes(q);
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

  /** Determine output type from OutputDef.id prefix after nodeId */
  function getOutputTypeIcon(output: OutputDef): { icon: string; class: string; title: string } {
    const id = output.id;
    // OutputDef.id format: ${nodeId}-field-${key}, ${nodeId}-fileslot-${key}, ${nodeId}-model-${key}, etc.
    if (id.includes("-fileslot-"))
      return { icon: "\uD83D\uDCC1", class: "bg-purple-100 text-purple-600", title: "文件槽" };
    if (id.includes("-model-"))
      return { icon: "\uD83E\uDD16", class: "bg-amber-100 text-amber-600", title: "模型输出" };
    if (id.includes("-desensitized-"))
      return { icon: "\uD83D\uDD12", class: "bg-orange-100 text-orange-600", title: "脱敏" };
    if (id.includes("-restored-"))
      return { icon: "\uD83D\uDD13", class: "bg-green-100 text-green-600", title: "恢复" };
    // Default: field type
    return { icon: "T", class: "bg-slate-100 text-slate-600", title: "文本字段" };
  }

  const filteredNodes = () =>
    props.upstreamNodes.filter((node) => {
      const outputs = nodeOutputs(node);
      if (outputs.length === 0) return false;
      if (search() === "") return true;
      return matchesSearch(node.data.label) || outputs.some((o) => matchesSearch(o.name));
    });

  // Flat list of filtered items to map highlightedIndex to the correct item
  const flatFilteredItems = createMemo(() => {
    const items: PickerItem[] = [];
    for (const node of filteredNodes()) {
      const outputs = nodeOutputs(node);
      const filtered =
        search() === ""
          ? outputs
          : outputs.filter((o) => matchesSearch(node.data.label) || matchesSearch(o.name));
      for (const output of filtered) {
        items.push({ node, output, key: `${node.id}.${output.name}` });
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
    <div class="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
      {/* Search */}
      <div class="p-2 border-b border-slate-100">
        <input
          type="text"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          placeholder="搜索节点输出..."
          class="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
        />
      </div>

      <div ref={listRef} class="max-h-60 overflow-y-auto">
        <Show when={!hasResults()}>
          <p class="text-xs text-slate-400 text-center py-4">无匹配节点输出</p>
        </Show>

        {/* Upstream node variables */}
        <For each={filteredNodes()}>
          {(node) => {
            const outputs = () => {
              const allOutputs = nodeOutputs(node);
              if (search() === "") return allOutputs;
              return allOutputs.filter(
                (o) => matchesSearch(node.data.label) || matchesSearch(o.name),
              );
            };

            // Check if this is a model_call node with potential schema
            const isModelCall = () => node.data.config.type === "model_call";
            const modelConfig = () =>
              isModelCall() ? (node.data.config as ModelCallConfig) : null;

            return (
              <div>
                {/* Group header */}
                <div class="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5">
                  <span class="text-sm leading-none">{getNodeIcon(node.data.nodeType)}</span>
                  <span class="text-xs font-semibold text-slate-600">
                    插入 {node.data.label} 的输出
                  </span>
                </div>
                {/* Outputs */}
                <For each={outputs()}>
                  {(output) => {
                    const itemKey = `${node.id}.${output.name}`;
                    const isHighlighted = () => {
                      const idx = props.highlightedIndex;
                      if (idx === undefined || idx < 0) return false;
                      const items = flatFilteredItems();
                      return idx < items.length && items[idx].key === itemKey;
                    };

                    // Get schema tree for this output (if available)
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
                      <div>
                        <div class="flex items-center">
                          {/* Tree expand toggle (only for outputs with schema) */}
                          <Show when={schemaTree()}>
                            <button
                              type="button"
                              class="pl-2 pr-0 py-1.5 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none flex-shrink-0"
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
                            class={`flex-1 text-left py-1.5 text-xs transition-colors cursor-pointer focus:outline-none flex items-center gap-1.5 ${
                              schemaTree() ? "px-1" : "px-4"
                            } ${
                              isHighlighted()
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                            }`}
                            onClick={() => handleSelectOutput(node, output)}
                          >
                            {(() => {
                              const typeIcon = getOutputTypeIcon(output);
                              return (
                                <span
                                  class={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${typeIcon.class}`}
                                  title={typeIcon.title}
                                >
                                  {typeIcon.icon}
                                </span>
                              );
                            })()}
                            <span class="text-slate-400 mr-0.5">{node.data.label}.</span>
                            <span class="font-medium">{output.name}</span>
                            <Show when={schemaTree()}>
                              <span class="ml-auto text-[9px] text-slate-400">JSON</span>
                            </Show>
                          </button>
                        </div>

                        {/* Schema tree (expanded) */}
                        <Show when={treeExpanded() && schemaTree()}>
                          <div class="border-l-2 border-slate-100 ml-4">
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
            );
          }}
        </For>
      </div>
    </div>
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
