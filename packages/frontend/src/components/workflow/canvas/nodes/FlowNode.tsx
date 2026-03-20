import { type JSX, onCleanup, onMount } from "solid-js";
import type { FlowNodeData, HandlePosition } from "../../../../lib/flow-engine/types";
import NodeHandle from "./NodeHandle";

type FlowNodeProps = {
  node: FlowNodeData;
  selected: boolean;
  onDragStart: (nodeId: string, startScreenPos: { x: number; y: number }) => void;
  onHandleMouseDown: (
    nodeId: string,
    handleType: "source" | "target",
    position: HandlePosition,
  ) => void;
  onNodeClick: (nodeId: string, e: MouseEvent) => void;
  onSizeChange: (nodeId: string, size: { width: number; height: number }) => void;
  children: JSX.Element;
};

export default function FlowNode(props: FlowNodeProps) {
  let nodeRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!nodeRef) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          props.onSizeChange(props.node.id, { width, height });
        }
      }
    });
    observer.observe(nodeRef);
    onCleanup(() => observer.disconnect());
  });

  function handleMouseDown(e: MouseEvent) {
    // Don't start drag if clicking on a handle
    const target = e.target as HTMLElement;
    if (target.dataset.handleType || target.closest("[data-handle-type]")) {
      return;
    }
    e.stopPropagation();
    props.onDragStart(props.node.id, { x: e.clientX, y: e.clientY });
  }

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.dataset.handleType || target.closest("[data-handle-type]")) {
      return;
    }
    e.stopPropagation();
    props.onNodeClick(props.node.id, e);
  }

  return (
    <div
      ref={nodeRef}
      style={{
        position: "absolute",
        left: `${props.node.position.x}px`,
        top: `${props.node.position.y}px`,
        "z-index": props.selected ? 10 : 1,
      }}
      class={`select-none ${props.selected ? "ring-2 ring-blue-400 ring-offset-1 rounded-lg" : ""}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick(e as unknown as MouseEvent);
      }}
    >
      {props.children}
      {/* Target handle (left by default) */}
      <NodeHandle
        type="target"
        position={props.node.targetHandle}
        onMouseDown={(e) =>
          props.onHandleMouseDown(props.node.id, "target", props.node.targetHandle)
        }
      />
      {/* Source handle (right by default) */}
      <NodeHandle
        type="source"
        position={props.node.sourceHandle}
        onMouseDown={(e) =>
          props.onHandleMouseDown(props.node.id, "source", props.node.sourceHandle)
        }
      />
    </div>
  );
}
