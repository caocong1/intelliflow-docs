# Phase 13: Document Runtime Refactor — Align with Phase 12 Editor - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the document creation runtime (workspace UI, all 5 node executors, orchestration services) to align with Phase 12's restructured shared types, flow engine, and config panel changes. Users must be able to create documents and execute workflows end-to-end with workflows created in the new editor. PPT export is deferred.

</domain>

<decisions>
## Implementation Decisions

### 配置传递与数据流

- **配置加载方式**: 修改 `/runtime/:docId/init` 接口，在 `DocumentRuntimeState` 中一次性返回 workflowNodes（含 config），前端按 nodeId 匹配传给执行器。不再传 `{} as Config` 空对象。
- **节点间数据流转**: 各后端 service 按业务逻辑自己查上游 outputData（保持现有模式），仅修复 export 节点的数据结构查找 bug（`models` Record 而非 `modelOutputs` Array）。
- **变量引用解析**: 统一使用 `nodeId + outputId` 格式替代 `{{nodeLabel.outputName}}`。promptTemplate 改为 `{{nodeId.outputId}}`，后端 resolvePromptTemplate 按 nodeId 查找 nodeExecution，从 outputData 取对应字段。稳定不受 label 重命名影响。
- **模型调用日志**: 新建独立 `model_call_logs` 表，记录：resolvedPrompt（完整提示词）、promptTemplate（原始模板）+ variableMapping（变量映射详情）、modelId/modelName/temperature/maxTokens 等参数、responseStatus/contentLength/tokenUsage/duration。日志查看入口放在管理后台独立日志页面（可按文档/时间/模型筛选）。

### 各节点执行器适配

- **UI 优化方式**: 所有 5 个执行器使用 Stitch MCP（`GEMINI_3_1_PRO` 模型）生成设计稿参考，确认风格后再写 SolidJS + Tailwind 代码实现。
- **全面中文化**: 所有执行器 UI 文案改为中文（按钮、标签、提示、错误信息等），当前英文界面完全不可接受。
- **输入转换节点**: 功能逻辑已对齐（field.id 作为 key），仅做 UI 中文化 + Stitch 设计优化。
- **脱敏节点**: 进入节点时**自动触发检测**（不需手动点按钮），检测完成直接进入审核阶段。保留「重新检测」按钮供手动触发。UI 用 Stitch 重新设计。
- **模型调用节点**: 保持现有流程（SSE 流式、多模型并行、tab 切换、重试、选择），用 Stitch 重新设计 UI。
- **恢复节点**: 保持现有流程（左右对比、失败项手动纠正），UI 中文化 + Stitch 设计优化。
- **导出节点**: 保持现有流程，修复 resolveContent 查找上游模型输出的 bug，UI 中文化 + Stitch 设计优化。前端隐藏 PPT 选项（后端未实现）。

### 状态持久化与幂等性

- **状态恢复**: 完全从 DB 恢复。刷新页面后根据 nodeExecution 的 status 判断：pending→等待、in_progress→恢复到当前阶段、completed→只读展示。不重新触发任何请求。
- **后端状态机防重**: 模型调用等耗时操作在 outputData 中记录状态（pending/streaming/completed/failed）。前端重进时：completed 直接显示结果、streaming 轮询 `/status` 接口、failed 显示重试按钮。**绝不重复发起调用**。
- **SSE 中断恢复**: 后端模型调用独立于 SSE 连接运行（前端断开不中断后端调用）。前端重进时轮询 status，streaming 时显示「模型生成中...」加载态，完成后直接显示最终结果。
- **文档列表显示进度**: 文档列表中 in_progress 文档显示进度条 + 当前节点名（如「3/5 模型调用」）。

### 文档创建到执行入口

- **创建流程**: 保持现有弹窗创建流程（选文档类型→选工作流→填标题→创建），增加**工作流预览**：选中工作流后显示节点列表+类型图标、简要流程图、节点数量+预估步骤、工作流描述/备注。用 Stitch 设计预览 UI。
- **执行中文档（需人工参与）**: 直接进入 DocumentWorkspace，stepper 自动定位到 in_progress 节点，用户可立即操作。
- **已完成文档**: 进入工作区只读模式，所有节点可查看输出。每个节点加「从此重新执行」按钮，点击后确认弹窗（提示后续节点会重置），确认后 rollback 并进入执行模式。
- **重新执行版本化**: rollback + 重新执行时创建**新的 nodeExecution 行**（不覆盖旧记录），保留所有历史执行版本。节点内可通过下拉切换查看不同次执行的结果，方便对比。

### 错误处理与恢复机制

- **模型调用失败**: 失败的模型显示清晰中文错误信息（网络超时、API 报错、模型不可用等），加重试按钮。多模型时其他成功的模型不受影响。
- **网络断开**: 显示「网络连接已断开」提示栏，自动尝试重连，恢复后提示「已重新连接」。进行中的操作（如 draft save）排队等网络恢复后重发。
- **自动保存**: 所有可编辑节点（输入转换、脱敏审核、恢复纠正等）统一使用 1.5s 防抖 draft save，显示「已保存」状态。

### Claude's Discretion

- Stitch 设计稿的具体布局和视觉细节
- model_call_logs 表的具体字段类型和索引设计
- 版本化 nodeExecution 的 round/version 字段命名和数据结构
- 网络重连的具体实现方式（轮询间隔、最大重试次数等）
- 进度条在文档列表中的具体样式
- 工作流预览的简要流程图渲染方式

</decisions>

<specifics>
## Specific Ideas

- 用 Stitch MCP 的 `GEMINI_3_1_PRO` 模型生成设计稿，这是 Stitch 支持的最强模型
- 模型调用日志是为了调试变量引用是否正确映射——能看到最终发给模型的完整提示词
- 已完成文档要能从任意节点重新执行，类似「从这里重新跑一遍」
- 每次重新执行的结果都要保留，可以对比不同次生成的质量

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runtime.service.ts`: 核心编排（init/advance/rollback/skip/draft），topologicalSort 已实现
- `model-call.service.ts`: SSE 流式调用、多模型并行、重试、选择——逻辑完整
- `desensitize.service.ts`: 已适配 categories 结构，detectViaModel/detectViaRegex 可用
- `export.service.ts`: Word/PDF/Markdown 生成可用，需修复 resolveContent 数据结构查找
- 5 个前端 Executor 组件: 功能逻辑基本正确，主要需要 UI 重写和中文化
- `StepperBar`, `NodeHistoryPanel`, `InlineEditor`: workspace 组件可复用
- `/status` 轮询接口: model-call.routes.ts 已有 GET status endpoint

### Established Patterns
- 后端: Elysia + Drizzle ORM + PostgreSQL，Bearer token auth
- 前端: SolidJS + Tailwind CSS，Eden Treaty API client
- 数据交换: jsonb 存储 outputData/inputData，前端 cast 为具体类型
- 文件上传: XHR + progress tracking（InputTransformExecutor 模式）

### Integration Points
- `DocumentWorkspace.tsx`: 主编排页面，需重写配置加载逻辑
- `runtime.routes.ts`: init/advance 接口需扩展返回 workflow config
- `ProjectHome.tsx`: 文档创建入口，需添加工作流预览
- `packages/shared/src/types.ts`: WorkflowNodeDef、NodeConfig 等共享类型
- `packages/backend/src/db/schema.ts`: 需添加 model_call_logs 表，可能需要 nodeExecution 支持版本化

</code_context>

<deferred>
## Deferred Ideas

- PPT 导出格式支持 — 单独 phase
- 管理后台模型调用日志查询页面可以后续迭代增强（如图表统计、导出日志等）
- 取消正在进行的 AI 生成（RECV-03）— 已在 Phase 5 明确 deferred to v2

</deferred>

---

*Phase: 13-document-runtime-refactor-align-phase12*
*Context gathered: 2026-03-21*
