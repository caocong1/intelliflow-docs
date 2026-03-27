# IntelliFlow — 智能文档流程平台（智文平台）

## What This Is

面向公司内部多部门使用的 AI 文档生成平台。用户通过 5 种基础节点（输入转换、信息脱敏、模型调用、信息恢复、文件导出）自由编排文档生成流程，驱动多模型并行生成、对比、迭代，快速产出高质量文档。目标用户包括售前/商务、产品经理、技术人员、项目经理和管理层。

## Core Value

用户能跑通完整的流程生成高质量文档——从输入到 AI 多模型并行生成、对比迭代、信息脱敏恢复、最终导出，一站式完成，替代逐个 AI 平台粘贴对比的低效方式。

## Current State

**Shipped:** v1.0 MVP (2026-03-25)
**Codebase:** Bun monorepo, 146 TypeScript files, ~31,100 LOC
**Tech stack:** Bun + ElysiaJS + Drizzle ORM + PostgreSQL 18 + SolidJS + Tailwind CSS v4

v1.0 delivers the complete MVP: user auth, admin configuration (providers, models, document types), visual workflow editor with 5 node types, project/document management with version history, and full document creation runtime with SSE streaming, multi-model comparison, desensitize/restore, and export. 82/82 active requirements satisfied across 16 phases.

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

### Active (v1.2 — 节点能力增强)

> **设计文档**：`docs/design/flow-node-capability-analysis.md` — 包含所有缺口的现状证据、类型定义、路径规范、实现边界和验收标准。**GSD 规划和执行时必须参考此文档。**

- [ ] Phase 23: 输出路径规范（segmentKey canonical form + resolveRef() 统一解析）
- [ ] Phase 24: 模型调用结构化输出 + 多产物命名（outputFormat/namedOutputs/JSON 校验）
- [ ] Phase 22-01: 后台执行 Bug 修复（file_export 枚举不匹配 + autoAdvance 语义缺失） ✓
- [ ] Phase 22-02: 输入转换表单字段类型扩展（number/date/select/multiselect） ✓
- [ ] Phase 25: 导出 Word 表格渲染（Markdown AST → docx Table）✓
- [ ] Phase 25: System/User Prompt 分离（systemPromptTemplate）✓
- [ ] Phase 26: 条件执行能力（NodeExecutionRule + blocked 状态）✓

> **设计文档**：`docs/design/flow-node-capability-analysis.md` — 包含所有缺口的现状证据、类型定义、路径规范、实现边界和验收标准。**GSD 规划和执行时必须参考此文档。**

- [ ] 后台执行 Bug 修复（file_export 枚举不匹配 + autoAdvance 语义缺失）
- [ ] 输入转换表单字段类型扩展（number/date/select/multiselect + machineKey）
- [ ] 输出路径规范（segmentKey canonical form + resolveRef() 统一解析）
- [ ] 文件槽位语义（fileSlotId + fileSlots 聚合视图）
- [ ] 导出 contentMapping 生效（resolveContent + getExportPreview 同步修复）
- [ ] 模型调用结构化输出 + 多产物命名（outputFormat/namedOutputs/JSON 校验）
- [ ] 导出 Word 表格渲染（Markdown AST → docx Table）
- [ ] System/User Prompt 分离（systemPromptTemplate）
- [ ] 条件执行能力（NodeExecutionRule + blocked 状态）

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

## Current Milestone: v1.2 节点能力增强

**Goal:** 完善节点能力（字段类型扩展、输出路径规范、结构化输出、Word 表格渲染、System Prompt 分离、条件执行）。

**Target features:**
- Phase 23: 输出路径规范（segmentKey）+ 文件槽位 + export contentMapping 生效
- Phase 24: 结构化输出（JSON Schema）+ 多产物命名 + fieldPath 解析
- Phase 25: Word 表格渲染 + System/User Prompt 分离 ✓
- Phase 26: 条件执行（skip/block）✓

## Milestone Plan

| Milestone | 内容 | 状态 |
|-----------|------|------|
| v1.0 MVP | 认证+管理+流程编排+项目文档+运行时 | Shipped 2026-03-25 |
| v1.1 运营增强与智能编辑 | 后台生成+通知、统计审计、全局搜索、AI编辑 | Shipped 2026-03-27 |
| v1.2 节点能力增强 | 字段扩展、输出规范、结构化输出、Word表格、System Prompt、条件执行 | Active |
| v2.0 | 批注、文档导入/复制、条件路由、人工审核节点等 | Future |

---
*Last updated: 2026-03-27 after v1.1 shipped — v1.2 milestone started*
