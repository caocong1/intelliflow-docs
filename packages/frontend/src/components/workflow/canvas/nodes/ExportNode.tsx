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
  if (config.type !== "export") return false;
  return (config.contentMapping?.length ?? 0) > 0;
}

function getConfigSummary(config: NodeConfig): string {
  if (config.type !== "export") return "";
  const parts: string[] = [];
  if (config.format) parts.push(config.format.toUpperCase());
  const mappingCount = config.contentMapping?.length ?? 0;
  if (mappingCount > 0) parts.push(`${mappingCount} 个映射`);
  return parts.length > 0 ? parts.join(", ") : "暂未配置导出";
}

export default function ExportNode(props: NodeContentProps) {
  const configured = () => isConfigured(props.data.config);
  const hasError = () => props.hasError === true;
  const summary = () => getConfigSummary(props.data.config);

  return (
    <div
      class={`min-w-[180px] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 bg-white border shadow-sm hover:shadow-md ${
        hasError() ? "border-red-300 shadow-red-100/50" : "border-slate-200"
      }`}
    >
      {/* Top accent bar — export uses rose-600 to distinguish from error red */}
      <div class="h-[3px] w-full bg-rose-500" />
      <div class="px-3 py-2.5">
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-rose-100">
            <svg
              class="w-3 h-3 text-rose-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <title>文件导出</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <span class="text-xs font-medium flex-1 truncate text-slate-700">{props.data.label}</span>
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
