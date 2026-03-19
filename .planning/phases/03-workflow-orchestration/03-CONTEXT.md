# Phase 3: Workflow Orchestration - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

管理员可以为文档类型创建、编排、校验和管理文档生成流程。通过可视化拖拽编辑器组合 5 种基础节点类型（输入转换、信息脱敏、模型调用、信息恢复、文件导出），配置各节点参数，定义节点输出并在下游提示词中引用，系统校验流程合理性。支持流程的启用/停用、编辑、删除、复制和默认流程设置。

</domain>

<decisions>
## Implementation Decisions

### 流程编辑器交互
- 拖拽画布形态，类似 n8n / ComfyUI 的节点画布
- 添加节点方式：左侧节点库面板拖入画布 + 画布右键/按钮菜单选择添加，节点库可收起
- 节点连接：添加节点时默认自动连接到上一个节点，同时支持手动移除连线和拖拽连线调整
- 节点卡片简洁模式：节点类型图标 + 节点名称 + 配置状态标记（已配置/未配置），点击展开右侧配置面板查看详情

### 节点配置方式
- 点击节点后右侧滑出配置面板，画布和配置同时可见，不遮挡流程视角
- 节点输出概念为「内容块」（md 文本），不在 UI 上强调"文件"概念。用户只需「添加输出」并命名
- 提示词编辑器中引用上游输出以 tag 标签形式内联展示（不同来源节点不同颜色）
- 插入引用方式：输入 `{{` 触发或点击插入按钮，弹出按来源节点分组的下拉菜单，选择后插入为 tag
- 系统变量（如脱敏规则、输出目录）也以 tag 展示，与节点输出 tag 用不同颜色区分

### 流程校验与反馈
- 保存时统一校验，编辑过程中不干扰
- 校验错误以列表形式展示（画布上方/下方），同时对应节点边框变红高亮
- 点击错误列表项可定位到对应节点
- 允许草稿保存：校验未通过也可保存为草稿状态，但不能启用为可用流程

### 流程管理列表
- 表格列表布局，与现有用户管理/文档类型管理页面风格一致
- 筛选：顶部文档类型下拉筛选 + 关键词搜索框（按流程名称搜索）
- 默认流程标记：表格行内用 Badge 标记「默认」，操作菜单中提供「设为默认」选项
- 流程复制支持跨文档类型：复制时可选择目标文档类型

### Claude's Discretion
- 拖拽画布的具体技术选型（React Flow 或其他库）
- 节点卡片的具体视觉设计（颜色、阴影、尺寸）
- 配置面板的宽度和动画效果
- 流程预览（节点流转图和文件流向）的展示形式
- 各节点类型配置表单的具体字段布局

</decisions>

<specifics>
## Specific Ideas

- 提示词中引用上游输出的 tag 标签可点击预览该输出的定义（名称、类型等）
- 每个节点定义的输出就是内容（md文本），下游节点在提示词中选择引用即可，形成清晰的数据流
- 流程编辑器的节点连接要体现数据流向——从输出端口到输入端口的箭头连线

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Modal` 组件：可用于流程创建/复制弹窗
- `Table` + `Pagination` 组件：流程管理列表页直接复用
- `SearchInput` 组件：流程搜索功能复用
- `Badge` 组件：默认流程标记、节点状态标记
- `Toast` 组件：保存成功/失败提示

### Established Patterns
- 管理页面模式：表格列表 + 搜索/筛选 + 操作按钮（UserManagement、DocumentTypeManagement 已建立）
- 后端模块化：`packages/backend/src/modules/` 下独立模块（auth、providers、models 等）
- Drizzle ORM schema：`packages/backend/src/db/schema.ts` 统一定义
- 共享类型：`packages/shared/src/types.ts` 前后端共享接口定义

### Integration Points
- `documentTypes` 表：流程与文档类型通过外键关联
- `models` 表：模型调用节点需要引用已配置的模型列表
- 管理页面路由：`packages/frontend/src/pages/admin/` 下新增流程管理页
- 侧边栏导航：`packages/frontend/src/components/nav/` 中添加流程管理入口

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-workflow-orchestration*
*Context gathered: 2026-03-19*
