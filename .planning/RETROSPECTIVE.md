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

## Milestone: v1.1 — 运营增强与智能编辑

**Shipped:** 2026-03-27
**Phases:** 6 (17-22) | **Plans:** 23 | **Timeline:** 2 days

### What Was Built
- Schema migration foundation: background_tasks, user_favorites, user_recent_access tables, pg_trgm indexes
- Background execution pipeline with task management, in-app notifications, WeChat Work push
- Statistics & audit dashboard with ECharts: overview, model/user/workflow dimensions, cross-dimension filtering
- Global search with pg_trgm fuzzy matching, favorites, recent access tracking
- AI-assisted inline editing: floating toolbar, SSE streaming, diff preview, security model filtering
- Form field type extension: 8 new types, machineKey, fieldsByKey dual-view

### What Worked
- **Schema-first approach**: Phase 17 laid all DB foundations before feature phases, enabling Phase 18-20 to proceed in parallel with zero schema conflicts.
- **Parallel feature tracks**: Phases 18, 19, 20 all depended only on Phase 17, enabling wave-based parallel execution.
- **Raw fetch consistency**: All new frontend API clients (statistics, user-activity, notifications) used raw fetch pattern instead of Eden Treaty, maintaining consistency with existing code.
- **Execution velocity**: 23 plans across 6 phases in 2 days, averaging ~3 min per plan.

### What Was Inefficient
- **v1.1 audit ran too early**: Audit at 2026-03-26T06:00Z showed `gaps_found` (1/25 requirements) because phases hadn't executed yet. Stale audit data.
- **Phase 22 milestone ambiguity**: Phase 22 was claimed by both v1.1 (in MILESTONES.md) and v1.2 (in phase details section), creating bookkeeping confusion.

### Patterns Established
- ECharts with ResizeObserver + onCleanup for chart container lifecycle
- createStore + JSON.stringify key for reactive refetching with createResource
- mouseup+keyup listeners for reliable textarea selection (not selectionchange)
- diff-match-patch with diff_cleanupSemantic for CJK-friendly diffs

### Key Lessons
1. **Run audits AFTER execution, not before** — the v1.1 audit was useless because it ran before phases were complete.
2. **Assign phases to milestones explicitly at creation time** — Phase 22's dual-claiming was a bookkeeping headache.
3. **Fire-and-forget async patterns simplify background execution** — immediate queued response + async error capture is cleaner than synchronous pipelines.

### Cost Observations
- Model mix: Sonnet for execution, Opus for planning/research
- 23 plans across ~8 sessions over 2 days
- Notable: 6-plan Phase 18 (background execution) was the largest, reflecting notification system complexity

---

## Milestone: v1.2 — 节点能力增强

**Shipped:** 2026-03-27
**Phases:** 4 (23-26) | **Plans:** 14 | **Timeline:** ~4.5 hours

### What Was Built
- Output path grammar: segmentKey canonical form, resolveRef() 6-level priority chain, file slot semantics
- Structured output: JSON Schema validation (ajv), named artifact delimiter parsing, fieldPath deep access, revalidate/AI-fix
- Word/PDF export upgrade: state-machine Markdown parser for tables, nested lists, code blocks
- System/User prompt separation: dual prompt resolution, strategy-aware routing
- Conditional node execution: skip/block rules, ExecutionRuleEditor, blocked node rollback

### What Worked
- **Design doc as single source of truth**: `flow-node-capability-analysis.md` defined all gaps with current-state evidence, type definitions, and acceptance criteria. Plans mapped directly to design doc sections with zero ambiguity.
- **Parallel phase execution**: Phases 23/24 sequential (dependency chain), but 25 ran parallel with 24. Phase 26 after both. Optimal wave scheduling.
- **resolveRef as universal resolver**: The 6-level priority chain established in Phase 23 was reused unchanged by Phase 24 (fieldPath), Phase 25 (system prompt), and Phase 26 (condition evaluation). Single investment, 4x payoff.
- **Fastest milestone**: 14 plans in ~4.5 hours, averaging ~4 min per plan including planning/research.

### What Was Inefficient
- **ROADMAP plan checkboxes stale**: Phases 23/24 plan checkboxes in ROADMAP.md never updated to [x] during execution (cosmetic but caused confusion during milestone readiness check).
- **No separate REQUIREMENTS.md for v1.2**: Requirements tracked only in PROJECT.md Active section, making archival awkward (had to derive requirements from design doc).

### Patterns Established
- segmentKey as canonical form for all variable references across node types
- resolveRef() as single variable resolution entry point (replaces scattered resolvePromptTemplate calls)
- State-machine parser pattern for multi-format document rendering
- Collapsible System Prompt section with add/remove lifecycle

### Key Lessons
1. **Design docs with current-state evidence eliminate planning overhead** — when the design doc shows exactly what exists vs what's needed, research phases become verification instead of discovery.
2. **Universal resolver functions pay compound interest** — resolveRef() was the best investment of v1.2, reused by every subsequent phase.
3. **Create REQUIREMENTS.md for every milestone at init time** — even if requirements come from a design doc, having a structured file simplifies archival.

### Cost Observations
- Model mix: Sonnet for execution, Opus for planning
- 14 plans across ~4 sessions in 1 day
- Notable: highest velocity milestone — design doc quality directly correlated with execution speed

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Plans | Avg/Plan | Key Change |
|-----------|----------|--------|-------|----------|------------|
| v1.0 | 7 days | 16 | 50 | ~6 min | Iterative audit-driven gap closure; 5 core → 16 |
| v1.1 | 2 days | 6 | 23 | ~3 min | Schema-first + parallel feature tracks; raw fetch pattern |
| v1.2 | 4.5 hrs | 4 | 14 | ~4 min | Design-doc-driven; universal resolver pattern |

### Top Lessons (Verified Across Milestones)

1. **Small focused plans maintain velocity** — 2-3 tasks per plan, consistent across all 3 milestones (6→3→4 min avg)
2. **Shared types as contracts** — changes to shared types ripple predictably. segmentKey (v1.2) followed the same pattern as Eden Treaty types (v1.0)
3. **Schema/foundation first, then parallel tracks** — v1.0 (Phases 1-4 → 5), v1.1 (Phase 17 → 18-20), v1.2 (Phase 23 → 24+25). Consistent pattern that enables parallelism.
4. **Design docs with evidence eliminate rework** — v1.0 needed 6 gap-closure phases; v1.2 (with detailed design doc) needed zero. Investment in upfront analysis pays off.
5. **Universal abstractions compound** — resolveRef() in v1.2 reused 4x; route split pattern in v1.0 reused across all modules. Build once, reuse many.
