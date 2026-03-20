import { Show, createSignal, onMount } from "solid-js";
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
      return { type: "input_transform", formFields: [], allowFileUpload: false };
    case "desensitize":
      return { type: "desensitize", categories: [], localModelId: null };
    case "model_call":
      return { type: "model_call", displayName: DEFAULT_LABELS.model_call, modelIds: [], promptTemplate: "", inputRefs: [] };
    case "restore":
      return { type: "restore", pairedDesensitizeNodeId: null };
    case "export":
      return { type: "export", format: "word", templateId: null, contentMapping: [] };
  }
}

export default function WorkflowEditor() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workflowName, setWorkflowName] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [validationErrors, setValidationErrors] = createSignal<ValidationError[]>([]);
  const [showValidation, setShowValidation] = createSignal(false);

  // Flow store
  const store = createFlowStore();

  // Selection store (multi-select)
  const selection = createSelectionStore();

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
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  });

  async function handleSave() {
    setSaving(true);
    try {
      const backendNodes = [...store.nodes].map((n) => ({
        id: n.id,
        type: n.data.nodeType,
        label: n.data.label,
        position: n.position,
        config: n.data.config as unknown as Record<string, unknown>,
        outputs: n.data.outputs as unknown as Array<{ name: string; label: string }>,
      }));

      const backendEdges = [...store.edges].map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));

      // Step 1: Save the workflow (draft always saves)
      const saveRes = await api.api.workflows({ id: params.id }).put({
        name: workflowName(),
        nodes: backendNodes,
        edges: backendEdges,
      });

      if (saveRes.error) {
        const errData = saveRes.error as { value?: { error?: string } };
        showToast(errData.value?.error ?? "保存工作流失败", "error");
        return;
      }

      // Step 2: Validate the workflow after save
      try {
        const validateRes = await api.api.workflows({ id: params.id }).validate.post();

        if (!validateRes.error && validateRes.data) {
          const result = validateRes.data as { valid?: boolean; errors?: ValidationError[] };
          const errors: ValidationError[] = result.errors ?? [];
          setValidationErrors(errors);

          if (errors.length === 0) {
            setShowValidation(false);
            showToast("保存成功", "success");
          } else {
            setShowValidation(true);
            showToast("保存成功，但流程存在校验问题", "error");
          }
        } else {
          setValidationErrors([]);
          setShowValidation(false);
          showToast("工作流已保存", "success");
        }
      } catch {
        setValidationErrors([]);
        setShowValidation(false);
        showToast("工作流已保存", "success");
      }
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSaving(false);
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
  }

  function handleLabelChange(nodeId: string, label: string) {
    const node = store.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    store.updateNode(nodeId, {
      data: { ...node.data, label },
    });
  }

  function handleNodeDropped(nodeType: WorkflowNodeType, position: { x: number; y: number }) {
    const id = crypto.randomUUID();
    const label = DEFAULT_LABELS[nodeType];
    const config = buildDefaultConfig(nodeType);

    const newNode: FlowNodeData = {
      id,
      type: nodeType,
      position,
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
  }

  function handleConnectionComplete(sourceId: string, targetId: string) {
    store.addEdge({
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: "bezier",
    });
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
        <div class="flex items-center gap-2">
          <Show when={validationErrors().length > 0}>
            <button
              type="button"
              onClick={() => setShowValidation(true)}
              class="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ring-1 ring-red-200"
            >
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <title>校验错误</title>
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clip-rule="evenodd"
                />
              </svg>
              校验错误 ({validationErrors().length})
            </button>
          </Show>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving() || loading()}
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Show
              when={!saving()}
              fallback={
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <title>保存中</title>
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              }
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>保存</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </Show>
            {saving() ? "保存中..." : "保存"}
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
              onNodeDragEnd={(nodeId, pos) => store.updateNodePosition(nodeId, pos)}
              onNodeSizeChange={(nodeId, size) => store.updateNodeSize(nodeId, size)}
              onConnectionComplete={handleConnectionComplete}
              onNodeDropped={handleNodeDropped}
              updateNodePosition={(nodeId, pos) => store.updateNodePosition(nodeId, pos)}
              onDeleteSelected={handleDeleteSelected}
              onRubberBandSelect={handleRubberBandSelect}
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
