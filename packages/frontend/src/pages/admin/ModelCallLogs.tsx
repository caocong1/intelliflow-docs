import { For, Show, createMemo, createSignal, onMount } from "solid-js";

interface ModelCallLogEntry {
  id: string;
  documentId: string;
  documentTitle: string | null;
  nodeExecutionId: string;
  userId: string | null;
  userDisplayName: string | null;
  providerId: string | null;
  providerName: string | null;
  modelId: string | null;
  modelName: string | null;
  callSource: string | null;
  promptTemplate: string | null;
  systemPrompt: string | null;
  resolvedPrompt: string | null;
  variableMapping: Record<string, string> | null;
  temperature: number | null;
  maxTokens: number | null;
  responseStatus: string | null;
  contentLength: number | null;
  tokenUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  duration: number | null;
  errorMessage: string | null;
  createdAt: string;
}

const CALL_SOURCE_MAP: Record<string, { label: string; color: string }> = {
  runtime: { label: "运行时", color: "bg-indigo-50 text-indigo-700" },
  model_test: { label: "模型测试", color: "bg-amber-50 text-amber-700" },
  provider_test: { label: "供应商测试", color: "bg-sky-50 text-sky-700" },
  prompt_optimize: { label: "提示词优化", color: "bg-teal-50 text-teal-700" },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(usage: ModelCallLogEntry["tokenUsage"]): string {
  if (!usage) return "-";
  const parts: string[] = [];
  if (usage.prompt_tokens != null) parts.push(`${usage.prompt_tokens.toLocaleString()}`);
  if (usage.completion_tokens != null) parts.push(`${usage.completion_tokens.toLocaleString()}`);
  return parts.length > 0 ? parts.join(" / ") : "-";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ModelCallLogs() {
  const [logs, setLogs] = createSignal<ModelCallLogEntry[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [loading, setLoading] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [systemPromptOpen, setSystemPromptOpen] = createSignal<string | null>(null);
  const [userPromptOpen, setUserPromptOpen] = createSignal<string | null>(null);
  const limit = 20;

  // Filters
  const [search, setSearch] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal<string>("");
  const [callSourceFilter, setCallSourceFilter] = createSignal<string>("");
  const [dateFrom, setDateFrom] = createSignal("");
  const [dateTo, setDateTo] = createSignal("");

  // Summary stats derived from current page data
  const stats = createMemo(() => {
    const all = logs();
    const successCount = all.filter((l) => l.responseStatus === "completed").length;
    const durations = all
      .filter((l): l is ModelCallLogEntry & { duration: number } => l.duration != null)
      .map((l) => l.duration);
    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const totalTokens = all.reduce((sum, l) => sum + (l.tokenUsage?.total_tokens ?? 0), 0);
    return {
      total: total(),
      successRate: all.length > 0 ? ((successCount / all.length) * 100).toFixed(1) : "0",
      avgDuration: avgDuration,
      totalTokens,
    };
  });

  async function fetchLogs() {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams();
      params.set("page", String(page()));
      params.set("limit", String(limit));
      if (search()) params.set("search", search());
      if (statusFilter()) params.set("status", statusFilter());
      if (callSourceFilter()) params.set("callSource", callSourceFilter());
      if (dateFrom()) params.set("dateFrom", dateFrom());
      if (dateTo()) params.set("dateTo", dateTo());

      const res = await fetch(`/api/admin/model-call-logs?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  onMount(() => fetchLogs());

  function handleFilter() {
    setPage(1);
    fetchLogs();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleFilter();
  }

  function handlePrevPage() {
    if (page() > 1) {
      setPage(page() - 1);
      fetchLogs();
    }
  }

  function handleNextPage() {
    if (page() * limit < total()) {
      setPage(page() + 1);
      fetchLogs();
    }
  }

  const totalPages = () => Math.max(1, Math.ceil(total() / limit));

  return (
    <div class="space-y-6">
      {/* Header with stats */}
      <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight">模型调用日志</h1>
          <p class="mt-1 text-sm text-gray-500">查看和分析 AI 模型的调用记录</p>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="总调用次数" value={stats().total.toLocaleString()} />
          <StatCard label="成功率" value={`${stats().successRate}%`} accent="text-emerald-600" />
          <StatCard label="平均耗时" value={formatDuration(stats().avgDuration)} />
          <StatCard
            label="Token 消耗"
            value={
              stats().totalTokens > 1000
                ? `${(stats().totalTokens / 1000).toFixed(1)}K`
                : String(stats().totalTokens)
            }
          />
        </div>
      </div>

      {/* Filter bar */}
      <div class="bg-white rounded-xl p-4" style="box-shadow: 0 1px 3px rgba(25,28,30,0.04)">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">
              搜索文档
              <div class="relative mt-1">
                <svg
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <title>搜索</title>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="输入文档名称..."
                  class="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-colors"
                  value={search()}
                  onInput={(e) => setSearch(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">
              状态
              <select
                class="mt-1 w-full px-3 py-2 text-sm bg-gray-50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none appearance-none cursor-pointer transition-colors"
                value={statusFilter()}
                onChange={(e) => setStatusFilter(e.currentTarget.value)}
              >
                <option value="">全部状态</option>
                <option value="completed">成功</option>
                <option value="failed">失败</option>
              </select>
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">
              调用来源
              <select
                class="mt-1 w-full px-3 py-2 text-sm bg-gray-50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none appearance-none cursor-pointer transition-colors"
                value={callSourceFilter()}
                onChange={(e) => setCallSourceFilter(e.currentTarget.value)}
              >
                <option value="">全部来源</option>
                <option value="runtime">运行时</option>
                <option value="model_test">模型测试</option>
                <option value="provider_test">供应商测试</option>
                <option value="prompt_optimize">提示词优化</option>
              </select>
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">
              开始日期
              <input
                type="date"
                class="mt-1 w-full px-3 py-2 text-sm bg-gray-50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-colors"
                value={dateFrom()}
                onInput={(e) => setDateFrom(e.currentTarget.value)}
              />
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">
              结束日期
              <input
                type="date"
                class="mt-1 w-full px-3 py-2 text-sm bg-gray-50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-colors"
                value={dateTo()}
                onInput={(e) => setDateTo(e.currentTarget.value)}
              />
            </label>
          </div>
          <div class="flex items-end">
            <button
              type="button"
              class="w-full px-4 py-2 text-sm font-medium text-white rounded-lg transition-all cursor-pointer hover:shadow-md active:scale-[0.98]"
              style="background: linear-gradient(135deg, #3525cd, #4f46e5)"
              onClick={handleFilter}
            >
              筛选
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        class="bg-white rounded-xl overflow-hidden"
        style="box-shadow: 0 1px 3px rgba(25,28,30,0.04)"
      >
        <Show when={loading()}>
          <div class="p-12 text-center">
            <div class="inline-block w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p class="mt-3 text-sm text-gray-400">加载中...</p>
          </div>
        </Show>

        <Show when={!loading() && logs().length === 0}>
          <div class="p-12 text-center">
            <svg
              class="mx-auto w-12 h-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <title>暂无记录</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <p class="mt-3 text-sm text-gray-400">暂无调用记录</p>
          </div>
        </Show>

        <Show when={!loading() && logs().length > 0}>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50/80">
                  <th class="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    时间
                  </th>
                  <th class="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    调用来源
                  </th>
                  <th class="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    文档
                  </th>
                  <th class="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    模型
                  </th>
                  <th class="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    状态
                  </th>
                  <th class="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    耗时
                  </th>
                  <th class="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Token 用量
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={logs()}>
                  {(log) => (
                    <>
                      <tr
                        class={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${expandedId() === log.id ? "bg-indigo-50/40" : ""}`}
                        onClick={() => setExpandedId(expandedId() === log.id ? null : log.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            setExpandedId(expandedId() === log.id ? null : log.id);
                        }}
                      >
                        <td class="px-4 py-3.5 text-gray-600 whitespace-nowrap font-mono text-xs">
                          {formatTime(log.createdAt)}
                        </td>
                        <td class="px-4 py-3.5">
                          <Show
                            when={log.callSource}
                            fallback={<span class="text-gray-400">-</span>}
                          >
                            <span
                              class={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${CALL_SOURCE_MAP[log.callSource ?? ""]?.color ?? "bg-gray-100 text-gray-600"}`}
                            >
                              {CALL_SOURCE_MAP[log.callSource ?? ""]?.label ?? log.callSource}
                            </span>
                          </Show>
                        </td>
                        <td
                          class="px-4 py-3.5 text-gray-700 max-w-[200px] truncate"
                          title={log.documentTitle ?? ""}
                        >
                          {log.documentTitle ?? <span class="text-gray-400">-</span>}
                        </td>
                        <td class="px-4 py-3.5 text-gray-700 whitespace-nowrap">
                          <div class="flex flex-col">
                            <span class="text-sm">{log.modelName ?? "-"}</span>
                            <Show when={log.providerName}>
                              <span class="text-xs text-gray-400">{log.providerName}</span>
                            </Show>
                          </div>
                        </td>
                        <td class="px-4 py-3.5">
                          <span
                            class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              log.responseStatus === "completed"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            <span
                              class={`w-1.5 h-1.5 rounded-full ${log.responseStatus === "completed" ? "bg-emerald-500" : "bg-red-500"}`}
                            />
                            {log.responseStatus === "completed" ? "成功" : "失败"}
                          </span>
                        </td>
                        <td class="px-4 py-3.5 text-gray-600 whitespace-nowrap tabular-nums">
                          {formatDuration(log.duration)}
                        </td>
                        <td class="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap tabular-nums">
                          <Show when={log.tokenUsage} fallback="-">
                            <span class="text-indigo-600">
                              {log.tokenUsage?.prompt_tokens?.toLocaleString()}
                            </span>
                            <span class="text-gray-400 mx-1">/</span>
                            <span class="text-emerald-600">
                              {log.tokenUsage?.completion_tokens?.toLocaleString()}
                            </span>
                          </Show>
                        </td>
                      </tr>

                      {/* Expanded details row */}
                      <Show when={expandedId() === log.id}>
                        <tr>
                          <td colSpan={7} class="px-4 py-0">
                            <div class="py-4 ml-4 border-l-2 border-indigo-200 pl-5 space-y-4 text-sm">
                              {/* User info */}
                              <Show when={log.userDisplayName}>
                                <div class="flex items-center gap-2 text-xs text-gray-500">
                                  <svg
                                    class="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                  >
                                    <title>用户</title>
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                                    />
                                  </svg>
                                  <span>调用者: {log.userDisplayName}</span>
                                </div>
                              </Show>

                              {/* System Prompt section */}
                              <Show when={log.systemPrompt}>
                                <div>
                                  <button
                                    type="button"
                                    class="flex items-center gap-2 text-gray-700 mb-2 cursor-pointer hover:text-indigo-600 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSystemPromptOpen(
                                        systemPromptOpen() === log.id ? null : log.id,
                                      );
                                    }}
                                  >
                                    <svg
                                      class={`w-3.5 h-3.5 text-gray-400 transition-transform ${systemPromptOpen() === log.id ? "rotate-90" : ""}`}
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      aria-hidden="true"
                                    >
                                      <title>展开</title>
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                      />
                                    </svg>
                                    <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                      System Prompt
                                    </span>
                                  </button>
                                  <Show when={systemPromptOpen() === log.id}>
                                    <pre class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                      {log.systemPrompt}
                                    </pre>
                                  </Show>
                                  <Show when={systemPromptOpen() !== log.id}>
                                    <p class="text-xs text-gray-400 truncate ml-5">
                                      {(log.systemPrompt ?? "").slice(0, 100)}...
                                    </p>
                                  </Show>
                                </div>
                              </Show>

                              {/* User Prompt section */}
                              <Show when={log.resolvedPrompt}>
                                <div>
                                  <button
                                    type="button"
                                    class="flex items-center gap-2 text-gray-700 mb-2 cursor-pointer hover:text-indigo-600 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setUserPromptOpen(
                                        userPromptOpen() === log.id ? null : log.id,
                                      );
                                    }}
                                  >
                                    <svg
                                      class={`w-3.5 h-3.5 text-gray-400 transition-transform ${userPromptOpen() === log.id ? "rotate-90" : ""}`}
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      aria-hidden="true"
                                    >
                                      <title>展开</title>
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                      />
                                    </svg>
                                    <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                      {log.systemPrompt ? "User Prompt" : "完整提示词"}
                                    </span>
                                  </button>
                                  <Show when={userPromptOpen() === log.id}>
                                    <pre class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                      {log.resolvedPrompt}
                                    </pre>
                                  </Show>
                                  <Show when={userPromptOpen() !== log.id}>
                                    <p class="text-xs text-gray-400 truncate ml-5">
                                      {(log.resolvedPrompt ?? "").slice(0, 100)}...
                                    </p>
                                  </Show>
                                </div>
                              </Show>

                              {/* Variable mapping */}
                              <Show
                                when={
                                  log.variableMapping && Object.keys(log.variableMapping).length > 0
                                }
                              >
                                <div>
                                  <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 ml-5">
                                    变量映射
                                  </h4>
                                  <div class="bg-gray-50 rounded-lg p-3 ml-5">
                                    <For each={Object.entries(log.variableMapping ?? {})}>
                                      {([key, value]) => (
                                        <div class="flex items-center gap-2 text-xs py-1">
                                          <code class="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{`{{${key}}}`}</code>
                                          <svg
                                            class="w-3 h-3 text-gray-300"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            aria-hidden="true"
                                          >
                                            <title>映射到</title>
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                                            />
                                          </svg>
                                          <span class="text-gray-600 truncate max-w-md">
                                            {value}
                                          </span>
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </div>
                              </Show>

                              {/* Error message */}
                              <Show when={log.errorMessage}>
                                <div class="ml-5">
                                  <h4 class="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">
                                    错误信息
                                  </h4>
                                  <div class="bg-red-50 rounded-lg p-3 text-xs text-red-600 leading-relaxed">
                                    {log.errorMessage}
                                  </div>
                                </div>
                              </Show>

                              {/* Parameters */}
                              <div class="flex flex-wrap gap-4 text-xs text-gray-500 ml-5 pt-2">
                                <Show when={log.temperature != null}>
                                  <span class="flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                    Temperature: {log.temperature}
                                  </span>
                                </Show>
                                <Show when={log.maxTokens != null}>
                                  <span class="flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                    Max Tokens: {log.maxTokens?.toLocaleString()}
                                  </span>
                                </Show>
                                <Show when={log.contentLength != null}>
                                  <span class="flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                    响应长度: {log.contentLength?.toLocaleString()} 字符
                                  </span>
                                </Show>
                                <Show when={log.tokenUsage?.total_tokens != null}>
                                  <span class="flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-300" />总 Token:{" "}
                                    {(log.tokenUsage?.total_tokens ?? 0).toLocaleString()}
                                  </span>
                                </Show>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </Show>
                    </>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div class="flex items-center justify-between px-4 py-3 bg-gray-50/50">
            <span class="text-sm text-gray-500">
              第 <span class="font-medium text-gray-700">{page()}</span> 页，共{" "}
              <span class="font-medium text-gray-700">{total()}</span> 条记录
            </span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                style="box-shadow: 0 1px 2px rgba(25,28,30,0.05)"
                disabled={page() <= 1}
                onClick={handlePrevPage}
              >
                上一页
              </button>
              <span class="text-xs text-gray-400 tabular-nums">
                {page()} / {totalPages()}
              </span>
              <button
                type="button"
                class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                style="box-shadow: 0 1px 2px rgba(25,28,30,0.05)"
                disabled={page() >= totalPages()}
                onClick={handleNextPage}
              >
                下一页
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

function StatCard(props: { label: string; value: string; accent?: string }) {
  return (
    <div class="bg-white rounded-xl px-4 py-3" style="box-shadow: 0 1px 3px rgba(25,28,30,0.04)">
      <p class="text-xs font-medium text-gray-500 mb-1">{props.label}</p>
      <p class={`text-xl font-bold tabular-nums tracking-tight ${props.accent ?? "text-gray-900"}`}>
        {props.value}
      </p>
    </div>
  );
}
