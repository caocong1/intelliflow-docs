# Requirements: IntelliFlow v1.5 AI 自动生成流程

**Defined:** 2026-04-10
**Core Value:** 用户能跑通完整流程生成高质量文档 — v1.5 把"搭建流程"这一步也让 AI 承担，管理员只需描述业务意图和输入文件，后台自动生成合法、可编辑的 `draft` 工作流
**Source Design:** `docs/design/ai-workflow-generation-plan.md` (2026-04-10, 1046 lines)

## v1.5 Requirements

Requirements for milestone v1.5 — admin-facing AI workflow generator.  Each maps to roadmap phases.

### Data Model & Schema

- [ ] **DATA-01**: 新增 `workflow_generation_jobs` 表（id、createdBy、documentTypeId、workflowName、status enum、progress、requestPayload、normalizedRequest、intentSummary、blueprintDraft、reviewReport、finalBlueprint、compiledWorkflow、validationReport、generatedWorkflowId、errorMessage、timestamps）
- [ ] **DATA-02**: `workflow_generation_jobs.status` 枚举支持 `queued / running / completed / failed / review_needed`
- [ ] **DATA-03**: `modelCallLogs.callSource` 枚举扩展 `workflow_generation`
- [ ] **DATA-04**: Drizzle migration + shared types（`WorkflowGenerationRequest`、`WorkflowBlueprintDraft`、`StageDraft`、`NormalizedGenerationRequest`、`EnrichedWorkflowBlueprint`、`FinalBlueprint`、`CompiledWorkflowDraft`）

### Backend Module Skeleton

- [ ] **GEN-01**: 新增 `packages/backend/src/modules/workflow-generator/` 模块目录 + 7 个文件（routes、service、orchestrator、compiler、validation-fix、prompts、types）
- [ ] **GEN-02**: `service` 负责 job CRUD、状态流转、摘要格式化
- [ ] **GEN-03**: `orchestrator` 按固定阶段编排 AI 生成流程，管理阶段进度，串联模型调用与结构化产物
- [ ] **GEN-04**: `prompts` 集中存放每个阶段的系统提示词和模板（不散落）

### Pipeline — Normalize & Analysis

- [ ] **PIPE-01**: 阶段 0 — 请求归一化（代码完成）：校验必填、清洗空白、生成 `machineKey`、推断 `acceptedFileTypes`、转换 "output" 文件项为命名产物需求、输出 `NormalizedGenerationRequest`
- [ ] **PIPE-02**: 阶段 1 — 需求分析 AI 调用：输出 `intentSummary / inputStrategy / artifactStrategy / riskList`，判断是否需要脱敏链路与多阶段生成

### Pipeline — Blueprint Generation

- [ ] **PIPE-03**: 阶段 2 — 蓝图架构生成 AI 调用：输出 `WorkflowBlueprintDraft`（`inputFields`、pre-restore stages、restore sources、post-restore stages、export plan），保证线性链路
- [ ] **PIPE-04**: 阶段 3 — 提示词与产物细化 AI 调用：为每个 stage 生成 system+main prompt、补齐 namedOutputs `outputPrompt`、JSON 输出补齐 `simpleFields` 或 `jsonSchema`、补齐 `stepDescription`，输出 `EnrichedWorkflowBlueprint`

### Pipeline — Review & Revision

- [ ] **PIPE-05**: 阶段 4 — 结构评审 AI 调用（第二套模型）：检查输入覆盖、文件分组映射、命名产物、prompt 质量、export plan、引擎约束，输出 `reviewReport / revisionInstructions`
- [ ] **PIPE-06**: 阶段 5 — 蓝图修订 AI 调用（1-2 轮）：根据评审意见修订蓝图，输出 `FinalBlueprint`

### Blueprint Compiler

- [ ] **COMP-01**: 阶段 6 — 确定性编译器（代码完成）：将 `FinalBlueprint` 编译为 `nodes/edges`，复用 demo workflow builder 思路，统一插入脱敏/恢复/导出节点
- [ ] **COMP-02**: 输入字段编译：`fileGroups/files` → `FormFieldDef[]`，input 文件项 → `type: "file"`，必填/数量/类型/`machineKey/fileSlotId/fileSlotLabel` 映射
- [ ] **COMP-03**: 阶段节点编译：稳定 id、label、displayName、非空 promptTemplate、namedOutputs id 唯一、JSON 输出附 `simpleFields` 或 `jsonSchema`
- [ ] **COMP-04**: 恢复源与导出映射编译：`restoreSources` 指向待导出命名产物、`export.contentMapping` 仅选真正需进入最终文档的内容、保守推荐导出格式（`word/pdf/markdown/pptx`）

### Validation-Fix Loop

- [ ] **VFIX-01**: 阶段 7 — 调用现有 `validateWorkflow()`，校验通过则结束
- [ ] **VFIX-02**: 校验失败：将 error 结构化为 repair instruction，让修复 AI 修改蓝图（不直接改最终 workflow），重新编译再校验
- [ ] **VFIX-03**: 修复轮数上限 3 轮，超出标记 job 为 `review_needed` 并保留完整错误堆栈
- [ ] **VFIX-04**: 阶段 8 — 落库与摘要生成（代码完成）：创建 `draft` workflow、保存 job 中间产物、输出摘要（输入项、文件组映射、阶段节点、命名产物、导出、warnings/assumptions）

### API Endpoints

- [ ] **API-01**: `POST /workflow-generator/jobs` — 创建生成任务，返回 `{ jobId, status }`
- [ ] **API-02**: `GET /workflow-generator/jobs/:id` — 查询任务详情（状态、进度、阶段名、摘要、warnings、生成 workflow 概览）
- [ ] **API-03**: `GET /workflow-generator/jobs` — 查询任务列表（管理端近期生成记录）
- [ ] **API-04**: `POST /workflow-generator/jobs/:id/regenerate` — 保留原输入，重跑生成链路
- [ ] **API-05**: 所有端点使用 `requireAdmin` 权限，Eden Treaty typed wrappers 对齐 v1.4 TSQL 模式

### Model Role Binding

- [ ] **MROLE-01**: 5 角色模型绑定（`analysis / blueprint / prompt / review / repair`），持久化到配置表或系统设置
- [ ] **MROLE-02**: 默认策略"所有角色同一模型"，管理员可在设置面板单独覆盖每个角色
- [ ] **MROLE-03**: 管理端设置 UI — 在 AI Provider 配置区域新增"AI 生成流程角色映射"面板

### Frontend Wizard

- [ ] **WIZ-01**: 新增管理端菜单"AI 自动生成流程" + 路由 `/admin/workflow-ai`（保留现有"新建流程"入口不变）
- [ ] **WIZ-02**: 创建向导表单 — 必填 6 字段（documentTypeId、workflowName、workflowGoal、mainPrompt、fileGroups、exportFormats）
- [ ] **WIZ-03**: 文件分组编辑器 — `groupId/groupName/groupDescription/required/priority/files` 增删改排序
- [ ] **WIZ-04**: 文件项编辑器 — `fileId/name/description/direction/required/fileCountMode/acceptedFileTypes` 增删改，含 "output" 语义提示文案
- [ ] **WIZ-05**: 可选表单字段 — `sensitiveDataLevel/desiredArtifacts/referenceStyle/hardConstraints/qualityMode/defaultWorkflowCandidate/templatePreference/referenceMaterials`
- [ ] **WIZ-06**: 提交后任务状态轮询 — 显示当前阶段名、整体进度、最近错误、重试按钮

### Frontend Result & Editor Handoff

- [ ] **FERE-01**: 生成结果预览区 — 流程描述、输入项列表、阶段节点列表、每阶段命名产物、导出内容、warnings/assumptions
- [ ] **FERE-02**: 任务完成后显示"进入流程编辑器"按钮，跳转到 `/admin/workflows/:id/edit` 继续微调
- [ ] **FERE-03**: 任务列表页 — 管理员查看近期生成记录、状态筛选、点击进入详情

### Failure Handling

- [ ] **FAIL-01**: 失败任务必须保留 job 记录 + 所有中间产物（request / normalized / blueprint / review / compiled / validation）
- [ ] **FAIL-02**: 前端失败态显示"查看错误摘要" + "重新生成"按钮，错误摘要区分失败类型（请求不合法 / 模型调用失败 / 蓝图不合法 / 修复轮次耗尽 / 落库失败）
- [ ] **FAIL-03**: `review_needed` 状态专门处理 — 展示蓝图报告但不创建 workflow，管理员可调整输入后通过 regenerate 重跑

### Testing

- [ ] **TEST-01**: 单元测试 — 请求归一化、`machineKey/fileSlotId` 生成、blueprint → workflow 编译、命名产物 id 唯一性、导出映射生成、validation error → repair instruction 转换
- [ ] **TEST-02**: 集成测试 — 创建 job → 完成 → 创建 workflow、创建 job → 校验失败 → 修复 → 成功、创建 job → 模型失败 → job 标记失败、生成的 workflow 通过 `validateWorkflow()`
- [ ] **TEST-03**: 前端测试 — 表单校验、文件分组增删改、提交任务、轮询与状态展示、结果预览、跳转编辑器

## Future Requirements

Deferred to v2+ or future iterations. Tracked but not in current roadmap.

### Agent-based Generation

- **FUT-AGT-01**: Agent SDK 模式在提示词修订或蓝图修复阶段使用（首版统一用 `simple_chat`）
- **FUT-AGT-02**: 允许 prompt 阶段调用 file search tool 读取参考材料

### Advanced Generation

- **FUT-DAG-01**: 支持任意 DAG / 分支图生成（首版仅线性流程）
- **FUT-MULTI-01**: 多独立导出文件打包（首版仅单 export 节点）
- **FUT-NEWDT-01**: 同时生成"新文档类型 + 新流程"（首版只能基于已有文档类型）

### Operational

- **FUT-OPS-01**: 自动清理过期 job 记录（首版全部保留）
- **FUT-OPS-02**: 生成成本统计 UI（首版只依赖 modelCallLogs 基础日志）
- **FUT-OPS-03**: 失败蓝图导入编辑器手工修正
- **FUT-OPS-04**: 允许用户编辑 AI 生成的流程描述后再落库
- **FUT-OPS-05**: 直接生成并自动启用 `active` 工作流（首版只生成 `draft`）

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 用户自定义 AI 编排逻辑 | 后台编排必须写死，避免生成器成为无边界配置系统 |
| 任意 DAG / 分支图生成 | 当前 `validateWorkflow()` 要求线性结构，复杂 DAG 显著提高失败率和调试成本 |
| 直接生成 `active` 工作流 | AI 生成仍需人工审核，只落 `draft` 由管理员确认 |
| 多独立导出文件打包 | 当前导出模型是单 export 节点，复用 contentMapping 机制 |
| 无人工确认一键上线 | 企业内部工具，流程上线需管理员 review |
| 自动绑定 Word/PPT 模板文件 | 仅生成结构，管理员在编辑器手工绑模板（保持生成器职责单一）|
| 引用已有流程作为风格参考 | v1.5 只接受自然语言输入，避免 copy-paste 漂移 |
| 生成新文档类型 | 当前 workflow 与 `documentTypeId` 强绑定，同时生成两者会扩大范围 |
| 专门的成本统计 UI | 复用 modelCallLogs 基础日志即可，内部工具调用量不大 |
| 自动清理 job 记录 | 内部工具调用量不大，可排查性 > 存储成本 |
| 首版用 Agent SDK 跑全流程 | 结构化 API 调用更稳定、成本可控，Agent 模式仅在未来个别阶段考虑 |

## Traceability

Phase mapping filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase TBD | Pending |
| DATA-02 | Phase TBD | Pending |
| DATA-03 | Phase TBD | Pending |
| DATA-04 | Phase TBD | Pending |
| GEN-01 | Phase TBD | Pending |
| GEN-02 | Phase TBD | Pending |
| GEN-03 | Phase TBD | Pending |
| GEN-04 | Phase TBD | Pending |
| PIPE-01 | Phase TBD | Pending |
| PIPE-02 | Phase TBD | Pending |
| PIPE-03 | Phase TBD | Pending |
| PIPE-04 | Phase TBD | Pending |
| PIPE-05 | Phase TBD | Pending |
| PIPE-06 | Phase TBD | Pending |
| COMP-01 | Phase TBD | Pending |
| COMP-02 | Phase TBD | Pending |
| COMP-03 | Phase TBD | Pending |
| COMP-04 | Phase TBD | Pending |
| VFIX-01 | Phase TBD | Pending |
| VFIX-02 | Phase TBD | Pending |
| VFIX-03 | Phase TBD | Pending |
| VFIX-04 | Phase TBD | Pending |
| API-01 | Phase TBD | Pending |
| API-02 | Phase TBD | Pending |
| API-03 | Phase TBD | Pending |
| API-04 | Phase TBD | Pending |
| API-05 | Phase TBD | Pending |
| MROLE-01 | Phase TBD | Pending |
| MROLE-02 | Phase TBD | Pending |
| MROLE-03 | Phase TBD | Pending |
| WIZ-01 | Phase TBD | Pending |
| WIZ-02 | Phase TBD | Pending |
| WIZ-03 | Phase TBD | Pending |
| WIZ-04 | Phase TBD | Pending |
| WIZ-05 | Phase TBD | Pending |
| WIZ-06 | Phase TBD | Pending |
| FERE-01 | Phase TBD | Pending |
| FERE-02 | Phase TBD | Pending |
| FERE-03 | Phase TBD | Pending |
| FAIL-01 | Phase TBD | Pending |
| FAIL-02 | Phase TBD | Pending |
| FAIL-03 | Phase TBD | Pending |
| TEST-01 | Phase TBD | Pending |
| TEST-02 | Phase TBD | Pending |
| TEST-03 | Phase TBD | Pending |

**Coverage:**
- v1.5 requirements: 44 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 44

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after v1.5 milestone scoping*
