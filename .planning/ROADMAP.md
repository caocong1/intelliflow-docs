# Roadmap: IntelliFlow（智文平台）

## Overview

IntelliFlow delivers an AI document generation platform where users orchestrate document generation workflows using five node types (input transform, desensitize, model call, restore, export), driving multi-model parallel generation, comparison, and iteration to produce high-quality documents.

## Milestones

- **v1.0 MVP** — Phases 1-16 (shipped 2026-03-25) | [details](milestones/v1.0-ROADMAP.md)
- **v1.1 运营增强与智能编辑** — Phases 17-22 (shipped 2026-03-27) | [details](milestones/v1.1-ROADMAP.md)
- **v1.2 节点能力增强** — Phases 23-26 (shipped 2026-03-27) | [details](milestones/v1.2-ROADMAP.md)
- **v1.3 安全与契约修复（部分）** — Phases 27-29 (shipped 2026-04-03) | [details](milestones/v1.3-ROADMAP.md)
- **v1.4 质量与测试** — Phases 30-31 (planned)

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
- [x] Phase 13: Document Runtime Refactor (11/11 plans) — completed 2026-03-25
- [x] Phase 14: Milestone Tracking Housekeeping (1/1 plan) — completed 2026-03-25
- [x] Phase 15: Integration Bug Fixes — Export/PPT/Type Sync (1/1 plan) — completed 2026-03-25
- [x] Phase 16: Fix Version History & Dead Code Cleanup (1/1 plan) — completed 2026-03-25

</details>

<details>
<summary>v1.1 运营增强与智能编辑 (Phases 17-22) — SHIPPED 2026-03-27</summary>

- [x] Phase 17: Schema Migration + Tech Debt (2/2 plans) — completed 2026-03-26
- [x] Phase 18: Background Execution + Notifications (6/6 plans) — completed 2026-03-26
- [x] Phase 19: Statistics & Audit Dashboard (6/6 plans) — completed 2026-03-26
- [x] Phase 20: Search + Favorites + Recent Access (3/3 plans) — completed 2026-03-26
- [x] Phase 21: AI-Assisted Inline Editing (3/3 plans) — completed 2026-03-27
- [x] Phase 22: Bug Fixes + Form Field Type Extension (3/3 plans) — completed 2026-03-27

</details>

<details>
<summary>v1.2 节点能力增强 (Phases 23-26) — SHIPPED 2026-03-27</summary>

- [x] Phase 23: Output Path Grammar + File Slots + Export ContentMapping (3/3 plans) — completed 2026-03-27
- [x] Phase 24: Structured Output + Named Artifacts + Field References (4/4 plans) — completed 2026-03-27
- [x] Phase 25: Export Table Rendering + System Prompt Separation (3/3 plans) — completed 2026-03-27
- [x] Phase 26: Conditional Node Execution (4/4 plans) — completed 2026-03-27

</details>

<details>
<summary>v1.3 安全与契约修复（部分）(Phases 27-29) — SHIPPED 2026-04-03</summary>

- [x] Phase 27: Permission Security (4/4 plans) — completed 2026-04-03
- [x] Phase 28: File Security (4/4 plans) — completed 2026-04-03
- [x] Phase 29: XSS Defense (4/4 plans) — completed 2026-04-03

</details>

### v1.4 质量与测试 (Planned)

- [x] Phase 30: TypeScript Quality + Contract Fixes (completed 2026-04-04)
- [x] Phase 31: Test Coverage (2/3 plans)

## Phase Details

*(Phases 27-29 details archived in [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md))*

### Phase 30: TypeScript Quality + Contract Fixes
**Goal**: All runtime API calls use typed wrappers instead of `as any` casts, and shared type contracts accurately reflect actual backend behavior
**Depends on**: Phase 29
**Requirements**: TSQL-01~04, CONT-01~04
**Success Criteria** (what must be TRUE):
  1. DocumentWorkspace.tsx, ExportExecutor.tsx, and VersionHistory.tsx contain zero `as any` casts for Eden Treaty API calls
  2. The DocumentStatus type includes "failed" and the backend document list API accepts status=failed as a filter parameter
  3. InputSource.outputId and VariableRef.outputId have JSDoc comments explaining their semantics, and validation.ts contains inline comments on outputId comparison logic
  4. All runtime API calls in the frontend go through typed wrapper functions in client.ts

### Phase 31: Test Coverage
**Goal**: Automated tests verify that security fixes and contract corrections work as specified, providing regression protection
**Depends on**: Phase 28, Phase 29, Phase 30
**Requirements**: TEST-01~03
**Success Criteria** (what must be TRUE):
  1. sanitize.test.ts passes: path traversal strings are neutralized, null bytes are stripped, normal filenames pass through, and assertWithinRoot throws on escape attempts
  2. sanitize-html.test.ts passes: script tags are removed, onerror attributes are stripped, safe HTML tags (p, em, strong, code) are preserved
  3. document-status.test.ts passes: "failed" is a valid DocumentStatus value and the filter function accepts it

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
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
| 13. Document Runtime Refactor | v1.0 | 11/11 | Complete | 2026-03-25 |
| 14. Milestone Tracking Housekeeping | v1.0 | 1/1 | Complete | 2026-03-25 |
| 15. Integration Bug Fixes — Export/PPT/Type | v1.0 | 1/1 | Complete | 2026-03-25 |
| 16. Version History & Dead Code Cleanup | v1.0 | 1/1 | Complete | 2026-03-25 |
| 17. Schema Migration + Tech Debt | v1.1 | 2/2 | Complete | 2026-03-26 |
| 18. Background Execution + Notifications | v1.1 | 6/6 | Complete | 2026-03-26 |
| 19. Statistics & Audit Dashboard | v1.1 | 6/6 | Complete | 2026-03-26 |
| 20. Search + Favorites + Recent Access | v1.1 | 3/3 | Complete | 2026-03-26 |
| 21. AI-Assisted Inline Editing | v1.1 | 3/3 | Complete | 2026-03-27 |
| 22. Bug Fixes + Form Field Type Extension | v1.1 | 3/3 | Complete | 2026-03-27 |
| 23. Output Path Grammar + File Slots | v1.2 | 3/3 | Complete | 2026-03-27 |
| 24. Structured Output + Named Artifacts | v1.2 | 4/4 | Complete | 2026-03-27 |
| 25. Word Table Rendering + System Prompt | v1.2 | 3/3 | Complete | 2026-03-27 |
| 26. Conditional Node Execution | v1.2 | 4/4 | Complete | 2026-03-27 |
| 27. Permission Security | v1.3 | 4/4 | Complete | 2026-04-03 |
| 28. File Security | v1.3 | 4/4 | Complete | 2026-04-03 |
| 29. XSS Defense | v1.3 | 4/4 | Complete | 2026-04-03 |
| 30. TypeScript Quality + Contract Fixes | 2/2 | Complete    | 2026-04-04 | 2026-04-04 |
| 31. Test Coverage | 2/3 | In Progress|  | — |
