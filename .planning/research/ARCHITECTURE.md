# Architecture: v1.1 Integration Design

**Domain:** v1.1 feature integration into existing AI document generation platform
**Researched:** 2026-03-25
**Confidence:** HIGH

## Existing Architecture Summary

The v1.0 codebase is a Bun monorepo with:

- **Backend:** ElysiaJS + Drizzle ORM + PostgreSQL 18, modular route/service pattern
- **Frontend:** SolidJS + Tailwind CSS v4, Eden Treaty for type-safe API calls
- **Runtime:** Sequential node execution with SSE streaming via `ReadableStream<Uint8Array>`
- **Auth:** Bearer Token + `sessions` table, `authPlugin` (resolve) + `requireAuth`/`requireAdmin` (scoped guards)
- **WeChat Work:** Service layer with access token caching, `sendTextCardMessage()` already implemented
- **Model calls:** OpenAI-compatible API with SSE, strategy pattern (`base.strategy.ts` -> `openai-compatible.strategy.ts`, `claude-agent-sdk.strategy.ts`)
- **Schema:** 14 tables via Drizzle (`users`, `sessions`, `providers`, `models`, `documentTypes`, `workflows`, `projects`, `projectMembers`, `projectInvitations`, `documents`, `documentVersions`, `nodeExecutions`, `desensitizeMappings`, `modelCallLogs`, `documentFiles`, `documentVisibilityMembers`)

Key insight: The current runtime is **synchronous-blocking from the user's perspective** -- the user stays on the DocumentWorkspace page while SSE streams model output. v1.1 must add an asynchronous path where the user leaves and gets notified on completion.

---

## Feature 1: Background AI Generation + WeChat Work Notification

### Decision: In-Process Task Queue (No External Dependencies)

**Use in-process queue with PostgreSQL persistence, not Redis/BullMQ.**

Rationale:
- Target is 50 concurrent users on a single server -- no need for distributed queue
- PostgreSQL is already the source of truth for `nodeExecutions` and `modelCallLogs`
- Adding Redis would double infrastructure complexity for zero benefit at this scale
- Bun Workers API can run CPU-bound tasks on separate threads if needed later
- The existing `executeModelCall()` already runs models in parallel via `Promise.allSettled` -- it just needs to be decoupled from the HTTP request lifecycle

### Architecture

```
Current (v1.0 - foreground):
  Browser SSE connection <---> model-call.routes.ts <---> model-call.service.ts
  (user must stay on page)

New (v1.1 - background option):
  POST /runtime/:docId/background-start
    -> Create background_tasks DB row (status: running)
    -> Fire-and-forget: run entire remaining workflow
    -> Return { taskId } immediately

  Background execution loop (in-process):
    -> For each remaining node: execute sequentially
    -> On model_call nodes: call executeModelCall() (no SSE stream needed)
    -> Store all outputs in nodeExecutions.outputData (same as foreground)
    -> On completion/failure: update background_tasks row
    -> Send WeChat Work notification via sendTextCardMessage()

  GET /runtime/:docId/background-status
    -> Poll task status (for re-entering users)
```

### New Components

| Component | Type | Location |
|-----------|------|----------|
| `background_tasks` table | New DB table | `packages/backend/src/db/schema.ts` |
| `background.service.ts` | New service | `packages/backend/src/modules/runtime/` |
| `background.routes.ts` | New routes | `packages/backend/src/modules/runtime/` |
| `notification.service.ts` | New service | `packages/backend/src/modules/notification/` |

### Modified Components

| Component | Change |
|-----------|--------|
| `wecom.service.ts` | Already has `sendTextCardMessage()` -- no change needed |
| `runtime.service.ts` | Extract `advanceNode` logic into reusable function callable without HTTP context |
| `model-call.service.ts` | Add non-streaming variant of `executeModelCall()` that writes directly to DB without SSE |
| `DocumentWorkspace.tsx` | Add "Background Generation" button, show background task status |

### New Table: `background_tasks`

```typescript
export const backgroundTaskStatusEnum = pgEnum("background_task_status", [
  "running",
  "completed",
  "failed",
]);

export const backgroundTasks = pgTable("background_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: backgroundTaskStatusEnum("status").default("running").notNull(),
  currentNodeId: varchar("current_node_id", { length: 100 }),
  errorMessage: varchar("error_message", { length: 2000 }),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
```

### Background Execution Pattern

```typescript
// background.service.ts
export async function startBackgroundExecution(
  documentId: string,
  userId: string,
): Promise<string> {
  // 1. Create background_tasks row
  const [task] = await db.insert(backgroundTasks).values({
    documentId, userId, status: "running", startedAt: new Date(),
  }).returning();

  // 2. Fire-and-forget the execution loop (runs after response is sent)
  // Using queueMicrotask or setTimeout(fn, 0) to detach from request
  setTimeout(() => {
    executeInBackground(task.id, documentId, userId).catch(console.error);
  }, 0);

  return task.id;
}

async function executeInBackground(
  taskId: string,
  documentId: string,
  userId: string,
): Promise<void> {
  try {
    let state = await getDocumentRuntimeState(documentId);
    while (state && hasInProgressOrPendingNodes(state)) {
      const currentNode = getCurrentNode(state);

      // Update progress
      await db.update(backgroundTasks)
        .set({ currentNodeId: currentNode.nodeId })
        .where(eq(backgroundTasks.id, taskId));

      // Execute current node (type-specific)
      await executeNodeInBackground(documentId, currentNode, userId);

      // Advance to next
      state = await advanceNode(documentId, currentNode.id, userId);
    }

    // Mark completed
    await db.update(backgroundTasks)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(backgroundTasks.id, taskId));

    // Send WeChat Work notification
    await notifyCompletion(documentId, userId, "completed");
  } catch (err) {
    await db.update(backgroundTasks)
      .set({ status: "failed", errorMessage: String(err), completedAt: new Date() })
      .where(eq(backgroundTasks.id, taskId));

    await notifyCompletion(documentId, userId, "failed");
  }
}
```

### Notification Pattern

```typescript
// notification.service.ts
import { sendTextCardMessage } from "../wecom/wecom.service";

export async function notifyCompletion(
  documentId: string,
  userId: string,
  result: "completed" | "failed",
): Promise<void> {
  // Look up user's wecomUserId
  const [user] = await db.select().from(users)
    .where(eq(users.id, userId)).limit(1);

  if (!user?.wecomUserId) return; // Can't notify without WeChat Work ID

  const [doc] = await db.select().from(documents)
    .where(eq(documents.id, documentId)).limit(1);

  const title = result === "completed"
    ? "AI 文档生成完成"
    : "AI 文档生成失败";
  const description = result === "completed"
    ? `文档「${doc?.title}」已生成完毕，点击查看结果。`
    : `文档「${doc?.title}」生成失败，请点击查看详情。`;

  try {
    await sendTextCardMessage(
      [user.wecomUserId],
      {
        title,
        description,
        url: `${process.env.APP_URL}/documents/${documentId}`,
        btntxt: "查看文档",
      },
    );

    // Record notification sent
    await db.update(backgroundTasks)
      .set({ notifiedAt: new Date() })
      .where(eq(backgroundTasks.documentId, documentId));
  } catch (err) {
    console.error("[notification] Failed to send WeChat Work message:", err);
    // Non-fatal: don't fail the task because notification failed
  }
}
```

### Key Design Decision: Why Not a Separate Worker Process

A separate worker (BullMQ, bunqueue) adds operational complexity (process management, health checks, shared state). The current architecture runs all model calls in-process via `Promise.allSettled` already. Background execution simply means "don't tie the Promise chain to an HTTP response." Using `setTimeout(fn, 0)` to detach from the request handler is sufficient. If the server crashes mid-generation, the `background_tasks` row stays in `running` status -- a startup recovery sweep can detect and either retry or mark as failed.

---

## Feature 2: Statistics & Audit Dashboard

### Decision: Aggregate from Existing Tables + One New Materialized View

**Do not create a separate analytics database.** The existing `modelCallLogs` table already captures all model call data (token usage, duration, costs, user, model, provider, call source). The `nodeExecutions` table tracks all execution activity. Statistics are read-heavy aggregation queries on existing data.

### Architecture

```
Existing data sources (no schema changes):
  modelCallLogs  -> token usage, duration, costs, model/provider/user dimensions
  nodeExecutions -> node-level timing, status, execution rounds
  documents      -> document count, status, creation date
  workflows      -> workflow usage (JOIN with documents)
  users          -> user activity dimension

New:
  stats.service.ts      -> Aggregation queries with time-range filters
  stats.routes.ts       -> Admin-only API endpoints
  admin/Statistics.tsx   -> Dashboard page with charts
```

### New Components

| Component | Type | Location |
|-----------|------|----------|
| `stats.service.ts` | New service | `packages/backend/src/modules/stats/` |
| `stats.routes.ts` | New routes | `packages/backend/src/modules/stats/` |
| `admin/Statistics.tsx` | New page | `packages/frontend/src/pages/admin/` |

### Aggregation Strategy

Use Drizzle ORM's `sql` tagged template for aggregation queries. No materialized views needed at 50-user scale -- direct aggregation is fast enough.

```typescript
// stats.service.ts

// Overview stats
export async function getOverviewStats(from: Date, to: Date) {
  return db.select({
    totalCalls: sql<number>`count(*)`,
    totalTokens: sql<number>`coalesce(sum((${modelCallLogs.tokenUsage}->>'total_tokens')::int), 0)`,
    totalDuration: sql<number>`coalesce(sum(${modelCallLogs.duration}), 0)`,
    uniqueUsers: sql<number>`count(distinct ${modelCallLogs.userId})`,
    successRate: sql<number>`round(
      count(*) filter (where ${modelCallLogs.responseStatus} = 'completed')::numeric
      / nullif(count(*), 0) * 100, 1
    )`,
  }).from(modelCallLogs)
    .where(and(
      gte(modelCallLogs.createdAt, from),
      lte(modelCallLogs.createdAt, to),
    ));
}

// By-model breakdown
export async function getStatsByModel(from: Date, to: Date) {
  return db.select({
    modelId: modelCallLogs.modelId,
    modelName: modelCallLogs.modelName,
    calls: sql<number>`count(*)`,
    tokens: sql<number>`coalesce(sum((${modelCallLogs.tokenUsage}->>'total_tokens')::int), 0)`,
    avgDuration: sql<number>`round(avg(${modelCallLogs.duration}))`,
    successRate: sql<number>`round(
      count(*) filter (where ${modelCallLogs.responseStatus} = 'completed')::numeric
      / nullif(count(*), 0) * 100, 1
    )`,
  }).from(modelCallLogs)
    .where(and(
      gte(modelCallLogs.createdAt, from),
      lte(modelCallLogs.createdAt, to),
      eq(modelCallLogs.callSource, "runtime"),
    ))
    .groupBy(modelCallLogs.modelId, modelCallLogs.modelName);
}
```

### Time Dimension

Support week/month/year grouping via PostgreSQL `date_trunc`:

```typescript
export async function getTrend(
  from: Date, to: Date,
  granularity: "day" | "week" | "month",
) {
  return db.select({
    period: sql<string>`date_trunc(${granularity}, ${modelCallLogs.createdAt})`,
    calls: sql<number>`count(*)`,
    tokens: sql<number>`coalesce(sum((${modelCallLogs.tokenUsage}->>'total_tokens')::int), 0)`,
  }).from(modelCallLogs)
    .where(and(
      gte(modelCallLogs.createdAt, from),
      lte(modelCallLogs.createdAt, to),
    ))
    .groupBy(sql`date_trunc(${granularity}, ${modelCallLogs.createdAt})`)
    .orderBy(sql`date_trunc(${granularity}, ${modelCallLogs.createdAt})`);
}
```

### Frontend: Lightweight Charting

Use a lightweight chart library compatible with SolidJS. **Recommendation: Chart.js with `solid-chartjs` wrapper** or direct Canvas API. Avoid heavy libraries (recharts is React-only, echarts is 500KB+). Alternatively, use `@solid-primitives/canvas` for simple sparklines and server-rendered SVG for complex charts.

### Modified Components

| Component | Change |
|-----------|--------|
| `index.ts` (backend entry) | Register `statsRoutes` |
| `Sidebar.tsx` | Add "Statistics" nav item under admin section |
| `App.tsx` | Add route `/admin/statistics` |

---

## Feature 3: Quota & Usage Limits

### Decision: Service Layer with Middleware Hook

**Implement as a service called from a reusable Elysia plugin (not raw middleware), because ElysiaJS uses a plugin composition model, not Express-style middleware.**

The quota check must run before model calls but after auth. Use an Elysia `onBeforeHandle` hook scoped to runtime routes.

### Architecture

```
Request flow:
  POST /runtime/:docId/model-call/:nodeId/execute
    -> requireAuth (existing)
    -> quotaCheck plugin (NEW - onBeforeHandle)
       -> quotaService.checkQuota(userId, modelId)
       -> If exceeded: return 429 with quota info
    -> model-call handler (existing)
    -> After success: quotaService.recordUsage() (already happens via modelCallLogs insert)
```

### New Components

| Component | Type | Location |
|-----------|------|----------|
| `quotas` table | New DB table | `packages/backend/src/db/schema.ts` |
| `quota.service.ts` | New service | `packages/backend/src/modules/quota/` |
| `quota.guard.ts` | New Elysia plugin | `packages/backend/src/modules/quota/` |
| `admin/QuotaManagement.tsx` | New page | `packages/frontend/src/pages/admin/` |

### New Table: `quotas`

```typescript
export const quotaTypeEnum = pgEnum("quota_type", [
  "user_daily",
  "user_monthly",
  "model_daily",
  "project_monthly",
]);

export const quotas = pgTable("quotas", {
  id: uuid("id").defaultRandom().primaryKey(),
  quotaType: quotaTypeEnum("quota_type").notNull(),
  // Nullable: applies to specific entity or globally
  userId: uuid("user_id").references(() => users.id),
  modelId: uuid("model_id").references(() => models.id),
  projectId: uuid("project_id").references(() => projects.id),
  maxCalls: integer("max_calls"),          // null = unlimited
  maxTokens: integer("max_tokens"),        // null = unlimited
  warningThreshold: real("warning_threshold").default(0.8), // 80% triggers warning
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Quota Check Pattern

```typescript
// quota.guard.ts
export const quotaCheck = new Elysia({ name: "quotaCheck" })
  .use(requireAuth)
  .onBeforeHandle({ as: "scoped" }, async ({ user, params, set }) => {
    if (!user) return; // requireAuth already handles this

    const result = await checkUserQuota(user.id);
    if (result.exceeded) {
      set.status = 429;
      return {
        error: "已超出使用配额",
        quota: result.details,
      };
    }
    if (result.warning) {
      // Set header to inform frontend of approaching limit
      set.headers["X-Quota-Warning"] = JSON.stringify(result.details);
    }
  });

// quota.service.ts
export async function checkUserQuota(userId: string): Promise<QuotaCheckResult> {
  // Count today's calls from modelCallLogs
  const todayCalls = await db.select({
    count: sql<number>`count(*)`,
  }).from(modelCallLogs)
    .where(and(
      eq(modelCallLogs.userId, userId),
      gte(modelCallLogs.createdAt, startOfDay()),
      eq(modelCallLogs.callSource, "runtime"),
    ));

  // Look up applicable quotas
  const userQuotas = await db.select().from(quotas)
    .where(and(
      eq(quotas.userId, userId),
      eq(quotas.isActive, true),
    ));

  // Check each quota rule...
  // Return { exceeded: boolean, warning: boolean, details: {...} }
}
```

### Modified Components

| Component | Change |
|-----------|--------|
| `model-call.routes.ts` | Add `.use(quotaCheck)` before execute/retry handlers |
| `background.service.ts` | Check quota before each model call node in background loop |
| `Sidebar.tsx` | Add "Quota Management" nav item |
| `App.tsx` | Add route `/admin/quotas` |
| `ModelCallExecutor.tsx` | Show quota warning/exceeded state in UI |

---

## Feature 4: Global Search, Recent Access, Favorites

### Decision: PostgreSQL `ILIKE` + `pg_trgm` for Search, Not tsvector

**Use `ILIKE` with `pg_trgm` GIN index, not `tsvector`.** Reasons:
- Chinese text requires `zhparser` or `pg_bigm` extension for proper `tsvector` segmentation -- these need PostgreSQL extension installation (ops burden)
- `pg_trgm` works for Chinese out of the box via trigram matching with no segmentation needed
- At 50-user scale with thousands (not millions) of documents, `ILIKE` with trigram index is fast enough
- Simpler implementation: no need to maintain tsvector columns or triggers

### Architecture

```
Search scope:
  documents (title, description)
  projects (name, description)
  workflows (name, description)

Approach:
  1. Add pg_trgm extension (CREATE EXTENSION pg_trgm)
  2. Create GIN trigram indexes on searchable columns
  3. Use ILIKE with % wildcards -- pg_trgm GIN index accelerates this
  4. Union results from multiple tables, rank by relevance
```

### New Components

| Component | Type | Location |
|-----------|------|----------|
| `user_favorites` table | New DB table | `packages/backend/src/db/schema.ts` |
| `user_recent_access` table | New DB table | `packages/backend/src/db/schema.ts` |
| `search.service.ts` | New service | `packages/backend/src/modules/search/` |
| `search.routes.ts` | New routes | `packages/backend/src/modules/search/` |
| `favorites.service.ts` | New service | `packages/backend/src/modules/search/` |
| `favorites.routes.ts` | New routes | `packages/backend/src/modules/search/` |
| `SearchResults.tsx` | New page | `packages/frontend/src/pages/` |
| `SearchBar.tsx` | New component | `packages/frontend/src/components/nav/` |

### New Tables

```typescript
export const favoriteTargetEnum = pgEnum("favorite_target", [
  "document",
  "project",
  "workflow",
]);

export const userFavorites = pgTable("user_favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  targetType: favoriteTargetEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRecentAccess = pgTable("user_recent_access", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  targetType: favoriteTargetEnum("target_type").notNull(), // reuse enum
  targetId: uuid("target_id").notNull(),
  accessedAt: timestamp("accessed_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Search Pattern

```typescript
// search.service.ts
export async function globalSearch(query: string, userId: string, limit = 20) {
  const pattern = `%${query}%`;

  // Search documents (respecting visibility)
  const docs = await db.select({
    id: documents.id,
    type: sql<string>`'document'`,
    title: documents.title,
    description: documents.description,
    updatedAt: documents.updatedAt,
  }).from(documents)
    .innerJoin(projectMembers, and(
      eq(projectMembers.projectId, documents.projectId),
      eq(projectMembers.userId, userId),
    ))
    .where(and(
      eq(documents.isDeleted, false),
      or(
        sql`${documents.title} ILIKE ${pattern}`,
        sql`${documents.description} ILIKE ${pattern}`,
      ),
    ))
    .limit(limit);

  // Search projects (user is member)
  const projs = await db.select({
    id: projects.id,
    type: sql<string>`'project'`,
    title: projects.name,
    description: projects.description,
    updatedAt: projects.updatedAt,
  }).from(projects)
    .innerJoin(projectMembers, and(
      eq(projectMembers.projectId, projects.id),
      eq(projectMembers.userId, userId),
    ))
    .where(and(
      eq(projects.isDeleted, false),
      or(
        sql`${projects.name} ILIKE ${pattern}`,
        sql`${projects.description} ILIKE ${pattern}`,
      ),
    ))
    .limit(limit);

  // Merge, sort by updatedAt, return top N
  return [...docs, ...projs]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}
```

### Recent Access Tracking

Record access on document/project view endpoints. Use upsert to avoid duplicates:

```typescript
// Called from documents.routes.ts and projects.routes.ts GET handlers
export async function recordAccess(userId: string, targetType: string, targetId: string) {
  await db.insert(userRecentAccess).values({
    userId, targetType, targetId, accessedAt: new Date(),
  }).onConflictDoUpdate({
    target: [userRecentAccess.userId, userRecentAccess.targetType, userRecentAccess.targetId],
    set: { accessedAt: new Date() },
  });
  // Keep only last 50 entries per user (async cleanup)
}
```

### Modified Components

| Component | Change |
|-----------|--------|
| `AppLayout.tsx` | Add global search bar in header |
| `Dashboard.tsx` | Show recent access list and favorites |
| `documents.routes.ts` | Record access on GET document detail |
| `projects.routes.ts` | Record access on GET project detail |
| Migration | `CREATE EXTENSION IF NOT EXISTS pg_trgm` + GIN indexes |

### Database Migration

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_documents_title_trgm ON documents USING gin (title gin_trgm_ops);
CREATE INDEX idx_documents_description_trgm ON documents USING gin (description gin_trgm_ops);
CREATE INDEX idx_projects_name_trgm ON projects USING gin (name gin_trgm_ops);

-- Unique constraint for recent access upsert
CREATE UNIQUE INDEX idx_user_recent_access_unique
  ON user_recent_access (user_id, target_type, target_id);
```

---

## Feature 5: AI Inline Editing

### Decision: New Streaming Endpoint, Reuse Existing SSE Pattern

The existing `InlineEditor.tsx` is a pure markdown editor (no AI). v1.1 adds an "AI assist" button that sends selected text + instruction to a model and streams back the edited result.

### Architecture

```
User selects text in InlineEditor
  -> Clicks "AI Edit" button
  -> Sends: { selectedText, instruction, modelId, documentId, nodeExecutionId }
  -> POST /runtime/:docId/inline-edit (returns SSE stream)
  -> Backend: resolve model, send prompt, stream response
  -> Frontend: shows streaming diff/replacement in editor
  -> User accepts or rejects the edit
```

### New Components

| Component | Type | Location |
|-----------|------|----------|
| `inline-edit.service.ts` | New service | `packages/backend/src/modules/runtime/` |
| `inline-edit.routes.ts` | New routes | `packages/backend/src/modules/runtime/` |
| `AIEditDialog.tsx` | New component | `packages/frontend/src/components/workspace/` |

### Modified Components

| Component | Change |
|-----------|--------|
| `InlineEditor.tsx` | Add "AI Edit" toolbar button, selection-aware |
| `model-call.service.ts` | Extract streaming logic into reusable helper |
| `modelCallLogs` | Inline edits logged with `callSource: "inline_edit"` |

### Schema Change

Add `"inline_edit"` to `callSourceEnum`:

```typescript
export const callSourceEnum = pgEnum("call_source", [
  "runtime",
  "model_test",
  "provider_test",
  "prompt_optimize",
  "inline_edit",    // NEW
]);
```

### Endpoint Pattern

```typescript
// inline-edit.routes.ts
export const inlineEditRoutes = new Elysia({ prefix: "/runtime" })
  .use(requireAuth)
  .get(
    "/:documentId/inline-edit",
    async ({ params, query, user, set }) => {
      // query: { text, instruction, modelId }
      const { text, instruction, modelId } = query;

      // Security: check if model is local-only if document has been restored
      // (post-restore editing must use local model per requirements)

      const prompt = buildInlineEditPrompt(text, instruction);
      const stream = await streamSingleModel(modelId, prompt, {
        documentId: params.documentId,
        userId: user!.id,
        callSource: "inline_edit",
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },
    {
      params: t.Object({ documentId: t.String() }),
      query: t.Object({
        text: t.String(),
        instruction: t.String(),
        modelId: t.String(),
      }),
    },
  );
```

### Security Constraint: Local Model After Restore

Per requirements: "AI assisted editing -- before information restore, can use online models; after restore, only local models." The inline edit service must check whether the document has passed a restore node:

```typescript
async function validateModelForInlineEdit(
  documentId: string,
  modelId: string,
): Promise<void> {
  // Check if any restore node has been completed
  const restoreNodes = await db.select().from(nodeExecutions)
    .where(and(
      eq(nodeExecutions.documentId, documentId),
      eq(nodeExecutions.nodeType, "restore"),
      eq(nodeExecutions.status, "completed"),
      eq(nodeExecutions.isCurrent, true),
    ));

  if (restoreNodes.length > 0) {
    // Must use local/private model only
    const [model] = await db.select({
      deploymentType: providers.deploymentType,
    }).from(models)
      .innerJoin(providers, eq(models.providerId, providers.id))
      .where(eq(models.id, modelId));

    if (model?.deploymentType !== "local") {
      throw new Error("信息恢复后仅可使用本地私有模型进行 AI 编辑");
    }
  }
}
```

---

## Feature 6: DTYPE-04 Document Association Guard (Tech Debt)

### Decision: Add Check to Document Type Disable/Delete Endpoints

Simple service-layer check -- if documents reference a document type (via workflow), prevent deletion. Allow disable (existing documents unaffected, no new documents can use it).

### Modified Components

| Component | Change |
|-----------|--------|
| `document-types.service.ts` | Add `hasAssociatedDocuments()` check before delete |
| `document-types.routes.ts` | Return 409 Conflict if delete blocked |

No new tables or services needed.

---

## Component Boundary Summary

### New Modules

```
packages/backend/src/modules/
  notification/              # WeChat Work notifications (thin wrapper)
    notification.service.ts
  stats/                     # Analytics aggregation
    stats.service.ts
    stats.routes.ts
  quota/                     # Usage limits
    quota.service.ts
    quota.guard.ts
    quota.routes.ts          # Admin CRUD for quota rules
  search/                    # Global search + favorites + recent
    search.service.ts
    search.routes.ts
    favorites.service.ts
    favorites.routes.ts

packages/backend/src/modules/runtime/
  background.service.ts      # Background execution loop
  background.routes.ts       # Start/status endpoints
  inline-edit.service.ts     # AI inline editing
  inline-edit.routes.ts      # SSE streaming endpoint

packages/frontend/src/pages/admin/
  Statistics.tsx              # Analytics dashboard
  QuotaManagement.tsx         # Quota CRUD

packages/frontend/src/pages/
  SearchResults.tsx           # Global search results

packages/frontend/src/components/
  nav/SearchBar.tsx           # Global search input
  workspace/AIEditDialog.tsx  # AI edit instruction dialog
```

### New Database Tables

| Table | Purpose | Rows at Scale |
|-------|---------|---------------|
| `background_tasks` | Track background generation jobs | ~100s |
| `quotas` | Quota rules per user/model/project | ~10s |
| `user_favorites` | User bookmarks | ~100s |
| `user_recent_access` | Recent access log | ~1000s (pruned) |

### Database Indexes

| Index | Purpose |
|-------|---------|
| `idx_documents_title_trgm` (GIN) | Accelerate ILIKE search on document titles |
| `idx_documents_description_trgm` (GIN) | Accelerate ILIKE search on document descriptions |
| `idx_projects_name_trgm` (GIN) | Accelerate ILIKE search on project names |
| `idx_user_recent_access_unique` | Upsert support for recent access |
| `idx_model_call_logs_user_date` | Fast quota checks (userId + createdAt) |
| `idx_model_call_logs_created_at` | Fast time-range aggregations for stats |

---

## Suggested Build Order

Dependencies determine the order:

```
Phase 1: Infrastructure (no feature dependencies)
  1a. DB migration: new tables + pg_trgm extension + indexes
  1b. DTYPE-04 guard (simple, closes tech debt)

Phase 2: Background Execution + Notification (unlocks core feature)
  2a. notification.service.ts (thin wrapper over existing wecom.service)
  2b. background.service.ts + routes (depends on 2a)
  2c. Frontend: background task button + status display

Phase 3: Statistics & Audit (reads existing data, no write-side changes)
  3a. stats.service.ts + routes
  3b. Frontend: Statistics dashboard page

Phase 4: Quota Management (must exist before heavy usage)
  4a. quota.service.ts + guard
  4b. quota.routes.ts (admin CRUD)
  4c. Wire quota guard into model-call and background routes
  4d. Frontend: Quota management page + warning indicators

Phase 5: Search + Favorites + Recent (user-facing polish)
  5a. search.service.ts + routes
  5b. favorites + recent access services + routes
  5c. Wire recent access recording into existing routes
  5d. Frontend: search bar, results page, dashboard integration

Phase 6: AI Inline Editing (highest complexity, depends on stable runtime)
  6a. inline-edit.service.ts + routes
  6b. Frontend: AIEditDialog + InlineEditor AI button
  6c. Security: local model enforcement post-restore
```

### Rationale for Order

- **Phase 1 first:** Schema migrations must land before any feature code. DTYPE-04 is a simple fix that closes tech debt with minimal risk.
- **Phase 2 before 3:** Background execution creates the `background_tasks` data that statistics can later aggregate. Also, background execution is the highest-value user-facing feature.
- **Phase 3 before 4:** Statistics gives admins visibility into actual usage before they configure quotas. Setting quotas without usage data is guesswork.
- **Phase 5 is independent:** Search/favorites have no dependency on other v1.1 features. Placed here because it's user-facing polish.
- **Phase 6 last:** AI inline editing is the most complex feature (streaming, security constraints, editor integration). It benefits from the stable runtime that earlier phases ensure.

---

## Anti-Patterns to Avoid

### Anti-Pattern: External Queue for In-Process Workload

Adding Redis + BullMQ for background tasks at 50-user scale. The operational cost (Redis deployment, monitoring, connection management) outweighs any benefit. In-process execution with PostgreSQL as the state store is simpler and equally reliable.

### Anti-Pattern: Separate Analytics Database

Creating a data warehouse or separate analytics store for 50 users. Direct SQL aggregation on the operational database is fast enough. Add read replicas or materialized views only when query latency becomes measurable (unlikely below 10K users).

### Anti-Pattern: Elasticsearch for Search

Deploying Elasticsearch for full-text search over thousands of documents. PostgreSQL `pg_trgm` with GIN indexes handles this volume trivially. Elasticsearch adds ops burden, data sync complexity, and is justified only at millions of documents.

### Anti-Pattern: Quota Check in Middleware Only

Checking quotas only at the HTTP layer misses background execution. Quota checks must also run inside `background.service.ts` before each model call node, or background jobs could exceed quotas silently.

---

## Sources

- [BullMQ](https://bullmq.io/) -- Evaluated but rejected for v1.1 scale
- [bunqueue](https://github.com/egeominotti/bunqueue) -- Bun-native alternative evaluated
- [Bun Workers API](https://bun.com/docs/runtime/workers) -- For future CPU-bound isolation
- [zhparser](https://github.com/amutu/zhparser) -- PostgreSQL Chinese FTS extension (evaluated, too complex for current needs)
- [pg_cjk_parser](https://github.com/huangjimmy/pg_cjk_parser) -- CJK 2-gram tokenizer alternative
- [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) -- Trigram matching for ILIKE acceleration
- WeChat Work message API: existing `wecom.service.ts` `sendTextCardMessage()`
- Existing codebase: `packages/backend/src/db/schema.ts`, `packages/backend/src/modules/runtime/`

---
*Architecture research for: IntelliFlow Docs v1.1 -- Operations Enhancement & Smart Editing*
*Researched: 2026-03-25*
