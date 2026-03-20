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
  if (config.type !== "desensitize") return false;
  return config.categories.length > 0;
}

export default function DesensitizeNode(props: NodeContentProps) {
  const configured = () => isConfigured(props.data.config);
  const hasError = () => props.hasError === true;

  return (
    <div
      class={`min-w-[180px] bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer transition-shadow ${
        hasError()
          ? "border-2 border-red-500 shadow-red-100 hover:shadow-red-200 animate-pulse"
          : "border border-slate-200 hover:shadow-md"
      }`}
      style={{ "border-left": hasError() ? "4px solid #ef4444" : "4px solid #f97316" }}
    >
      <div class="px-3 py-2.5">
        <div class="flex items-center gap-2">
          <span class="text-base leading-none">🔒</span>
          <span class={`text-xs font-semibold flex-1 truncate ${hasError() ? "text-red-700" : "text-orange-700"}`}>
            {props.data.label}
          </span>
          <span
            class={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
              hasError()
                ? "bg-red-50 text-red-700 ring-1 ring-red-200/60"
                : configured()
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
            }`}
          >
            {hasError() ? "校验失败" : configured() ? "已配置" : "未配置"}
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">信息脱敏</p>
      </div>
    </div>
  );
}
