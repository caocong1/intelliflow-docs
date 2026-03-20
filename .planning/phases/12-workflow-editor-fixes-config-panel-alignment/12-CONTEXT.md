# Phase 12: Workflow Editor Fixes & Config Panel Alignment - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

修复工作流可视化编辑器，使其能够生成 Phase 5 运行时可执行的有效工作流。包括：节点/边的增删改、配置面板与运行时类型完全对齐、连接行为约束、验证完整性、撤销/恢复、实时自动保存，以及整体 UI/UX 优化。Phase 5 UAT 被阻塞直到本 phase 完成。

</domain>

<decisions>
## Implementation Decisions

### 节点与边的删除
- 键盘 Delete/Backspace 删除选中的节点或边
- 删除节点时自动删除所有连入/连出的边
- 删除前显示确认对话框
- 边的删除：点击选中边（高亮显示）+ Delete 键
- 支持框选 + Ctrl/Shift 点击多选节点，可批量移动和批量删除

### 撤销/恢复 + 实时自动保存
- 所有流程图操作（节点增删、边增删、节点移动、所有配置修改）都实时自动保存到后端
- 支持 Ctrl+Z 撤销 / Ctrl+Shift+Z 恢复，覆盖所有操作
- 右上角显示自动保存状态（"保存中..." + 动画）
- 验证按钮独立于保存，验证通过后显示"已验证"状态
- 验证通过后如果内容被修改并自动保存，验证状态重置为"未验证"

### 配置面板 ↔ 运行时对齐
- 模型调用节点：modelId 单选改为 modelIds[] 多选（checkbox 列表），直接对齐运行时数据结构
- 运行时字段 autoAdvance、allowEdit、skippable 在每个节点配置面板底部以"运行时设置"折叠区暴露，所有节点通用
- 全面检查所有 5 个节点配置面板，确保共享类型中的每个字段在 UI 中都有对应输入控件
- 配置面板样式一致性：交给 ui-ux-pro-max 审查并统一各节点配置面板的字段间距、标签样式、分组方式
- 节点名称（label）确保正确传递给运行时

### 输入转换节点改进
- "表单字段"改名为"用户输入项"
- 去掉英文字段名（name），自动从显示标签（label）生成
- 输入转换的输出配置与具体设置一一对应：每个单行/多行文本字段对应 1 个输出，文件上传对应动态输出

### 节点输出自动生成
- 移除手动 OutputsEditor，输出完全从配置自动派生
- 输入转换：每个文本字段 → 1 个输出；文件上传 → 显示"文件输出 (动态)"，运行时按实际上传数量展开
- 模型调用：每个选中的模型 → 1 个输出
- 脱敏：固定 1 个输出（脱敏后文本）
- 恢复：固定 1 个输出（恢复后文本）
- 导出：固定 1 个输出（导出文件）

### 脱敏节点配置
- 管理员添加脱敏类别（如"公司名称"、"人名"、"电话号码"）
- 每个类别填写：类别名称 + 描述（用于生成脱敏提示词）
- 占位符格式系统内定（如 [COMPANY_1]、[PERSON_1]），管理员不可自定义
- 系统自动生成脱敏提示词，告诉本地模型要脱敏哪些类别

### 导出节点
- 导出格式增加 PPT，变为 word/pdf/markdown/ppt
- 导出节点不需要用户输入内容，内容来自上游节点输出（通过 contentMapping 引用）

### 提示词优化功能
- 模型调用配置中，提示词编辑器旁加"优化提示词"按钮
- 点击后调用 AI 模型优化当前提示词
- 用户可选择用哪个模型做优化
- 支持自定义优化指令（meta-prompt），系统内置默认优化指令

### 变量系统改名
- 提示词编辑器中"变量"概念改名为"节点输出"
- 显示为"插入 [xxx节点名] 的输出"，与 Phase 5 运行时一致

### 连接行为
- 强制线性流程：每个节点最多 1 个输入连接 + 1 个输出连接
- 新连接自动替换旧连接（保持线性）
- 自动连接：拖放新节点时连接到最近的没有输出线的节点，如果没有则不自动连接
- 连接时不限制兼容性验证，保存时统一验证
- 节点连接点可自由设置在上下左右

### 连接线样式
- 加流动动画效果
- 支持多种线型（曲线、直线、折线）
- 连接线中间可拖拽调整形状（首尾固定）
- 交给 ui-ux-pro-max 优化整体连接线视觉

### 节点样式
- 画布上的节点外观交给 ui-ux-pro-max 统一设计（卡片样式、颜色、图标、状态指示）

### 验证完整性
- 扩展为全配置字段验证：每个节点的所有必填配置字段都参与验证
- 增加线性流程验证：每个节点最多 1 输入 + 1 输出连接
- 验证结果展示保持现状（ValidationOverlay + 节点红边框 + 点击导航）

### 节点库面板
- 交给 ui-ux-pro-max 优化视觉和交互
- 拖拽提示和反馈交给 ui-ux-pro-max 设计

### 画布交互
- 拖动节点时显示对齐辅助线
- MiniMap 中节点根据类型显示不同颜色（输入转换=蓝、脱敏=橙、模型调用=紫、恢复=绿、导出=红），与配置面板颜色体系一致
- 支持框选 + Ctrl/Shift 多选，可批量移动和删除

### 工作流元信息
- 顶部工具栏显示验证状态和上次保存时间

### Claude's Discretion
- 撤销/恢复的具体实现方案（命令模式 vs 快照 vs diff）
- 自动保存的防抖策略和频率
- 对齐辅助线的具体视觉效果和吸附距离
- 提示词优化的默认 meta-prompt 内容
- 连接线拖拽调整形状的具体交互细节
- 各节点的 autoAdvance/allowEdit/skippable 默认值

</decisions>

<specifics>
## Specific Ideas

- 连接线样式参考流程图工具的流动动画效果
- 脱敏占位符格式固定为 `[TYPE_N]`（如 [COMPANY_1]、[PERSON_1]）
- "变量"统一改称"节点输出"，与 Phase 5 运行时概念对齐
- "表单字段"改称"用户输入项"，更直观
- 自动保存状态和验证状态放在右上角工具栏

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkflowCanvas.tsx`: SolidFlow 画布封装，已有 nodeTypes/edgeTypes/fitView/minimap/controls
- `ConfigPanel.tsx`: 配置面板容器，已有 5 种节点类型的 Switch/Match 路由和 upstream 节点计算
- `DataFlowEdge.tsx`: 自定义边组件，已有数据流标签标注（annotatedEdges）
- `ValidationOverlay.tsx`: 验证错误展示组件，已有节点导航功能
- `PromptEditor.tsx` + `VariablePicker.tsx`: 提示词编辑器和变量选择器
- `OutputsEditor.tsx`: 手动输出编辑器（将被自动生成替代）
- 5 个节点配置组件: InputTransformConfig, DesensitizeConfig, ModelCallConfig, RestoreConfig, ExportConfig
- 5 个画布节点组件: InputTransformNode, DesensitizeNode, ModelCallNode, RestoreNode, ExportNode

### Established Patterns
- SolidFlow (`@dschz/solid-flow`): createNodeStore/createEdgeStore 管理状态
- 节点颜色体系: 蓝(input_transform)、橙(desensitize)、紫(model_call)、绿(restore)、红(export)
- 配置通过 `onConfigChange` 回调传递，数据流向: ConfigPanel → WorkflowEditor → nodes store
- 验证流程: 保存 → 调用 validate API → 显示 ValidationOverlay

### Integration Points
- `packages/shared/src/types.ts`: 共享类型定义（NodeConfig 联合类型，含 autoAdvance/allowEdit/skippable/modelIds）
- `packages/backend/src/modules/workflows/validation.ts`: 后端验证逻辑（需扩展全字段验证和线性流程验证）
- `buildDefaultConfig()` in WorkflowEditor.tsx: 新节点默认配置（需对齐 modelIds[]）
- Phase 5 运行时: 依赖 workflow 节点配置驱动执行，modelIds/autoAdvance/skippable 字段必须正确

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-workflow-editor-fixes-config-panel-alignment*
*Context gathered: 2026-03-20*
