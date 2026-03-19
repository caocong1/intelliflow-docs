# Phase 1: Foundation + Auth + Document Types - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

搭建 Bun + ElysiaJS + SolidJS + Tailwind CSS v4 应用框架，实现用户名密码认证和角色权限，管理员可管理用户账号和文档类型。这是整个平台的基础设施阶段。

</domain>

<decisions>
## Implementation Decisions

### 管理员与普通用户分离
- 不分离：同一个应用、同一套布局，管理员只是多看到管理相关的菜单项
- 管理菜单项与普通菜单项混合排列，管理员能看到更多项，普通用户看不到管理项
- 管理员同时也是普通用户，拥有普通用户的所有功能 + 管理功能
- 普通用户尝试直接访问管理页面 URL 时，显示 403 无权访问提示页，带返回按钮

### 认证方案
- 不用 JWT，不用 Cookie Session
- 使用 Bearer Token + localStorage：登录返回随机 token，前端存 localStorage，每次请求 Authorization: Bearer <token>
- 后端 sessions 表存 token，derive 中间件验证
- 停用用户时删除其所有 session 记录，立即生效

### Claude's Discretion
- 整体应用布局结构（侧边栏 vs 顶部导航）
- 登录页面设计风格
- 用户/文档类型管理列表的展示方式（表格 vs 卡片、弹窗 vs 新页面编辑）
- 错误提示和表单验证的交互方式
- 会话超时行为
- 首次登录引导

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Greenfield project, no existing code

### Established Patterns
- Tech stack decided: Bun + ElysiaJS + Drizzle ORM + PostgreSQL 18 + SolidJS + Tailwind CSS v4
- Eden Treaty for frontend-backend end-to-end type safety
- pnpm workspace monorepo structure

### Integration Points
- This phase establishes the foundation that all subsequent phases build upon
- Auth middleware and role guards will be reused by all future API routes
- App layout/navigation shell will house all future modules

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-auth-document-types*
*Context gathered: 2026-03-19*
