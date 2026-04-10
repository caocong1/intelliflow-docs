# Milestone Context: v1.5 — AI 自动生成流程

**Created:** 2026-04-10 (via /gsd:new-milestone pre-alignment pause)
**Status:** Pending alignment — 请在漂移对齐完成后重新运行 `/gsd:new-milestone`，本文件会被流程读取并跳过 questioning 阶段。

## Version

**v1.5** — incremental，续自 v1.4 质量与测试

## Goal

新增管理端 "AI 自动生成流程" 功能：管理员通过向导填写业务意图 + 输入文件结构，后端通过固定的多阶段 AI 流水线（分析 → 蓝图 → 提示词 → 评审 → 修订 → 编译 → 校验-修复）自动生成合法、可编辑的 `draft` 工作流。输出包括：草稿 workflow、job 中间产物、生成摘要、模型调用日志。

## Source Design Document

- `docs/design/ai-workflow-generation-plan.md` (2026-04-10, 1047 行, 状态：待评审)

## Target Features

1. 管理端新增独立菜单 + 路由 `/admin/workflow-ai`（保留现有"新建流程"空流程创建入口不变）
2. `workflow-generator` 后端模块：routes / service / orchestrator / compiler / validation-fix / prompts / types
3. 新建 `workflow_generation_jobs` 表持久化请求 + 中间产物 + 结果
4. `modelCallLogs.callSource` 枚举扩展 `workflow_generation`
5. 请求归一化 + 多阶段 AI 编排 pipeline（阶段 0 归一化 → 1 需求分析 → 2 蓝图 → 3 提示词细化 → 4 结构评审 → 5 蓝图修订 → 6 确定性编译 → 7 校验-修复闭环 → 8 落库与摘要）
6. `WorkflowBlueprintDraft` 中间表示 + 确定性 `blueprint → workflow` 编译器（复用现有 demo workflow builder 思路）
7. 校验-修复闭环（复用现有 `validateWorkflow`）
8. 前端向导页（三段：创建向导 / 任务状态轮询 / 结果预览）
9. 任务完成后跳转 `/admin/workflows/:id/edit` 继续微调
10. 失败处理 + 错误摘要报告 + 重新生成入口

## Scope Decisions

| 决策点 | 选择 | 备注 |
|---|---|---|
| 模板绑定 | **仅结构** | 只生成 workflow 的节点/边/提示词，不自动绑定 Word/PPT 模板文件，管理员后续在编辑器里手工绑 |
| 引用已有流程 | **否** | v1.5 只接受自然语言输入，避免 copy-paste 漂移 |
| Job 保留 | **全部保留** | 不做自动清理；内部工具调用量不大，可排查性 > 存储成本 |
| 成本追踪 | **基础日志** | 仅扩展 `callSource='workflow_generation'` 写入现有 `modelCallLogs`，不做专门统计 UI |
| 模型角色 | **角色映射** | 管理员在设置面板把 5 个角色（analysis/blueprint/prompt/review/repair）绑定到具体模型；角色→模型持久化；默认"所有角色同一模型" |
| 修复轮数 | **3 轮** | AI 3 次自修后仍失败则标记 `review_needed`，丢完整错误堆栈给管理员 |
| 向导字段 | **完整表单** | §4.1 必填 6 字段 + §4.4 全部可选字段（sensitiveDataLevel / desiredArtifacts / referenceStyle / hardConstraints / qualityMode / defaultWorkflowCandidate / templatePreference / referenceMaterials） |

## Non-Goals (design doc §1.3)

- 不开放用户自定义 AI 编排逻辑
- 不支持任意 DAG / 分支图生成（首版仅线性流程）
- 不直接生成 `active` 工作流（仅 `draft`）
- 不支持多独立导出文件打包
- 不支持无人工确认一键上线

## Phase Numbering

从 **Phase 32** 开始（v1.4 结束于 Phase 31）

## Prerequisites (blocked until resolved)

> 用户选择"先对齐再开" — 以下步骤完成前不应重跑 `/gsd:new-milestone`：

### 1. Commit working tree (35 个未提交变更)

关键文件按主题分组：

**Runtime 后台可续跑 + live SSE (后端)**
- `packages/backend/src/modules/runtime/model-call.service.ts`
- `packages/backend/src/modules/runtime/model-call.routes.ts`
- `packages/backend/src/modules/runtime/model-call-state.ts`
- `packages/backend/src/modules/runtime/model-call-state.test.ts`
- `packages/backend/src/modules/runtime/restore.service.ts`
- `packages/backend/src/modules/runtime/restore.service.test.ts`
- `packages/backend/src/modules/runtime/runtime.service.ts`
- `packages/backend/src/modules/runtime/export-ppt.test.ts`
- `packages/backend/src/modules/runtime/model-call-output.ts` (新文件)
- `packages/backend/src/modules/runtime/model-call-output.test.ts` (新文件)

**Demo workflow builders + scripts**
- `packages/backend/src/scripts/demo-workflows/builders.ts`
- `packages/backend/src/scripts/demo-workflows/catalog.ts`
- `packages/backend/src/scripts/demo-workflows/catalog.test.ts` (新文件)
- `packages/backend/src/scripts/migrate-json-fields.ts`
- `packages/backend/src/scripts/migrate-named-output-prompts.ts`

**Statistics + shared types**
- `packages/backend/src/modules/statistics/statistics.service.ts`
- `packages/backend/src/document-status.test.ts`
- `packages/shared/src/types.ts`

**Frontend workspace / workflow editor / admin**
- `packages/frontend/src/components/ui/Modal.tsx`
- `packages/frontend/src/components/workflow/config/ModelCallConfig.tsx`
- `packages/frontend/src/components/workflow/prompt/PromptEditor.tsx`
- `packages/frontend/src/components/workflow/prompt/VariablePicker.tsx`
- `packages/frontend/src/components/workspace/completed/ModelCallCompleted.tsx`
- `packages/frontend/src/components/workspace/nodes/DesensitizeExecutor.tsx`
- `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx`
- `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.test.ts`
- `packages/frontend/src/components/workspace/nodes/ModelCompareView.tsx`
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts`
- `packages/frontend/src/lib/format-utils.test.ts`
- `packages/frontend/src/pages/admin/DocumentTypeManagement.tsx`
- `packages/frontend/src/pages/admin/WorkflowEditor.tsx`
- `packages/frontend/src/pages/admin/WorkflowManagement.tsx`
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx`

**未追踪文件**
- `CODEBUDDY.md` (待决定是否纳入 git)
- `docs/design/ai-workflow-generation-plan.md` (v1.5 源设计文档，应纳入)

### 2. Update PROJECT.md Validated section (补齐 04-07 → 04-10)

PROJECT.md 的 `## Requirements → Validated` 需要追加以下条目（这些是 v1.4 之后未纳管的 17 个 commit 做的功能）：

- **DESENS-MS-01~06 (2026-04-07 ~ 04-08)**: 脱敏节点多源重构 — 统一共享类型、后端 confirm 契约重写、per-source 数据模型、vertical layout、per-source completed view
- **RTRES-01~04 (2026-04-10)**: Runtime 可续跑 + live SSE — `ModelCallLiveEvent`、runtime state flags、resumable background model-call with live SSE streaming、restore originalText 恢复
- **RTFLOW-01~03 (2026-04-10)**: Per-source restore + configured input sources + retry flow
- **ADMPWD-01~03 (2026-04-10)**: Password management — backend password endpoints, admin password reset UI, change-password modal, sidebar user menu
- **DOCLST-01~02 (2026-04-10)**: document list `hasFailedNode` / `isGenerating` 标记 + workspace background poll fix
- **FEUI-01~03 (2026-04-10)**: Frontend UI polish — sidebar collapse, manual confirm hook, admin logs stats + project status
- **WFEDIT-01~02 (2026-04-10)**: Workflow editor — manual restore input sources + richer markdown in PromptEditor/VariablePicker
- **SEED-01 (2026-04-10)**: Bid workflow prompt hardening + demo workflow builders 扩展
- **TESTCOV-01 (2026-04-10)**: 测试覆盖 — live-session, model-call state, restore, input-transform coverage

> 这些功能需要用新的 REQ-ID 追加到 PROJECT.md "Validated" 部分（标记为 v1.4.5 或 post-v1.4），并可选地在 MILESTONES.md 里追加一个"v1.4.5 post-ship polish (unplanned)"条目，这样 v1.5 开始时 "已有能力" 的画面是真实的，AI 生成流程的"可复用能力"判断才准确。

### 3. Optional: /gsd:map-codebase

可以跑一次 `/gsd:map-codebase` 刷新 `.planning/codebase/` 快照，让 v1.5 researcher（特别是 Architecture 和 Features 维度）有干净的坐标。设计文档第 2.3 节"可复用能力"列出的内容需要验证是否已过时。

---

## 重跑指引

完成上述对齐后，运行：

```
/gsd:new-milestone
```

new-milestone workflow 的 Step 2 会检测到本文件存在，直接使用这里记录的 scope/features/decisions，跳过 questioning 阶段，呈现摘要让你确认后进入 Step 3（版本号确认）→ Step 4（更新 PROJECT.md）→ Step 5/6（更新 STATE.md + commit）→ Step 7/8（init + research 决定）→ Step 9（定义需求）→ Step 10（spawn roadmapper，从 Phase 32 开始）。

本文件在 Step 6 会被消费（删除）。

---
*Captured: 2026-04-10 via /gsd:new-milestone pre-alignment pause*
