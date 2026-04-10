# IntelliFlow — 智能文档流程平台（智文平台）

## What This Is

面向公司内部多部门使用的 AI 文档生成平台。用户通过 5 种基础节点（输入转换、信息脱敏、模型调用、信息恢复、文件导出）自由编排文档生成流程，驱动多模型并行生成、对比、迭代，快速产出高质量文档。支持后台生成通知、统计审计、全局搜索、AI 辅助编辑，以及结构化输出、条件执行等高级节点能力。

## Core Value

用户能跑通完整的流程生成高质量文档——从输入到 AI 多模型并行生成、对比迭代、信息脱敏恢复、最终导出，一站式完成，替代逐个 AI 平台粘贴对比的低效方式。

## Current State

**Shipped:** v1.4 质量与测试 (2026-04-04) + v1.4.5 post-ship polish (2026-04-07 ~ 04-10, unplanned)
**Codebase:** Bun monorepo, ~46,500 LOC TypeScript
**Tech stack:** Bun + ElysiaJS + Drizzle ORM + PostgreSQL 18 + SolidJS + Tailwind CSS v4

v1.0 delivers the complete MVP: auth, admin config, visual workflow editor, project/document management, full document creation runtime. v1.1 adds operational features: background execution + notifications, statistics dashboard, global search/favorites, AI inline editing. v1.2 enhances node capabilities: output path grammar (segmentKey), file slots, structured output (JSON Schema + named artifacts), Word table rendering, system prompt separation, conditional execution (skip/block). v1.3 hardens the platform for production: creator-or-owner write authorization on all runtime routes, path traversal defense with sanitizeFilename/assertWithinRoot, XSS protection via DOMPurify sanitization on all innerHTML render paths. v1.4 closes TypeScript contract gaps (Eden Treaty typed wrappers, DocumentStatus "failed", outputId JSDoc) and adds automated tests for sanitize/sanitize-html/document-status. **v1.4.5 post-ship polish** (unplanned) iterates on runtime resilience and execution-time UX: desensitize node per-source multi-file redesign, resumable background model-call with live SSE streaming, model_call multi-select output + outputItems flattening with stable executor reconciliation (fixes click-swallowing during polling), per-source restore + configured input sources + retry flow, password management (change-password modal + admin reset), responsive workflow management for small screens, PRD review demo workflow with blocking export gate, and the unified vitest runner.

## Current Milestone: v1.5 AI 自动生成流程

**Goal:** 管理员通过向导填写业务意图 + 输入文件结构，后端固定的多阶段 AI 流水线（归一化 → 需求分析 → 蓝图 → 提示词细化 → 结构评审 → 蓝图修订 → 确定性编译 → 校验-修复闭环）自动生成合法、可编辑的 `draft` 工作流。

**Target features:**
- 管理端独立菜单 + 路由 `/admin/workflow-ai`（保留现有"新建流程"入口不变）
- `workflow-generator` 后端模块（routes / service / orchestrator / compiler / validation-fix / prompts / types）
- 新建 `workflow_generation_jobs` 表持久化请求 + 中间产物 + 结果
- `modelCallLogs.callSource` 枚举扩展 `workflow_generation`
- 8 阶段 AI 编排 pipeline（阶段 0 归一化 → 1 需求分析 → 2 蓝图 → 3 提示词细化 → 4 结构评审 → 5 蓝图修订 → 6 确定性编译 → 7 校验-修复 → 8 落库与摘要）
- `WorkflowBlueprintDraft` 中间表示 + 确定性 `blueprint → workflow` 编译器（复用 demo workflow builder 思路）
- 校验-修复闭环（复用现有 `validateWorkflow`，3 轮自修上限）
- 前端向导页（三段：创建向导 / 任务状态轮询 / 结果预览）
- 任务完成后跳转 `/admin/workflows/:id/edit` 继续微调
- 失败处理 + 错误摘要报告 + 重新生成入口
- 5 角色模型绑定（analysis/blueprint/prompt/review/repair），默认统一模型

**Scope decisions:** 仅生成结构（不绑定模板文件）；v1.5 只接受自然语言输入（不引用已有流程）；job 全部保留不自动清理；复用 modelCallLogs 记基础日志；3 轮自修上限；完整向导表单（6 必填 + 8 可选）。

**Non-goals:** 用户自定义 AI 编排逻辑；任意 DAG / 分支图生成；直接生成 active 工作流；多独立导出文件打包；无人工确认一键上线。

**Source design doc:** `docs/design/ai-workflow-generation-plan.md` (2026-04-10)

## Requirements

### Validated

- **AUTH-01~04**: 用户认证（登录、会话、角色权限） — v1.0
- **AIMC-01~07, AIMC-09**: AI Provider/模型管理（CRUD、连通性测试、参数配置） — v1.0
- **DTYPE-01~05**: 文档类型管理 — v1.0
- **FLOW-01~13**: 流程编排（5 种节点、变量系统、校验、管理） — v1.0
- **PROJ-01~09**: 项目管理（CRUD、成员、角色） — v1.0
- **DMGT-01~06**: 文档管理（列表、搜索、详情、可见性） — v1.0
- **DOC-01~05**: 文档创建与工作台 — v1.0
- **NODE-01~22**: 5 种节点执行器 — v1.0
- **NOPS-01~04**: 节点通用操作 — v1.0
- **VER-01~03**: 版本管理 — v1.0
- **FSYS-01~04**: 文件系统与工作目录 — v1.0
- **RECV-01~02**: 失败恢复（草稿保存、断点续作） — v1.0
- **BGND-01~06**: 后台 AI 生成 + 应用内通知 + 企业微信通知 — v1.1
- **STAT-01~07**: 统计与审计面板（概览、模型/用户/流程维度、审计明细、多维度交叉） — v1.1
- **SRCH-01~05**: 全局搜索、收藏、最近访问 — v1.1
- **AIED-01~06**: AI 辅助内联编辑（浮动工具栏、差异预览、安全约束） — v1.1
- **DEBT-01**: DTYPE-04 文档关联守卫 — v1.1
- **NODE-23~31**: 扩展 FormFieldDef 8 种字段类型、machineKey、fieldsByKey 双视图 — v1.1
- **OPATH-01~03**: 输出路径规范（segmentKey canonical form）、resolveRef() 6 级优先链、文件槽位语义 — v1.2
- **SOUT-01**: 结构化输出（JSON Schema + ajv 校验）、命名产物解析、fieldPath 深度访问 — v1.2
- **EXPORT-01**: Word/PDF 导出表格渲染、有序/嵌套列表、代码块 — v1.2
- **SPROMPT-01**: System/User Prompt 分离、双提示词解析、策略路由 — v1.2
- **COND-01**: 条件执行（skip/block 规则）、executionRule 配置、阻断回滚 — v1.2
- **CMAP-01**: 导出 contentMapping 运行时生效（resolveContent + getExportPreview） — v1.2
- **PERM-01~05**: 写操作权限控制 — v1.3 (creator-or-owner 模型)
- **XSS-01~04**: XSS 防护（DOMPurify 净化所有 innerHTML） — v1.3
- **TSQL-01~04**: Eden Treaty typed API wrappers（RuntimeRoute 接口 + EdenResponse union + WrapperResult 模式）— v1.4
- **CONT-01~04**: 契约修复（DocumentStatus "failed"、InputSource/VariableRef.outputId JSDoc、validation.ts outputId 注释）— v1.4
- **TEST-01~03**: 自动化测试（sanitize.test.ts 路径穿越、sanitize-html.test.ts XSS 防护、document-status.test.ts 契约）— v1.4
- **DESENS-MS-01~04**: 脱敏节点多源重构 — 统一共享类型、后端 confirm 契约重写、per-source 输出数据模型、前端 vertical layout + per-source completed view — v1.4.5
- **RTRES-01~05**: Runtime 可续跑 + live SSE — `ModelCallLiveEvent`、runtime state flags、resumable background model-call with SSE streaming + snapshot replay、restore originalText — v1.4.5
- **RTFLOW-01~03**: Per-source restore + configured input sources + retry flow — v1.4.5
- **MSEL-01~05**: Model-call 多选输出 + outputItems 扁平化 + stable executor reconciliation — `OutputDef.category/groupLabel/modelId/artifactId`、`ModelCallConfig.enableUserSelectionOutput`、`buildModelCallOutputData` / `buildSelectedModelOutputData`、`selectModelOutput` 接收 `string[]`、`mergeModelOutputs` + `<Index>` tab bar 修 polling 点击被吞、`renderExecutor` accessor + `untrack` 避免 polling 重建 — v1.4.5
- **FEWS-01~04**: Frontend workspace refactor — resumable ModelCallExecutor with snapshot replay、per-source desensitize/restore executors + completed views、workspace shell manual confirm hook、background poll fix — v1.4.5
- **PWD-01~03**: Password management — backend password endpoints、change-password modal、admin user password reset — v1.4.5
- **DOCLST-01~02**: Document list 状态标记 — `hasFailedNode` / `isGenerating` flags — v1.4.5
- **ADMUX-01~03**: Admin UX — sidebar collapse + user menu、logs stats、project status — v1.4.5
- **ADMRSP-01**: Workflow management responsive card list（小屏卡片视图 + 桌面表格视图共享 `renderActions`）— v1.4.5
- **WFEDIT-01~02**: Workflow editor — manual restore input sources、richer markdown in PromptEditor/VariablePicker、VariablePicker Modal 化 + 按 category 分组 — v1.4.5
- **DEMO-01~02**: Demo workflows — bid workflow prompt hardening、PRD review workflow with progress gates + blocking export gate + 4-way compare — v1.4.5
- **TEST45-01~02**: Test coverage expansion — live-session/model-call state/restore/input-transform tests、catalog.test.ts PRD demo compile check、vitest runner unification (drop bun:test) — v1.4.5

### Active

v1.5 AI 自动生成流程 — building the admin-facing workflow generator (wizard + multi-stage AI pipeline + `workflow_generation_jobs` table + deterministic blueprint→workflow compiler + validate-fix loop). Phase numbering continues from Phase 32.

### Future

- [ ] 用量与限制管理（QUOT-01~03）— v1.1 决定只统计不限制，待有使用数据后再设定合理配额
- [ ] RECV-03: 支持取消正在进行的 AI 生成任务（v1.0 deferred）
- [ ] 文档评论与行内批注（ENHC-03）
- [ ] 从已有/历史文档导入/复制创建（ENHC-04~05）
- [ ] Excel 导出格式支持（ENHC-08）
- [ ] 模型调用改为 API 直接调用（替代 CLI）
- [ ] 脱敏映射加密存储（v1.0 tech debt）

### Out of Scope

- 实时多人协同编辑 — 高复杂度（CRDT/OT），业务规则已明确同一文档同一时间只允许一人编辑
- 用户自定义节点类型 — 复杂度无上限，安全风险；通过 5 种固定节点灵活配置满足需求
- 内置 AI 模型托管 — 超出范围，运维负担大；通过外部 Provider 集成
- 移动端 App — Web 优先的内部工具，暂无移动端场景
- 多租户 SaaS 架构 — 公司内部工具，单租户部署
- 插件/扩展市场 — 过度工程化
- 项目资料库（RAG） — 独立且复杂的子系统
- AIMC-08: CLI 命令行调用模板 — 改用 OpenCode Coding Plan 转发
- 条件路由 — 后续版本支持
- 人工审核节点 / 大纲确认节点 / 选择资料节点 — 后续版本支持

## Context

- 产品服务公司内部多部门，典型场景：招投标文档、解决方案、PRD、技术方案、会议纪要等
- 存储架构：PostgreSQL（元数据+脱敏映射）+ 服务器文件系统（节点输出+上传文件+导出文件）
- 模型调用：v1 使用 OpenAI-compatible API with SSE streaming；开发环境用 Coding Plan 转发，生产环境用火山方舟 API
- 脱敏机制：映射关系 DB 存储（v2 加密），脱敏规则（仅类型描述）自动注入后续模型调用提示词
- 需求文档以 `docs/requirements/v4-current.md` 为准

## Constraints

- **技术栈**: Bun (runtime) + ElysiaJS (后端) + Drizzle ORM + PostgreSQL 18 + SolidJS (前端) + Tailwind CSS v4
- **存储架构**: PostgreSQL + 文件系统混合方案
- **安全**: 脱敏真实值不出服务器，脱敏节点仅可调用本地私有模型
- **并发**: 支持 50+ 用户同时生成
- **性能**: 流式生成首 Token 延迟 < 2 秒
- **包管理器**: Bun（不使用 pnpm/npm/yarn）
- **代码规范**: Biome（不使用 ESLint/Prettier）
- **认证**: Bearer Token + localStorage（不使用 JWT 或 Cookie Session）

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bun + ElysiaJS + Drizzle ORM + SolidJS + Tailwind v4 | Bun 统一前后端运行时，Eden Treaty 端到端类型安全 | Good |
| PostgreSQL 18 + 文件系统混合存储 | 结构化查询+大文件分离，审批会议确定 | Good |
| v1 用户名密码认证 | 先跑通核心流程，降低外部依赖 | Good |
| Bearer Token + sessions table (非 JWT) | 支持服务端会话撤销，安全性更高 | Good |
| 渐进式里程碑交付 | 每阶段可验收，降低风险 | Good |
| v1 OpenAI-compatible API (非 CLI) | SSE streaming, 多模型并行, 标准化接口 | Good |
| 资料库（RAG）移出 v1 范围 | 独立子系统，暂不纳入 | Good |
| 自定义 SVG+HTML 画布 (替代 @dschz/solid-flow) | 完全控制交互和渲染，消除第三方限制 | Good |
| Flow engine as pure library | 可测试性，与 UI 解耦 | Good |
| postgres npm package (非 bun:sql) | 生产稳定性 | Good |
| Elysia resolve (scoped) for auth plugin | TypeScript 类型跨插件传播 | Good |
| Multiplexed SSE stream for multi-model | 所有模型共享一个连接，modelId 标记事件 | Good |
| fetch+ReadableStream (非 EventSource) | 支持 Authorization header | Good |
| RECV-03 cancel AI generation 延迟到 v2 | 复杂度高，v1 优先跑通核心流程 | Deferred |
| segmentKey canonical form for output paths | 统一变量引用格式，消除 id/key 歧义 | Good |
| resolveRef() 6-level priority chain | fieldsByKey→fields→fileSlots→namedOutputs→models→direct，覆盖所有引用场景 | Good |
| CodeMirror 6 for JSON Schema editor | 语法高亮+lint，比 textarea 更好的编辑体验 | Good |
| State-machine Markdown parser for Word export | NORMAL/IN_TABLE/IN_CODE_BLOCK 状态机，一致的多行解析 | Good |
| System prompt clean (no desensitize rules) | 系统提示词保持干净，脱敏规则只注入用户提示词 | Good |
| Conditional execution with depth guard (50 max) | Skip 递归需要上限防止无限循环 | Good |
| canEditDocument() creator-or-owner policy | owner/creator 有写权限，member 仅读权限；HTTP 方法不足以判断权限（GET /execute 写） | Good |
| Server-controlled storagePath for file uploads | POST /files 忽略客户端 storagePath，服务端生成 uuid+sanitizedName | Good |
| assertWithinRoot() on read + sanitizeFilename() on write | Defense in depth: 写入前净化文件名，读取前校验路径前缀 | Good |
| DOMPurify direct (not isomorphic-dompurify) | SolidJS browser-only app，不需要 jsdom SSR 支持 | Good |
| Conservative allowlist in DOMPurify | 19 tags + 4 attributes，远比黑名单安全 | Good |

## Milestone Plan

| Milestone | 内容 | 状态 |
|-----------|------|------|
| v1.0 MVP | 认证+管理+流程编排+项目文档+运行时 | Shipped 2026-03-25 |
| v1.1 运营增强与智能编辑 | 后台生成+通知、统计审计、全局搜索、AI编辑 | Shipped 2026-03-27 |
| v1.2 节点能力增强 | 输出规范、结构化输出、Word表格、System Prompt、条件执行 | Shipped 2026-03-27 |
| v1.3 安全与契约修复（部分） | 权限收紧（已完成）、XSS 防护（已完成）、文件安全+TSQL+契约+测试（待 v1.4） | Shipped 2026-04-03 |
| v1.4 质量与测试 | TypeScript 收口+契约修复+测试覆盖 | Shipped 2026-04-04 |
| v1.4.5 post-ship polish（非计划） | 脱敏多源重构 + Runtime 可续跑/live SSE + model-call 多选输出 + 工作区 refactor + 密码管理 + PRD 评审 demo + 响应式流程管理 + 测试 runner 统一 | Shipped 2026-04-10 |
| v1.5 AI 自动生成流程 | 管理端向导 + 多阶段 AI 流水线（归一化 → 需求分析 → 蓝图 → 提示词细化 → 评审 → 修订 → 编译 → 校验-修复）+ `workflow_generation_jobs` 表 + 确定性 blueprint→workflow 编译器 | Active (Phase 32+) |
| v2.0 | 批注、文档导入/复制、配额管理、条件路由、人工审核节点等 | Future |

---
*Last updated: 2026-04-10 after starting milestone v1.5 AI 自动生成流程*
