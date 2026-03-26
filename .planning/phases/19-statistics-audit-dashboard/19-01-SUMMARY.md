---
phase: 19-statistics-audit-dashboard
plan: 01
subsystem: api
tags: [drizzle, postgresql, statistics, aggregation, admin-api]

requires:
  - phase: 05-runtime-execution
    provides: modelCallLogs table and runtime logging
  - phase: 17-schema-migration-tech-debt
    provides: clean schema baseline
provides:
  - 8 admin statistics API endpoints under /admin/statistics
  - Model pricing columns (inputPricePerMTok, outputPricePerMTok) for cost estimation
  - Performance indexes on model_call_logs for time-series queries
affects: [19-02, 19-03, 19-04, 19-05]

tech-stack:
  added: []
  patterns: [SQL date_trunc aggregation via drizzle, conditional JOIN pattern for filters, cost estimation with token pricing fallback]

key-files:
  created:
    - packages/backend/src/modules/statistics/statistics.service.ts
    - packages/backend/src/modules/statistics/statistics.routes.ts
    - packages/backend/drizzle/0006_add_model_pricing_and_stats_indexes.sql
  modified:
    - packages/backend/src/db/schema.ts
    - packages/backend/src/index.ts

key-decisions:
  - "Cost estimation combines budgetUsedUsd (agent SDK) with token-based pricing (models.inputPricePerMTok/outputPricePerMTok) — both summed, not either/or"
  - "Conditional JOINs: document/workflow/project tables only joined when filters require them, for better query performance"
  - "Workflow and document audit queries always join full chain (modelCallLogs -> documents -> workflows -> projects) since they need those dimensions"

patterns-established:
  - "Statistics filter pattern: shared StatisticsFilters type with buildFilterConditions helper"
  - "Dimension endpoint pattern: return { aggregation, trends } in single response for chart + table rendering"

requirements-completed: [STAT-01, STAT-02, STAT-03, STAT-05, STAT-06, STAT-07]

duration: 3min
completed: 2026-03-26
---

# Phase 19 Plan 01: Backend Statistics API Summary

**8 admin statistics endpoints with SQL aggregation for KPIs, trends, and per-model/user/workflow drill-downs using drizzle date_trunc and token-based cost estimation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T08:50:06Z
- **Completed:** 2026-03-26T08:53:01Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Schema migration adding model pricing columns and 3 performance indexes on model_call_logs
- Statistics service with 11 query functions covering all aggregation dimensions (overview, trends, by-model, by-user, by-workflow, audit)
- 8 admin-only API endpoints with shared filter params (dateFrom, dateTo, granularity, projectId, documentTypeId, workflowId, department)
- Cost estimation combining Agent SDK budgetUsedUsd with token-based pricing from model configuration

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + model pricing columns** - `2904379` (feat)
2. **Task 2: Statistics service + routes** - `79f5687` (feat)

## Files Created/Modified
- `packages/backend/drizzle/0006_add_model_pricing_and_stats_indexes.sql` - Migration for pricing columns and performance indexes
- `packages/backend/src/db/schema.ts` - Added inputPricePerMTok, outputPricePerMTok to models table
- `packages/backend/src/modules/statistics/statistics.service.ts` - 11 aggregation query functions with shared filter logic
- `packages/backend/src/modules/statistics/statistics.routes.ts` - 8 admin-only endpoints under /admin/statistics
- `packages/backend/src/index.ts` - Registered statisticsRoutes

## Decisions Made
- Cost estimation sums budgetUsedUsd (from Agent SDK calls) and token-based pricing (from model config) rather than using one or the other
- Conditional JOINs applied only when filters require document/workflow/project tables, avoiding unnecessary joins for simple date-range queries
- Dimension endpoints (by-model, by-user, by-workflow) return both aggregation and trends in a single response for frontend efficiency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 statistics API endpoints ready for frontend dashboard consumption (19-02 through 19-05)
- Model pricing columns available for admin configuration UI

---
*Phase: 19-statistics-audit-dashboard*
*Completed: 2026-03-26*
