import type { FlowNodeData, FlowEdgeData } from "./types";

export type FlowSnapshot = {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
};

/**
 * Snapshot-based undo/redo with bounded history.
 * Uses structuredClone for deep copies to prevent shared references.
 */
export function createUndoRedo(initial: FlowSnapshot, maxHistory = 50) {
  let current: FlowSnapshot = structuredClone(initial);
  const undoStack: FlowSnapshot[] = [];
  const redoStack: FlowSnapshot[] = [];

  function push(snapshot: FlowSnapshot) {
    undoStack.push(structuredClone(current));
    if (undoStack.length > maxHistory) {
      undoStack.shift();
    }
    current = structuredClone(snapshot);
    redoStack.length = 0;
  }

  function undo(): FlowSnapshot | null {
    if (undoStack.length === 0) return null;
    const prev = undoStack.pop()!;
    redoStack.push(structuredClone(current));
    current = prev;
    return structuredClone(current);
  }

  function redo(): FlowSnapshot | null {
    if (redoStack.length === 0) return null;
    const next = redoStack.pop()!;
    undoStack.push(structuredClone(current));
    current = next;
    return structuredClone(current);
  }

  function canUndo(): boolean {
    return undoStack.length > 0;
  }

  function canRedo(): boolean {
    return redoStack.length > 0;
  }

  return { push, undo, redo, canUndo, canRedo };
}
