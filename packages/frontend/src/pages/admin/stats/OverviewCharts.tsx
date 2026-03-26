import { createResource, Show } from "solid-js";
import type { StatisticsFilters } from "../../../lib/api/statistics";
import {
  fetchTrends,
  fetchByModel,
  fetchByUser,
  fetchAuditByDocument,
} from "../../../lib/api/statistics";
import ChartContainer from "../../../components/charts/ChartContainer";
import type { EChartsCoreOption } from "../../../lib/echarts";

interface OverviewChartsProps {
  filters: StatisticsFilters;
}

function filtersKey(filters: StatisticsFilters): string {
  return JSON.stringify(filters);
}

/** Card wrapper for each chart panel */
function ChartPanel(props: { title: string; children: any }) {
  return (
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">{props.title}</h3>
      {props.children}
    </div>
  );
}

export default function OverviewCharts(props: OverviewChartsProps) {
  const key = () => filtersKey(props.filters);

  const [trends] = createResource(key, () => fetchTrends(props.filters));
  const [byModel] = createResource(key, () => fetchByModel(props.filters));
  const [byUser] = createResource(key, () => fetchByUser(props.filters));
  const [auditDocs] = createResource(key, () =>
    fetchAuditByDocument(props.filters),
  );

  // --- Chart option builders ---

  const trendOption = (): EChartsCoreOption => {
    const data = trends() ?? [];
    return {
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const item = data[p.dataIndex];
          if (!item) return "";
          return `${item.period}<br/>调用次数: ${item.callCount}<br/>Token 总量: ${item.totalTokens}`;
        },
      },
      legend: { data: ["调用次数"], bottom: 0 },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: "category",
        data: data.map((d) => d.period),
        axisLabel: { fontSize: 11 },
      },
      yAxis: { type: "value", axisLabel: { fontSize: 11 } },
      series: [
        {
          name: "调用次数",
          type: "line",
          data: data.map((d) => d.callCount),
          smooth: true,
          areaStyle: { opacity: 0.15 },
          itemStyle: { color: "#6366f1" },
        },
      ],
    };
  };

  const modelOption = (): EChartsCoreOption => {
    const data = byModel() ?? [];
    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        orient: "vertical",
        right: 10,
        top: "center",
        type: "scroll",
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          center: ["40%", "50%"],
          data: data.map((d) => ({
            name: d.modelName,
            value: d.callCount,
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.2)",
            },
          },
          label: { show: false },
        },
      ],
    };
  };

  const userOption = (): EChartsCoreOption => {
    const raw = byUser() ?? [];
    const data = [...raw].sort((a, b) => a.callCount - b.callCount).slice(-10);
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      legend: { data: ["调用次数"], bottom: 0 },
      grid: { left: 90, right: 20, top: 10, bottom: 40 },
      xAxis: { type: "value", axisLabel: { fontSize: 11 } },
      yAxis: {
        type: "category",
        data: data.map((d) => d.displayName),
        axisLabel: { fontSize: 11, width: 70, overflow: "truncate" },
      },
      series: [
        {
          name: "调用次数",
          type: "bar",
          data: data.map((d) => d.callCount),
          itemStyle: { color: "#8b5cf6", borderRadius: [0, 4, 4, 0] },
        },
      ],
    };
  };

  // --- Audit table ---

  interface AuditRecord {
    calledAt: string;
    displayName: string;
    workflowName: string;
    modelName: string;
    totalTokens: number;
    durationMs: number;
    estimatedCost: number;
  }

  function flattenAuditRecords(): AuditRecord[] {
    const docs = auditDocs() ?? [];
    const all: AuditRecord[] = [];
    for (const doc of docs) {
      for (const r of doc.records as AuditRecord[]) {
        all.push(r);
      }
    }
    return all
      .sort(
        (a, b) =>
          new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime(),
      )
      .slice(0, 10);
  }

  return (
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 1. Call Trend - Area/line chart */}
      <ChartPanel title="调用趋势图">
        <Show when={!trends.loading} fallback={<LoadingPlaceholder />}>
          <ChartContainer option={trendOption} class="w-full h-64" />
        </Show>
      </ChartPanel>

      {/* 2. Model Distribution - Doughnut chart */}
      <ChartPanel title="模型分布">
        <Show when={!byModel.loading} fallback={<LoadingPlaceholder />}>
          <ChartContainer option={modelOption} class="w-full h-64" />
        </Show>
      </ChartPanel>

      {/* 3. User TOP Ranking - Horizontal bar chart */}
      <ChartPanel title="用户 TOP 排名">
        <Show when={!byUser.loading} fallback={<LoadingPlaceholder />}>
          <ChartContainer option={userOption} class="w-full h-64" />
        </Show>
      </ChartPanel>

      {/* 4. Recent Audit Records - Table */}
      <ChartPanel title="最近审计记录">
        <Show when={!auditDocs.loading} fallback={<LoadingPlaceholder />}>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th class="pb-2 pr-3">时间</th>
                  <th class="pb-2 pr-3">用户</th>
                  <th class="pb-2 pr-3">流程</th>
                  <th class="pb-2 pr-3">模型</th>
                  <th class="pb-2 pr-3 text-right">Token数</th>
                  <th class="pb-2 pr-3 text-right">耗时</th>
                  <th class="pb-2 text-right">成本</th>
                </tr>
              </thead>
              <tbody>
                {flattenAuditRecords().map((r) => (
                  <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-2 pr-3 text-gray-600 whitespace-nowrap">
                      {new Date(r.calledAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td class="py-2 pr-3 text-gray-800">{r.displayName}</td>
                    <td class="py-2 pr-3 text-gray-600">{r.workflowName}</td>
                    <td class="py-2 pr-3 text-gray-600">{r.modelName}</td>
                    <td class="py-2 pr-3 text-right text-gray-700">
                      {r.totalTokens.toLocaleString()}
                    </td>
                    <td class="py-2 pr-3 text-right text-gray-700">
                      {r.durationMs >= 1000
                        ? `${(r.durationMs / 1000).toFixed(1)}s`
                        : `${r.durationMs}ms`}
                    </td>
                    <td class="py-2 text-right text-gray-700">
                      ${r.estimatedCost.toFixed(4)}
                    </td>
                  </tr>
                ))}
                <Show when={flattenAuditRecords().length === 0}>
                  <tr>
                    <td
                      colspan={7}
                      class="py-6 text-center text-gray-400 text-sm"
                    >
                      暂无审计记录
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </Show>
      </ChartPanel>
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div class="w-full h-64 flex items-center justify-center text-gray-400 text-sm">
      加载中...
    </div>
  );
}
