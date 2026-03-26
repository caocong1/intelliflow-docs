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
  docCount: number;
  estimatedCost: number;
  todayCalls: number;
  avgDuration: number;
  avgSuccessRate: number;
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
  return apiFetch<{ userId: string; userName: string; callCount: number; docCount: number; totalTokens: number; estimatedCost: number }[]>("by-user", filters);
}

export function fetchByWorkflow(filters: StatisticsFilters) {
  return apiFetch<{ workflowId: string; workflowName: string; callCount: number; userCount: number; docCount: number }[]>("by-workflow", filters);
}

export interface AuditUserRow {
  userId: string;
  userName: string;
  callCount: number;
  docCount: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditDocumentRow {
  documentId: string;
  documentName: string;
  userName: string;
  workflowName: string;
  totalCalls: number;
  totalTokens: number;
  totalDuration: number;
  estimatedCost: number;
  createdAt: string;
}

export interface DocumentDetailRow {
  id: string;
  nodeExecutionId: string;
  nodeLabel: string;
  modelName: string;
  tokenUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  duration: number | null;
  responseStatus: string;
  budgetUsedUsd: number | null;
  estimatedCost: string;
  createdAt: string;
}

export function fetchAuditByUser(filters: StatisticsFilters, page = 1, pageSize = 20): Promise<PaginatedResponse<AuditUserRow>> {
  const token = localStorage.getItem("auth_token");
  const query = buildQuery(filters);
  return fetch(`/api/admin/statistics/audit/by-user?${query}&page=${page}&pageSize=${pageSize}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).then((res) => {
    if (!res.ok) throw new Error(`Statistics API error: ${res.status}`);
    return res.json();
  });
}

export function fetchAuditByDocument(filters: StatisticsFilters, page = 1, pageSize = 20): Promise<PaginatedResponse<AuditDocumentRow>> {
  const token = localStorage.getItem("auth_token");
  const query = buildQuery(filters);
  return fetch(`/api/admin/statistics/audit/by-document?${query}&page=${page}&pageSize=${pageSize}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).then((res) => {
    if (!res.ok) throw new Error(`Statistics API error: ${res.status}`);
    return res.json();
  });
}

export function fetchDocumentDetail(documentId: string): Promise<DocumentDetailRow[]> {
  const token = localStorage.getItem("auth_token");
  return fetch(`/api/admin/statistics/audit/document-detail/${documentId}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).then((res) => {
    if (!res.ok) throw new Error(`Statistics API error: ${res.status}`);
    return res.json();
  });
}
