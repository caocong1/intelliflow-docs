import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import { db } from "../../db";
import { modelCallLogs, documents } from "../../db/schema";
import { desc, eq, and, gte, lte, ilike, sql, count } from "drizzle-orm";

export const modelCallLogRoutes = new Elysia({ prefix: "/admin/model-call-logs" })
  .use(requireAdmin)
  .get(
    "/",
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Math.min(Number(query.limit) || 20, 100);
      const offset = (page - 1) * limit;

      // Build filter conditions
      const conditions = [];

      if (query.documentId) {
        conditions.push(eq(modelCallLogs.documentId, query.documentId));
      }

      if (query.modelId) {
        conditions.push(eq(modelCallLogs.modelId, query.modelId));
      }

      if (query.status) {
        conditions.push(eq(modelCallLogs.responseStatus, query.status));
      }

      if (query.dateFrom) {
        conditions.push(gte(modelCallLogs.createdAt, new Date(query.dateFrom)));
      }

      if (query.dateTo) {
        conditions.push(lte(modelCallLogs.createdAt, new Date(query.dateTo)));
      }

      if (query.search) {
        conditions.push(ilike(documents.title, `%${query.search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Query logs with document title JOIN
      const logs = await db
        .select({
          id: modelCallLogs.id,
          documentId: modelCallLogs.documentId,
          documentTitle: documents.title,
          nodeExecutionId: modelCallLogs.nodeExecutionId,
          modelId: modelCallLogs.modelId,
          modelName: modelCallLogs.modelName,
          promptTemplate: modelCallLogs.promptTemplate,
          resolvedPrompt: modelCallLogs.resolvedPrompt,
          variableMapping: modelCallLogs.variableMapping,
          temperature: modelCallLogs.temperature,
          maxTokens: modelCallLogs.maxTokens,
          responseStatus: modelCallLogs.responseStatus,
          contentLength: modelCallLogs.contentLength,
          tokenUsage: modelCallLogs.tokenUsage,
          duration: modelCallLogs.duration,
          errorMessage: modelCallLogs.errorMessage,
          createdAt: modelCallLogs.createdAt,
        })
        .from(modelCallLogs)
        .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
        .where(whereClause)
        .orderBy(desc(modelCallLogs.createdAt))
        .limit(limit)
        .offset(offset);

      // Count total
      const [totalResult] = await db
        .select({ value: count() })
        .from(modelCallLogs)
        .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
        .where(whereClause);

      return {
        logs,
        total: totalResult?.value ?? 0,
        page,
        limit,
      };
    },
    {
      query: t.Object({
        documentId: t.Optional(t.String()),
        modelId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        dateFrom: t.Optional(t.String()),
        dateTo: t.Optional(t.String()),
        search: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  );
