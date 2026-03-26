import { For, Show, createSignal, createResource } from "solid-js";
import {
  type StatisticsFilters,
  type AuditUserRow,
  type AuditDocumentRow,
  type DocumentDetailRow,
  fetchAuditByUser,
  fetchAuditByDocument,
  fetchDocumentDetail,
} from "../../../lib/api/statistics";

const fmt = new Intl.NumberFormat("zh-CN");
const costFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface AuditDetailsProps {
  filters: StatisticsFilters;
}

type SubTab = "by-user" | "by-document";

export default function AuditDetails(props: AuditDetailsProps) {
  const [subTab, setSubTab] = createSignal<SubTab>("by-user");

  return (
    <div class="space-y-4">
      {/* Sub-tab toggle */}
      <div class="inline-flex rounded-lg border border-gray-300 overflow-hidden">
        <button
          type="button"
          class={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            subTab() === "by-user"
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
          onClick={() => setSubTab("by-user")}
        >
          按用户
        </button>
        <button
          type="button"
          class={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            subTab() === "by-document"
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
          onClick={() => setSubTab("by-document")}
        >
          按文档
        </button>
      </div>

      {subTab() === "by-user" && <ByUserView filters={props.filters} />}
      {subTab() === "by-document" && <ByDocumentView filters={props.filters} />}
    </div>
  );
}

/* ─── By User View ───────────────────────────────────────────────────────── */

function ByUserView(props: { filters: StatisticsFilters }) {
  const [page, setPage] = createSignal(1);
  const pageSize = 20;
  const [expandedUser, setExpandedUser] = createSignal<string | null>(null);

  const key = () => `${JSON.stringify(props.filters)}|${page()}`;
  const [data] = createResource(key, () => fetchAuditByUser(props.filters, page(), pageSize));

  // Fetch documents for expanded user (simple inline resource)
  const [expandedDocs, setExpandedDocs] = createSignal<AuditDocumentRow[]>([]);
  const [expandedLoading, setExpandedLoading] = createSignal(false);

  async function toggleUserExpand(userId: string) {
    if (expandedUser() === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    setExpandedLoading(true);
    try {
      // Fetch by-document filtered for the whole filter set — user's records appear in document view
      const result = await fetchAuditByDocument(props.filters, 1, 10);
      setExpandedDocs(result.data);
    } catch {
      setExpandedDocs([]);
    } finally {
      setExpandedLoading(false);
    }
  }

  const totalPages = () => Math.ceil((data()?.total ?? 0) / pageSize);

  return (
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100">
        <h3 class="text-sm font-semibold text-gray-700">按用户审计</h3>
      </div>
      <Show
        when={!data.loading && (data()?.data?.length ?? 0) > 0}
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
                <th class="px-6 py-3 w-8" />
                <th class="px-6 py-3">用户</th>
                <th class="px-6 py-3 text-right">调用次数</th>
                <th class="px-6 py-3 text-right">文档数</th>
                <th class="px-6 py-3 text-right">Token 消耗</th>
                <th class="px-6 py-3 text-right">估算成本</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <For each={data()?.data ?? []}>
                {(row: AuditUserRow) => (
                  <>
                    <tr
                      class="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleUserExpand(row.userId)}
                    >
                      <td class="px-6 py-3 text-gray-400">
                        <svg
                          class={`w-4 h-4 transition-transform ${expandedUser() === row.userId ? "rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td class="px-6 py-3 font-medium text-gray-900">{row.userName}</td>
                      <td class="px-6 py-3 text-right text-gray-700">{fmt.format(row.callCount)}</td>
                      <td class="px-6 py-3 text-right text-gray-700">{fmt.format(row.docCount)}</td>
                      <td class="px-6 py-3 text-right text-gray-700">{fmt.format(row.totalTokens)}</td>
                      <td class="px-6 py-3 text-right text-gray-700">{costFmt.format(row.estimatedCost)}</td>
                    </tr>
                    <Show when={expandedUser() === row.userId}>
                      <tr>
                        <td colspan="6" class="px-6 py-3 bg-gray-50">
                          <Show when={!expandedLoading()} fallback={<div class="text-xs text-gray-400 py-2">加载中...</div>}>
                            <Show when={expandedDocs().length > 0} fallback={<div class="text-xs text-gray-400 py-2">暂无记录</div>}>
                              <div class="text-xs font-medium text-gray-500 mb-2">最近文档生成记录</div>
                              <table class="w-full text-xs">
                                <thead>
                                  <tr class="text-left text-gray-400">
                                    <th class="pb-1">文档</th>
                                    <th class="pb-1">流程</th>
                                    <th class="pb-1 text-right">调用次数</th>
                                    <th class="pb-1 text-right">Token</th>
                                    <th class="pb-1 text-right">成本</th>
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200">
                                  <For each={expandedDocs()}>
                                    {(doc) => (
                                      <tr>
                                        <td class="py-1 text-gray-700">{doc.documentName ?? "-"}</td>
                                        <td class="py-1 text-gray-600">{doc.workflowName ?? "-"}</td>
                                        <td class="py-1 text-right text-gray-700">{fmt.format(doc.totalCalls)}</td>
                                        <td class="py-1 text-right text-gray-700">{fmt.format(doc.totalTokens)}</td>
                                        <td class="py-1 text-right text-gray-700">{costFmt.format(doc.estimatedCost)}</td>
                                      </tr>
                                    )}
                                  </For>
                                </tbody>
                              </table>
                            </Show>
                          </Show>
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
        <Pagination page={page()} totalPages={totalPages()} onPageChange={setPage} />
      </Show>
    </div>
  );
}

/* ─── By Document View ───────────────────────────────────────────────────── */

function ByDocumentView(props: { filters: StatisticsFilters }) {
  const [page, setPage] = createSignal(1);
  const pageSize = 20;
  const [expandedDoc, setExpandedDoc] = createSignal<string | null>(null);
  const [expandedDetail, setExpandedDetail] = createSignal<DocumentDetailRow[]>([]);
  const [expandedLoading, setExpandedLoading] = createSignal(false);

  const key = () => `${JSON.stringify(props.filters)}|${page()}`;
  const [data] = createResource(key, () => fetchAuditByDocument(props.filters, page(), pageSize));

  async function toggleDocExpand(documentId: string) {
    if (expandedDoc() === documentId) {
      setExpandedDoc(null);
      return;
    }
    setExpandedDoc(documentId);
    setExpandedLoading(true);
    try {
      const detail = await fetchDocumentDetail(documentId);
      setExpandedDetail(detail);
    } catch {
      setExpandedDetail([]);
    } finally {
      setExpandedLoading(false);
    }
  }

  const totalPages = () => Math.ceil((data()?.total ?? 0) / pageSize);

  const formatDuration = (ms: number | null) => {
    if (ms == null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const tokenBreakdown = (usage: DocumentDetailRow["tokenUsage"]) => {
    if (!usage) return "-";
    const input = usage.prompt_tokens ?? 0;
    const output = usage.completion_tokens ?? 0;
    const total = usage.total_tokens ?? input + output;
    return `${fmt.format(input)} / ${fmt.format(output)} / ${fmt.format(total)}`;
  };

  const statusBadge = (status: string) => {
    const isSuccess = status === "success" || status === "completed";
    return (
      <span
        class={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
          isSuccess ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100">
        <h3 class="text-sm font-semibold text-gray-700">按文档审计</h3>
      </div>
      <Show
        when={!data.loading && (data()?.data?.length ?? 0) > 0}
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
                <th class="px-6 py-3 w-8" />
                <th class="px-6 py-3">时间</th>
                <th class="px-6 py-3">文档名称</th>
                <th class="px-6 py-3">用户</th>
                <th class="px-6 py-3">流程</th>
                <th class="px-6 py-3 text-right">调用次数</th>
                <th class="px-6 py-3 text-right">Token 数</th>
                <th class="px-6 py-3 text-right">耗时</th>
                <th class="px-6 py-3 text-right">成本</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <For each={data()?.data ?? []}>
                {(row: AuditDocumentRow) => (
                  <>
                    <tr
                      class="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleDocExpand(row.documentId)}
                    >
                      <td class="px-6 py-3 text-gray-400">
                        <svg
                          class={`w-4 h-4 transition-transform ${expandedDoc() === row.documentId ? "rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td class="px-6 py-3 text-gray-500 whitespace-nowrap">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString("zh-CN") : "-"}
                      </td>
                      <td class="px-6 py-3 font-medium text-gray-900">{row.documentName ?? "-"}</td>
                      <td class="px-6 py-3 text-gray-700">{row.userName ?? "-"}</td>
                      <td class="px-6 py-3 text-gray-600">{row.workflowName ?? "-"}</td>
                      <td class="px-6 py-3 text-right text-gray-700">{fmt.format(row.totalCalls)}</td>
                      <td class="px-6 py-3 text-right text-gray-700">{fmt.format(row.totalTokens)}</td>
                      <td class="px-6 py-3 text-right text-gray-700">{formatDuration(row.totalDuration)}</td>
                      <td class="px-6 py-3 text-right text-gray-700">{costFmt.format(row.estimatedCost)}</td>
                    </tr>
                    <Show when={expandedDoc() === row.documentId}>
                      <tr>
                        <td colspan="9" class="px-6 py-3 bg-gray-50">
                          <Show when={!expandedLoading()} fallback={<div class="text-xs text-gray-400 py-2">加载中...</div>}>
                            <Show when={expandedDetail().length > 0} fallback={<div class="text-xs text-gray-400 py-2">暂无明细</div>}>
                              <div class="text-xs font-medium text-gray-500 mb-2">节点/模型调用明细</div>
                              <table class="w-full text-xs">
                                <thead>
                                  <tr class="text-left text-gray-400">
                                    <th class="pb-1">节点名称</th>
                                    <th class="pb-1">模型</th>
                                    <th class="pb-1 text-right">Token (输入/输出/总计)</th>
                                    <th class="pb-1 text-right">耗时</th>
                                    <th class="pb-1 text-right">成本</th>
                                    <th class="pb-1 text-right">状态</th>
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200">
                                  <For each={expandedDetail()}>
                                    {(detail) => (
                                      <tr>
                                        <td class="py-1 text-gray-700">{detail.nodeLabel ?? "-"}</td>
                                        <td class="py-1 text-gray-600">{detail.modelName ?? "-"}</td>
                                        <td class="py-1 text-right text-gray-700">{tokenBreakdown(detail.tokenUsage)}</td>
                                        <td class="py-1 text-right text-gray-700">{formatDuration(detail.duration)}</td>
                                        <td class="py-1 text-right text-gray-700">{costFmt.format(Number(detail.estimatedCost) || 0)}</td>
                                        <td class="py-1 text-right">{statusBadge(detail.responseStatus)}</td>
                                      </tr>
                                    )}
                                  </For>
                                </tbody>
                              </table>
                            </Show>
                          </Show>
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
        <Pagination page={page()} totalPages={totalPages()} onPageChange={setPage} />
      </Show>
    </div>
  );
}

/* ─── Shared Components ──────────────────────────────────────────────────── */

function Pagination(props: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  return (
    <Show when={props.totalPages > 1}>
      <div class="flex items-center justify-between px-6 py-3 border-t border-gray-100">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          disabled={props.page <= 1}
          onClick={() => props.onPageChange(props.page - 1)}
        >
          上一页
        </button>
        <span class="text-xs text-gray-500">
          第 {props.page} / {props.totalPages} 页
        </span>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          disabled={props.page >= props.totalPages}
          onClick={() => props.onPageChange(props.page + 1)}
        >
          下一页
        </button>
      </div>
    </Show>
  );
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
