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

function isConfigured(config: NodeConfig): boolean {
  if (config.type !== "restore") return false;
  return config.pairedDesensitizeNodeId != null && config.pairedDesensitizeNodeId !== "";
}

export default function RestoreNode(props: NodeContentProps) {
  const configured = () => isConfigured(props.data.config);
  const hasError = () => props.hasError === true;
  const summary = () => (configured() ? "已关联脱敏节点" : "未关联脱敏节点");

  return (
    <div
      class={`min-w-[180px] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 bg-white border shadow-sm hover:shadow-md ${
        hasError() ? "border-red-300 shadow-red-100/50" : "border-slate-200"
      }`}
    >
      {/* Top accent bar */}
      <div class={`h-[3px] w-full ${hasError() ? "bg-red-500" : "bg-green-500"}`} />
      <div class="px-3 py-2.5">
        <div class="flex items-center gap-2">
          <div
            class={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${hasError() ? "bg-red-100" : "bg-green-100"}`}
          >
            <svg
              class={`w-3 h-3 ${hasError() ? "text-red-600" : "text-green-600"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <title>信息恢复</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <span class="text-xs font-medium flex-1 truncate text-slate-700">{props.data.label}</span>
          {props.data.config.autoAdvance && (
            <span class="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-indigo-100 text-indigo-600 leading-none">
              auto
            </span>
          )}
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
