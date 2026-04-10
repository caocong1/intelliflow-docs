# Milestones

## v1.4.5 Post-ship polish (Shipped: 2026-04-07 ~ 2026-04-10, unplanned)

**Phases completed:** none — out-of-band polish sprint with no formal GSD phases
**Timeline:** 4 days (2026-04-07 ~ 2026-04-10)
**Lines changed:** +19,582 / -3,512 across 105 files
**Git range:** 82b9765 → 38faae0 (29 commits)
**Codebase:** ~46,500 LOC TypeScript
**Requirements retroactively captured:** DESENS-MS-01~04, RTRES-01~05, RTFLOW-01~03, MSEL-01~05, FEWS-01~04, PWD-01~03, DOCLST-01~02, ADMUX-01~03, ADMRSP-01, WFEDIT-01~02, DEMO-01~02, TEST45-01~02

**Key accomplishments:**

- **Desensitize 多源重构 (04-07 ~ 04-08, 3 commits):** 统一共享类型、后端 confirm 契约重写、per-source 输出数据模型、前端 vertical layout + per-source completed view (82b9765, 41fcc30, 01d5cae)
- **Runtime 可续跑 + live SSE (04-10, 4 commits):** `ModelCallLiveEvent` + runtime state flags + restore originalText、resumable background model-call with live SSE streaming、per-source restore + configured input sources + retry flow、password management + document list hasFailedNode/isGenerating (dcbbbaf, 28ede6b, 5c258ae, e510527)
- **Frontend workspace refactor (04-10, 4 commits):** resumable ModelCallExecutor with snapshot replay、per-source desensitize/restore executors + completed views、workspace shell manual confirm hook + background poll fix、sidebar collapse + user menu + change-password modal (347c6db, aa796f1, 1cabe0d, 49a62ec)
- **Admin + workflow editor (04-10, 2 commits):** user password reset + logs stats + project status、manual restore input sources + richer markdown in PromptEditor/VariablePicker (59df366, fa02655)
- **Model-call 多选输出 + outputItems 扁平化 (04-10, 3 commits):** Cross-stack cohesive refactor — `OutputDef.category/groupLabel/modelId/artifactId`, `ModelCallConfig.enableUserSelectionOutput`, `buildModelCallOutputData` / `buildSelectedModelOutputData`, `selectModelOutput(string[])`, `mergeModelOutputs` + `<Index>` tab bar fix for polling click-swallow bug, `renderExecutor` accessor + `untrack` to prevent polling re-instantiation (2f3836b backend, 4238d92 frontend runtime, 319789c editor categories)
- **PRD review demo workflow (04-10, 2 commits):** bid workflow prompt hardening、PRD review workflow with progress gates + blocking export gate + 4-way compare (9b6bbe8, f2c2059)
- **Responsive workflow management (04-10, 1 commit):** 小屏卡片视图 + 桌面表格视图共享 `renderActions` helper (ce2981c)
- **Chores + test coverage (04-10, 5 commits):** test coverage expansion (live-session, model-call state, restore, input-transform)、vitest runner unification、statistics `@ts-expect-error` cleanup、migration script sql.json cast、document-type biome format、statistics pragma cleanup (bb80185, d9a18ed, 0c6cc0a, f9492de, cf54d7b)
- **Docs + config (04-10, 3 commits):** v1.5 AI workflow generation design doc、CODEBUDDY.md guidance、bunfig/npmrc + gitignore hygiene (53ba9db, 38faae0, 17e7929, fb2312d, f002527)

**Archives:** (none — unplanned polish has no ROADMAP/REQUIREMENTS files)

**Context:** This milestone is retroactively documented. The work started as a continuation of runtime polish after v1.4 shipped, but grew into a substantive set of features and a large cross-stack refactor. The v1.4.5 label was assigned during the v1.5 pre-alignment pause (documented in `.planning/MILESTONE-CONTEXT.md`) to give this batch of changes a tracking anchor before opening the new milestone.

---

## v1.4 质量与测试 (Shipped: 2026-04-04)

**Phases completed:** 2 phases (30-31), 5 plans
**Timeline:** 1 day (2026-04-04)
**Lines changed:** +1,702 / -313 across 31 files
**Git range:** bf16943 → 8184d02 (24 commits)
**Requirements:** 11/11 v1.4 requirements complete (TSQL-01~04, CONT-01~04, TEST-01~03)

**Key accomplishments:**

- Phase 30 (TypeScript Quality + Contract Fixes):
  - Plan 30-01: 9 typed runtime API wrappers in `client.ts` (`RuntimeRoute` interface + `EdenResponse` union + `WrapperResult` pattern); replaced all `as any` Eden Treaty casts in `DocumentWorkspace.tsx` (8), `ExportExecutor.tsx` (4), `VersionHistory.tsx` (1)
  - Plan 30-02: `DocumentStatus` union gains "failed"; backend list API accepts `status=failed`; `InputSource.outputId` + `VariableRef.outputId` get JSDoc; `validation.ts` adds inline comments on `outputId` comparison with `segmentKey` resolution helpers
- Phase 31 (Test Coverage):
  - Plan 31-01: set up vitest workspace configs for backend and frontend (projects-based, Vitest 4); add 12 sanitize tests covering `sanitizeFilename` path traversal + null bytes + `assertWithinRoot` escape attempts
  - Plan 31-02: 15 sanitize-html tests — script tags removed, onerror stripped, safe tags (p/em/strong/code) preserved
  - Plan 31-03: DocumentStatus type contract tests (all 4 valid values + filter rejection of invalid strings)

**Archives:**
- Roadmap + requirements still live in `.planning/ROADMAP.md` / `.planning/REQUIREMENTS.md` (v1.4 was small enough that dedicated archives weren't split out)

---

## v1.3 安全与契约修复（部分） (Shipped: 2026-04-03)

**Phases completed:** 3 phases (27-29), 12 plans
**Timeline:** 1 day (2026-04-03)
**Lines changed:** +1,913 / -214 across 35 files
**Git range:** 878ba6a → 41ac825 (33 commits)
**Requirements:** 9/28 complete (PERM-01~05, XSS-01~04); 14 deferred to v1.4

**Key accomplishments:**
- Phase 27: `canEditDocument()` authorization helper + creator-or-owner guards on all runtime write routes (init, advance, rollback, skip, draft, start-background, export-generate)
- Phase 28: `sanitizeFilename()` + `assertWithinRoot()` security utilities; server-controlled storage paths; membership guards on POST/GET /files
- Phase 29: DOMPurify XSS sanitization utility with conservative allowlist; sanitizeHtml() applied to render-markdown.tsx (6 innerHTML), InlineEditor, ExportExecutor, PromptEditor

**Archives:**
- [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- [v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md)

**Known Gaps (deferred to v1.4):**
- FSEC-01~08: File security utilities implemented but 8 FSEC requirements not formally verified
- TSQL-01~04: TypeScript typed wrappers (0/? plans)
- CONT-01~04: Contract fixes (DocumentStatus "failed", JSDoc) (0/? plans)
- TEST-01~03: Automated tests (0/? plans)

---

## v1.2 节点能力增强 (Shipped: 2026-03-27)

**Phases completed:** 4 phases (23-26), 14 plans
**Timeline:** 1 day (2026-03-27, ~4.5 hours)
**Lines changed:** +4,318 / -345 across 37 files
**Codebase:** ~42,889 LOC TypeScript
**Requirements:** 9/9 v1.2 requirements satisfied (per design doc `flow-node-capability-analysis.md`)

**Key accomplishments:**
- Phase 23: Output path grammar (segmentKey canonical form), resolveRef() 6-level priority chain, file slot semantics, export contentMapping runtime
- Phase 24: Structured output with JSON Schema validation (ajv), named artifact delimiter parsing, fieldPath deep access, CodeMirror 6 editor, revalidate/AI-fix endpoints
- Phase 25: State-machine Markdown parser for Word/PDF export (tables, nested lists, code blocks), System/User prompt separation with dual resolution
- Phase 26: Conditional node execution (skip/block rules), ExecutionRuleEditor with smart suggestions, blocked node rollback

**Archives:**
- [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

---

## v1.1 运营增强与智能编辑 (Shipped: 2026-03-27)

**Phases completed:** 11 phases (17-21 + 22), 47 plans
**Timeline:** 2 days (2026-03-26 ~ 2026-03-27)
**Codebase:** (ahead of origin/main by 153 commits — not yet pushed)
**Requirements:** BGND-01~06, STAT-01~07, SRCH-01~05, AIED-01~06, DEBT-01, plus 9 Phase 22 enhancements

**Key accomplishments:**
- Phase 17: Schema migration (background_tasks, user_favorites, user_recent_access tables), pg_trgm indexes, DTYPE-04 delete guard
- Phase 18: Background execution pipeline, task management, in-app notifications, WeChat Work push (human_needed: WeChat integration)
- Phase 19: Statistics dashboard with ECharts (overview, model/user/workflow dimensions, audit trail, cross-dimension filtering)
- Phase 20: Global search with pg_trgm fuzzy matching, favorites, recent access tracking
- Phase 21: AI-assisted inline editing with floating toolbar, SSE streaming, diff preview, security model filtering
- Phase 22: Bug fixes (export node type, autoSkip), FormFieldDef extended with 8 types (number/date/select/multiselect), machineKey, fieldsByKey dual-view

**Phases not pushed to origin/main:** 22-26 (153 commits ahead)

---

## v1.0 IntelliFlow 智文平台 MVP (Shipped: 2026-03-25)

**Phases completed:** 16 phases, 50 plans
**Timeline:** 7 days (2026-03-19 ~ 2026-03-25)
**Codebase:** 146 TypeScript files, ~31,100 LOC | 255 commits
**Requirements:** 82/82 active v1 requirements satisfied (RECV-03 deferred to v2, AIMC-08 out of scope)

**Key accomplishments:**
- Full-stack platform scaffolding: Bun monorepo + ElysiaJS + SolidJS + Drizzle ORM + PostgreSQL, Eden Treaty end-to-end type safety
- Admin configuration suite: user/role management, AI provider+model CRUD with connectivity testing, document type management, model parameter configuration
- Visual workflow editor: custom SVG+HTML canvas, 5 node types, drag-and-drop, undo/redo, autosave, validation, prompt optimization, variable system
- Project & document infrastructure: project CRUD + member roles, document management + visibility controls, version snapshots + timeline + diff, file system working directories
- Complete document creation runtime: workspace UI + stepper navigation, all 5 node executors (input transform, desensitize, model call with SSE streaming, restore, export), multi-model comparison, inline editing, skip/rollback
- Cross-phase integration hardening: 6 gap-closure phases fixing auth access, type sync, route splits, version history, export URLs, config alignment

**Tech debt carried forward:**
- DTYPE-04 document association guard is TODO stub (medium)
- NODE-07 desensitize mappings stored plaintext, encryption deferred to v2 (low)
- ExportCompleted.tsx silent catch {} blocks (low)
- /api/prompts/optimize uses requireAuth not requireAdmin (low)

**Deferred to v2:**
- RECV-03: cancel in-progress AI generation
- AIMC-08: CLI command template (replaced by OpenCode Coding Plan forwarding)

**Archives:**
- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

---

