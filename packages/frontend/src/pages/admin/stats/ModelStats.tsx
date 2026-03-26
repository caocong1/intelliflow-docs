import { For, Show, createResource } from "solid-js";
import ChartContainer from "../../../components/charts/ChartContainer";
import { type StatisticsFilters, fetchByModel } from "../../../lib/api/statistics";
import type { EChartsCoreOption } from "../../../lib/echarts";

const fmt = new Intl.NumberFormat("zh-CN");
const costFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface ModelStatsProps {
  filters: StatisticsFilters;
}

export default function ModelStats(props: ModelStatsProps) {
  const filtersKey = () => JSON.stringify(props.filters);
  const [data] = createResource(filtersKey, () => fetchByModel(props.filters));

  const chartOption = (): EChartsCoreOption => {
    const items = data() ?? [];
    const models = items.map((m) => m.modelName);
    return {
      tooltip: { trigger: "axis" },
      legend: { data: models, bottom: 0 },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: "category",
        data: models,
      },
      yAxis: { type: "value", name: "调用次数" },
      series: [
        {
          name: "调用次数",
          type: "bar",
          data: items.map((m) => m.callCount),
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  };

  return (
    <div class="space-y-6">
      {/* Chart */}
      <div class="bg-white border border-gray-200 rounded-xl p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">模型调用分布</h3>
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
          <h3 class="text-sm font-semibold text-gray-700">模型统计明细</h3>
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
                  <th class="px-6 py-3">模型名称</th>
                  <th class="px-6 py-3 text-right">调用次数</th>
                  <th class="px-6 py-3 text-right">Token 消耗</th>
                  <th class="px-6 py-3 text-right">成功率</th>
                  <th class="px-6 py-3 text-right">估算成本</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <For each={sortedByCallCount()}>
                  {(row) => (
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-3 font-medium text-gray-900">{row.modelName}</td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {fmt.format(row.callCount)}
                      </td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {fmt.format(row.totalTokens)}
                      </td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {(row.successRate * 100).toFixed(1)}%
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
