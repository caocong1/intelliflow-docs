# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — IntelliFlow 智文平台 MVP

**Shipped:** 2026-03-25
**Phases:** 16 | **Plans:** 50 | **Timeline:** 7 days

### What Was Built
- Full-stack AI document generation platform with Bun + ElysiaJS + SolidJS + PostgreSQL
- Admin suite: user auth, provider/model management, document type management
- Visual workflow editor: custom SVG+HTML canvas, 5 node types, undo/redo, autosave, validation, prompt optimization
- Project/document infrastructure: CRUD, member roles, visibility controls, version history with diff
- Complete runtime: 5 node executors, SSE streaming, multi-model comparison, desensitize/restore, Word/PDF/Markdown export
- 82/82 active requirements satisfied across 16 phases

### What Worked
- **Iterative audit cycles**: Running `/gsd:audit-milestone` after each batch of phases caught integration gaps early (route auth splits, type mismatches, config alignment). 6 gap-closure phases were created and resolved before milestone completion.
- **Phase 12+13 refactor pattern**: Building Phase 5 runtime first, then refactoring with Phase 12 editor alignment in Phase 13, proved effective — delivered working code fast, then cleaned up systematically.
- **Route split pattern** (Phase 10/11): `requireAuth` for reads + `requireAdmin` for mutations became a reusable pattern applied consistently across all modules.
- **Plan execution velocity**: Average ~6 min per plan, with consistent quality. Small, focused plans (2-3 tasks each) kept momentum high.
- **Eden Treaty type safety**: End-to-end types between backend and frontend caught integration issues at compile time.

### What Was Inefficient
- **5 re-audits needed**: Initial phases left tracking artifacts stale (unchecked checkboxes, wrong counts). Phase 6 and Phase 14 were entirely housekeeping. Better to keep tracking artifacts current during execution.
- **Phase 12 scope creep**: Started as "editor fixes" but grew to 7 plans covering custom canvas migration, undo/redo, autosave, prompt optimization. Should have been scoped as a separate milestone concern earlier.
- **SUMMARY.md format inconsistency**: Early phases used ad-hoc format; later phases had structured frontmatter. Made automated extraction difficult.
- **Tech debt accumulation**: 6 items carried forward. The DTYPE-04 document association guard TODO was noted in Phase 6 but deferred through 10 more phases.

### Patterns Established
- Route split pattern: `requireAuth` read group + `requireAdmin` mutation group per module
- Flow engine as pure library: separate from UI, testable, with reactive store
- Multiplexed SSE stream: one connection per multi-model call, modelId-tagged events
- Config panel alignment: shared types drive both editor config panels and runtime executors
- Executor null guards: `if (!props.config) return loading message` pattern
- Version-based rollback: new rows with `isCurrent=true, executionRound=MAX+1` instead of mutation

### Key Lessons
1. **Keep tracking artifacts current during execution** — stale checkboxes and counts create audit overhead. Update REQUIREMENTS.md and ROADMAP.md as part of each plan completion, not retroactively.
2. **Scope refactors separately from initial build** — Phase 12's "fixes" were really a rewrite. Acknowledging scope upfront leads to better planning.
3. **Audit early, audit often** — iterative audits found real integration gaps that would have been painful to discover in UAT. The cost of auditing (minutes) is far less than the cost of late-discovered bugs.
4. **Small plans win** — 2-3 task plans averaging 6 min each maintained consistent velocity without context exhaustion.
5. **Shared types are the contract** — changes to shared types ripple to both editor and runtime. Phase 12+13 proved that aligning shared types first makes downstream work mechanical.

### Cost Observations
- Model mix: primarily Sonnet for execution, Opus for planning/audit/verification
- 50 plans executed across multiple sessions over 7 days
- Notable: gap-closure phases (6-11, 14-16) added 11 phases but only 11 plans — small, focused fixes

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 7 days | 16 | Iterative audit-driven gap closure; 5 core phases grew to 16 |

### Top Lessons (Verified Across Milestones)

1. Iterative audits catch integration gaps early — audit cost is low, late-discovery cost is high
2. Small focused plans (2-3 tasks) maintain velocity and quality
3. Shared types as contracts make cross-layer alignment mechanical
