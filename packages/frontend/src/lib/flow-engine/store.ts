import { createStore, reconcile } from "solid-js/store";
import { createSignal } from "solid-js";
import type { FlowNodeData, FlowEdgeData, Viewport } from "./types";

export function createFlowStore(
  initialNodes: FlowNodeData[] = [],
  initialEdges: FlowEdgeData[] = [],
) {
  const [nodes, setNodes] = createStore<FlowNodeData[]>(initialNodes);
  const [edges, setEdges] = createStore<FlowEdgeData[]>(initialEdges);
  const [viewport, setViewport] = createSignal<Viewport>({ x: 0, y: 0, zoom: 1 });

  /** Update a single node by id (partial merge) */
  function updateNode(id: string, updates: Partial<FlowNodeData>) {
    setNodes(
      (node) => node.id === id,
      (prev) => ({ ...prev, ...updates }),
    );
  }

  /** Update node position */
  function updateNodePosition(id: string, position: { x: number; y: number }) {
    setNodes(
      (node) => node.id === id,
      "position",
      position,
    );
  }

  /** Update node size (from ResizeObserver) */
  function updateNodeSize(id: string, size: { width: number; height: number }) {
    setNodes(
      (node) => node.id === id,
      "size",
      size,
    );
  }

  /** Add a node */
  function addNode(node: FlowNodeData) {
    setNodes((prev) => [...prev, node]);
  }

  /** Remove a node and all associated edges */
  function removeNode(id: string) {
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    setNodes((prev) => prev.filter((n) => n.id !== id));
  }

  /** Remove multiple nodes (batch) and all associated edges */
  function removeNodes(ids: Set<string>) {
    setEdges((prev) => prev.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setNodes((prev) => prev.filter((n) => !ids.has(n.id)));
  }

  /**
   * Add an edge, enforcing linear constraint:
   * - Remove any existing edge from the same source (source already has outgoing)
   * - Remove any existing edge to the same target (target already has incoming)
   */
  function addEdge(edge: FlowEdgeData) {
    setEdges((prev) => {
      const filtered = prev.filter(
        (e) => e.source !== edge.source && e.target !== edge.target,
      );
      return [...filtered, edge];
    });
  }

  /** Remove an edge by id */
  function removeEdge(id: string) {
    setEdges((prev) => prev.filter((e) => e.id !== id));
  }

  /** Remove multiple edges (batch) */
  function removeEdges(ids: Set<string>) {
    setEdges((prev) => prev.filter((e) => !ids.has(e.id)));
  }

  /** Get a deep-cloned snapshot for undo/redo and autosave */
  function getSnapshot(): { nodes: FlowNodeData[]; edges: FlowEdgeData[] } {
    return structuredClone({ nodes: [...nodes], edges: [...edges] });
  }

  /** Apply a snapshot (from undo/redo), preserving fine-grained reactivity */
  function applySnapshot(snapshot: { nodes: FlowNodeData[]; edges: FlowEdgeData[] }) {
    setNodes(reconcile(snapshot.nodes));
    setEdges(reconcile(snapshot.edges));
  }

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    viewport,
    setViewport,
    updateNode,
    updateNodePosition,
    updateNodeSize,
    addNode,
    removeNode,
    removeNodes,
    addEdge,
    removeEdge,
    removeEdges,
    getSnapshot,
    applySnapshot,
  };
}
