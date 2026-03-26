import { createResource, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { fetchOverview, type StatisticsFilters } from "../../lib/api/statistics";
import KpiCards from "./stats/KpiCards";

const tabs = [
  { id: "overview", label: "总览" },
  { id: "model", label: "模型统计" },
  { id: "user", label: "用户统计" },
  { id: "workflow", label: "流程统计" },
  { id: "audit", label: "审计明细" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const granularityOptions = [
  { value: "day" as const, label: "日" },
  { value: "week" as const, label: "周" },
  { value: "month" as const, label: "月" },
];

export default function StatsDashboard() {
  const [filters, setFilters] = createStore<StatisticsFilters>({
    dateFrom: sevenDaysAgo(),
    dateTo: today(),
    granularity: "day",
    projectId: "",
    documentTypeId: "",
    workflowId: "",
    department: "",
  });

  const [activeTab, setActiveTab] = createSignal<TabId>("overview");

  const filtersKey = () => JSON.stringify(filters);
  const [overview] = createResource(filtersKey, () => fetchOverview(filters));

  return (
    <div class="space-y-6">
      {/* Header */}
      <div>
        <h1 class="text-xl font-bold text-gray-900">统计面板</h1>
        <p class="mt-1 text-sm text-gray-500">查看平台使用情况和审计数据</p>
      </div>

      {/* Filter bar */}
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <div class="flex flex-wrap items-end gap-3">
          {/* Date range */}
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              开始日期
              <input
                type="date"
                class="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={filters.dateFrom}
                onInput={(e) => setFilters("dateFrom", e.currentTarget.value)}
              />
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              结束日期
              <input
                type="date"
                class="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={filters.dateTo}
                onInput={(e) => setFilters("dateTo", e.currentTarget.value)}
              />
            </label>
          </div>

          {/* Granularity button group */}
          <div>
            <span class="block text-xs font-medium text-gray-600 mb-1">时间粒度</span>
            <div class="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              {granularityOptions.map((opt) => (
                <button
                  type="button"
                  class={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    filters.granularity === opt.value
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setFilters("granularity", opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimension dropdowns */}
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              部门
              <select
                class="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                value={filters.department}
                onChange={(e) => setFilters("department", e.currentTarget.value)}
              >
                <option value="">全部</option>
              </select>
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              项目
              <select
                class="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                value={filters.projectId}
                onChange={(e) => setFilters("projectId", e.currentTarget.value)}
              >
                <option value="">全部</option>
              </select>
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              文档类型
              <select
                class="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                value={filters.documentTypeId}
                onChange={(e) => setFilters("documentTypeId", e.currentTarget.value)}
              >
                <option value="">全部</option>
              </select>
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              流程
              <select
                class="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                value={filters.workflowId}
                onChange={(e) => setFilters("workflowId", e.currentTarget.value)}
              >
                <option value="">全部</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCards data={() => overview()} />

      {/* Tab bar */}
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              type="button"
              class={`py-3 px-1 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab() === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content placeholders */}
      <div class="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
        {activeTab() === "overview" && "总览图表区域（后续计划实现）"}
        {activeTab() === "model" && "模型统计详情（后续计划实现）"}
        {activeTab() === "user" && "用户统计详情（后续计划实现）"}
        {activeTab() === "workflow" && "流程统计详情（后续计划实现）"}
        {activeTab() === "audit" && "审计明细（后续计划实现）"}
      </div>
    </div>
  );
}
