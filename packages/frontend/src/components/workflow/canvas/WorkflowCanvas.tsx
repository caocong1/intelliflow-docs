import {
  SolidFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useSolidFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type EdgeConnection,
} from "@dschz/solid-flow";
import type { Store } from "solid-js/store";
import type { WorkflowNodeType } from "@intelliflow/shared";
import type { WFNode, WFEdge } from "../../../pages/admin/WorkflowEditor";
import InputTransformNode from "./nodes/InputTransformNode";
import DesensitizeNode from "./nodes/DesensitizeNode";
import ModelCallNode from "./nodes/ModelCallNode";
import RestoreNode from "./nodes/RestoreNode";
import ExportNode from "./nodes/ExportNode";
import DataFlowEdge from "./edges/DataFlowEdge";

const nodeTypes: NodeTypes = {
  input_transform: InputTransformNode as NodeTypes[string],
  desensitize: DesensitizeNode as NodeTypes[string],
  model_call: ModelCallNode as NodeTypes[string],
  restore: RestoreNode as NodeTypes[string],
  export: ExportNode as NodeTypes[string],
};

const edgeTypes: EdgeTypes = {
  dataflow: DataFlowEdge as EdgeTypes[string],
};

type WorkflowCanvasProps = {
  nodes: WFNode[];
  edges: WFEdge[];
  setNodes: (updater: WFNode[] | ((prev: WFNode[]) => WFNode[])) => void;
  setEdges: (updater: WFEdge[] | ((prev: WFEdge[]) => WFEdge[])) => void;
  onNodeDropped: (nodeType: WorkflowNodeType, position: { x: number; y: number }) => void;
  onNodeSelect: (id: string | null) => void;
  /** Set of node IDs that have validation errors — triggers red border highlight */
  errorNodeIds?: Set<string>;
  /** Callback to expose fitView so parent can center on a node */
  onFitViewReady?: (fitView: (opts?: { nodes?: { id: string }[] }) => void) => void;
};

// Inner canvas component must be inside SolidFlow context to use useSolidFlow
function CanvasInner(props: {
  onNodeDropped: (nodeType: WorkflowNodeType, position: { x: number; y: number }) => void;
  onFitViewReady?: (fitView: (opts?: { nodes?: { id: string }[] }) => void) => void;
}) {
  const flow = useSolidFlow();

  // Expose fitView to parent via callback
  if (props.onFitViewReady) {
    props.onFitViewReady((opts) => flow.fitView(opts));
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const nodeType = e.dataTransfer?.getData("application/solid-flow-node") as WorkflowNodeType | undefined;
    if (!nodeType) return;

    // Convert screen coordinates to canvas flow coordinates
    const position = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    props.onNodeDropped(nodeType, position);
  }

  return (
    <div
      class="absolute inset-0"
      style={{ "pointer-events": "all", "z-index": "5" }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    />
  );
}

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  function handleConnect(connection: EdgeConnection) {
    // addEdge merges the new connection into the current edge list
    const updated = addEdge(connection, props.edges as unknown as EdgeConnection[]) as unknown as WFEdge[];
    props.setEdges(updated);
  }

  // Inject hasError into node data based on errorNodeIds set
  const nodesWithErrors = () => {
    const errorIds = props.errorNodeIds;
    if (!errorIds || errorIds.size === 0) return props.nodes;
    return props.nodes.map((n) => ({
      ...n,
      data: { ...n.data, hasError: errorIds.has(n.id) },
    }));
  };

  // Annotate edges with label from source node's outputs (data flow preview)
  const annotatedEdges = () => {
    return props.edges.map((edge) => {
      const sourceNode = props.nodes.find((n) => n.id === edge.source);
      const outputs = sourceNode?.data.outputs as Array<{ name?: string; id?: string }> | undefined;
      if (outputs && outputs.length > 0) {
        const label = outputs.map((o) => o.name ?? "输出").join(", ");
        return { ...edge, label };
      }
      return edge;
    });
  };

  return (
    <div class="w-full h-full">
      <SolidFlow
        nodes={nodesWithErrors() as unknown as Store<Node[]>}
        edges={annotatedEdges() as unknown as Store<Edge[]>}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={handleConnect}
        onNodeClick={({ node }) => props.onNodeSelect(node.id)}
        fitView
        minZoom={0.2}
        maxZoom={4}
        defaultMarkerColor="#6366f1"
      >
        <Background variant="dots" patternColor="#cbd5e1" bgColor="#f8fafc" />
        <Controls />
        <MiniMap
          nodeColor="#6366f1"
          maskColor="rgba(248,250,252,0.7)"
          style={{ bottom: "80px" }}
        />
        <CanvasInner
          onNodeDropped={props.onNodeDropped}
          onFitViewReady={props.onFitViewReady}
        />
      </SolidFlow>
    </div>
  );
}
