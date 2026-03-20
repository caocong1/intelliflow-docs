# Phase 5: Document Creation Runtime - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

用户创建文档后，按流程逐节点执行完整的文档生成流程——从输入转换、信息脱敏、模型调用、信息恢复到文件导出。包含工作台 UI、5 种节点执行器、多模型流式输出、通用操作和失败恢复。

Phase 3 流程编辑器的节点配置基本不可用，Phase 5 需要补全运行时所需的节点配置字段（autoAdvance、allowEdit、skippable、modelIds[]）。

</domain>

<decisions>
## Implementation Decisions

### 工作台布局
- 顶部水平步骤条展示流程进度（已完成/进行中/待执行状态标记）
- 点击步骤条已完成节点，操作区切换为只读模式展示该节点的输入输出
- 固定底部操作栏：左侧"回退"，右侧"跳过"和"确认/下一步"
- 创建文档后直接跳转进入工作台，文档详情页也有"进入工作台"按钮可继续

### 输入转换节点
- 支持多文件上传，每个文件显示解析进度条/动画
- 每个文件解析完成后可单独点开查看和编辑
- 文件解析内容直接存数据库（与 AI 生成输出的存储方式一致）

### 脱敏节点交互
- 文本中敏感信息行内高亮标记（如黄色背景）
- 右侧列表展示所有识别项，用户可逐条取消勾选或手动添加
- 最后一键确认脱敏
- 脱敏规则（类型描述，不含真实值）后台静默注入后续模型调用节点提示词，用户无感知

### 模型调用节点
- 单模型/多模型模式由流程编排时管理员配置决定，运行时用户不切换
- Markdown 富文本渐进展示（实时渲染），顶部状态标签显示当前阶段（等待中→思考中→生成中→完成/失败）
- 多模型时：Tab 切换查看各模型输出 + 可选择任意两个模型进入左右分栏对比视图
- 可选择一个或多个模型输出作为本节点输出，后续节点按流程配置中的变量引用指定使用哪个输出
- 失败时显示错误消息 + 手动重试按钮，失败模型不影响已成功的其他模型输出
- 不做取消 AI 生成功能（RECV-03 延迟到后续版本）

### 信息恢复节点
- 左右分栏 Diff 高亮对比：左侧脱敏版（占位符），右侧恢复版（真实值）
- 已恢复位置绿色高亮，恢复失败位置红色高亮
- 失败项支持行内编辑修正，全部处理完才能进入下一步
- 可复用现有 VersionDiff 组件的模式

### 文件导出节点
- 页内实时预览导出效果（Word/PDF 渲染、Markdown 直接渲染）
- 系统默认生成文件名（如"文档标题_日期.docx"），用户可编辑修改
- 确认后下载，导出文件存储在工作目录 export/ 下

### 节点通用操作
- 流程编排时管理员配置节点是"自动进入下一步"还是"用户手动点下一步"
- 自动流转节点完成后直接跳转，不停留
- 回退到之前节点时保留后续节点输出（标记为"待重新执行"），用户可选择是否重新执行
- 内联编辑器为 Markdown 所见即所得编辑器（不展示源码），编辑权限由流程编排时按节点配置
- 修改即自动保存（不是定时），用户重新打开文档自动恢复到上次状态
- 支持 Ctrl+Z 等快捷键撤回操作

### 流程编排节点配置补全
- 所有节点通用：`autoAdvance: boolean`（自动/手动流转）、`allowEdit: boolean`（允许手动编辑）、`skippable: boolean`（是否可跳过）
- 模型调用节点：`modelIds: string[]`（支持多模型配置）替代原来的单个 `modelId`
- 模型调用超时时间放在 Provider 级别配置，不在单个节点上配置

### Claude's Discretion
- 步骤条的具体视觉样式（颜色、图标、动画）
- 解析进度条/动画的具体实现
- 多文件上传的并发策略
- 自动保存的防抖间隔
- 恢复 Diff 组件的具体实现细节
- 导出预览的具体渲染方案

</decisions>

<specifics>
## Specific Ideas

- 脱敏确认界面类似代码审查的行内标注体验：左侧文本高亮，右侧列表可勾选
- 模型调用的 Tab 切换 + 对比视图，类似多文件编辑器的 Tab 体验
- 文件解析内容存储方式与 AI 生成输出一致，统一数据模型
- Phase 3 节点配置基本不可用，Phase 5 需要同时补全流程编辑器中的节点配置 UI

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VersionDiff` 组件：可作为恢复节点 Diff 对比的基础
- `Timeline` 组件：可用于步骤条的参考
- `Badge` 组件：可用于节点状态标记
- `Modal` 组件：可用于回退确认等弹窗
- `Toast` 组件：可用于自动保存提示

### Established Patterns
- SolidJS + TailwindCSS 前端，Elysia + Drizzle 后端
- 文档状态枚举：draft / in_progress / completed
- 工作空间目录结构：uploads/{docId}、exports/{docId}、.mappings/{docId}
- 文件索引：`insertDocumentFile` + `listDocumentFiles` 已实现
- 版本快照：`documentVersions` 表，按 nodeId + versionNumber 存储

### Integration Points
- `createDocument` → `createDocumentWorkspace` 已经在创建文档时自动创建工作目录
- 流程定义（nodes/edges JSONB）从 `workflows` 表读取，运行时按定义执行
- Provider 系统支持 OpenAI-compatible API，模型参数（temperature、maxTokens、topP）已在 models 表
- 文档路由 `/documents/:id` 已有详情页，需新增工作台路由

</code_context>

<deferred>
## Deferred Ideas

- **Phase 3 节点配置修复**：Phase 3 流程编辑器中节点配置和连线基本不可用，需单独修复（Phase 3 范围）
- **取消 AI 生成**（RECV-03）：延迟到后续版本
- **Provider 超时配置 UI**：Provider 管理页面需要添加超时配置字段（Phase 2 范围的增量）

</deferred>

---

*Phase: 05-document-creation-runtime*
*Context gathered: 2026-03-20*
