import { Show } from "solid-js";
import type { OverviewData } from "../../../lib/api/statistics";

interface KpiCardsProps {
  data: () => OverviewData | undefined;
}

interface KpiCard {
  label: string;
  key: keyof OverviewData;
  icon: string;
  format: (v: number) => string;
  span2?: boolean;
}

const fmt = new Intl.NumberFormat("zh-CN");
const fmtPct = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const cards: KpiCard[] = [
  { label: "总调用次数", key: "totalCalls", icon: "call", format: (v) => fmt.format(v), span2: true },
  { label: "总 Token 消耗", key: "totalTokens", icon: "token", format: (v) => fmt.format(v) },
  { label: "活跃用户数", key: "activeUsers", icon: "user", format: (v) => fmt.format(v) },
  { label: "文档生成数", key: "documentCount", icon: "doc", format: (v) => fmt.format(v) },
  { label: "总成本估算", key: "estimatedCost", icon: "cost", format: (v) => `$${fmt.format(v)}`, span2: true },
  { label: "今日调用量", key: "todayCalls", icon: "today", format: (v) => fmt.format(v) },
  { label: "平均耗时(ms)", key: "avgDuration", icon: "time", format: (v) => fmt.format(Math.round(v)) },
  { label: "平均成功率(%)", key: "successRate", icon: "rate", format: (v) => `${fmtPct.format(v)}%` },
];

function KpiIcon(props: { type: string }) {
  const paths: Record<string, string> = {
    call: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
    token: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z",
    user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    doc: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    cost: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    today: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    time: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    rate: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  return (
    <svg class="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={paths[props.type] ?? paths.doc} />
    </svg>
  );
}

export default function KpiCards(props: KpiCardsProps) {
  return (
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          class={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm ${card.span2 ? "md:col-span-2 lg:col-span-2" : ""}`}
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <KpiIcon type={card.icon} />
            </div>
            <span class="text-sm font-medium text-gray-500">{card.label}</span>
          </div>
          <Show when={props.data()} fallback={<div class="h-8 bg-gray-100 rounded animate-pulse" />}>
            <p class="text-2xl font-bold text-gray-900">
              {card.format(props.data()![card.key])}
            </p>
          </Show>
        </div>
      ))}
    </div>
  );
}
