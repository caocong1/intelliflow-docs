---
phase: 05-document-creation-runtime
plan: 06
subsystem: api, ui
tags: [elysia, drizzle, solidjs, runtime, restore, desensitize]

requires:
  - phase: 05-01
    provides: "desensitizeMappings table, DesensitizeMapping type"
  - phase: 05-02
    provides: "Runtime orchestration service, DocumentWorkspace page"
  - phase: 05-04
    provides: "Desensitize mappings stored in DB via confirmDesensitization"
provides:
  - "Restore service with placeholder replacement and manual correction"
  - "REST API for restore operations at /runtime/:docId/restore/:nodeExecId"
  - "RestoreExecutor UI with side-by-side diff view and inline editing"
affects: [05-07]

tech-stack:
  added: []
  patterns: ["Placeholder replacement via string.replaceAll with per-mapping tracking", "Side-by-side diff with token-level highlighting", "Inline edit correction with server re-validation"]

key-files:
  created:
    - packages/backend/src/modules/runtime/restore.service.ts
    - packages/backend/src/modules/runtime/restore.routes.ts
    - packages/frontend/src/components/workspace/nodes/RestoreExecutor.tsx
  modified:
    - packages/backend/src/index.ts
    - packages/frontend/src/pages/workspace/DocumentWorkspace.tsx

key-decisions:
  - "Restoration tracks per-mapping status: restored=true if placeholder found and replaced, false if not found"
  - "Manual correction re-validates by checking if placeholder still exists in updated text"
  - "Paired desensitize node lookup resolves workflow nodeId to nodeExecution for scoped mapping query"

patterns-established:
  - "Restore executor 2-phase UI: execute -> review diff with inline correction"

requirements-completed: [NODE-17, NODE-18, NODE-19]

duration: 4min
completed: 2026-03-20
---

# Phase 05 Plan 06: Restore Node Executor Summary

**Placeholder replacement using stored desensitize mappings with side-by-side diff view, green/red highlights for success/failure, and inline manual correction for failed restorations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T10:26:02Z
- **Completed:** 2026-03-20T10:30:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Backend restore service with 2 core functions: executeRestore, updateRestoredText
- executeRestore loads desensitize mappings (scoped by paired node or all for document), replaces placeholders with original values, tracks per-mapping success/failure
- updateRestoredText accepts manually corrected text and re-validates restoration status
- REST API: POST execute, PUT text under /runtime/:docId/restore/:nodeExecId
- RestoreExecutor frontend component with 2-phase interactive flow
- Phase 1: "Start Restore" button triggers placeholder replacement
- Phase 2: Side-by-side diff — left panel shows desensitized text with amber placeholder highlights, right panel shows restored text with green (success) and red (failure) highlights
- Failed items listed below with click-to-edit inline correction
- Warning dialog when advancing with unrestored items
- Read-only mode for completed/history view
- Wired into DocumentWorkspace with nodeType === "restore" conditional rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: Restore backend — placeholder replacement and diff** - `a63005c` (feat)
2. **Task 2: Restore frontend — diff view with highlights and inline editing** - `1c6e32c` (feat)

## Files Created/Modified
- `packages/backend/src/modules/runtime/restore.service.ts` - executeRestore and updateRestoredText with mapping lookup and replacement tracking
- `packages/backend/src/modules/runtime/restore.routes.ts` - 2 REST endpoints: execute and text update
- `packages/backend/src/index.ts` - Registered restoreRoutes in Elysia app chain
- `packages/frontend/src/components/workspace/nodes/RestoreExecutor.tsx` - 2-phase executor with diff view and inline editing
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` - Added restore node type rendering

## Decisions Made
- Restoration tracks per-mapping status: restored=true if placeholder was found in text and replaced, false if not found (may have been modified by AI)
- Manual correction re-validates all restorations by checking if each placeholder still exists in the updated text
- Paired desensitize node: config.pairedDesensitizeNodeId is a workflow nodeId, resolved to nodeExecution ID for scoped mapping query

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Restore node executor complete; Plan 07 (export) can receive restored text as input
- RestoreExecutor follows established node executor component pattern
- All 5 node types now have executors (input_transform, desensitize, model_call, restore, export)

---
*Phase: 05-document-creation-runtime*
*Completed: 2026-03-20*
