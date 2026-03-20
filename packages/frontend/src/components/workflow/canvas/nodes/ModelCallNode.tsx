import type { NodeConfig, OutputDef } from "@intelliflow/shared";

type NodeContentProps = {
  data: {
    nodeType: string;
    label: string;
    config: NodeConfig;
    outputs: OutputDef[];
  };
  selected: boolean;
  hasError?: boolean;
};

function getConfigSummary(config: NodeConfig): string {
  if (config.type !== "model_call") return "";
  const count = config.modelIds?.length ?? 0;
  return count > 0 ? `${count} 个模型` : "暂未选择模型";
}

function isConfigured(config: NodeConfig): boolean {
  if (config.type !== "model_call") return false;
  return (config.modelIds?.length ?? 0) > 0;
}

export default function ModelCallNode(props: NodeContentProps) {
  const configured = () => isConfigured(props.data.config);
  const hasError = () => props.hasError === true;
  const summary = () => getConfigSummary(props.data.config);

  return (
    <div
      class={`min-w-[180px] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
        hasError()
          ? "bg-red-50 shadow-md shadow-red-100/50 ring-2 ring-red-400"
          : "bg-purple-50/50 shadow-sm hover:shadow-md"
      }`}
      style={{ "border-left": hasError() ? "4px solid #ef4444" : "4px solid #a855f7" }}
    >
      <div class="px-3 py-2.5">
        <div class="flex items-center gap-2">
          <div class={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${hasError() ? "bg-red-100" : "bg-purple-100"}`}>
            <svg class={`w-3.5 h-3.5 ${hasError() ? "text-red-600" : "text-purple-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <title>模型调用</title>
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a3.187 3.187 0 01-4.508.032L5 14.5m14 0l.044.044a.5.5 0 01-.044.738l-3 2.5" />
            </svg>
          </div>
          <span class={`text-xs font-semibold flex-1 truncate ${hasError() ? "text-red-700" : "text-purple-700"}`}>
            {props.data.label}
          </span>
          <span
            class={`w-2 h-2 rounded-full flex-shrink-0 ${
              hasError() ? "bg-red-500" : configured() ? "bg-emerald-500" : "bg-amber-400"
            }`}
            title={hasError() ? "校验失败" : configured() ? "已配置" : "未配置"}
          />
        </div>
        <p class="text-[10px] text-slate-400 mt-1.5 leading-tight">{summary()}</p>
      </div>
    </div>
  );
}
