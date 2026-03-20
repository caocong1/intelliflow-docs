import type { WorkflowNodeType, NodeConfig, OutputDef } from "@intelliflow/shared";

export type HandlePosition = "top" | "right" | "bottom" | "left";

export type Viewport = { x: number; y: number; zoom: number };

export type FlowNodeData = {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data: {
    nodeType: WorkflowNodeType;
    label: string;
    config: NodeConfig;
    outputs: OutputDef[];
  };
  sourceHandle: HandlePosition;
  targetHandle: HandlePosition;
};

export type FlowEdgeData = {
  id: string;
  source: string;
  target: string;
  type: "bezier" | "straight" | "step";
  sourceHandle?: HandlePosition;
  targetHandle?: HandlePosition;
  controlPoints?: Array<{ x: number; y: number }>;
};

export type PathResult = {
  path: string;
  labelX: number;
  labelY: number;
};
