---
phase: 17-schema-migration-tech-debt
plan: 01
subsystem: database
tags: [drizzle, postgresql, pg_trgm, zhparser, migration, schema]

# Dependency graph
requires: []
provides:
  - backgroundTasks table for async document generation (Phase 18)
  - userFavorites and userRecentAccess tables for dashboard features (Phase 19)
  - callSourceEnum inline_edit value for AI editing (Phase 21)
  - pg_trgm + zhparser search indexes for global search (Phase 20)
  - Clean migration baseline for all future schema changes
affects: [18-background-tasks, 19-dashboard-statistics, 20-global-search, 21-ai-inline-editing]

# Tech tracking
tech-stack:
  added: [pg_trgm, zhparser]
  patterns: [custom SQL migration for extensions/indexes alongside drizzle-kit generated migrations, polymorphic targetId without FK for favorites/recent-access]

key-files:
  created:
    - packages/backend/drizzle/0000_slimy_true_believers.sql
    - packages/backend/drizzle/0001_extensions_and_indexes.sql
  modified:
    - packages/backend/src/db/schema.ts
    - .gitignore

key-decisions:
  - "Migration history reset: deleted 6 inconsistent SQL files and regenerated clean 0000 migration"
  - "Polymorphic target_id columns (no FK) for favorites and recent-access tables — enforced at app layer"
  - "Custom SQL migration for extensions/indexes since drizzle-kit cannot manage pg_trgm/zhparser"

patterns-established:
  - "Custom SQL migrations: manually authored files added to drizzle journal for non-generatable DDL"
  - "Unique constraints via Drizzle table config callback for composite uniqueness"

requirements-completed: [DEBT-01]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 17 Plan 01: Schema Migration Reset Summary

**Clean migration baseline with 3 new v1.1 tables (backgroundTasks, userFavorites, userRecentAccess), extended callSourceEnum, and pg_trgm/zhparser search indexes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T04:02:49Z
- **Completed:** 2026-03-26T04:05:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Reset inconsistent migration history (1 journal entry vs 6 SQL files) to clean baseline
- Added 3 new tables and 4 new enums for v1.1 features (background tasks, favorites, recent access)
- Extended callSourceEnum with inline_edit for Phase 21 AI editing
- Created custom idempotent SQL migration with pg_trgm, zhparser extensions, 5 trigram indexes, 5 tsvector columns, 5 FTS indexes

## Task Commits

Each task was committed atomically:

1. **Task 1: Reset migration history and add new tables/enums to schema.ts** - `e2af89c` (feat)
2. **Task 2: Create custom SQL migration for PostgreSQL extensions and search indexes** - `4e1b135` (feat)

## Files Created/Modified
- `packages/backend/src/db/schema.ts` - Added backgroundTasks, userFavorites, userRecentAccess tables + 4 enums + inline_edit to callSourceEnum
- `packages/backend/drizzle/0000_slimy_true_believers.sql` - Clean generated migration with full schema (19 tables)
- `packages/backend/drizzle/0001_extensions_and_indexes.sql` - Custom migration for pg_trgm, zhparser, trigram indexes, tsvector columns, FTS indexes
- `packages/backend/drizzle/meta/_journal.json` - Migration journal with both entries
- `.gitignore` - Unignored drizzle/ directory to track migration files

## Decisions Made
- Reset migration history completely rather than adding incremental migrations on top of inconsistent state
- Used polymorphic target_id (no FK constraint) for userFavorites and userRecentAccess — allows referencing projects, documents, or workflows without complex FK setups
- Custom SQL migration for PostgreSQL extensions since drizzle-kit cannot generate extension/index DDL

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Unignored drizzle/ in .gitignore**
- **Found during:** Task 1 (committing migration files)
- **Issue:** Root .gitignore had `drizzle/` which prevented tracking migration files in git
- **Fix:** Commented out the `drizzle/` ignore rule since migration files should be version-controlled
- **Files modified:** .gitignore
- **Verification:** git add succeeded after fix
- **Committed in:** e2af89c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix — migration files must be tracked in version control. No scope creep.

## Issues Encountered
None beyond the gitignore deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete for all v1.1 phases (18-21)
- backgroundTasks table ready for Phase 18 background task implementation
- userFavorites and userRecentAccess tables ready for Phase 19 dashboard features
- Search indexes ready for Phase 20 global search
- callSourceEnum inline_edit ready for Phase 21 AI inline editing
- Plan 17-02 (tech debt cleanup) can proceed independently

---
*Phase: 17-schema-migration-tech-debt*
*Completed: 2026-03-26*
