import type { ExportConfig, NodeConfig, NodeExecution } from "@intelliflow/shared";
import { Match, Switch } from "solid-js";
import ExportExecutor from "../nodes/ExportExecutor";
import DesensitizeCompleted from "./DesensitizeCompleted";
import InputTransformCompleted from "./InputTransformCompleted";
import ModelCallCompleted from "./ModelCallCompleted";
import PptCompleted from "./PptCompleted";
import RestoreCompleted from "./RestoreCompleted";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onFullscreen?: (content: string, title: string) => void;
  onReexecute?: () => void;
}

export default function CompletedViewRouter(props: Props) {
  return (
    <Switch
      fallback={
        <div class="bg-white rounded-2xl shadow-[0_12px_40px_rgba(25,28,30,0.06)] p-8 text-center text-sm text-[#464555]">
          未知节点类型: {props.node.nodeType}
        </div>
      }
    >
      <Match when={props.node.nodeType === "input_transform"}>
        <InputTransformCompleted
          node={props.node}
          config={props.config}
          documentId={props.documentId}
          onReexecute={props.onReexecute}
        />
      </Match>
      <Match when={props.node.nodeType === "desensitize"}>
        <DesensitizeCompleted
          node={props.node}
          config={props.config}
          documentId={props.documentId}
          onFullscreen={props.onFullscreen}
          onReexecute={props.onReexecute}
        />
      </Match>
      <Match when={props.node.nodeType === "model_call"}>
        <ModelCallCompleted
          node={props.node}
          config={props.config}
          documentId={props.documentId}
          onFullscreen={props.onFullscreen}
          onReexecute={props.onReexecute}
        />
      </Match>
      <Match when={props.node.nodeType === "restore"}>
        <RestoreCompleted
          node={props.node}
          config={props.config}
          documentId={props.documentId}
          onFullscreen={props.onFullscreen}
          onReexecute={props.onReexecute}
        />
      </Match>
      <Match when={props.node.nodeType === "export"}>
        <ExportExecutor
          nodeExecution={props.node}
          config={(props.config ?? { type: "export", formats: [], contentMapping: [] }) as ExportConfig}
          documentId={props.documentId}
          onDraftSave={() => {}}
          readOnly={false}
        />
      </Match>
      <Match when={props.node.nodeType === "ppt"}>
        <PptCompleted node={props.node} config={props.config} documentId={props.documentId} />
      </Match>
    </Switch>
  );
}
