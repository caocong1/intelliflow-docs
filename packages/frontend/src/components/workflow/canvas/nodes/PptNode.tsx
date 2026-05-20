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
  if (config.type !== "ppt") return false;
  return (config.contentMapping?.length ?? 0) > 0;
}

function getConfigSummary(config: NodeConfig): string {
  if (config.type !== "ppt") return "";
  const parts: string[] = [];
  const mode = config.styleSelectionMode ?? "runtime_select";
  const modeLabel = mode === "fixed" ? "固定风格" : mode === "auto" ? "自动推荐" : "运行时选择";
  parts.push(modeLabel);
  const mappingCount = config.contentMapping?.length ?? 0;
  if (mappingCount > 0) parts.push(`${mappingCount} 个映射`);
  return parts.join(", ");
}

export default function PptNode(props: NodeContentProps) {
  const configured = () => isConfigured(props.data.config);
  const hasError = () => props.hasError === true;
  const summary = () => getConfigSummary(props.data.config);

  return (
    <div
      class={`min-w-[180px] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 bg-white border shadow-sm hover:shadow-md ${
        hasError() ? "border-red-300 shadow-red-100/50" : "border-slate-200"
      }`}
    >
      <div class="h-[3px] w-full bg-sky-500" />
      <div class="px-3 py-2.5">
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-sky-100">
            <svg
              class="w-3 h-3 text-sky-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <title>PPT 生成</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 4.5A1.5 1.5 0 014.5 3h15A1.5 1.5 0 0121 4.5v11A1.5 1.5 0 0119.5 17H13v2.25l3 1.5M11 17v2.25l-3 1.5M7 8h5M7 11h8m2-3h.01"
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
