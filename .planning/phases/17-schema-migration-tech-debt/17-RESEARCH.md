# Phase 17: Schema Migration + Tech Debt - Research

**Researched:** 2026-03-26
**Domain:** Database schema migration (Drizzle ORM), PostgreSQL extensions (pg_trgm, zhparser), deletion guard logic
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **DTYPE-04 删除守卫**: 删除文档类型时同时检查关联的 workflows 和 documents，任一存在即阻止删除。错误信息包含数量 + 完整文档/workflow 标题列表。检查 documents 时排除已软删除的文档（isDeleted=true）。前端展示：删除失败时弹出 Dialog 弹窗显示关联的 workflows 和 documents 完整列表。
- **background_tasks**: 通用任务表，task_type enum（初始值 `document_generation`），documentId 可空
- **user_favorites**: 多态设计，target_type (project/document/workflow) + target_id
- **user_recent_access**: 多态设计，与 favorites 结构一致，保留策略为每用户固定条数上限（如 50 条），应用层维护
- **Trigram 搜索索引**: 启用 pg_trgm + GIN trigram 索引覆盖 documents.title, documents.description, projects.name, projects.description, workflows.name。同时建 tsvector 全文搜索索引，使用 zhparser 中文分词插件
- **callSourceEnum 扩展**: 新增 `inline_edit` 值
- **Migration 策略**: 现有数据全为测试数据可清掉。重置迁移历史：清空旧迁移文件，从当前 schema.ts 重新 drizzle-kit generate 生成干净的初始迁移

### Claude's Discretion
- background_tasks 表具体字段设计（status enum 值、重试相关字段等）
- user_favorites / user_recent_access 唯一约束和索引设计
- GIN 索引的具体创建语法和命名
- tsvector 列和触发器的具体实现方式
- 迁移文件命名和组织

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-01 | 文档类型删除时检查关联文档，有关联则阻止删除并提示（DTYPE-04 守卫） | Delete guard pattern: join documents→workflows→documentTypes chain, return structured error with associated item lists. Backend service + route error handling + frontend Dialog upgrade all documented below. |
</phase_requirements>

## Summary

This phase establishes the database foundation for all v1.1 features and fixes the DTYPE-04 tech debt. The work is purely schema-level — no business logic implementations beyond the delete guard.

The codebase uses **Drizzle ORM v0.39.3** with **drizzle-kit v0.30.5**, PostgreSQL via `postgres` driver, and currently deploys schema changes via `bun drizzle-kit push`. The existing migration history is inconsistent (journal tracks 1 entry, but 6 SQL files exist as manual additions), so the user decision to reset migration history is well-founded.

The phase has three distinct workstreams: (1) DTYPE-04 delete guard (backend service + route + frontend Dialog), (2) new table schemas in schema.ts (background_tasks, user_favorites, user_recent_access), and (3) PostgreSQL extension setup + index creation (pg_trgm GIN indexes, zhparser tsvector indexes, callSourceEnum extension). The migration reset should happen first to create a clean baseline.

**Primary recommendation:** Reset migrations first, then add new tables/enums to schema.ts, then create custom SQL migration for extensions/indexes, then implement DTYPE-04 delete guard with frontend Dialog.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.39.3 | ORM for PostgreSQL schema + queries | Already in use, all tables defined via pgTable/pgEnum |
| drizzle-kit | ^0.30.5 | Migration generation + push | Already in use, `drizzle-kit generate` + `drizzle-kit push` |
| postgres | ^3.4.5 | PostgreSQL driver | Already in use via drizzle-orm/postgres-js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg_trgm | PostgreSQL built-in | Trigram similarity search | GIN index for fuzzy text search on name/title/description columns |
| zhparser | PostgreSQL extension | Chinese text segmentation for tsvector | Full-text search with Chinese content |

### Alternatives Considered
None — all decisions are locked. Stack is established from v1.0.

**Installation:**
No new npm packages needed. pg_trgm and zhparser are PostgreSQL server-side extensions.

## Architecture Patterns

### Existing Project Structure (relevant files)
```
packages/backend/
├── drizzle.config.ts              # Drizzle config: schema path + output dir
├── drizzle/                       # Migration SQL files
│   ├── 0000_fancy_maginty.sql    # Initial schema (will be reset)
│   ├── 0001-0005_*.sql           # Manual migrations (will be reset)
│   └── meta/_journal.json        # Migration journal (will be reset)
├── src/db/
│   ├── schema.ts                 # ALL table/enum definitions (single file)
│   └── index.ts                  # DB connection + drizzle instance
└── src/modules/document-types/
    ├── document-types.service.ts  # Delete guard logic (DTYPE-04 TODO at line 134)
    └── document-types.routes.ts   # Error handling for HAS_ASSOCIATED_* errors
```

### Pattern 1: pgEnum Definition
**What:** All enums defined as Drizzle pgEnum at top of schema.ts
**When to use:** Any new enum type needed
**Example:**
```typescript
// Existing pattern from schema.ts
export const callSourceEnum = pgEnum("call_source", [
  "runtime",
  "model_test",
  "provider_test",
  "prompt_optimize",
  // Add: "inline_edit"
]);
```

### Pattern 2: Polymorphic Target Table (for favorites/recent_access)
**What:** target_type enum + target_id UUID pattern for multi-entity references
**When to use:** When a table needs to reference different entity types
**Example:**
```typescript
export const favoriteTargetTypeEnum = pgEnum("favorite_target_type", [
  "project",
  "document",
  "workflow",
]);

export const userFavorites = pgTable("user_favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  targetType: favoriteTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Pattern 3: Custom SQL Migration for Extensions
**What:** Drizzle doesn't support `CREATE EXTENSION` natively; use custom SQL migration files
**When to use:** pg_trgm, zhparser, or any PostgreSQL extension
**Example:**
```sql
-- Custom migration: extensions and indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS zhparser;

-- Create text search configuration for Chinese
CREATE TEXT SEARCH CONFIGURATION zhparser_cfg (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION zhparser_cfg ADD MAPPING FOR n,v,a,i,e,l WITH simple;

-- GIN trigram indexes
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_description_trgm ON documents USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_description_trgm ON projects USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_workflows_name_trgm ON workflows USING GIN (name gin_trgm_ops);
```

### Pattern 4: Delete Guard with Structured Error Response
**What:** Check associations before delete, return structured data in error response
**When to use:** DTYPE-04 — blocking deletion with informative error
**Example:**
```typescript
// Service: return structured data, not just error string
export async function deleteDocumentType(id: string): Promise<{ success: true }> {
  const associatedWorkflows = await getAssociatedWorkflows(id);
  const associatedDocuments = await getAssociatedDocuments(id);

  if (associatedWorkflows.length > 0 || associatedDocuments.length > 0) {
    const error = new Error("HAS_ASSOCIATIONS");
    (error as any).associations = { workflows: associatedWorkflows, documents: associatedDocuments };
    throw error;
  }
  // ... proceed with delete
}

// Route: return structured 409 response
if (message === "HAS_ASSOCIATIONS") {
  set.status = 409;
  return {
    error: "无法删除：存在关联的工作流或文档",
    workflows: (err as any).associations?.workflows ?? [],
    documents: (err as any).associations?.documents ?? [],
  };
}
```

### Anti-Patterns to Avoid
- **Separate schema files per table:** This project keeps ALL tables in one schema.ts file. Do NOT create separate files.
- **Using db:migrate in production without journal consistency:** The current journal is out of sync (1 entry, 6 files). Reset is the correct approach.
- **Adding FK references from polymorphic target_id:** Polymorphic columns (target_id in favorites/recent_access) cannot have foreign key constraints. Enforce referential integrity at the application layer.
- **Creating tsvector columns in Drizzle schema:** Drizzle doesn't natively support tsvector column type or trigger creation. Use custom SQL migration for tsvector columns, GIN indexes on them, and auto-update triggers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration generation | Manual SQL for schema changes | `drizzle-kit generate` | Drizzle generates correct DDL from schema.ts diff |
| Extension creation | Inline SQL in application code | Custom SQL migration file | Extensions must be created by superuser at DB level, not at app runtime |
| Trigram indexes | Application-level fuzzy matching | PostgreSQL pg_trgm GIN indexes | Orders of magnitude faster, handles Unicode/CJK properly |
| Chinese text search | Custom tokenization | zhparser extension | Battle-tested Chinese segmentation for PostgreSQL |

**Key insight:** Schema changes belong in migration files, not application code. Extensions and indexes that Drizzle can't express natively go in custom SQL migration files alongside the generated ones.

## Common Pitfalls

### Pitfall 1: Document-to-DocumentType Relationship is Indirect
**What goes wrong:** Querying `documents` table for `documentTypeId` — this column doesn't exist on documents
**Why it happens:** Documents reference workflows (`workflowId`), and workflows reference document types (`documentTypeId`). The relationship is: `documents → workflows → documentTypes`
**How to avoid:** Join through workflows: `SELECT d.id, d.title FROM documents d JOIN workflows w ON d.workflow_id = w.id WHERE w.document_type_id = $1 AND d.is_deleted = false`
**Warning signs:** Empty result set when documents clearly exist for a document type

### Pitfall 2: Migration Journal Out of Sync
**What goes wrong:** `drizzle-kit generate` produces incorrect diff because journal doesn't reflect actual DB state
**Why it happens:** Files 0001-0005 were added manually without updating the journal. Journal only has entry 0000.
**How to avoid:** User decision is to reset: delete all files in `drizzle/` including `meta/`, then run `drizzle-kit generate` fresh from current schema.ts. This produces a clean 0000 migration matching the full current schema.
**Warning signs:** Generated migration tries to create tables that already exist

### Pitfall 3: pg_trgm Extension Requires Superuser
**What goes wrong:** `CREATE EXTENSION pg_trgm` fails with permission denied
**Why it happens:** Extensions require superuser or `CREATE` privilege on the database
**How to avoid:** Run extension creation with the database superuser account, or ensure the app's DB user has the `CREATE` privilege. On self-hosted PostgreSQL (as decided), this is straightforward.
**Warning signs:** Permission denied errors during migration

### Pitfall 4: zhparser Not Available by Default
**What goes wrong:** `CREATE EXTENSION zhparser` fails because the extension isn't installed on the server
**Why it happens:** zhparser is a third-party extension, not bundled with PostgreSQL
**How to avoid:** Install zhparser on the PostgreSQL server first: typically `sudo apt install postgresql-XX-zhparser` or compile from source. User confirmed self-hosted PostgreSQL with direct installation.
**Warning signs:** Extension not found errors

### Pitfall 5: Polymorphic target_id Without FK Constraints
**What goes wrong:** Orphaned favorites/recent_access records when referenced entities are deleted
**Why it happens:** No FK constraint possible on polymorphic target_id
**How to avoid:** Application-layer cleanup: when deleting a project/document/workflow, also delete related favorites and recent_access records. Or use soft-delete (already in use for documents/projects) so references remain valid.
**Warning signs:** 404 errors when navigating from favorites/recent to deleted entities

### Pitfall 6: Drizzle pgEnum ALTER Requires Custom SQL
**What goes wrong:** Adding a value to an existing pgEnum via schema.ts change doesn't produce a clean migration
**Why it happens:** PostgreSQL `ALTER TYPE ... ADD VALUE` cannot run inside a transaction. Drizzle-kit may or may not handle this correctly depending on version.
**How to avoid:** Since we're resetting migrations, the new enum values will be in the initial CREATE TYPE statement. No ALTER needed. If in the future an enum needs extending post-reset, use a custom SQL migration file (pattern already established in 0001-0002 files).
**Warning signs:** Migration fails with "cannot add enum value inside a transaction"

## Code Examples

### DTYPE-04: Finding Associated Documents Through Workflows
```typescript
// documents don't have documentTypeId directly
// Must join: documents → workflows → documentTypes
import { eq, and } from "drizzle-orm";
import { documents, workflows } from "../../db/schema";

export async function getAssociatedDocuments(
  documentTypeId: string,
): Promise<{ id: string; title: string }[]> {
  const rows = await db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(
      and(
        eq(workflows.documentTypeId, documentTypeId),
        eq(documents.isDeleted, false), // Exclude soft-deleted
      ),
    );
  return rows;
}
```

### background_tasks Table Design (Claude's Discretion)
```typescript
export const backgroundTaskStatusEnum = pgEnum("background_task_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const backgroundTaskTypeEnum = pgEnum("background_task_type", [
  "document_generation",
]);

export const backgroundTasks = pgTable("background_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  taskType: backgroundTaskTypeEnum("task_type").notNull(),
  status: backgroundTaskStatusEnum("status").default("queued").notNull(),
  // Nullable: not all task types need a document
  documentId: uuid("document_id").references(() => documents.id),
  // Execution metadata
  progress: integer("progress").default(0),          // 0-100 percentage
  errorMessage: varchar("error_message", { length: 2000 }),
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### user_favorites Unique Constraint + Index Design (Claude's Discretion)
```typescript
import { unique } from "drizzle-orm/pg-core";

export const userFavorites = pgTable("user_favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  targetType: favoriteTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Prevent duplicate favorites
  uniqueUserTarget: unique().on(table.userId, table.targetType, table.targetId),
}));
```

### user_recent_access with Application-Level Retention
```typescript
export const userRecentAccess = pgTable("user_recent_access", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  targetType: recentAccessTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  accessedAt: timestamp("accessed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // For efficient "upsert on re-access" and "get recent N" queries
  uniqueUserTarget: unique().on(table.userId, table.targetType, table.targetId),
}));

// Application-layer retention (called after inserting a new access record):
// DELETE FROM user_recent_access WHERE user_id = $1 AND id NOT IN (
//   SELECT id FROM user_recent_access WHERE user_id = $1 ORDER BY accessed_at DESC LIMIT 50
// )
```

### Custom SQL Migration for Extensions + Indexes
```sql
-- File: drizzle/0001_extensions_and_indexes.sql
-- This file is NOT generated by drizzle-kit; it's a manual custom migration

-- Trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Chinese full-text search
CREATE EXTENSION IF NOT EXISTS zhparser;
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS zhparser_cfg (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION zhparser_cfg ADD MAPPING FOR n,v,a,i,e,l,j WITH simple;

-- GIN trigram indexes for fuzzy search (ILIKE optimization)
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_description_trgm ON documents USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_description_trgm ON projects USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_workflows_name_trgm ON workflows USING GIN (name gin_trgm_ops);

-- tsvector columns + indexes for Chinese full-text search (Phase 20 will query these)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(title, ''))) STORED;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(description, ''))) STORED;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(name, ''))) STORED;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(description, ''))) STORED;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS name_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(name, ''))) STORED;

-- GIN indexes on tsvector columns
CREATE INDEX IF NOT EXISTS idx_documents_title_fts ON documents USING GIN (title_tsv);
CREATE INDEX IF NOT EXISTS idx_documents_description_fts ON documents USING GIN (description_tsv);
CREATE INDEX IF NOT EXISTS idx_projects_name_fts ON projects USING GIN (name_tsv);
CREATE INDEX IF NOT EXISTS idx_projects_description_fts ON projects USING GIN (description_tsv);
CREATE INDEX IF NOT EXISTS idx_workflows_name_fts ON workflows USING GIN (name_tsv);
```

### Frontend Delete Guard Dialog Pattern
```typescript
// Current pattern uses toast for errors. Upgrade to Dialog:
// API response shape (409):
// { error: "...", workflows: [{id, name}], documents: [{id, title}] }

// Show Dialog with:
// - Error message header
// - "关联的工作流 (N个):" + list of workflow names
// - "关联的文档 (N个):" + list of document titles
// - Close button only (no delete option)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SQL migrations (0001-0005) | drizzle-kit generate from schema.ts | v1.0 Phase 1 | Schema changes auto-generated from TypeScript |
| db:push only (no journal) | Will reset to clean generate + push | This phase | Clean migration baseline for v1.1 |
| Simple toast on delete error | Dialog with association details | This phase | Better UX for DTYPE-04 guard |

**Deprecated/outdated:**
- The 6 existing migration files (0000-0005) and journal will be deleted and regenerated

## Open Questions

1. **tsvector GENERATED ALWAYS vs trigger approach**
   - What we know: PostgreSQL 12+ supports `GENERATED ALWAYS AS ... STORED` computed columns. This avoids needing triggers entirely.
   - What's unclear: Whether Drizzle schema.ts can represent generated columns (it likely cannot natively)
   - Recommendation: Use custom SQL migration for generated columns. They won't appear in schema.ts but will exist in DB. Drizzle queries can reference them via `sql` template literals. This is the cleanest approach — no triggers to maintain. **Confidence: MEDIUM** — needs validation that generated tsvector columns work with zhparser_cfg.

2. **zhparser installation verification**
   - What we know: User confirmed self-hosted PostgreSQL with direct installation
   - What's unclear: Exact PostgreSQL version on the server, whether zhparser package is available for that version
   - Recommendation: Include `CREATE EXTENSION IF NOT EXISTS` so migration is idempotent. Document the server-side prerequisite. **Confidence: HIGH** for the migration SQL; **LOW** for server readiness (out of this phase's scope).

3. **db:push vs db:migrate workflow going forward**
   - What we know: Currently uses `db:push` which applies schema directly without migration files. Migration files exist but are not used by the app.
   - What's unclear: Whether the team wants to switch to `db:migrate` for production
   - Recommendation: Keep `db:push` for dev. The migration reset + generate gives a clean baseline. Add `db:generate` and `db:migrate` scripts to package.json for future use, but don't change the current dev workflow. **Confidence: HIGH**

## Sources

### Primary (HIGH confidence)
- Project codebase: `packages/backend/src/db/schema.ts` — all current table/enum definitions
- Project codebase: `packages/backend/src/modules/document-types/document-types.service.ts` — DTYPE-04 TODO location and existing guard pattern
- Project codebase: `packages/backend/src/modules/document-types/document-types.routes.ts` — error handling pattern for 409 responses
- Project codebase: `packages/backend/drizzle/` — existing migration files and journal state
- Project codebase: `packages/backend/package.json` — drizzle-orm v0.39.3, drizzle-kit v0.30.5

### Secondary (MEDIUM confidence)
- Drizzle ORM documentation (from training data) — pgEnum, pgTable API, custom SQL migration support
- PostgreSQL documentation (from training data) — pg_trgm extension, GIN indexes, tsvector, GENERATED ALWAYS AS

### Tertiary (LOW confidence)
- zhparser text search configuration mapping syntax — exact mapping types (n,v,a,i,e,l,j) may need verification against zhparser docs for the installed version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all established in v1.0
- Architecture: HIGH — follows existing patterns, well-documented codebase
- Pitfalls: HIGH — identified from actual codebase analysis (indirect document-doctype relationship, journal inconsistency)
- Extensions/indexes: MEDIUM — pg_trgm is standard PostgreSQL, but zhparser configuration and tsvector generated columns need server-side validation

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, no fast-moving dependencies)
