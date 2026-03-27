# Phase 25: Export Table Rendering + System Prompt Separation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

两项升级：（1）Word/PDF 导出支持 Markdown 表格、有序列表、嵌套列表、代码块的富文本渲染；（2）模型调用节点支持 System Prompt 与 User Prompt 分离，前端配置、后端 API 调用、日志记录全链路贯通。

</domain>

<decisions>
## Implementation Decisions

### 表格渲染风格
- Word 导出使用商务正式风格：全边框、表头行加粗+灰色底色、内容行交替底色
- PDF 导出同步升级，支持相同的表格渲染能力
- 两种导出格式能力保持一致

### 列表支持
- 支持有序列表（1. 2. 3.）
- 支持三层嵌套列表（包括混合嵌套，如无序内嵌有序）
- Word 和 PDF 都支持

### System/User Prompt 前端 UX
- 使用可展开折叠式布局：System Prompt 折叠，User Prompt 始终可见
- System Prompt 为空时隐藏，显示"+ 添加 System Prompt"按钮
- System Prompt 有值时折叠状态显示前 50 字摘要
- 两个 Prompt 文本框都支持 `{{nodeId.outputId}}` 变量插入（VariablePicker + PromptEditor）

### 向后兼容
- 现有工作流的 `promptTemplate` 自动视为 `userPromptTemplate`（即 User Prompt）
- `systemPromptTemplate` 留空，行为完全不变
- 无需数据迁移脚本，代码层面兼容处理

### Prompt 模板解析行为
- 脱敏规则描述仅注入到 User Prompt 末尾，System Prompt 保持纯净
- System Prompt 为空时，API 仅发送 `[{role:"user", content:...}]`，与当前行为一致
- System Prompt 有值时，发送 `[{role:"system",...}, {role:"user",...}]` 双消息
- 复用现有 `resolvePromptTemplate()` 函数，分别对 systemPromptTemplate 和 userPromptTemplate 各调用一次
- 脱敏规则仅在解析 User Prompt 时注入

### API 策略适配
- OpenAI Compatible 策略：使用 `[{role:"system",...}, {role:"user",...}]` messages 数组
- Claude/Anthropic 策略：使用顶层 `system` 参数 + `[{role:"user",...}]` messages（Anthropic 原生方式）
- 各策略按原生 API 最佳实践处理，不强制统一

### 日志展示
- 模型调用日志详情分段展示：「System Prompt」和「User Prompt」各为可折叠段
- 无 System Prompt 时不显示该段
- DB modelCallLogs 表新增独立 `systemPrompt` 字段，与现有 `prompt` 字段并列

### Claude's Discretion
- 代码块渲染方案（灰底等宽字体 vs 纯等宽字体）
- PDF 表格的具体绘制实现
- `prompt` 字段是否重命名为 `userPrompt`（需评估影响面）
- 日志折叠段的具体 UI 细节

</decisions>

<specifics>
## Specific Ideas

- 表格风格参考正式投标文档：全边框、表头突出、行交替色，让输出文档看起来专业
- System Prompt 的典型用途是设定 AI 角色和写作风格（如"你是一个专业的投标文件写作专家"），而 User Prompt 承载具体任务指令和变量数据
- 折叠式 System Prompt 设计的出发点：大多数用户可能只用 User Prompt，System Prompt 是高级功能，不应增加初始界面复杂度

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolvePromptTemplate()` (`model-call.service.ts` L20-76): 变量解析 + 脱敏注入，可直接复用于双 Prompt 场景
- `parseMarkdownToParagraphs()` (`export.service.ts` L96-145): 当前 Word 渲染入口，需扩展支持表格/有序列表/嵌套列表/代码块
- `parseInlineFormatting()` (`export.service.ts` L147-170): 行内格式解析（加粗/斜体），可在表格单元格内复用
- `PromptEditor` + `VariablePicker` 前端组件：已有变量选择和提示词编辑能力，需为 System Prompt 创建第二个实例

### Established Patterns
- Strategy 模式 (`OpenAICompatibleStrategy` / `ClaudeAgentSDKStrategy`): 各自独立实现 API 调用，新增 system prompt 支持需在两个策略中分别适配
- `docx` 库已引入 (`Document`, `Paragraph`, `TextRun`, `HeadingLevel`)，表格渲染需新增引入 `Table`, `TableRow`, `TableCell`, `BorderStyle` 等
- PDFKit 已引入，表格需使用其绘图 API

### Integration Points
- `ModelCallConfig` 类型 (`types.ts` L155-168): 需新增 `systemPromptTemplate?: string` 字段
- `modelCallLogs` DB schema: 需新增 `systemPrompt` 列
- `ModelCallConfig.tsx` 前端组件: 需新增折叠式 System Prompt 编辑区
- `ModelCallLogs.tsx` 前端页面: 需适配双 Prompt 日志展示

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-export-table-rendering-system-prompt-separation*
*Context gathered: 2026-03-27*
