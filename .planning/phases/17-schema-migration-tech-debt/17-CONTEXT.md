# Phase 17: Schema Migration + Tech Debt - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

为 v1.1 所有功能建立数据库基础（新表、索引、扩展），并修复 DTYPE-04 文档类型删除守卫。不包含任何业务逻辑实现——后台任务执行、搜索、收藏等功能在后续 Phase 实现。

</domain>

<decisions>
## Implementation Decisions

### DTYPE-04 删除守卫
- 删除文档类型时同时检查关联的 workflows 和 documents，任一存在即阻止删除
- 错误信息包含数量 + 完整文档/workflow 标题列表（如："该文档类型关联了 3 个文档：《项目报告》《需求说明》《会议纪要》，无法删除"）
- 检查 documents 时排除已软删除的文档（isDeleted=true）
- 前端展示：删除失败时弹出 Dialog 弹窗显示关联的 workflows 和 documents 完整列表

### 新表 Schema 设计
- **background_tasks**：通用任务表设计，使用 task_type enum 字段（初始值 `document_generation`），documentId 可空以支持未来非文档类任务
- **user_favorites**：多态设计，target_type (project/document/workflow) + target_id，支持项目、文档、工作流三种收藏
- **user_recent_access**：多态设计，与 favorites 表结构一致（target_type + target_id），覆盖项目、文档、工作流三种资源类型
- **保留策略**：每用户固定条数上限（如 50 条），新记录插入时删除最旧记录，应用层维护

### Trigram 搜索索引
- 启用 pg_trgm 扩展，建 GIN trigram 索引覆盖所有可搜索字段：documents.title、documents.description、projects.name、projects.description、workflows.name
- 同时建 tsvector 全文搜索索引，使用 zhparser 中文分词插件
- zhparser 在自建 PostgreSQL 服务器上直接安装

### callSourceEnum 扩展
- 在 callSourceEnum 中新增 `inline_edit` 值，为 Phase 21 AI 编辑审计留下标记

### Migration 策略
- 现有数据库数据全部为测试垃圾数据，可以清掉
- 重置迁移历史：清空旧迁移文件，从当前 schema.ts 重新 drizzle-kit generate 生成干净的初始迁移
- pg_trgm 和 zhparser 扩展通过自定义 SQL 迁移文件创建（CREATE EXTENSION IF NOT EXISTS）

### Claude's Discretion
- background_tasks 表具体字段设计（status enum 值、重试相关字段等）
- user_favorites / user_recent_access 唯一约束和索引设计
- GIN 索引的具体创建语法和命名
- tsvector 列和触发器的具体实现方式
- 迁移文件命名和组织

</decisions>

<specifics>
## Specific Ideas

- favorites 和 recent_access 表范围对齐（都支持 project/document/workflow），保持一致性
- recent_access 保留策略用固定条数而非时间过期，避免引入定时清理任务

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `schema.ts`（packages/backend/src/db/schema.ts）：所有表定义集中在一个文件，使用 Drizzle pgTable + pgEnum
- `callSourceEnum`（schema.ts:242）：已有 runtime/model_test/provider_test/prompt_optimize 四个值
- `deleteDocumentType`（document-types.service.ts:127）：已有 workflows 关联检查逻辑，TODO 标注了 documents 检查位置

### Established Patterns
- Drizzle ORM + drizzle-kit：6 个增量迁移文件（0000-0005），drizzle.config.ts 配置
- UUID 主键 + defaultRandom()
- timestamp with timezone + defaultNow()
- pgEnum 定义枚举类型
- 软删除模式：isDeleted + deletedAt 字段（documents、projects 表已使用）

### Integration Points
- `document-types.service.ts:134`：DTYPE-04 TODO 位置，需在此添加 documents 关联检查
- `documents` 表通过 `workflowId` 关联 `workflows`，`workflows` 通过 `documentTypeId` 关联 `documentTypes`——删除守卫需查询这条链路
- 新表需要在 schema.ts 中定义，Drizzle 会自动纳入迁移生成

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-schema-migration-tech-debt*
*Context gathered: 2026-03-25*
