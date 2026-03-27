# Roadmap: IntelliFlow（智文平台）

## Overview

IntelliFlow delivers an AI document generation platform where users orchestrate document generation workflows using five node types (input transform, desensitize, model call, restore, export), driving multi-model parallel generation, comparison, and iteration to produce high-quality documents.

## Milestones

- **v1.0 MVP** — Phases 1-16 (shipped 2026-03-25) | [details](milestones/v1.0-ROADMAP.md)
- **v1.1 运营增强与智能编辑** — Phases 17-21 (in progress)

## Phases

v1.0 MVP (Phases 1-16) — SHIPPED 2026-03-25

- Phase 1: Foundation + Auth + Document Types (3/3 plans) — completed 2026-03-19
- Phase 2: AI Provider and Model Configuration (2/2 plans) — completed 2026-03-19
- Phase 3: Workflow Orchestration (5/5 plans) — completed 2026-03-19
- Phase 4: Project + Document + Version + File System Infrastructure (6/6 plans) — completed 2026-03-20
- Phase 5: Document Creation Runtime (8/8 plans) — completed 2026-03-25
- Phase 6: Phase 1 Formal Verification & Housekeeping (1/1 plan) — completed 2026-03-19
- Phase 7: Model Parameter Configuration (1/1 plan) — completed 2026-03-19
- Phase 8: Integration Bug Fixes (1/1 plan) — completed 2026-03-20
- Phase 9: Integration Polish & UX Guards (1/1 plan) — completed 2026-03-20
- Phase 10: Non-Admin Read API Access (1/1 plan) — completed 2026-03-20
- Phase 11: Pre-Phase 5 API Access Fixes (1/1 plan) — completed 2026-03-20
- Phase 12: Workflow Editor Fixes & Config Panel Alignment (7/7 plans) — completed 2026-03-20
- Phase 13: Document Runtime Refactor (10/10 plans) — completed 2026-03-25
- Phase 14: Milestone Tracking Housekeeping (1/1 plan) — completed 2026-03-25
- Phase 15: Integration Bug Fixes — Export/PPT/Type Sync (1/1 plan) — completed 2026-03-25
- Phase 16: Fix Version History & Dead Code Cleanup (1/1 plan) — completed 2026-03-25



### v1.1 运营增强与智能编辑 (In Progress)

**Milestone Goal:** 补全运营管理能力（统计审计）、提升用户效率（后台生成通知、全局搜索、AI 辅助编辑）、修复遗留 tech debt。

- **Phase 17: Schema Migration + Tech Debt** - 新建数据库表/索引，修复 DTYPE-04 文档关联守卫 (completed 2026-03-26)
- **Phase 18: Background Execution + Notifications** - 后台 AI 生成、任务管理、应用内通知、企微推送 (completed 2026-03-26)
- **Phase 19: Statistics & Audit Dashboard** - 管理员统计面板、模型/用户/流程使用分析、审计明细 (completed 2026-03-26)
- **Phase 20: Search + Favorites + Recent Access** - 全局搜索、收藏、最近访问 (completed 2026-03-26)
- **Phase 21: AI-Assisted Inline Editing** - 选中触发 AI 编辑、内联差异预览、流式响应、安全约束

## Phase Details

### Phase 17: Schema Migration + Tech Debt

**Goal**: Database foundation for all v1.1 features is in place, and the DTYPE-04 tech debt is resolved
**Depends on**: Phase 16 (v1.0 complete)
**Requirements**: DEBT-01
**Success Criteria** (what must be TRUE):

1. Deleting a document type that has associated documents is blocked with a clear error message listing the associated documents
2. Deleting a document type with no associated documents succeeds normally
3. New database tables (`background_tasks`, `user_favorites`, `user_recent_access`) exist and are migratable (`notifications` table deferred to Phase 18 alongside notification feature design)
4. `pg_trgm` extension is enabled and GIN trigram indexes exist on document/project name and description columns
5. `callSourceEnum` includes `inline_edit` value for Phase 21 AI editing audit trail
**Plans**: TBD

### Phase 18: Background Execution + Notifications

**Goal**: Users can submit document generation to run in the background, leave the page, and get notified when it completes or fails
**Depends on**: Phase 17
**Requirements**: BGND-01, BGND-02, BGND-03, BGND-04, BGND-05, BGND-06
**Success Criteria** (what must be TRUE):

1. User can toggle "background execution" when starting document generation, close the browser tab, and the generation continues to completion on the server
2. User can view a task list showing all background tasks with their current status (queued/running/completed/failed) from both the document list and document detail page
3. When a background task completes, the user sees an in-app notification with unread badge; clicking it navigates to the finished document
4. When a background task completes or fails, the user receives a WeChat Work TextCard push notification with a link to the document
5. When a background task fails, the notification includes the failure reason and the user can retry the generation
6. Per-user concurrent background task limit enforced (e.g., max 3) as interim guard against unlimited API consumption (quotas deferred to v2)
7. On server startup, orphaned tasks stuck in `running` status are detected and marked as failed with appropriate notification
**Plans**: TBD

### Phase 19: Statistics & Audit Dashboard

**Goal**: Administrators have full visibility into platform usage, model costs, and generation audit trails
**Depends on**: Phase 17
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, STAT-06, STAT-07
**Success Criteria** (what must be TRUE):

1. Admin can view an overview dashboard showing total API calls, total token consumption, active user count, document generation count, and estimated total cost
2. Admin can drill down into per-model, per-user, and per-workflow usage statistics with call counts, token consumption, success rates, costs, and trend charts
3. Admin can view generation audit records with full detail: who generated, which workflow/nodes/models were used, duration, token count, and cost per record
4. Admin can view per-workflow usage statistics: usage count, user distribution, document count, and trend over time
5. Admin can filter all statistics by department, project, document type, and workflow as cross-dimension analysis
6. All statistics panels support custom date range selection and time granularity switching (day/week/month)
**Plans**: TBD

### Phase 20: Search + Favorites + Recent Access

**Goal**: Users can quickly find and access any document or project across the platform through search, favorites, and recent history
**Depends on**: Phase 17
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05
**Success Criteria** (what must be TRUE):

1. User can type in a global search box and find documents (by title/description) and projects (by name/description) and workflows (by name) across all projects they have access to
2. Search results respect document visibility permissions -- users only see content they are authorized to access
3. User can favorite/unfavorite projects and documents, and view all favorites in a dedicated "My Favorites" view
4. System automatically tracks recently accessed projects and documents, displayed in a "Recent Access" view
**Plans**: 3 plans
Plans:

- 20-01-PLAN.md — Backend APIs: search module + user-activity module
- 20-02-PLAN.md — Frontend pages, sidebar navigation, dashboard cards
- 20-03-PLAN.md — FavoriteButton integration + recent access recording hooks

### Phase 21: AI-Assisted Inline Editing

**Goal**: Users can select text in node output editors and use AI to rewrite, simplify, expand, fix, or translate it with streaming inline diff preview
**Depends on**: Phase 17
**Requirements**: AIED-01, AIED-02, AIED-03, AIED-04, AIED-05, AIED-06
**Success Criteria** (what must be TRUE):

1. When user selects text in a node output editor, a floating AI toolbar appears with preset actions (rewrite, simplify, expand, fix grammar, translate, custom instruction)
2. AI-generated edits appear as an inline diff preview (red for deletions, green for additions) with per-change accept/reject controls
3. AI edit responses stream in real-time via SSE, showing the generation process progressively
4. When editing content after an information restore node, only local/private models are available in the model selector (security constraint enforced); before restore, all online models are available
5. User can choose which AI model to use for editing, with the model list automatically filtered based on the security context of the current node position
**Plans**: 3 plans
Plans:

- 21-01-PLAN.md — Backend inline edit SSE endpoint + service + security validation + audit logging
- 21-02-PLAN.md — Frontend UI components: useTextSelection hook, AIEditToolbar, AIEditDiffPreview, SSE utility
- 21-03-PLAN.md — InlineEditor integration: wire toolbar, streaming, diff preview, accept/reject, security context

## Progress

**Execution Order:**
Phase 17 first (foundation). Then Phases 18, 19, 20 can proceed in parallel (all depend only on 17). Phase 21 depends only on Phase 17 but is placed last as a **risk ordering** (highest complexity, benefits from stable runtime) — it could technically run in parallel with 18-20 if needed.


| Phase                                         | Milestone | Plans Complete | Status      | Completed  |
| --------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Foundation + Auth + Document Types         | v1.0      | 3/3            | Complete    | 2026-03-19 |
| 2. AI Provider and Model Configuration        | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 3. Workflow Orchestration                     | v1.0      | 5/5            | Complete    | 2026-03-19 |
| 4. Project + Document + Version + File System | v1.0      | 6/6            | Complete    | 2026-03-20 |
| 5. Document Creation Runtime                  | v1.0      | 8/8            | Complete    | 2026-03-25 |
| 6. Phase 1 Verification                       | v1.0      | 1/1            | Complete    | 2026-03-19 |
| 7. Model Parameter Configuration              | v1.0      | 1/1            | Complete    | 2026-03-19 |
| 8. Integration Bug Fixes                      | v1.0      | 1/1            | Complete    | 2026-03-20 |
| 9. Integration Polish & UX Guards             | v1.0      | 1/1            | Complete    | 2026-03-20 |
| 10. Non-Admin Read API Access                 | v1.0      | 1/1            | Complete    | 2026-03-20 |
| 11. Pre-Phase 5 API Access Fixes              | v1.0      | 1/1            | Complete    | 2026-03-20 |
| 12. Workflow Editor Fixes                     | v1.0      | 7/7            | Complete    | 2026-03-20 |
| 13. Document Runtime Refactor                 | v1.0      | 10/10          | Complete    | 2026-03-25 |
| 14. Milestone Tracking Housekeeping           | v1.0      | 1/1            | Complete    | 2026-03-25 |
| 15. Integration Bug Fixes — Export/PPT/Type   | v1.0      | 1/1            | Complete    | 2026-03-25 |
| 16. Version History & Dead Code Cleanup       | v1.0      | 1/1            | Complete    | 2026-03-25 |
| 17. Schema Migration + Tech Debt              | 2/2       | Complete       | 2026-03-26  | -          |
| 18. Background Execution + Notifications      | 6/6       | Complete       | 2026-03-26  | -          |
| 19. Statistics & Audit Dashboard              | 6/6       | Complete       | 2026-03-26  | -          |
| 20. Search + Favorites + Recent Access        | 3/3       | Complete       | 2026-03-26  | -          |
| 21. AI-Assisted Inline Editing                | 3/3 | Complete    | 2026-03-27 | -          |


### Phase 22: Bug Fixes + Form Field Type Extension

**Goal**: Fix 2 known bugs in background execution and extend input transform form field types with machineKey support
**Depends on**: Phase 17
**Design Reference**: `docs/design/flow-node-capability-analysis.md` — Section 一 "已知 Bug" table + Section 三 "缺口 1"
**Success Criteria** (what must be TRUE):

1. `background.service.ts` export node case uses `"export"` (matching `types.ts` WorkflowNodeType enum), not `"file_export"`
2. Background execution respects `skippable+autoAdvance` node config: nodes with both flags set are auto-skipped instead of directly executed
3. `FormFieldDef.type` supports `"number"`, `"date"`, `"datetime"`, `"select"`, `"multiselect"` in addition to existing types
4. `FormFieldDef` has optional `machineKey` field with `/^[a-zA-Z_][a-zA-Z0-9_]*$/` format constraint
5. Frontend renders native input controls (number input, date picker, dropdown) for new field types
6. Backend validates new field types (number range, date format, select value in options)
7. `outputData` stores values in both `fields` (by UUID) and `fieldsByKey` (by machineKey) dual-view
8. Downstream nodes can reference new field values via `{{nodeId.machineKey}}`
**Plans**: 3 plans
Plans:

- 22-01-PLAN.md — Bug fixes + shared types extension + backend validation
- 22-02-PLAN.md — Frontend config panel + executor controls + validation
- 22-03-PLAN.md — Backend fieldsByKey dual-view + variable resolution + derive-outputs

### Phase 23: Output Path Grammar + File Slots + Export ContentMapping

**Goal**: Establish unified output path grammar (segmentKey canonical form), add file slot semantics to input transform, and make export contentMapping work at runtime
**Depends on**: Phase 22
**Design Reference**: `docs/design/flow-node-capability-analysis.md` — Section 二 (Output Path Grammar) + Section 三 缺口 #2 + #4a
**Success Criteria** (what must be TRUE):

1. `OutputDef` has `segmentKey` field; `VariableRef` has `fieldPath` field; all type-specific prefixes in OutputDef.id (field/fileslot/namedoutput/model)
2. `resolvePromptTemplate()` refactored into `resolveRef()` supporting segmentKey lookup with priority: fieldsByKey → fields → fileSlots → namedOutputs → models → direct property
3. `FormFieldDef` has optional `fileSlotId` and `fileSlotLabel`; frontend renders separate upload areas per slot
4. `outputData` includes `fileSlots` aggregation view (new field), `files` array unchanged
5. `{{n1.tender_doc}}` resolves to the file slot's `.text`; `{{n1.text}}` still returns merged text
6. `derive-outputs.ts` generates per-slot OutputDef for file fields with fileSlotId
7. `export.service.ts::resolveContent()` and `getExportPreview()` both use `contentMapping` from node config via `loadNodeConfig()`
8. Export with contentMapping referencing 3 upstream outputs produces file with all 3 segments in order
9. `VariablePicker` and `PromptEditor` use segmentKey format; `validation.ts` checks segmentKey cross-type uniqueness within a node
**Plans**: 3 plans
Plans:

- [ ] 23-01-PLAN.md — Shared types (segmentKey, fileSlot) + derive-outputs + DB migration + validation
- [ ] 23-02-PLAN.md — Backend runtime: resolveRef, confirmInputTransform fieldsByKey/fileSlots, export contentMapping
- [ ] 23-03-PLAN.md — Frontend: config panels, file slot executor, VariablePicker, ExportConfig contentMapping

### Phase 24: Structured Output + Named Artifacts + Field References

**Goal**: Enable model call nodes to output structured JSON and multiple named artifacts, with downstream field-level references
**Depends on**: Phase 23
**Design Reference**: `docs/design/flow-node-capability-analysis.md` — Section 三 缺口 #3
**Success Criteria** (what must be TRUE):

1. `ModelCallConfig` has `outputFormat` (text/json/markdown), `jsonSchema`, `stepDescription`, and `namedOutputs` fields
2. `outputFormat: "json"` triggers automatic JSON validation; invalid JSON shows as `format_error` status with "fix and revalidate" UI
3. `ModelOutput.status` type includes `"format_error"` value
4. `namedOutputs` mode: AI output parsed by `===OUTPUT:id===...===END:id===` delimiters into `outputData.namedOutputs[id]`
5. Frontend renders named outputs as separate cards, each independently editable
6. `{{n3.blueprint}}` returns named output content; `{{n3.clause_list.items[0].name}}` returns nested JSON field value
7. `resolveRef()` auto-unwraps namedOutput/model objects to `.content` when no fieldPath; parses `.content` as JSON when fieldPath present
8. Fallback: if AI doesn't follow delimiter format, entire output stored as default single artifact with frontend warning
**Plans**: 4 plans
Plans:

- [ ] 24-01-PLAN.md — Shared types + backend validation/parsing + resolveRef fieldPath + derive-outputs
- [ ] 24-02-PLAN.md — Frontend config UI: outputFormat/jsonSchema/namedOutputs panels + JsonSchemaEditor
- [ ] 24-03-PLAN.md — Frontend runtime UI: format_error display, named output cards, AI fix, fallback warning
- [ ] 24-04-PLAN.md — VariablePicker tree expansion + PromptEditor fieldPath highlighting

### Phase 25: Export Table Rendering + System Prompt Separation

**Goal**: Upgrade Word export to render Markdown tables and support system/user prompt separation in model calls
**Depends on**: Phase 23
**Design Reference**: `docs/design/flow-node-capability-analysis.md` — Section 三 缺口 #4b + #6
**Success Criteria** (what must be TRUE):

1. Word export renders Markdown tables as `docx.Table` objects with borders and bold headers
2. Word export supports ordered lists, nested lists, and code blocks
3. `ModelCallConfig` has optional `systemPromptTemplate` field
4. When `systemPromptTemplate` is set, API request sends `[{role:"system",...}, {role:"user",...}]` two messages
5. When `systemPromptTemplate` is not set, behavior unchanged (single user message)
6. Both prompt templates support `{{variable}}` interpolation and desensitize rule injection
7. Frontend config panel shows two text areas (System Prompt / User Prompt) for model call nodes
8. Model call logs record system and user messages separately
**Plans**: TBD

### Phase 26: Conditional Node Execution

**Goal**: Enable nodes to be automatically skipped or blocked based on upstream output values
**Depends on**: Phase 24
**Design Reference**: `docs/design/flow-node-capability-analysis.md` — Section 三 缺口 #5
**Success Criteria** (what must be TRUE):

1. `NodeCondition` uses `VariableRef` as `sourceRef` (with fieldPath support); operators: equals/not_equals/exists/not_exists/contains
2. `NodeExecutionRule` with action (skip/block), conditions array, and logic (and/or) can be configured on any node
3. `NodeExecutionStatus` type includes `"blocked"` value
4. `advanceNode()` evaluates executionRule before entering a node; `skip` auto-skips with logged reason; `block` sets status to `"blocked"`
5. Frontend shows blocked nodes with red "已阻断" label, blocking reason, and "返回修改上游" button
6. "返回修改上游" triggers `rollbackToNode()` to the earliest stepOrder among all sourceRef.nodeId values
7. After rollback and re-advance, blocked node is re-evaluated; condition no longer met → proceeds normally
8. Background execution stops pipeline on blocked node and sends notification
**Plans**: TBD

