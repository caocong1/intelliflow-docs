import type { NodeConfig, NodeExecution } from "@intelliflow/shared";
import { Match, Switch } from "solid-js";
import DesensitizeCompleted from "./DesensitizeCompleted";
import ExportCompleted from "./ExportCompleted";
import InputTransformCompleted from "./InputTransformCompleted";
import ModelCallCompleted from "./ModelCallCompleted";
import RestoreCompleted from "./RestoreCompleted";

interface Props {
  node: NodeExecution;
  config?: NodeConfig;
  documentId: string;
  onFullscreen?: (content: string, title: string) => void;
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
        />
      </Match>
      <Match when={props.node.nodeType === "desensitize"}>
        <DesensitizeCompleted
          node={props.node}
          config={props.config}
          documentId={props.documentId}
          onFullscreen={props.onFullscreen}
        />
      </Match>
      <Match when={props.node.nodeType === "model_call"}>
        <ModelCallCompleted
          node={props.node}
          config={props.config}
          documentId={props.documentId}
          onFullscreen={props.onFullscreen}
        />
      </Match>
      <Match when={props.node.nodeType === "restore"}>
        <RestoreCompleted
          node={props.node}
          config={props.config}
          documentId={props.documentId}
          onFullscreen={props.onFullscreen}
        />
      </Match>
      <Match when={props.node.nodeType === "export"}>
        <ExportCompleted node={props.node} config={props.config} documentId={props.documentId} />
      </Match>
    </Switch>
  );
}
