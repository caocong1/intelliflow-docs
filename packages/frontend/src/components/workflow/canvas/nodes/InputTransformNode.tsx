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
  if (config.type !== "input_transform") return "";
  const count = config.formFields?.length ?? 0;
  return count > 0 ? `${count} 个输入项` : "暂无输入项";
}

function isConfigured(config: NodeConfig): boolean {
  if (config.type !== "input_transform") return false;
  return (config.formFields?.length ?? 0) > 0;
}

export default function InputTransformNode(props: NodeContentProps) {
  const configured = () => isConfigured(props.data.config);
  const hasError = () => props.hasError === true;
  const summary = () => getConfigSummary(props.data.config);

  return (
    <div
      class={`min-w-[180px] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 bg-white border shadow-sm hover:shadow-md ${
        hasError() ? "border-red-300 shadow-red-100/50" : "border-slate-200"
      }`}
    >
      {/* Top accent bar */}
      <div class={`h-[3px] w-full ${hasError() ? "bg-red-500" : "bg-blue-500"}`} />
      <div class="px-3 py-2.5">
        <div class="flex items-center gap-2">
          {/* Icon */}
          <div
            class={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${hasError() ? "bg-red-100" : "bg-blue-100"}`}
          >
            <svg
              class={`w-3 h-3 ${hasError() ? "text-red-600" : "text-blue-600"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <title>输入转换</title>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span class="text-xs font-medium flex-1 truncate text-slate-700">{props.data.label}</span>
          {/* Auto badge */}
          {props.data.config.autoAdvance && (
            <span class="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-indigo-100 text-indigo-600 leading-none">
              auto
            </span>
          )}
          {/* Status indicator dot */}
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
