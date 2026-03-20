# Phase 4: Project + Document + Version + File System Infrastructure - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以创建项目并管理团队成员，在项目内管理文档（可见性控制），系统维护版本历史和工作目录。包含项目 CRUD、成员管理、文档管理、版本快照、文件系统基础设施。不包含文档创建运行时（Phase 5）。

</domain>

<decisions>
## Implementation Decisions

### 项目列表与导航
- 项目列表使用表格布局，复用现有 Table 组件，与用户管理等管理页风格一致
- 顶部 Tab 页签切换三个维度：我创建的 | 我参与的 | 全部项目
- 项目列表展示：项目名称、描述、角色、成员数、创建时间等列

### 项目主页
- 进入项目后首屏是文档列表（带筛选+搜索），顶部展示项目信息摘要（名称、描述、成员数）
- 项目负责人可见额外的"设置"入口（齿轮图标）

### 项目设置页
- 独立设置页面（项目右上角"设置"图标进入），仅项目负责人可访问
- 包含：基本信息编辑 + 成员管理 + 回收站（已删除文档的恢复/彻底删除）

### 文档可见性与访问控制
- 创建文档时不选择可见性，默认"项目成员可见"
- 可见性在文档设置中后期修改，三个级别：仅自己 | 项目成员 | 指定成员
- "指定成员"使用 Modal 多选列表（复用现有 Modal 组件），展示项目成员勾选
- 文档列表中用彩色 Badge 标签展示可见性状态（复用现有 Badge 组件）

### 文档回收站
- 回收站放在项目设置页内，仅项目负责人可访问
- 支持恢复和彻底删除操作

### 版本时间线与 Diff
- 版本历史使用垂直时间线展示（新建 Timeline 组件），每个节点显示：节点名称、完成时间、操作人
- 版本 Diff 使用左右分栏对比（类似 GitHub side-by-side diff），差异行高亮
- 版本快照仅在节点完成（确认/下一步）时自动生成，不支持手动保存
- 版本历史入口为独立页面（文档详情或列表中"查看版本"按钮跳转）

### 存储架构（重大调整）
- **中间节点文本内容全部存 DB**（text 字段）— 脱敏、模型调用、恢复节点的输入输出都是文本
- **仅上传原始文件和导出文件使用文件系统** — 最小化文件系统依赖
- 文件系统目录结构简化为：`uploads/{doc-uuid}/` 和 `exports/{doc-uuid}/`
- 不再需要 step 子目录（step-01-input/ 等），中间节点数据走 DB
- 工作目录根路径通过环境变量配置（如 WORKSPACE_ROOT=/data/workspaces）
- UUID 命名目录，避免中文路径问题

### 文件归档策略
- 文档删除时目录不移动，仅在 DB 中标记已归档
- 定期清理任务处理超期归档目录

### 脱敏映射存储
- 脱敏映射加密存 DB + 文件系统保留本地副本（.mappings/ 目录）
- 符合 NODE-07 需求要求

### Claude's Discretion
- 具体的 DB 表结构设计（projects、project_members、documents、versions 等）
- API 路由设计和权限中间件实现
- 版本快照的具体存储格式（JSONB 或独立表）
- Timeline 和 Diff 组件的具体实现方式
- 侧边栏导航调整（普通用户的项目入口）

</decisions>

<specifics>
## Specific Ideas

- 项目列表风格与现有管理页（用户管理、文档类型管理）保持一致
- 版本 Diff 视图参考 GitHub 的 side-by-side diff 体验
- 数据流：上传文件（文件系统）→ 解析为文本（DB）→ 中间全文本处理（DB）→ 导出生成文件（文件系统）

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Table 组件（packages/frontend/src/components/ui/Table.tsx）：项目列表、文档列表复用
- Modal 组件（packages/frontend/src/components/ui/Modal.tsx）：成员选择器、项目创建表单
- Badge 组件（packages/frontend/src/components/ui/Badge.tsx）：可见性状态标签
- Pagination 组件（packages/frontend/src/components/ui/Pagination.tsx）：列表分页
- SearchInput 组件（packages/frontend/src/components/ui/SearchInput.tsx）：项目/文档搜索
- Toast 组件（packages/frontend/src/components/ui/Toast.tsx）：操作反馈

### Established Patterns
- Drizzle ORM + pgTable 定义 schema（packages/backend/src/db/schema.ts）
- 模块化后端服务：routes.ts + service.ts per module
- SolidJS + Tailwind CSS 前端
- Bearer Token 认证 + localStorage

### Integration Points
- users 表：项目成员关联、文档创建者
- documentTypes 表：文档创建时选择文档类型
- workflows 表：文档创建时选择流程
- 侧边栏导航（packages/frontend/src/components/nav/）：需增加项目入口

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-project-document-version-file-system-infrastructure*
*Context gathered: 2026-03-20*
