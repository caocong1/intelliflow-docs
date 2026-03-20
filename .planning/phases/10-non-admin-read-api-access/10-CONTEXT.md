# Phase 10: Non-Admin Read API Access - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

非管理员认证用户可以列出启用的文档类型和工作流，用于创建文档。管理员专属的变更操作（创建、编辑、删除、切换状态）保持 requireAdmin 保护。修复 Phase 1/3 的管理员专属端点与 Phase 4 非管理员用户流之间的跨阶段集成缺口（INT-NEW-01）。

</domain>

<decisions>
## Implementation Decisions

### 路由拆分策略
- document-types 和 workflows 的 GET / 列表端点从 requireAdmin 降级为 requireAuth
- 所有变更操作（POST、PUT、PATCH、DELETE）保持 requireAdmin
- GET /:id（详情）、GET /:id/associations（关联查询）、POST /:id/validate、POST /:id/copy 等端点的权限级别 — Claude 根据 Phase 目标自行判断

### Claude's Discretion
- **辅助 GET 端点权限**：GET /:id/associations（document-types）和 GET /:id（workflows）是否也降级为 requireAuth，根据非管理员实际使用场景判断
- **数据过滤策略**：非管理员调用列表接口时是否由后端自动过滤只返回启用状态的项目（vs 返回全部数据由前端过滤）。注意前端 ProjectHome.tsx 已有客户端过滤逻辑（isActive、status==='active'）
- **分页/搜索支持**：非管理员的列表接口是否保留分页和搜索参数
- **前端双重过滤**：如果后端增加了服务端过滤，前端现有的客户端过滤代码是保留（防御性编程）还是移除（简化代码）
- **空状态处理**：当没有可用的文档类型或工作流时，创建文档弹窗的行为（禁用按钮+提示 vs 弹窗内提示）

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireAuth` guard（auth.guard.ts:21）：已存在，可直接用于降级后的列表端点
- `requireAdmin` guard（auth.guard.ts:30）：保持用于变更操作
- `authPlugin`（auth.guard.ts:5）：提供 `user` 对象含 `role` 字段，可用于条件过滤

### Established Patterns
- Elysia 路由文件使用顶层 `.use(requireAdmin)` 应用中间件，拆分后需改为按路由组分别应用
- 前端 `ProjectHome.tsx` 第132-156行已实现客户端过滤：`fetchDocTypes()` 过滤 `isActive !== false`，`fetchWorkflows()` 过滤 `status === "active"`
- 前端使用 Eden treaty client（`api.api["document-types"].get()`）类型安全调用

### Integration Points
- **后端路由文件**：`document-types.routes.ts`（第13行 `.use(requireAdmin)`）和 `workflows.routes.ts`（第34行 `.use(requireAdmin)`）需要拆分中间件应用
- **前端 ProjectHome.tsx**：`openCreateModal()`（第184行）触发 `fetchDocTypes()`，`handleDocTypeChange()`（第194行）触发 `fetchWorkflows()`——这些调用当前因 requireAdmin 对非管理员返回 403
- **listDocumentTypes / listWorkflows service 函数**：可能需要增加 `isActive` 过滤参数

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-non-admin-read-api-access*
*Context gathered: 2026-03-20*
