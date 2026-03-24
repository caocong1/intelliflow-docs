import { Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import type { WorkflowNodeType, OutputDef, NodeConfig } from "@intelliflow/shared";
import { api } from "../../api/client";
import { showToast } from "../../components/ui/Toast";
import FlowCanvas from "../../components/workflow/canvas/FlowCanvas";
import NodeLibraryPanel from "../../components/workflow/canvas/NodeLibraryPanel";
import ConfigPanel from "../../components/workflow/config/ConfigPanel";
import ValidationOverlay, { type ValidationError } from "../../components/workflow/canvas/ValidationOverlay";
import { createFlowStore } from "../../lib/flow-engine/store";
import { createSelectionStore } from "../../lib/flow-engine/selection";
import { deriveOutputs } from "../../lib/flow-engine/derive-outputs";
import { createUndoRedo } from "../../lib/flow-engine/undo-redo";
import { createAutosave } from "../../lib/flow-engine/autosave";
import type { FlowNodeData, FlowEdgeData } from "../../lib/flow-engine/types";

// Raw API workflow shape
type WorkflowRaw = {
  id: string;
  name: string;
  description: string | null;
  nodes: Array<{
    id: string;
    type: WorkflowNodeType;
    label: string;
    position: { x: number; y: number };
    config: Record<string, unknown>;
    outputs: unknown[];
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
};

const DEFAULT_LABELS: Record<WorkflowNodeType, string> = {
  input_transform: "输入转换",
  desensitize: "信息脱敏",
  model_call: "模型调用",
  restore: "信息恢复",
  export: "文件导出",
};

function buildDefaultConfig(nodeType: WorkflowNodeType): NodeConfig {
  switch (nodeType) {
    case "input_transform":
      return { type: "input_transform", formFields: [] };
    case "desensitize":
      return { type: "desensitize", categories: [], localModelId: null };
    case "model_call":
      return { type: "model_call", displayName: DEFAULT_LABELS.model_call, modelIds: [], promptTemplate: "", inputRefs: [] };
    case "restore":
      return { type: "restore", pairedDesensitizeNodeId: null };
    case "export":
      return { type: "export", formats: ["word", "pdf", "markdown"], templateId: null, contentMapping: [] };
  }
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export type ValidationStatus = "unvalidated" | "valid" | "invalid";

export default function WorkflowEditor() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workflowName, setWorkflowName] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [validationErrors, setValidationErrors] = createSignal<ValidationError[]>([]);
  const [showValidation, setShowValidation] = createSignal(false);
  const [validationStatus, setValidationStatus] = createSignal<ValidationStatus>("unvalidated");

  // Flow store
  const store = createFlowStore();

  // Selection store (multi-select)
  const selection = createSelectionStore();

  // Undo/redo (initialized after load)
  let undoRedo: ReturnType<typeof createUndoRedo> | null = null;

  // Autosave
  const autosave = createAutosave(async (snapshot) => {
    const backendNodes = snapshot.nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      label: n.data.label,
      position: n.position,
      config: n.data.config as unknown as Record<string, unknown>,
      outputs: n.data.outputs as unknown as Array<{ id: string; name: string; description?: string }>,
    }));
    const backendEdges = snapshot.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));
    const saveRes = await api.api.workflows({ id: params.id }).put({
      name: workflowName(),
      nodes: backendNodes,
      edges: backendEdges,
    });
    if (saveRes.error) {
      throw new Error("Save failed");
    }
    // After successful save, mark validation as stale
    setValidationStatus("unvalidated");
  });

  onCleanup(() => {
    autosave.dispose();
  });

  /** Push current state to undo stack and trigger autosave */
  function pushStateChange() {
    const snapshot = store.getSnapshot();
    if (undoRedo) undoRedo.push(snapshot);
    autosave.trigger(snapshot);
  }

  onMount(async () => {
    try {
      const res = await api.api.workflows({ id: params.id }).get();

      if (res.error || !res.data) {
        showToast("加载工作流失败", "error");
        navigate("/admin/workflows");
        return;
      }
      const wf = res.data as unknown as WorkflowRaw;
      setWorkflowName(wf.name);

      const flowNodes: FlowNodeData[] = wf.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position ?? { x: 0, y: 0 },
        size: { width: 180, height: 60 },
        data: {
          nodeType: n.type,
          label: n.label || DEFAULT_LABELS[n.type],
          config: (n.config || buildDefaultConfig(n.type)) as unknown as NodeConfig,
          outputs: (n.outputs || []) as unknown as OutputDef[],
        },
        sourceHandle: "right" as const,
        targetHandle: "left" as const,
      }));

      const flowEdges: FlowEdgeData[] = wf.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "bezier" as const,
      }));

      store.applySnapshot({ nodes: flowNodes, edges: flowEdges });

      // Initialize undo/redo with loaded state
      undoRedo = createUndoRedo({ nodes: flowNodes, edges: flowEdges });
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  });

  function handleUndo() {
    if (!undoRedo) return;
    const snap = undoRedo.undo();
    if (snap) {
      store.applySnapshot(snap);
      autosave.trigger(snap);
    }
  }

  function handleRedo() {
    if (!undoRedo) return;
    const snap = undoRedo.redo();
    if (snap) {
      store.applySnapshot(snap);
      autosave.trigger(snap);
    }
  }

  async function handleValidate() {
    try {
      const validateRes = await api.api.workflows({ id: params.id }).validate.post();
      if (!validateRes.error && validateRes.data) {
        const result = validateRes.data as { valid?: boolean; errors?: ValidationError[] };
        const errors: ValidationError[] = result.errors ?? [];
        setValidationErrors(errors);
        if (errors.length === 0) {
          setValidationStatus("valid");
          setShowValidation(false);
          showToast("验证通过", "success");
        } else {
          setValidationStatus("invalid");
          setShowValidation(true);
        }
      }
    } catch {
      showToast("验证请求失败", "error");
    }
  }

  function handleConfigChange(nodeId: string, config: Record<string, unknown>) {
    const typedConfig = config as unknown as NodeConfig;
    const outputs = deriveOutputs(nodeId, typedConfig);
    const node = store.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    store.updateNode(nodeId, {
      data: {
        nodeType: node.data.nodeType,
        label: node.data.label,
        config: typedConfig,
        outputs,
      },
    });
    pushStateChange();
  }

  function handleLabelChange(nodeId: string, label: string) {
    const node = store.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    store.updateNode(nodeId, {
      data: { ...node.data, label },
    });
    pushStateChange();
  }

  function handleNodeDropped(nodeType: WorkflowNodeType, position: { x: number; y: number }) {
    const id = crypto.randomUUID();
    const label = DEFAULT_LABELS[nodeType];
    const config = buildDefaultConfig(nodeType);

    // Offset position so nodes don't stack when dropped at the same spot
    const existingAtSameSpot = store.nodes.filter(
      (n) => Math.abs(n.position.x - position.x) < 50 && Math.abs(n.position.y - position.y) < 50,
    );
    const offset = existingAtSameSpot.length * 220;

    const newNode: FlowNodeData = {
      id,
      type: nodeType,
      position: { x: position.x + offset, y: position.y },
      size: { width: 180, height: 60 },
      data: { nodeType, label, config, outputs: [] },
      sourceHandle: "right",
      targetHandle: "left",
    };

    store.addNode(newNode);

    // Auto-connect: find nearest node with no outgoing edge
    if (store.nodes.length > 1) {
      const nodesWithoutOutgoing = [...store.nodes].filter(
        (n) => n.id !== id && ![...store.edges].some((e) => e.source === n.id),
      );
      if (nodesWithoutOutgoing.length > 0) {
        const closest = nodesWithoutOutgoing.reduce((prev, curr) => {
          const prevDist = Math.abs(curr.position.x - position.x) + Math.abs(curr.position.y - position.y);
          const bestDist = Math.abs(prev.position.x - position.x) + Math.abs(prev.position.y - position.y);
          return prevDist < bestDist ? curr : prev;
        });
        store.addEdge({
          id: `e-${closest.id}-${id}`,
          source: closest.id,
          target: id,
          type: "bezier",
        });
      }
    }

    // Select the newly dropped node
    selection.selectNode(id, false);
    pushStateChange();
  }

  function handleConnectionComplete(sourceId: string, targetId: string) {
    store.addEdge({
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: "bezier",
    });
    pushStateChange();
  }

  function handleNodeSelect(nodeId: string, e: MouseEvent) {
    selection.selectNode(nodeId, e.ctrlKey || e.metaKey || e.shiftKey);
  }

  function handleEdgeSelect(edgeId: string) {
    selection.selectEdge(edgeId);
  }

  function handleCanvasClick() {
    selection.clearSelection();
  }

  function handleDeleteSelected() {
    const nodeIds = selection.selectedNodeIds();
    const edgeIds = selection.selectedEdgeIds();
    if (nodeIds.size > 0) {
      store.removeNodes(nodeIds);
    }
    if (edgeIds.size > 0) {
      store.removeEdges(edgeIds);
    }
    selection.clearSelection();
    pushStateChange();
  }

  function handleNodeDragEnd(nodeId: string, pos: { x: number; y: number }) {
    store.updateNodePosition(nodeId, pos);
    pushStateChange();
  }

  function handleRubberBandSelect(rect: { x: number; y: number; width: number; height: number }) {
    selection.selectNodesInRect(rect, [...store.nodes]);
  }

  function handleNavigateToNode(nodeId: string) {
    selection.selectNode(nodeId, false);
  }

  const errorNodeIds = () => {
    const errors = validationErrors();
    const ids = new Set<string>();
    for (const e of errors) {
      if (e.nodeId) ids.add(e.nodeId);
    }
    return ids;
  };

  const nodeLabels = () => {
    const map: Record<string, string> = {};
    for (const n of store.nodes) {
      map[n.id] = n.data.label;
    }
    return map;
  };

  // For ConfigPanel: use the first selected node (or null)
  const selectedNodeForConfig = () => {
    const ids = selection.selectedNodeIds();
    if (ids.size === 0) return null;
    // Use first selected node
    const firstId = ids.values().next().value;
    return store.nodes.find((n) => n.id === firstId) ?? null;
  };

  // Deferred repair: when a node is selected, fix any broken upstream variable
  // references in its promptTemplate using the final state of upstream outputs.
  createEffect(() => {
    const node = selectedNodeForConfig();
    if (!node) return;
    const cfg = node.data.config as unknown as Record<string, unknown>;
    if (cfg.type !== "model_call" || typeof cfg.promptTemplate !== "string") return;

    const tpl = cfg.promptTemplate as string;
    const refRegex = /\{\{([^}]+)\}\}/g;
    let match: RegExpExecArray | null;
    let repaired = tpl;
    let changed = false;

    match = refRegex.exec(tpl);
    while (match !== null) {
      const varKey = match[1].trim();
      const dotIdx = varKey.indexOf(".");
      if (dotIdx > 0) {
        const refNodeId = varKey.slice(0, dotIdx);
        const refOutputId = varKey.slice(dotIdx + 1);
        const refNode = store.nodes.find((n) => n.id === refNodeId);
        if (refNode) {
          const outputs = (refNode.data.outputs ?? []) as OutputDef[];
          const found = outputs.find((o) => o.id === refOutputId);
          if (!found) {
            // Output ID is stale — try to remap by type prefix (e.g. nodeId-model-*)
            const prefix = `${refNodeId}-model-`;
            if (refOutputId.startsWith(prefix)) {
              const modelOutputs = outputs.filter((o) => o.id.startsWith(prefix));
              if (modelOutputs.length === 1) {
                // Single model output available — remap to it
                repaired = repaired.replace(
                  `{{${varKey}}}`,
                  `{{${refNodeId}.${modelOutputs[0].id}}}`,
                );
                changed = true;
              }
            }
          }
        }
      }
      match = refRegex.exec(tpl);
    }

    if (changed) {
      store.updateNode(node.id, {
        data: { ...node.data, config: { ...cfg, promptTemplate: repaired } as unknown as NodeConfig },
      });
      pushStateChange();
    }
  });

  return (
    <div class="flex flex-col h-screen bg-slate-50">
      {/* Top Toolbar */}
      <div class="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/admin/workflows")}
            class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-1"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>返回</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
          <div class="w-px h-5 bg-slate-200" />
          <input
            type="text"
            value={workflowName()}
            onInput={(e) => setWorkflowName(e.currentTarget.value)}
            class="text-sm font-semibold text-slate-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-1 min-w-[200px] max-w-[400px]"
            placeholder="工作流名称"
          />
        </div>
        <div class="flex items-center gap-3">
          {/* Save status indicator */}
          <div class="flex items-center gap-1.5 text-xs text-slate-500">
            <Show when={autosave.status() === "saving"}>
              <svg class="w-3.5 h-3.5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <title>保存中</title>
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span class="text-slate-400">保存中...</span>
            </Show>
            <Show when={autosave.status() === "saved"}>
              <svg class="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>已保存</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-green-600">已保存</span>
              <Show when={autosave.lastSavedAt()} keyed>
                {(date) => <span class="text-slate-400">{formatTime(date)}</span>}
              </Show>
            </Show>
            <Show when={autosave.status() === "error"}>
              <svg class="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>保存失败</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-600">保存失败</span>
            </Show>
          </div>

          <div class="w-px h-5 bg-slate-200" />

          {/* Validation status indicator */}
          <div class="flex items-center gap-1.5 text-xs">
            <Show when={validationStatus() === "valid"}>
              <svg class="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>已验证</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-green-600">已验证</span>
            </Show>
            <Show when={validationStatus() === "invalid"}>
              <button
                type="button"
                onClick={() => setShowValidation(true)}
                class="inline-flex items-center gap-1 text-red-600 hover:text-red-700 cursor-pointer focus:outline-none"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <title>验证失败</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>验证失败 ({validationErrors().length})</span>
              </button>
            </Show>
            <Show when={validationStatus() === "unvalidated"}>
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>未验证</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
              </svg>
              <span class="text-slate-400">未验证</span>
            </Show>
          </div>

          {/* Validate button */}
          <button
            type="button"
            onClick={handleValidate}
            disabled={loading()}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>验证流程</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            验证流程
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div class="flex flex-1 overflow-hidden">
        <NodeLibraryPanel />

        <div class="flex-1 relative overflow-hidden">
          <Show
            when={!loading()}
            fallback={
              <div class="flex items-center justify-center h-full">
                <div class="flex flex-col items-center gap-3 text-slate-400">
                  <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <title>加载中</title>
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span class="text-sm">加载工作流...</span>
                </div>
              </div>
            }
          >
            <FlowCanvas
              nodes={store.nodes}
              edges={store.edges}
              viewport={store.viewport()}
              setViewport={store.setViewport}
              selectedNodeIds={selection.selectedNodeIds()}
              selectedEdgeIds={selection.selectedEdgeIds()}
              errorNodeIds={errorNodeIds()}
              onNodeSelect={handleNodeSelect}
              onEdgeSelect={handleEdgeSelect}
              onCanvasClick={handleCanvasClick}
              onNodeDragEnd={handleNodeDragEnd}
              onNodeSizeChange={(nodeId, size) => store.updateNodeSize(nodeId, size)}
              onConnectionComplete={handleConnectionComplete}
              onNodeDropped={handleNodeDropped}
              updateNodePosition={(nodeId, pos) => store.updateNodePosition(nodeId, pos)}
              onDeleteSelected={handleDeleteSelected}
              onRubberBandSelect={handleRubberBandSelect}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />

            <Show when={showValidation() && validationErrors().length > 0}>
              <ValidationOverlay
                errors={validationErrors()}
                nodeLabels={nodeLabels()}
                onNavigateToNode={handleNavigateToNode}
                onClose={() => setShowValidation(false)}
              />
            </Show>
          </Show>
        </div>

        <ConfigPanel
          selectedNode={selectedNodeForConfig()}
          allNodes={[...store.nodes]}
          edges={[...store.edges]}
          onConfigChange={handleConfigChange}
          onLabelChange={handleLabelChange}
          onClose={() => selection.clearSelection()}
        />
      </div>
    </div>
  );
}
