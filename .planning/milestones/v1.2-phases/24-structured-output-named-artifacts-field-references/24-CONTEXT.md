# Phase 24: Structured Output + Named Artifacts + Field References - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable model call nodes to output structured JSON and multiple named artifacts, with downstream field-level variable references. Includes: `outputFormat`/`jsonSchema`/`namedOutputs` config fields, JSON validation with format_error status, `===OUTPUT:id===` delimiter parsing, named output card rendering, `resolveRef()` multi-level field path resolution, and VariablePicker tree-based field selection.

</domain>

<decisions>
## Implementation Decisions

### JSON 验证 UX
- 模型输出完成后自动触发 JSON.parse 验证，失败则立即标记 `format_error` 状态
- 配置了 `jsonSchema` 时，JSON.parse 通过后再做 Schema 级别校验（字段类型、必填字段等），两层错误分开显示
- 错误展示：在模型输出卡片顶部显示红色错误框，包含具体错误信息（如 "Line 5: Expected comma"），卡片边框变红
- 修复方式：默认提供手动编辑区 + 错误提示，同时提供"AI 修复"按钮。用户可选择自己改或让 AI 改
- AI 修复：调用模型尝试修复 JSON 格式，显示修复前后 diff 对比，用户确认后采用
- 用户修改后点击"重新验证"按钮再次检查

### 命名产物卡片渲染
- 多个命名产物按垂直卡片列表展示，每张卡片标题显示产物名称（如 "blueprint"、"clause_list"）
- 每张产物卡片内嵌现有的 InlineEditor，点击即编辑，编辑单个产物不影响其他产物
- 保存时更新对应的 `namedOutputs[id].content`
- 多模型 + 命名产物场景：先按模型分组（如 "GPT-4o" / "Claude"），每组内再垂直列出命名产物卡片。模型对比视图可按产物名称对齐
- Fallback：AI 未按 `===OUTPUT:id===...===END:id===` 分隔符格式输出时，整个输出存为单个默认产物，前端显示黄色警告条："模型未按预期格式输出，已合并为单个产物"。用户可重试或手动编辑

### JSON Schema 配置 UI
- 使用代码编辑器（Monaco/CodeMirror）让管理员直接编写 JSON Schema，有语法高亮和基础校验
- 位置：在 `outputFormat` 下拉菜单下方，当选择 "json" 时条件展示 Schema 编辑器，选 "text" 或 "markdown" 时隐藏
- `jsonSchema` 为可选字段：不填则只做 JSON.parse 语法校验，填了则额外做 Schema 结构校验
- 当 `jsonSchema` 存在时，系统自动在提示词末尾追加 Schema 指导，类似现有的脱敏规则注入机制

### 字段引用选择器
- 当上游节点配置了 `jsonSchema` 时，VariablePicker 显示可展开的树形结构，点击叶子节点自动生成完整路径（如 `{{n3.clause_list.items[0].name}}`）
- 无 jsonSchema 时的处理方式由 Claude 根据实现复杂度决定
- 数组索引支持固定索引（`items[0]`）和遍历语法（`items[*].name`），遍历返回数组
- `fieldPath` 语法：`key(.key)*([index](.key)*)*`，其中 `[*]` 为遍历标记

### Claude's Discretion
- 代码编辑器具体选型（Monaco vs CodeMirror 等）
- AI 修复 JSON 的具体调用策略（用哪个模型、提示词设计）
- 无 jsonSchema 时字段引用的降级策略
- 卡片间距、错误框样式等视觉细节
- `[*]` 遍历的具体实现方式

</decisions>

<specifics>
## Specific Ideas

- JSON Schema 自动注入提示词的机制类似现有的脱敏规则注入（`resolvePromptTemplate` 末尾追加）
- 命名产物卡片风格应与现有的模型输出卡片保持一致
- format_error 是 `ModelOutput.status` 的新枚举值，与现有 completed/error 状态并列

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ModelCallCompleted.tsx` / `ModelCompareView.tsx`: 现有模型输出渲染组件，需扩展支持命名产物
- `InlineEditor`: 已有的行内编辑器，每张产物卡片可直接复用
- `VariablePicker.tsx` / `PromptEditor.tsx`: 现有变量选择器和提示词编辑器，需扩展支持树形结构和字段路径
- `resolvePromptTemplate()` (model-call.service.ts L20-57): 现有模板解析，需扩展支持多级路径

### Established Patterns
- 脱敏规则注入：`resolvePromptTemplate` 末尾追加规则文本 → JSON Schema 注入可复用此模式
- `ModelCallConfig` 扩展：已有 `modelIds`/`modelNames`/`promptTemplate` 字段 → 新增 `outputFormat`/`jsonSchema`/`namedOutputs` 字段
- `VariableRef` 结构：已有 `nodeId`/`outputId`/`variableName` → 新增 `fieldPath` 字段
- 多模型并行：`model-call.service.ts` 使用 `Promise.allSettled` → 命名产物解析在每个模型输出完成后进行

### Integration Points
- `types.ts`: `ModelCallConfig` 新增字段、`VariableRef` 新增 `fieldPath`、`ModelOutput.status` 新增 `format_error`
- `model-call.service.ts`: `resolvePromptTemplate` 扩展多级路径解析 + Schema 注入
- `model-call.routes.ts`: 模型输出后触发 JSON 验证逻辑
- `derive-outputs.ts`: 为命名产物生成 OutputDef（含 segmentKey）
- 前端配置面板：模型调用节点配置新增 outputFormat/jsonSchema/namedOutputs 区域

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-structured-output-named-artifacts-field-references*
*Context gathered: 2026-03-27*
