import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import {
  getOverviewKpis,
  getTrends,
  getByModel,
  getModelTrends,
  getByUser,
  getUserTrends,
  getByWorkflow,
  getWorkflowTrends,
  getAuditByUser,
  getAuditByDocument,
  getDocumentDetail,
  type StatisticsFilters,
} from "./statistics.service";

const sharedQuery = {
  dateFrom: t.Optional(t.String()),
  dateTo: t.Optional(t.String()),
  granularity: t.Optional(t.Union([t.Literal("day"), t.Literal("week"), t.Literal("month")])),
  projectId: t.Optional(t.String()),
  documentTypeId: t.Optional(t.String()),
  workflowId: t.Optional(t.String()),
  department: t.Optional(t.String()),
};

const paginatedQuery = {
  ...sharedQuery,
  page: t.Optional(t.String()),
  pageSize: t.Optional(t.String()),
};

function extractFilters(query: Record<string, string | undefined>): StatisticsFilters {
  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    projectId: query.projectId,
    documentTypeId: query.documentTypeId,
    workflowId: query.workflowId,
    department: query.department,
  };
}

export const statisticsRoutes = new Elysia({ prefix: "/admin/statistics" })
  .use(requireAdmin)

  // ─── Overview KPIs ──────────────────────────────────────────────────────
  .get(
    "/overview",
    async ({ query }) => {
      const filters = extractFilters(query);
      return getOverviewKpis(filters);
    },
    { query: t.Object(sharedQuery) },
  )

  // ─── Trends ─────────────────────────────────────────────────────────────
  .get(
    "/trends",
    async ({ query }) => {
      const filters = extractFilters(query);
      const granularity = query.granularity ?? "day";
      return getTrends(filters, granularity);
    },
    { query: t.Object(sharedQuery) },
  )

  // ─── By Model (aggregation + trends) ───────────────────────────────────
  .get(
    "/by-model",
    async ({ query }) => {
      const filters = extractFilters(query);
      const granularity = query.granularity ?? "day";
      const [aggregation, trends] = await Promise.all([
        getByModel(filters),
        getModelTrends(filters, granularity),
      ]);
      return { aggregation, trends };
    },
    { query: t.Object(sharedQuery) },
  )

  // ─── By User (aggregation + trends) ────────────────────────────────────
  .get(
    "/by-user",
    async ({ query }) => {
      const filters = extractFilters(query);
      const granularity = query.granularity ?? "day";
      const [aggregation, trends] = await Promise.all([
        getByUser(filters),
        getUserTrends(filters, granularity),
      ]);
      return { aggregation, trends };
    },
    { query: t.Object(sharedQuery) },
  )

  // ─── By Workflow (aggregation + trends) ────────────────────────────────
  .get(
    "/by-workflow",
    async ({ query }) => {
      const filters = extractFilters(query);
      const granularity = query.granularity ?? "day";
      const [aggregation, trends] = await Promise.all([
        getByWorkflow(filters),
        getWorkflowTrends(filters, granularity),
      ]);
      return { aggregation, trends };
    },
    { query: t.Object(sharedQuery) },
  )

  // ─── Audit: By User (paginated) ───────────────────────────────────────
  .get(
    "/audit/by-user",
    async ({ query }) => {
      const filters = extractFilters(query);
      const page = Number(query.page) || 1;
      const pageSize = Math.min(Number(query.pageSize) || 20, 100);
      return getAuditByUser(filters, page, pageSize);
    },
    { query: t.Object(paginatedQuery) },
  )

  // ─── Audit: By Document (paginated) ───────────────────────────────────
  .get(
    "/audit/by-document",
    async ({ query }) => {
      const filters = extractFilters(query);
      const page = Number(query.page) || 1;
      const pageSize = Math.min(Number(query.pageSize) || 20, 100);
      return getAuditByDocument(filters, page, pageSize);
    },
    { query: t.Object(paginatedQuery) },
  )

  // ─── Audit: Document Detail (row expansion) ──────────────────────────
  .get(
    "/audit/document-detail/:documentId",
    async ({ params }) => {
      return getDocumentDetail(params.documentId);
    },
    { params: t.Object({ documentId: t.String() }) },
  );
