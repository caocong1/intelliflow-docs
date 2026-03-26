# Roadmap: IntelliFlow（智文平台）

## Overview

IntelliFlow delivers an AI document generation platform where users orchestrate document generation workflows using five node types (input transform, desensitize, model call, restore, export), driving multi-model parallel generation, comparison, and iteration to produce high-quality documents.

## Milestones

- **v1.0 MVP** — Phases 1-16 (shipped 2026-03-25) | [details](milestones/v1.0-ROADMAP.md)
- **v1.1 运营增强与智能编辑** — Phases 17-21 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-16) — SHIPPED 2026-03-25</summary>

- [x] Phase 1: Foundation + Auth + Document Types (3/3 plans) — completed 2026-03-19
- [x] Phase 2: AI Provider and Model Configuration (2/2 plans) — completed 2026-03-19
- [x] Phase 3: Workflow Orchestration (5/5 plans) — completed 2026-03-19
- [x] Phase 4: Project + Document + Version + File System Infrastructure (6/6 plans) — completed 2026-03-20
- [x] Phase 5: Document Creation Runtime (8/8 plans) — completed 2026-03-25
- [x] Phase 6: Phase 1 Formal Verification & Housekeeping (1/1 plan) — completed 2026-03-19
- [x] Phase 7: Model Parameter Configuration (1/1 plan) — completed 2026-03-19
- [x] Phase 8: Integration Bug Fixes (1/1 plan) — completed 2026-03-20
- [x] Phase 9: Integration Polish & UX Guards (1/1 plan) — completed 2026-03-20
- [x] Phase 10: Non-Admin Read API Access (1/1 plan) — completed 2026-03-20
- [x] Phase 11: Pre-Phase 5 API Access Fixes (1/1 plan) — completed 2026-03-20
- [x] Phase 12: Workflow Editor Fixes & Config Panel Alignment (7/7 plans) — completed 2026-03-20
- [x] Phase 13: Document Runtime Refactor (10/10 plans) — completed 2026-03-25
- [x] Phase 14: Milestone Tracking Housekeeping (1/1 plan) — completed 2026-03-25
- [x] Phase 15: Integration Bug Fixes — Export/PPT/Type Sync (1/1 plan) — completed 2026-03-25
- [x] Phase 16: Fix Version History & Dead Code Cleanup (1/1 plan) — completed 2026-03-25

</details>

### v1.1 运营增强与智能编辑 (In Progress)

**Milestone Goal:** 补全运营管理能力（统计审计）、提升用户效率（后台生成通知、全局搜索、AI 辅助编辑）、修复遗留 tech debt。

- [x] **Phase 17: Schema Migration + Tech Debt** - 新建数据库表/索引，修复 DTYPE-04 文档关联守卫 (completed 2026-03-26)
- [ ] **Phase 18: Background Execution + Notifications** - 后台 AI 生成、任务管理、应用内通知、企微推送
- [ ] **Phase 19: Statistics & Audit Dashboard** - 管理员统计面板、模型/用户/流程使用分析、审计明细
- [ ] **Phase 20: Search + Favorites + Recent Access** - 全局搜索、收藏、最近访问
- [ ] **Phase 21: AI-Assisted Inline Editing** - 选中触发 AI 编辑、内联差异预览、流式响应、安全约束

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
**Plans**: TBD

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
**Plans**: TBD

## Progress

**Execution Order:**
Phase 17 first (foundation). Then Phases 18, 19, 20 can proceed in parallel (all depend only on 17). Phase 21 depends only on Phase 17 but is placed last as a **risk ordering** (highest complexity, benefits from stable runtime) — it could technically run in parallel with 18-20 if needed.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation + Auth + Document Types | v1.0 | 3/3 | Complete | 2026-03-19 |
| 2. AI Provider and Model Configuration | v1.0 | 2/2 | Complete | 2026-03-19 |
| 3. Workflow Orchestration | v1.0 | 5/5 | Complete | 2026-03-19 |
| 4. Project + Document + Version + File System | v1.0 | 6/6 | Complete | 2026-03-20 |
| 5. Document Creation Runtime | v1.0 | 8/8 | Complete | 2026-03-25 |
| 6. Phase 1 Verification | v1.0 | 1/1 | Complete | 2026-03-19 |
| 7. Model Parameter Configuration | v1.0 | 1/1 | Complete | 2026-03-19 |
| 8. Integration Bug Fixes | v1.0 | 1/1 | Complete | 2026-03-20 |
| 9. Integration Polish & UX Guards | v1.0 | 1/1 | Complete | 2026-03-20 |
| 10. Non-Admin Read API Access | v1.0 | 1/1 | Complete | 2026-03-20 |
| 11. Pre-Phase 5 API Access Fixes | v1.0 | 1/1 | Complete | 2026-03-20 |
| 12. Workflow Editor Fixes | v1.0 | 7/7 | Complete | 2026-03-20 |
| 13. Document Runtime Refactor | v1.0 | 10/10 | Complete | 2026-03-25 |
| 14. Milestone Tracking Housekeeping | v1.0 | 1/1 | Complete | 2026-03-25 |
| 15. Integration Bug Fixes — Export/PPT/Type | v1.0 | 1/1 | Complete | 2026-03-25 |
| 16. Version History & Dead Code Cleanup | v1.0 | 1/1 | Complete | 2026-03-25 |
| 17. Schema Migration + Tech Debt | 2/2 | Complete    | 2026-03-26 | - |
| 18. Background Execution + Notifications | v1.1 | 0/0 | Not started | - |
| 19. Statistics & Audit Dashboard | v1.1 | 0/0 | Not started | - |
| 20. Search + Favorites + Recent Access | v1.1 | 0/0 | Not started | - |
| 21. AI-Assisted Inline Editing | v1.1 | 0/0 | Not started | - |
