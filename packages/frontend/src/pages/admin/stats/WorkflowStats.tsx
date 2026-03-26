import { For, Show, createResource } from "solid-js";
import ChartContainer from "../../../components/charts/ChartContainer";
import { type StatisticsFilters, fetchByWorkflow } from "../../../lib/api/statistics";
import type { EChartsCoreOption } from "../../../lib/echarts";

const fmt = new Intl.NumberFormat("zh-CN");

interface WorkflowStatsProps {
  filters: StatisticsFilters;
}

export default function WorkflowStats(props: WorkflowStatsProps) {
  const filtersKey = () => JSON.stringify(props.filters);
  const [data] = createResource(filtersKey, () => fetchByWorkflow(props.filters));

  const chartOption = (): EChartsCoreOption => {
    const items = data() ?? [];
    const workflows = items.map((w) => w.workflowName);
    return {
      tooltip: { trigger: "axis" },
      legend: { data: workflows, bottom: 0 },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: "category",
        data: workflows,
        axisLabel: {
          rotate: items.length > 5 ? 30 : 0,
          width: 80,
          overflow: "truncate",
        },
      },
      yAxis: { type: "value", name: "使用次数" },
      series: [
        {
          name: "使用次数",
          type: "bar",
          data: items.map((w) => w.usageCount),
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "#34d399" },
                { offset: 1, color: "#10b981" },
              ],
            },
          },
        },
      ],
    };
  };

  return (
    <div class="space-y-6">
      {/* Chart */}
      <div class="bg-white border border-gray-200 rounded-xl p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">流程使用分布</h3>
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
          <h3 class="text-sm font-semibold text-gray-700">流程统计明细</h3>
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
                  <th class="px-6 py-3">流程名称</th>
                  <th class="px-6 py-3 text-right">使用次数</th>
                  <th class="px-6 py-3 text-right">用户数</th>
                  <th class="px-6 py-3 text-right">文档数</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <For each={sortedByUsageCount()}>
                  {(row) => (
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-3 font-medium text-gray-900">{row.workflowName}</td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {fmt.format(row.usageCount)}
                      </td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {fmt.format(row.userCount)}
                      </td>
                      <td class="px-6 py-3 text-right text-gray-700">
                        {fmt.format(row.documentCount)}
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

  function sortedByUsageCount() {
    return [...(data() ?? [])].sort((a, b) => b.usageCount - a.usageCount);
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
