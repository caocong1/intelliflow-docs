export interface StatisticsFilters {
  dateFrom: string;
  dateTo: string;
  granularity: "day" | "week" | "month";
  projectId?: string;
  documentTypeId?: string;
  workflowId?: string;
  department?: string;
}

export interface OverviewData {
  totalCalls: number;
  totalTokens: number;
  activeUsers: number;
  documentCount: number;
  estimatedCost: number;
  todayCalls: number;
  avgDuration: number;
  successRate: number;
}

function buildQuery(filters: StatisticsFilters): string {
  const params = new URLSearchParams();
  params.set("dateFrom", filters.dateFrom);
  params.set("dateTo", filters.dateTo);
  params.set("granularity", filters.granularity);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.documentTypeId) params.set("documentTypeId", filters.documentTypeId);
  if (filters.workflowId) params.set("workflowId", filters.workflowId);
  if (filters.department) params.set("department", filters.department);
  return params.toString();
}

async function apiFetch<T>(path: string, filters: StatisticsFilters): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`/api/admin/statistics/${path}?${buildQuery(filters)}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Statistics API error: ${res.status}`);
  return res.json();
}

export function fetchOverview(filters: StatisticsFilters): Promise<OverviewData> {
  return apiFetch<OverviewData>("overview", filters);
}

export function fetchTrends(filters: StatisticsFilters) {
  return apiFetch<{ period: string; callCount: number; totalTokens: number }[]>("trends", filters);
}

export function fetchByModel(filters: StatisticsFilters) {
  return apiFetch<{ modelId: string; modelName: string; callCount: number; totalTokens: number; successRate: number; estimatedCost: number }[]>("by-model", filters);
}

export function fetchByUser(filters: StatisticsFilters) {
  return apiFetch<{ userId: string; displayName: string; callCount: number; documentCount: number; totalTokens: number; estimatedCost: number }[]>("by-user", filters);
}

export function fetchByWorkflow(filters: StatisticsFilters) {
  return apiFetch<{ workflowId: string; workflowName: string; usageCount: number; userCount: number; documentCount: number }[]>("by-workflow", filters);
}

export function fetchAuditByUser(filters: StatisticsFilters) {
  return apiFetch<{ userId: string; displayName: string; records: unknown[] }[]>("audit/by-user", filters);
}

export function fetchAuditByDocument(filters: StatisticsFilters) {
  return apiFetch<{ documentId: string; documentTitle: string; records: unknown[] }[]>("audit/by-document", filters);
}
