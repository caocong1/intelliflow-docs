import { Show, createSignal, onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import {
  createNodeStore,
  createEdgeStore,
  type Node,
  type Edge,
} from "@dschz/solid-flow";
import "@dschz/solid-flow/styles";
import { api } from "../../api/client";
import { showToast } from "../../components/ui/Toast";
import WorkflowCanvas from "../../components/workflow/canvas/WorkflowCanvas";
import NodeLibraryPanel from "../../components/workflow/canvas/NodeLibraryPanel";
import type { WorkflowNodeType } from "@intelliflow/shared";

// Node data shape stored in solid-flow Node.data
export type WorkflowNodeData = {
  nodeType: WorkflowNodeType;
  label: string;
  config: Record<string, unknown>;
  outputs: unknown[];
};

// Flow node/edge type aliases
export type WFNode = Node<WorkflowNodeData, WorkflowNodeType>;
export type WFEdge = Edge<Record<string, unknown>, string>;

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

function buildDefaultConfig(nodeType: WorkflowNodeType): Record<string, unknown> {
  switch (nodeType) {
    case "input_transform":
      return { type: "input_transform", formFields: [], allowFileUpload: false };
    case "desensitize":
      return { type: "desensitize", ruleTypes: [], placeholderFormat: "[REDACTED]", localModelId: null };
    case "model_call":
      return { type: "model_call", displayName: DEFAULT_LABELS.model_call, modelId: null, promptTemplate: "", inputRefs: [] };
    case "restore":
      return { type: "restore", pairedDesensitizeNodeId: null };
    case "export":
      return { type: "export", format: "word", templateId: null, contentMapping: [] };
  }
}

export default function WorkflowEditor() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workflowName, setWorkflowName] = createSignal("加载中...");
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);

  // Use plain untyped stores — we cast to WFNode[]/WFEdge[] at usage points
  // createNodeStore/createEdgeStore typed generics impose BuiltInNode compatibility
  // so we use the base overload and cast
  const [nodes, setNodes] = createNodeStore([]) as unknown as [
    WFNode[],
    (updater: WFNode[] | ((prev: WFNode[]) => WFNode[])) => void,
  ];
  const [edges, setEdges] = createEdgeStore([]) as unknown as [
    WFEdge[],
    (updater: WFEdge[] | ((prev: WFEdge[]) => WFEdge[])) => void,
  ];

  onMount(async () => {
    try {
      const res = await (api.api as unknown as {
        workflows: Record<string, (id: string) => {
          get: () => Promise<{ data: unknown; error: unknown }>;
        }>;
      }).workflows[":id"](params.id).get();

      if (res.error || !res.data) {
        showToast("加载工作流失败", "error");
        navigate("/admin/workflows");
        return;
      }
      const wf = (res.data as { data: WorkflowRaw }).data;
      setWorkflowName(wf.name);

      const sfNodes: WFNode[] = wf.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          nodeType: n.type,
          label: n.label || DEFAULT_LABELS[n.type],
          config: n.config || {},
          outputs: n.outputs || [],
        },
      }));

      const sfEdges: WFEdge[] = wf.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...(e.sourceHandle != null ? { sourceHandle: e.sourceHandle } : {}),
        ...(e.targetHandle != null ? { targetHandle: e.targetHandle } : {}),
        type: "dataflow",
      }));

      setNodes(sfNodes);
      setEdges(sfEdges);
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  });

  async function handleSave() {
    setSaving(true);
    try {
      const backendNodes = nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType,
        label: n.data.label,
        position: n.position,
        config: n.data.config,
        outputs: n.data.outputs,
      }));

      const backendEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
        ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      }));

      const res2 = await (api.api as unknown as {
        workflows: Record<string, (id: string) => {
          put: (body: unknown) => Promise<{ error: unknown }>;
        }>;
      }).workflows[":id"](params.id).put({
        name: workflowName(),
        nodes: backendNodes,
        edges: backendEdges,
      });

      if (res2.error) {
        const errData = res2.error as { value?: { error?: string } };
        showToast(errData.value?.error ?? "保存工作流失败", "error");
        return;
      }
      showToast("工作流已保存", "success");
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleNodeDropped(nodeType: WorkflowNodeType, position: { x: number; y: number }) {
    const id = crypto.randomUUID();
    const label = DEFAULT_LABELS[nodeType];
    const config = buildDefaultConfig(nodeType);

    const newNode: WFNode = {
      id,
      type: nodeType,
      position,
      data: { nodeType, label, config, outputs: [] },
    };

    // Auto-connect: find the rightmost node and connect it to the new node
    if (nodes.length > 0) {
      const lastNode = nodes.reduce((prev, curr) =>
        (curr.position?.x ?? 0) > (prev.position?.x ?? 0) ? curr : prev
      );
      const newEdge: WFEdge = {
        id: `e-${lastNode.id}-${id}`,
        source: lastNode.id,
        target: id,
        type: "dataflow",
      };
      setNodes([...nodes, newNode]);
      setEdges([...edges, newEdge]);
    } else {
      setNodes([...nodes, newNode]);
    }
  }

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
          <Show when={selectedNodeId()}>
            <span class="text-xs text-slate-400 mr-2">已选: {selectedNodeId()}</span>
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
        {/* Left: Node Library Panel */}
        <NodeLibraryPanel />

        {/* Center: Canvas */}
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
            <WorkflowCanvas
              nodes={nodes}
              edges={edges}
              setNodes={setNodes}
              setEdges={setEdges}
              onNodeDropped={handleNodeDropped}
              onNodeSelect={setSelectedNodeId}
            />
          </Show>
        </div>

        {/* Right: Config Panel Slot (Plan 03-04) */}
        <div class="w-72 bg-white border-l border-slate-200 flex-shrink-0 flex items-center justify-center">
          <p class="text-xs text-slate-400 text-center px-4">
            选择节点以配置参数
            <br />
            <span class="text-slate-300">(Plan 03-04)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
