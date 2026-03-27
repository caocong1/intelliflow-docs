# Phase 26: Conditional Node Execution - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable nodes to be automatically skipped or blocked based on upstream output values. Users configure execution rules (conditions + action) on nodes; the runtime evaluates them before entering a node. Covers: condition configuration UI, runtime evaluation logic, blocked/skipped node display, rollback interaction, and background execution support.

</domain>

<decisions>
## Implementation Decisions

### 条件配置 UI
- 在现有节点配置面板（如 ModelCallConfig、ExportConfig）**底部增加「执行条件」折叠面板**，未配置时折叠收起不占空间
- 折叠面板内使用**行式规则构建器**：每个条件一行，`[上游变量选择器] [运算符下拉] [值输入]`，可点击「+」添加多个条件，顶部选择 AND/OR 逻辑
- 变量选择器**复用现有 VariablePicker 组件**，保持一致的变量浏览体验
- **所有 5 种节点类型**都可以配置执行条件（输入转换、信息脱敏、模型调用、信息恢复、文件导出）

### 阻断节点 UX
- 左侧节点列表中，被阻断的节点显示**红色「已阻断」标签**，与现有 completed/skipped/failed 标签保持一致风格
- 「返回修改上游」按钮点击后，**弹出确认框**说明回退会清除中间节点的输出，用户确认后再执行 rollbackToNode
- 阻断展示样式和阻断原因详细度：Claude's Discretion

### Skip vs Block 语义
- 使用**中文命名 + 描述**区分：「跳过」= 条件满足时自动跳过此节点，继续下一步；「阻断」= 条件满足时停止流程，必须修复后才能继续
- 新建执行规则时，**不预设默认动作**，用户必须显式选择「跳过」或「阻断」，避免误操作
- 被跳过的节点显示**灰色「已跳过」标签 + 跳过原因**（哪个条件触发）
- 手动跳过（skippable）和条件跳过（skip action）通过**状态文案区分**：手动跳过显示「用户跳过」，条件跳过显示「条件跳过：XXX」

### 条件值输入
- 比较值使用**文本输入框 + 智能提示下拉**，根据所选变量的历史输出值或预定义常用值提供建议
- 智能提示数据来源：Claude's Discretion（可结合历史值和预定义常用值）
- exists/not_exists 运算符的值输入框处理：Claude's Discretion

### Claude's Discretion
- 阻断节点内容区域的展示样式（内联警告卡片 vs 全屏阻断页 vs 其他）
- 阻断原因的信息详细度（简洁描述 vs 完整条件列表）
- exists/not_exists 运算符时值输入框的交互处理
- 智能提示的具体数据来源策略

</decisions>

<specifics>
## Specific Ideas

- 条件执行的核心场景是**质检阻断**：质检节点输出 `hasBlockingIssues: true` → 导出节点配置 block 条件 → 阻断并提示用户返回修改
- 行式规则构建器的交互体验类似筛选器/查询构建器
- 运算符支持：equals / not_equals / exists / not_exists / contains（仅字符串比较，不支持数值比较或正则）

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VariablePicker` (`packages/frontend/src/components/workflow/prompt/VariablePicker.tsx`): 变量选择器组件，可直接复用于条件配置中的变量引用
- `PromptEditor` (`packages/frontend/src/components/workflow/prompt/PromptEditor.tsx`): 提示词编辑器，VariableRef 使用的参考
- `rollbackToNode()` (`packages/backend/src/modules/runtime/runtime.service.ts`): 已有回退逻辑，支持 executionRound 追踪
- `skipNode()` (`packages/backend/src/modules/runtime/runtime.service.ts`): 已有跳过逻辑

### Established Patterns
- `NodeExecutionStatus` 当前为 5 值联合类型 (`pending | in_progress | completed | skipped | failed`)，需扩展增加 `blocked`
- `VariableRef` 当前为 `{ nodeId, outputId, variableName }`，Phase 24 将增加 `fieldPath` 支持（Phase 26 依赖 Phase 24）
- 每种节点类型有独立的配置组件（`ModelCallConfig`、`ExportConfig` 等），执行条件折叠面板需作为通用组件嵌入所有配置面板
- 节点配置存储在 `WorkflowNode.config` 中，executionRule 将作为 config 的新字段

### Integration Points
- `advanceNode()` 是条件评估的核心插入点——在进入下一节点前评估 executionRule
- `background.service.ts` 的后台执行流程需同步支持条件评估，blocked 时中止流水线并发送通知
- `ConfigPanel.tsx` 是所有节点配置的入口，执行条件折叠面板在此统一挂载
- `DocumentWorkspace` 是执行界面，需处理 blocked 状态的展示和「返回修改上游」交互

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-conditional-node-execution*
*Context gathered: 2026-03-27*
