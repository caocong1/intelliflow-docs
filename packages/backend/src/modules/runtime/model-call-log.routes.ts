import Elysia, { t } from "elysia";
import { requireAdmin } from "../auth/auth.guard";
import { db } from "../../db";
import { modelCallLogs, documents, users } from "../../db/schema";
import { desc, eq, and, gte, lte, ilike, count } from "drizzle-orm";

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

      if (query.callSource) {
        conditions.push(
          eq(
            modelCallLogs.callSource,
            query.callSource as
              | "runtime"
              | "model_test"
              | "provider_test"
              | "prompt_optimize"
              | "inline_edit"
              | "ppt_export_planning",
          ),
        );
      }

      if (query.userId) {
        conditions.push(eq(modelCallLogs.userId, query.userId));
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

      // Query logs with document title + user display name JOINs
      const logs = await db
        .select({
          id: modelCallLogs.id,
          documentId: modelCallLogs.documentId,
          documentTitle: documents.title,
          nodeExecutionId: modelCallLogs.nodeExecutionId,
          userId: modelCallLogs.userId,
          userDisplayName: users.displayName,
          providerId: modelCallLogs.providerId,
          providerName: modelCallLogs.providerName,
          modelId: modelCallLogs.modelId,
          modelName: modelCallLogs.modelName,
          callSource: modelCallLogs.callSource,
          promptTemplate: modelCallLogs.promptTemplate,
          systemPrompt: modelCallLogs.systemPrompt,
          resolvedPrompt: modelCallLogs.resolvedPrompt,
          variableMapping: modelCallLogs.variableMapping,
          temperature: modelCallLogs.temperature,
          maxTokens: modelCallLogs.maxTokens,
          responseStatus: modelCallLogs.responseStatus,
          responseContent: modelCallLogs.responseContent,
          contentLength: modelCallLogs.contentLength,
          tokenUsage: modelCallLogs.tokenUsage,
          duration: modelCallLogs.duration,
          errorMessage: modelCallLogs.errorMessage,
          createdAt: modelCallLogs.createdAt,
        })
        .from(modelCallLogs)
        .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
        .leftJoin(users, eq(modelCallLogs.userId, users.id))
        .where(whereClause)
        .orderBy(desc(modelCallLogs.createdAt))
        .limit(limit)
        .offset(offset);

      // Count total
      const [totalResult] = await db
        .select({ value: count() })
        .from(modelCallLogs)
        .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
        .leftJoin(users, eq(modelCallLogs.userId, users.id))
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
        callSource: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        dateFrom: t.Optional(t.String()),
        dateTo: t.Optional(t.String()),
        search: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  );
