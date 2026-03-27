---
phase: 24-structured-output-named-artifacts-field-references
plan: 03
subsystem: ui, runtime
tags: [solidjs, named-outputs, format-error, sse, revalidate, ai-fix, fallback-warning]

# Dependency graph
requires:
  - phase: 24-structured-output-named-artifacts-field-references
    provides: revalidate/ai-fix API endpoints, named output parsing, format_error status
provides:
  - NamedOutputCard component for rendering individual named output artifacts
  - format_error UI with revalidate and AI fix streaming in ModelCallExecutor
  - Named output card rendering grouped by model in executor and completed views
  - Fallback warning bar when delimiter parsing failed
affects: [24-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [format_error status badge and inline editing, SSE-based AI fix with adopt/cancel, named output card vertical list layout]

key-files:
  created:
    - packages/frontend/src/components/workspace/nodes/NamedOutputCard.tsx
  modified:
    - packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx
    - packages/frontend/src/components/workspace/completed/ModelCallCompleted.tsx

key-decisions:
  - "Used textarea for named output editing instead of InlineEditor to keep cards lightweight and avoid nested toolbar complexity"
  - "AI fix uses shared streamSSE utility for consistent SSE handling across the app"
  - "Named outputs in completed view filter by active model tab for multi-model scenarios"

patterns-established:
  - "format_error renders red error box with editable textarea and revalidate/AI-fix action buttons"
  - "Named output cards use NamedOutputCard component with readonly prop for completed vs executor views"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 24 Plan 03: Runtime UI for Format Error, Named Output Cards, and Fallback Warning Summary

**Format error display with revalidate/AI-fix buttons, NamedOutputCard component for per-artifact editing, and yellow fallback warning in both executor and completed views**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T04:20:53Z
- **Completed:** 2026-03-27T04:27:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- NamedOutputCard component with title bar, format badge (text/json/markdown), and editable textarea with save/cancel
- format_error status UI: red error box with bullet error messages, editable monospace textarea, revalidate button, AI fix with SSE streaming and adopt/cancel controls
- Named output cards rendered as vertical card list, grouped by model in multi-model mode
- Yellow fallback warning bar when model output was merged into single default artifact
- Completed view shows named output cards in readonly mode with format_error badge on model tabs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NamedOutputCard + extend ModelCallExecutor** - `54c09dc` (feat)
2. **Task 2: Extend ModelCallCompleted with named output cards** - `997435a` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/frontend/src/components/workspace/nodes/NamedOutputCard.tsx` - New card component for rendering a single named output artifact with format badge and edit capabilities
- `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx` - Extended with format_error error box, revalidate/AI-fix buttons, named output card rendering, fallback warning
- `packages/frontend/src/components/workspace/completed/ModelCallCompleted.tsx` - Extended with named output cards in readonly mode, fallback warning, format_error badge on model tabs

## Decisions Made
- Used textarea for named output editing instead of InlineEditor to keep cards lightweight and avoid nested toolbar complexity
- AI fix uses shared streamSSE utility for consistent SSE handling
- Named outputs in completed view filter by active model tab for multi-model scenarios

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All runtime UI for structured output features is in place
- Plan 24-04 (field reference picker / VariablePicker tree) can proceed independently
- Backend revalidate and ai-fix endpoints fully integrated with frontend

---
*Phase: 24-structured-output-named-artifacts-field-references*
*Completed: 2026-03-27*
