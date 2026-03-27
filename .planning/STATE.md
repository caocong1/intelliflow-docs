---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: 运营增强与智能编辑
status: unknown
last_updated: "2026-03-27T04:28:49.709Z"
progress:
  total_phases: 26
  completed_phases: 24
  total_plans: 83
  completed_plans: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** 用户能跑通完整流程生成高质量文档 — 从输入到多模型并行生成、对比迭代、脱敏恢复、最终导出
**Current focus:** Phase 23 complete — Output Path Grammar + File Slots + Export ContentMapping, all 3 plans done

## Current Position

Phase: 24 of 26 (Structured Output + Named Artifacts + Field References)
Plan: 4 of 4
Status: In Progress
Last activity: 2026-03-27 — Completed 24-04 (tree-based field picker and multi-level fieldPath highlighting)

Progress: [███████████████████░] 97%

## Performance Metrics

**Velocity:**
- Total plans completed: 50 (v1.0)
- v1.1 plans completed: 12
- Average duration: 3min
- Total execution time: 3min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |
| Phase 17 P01 | 3min | 2 tasks | 5 files |
| Phase 17 P02 | 3min | 2 tasks | 3 files |
| Phase 18 P01 | 6min | 2 tasks | 7 files |
| Phase 18 P02 | 3min | 2 tasks | 4 files |
| Phase 18 P03 | 6min | 2 tasks | 3 files |
| Phase 18 P04 | 4min | 2 tasks | 6 files |
| Phase 18 P05 | 1min | 1 tasks | 1 files |
| Phase 18 P06 | 3min | 2 tasks | 3 files |
| Phase 19-01 P01 | 3min | 2 tasks | 5 files |
| Phase 19-02 P02 | 4min | 2 tasks | 8 files |
| Phase 19-03 P03 | 2min | 2 tasks | 2 files |
| Phase 19-04 P04 | 2min | 2 tasks | 4 files |
| Phase 19-05 P05 | 2min | 2 tasks | 4 files |
| Phase 19 P06 | 2min | 2 tasks | 6 files |
| Phase 20-01 P01 | 3min | 2 tasks | 5 files |
| Phase 20-02 P02 | 4min | 2 tasks | 8 files |
| Phase 20-03 P03 | 2min | 2 tasks | 5 files |
| Phase 21-01 P01 | 3min | 2 tasks | 3 files |
| Phase 21-02 P02 | 3min | 2 tasks | 5 files |
| Phase 21-03 P03 | 5min | 3 tasks | 2 files |
| Phase 22-01 P01 | 2min | 2 tasks | 3 files |
| Phase 22-02 P02 | 5min | 2 tasks | 3 files |
| Phase 22-03 P03 | 3min | 2 tasks | 3 files |
| Phase 23-01 P01 | 3min | 2 tasks | 5 files |
| Phase 23 P02 | 3min | 2 tasks | 3 files |
| Phase 24 P01 | 7min | 2 tasks | 5 files |
| Phase 23 P03 | 5min | 3 tasks | 5 files |
| Phase 24 P02 | 5min | 2 tasks | 3 files |
| Phase 24 P04 | 6min | 2 tasks | 2 files |
| Phase 24 P03 | 7min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 scope]: Quota management (QUOT-01~03) deferred to v2 — admins need usage visibility before setting limits
- [v1.1 scope]: No new infrastructure dependencies — in-process background execution with PostgreSQL, pg_trgm for search
- [17-01]: Migration history reset — clean baseline with single generated + one custom SQL migration
- [17-01]: Polymorphic target_id (no FK) for favorites/recent-access tables — enforced at app layer
- [Phase 17]: Unified HAS_ASSOCIATIONS error with structured data replaces separate workflow/document error codes
- [Phase 18]: Auto-confirm desensitize detections in background mode, auto-select first model output
- [Phase 18]: Fire-and-forget pipeline with immediate queued response and async error capture
- [Phase 18]: WeChat push titles use plain text for enterprise compatibility; notification helpers kept in background.service.ts for cohesion
- [18-03]: Frontend switches from step-by-step advance to single background execution call; 3s workspace polling, 10s list polling
- [18-04]: Notification API helpers use raw fetch; Toast action uses window.location.href outside router context; Bell polls at 15s independently
- [18-05]: Per-user concurrent task limit (MAX=3) at module scope for easy tuning; count query on backgroundTasks table
- [18-06]: Tabbed NotificationDrawer with lazy-loaded task tab; GET /runtime/my-tasks joins backgroundTasks+documents+projects
- [19-01]: Cost estimation sums budgetUsedUsd + token-based pricing (not either/or); conditional JOINs for filter performance
- [19-01]: Dimension endpoints return { aggregation, trends } in single response for frontend chart+table rendering
- [19-02]: ECharts v6 installed (latest); tree-shakeable imports from echarts/core
- [19-02]: ChartContainer uses ResizeObserver + onCleanup for memory safety
- [19-02]: Filter state uses createStore with JSON.stringify key for createResource reactive refetching
- [19-03]: Each chart panel uses its own createResource for independent loading states
- [19-03]: Audit records flattened from by-document grouping into chronological list for table display
- [19-04]: Bar charts for dimension tabs — API returns aggregated summaries not time-series, bar visualization more appropriate
- [19-04]: WorkflowStats omits estimatedCost — API type does not include cost for workflow dimension
- [19-05]: Audit by-user expand reuses fetchAuditByDocument endpoint; by-document expand uses document-detail for node/model breakdown
- [19-05]: /admin/statistics route alias added alongside /admin/stats for backward compatibility
- [Phase 19]: Frontend-only fixes: backend API verified correct, only frontend types and components updated to match backend field names
- [20-01]: Batch name resolution via Map for polymorphic targets instead of per-row JOINs
- [20-01]: checkFavorites returns targetType:targetId string array for easy frontend Set lookup
- [20-01]: Upsert on unique constraint for recent access dedup, OFFSET-based eviction for 20-record cap
- [20-02]: Sidebar section "效率工具" groups search/favorites/recent access links between dashboard and workspace
- [20-02]: Dashboard favorites card flattens all types into single sorted list for at-a-glance view
- [20-02]: Workflows have no detail page link — displayed as plain text in search/favorites/recent results
- [20-03]: Frontend user-activity API client uses raw fetch (consistent with statistics.ts pattern); batch checkFavorites on list, single on detail pages
- [21-01]: Inline edit routes mounted in index.ts (not runtime.routes.ts) — consistent with existing pattern where each route file is independently mounted
- [21-01]: AppError statusCode preserved in route error handler for proper 403 on security constraint violations
- [21-02]: mouseup+keyup listeners instead of selectionchange for reliable textarea selection tracking
- [21-02]: onMouseDown+preventDefault on all toolbar buttons to prevent textarea blur clearing selection
- [21-02]: diff-match-patch with diff_cleanupSemantic for CJK-friendly character-level diffs
- [21-02]: SSE utility supports both GET and POST methods for inline edit endpoint flexibility
- [21-03]: IIFE guards with null returns instead of non-null assertions for Biome lint compliance in SolidJS JSX
- [21-03]: Models fetched via raw fetch /api/models on mount (fire-and-forget, non-blocking)
- [21-03]: validSelectedModelId memo auto-corrects model selection when security filtering changes available models
- [22-01]: FormFieldType extracted as named type alias for reuse across packages
- [22-01]: machineKey regex enforces identifier-style naming (no leading digits)
- [22-01]: Comma restriction on select options supports comma-joined multiselect storage
- [22-02]: Multiselect rendered as checkbox group (not native select multiple) for better UX
- [22-02]: Validation uses fieldErrors signal with per-field tracking, cleared on input change
- [22-02]: Default value "today" resolved at runtime via createEffect for date/datetime fields
- [22-03]: Workflow config loaded via workflowId JOIN (not workflowSnapshot) matching existing codebase pattern
- [22-03]: Variable resolution order: direct outputData key -> fields[UUID] -> fieldsByKey[machineKey]
- [22-03]: Validation errors collected and thrown as single AppError(400) with all field errors joined
- [23-01]: segmentKey optional on OutputDef for backward compatibility; validation uses o.segmentKey || o.id fallback
- [23-01]: File slots with fileSlotId generate fileslot-prefixed OutputDef; merged file-upload output kept for backward compat
- [23-01]: desensitize/restore segmentKey derived from src.outputId for consistent upstream reference
- [23-02]: resolveRef 6-level priority chain: fieldsByKey -> fields -> fileSlots -> namedOutputs -> models -> direct property
- [23-02]: Failed contentMapping refs skipped with console.warn (not errors), per user constraint
- [23-02]: Empty contentMapping falls through to existing upstream-scan logic for backward compatibility
- [24-01]: resolveFieldPath uses recursive descent with [*] array traversal returning JSON.stringify of mapped results
- [24-01]: Named output parsing falls back to _default artifact when delimiter markers not found
- [24-01]: AI fix endpoint streams repair via SSE and auto-validates fixed output
- [24-01]: Prompt injection order: desensitize rules > jsonSchema > namedOutputs delimiters
- [Phase 23]: Cross-type collision detection checks machineKey vs fileSlotId across all fields in same node
- [Phase 23]: HTML5 native drag events for contentMapping reorder; VariablePicker uses segmentKey for outputId with output.name for display
- [Phase 24]: CodeMirror 6 chosen for JSON Schema editor; per-artifact schema in expandable sections
- [24-04]: Schema tree recursion limited to 5 levels; $ref stops recursion without resolution
- [24-04]: Long fieldPath display abbreviated with full path in tooltip; parseVarKey handles both dot and bracket separators
- [Phase 24]: Used textarea for named output editing instead of InlineEditor for card simplicity

### Roadmap Evolution

v1.0: 5 core phases grew to 16 with gap-closure phases. 50 plans, 82 requirements.
v1.1: 5 phases (17-21), 25 requirements. Schema foundation first, then parallel feature tracks, AI editing last.
v1.2 (节点能力增强): Phases 22-26 added. Design doc: docs/design/flow-node-capability-analysis.md
  - Phase 22: Bug Fixes + Form Field Type Extension
  - Phase 23: Output Path Grammar + File Slots + Export ContentMapping
  - Phase 24: Structured Output + Named Artifacts + Field References
  - Phase 25: Export Table Rendering + System Prompt Separation (parallel with 24)
  - Phase 26: Conditional Node Execution

### Pending Todos

None.

### Blockers/Concerns

- SolidJS charting library for statistics dashboard needs validation before Phase 19 planning
- Markdown diff library for AI inline editing needs research before Phase 21 planning

## Session Continuity

Last session: 2026-03-27
Stopped at: Completed 24-04-PLAN.md (tree-based field picker and multi-level fieldPath highlighting)
Resume file: None
