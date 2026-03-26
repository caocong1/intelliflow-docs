# Phase 19: Statistics & Audit Dashboard - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

管理员统计面板，提供平台使用情况的全面可视化：总览 KPI、按模型/用户/流程的维度统计、生成审计明细。支持多维度交叉筛选和时间粒度切换。仅管理员可见。

</domain>

<decisions>
## Implementation Decisions

### Dashboard 布局
- Bento 网格布局，大小不一的卡片组合，重要指标占大格
- 8 个 KPI 指标卡片：总调用次数、总 Token 消耗、活跃用户数、文档生成数、总成本估算 + 今日调用量、平均耗时、平均成功率
- KPI 卡片纯数字展示，不显示环比变化
- 默认时间范围：近 7 天，可切换到今天/近 30 天/自定义范围
- 总览页 Bento 网格包含四个图表模块：调用趋势图、模型分布图、用户 TOP 排名、最近审计记录
- 仅管理员可见，普通用户无权访问
- 侧边栏新增"统计面板"一级菜单入口

### 图表与可视化
- 基础交互：hover 显示 tooltip、点击图例显隐系列
- 不支持数据导出（CSV/Excel）
- 不需要缩放、框选等高级交互

### 下钻导航
- 总览页下方使用 Tab 切换：模型统计 | 用户统计 | 流程统计 | 审计明细
- 同一页面内切换，无需跳转到独立子页面
- 页面顶部共享筛选栏：日期范围选择 + 多维度下拉筛选（部门/项目/文档类型/流程）
- 时间粒度切换（日/周/月）使用按钮组，放在日期范围旁边
- 筛选条件在总览和各 Tab 之间共享

### 审计明细
- 与现有 ModelCallLogs 共存但分工：ModelCallLogs 保留为技术向的原始调用日志，新审计明细侧重业务视角（谁、什么流程、多少钱）
- 审计 Tab 内分两个子 Tab："按用户"视图和"按文档"视图
  - 按用户：用户列表，展开后显示该用户的文档生成记录
  - 按文档：文档生成列表（含用户信息），展开后显示各节点/模型调用明细
- 每条审计记录包含：谁生成、哪个流程、使用了哪些节点/模型、耗时、Token 数、成本

### Claude's Discretion
- 图表库选择（ECharts/Chart.js/其他，需兼容 SolidJS）
- 趋势图具体图表类型（面积图/折线图/柱状图，可按场景混用）
- 维度详情页点击单条目后的展示方式（展开行/侧边抽屉/不支持）
- 审计记录展开后是否显示完整提示词和模型输出内容

</decisions>

<specifics>
## Specific Ideas

- 用户提到希望使用 Stitch 生成原型 UI/UX 设计图
- 总览页的 Bento 网格应有现代感，大小卡片混排

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ModelCallLogs.tsx`：现有调用日志页面，含分页、搜索、状态筛选、日期范围筛选，可参考其筛选和展开交互模式
- `Table.tsx`、`Pagination.tsx`、`SearchInput.tsx`、`Badge.tsx`：现有 UI 组件可复用
- `Modal.tsx`：可用于详情弹窗

### Established Patterns
- 前端使用 SolidJS，admin 页面都在 `packages/frontend/src/pages/admin/` 下
- `modelCallLogs` 数据库表已记录：documentId、modelId、tokenUsage（prompt/completion/total）、duration、responseStatus、errorMessage
- 后端模块化结构在 `packages/backend/src/modules/` 下

### Integration Points
- 侧边栏导航需新增"统计面板"菜单项
- 后端需新增统计聚合 API（按模型/用户/流程/时间维度）
- 现有 `model-call-log.routes.ts` 提供原始日志查询，新统计 API 应独立但基于同一数据源

</code_context>

<deferred>
## Deferred Ideas

- 普通用户个人使用统计视图 — 可作为未来 phase 考虑
- 数据导出功能（CSV/Excel）— 可在后续版本补充

</deferred>

---

*Phase: 19-statistics-audit-dashboard*
*Context gathered: 2026-03-26*
