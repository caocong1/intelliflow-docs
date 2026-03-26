# Phase 20: Search + Favorites + Recent Access - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以通过全局搜索快速查找平台上的文档、项目和工作流；通过收藏功能标记常用资源；通过自动记录的最近访问历史快速回到之前的工作。三个功能各自有独立页面和侧边栏菜单入口，仪表盘嵌入摘要卡片。

</domain>

<decisions>
## Implementation Decisions

### 全局搜索
- 侧边栏添加独立"搜索"菜单项，点击进入 /search 页面
- 搜索范围：文档（按标题/描述）、项目（按名称/描述）、工作流（按名称）
- 搜索结果按"项目""文档""工作流"分类分组展示
- 每组默认显示 3 条，有更多时显示"查看全部 N 条结果"可展开
- 不加额外的类型筛选器，保持简洁
- 输入即搜 + 300ms 防抖，复用已有 SearchInput 组件的防抖逻辑
- 搜索结果严格遵循文档可见性权限

### 收藏交互
- 在项目卡片、文档列表项、工作流列表项的右上角显示星标图标
- 点击星标切换收藏/取消收藏状态（实心=已收藏，空心=未收藏）
- 三种类型都支持收藏：项目、文档、工作流（DB 已有 userFavorites 表支持）
- "我的收藏"为独立页面 /favorites，按类型分组展示（收藏的项目/收藏的文档/收藏的工作流）
- 每组按收藏时间倒序排列
- 不加排序/筛选功能，保持简洁

### 最近访问
- 进入详情页时自动记录访问（项目首页、文档工作区、工作流编辑页）
- 列表页浏览不记录为访问
- 最多保留 20 条记录，超出自动淘汰最旧的
- "最近访问"为独立页面 /recent，纯时间倒序列表展示
- 每条记录显示：名称、类型标签、访问时间

### 导航结构
- 侧边栏新增三个独立菜单项：搜索、收藏、最近访问
- 三个功能各自为独立页面（/search、/favorites、/recent）
- 仪表盘页嵌入"最近访问"和"我的收藏"摘要卡片（各显示 3-5 条），点击"查看全部"跳转对应页面

### Claude's Discretion
- 三个新菜单项在侧边栏中的具体位置（仪表盘上方/下方、分割线等）
- 搜索结果每条的具体信息展示（时间格式、状态标签等）
- 仪表盘摘要卡片的布局和样式
- 空状态设计（无搜索结果、无收藏、无最近访问）
- 搜索结果高亮匹配关键词的方式

</decisions>

<specifics>
## Specific Ideas

- 搜索页和收藏页都采用分类分组展示，保持体验一致性
- 最近访问采用纯时间序列，与搜索/收藏的分类分组形成差异化（最近访问强调"时间感"）
- 仪表盘的摘要卡片让用户无需额外点击即可快速获取常用信息

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SearchInput` 组件（packages/frontend/src/components/ui/SearchInput.tsx）：已有 300ms 防抖、清除按钮、搜索图标，可直接用于搜索页
- `Badge` 组件（packages/frontend/src/components/ui/Badge.tsx）：可用于类型标签展示
- `Pagination` 组件（packages/frontend/src/components/ui/Pagination.tsx）：可用于搜索结果分页
- `Table` 组件（packages/frontend/src/components/ui/Table.tsx）：可用于列表展示

### Established Patterns
- SolidJS + Tailwind CSS + indigo-950 主题色
- Drizzle ORM + PostgreSQL
- 模块化后端结构（packages/backend/src/modules/）
- Bearer Token 认证

### Integration Points
- 侧边栏（packages/frontend/src/components/nav/Sidebar.tsx）：需添加搜索、收藏、最近访问菜单项
- 仪表盘（packages/frontend/src/pages/Dashboard.tsx）：需嵌入摘要卡片
- DB Schema 已有 `userFavorites` 和 `userRecentAccess` 表，含 unique 约束和枚举类型
- 路由系统需新增 /search、/favorites、/recent 三个路由

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-search-favorites-recent-access*
*Context gathered: 2026-03-26*
