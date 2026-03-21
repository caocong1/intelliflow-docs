import { createSignal, For, onMount, Show } from "solid-js";

interface ModelCallLogEntry {
  id: string;
  documentId: string;
  documentTitle: string | null;
  nodeExecutionId: string;
  modelId: string | null;
  modelName: string | null;
  promptTemplate: string | null;
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

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(usage: ModelCallLogEntry["tokenUsage"]): string {
  if (!usage) return "-";
  const parts: string[] = [];
  if (usage.prompt_tokens != null) parts.push(`输入: ${usage.prompt_tokens}`);
  if (usage.completion_tokens != null) parts.push(`输出: ${usage.completion_tokens}`);
  if (usage.total_tokens != null) parts.push(`总计: ${usage.total_tokens}`);
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
  const limit = 20;

  // Filters
  const [search, setSearch] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal<string>("");
  const [dateFrom, setDateFrom] = createSignal("");
  const [dateTo, setDateTo] = createSignal("");

  async function fetchLogs() {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams();
      params.set("page", String(page()));
      params.set("limit", String(limit));
      if (search()) params.set("search", search());
      if (statusFilter()) params.set("status", statusFilter());
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
      {/* Header */}
      <div>
        <h1 class="text-xl font-bold text-gray-900">模型调用日志</h1>
        <p class="mt-1 text-sm text-gray-500">查看和分析 AI 模型的调用记录</p>
      </div>

      {/* Filter bar */}
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              搜索文档
              <input
                type="text"
                placeholder="输入文档名称..."
                class="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
              />
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              状态
              <select
                class="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                value={statusFilter()}
                onChange={(e) => setStatusFilter(e.currentTarget.value)}
              >
                <option value="">全部</option>
                <option value="completed">成功</option>
                <option value="failed">失败</option>
              </select>
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              开始日期
              <input
                type="date"
                class="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={dateFrom()}
                onInput={(e) => setDateFrom(e.currentTarget.value)}
              />
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              结束日期
              <input
                type="date"
                class="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={dateTo()}
                onInput={(e) => setDateTo(e.currentTarget.value)}
              />
            </label>
          </div>
          <div class="flex items-end">
            <button
              type="button"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
              onClick={handleFilter}
            >
              筛选
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <Show when={loading()}>
          <div class="p-8 text-center">
            <div class="text-sm text-gray-400">加载中...</div>
          </div>
        </Show>

        <Show when={!loading() && logs().length === 0}>
          <div class="p-8 text-center">
            <div class="text-sm text-gray-400">暂无调用记录</div>
          </div>
        </Show>

        <Show when={!loading() && logs().length > 0}>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 bg-gray-50">
                  <th class="text-left px-4 py-3 font-medium text-gray-600">时间</th>
                  <th class="text-left px-4 py-3 font-medium text-gray-600">文档</th>
                  <th class="text-left px-4 py-3 font-medium text-gray-600">模型</th>
                  <th class="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                  <th class="text-left px-4 py-3 font-medium text-gray-600">耗时</th>
                  <th class="text-left px-4 py-3 font-medium text-gray-600">Token 用量</th>
                </tr>
              </thead>
              <tbody>
                <For each={logs()}>
                  {(log) => (
                    <>
                      <tr
                        class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() =>
                          setExpandedId(expandedId() === log.id ? null : log.id)
                        }
                      >
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </td>
                        <td class="px-4 py-3 text-gray-700 max-w-[200px] truncate">
                          {log.documentTitle ?? "-"}
                        </td>
                        <td class="px-4 py-3 text-gray-700">
                          {log.modelName ?? "-"}
                        </td>
                        <td class="px-4 py-3">
                          <span
                            class={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              log.responseStatus === "completed"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {log.responseStatus === "completed" ? "成功" : "失败"}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatDuration(log.duration)}
                        </td>
                        <td class="px-4 py-3 text-gray-500 text-xs">
                          {formatTokens(log.tokenUsage)}
                        </td>
                      </tr>

                      {/* Expanded details row */}
                      <Show when={expandedId() === log.id}>
                        <tr class="bg-gray-50 border-b border-gray-200">
                          <td colSpan={6} class="px-4 py-4">
                            <div class="space-y-4 text-sm">
                              {/* Resolved prompt */}
                              <Show when={log.resolvedPrompt}>
                                <div>
                                  <h4 class="font-medium text-gray-700 mb-1">完整提示词</h4>
                                  <pre class="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                    {log.resolvedPrompt}
                                  </pre>
                                </div>
                              </Show>

                              {/* Variable mapping */}
                              <Show when={log.variableMapping && Object.keys(log.variableMapping).length > 0}>
                                <div>
                                  <h4 class="font-medium text-gray-700 mb-1">变量映射</h4>
                                  <div class="bg-white border border-gray-200 rounded-lg p-3">
                                    <For each={Object.entries(log.variableMapping ?? {})}>
                                      {([key, value]) => (
                                        <div class="flex gap-2 text-xs py-0.5">
                                          <span class="font-mono text-indigo-600">{`{{${key}}}`}</span>
                                          <span class="text-gray-400">-&gt;</span>
                                          <span class="text-gray-600 truncate max-w-md">{value}</span>
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </div>
                              </Show>

                              {/* Error message */}
                              <Show when={log.errorMessage}>
                                <div>
                                  <h4 class="font-medium text-red-700 mb-1">错误信息</h4>
                                  <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
                                    {log.errorMessage}
                                  </div>
                                </div>
                              </Show>

                              {/* Parameters */}
                              <div class="flex gap-6 text-xs text-gray-500">
                                <Show when={log.temperature != null}>
                                  <span>Temperature: {log.temperature}</span>
                                </Show>
                                <Show when={log.maxTokens != null}>
                                  <span>Max Tokens: {log.maxTokens}</span>
                                </Show>
                                <Show when={log.contentLength != null}>
                                  <span>响应长度: {log.contentLength} 字符</span>
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
          <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span class="text-sm text-gray-500">
              第 {page()} 页，共 {total()} 条记录
            </span>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                disabled={page() <= 1}
                onClick={handlePrevPage}
              >
                上一页
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
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
