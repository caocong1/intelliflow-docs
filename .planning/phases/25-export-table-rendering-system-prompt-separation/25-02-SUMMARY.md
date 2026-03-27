---
phase: 25-export-table-rendering-system-prompt-separation
plan: 02
subsystem: api
tags: [system-prompt, model-call, strategy-pattern, drizzle, postgresql]

# Dependency graph
requires:
  - phase: 23-output-path-grammar-file-slots-export-contentmapping
    provides: resolvePromptTemplate function, ModelCallStrategy interface, model-call.service.ts
provides:
  - Optional systemPromptTemplate field on ModelCallConfig
  - Dual prompt resolution: system (no desensitize rules) + user (with desensitize rules)
  - System prompt passed through all call paths (execute, background, retry)
  - System prompt logged to DB with nullable column
  - OpenAI strategy sends system+user messages array
  - Claude strategy uses native top-level system param or prompt prepend
affects: [phase-25-frontend, phase-24-runtime]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strategy pattern extension: optional resolvedSystemPrompt param for backward-compatible interface change"
    - "Dual resolvePromptTemplate calls: once for system (empty rules), once for user (with desensitize rules)"
    - "Nullable DB column for backward-compatible schema evolution"

key-files:
  created:
    - packages/backend/drizzle/0008_add_model_call_logs_system_prompt.sql
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/db/schema.ts
    - packages/backend/src/modules/runtime/strategies/base.strategy.ts
    - packages/backend/src/modules/runtime/strategies/openai-compatible.strategy.ts
    - packages/backend/src/modules/runtime/strategies/claude-agent-sdk.strategy.ts
    - packages/backend/src/modules/runtime/model-call.service.ts
    - packages/backend/src/modules/runtime/model-call.routes.ts
    - packages/backend/src/modules/runtime/model-call-log.routes.ts

key-decisions:
  - "System prompt uses empty desensitize rules array — stays clean per user decision"
  - "Claude autonomous agent prepends system to prompt string — Agent SDK has no separate system param"
  - "DB column nullable — existing logs have no system prompt"
  - "Interface extension via optional parameter — backward compatible, no breaking changes"

patterns-established:
  - "Strategy interface optional param pattern: add optional field, strategies check if present"
  - "Dual template resolution pattern: call resolvePromptTemplate twice with different desensitize rules"

requirements-completed: [SYS-PROMPT-TYPE, SYS-PROMPT-BACKEND, SYS-PROMPT-STRATEGY, SYS-PROMPT-LOG]

# Metrics
duration: 254s
completed: 2026-03-27
---

# Phase 25 Plan 02: System Prompt Backend Support Summary

**Dual prompt resolution with optional systemPromptTemplate on ModelCallConfig: OpenAI strategy sends system+user messages array, Claude strategy uses native top-level system param, all three call paths (execute/background/retry) support dual prompts and log system prompt to DB.**

## Performance

- **Duration:** 4 min 14 sec
- **Started:** 2026-03-27T04:41:21Z
- **Completed:** 2026-03-27T04:45:35Z
- **Tasks:** 2
- **Files modified:** 9 (6 new, 3 modified)

## Accomplishments
- Added `systemPromptTemplate?: string` optional field to `ModelCallConfig` type (shared types)
- Extended `ModelCallStrategy.execute()` interface with optional `resolvedSystemPrompt` param
- OpenAI strategy builds messages array with optional system role message prepended
- Claude strategy uses top-level `system` param in simple_chat mode, prepends to prompt in autonomous mode
- Added nullable `system_prompt` column to `modelCallLogs` table with DB migration
- Dual prompt resolution: system prompt resolved without desensitize rules, user prompt with rules
- All three call paths (execute, background, retry) resolve and pass system prompt
- Log list API returns `systemPrompt` field for frontend display

## Task Commits

Each task was committed atomically:

1. **Task 1: Add systemPromptTemplate type + DB migration + strategy interface extension** - `84d27f3` (feat)
2. **Task 2: Dual prompt resolution in service + routes + log recording** - `d51bcbe` (feat)

## Files Created/Modified
- `packages/shared/src/types.ts` - Added optional `systemPromptTemplate` field to ModelCallConfig
- `packages/backend/src/db/schema.ts` - Added nullable `systemPrompt` column to modelCallLogs
- `packages/backend/drizzle/0008_add_model_call_logs_system_prompt.sql` - DB migration adding system_prompt column
- `packages/backend/src/modules/runtime/strategies/base.strategy.ts` - Added optional `resolvedSystemPrompt` to strategy interface
- `packages/backend/src/modules/runtime/strategies/openai-compatible.strategy.ts` - Messages array with optional system role
- `packages/backend/src/modules/runtime/strategies/claude-agent-sdk.strategy.ts` - Top-level system param (simple_chat) or prompt prepend (autonomous)
- `packages/backend/src/modules/runtime/model-call.service.ts` - Dual resolve, pass-through, log systemPrompt across execute/background/retry
- `packages/backend/src/modules/runtime/model-call.routes.ts` - System prompt resolution in execute and retry routes
- `packages/backend/src/modules/runtime/model-call-log.routes.ts` - Log list API returns systemPrompt field

## Decisions Made
- System prompt uses empty desensitize rules array to stay clean per user decision documented in 25-CONTEXT.md
- Claude autonomous agent mode prepends system prompt to the user prompt string since Agent SDK's `query()` has no separate system parameter
- DB column is nullable because existing logs predate the feature and should not require migration
- Strategy interface extended via optional parameter for backward compatibility — existing callers without `resolvedSystemPrompt` continue to work unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**Database migration required.** Run the following migration to add the new column:

```bash
cd packages/backend
bun run db:push
```

Or apply manually:
```sql
ALTER TABLE "model_call_logs" ADD COLUMN "system_prompt" text;
```

## Next Phase Readiness
- Backend full stack for system prompt separation is complete
- Plan 25-03 (frontend config panel + log display) can proceed immediately
- No blockers remaining for system prompt feature

---
*Phase: 25-export-table-rendering-system-prompt-separation*
*Completed: 2026-03-27*
