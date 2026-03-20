---
phase: 05-document-creation-runtime
plan: 05
subsystem: api, ui
tags: [elysia, solidjs, sse, streaming, openai, model-call]

requires:
  - phase: 05-01
    provides: "nodeExecutions table, runtime types (ModelOutput, SSEEvent, ModelCallConfig)"
  - phase: 05-02
    provides: "Runtime orchestration service, workspace page with stepper"
  - phase: 05-04
    provides: "Desensitize service with getDesensitizeRules for prompt injection"
provides:
  - "Model call service with prompt resolution, SSE streaming, multi-model parallel execution"
  - "Model call routes: execute, retry, select, status"
  - "ModelCallExecutor component with streaming display, tabs, retry, selection"
  - "ModelCompareView for side-by-side comparison"
affects: [05-06, 05-07]

tech-stack:
  added: []
  patterns: ["SSE streaming via fetch ReadableStream (not EventSource) for auth header support", "Promise.allSettled for parallel model execution", "Multiplexed SSE events with modelId discrimination"]

key-files:
  created:
    - packages/backend/src/modules/runtime/model-call.service.ts
    - packages/backend/src/modules/runtime/model-call.routes.ts
    - packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx
    - packages/frontend/src/components/workspace/nodes/ModelCompareView.tsx
  modified:
    - packages/backend/src/index.ts
    - packages/frontend/src/pages/workspace/DocumentWorkspace.tsx

key-decisions:
  - "fetch+ReadableStream for SSE instead of EventSource — EventSource cannot send Authorization headers"
  - "Multiplexed SSE stream — all models share one stream with modelId-tagged events"
  - "Output selection stores content as both selectedContent and text for downstream compatibility"
  - "Simple inline markdown renderer instead of external library — keeps bundle small"

patterns-established:
  - "SSE streaming pattern: fetch with ReadableStream, parse data: lines, emit typed events"
  - "Model call pattern: resolve prompt -> parallel stream -> select output"

requirements-completed: [NODE-09, NODE-10, NODE-11, NODE-12, NODE-13, NODE-14, NODE-15, NODE-16]

duration: 5min
completed: 2026-03-20
---

# Phase 05 Plan 05: Model Call Node Executor Summary

**Model call executor with OpenAI-compatible SSE streaming, multi-model parallel execution, tab switching, side-by-side comparison, individual retry, and output selection**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T10:26:02Z
- **Completed:** 2026-03-20T10:31:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Prompt template resolution with {{nodeLabel.outputName}} variable substitution and desensitize rule injection
- OpenAI-compatible API streaming via fetch with SSE multiplexing for parallel multi-model execution
- Individual model retry that preserves other models' outputs
- Output selection storing selected content for downstream node consumption
- Frontend streaming display with per-model status badges and progressive markdown rendering
- Tab-based multi-model switching with side-by-side comparison view
- Radio-based output selection with auto-select for single model mode

## Task Commits

1. **Task 1: Model call backend** - `eee3799` (feat)
2. **Task 2: Model call frontend** - `a945b30` (feat)

## Files Created/Modified

- `packages/backend/src/modules/runtime/model-call.service.ts` — Prompt resolution, SSE streaming execution, retry, output selection
- `packages/backend/src/modules/runtime/model-call.routes.ts` — 4 endpoints: execute (SSE), retry (SSE), select, status
- `packages/backend/src/index.ts` — Registered modelCallRoutes
- `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx` — Streaming display, tabs, retry, selection UI
- `packages/frontend/src/components/workspace/nodes/ModelCompareView.tsx` — Side-by-side comparison with dropdown selectors
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` — Added model_call Match case

## Decisions Made

- fetch+ReadableStream for SSE instead of EventSource since EventSource cannot send Authorization headers
- All models stream through a single multiplexed SSE connection with modelId-tagged events
- Output selection stores content as both `selectedContent` and `text` keys for downstream compatibility
- Simple inline markdown renderer (headers, bold, italic, lists) instead of external library

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Model call executor complete; downstream nodes (restore, export) can consume selected model output
- SSE streaming pattern established for any future streaming needs

---
*Phase: 05-document-creation-runtime*
*Completed: 2026-03-20*
