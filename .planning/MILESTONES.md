# Milestones

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

