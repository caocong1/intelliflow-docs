import { createSignal } from "solid-js";
import type { FlowNodeData } from "./types";

export function createSelectionStore() {
  const [selectedNodeIds, setSelectedNodeIds] = createSignal<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = createSignal<Set<string>>(new Set());

  /**
   * Select a node. If multi is true (Ctrl/Shift held), toggle the node in the selection set.
   * Otherwise, clear all and select just this one.
   */
  function selectNode(id: string, multi: boolean) {
    setSelectedEdgeIds(new Set<string>());
    if (multi) {
      setSelectedNodeIds((prev) => {
        const next = new Set<string>(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      setSelectedNodeIds(new Set<string>([id]));
    }
  }

  /**
   * Select an edge. Clears node selection. Single-select only for edges.
   */
  function selectEdge(id: string) {
    setSelectedNodeIds(new Set<string>());
    setSelectedEdgeIds(new Set<string>([id]));
  }

  /**
   * Rubber-band: select all nodes whose bounding box intersects the given rectangle.
   * rect is in flow coordinates: { x, y, width, height }.
   */
  function selectNodesInRect(
    rect: { x: number; y: number; width: number; height: number },
    nodes: FlowNodeData[],
  ) {
    const ids = new Set<string>();
    const rx = rect.x;
    const ry = rect.y;
    const rx2 = rect.x + rect.width;
    const ry2 = rect.y + rect.height;

    for (const node of nodes) {
      const nx = node.position.x;
      const ny = node.position.y;
      const nx2 = nx + node.size.width;
      const ny2 = ny + node.size.height;

      // AABB intersection test
      if (nx < rx2 && nx2 > rx && ny < ry2 && ny2 > ry) {
        ids.add(node.id);
      }
    }

    setSelectedEdgeIds(new Set<string>());
    setSelectedNodeIds(ids);
  }

  /** Clear all selection */
  function clearSelection() {
    setSelectedNodeIds(new Set<string>());
    setSelectedEdgeIds(new Set<string>());
  }

  /** Reactive check: is this node selected? */
  function isNodeSelected(id: string): boolean {
    return selectedNodeIds().has(id);
  }

  /** Reactive check: is this edge selected? */
  function isEdgeSelected(id: string): boolean {
    return selectedEdgeIds().has(id);
  }

  return {
    selectedNodeIds,
    selectedEdgeIds,
    selectNode,
    selectEdge,
    selectNodesInRect,
    clearSelection,
    isNodeSelected,
    isEdgeSelected,
  };
}
