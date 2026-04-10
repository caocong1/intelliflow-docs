import { and, avg, count, countDistinct, desc, eq, gte, lte, sql, sum } from "drizzle-orm";
import { db } from "../../db";
import {
  documents,
  modelCallLogs,
  models,
  nodeExecutions,
  projects,
  users,
  workflows,
} from "../../db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StatisticsFilters {
  dateFrom?: string;
  dateTo?: string;
  projectId?: string;
  documentTypeId?: string;
  workflowId?: string;
  department?: string;
}

type Granularity = "day" | "week" | "month";

// ─── Helper: Build filter conditions ────────────────────────────────────────

function buildFilterConditions(filters: StatisticsFilters) {
  const conditions = [];

  if (filters.dateFrom) {
    conditions.push(gte(modelCallLogs.createdAt, new Date(filters.dateFrom)));
  }
  if (filters.dateTo) {
    conditions.push(lte(modelCallLogs.createdAt, new Date(filters.dateTo)));
  }
  if (filters.projectId) {
    conditions.push(eq(documents.projectId, filters.projectId));
  }
  if (filters.documentTypeId) {
    conditions.push(eq(workflows.documentTypeId, filters.documentTypeId));
  }
  if (filters.workflowId) {
    conditions.push(eq(documents.workflowId, filters.workflowId));
  }
  if (filters.department) {
    conditions.push(eq(projects.department, filters.department));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Whether filters require joining documents/workflows/projects tables.
 */
function needsDocumentJoin(filters: StatisticsFilters): boolean {
  return !!(
    filters.projectId ||
    filters.documentTypeId ||
    filters.workflowId ||
    filters.department
  );
}

// ─── Cost estimation SQL fragment ───────────────────────────────────────────

const costExpression = sql<string>`
  SUM(
    COALESCE(${modelCallLogs.budgetUsedUsd}::numeric, 0) +
    COALESCE(
      (${modelCallLogs.tokenUsage}->>'prompt_tokens')::numeric / 1000000 * ${models.inputPricePerMTok}::numeric,
      0
    ) +
    COALESCE(
      (${modelCallLogs.tokenUsage}->>'completion_tokens')::numeric / 1000000 * ${models.outputPricePerMTok}::numeric,
      0
    )
  )
`;

const totalTokensExpression = sql<string>`
  COALESCE(SUM((${modelCallLogs.tokenUsage}->>'total_tokens')::int), 0)
`;

// ─── Base query builder with optional joins ─────────────────────────────────

function baseQuery(filters: StatisticsFilters) {
  let query = db
    .select()
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id));

  if (needsDocumentJoin(filters)) {
    query = query
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  return query;
}

// ─── Overview KPIs ──────────────────────────────────────────────────────────

export async function getOverviewKpis(filters: StatisticsFilters) {
  const whereClause = buildFilterConditions(filters);
  const joinsDocs = needsDocumentJoin(filters);

  // Main aggregation query
  let mainQuery = db
    .select({
      totalCalls: count(modelCallLogs.id),
      totalTokens: totalTokensExpression,
      activeUsers: countDistinct(modelCallLogs.userId),
      docCount: countDistinct(modelCallLogs.documentId),
      estimatedCost: costExpression,
      avgDuration: avg(modelCallLogs.duration),
      avgSuccessRate: sql<string>`
        CASE WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(COUNT(*) FILTER (WHERE ${modelCallLogs.responseStatus} = 'completed') * 100.0 / COUNT(*), 2)
        END
      `,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id));

  if (joinsDocs) {
    mainQuery = mainQuery
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  const [main] = await mainQuery.where(whereClause);

  // Today's calls (always filter by today start)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayConditions = [gte(modelCallLogs.createdAt, todayStart)];
  if (whereClause) {
    todayConditions.push(whereClause);
  }

  let todayQuery = db.select({ todayCalls: count(modelCallLogs.id) }).from(modelCallLogs);

  if (joinsDocs) {
    // @ts-expect-error - drizzle chaining with conditional joins
    todayQuery = todayQuery
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  const [today] = await todayQuery.where(and(...todayConditions));

  return {
    totalCalls: main?.totalCalls ?? 0,
    totalTokens: Number(main?.totalTokens ?? 0),
    activeUsers: main?.activeUsers ?? 0,
    docCount: main?.docCount ?? 0,
    estimatedCost: Number(Number(main?.estimatedCost ?? 0).toFixed(4)),
    todayCalls: today?.todayCalls ?? 0,
    avgDuration: main?.avgDuration ? Math.round(Number(main.avgDuration)) : 0,
    avgSuccessRate: Number(main?.avgSuccessRate ?? 0),
  };
}

// ─── Trends ─────────────────────────────────────────────────────────────────

export async function getTrends(filters: StatisticsFilters, granularity: Granularity = "day") {
  const whereClause = buildFilterConditions(filters);
  const joinsDocs = needsDocumentJoin(filters);

  const period = sql`date_trunc(${granularity}, ${modelCallLogs.createdAt})`;

  let query = db
    .select({
      period: period.as("period"),
      callCount: count(modelCallLogs.id),
      totalTokens: totalTokensExpression,
      estimatedCost: costExpression,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id));

  if (joinsDocs) {
    query = query
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  return query.where(whereClause).groupBy(sql`period`).orderBy(sql`period`);
}

// ─── By Model ───────────────────────────────────────────────────────────────

export async function getByModel(filters: StatisticsFilters) {
  const whereClause = buildFilterConditions(filters);
  const joinsDocs = needsDocumentJoin(filters);

  let query = db
    .select({
      modelId: modelCallLogs.modelId,
      modelName: modelCallLogs.modelName,
      callCount: count(modelCallLogs.id),
      totalTokens: totalTokensExpression,
      successRate: sql<string>`
        CASE WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(COUNT(*) FILTER (WHERE ${modelCallLogs.responseStatus} = 'completed') * 100.0 / COUNT(*), 2)
        END
      `,
      estimatedCost: costExpression,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id));

  if (joinsDocs) {
    query = query
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  return query
    .where(whereClause)
    .groupBy(modelCallLogs.modelId, modelCallLogs.modelName)
    .orderBy(sql`count(${modelCallLogs.id}) DESC`);
}

export async function getModelTrends(filters: StatisticsFilters, granularity: Granularity = "day") {
  const whereClause = buildFilterConditions(filters);
  const joinsDocs = needsDocumentJoin(filters);
  const period = sql`date_trunc(${granularity}, ${modelCallLogs.createdAt})`;

  let query = db
    .select({
      period: period.as("period"),
      modelId: modelCallLogs.modelId,
      modelName: modelCallLogs.modelName,
      callCount: count(modelCallLogs.id),
      totalTokens: totalTokensExpression,
      estimatedCost: costExpression,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id));

  if (joinsDocs) {
    query = query
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  return query
    .where(whereClause)
    .groupBy(sql`period`, modelCallLogs.modelId, modelCallLogs.modelName)
    .orderBy(sql`period`);
}

// ─── By User ────────────────────────────────────────────────────────────────

export async function getByUser(filters: StatisticsFilters) {
  const whereClause = buildFilterConditions(filters);
  const joinsDocs = needsDocumentJoin(filters);

  let query = db
    .select({
      userId: modelCallLogs.userId,
      userName: users.displayName,
      callCount: count(modelCallLogs.id),
      docCount: countDistinct(modelCallLogs.documentId),
      totalTokens: totalTokensExpression,
      estimatedCost: costExpression,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id))
    .leftJoin(users, eq(modelCallLogs.userId, users.id));

  if (joinsDocs) {
    query = query
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  return query
    .where(whereClause)
    .groupBy(modelCallLogs.userId, users.displayName)
    .orderBy(sql`count(${modelCallLogs.id}) DESC`);
}

export async function getUserTrends(filters: StatisticsFilters, granularity: Granularity = "day") {
  const whereClause = buildFilterConditions(filters);
  const joinsDocs = needsDocumentJoin(filters);
  const period = sql`date_trunc(${granularity}, ${modelCallLogs.createdAt})`;

  let query = db
    .select({
      period: period.as("period"),
      userId: modelCallLogs.userId,
      userName: users.displayName,
      callCount: count(modelCallLogs.id),
      totalTokens: totalTokensExpression,
      estimatedCost: costExpression,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id))
    .leftJoin(users, eq(modelCallLogs.userId, users.id));

  if (joinsDocs) {
    query = query
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  return query
    .where(whereClause)
    .groupBy(sql`period`, modelCallLogs.userId, users.displayName)
    .orderBy(sql`period`);
}

// ─── By Workflow ────────────────────────────────────────────────────────────

export async function getByWorkflow(filters: StatisticsFilters) {
  const whereClause = buildFilterConditions(filters);

  // Always need document + workflow joins for this dimension
  const conditions = [];
  if (filters.dateFrom) conditions.push(gte(modelCallLogs.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(modelCallLogs.createdAt, new Date(filters.dateTo)));
  if (filters.projectId) conditions.push(eq(documents.projectId, filters.projectId));
  if (filters.documentTypeId) conditions.push(eq(workflows.documentTypeId, filters.documentTypeId));
  if (filters.workflowId) conditions.push(eq(documents.workflowId, filters.workflowId));
  if (filters.department) conditions.push(eq(projects.department, filters.department));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      workflowId: documents.workflowId,
      workflowName: workflows.name,
      callCount: count(modelCallLogs.id),
      userCount: countDistinct(modelCallLogs.userId),
      docCount: countDistinct(modelCallLogs.documentId),
      estimatedCost: costExpression,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id))
    .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
    .leftJoin(workflows, eq(documents.workflowId, workflows.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(where)
    .groupBy(documents.workflowId, workflows.name)
    .orderBy(sql`count(${modelCallLogs.id}) DESC`);
}

export async function getWorkflowTrends(
  filters: StatisticsFilters,
  granularity: Granularity = "day",
) {
  const whereClause = buildFilterConditions(filters);
  const period = sql`date_trunc(${granularity}, ${modelCallLogs.createdAt})`;

  // Always needs document + workflow joins
  const conditions = [];
  if (filters.dateFrom) conditions.push(gte(modelCallLogs.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(modelCallLogs.createdAt, new Date(filters.dateTo)));
  if (filters.projectId) conditions.push(eq(documents.projectId, filters.projectId));
  if (filters.documentTypeId) conditions.push(eq(workflows.documentTypeId, filters.documentTypeId));
  if (filters.workflowId) conditions.push(eq(documents.workflowId, filters.workflowId));
  if (filters.department) conditions.push(eq(projects.department, filters.department));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      period: period.as("period"),
      workflowId: documents.workflowId,
      workflowName: workflows.name,
      callCount: count(modelCallLogs.id),
      totalTokens: totalTokensExpression,
      estimatedCost: costExpression,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id))
    .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
    .leftJoin(workflows, eq(documents.workflowId, workflows.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(where)
    .groupBy(sql`period`, documents.workflowId, workflows.name)
    .orderBy(sql`period`);
}

// ─── Audit: By User (paginated) ────────────────────────────────────────────

export async function getAuditByUser(filters: StatisticsFilters, page = 1, pageSize = 20) {
  const whereClause = buildFilterConditions(filters);
  const joinsDocs = needsDocumentJoin(filters);
  const offset = (page - 1) * pageSize;

  // Count total distinct users
  let countQuery = db.select({ total: countDistinct(modelCallLogs.userId) }).from(modelCallLogs);

  if (joinsDocs) {
    // @ts-expect-error - drizzle chaining with conditional joins
    countQuery = countQuery
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  const [countResult] = await countQuery.where(whereClause);

  // Data query
  let query = db
    .select({
      userId: modelCallLogs.userId,
      userName: users.displayName,
      callCount: count(modelCallLogs.id),
      docCount: countDistinct(modelCallLogs.documentId),
      totalTokens: totalTokensExpression,
      estimatedCost: costExpression,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id))
    .leftJoin(users, eq(modelCallLogs.userId, users.id));

  if (joinsDocs) {
    query = query
      .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
      .leftJoin(workflows, eq(documents.workflowId, workflows.id))
      .leftJoin(projects, eq(documents.projectId, projects.id));
  }

  const data = await query
    .where(whereClause)
    .groupBy(modelCallLogs.userId, users.displayName)
    .orderBy(sql`count(${modelCallLogs.id}) DESC`)
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    total: countResult?.total ?? 0,
    page,
    pageSize,
  };
}

// ─── Audit: By Document (paginated) ────────────────────────────────────────

export async function getAuditByDocument(filters: StatisticsFilters, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  // Build conditions inline since we always need doc joins
  const conditions = [];
  if (filters.dateFrom) conditions.push(gte(modelCallLogs.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(modelCallLogs.createdAt, new Date(filters.dateTo)));
  if (filters.projectId) conditions.push(eq(documents.projectId, filters.projectId));
  if (filters.documentTypeId) conditions.push(eq(workflows.documentTypeId, filters.documentTypeId));
  if (filters.workflowId) conditions.push(eq(documents.workflowId, filters.workflowId));
  if (filters.department) conditions.push(eq(projects.department, filters.department));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total distinct documents
  const [countResult] = await db
    .select({ total: countDistinct(modelCallLogs.documentId) })
    .from(modelCallLogs)
    .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
    .leftJoin(workflows, eq(documents.workflowId, workflows.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(where);

  // Data query
  const data = await db
    .select({
      documentId: modelCallLogs.documentId,
      documentName: documents.title,
      userName: users.displayName,
      workflowName: workflows.name,
      totalCalls: count(modelCallLogs.id),
      totalTokens: totalTokensExpression,
      totalDuration: sum(modelCallLogs.duration),
      estimatedCost: costExpression,
      createdAt: sql<string>`MIN(${modelCallLogs.createdAt})`,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id))
    .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
    .leftJoin(users, eq(documents.createdBy, users.id))
    .leftJoin(workflows, eq(documents.workflowId, workflows.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(where)
    .groupBy(modelCallLogs.documentId, documents.title, users.displayName, workflows.name)
    .orderBy(sql`MIN(${modelCallLogs.createdAt}) DESC`)
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    total: countResult?.total ?? 0,
    page,
    pageSize,
  };
}

// ─── Audit: Document Detail (individual model calls) ────────────────────────

export async function getDocumentDetail(documentId: string) {
  return db
    .select({
      id: modelCallLogs.id,
      nodeExecutionId: modelCallLogs.nodeExecutionId,
      nodeLabel: nodeExecutions.nodeLabel,
      modelName: modelCallLogs.modelName,
      tokenUsage: modelCallLogs.tokenUsage,
      duration: modelCallLogs.duration,
      responseStatus: modelCallLogs.responseStatus,
      budgetUsedUsd: modelCallLogs.budgetUsedUsd,
      estimatedCost: sql<string>`
        COALESCE(${modelCallLogs.budgetUsedUsd}::numeric, 0) +
        COALESCE(
          (${modelCallLogs.tokenUsage}->>'prompt_tokens')::numeric / 1000000 * ${models.inputPricePerMTok}::numeric,
          0
        ) +
        COALESCE(
          (${modelCallLogs.tokenUsage}->>'completion_tokens')::numeric / 1000000 * ${models.outputPricePerMTok}::numeric,
          0
        )
      `,
      createdAt: modelCallLogs.createdAt,
    })
    .from(modelCallLogs)
    .leftJoin(models, eq(modelCallLogs.modelId, models.id))
    .leftJoin(nodeExecutions, eq(modelCallLogs.nodeExecutionId, nodeExecutions.id))
    .where(eq(modelCallLogs.documentId, documentId))
    .orderBy(modelCallLogs.createdAt);
}
