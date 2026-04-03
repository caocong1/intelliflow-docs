# Roadmap: IntelliFlow（智文平台）

## Overview

IntelliFlow delivers an AI document generation platform where users orchestrate document generation workflows using five node types (input transform, desensitize, model call, restore, export), driving multi-model parallel generation, comparison, and iteration to produce high-quality documents.

## Milestones

- **v1.0 MVP** — Phases 1-16 (shipped 2026-03-25) | [details](milestones/v1.0-ROADMAP.md)
- **v1.1 运营增强与智能编辑** — Phases 17-22 (shipped 2026-03-27) | [details](milestones/v1.1-ROADMAP.md)
- **v1.2 节点能力增强** — Phases 23-26 (shipped 2026-03-27) | [details](milestones/v1.2-ROADMAP.md)
- **v1.3 安全与契约修复** — Phases 27-31 (in progress)

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

### v1.3 安全与契约修复 (In Progress)

**Milestone Goal:** Harden the platform for production: close permission gaps, prevent file path traversal, eliminate XSS vectors, tighten TypeScript contracts, and validate fixes with tests.

- [x] **Phase 27: Permission Security** - Role-based write access control across all runtime routes (completed 2026-04-03)
- [x] **Phase 28: File Security** - Path traversal defense and filename sanitization for all file operations (completed 2026-04-03)
- [ ] **Phase 29: XSS Defense** - DOMPurify integration to sanitize all innerHTML usage
- [ ] **Phase 30: TypeScript Quality + Contract Fixes** - Typed API wrappers and shared type corrections
- [ ] **Phase 31: Test Coverage** - Automated tests validating security and contract fixes

## Phase Details

### Phase 27: Permission Security
**Goal**: Only document owners and creators can perform write operations; regular members are restricted to read-only access across all runtime routes
**Depends on**: Phase 26 (v1.2 complete)
**Requirements**: PERM-01, PERM-02, PERM-03, PERM-04, PERM-05
**Success Criteria** (what must be TRUE):
  1. A non-owner/non-creator member receives a 403 error when attempting to init, advance, rollback, skip, save draft, or start background execution on a document
  2. A non-owner/non-creator member receives a 403 error when calling desensitize, model-call, restore, inline-edit, or input-transform sub-route write endpoints
  3. A non-owner/non-creator member receives a 403 error when triggering export generation
  4. A project member with read-only role can still view document details, node outputs, and version history without error
**Plans**: TBD

### Phase 28: File Security
**Goal**: No file operation can read, write, or serve files outside designated directories, and all user-supplied filenames are sanitized before use
**Depends on**: Phase 27
**Requirements**: FSEC-01, FSEC-02, FSEC-03, FSEC-04, FSEC-05, FSEC-06, FSEC-07, FSEC-08
**Success Criteria** (what must be TRUE):
  1. A file upload with a crafted filename containing "../", null bytes, or leading dots results in a sanitized filename stored on disk (no path traversal possible)
  2. The POST /files endpoint ignores any client-supplied storagePath and generates the path server-side; unauthorized users receive a 403
  3. The GET /files endpoint rejects requests from users who are not members of the document's project
  4. Export download rejects requests where the stored path has been tampered to point outside the export directory
  5. Input-transform and export services write files using sanitized filenames regardless of original user input
**Plans**: TBD

### Phase 29: XSS Defense
**Goal**: All dynamically rendered HTML content is sanitized through DOMPurify before insertion into the DOM, eliminating stored and reflected XSS vectors
**Depends on**: Phase 28
**Requirements**: XSS-01, XSS-02, XSS-03, XSS-04
**Success Criteria** (what must be TRUE):
  1. Markdown content containing `<script>` tags, `onerror` handlers, or `javascript:` URLs renders without executing any script when displayed in render-markdown views
  2. The InlineEditor, ExportExecutor, and PromptEditor components strip malicious HTML attributes and tags from any dynamically set innerHTML
  3. A sanitizeHtml() utility function is available and all innerHTML assignments route through it
**Plans**: TBD

### Phase 30: TypeScript Quality + Contract Fixes
**Goal**: All runtime API calls use typed wrappers instead of `as any` casts, and shared type contracts accurately reflect actual backend behavior
**Depends on**: Phase 29
**Requirements**: TSQL-01, TSQL-02, TSQL-03, TSQL-04, CONT-01, CONT-02, CONT-03, CONT-04
**Success Criteria** (what must be TRUE):
  1. DocumentWorkspace.tsx, ExportExecutor.tsx, and VersionHistory.tsx contain zero `as any` casts for Eden Treaty API calls
  2. The DocumentStatus type includes "failed" and the backend document list API accepts status=failed as a filter parameter
  3. InputSource.outputId and VariableRef.outputId have JSDoc comments explaining their semantics, and validation.ts contains inline comments on outputId comparison logic
  4. All runtime API calls in the frontend go through typed wrapper functions in client.ts
**Plans**: TBD

### Phase 31: Test Coverage
**Goal**: Automated tests verify that security fixes and contract corrections work as specified, providing regression protection
**Depends on**: Phase 28, Phase 29, Phase 30
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. sanitize.test.ts passes: path traversal strings are neutralized, null bytes are stripped, normal filenames pass through, and assertWithinRoot throws on escape attempts
  2. sanitize-html.test.ts passes: script tags are removed, onerror attributes are stripped, safe HTML tags (p, em, strong, code) are preserved
  3. document-status.test.ts passes: "failed" is a valid DocumentStatus value and the filter function accepts it
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 27 -> 28 -> 29 -> 30 -> 31

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
| 27. Permission Security | v1.3 | 4/4 | Complete    | 2026-04-03 |
| 28. File Security | v1.3 | Complete    | 2026-04-03 | - |
| 29. XSS Defense | v1.3 | 0/? | Not started | - |
| 30. TypeScript Quality + Contract Fixes | v1.3 | 0/? | Not started | - |
| 31. Test Coverage | v1.3 | 0/? | Not started | - |
