import { For, Show, createResource } from "solid-js";
import ChartContainer from "../../../components/charts/ChartContainer";
import { type StatisticsFilters, fetchByUser } from "../../../lib/api/statistics";
import type { EChartsCoreOption } from "../../../lib/echarts";

const fmt = new Intl.NumberFormat("zh-CN");
const costFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface UserStatsProps {
  filters: StatisticsFilters;
}

export default function UserStats(props: UserStatsProps) {
  const filtersKey = () => JSON.stringify(props.filters);
  const [data] = createResource(filtersKey, () => fetchByUser(props.filters));

  const chartOption = (): EChartsCoreOption => {
    const items = sortedByCallCount().slice(0, 10);
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 80, right: 20, top: 20, bottom: 30 },
      xAxis: { type: "value", name: "调用次数" },
      yAxis: {
        type: "category",
        data: items.map((u) => u.userName).reverse(),
        axisLabel: {
          width: 60,
          overflow: "truncate",
        },
      },
      series: [
        {
          name: "调用次数",
          type: "bar",
          data: items.map((u) => u.callCount).reverse(),
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: "#818cf8" },
                { offset: 1, color: "#6366f1" },
              ],
            },
          },
        },
      ],
    };
  };

  return (
    <div class="space-y-6">
      {/* Chart - Top 10 users bar chart */}
      <div class="bg-white border border-gray-200 rounded-xl p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Top 10 用户调用量</h3>
        <Show
          when={!data.loading && (data()?.length ?? 0) > 0}
          fallback={
            <Show when={data.loading} fallback={<EmptyState />}>
              <LoadingSkeleton />
            </Show>
          }
        >
          <ChartContainer class="w-full h-72" option={chartOption} />
        </Show>
      </div>

      {/* Table */}
      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700">用户统计明细</h3>
        </div>
        <Show
          when={!data.loading && (data()?.length ?? 0) > 0}
          fallback={
            <Show when={data.loading} fallback={<EmptyState />}>
              <LoadingSkeleton />
            </Show>
          }
        >
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th class="px-6 py-3">用户</th>
                  <th class="px-6 py-3 text-right">调用次数</th>
                  <th class="px-6 py-3 text-right">文档生成数</th>
                  <th class="px-6 py-3 text-right">Token 消耗</th>
                  <th class="px-6 py-3 text-right">估算成本</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <For each={sortedByCallCount()}>
                  {(row) => (
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-3 font-medium text-gray-900">{row.userName}</td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {fmt.format(row.callCount)}
                      </td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {fmt.format(row.docCount)}
                      </td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {fmt.format(row.totalTokens)}
                      </td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {costFmt.format(row.estimatedCost)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </div>
  );

  function sortedByCallCount() {
    return [...(data() ?? [])].sort((a, b) => b.callCount - a.callCount);
  }
}

function LoadingSkeleton() {
  return (
    <div class="flex items-center justify-center h-48">
      <div class="animate-pulse flex flex-col items-center gap-2">
        <div class="w-8 h-8 bg-gray-200 rounded-full" />
        <div class="text-xs text-gray-400">加载中...</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return <div class="flex items-center justify-center h-48 text-sm text-gray-400">暂无数据</div>;
}
