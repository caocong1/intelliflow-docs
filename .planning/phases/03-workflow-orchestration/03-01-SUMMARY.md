---
phase: 03-workflow-orchestration
plan: "01"
subsystem: api
tags: [drizzle, postgres, jsonb, elysia, workflow, validation]

# Dependency graph
requires:
  - phase: 02-model-management
    provides: providers and models tables; requireAdmin guard pattern
  - phase: 06-document-types
    provides: documentTypes table referenced by workflows FK
provides:
  - Shared workflow TypeScript types (WorkflowNodeDef, WorkflowEdgeDef, NodeConfig union, Workflow, WorkflowListItem)
  - workflows table with JSONB nodes/edges columns
  - 9 REST endpoints at /api/workflows for workflow CRUD, copy, status, set-default, validate
  - validateWorkflow() engine with 6 structural rules
affects: [03-02, 03-03, frontend-workflow-list, frontend-workflow-canvas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB columns typed with Drizzle .$type<T>() for full TypeScript inference"
    - "Validation engine as pure function (nodes, edges) => errors[] for testability"
    - "Transaction pattern for atomic set-default (unset-all then set-one)"
    - "Status gate: validateWorkflow called before allowing draft->active transition"

key-files:
  created:
    - packages/backend/src/modules/workflows/validation.ts
    - packages/backend/src/modules/workflows/workflows.service.ts
    - packages/backend/src/modules/workflows/workflows.routes.ts
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/db/schema.ts
    - packages/backend/src/index.ts
    - packages/backend/tsconfig.json

key-decisions:
  - "Disabled declaration emit (declaration: false) in backend tsconfig — backend runs via Bun, not tsc compilation; avoids rootDir cross-package constraint"
  - "Added paths mapping for @intelliflow/shared in backend tsconfig so tsc can resolve the workspace package"
  - "listWorkflows uses jsonb_array_length() SQL expression for nodeCount — avoids loading full graph data in list view"
  - "toggleWorkflowStatus rejects draft->active transition if validateWorkflow returns any error-severity items"
  - "setDefaultWorkflow uses db.transaction() to atomically unset all and set one — prevents two defaults"

patterns-established:
  - "Validation engine: pure function validateWorkflow(nodes, edges) returning WorkflowValidationError[] — no DB access, fully testable"
  - "Cross-package type import: backend imports shared types via @intelliflow/shared with tsconfig paths mapping"

requirements-completed: [FLOW-01, FLOW-10, FLOW-11, FLOW-12]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 3 Plan 01: Workflow Types, DB Schema, and CRUD API Summary

**Drizzle-typed JSONB workflows table, shared TypeScript node/edge types, and 9-endpoint REST API with structural graph validation engine**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-19T10:51:57Z
- **Completed:** 2026-03-19T10:57:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added 14 new TypeScript types/interfaces to shared package covering all 5 node configs, graph primitives, validation errors, and Workflow/WorkflowListItem entities
- Created workflows DB table with JSONB-typed nodes/edges columns using Drizzle's `.$type<>()` for full type inference
- Implemented validateWorkflow() covering 6 structural rules: required node types, orphan detection, cycle detection (Kahn's algorithm), desensitize-restore pairing, and required field checks
- Implemented complete service layer: paginated list (with JOIN for document type name and SQL nodeCount), CRUD, validation-gated status toggle, cross-document-type copy, and transactional set-default

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types and DB schema for workflows** - `23b5248` (feat)
2. **Task 2: Backend workflow CRUD API + validation engine** - `d5136fe` (feat)

## Files Created/Modified

- `packages/shared/src/types.ts` - Added WorkflowNodeType, WorkflowStatus, all node config types, WorkflowNodeDef, WorkflowEdgeDef, WorkflowValidationError, Workflow, WorkflowListItem
- `packages/backend/src/db/schema.ts` - Added workflowStatusEnum and workflows table with JSONB columns
- `packages/backend/tsconfig.json` - Disabled declaration emit; added @intelliflow/shared paths mapping for tsc
- `packages/backend/src/modules/workflows/validation.ts` - Pure validateWorkflow() function with 6 rules
- `packages/backend/src/modules/workflows/workflows.service.ts` - Full service layer: list, get, create, update, delete, copy, toggleStatus, setDefault
- `packages/backend/src/modules/workflows/workflows.routes.ts` - 9 Elysia endpoints with requireAdmin guard
- `packages/backend/src/index.ts` - Registered workflowRoutes

## Decisions Made

- Disabled `declaration: true` in backend tsconfig — the backend is run by Bun directly, so type declarations are not needed and removing this constraint allows `@intelliflow/shared` to be imported across workspace package boundaries via tsconfig `paths`
- Used `jsonb_array_length()` SQL expression for nodeCount in list queries — avoids deserializing full node arrays for list pages
- Validation gate on status transition: `toggleWorkflowStatus` calls `validateWorkflow` and throws `WORKFLOW_VALIDATION_FAILED` if any error-severity issues exist when activating a workflow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added tsconfig paths and disabled declaration emit to resolve @intelliflow/shared import**
- **Found during:** Task 1 (shared types and DB schema)
- **Issue:** `bunx tsc` failed with TS2307 "Cannot find module '@intelliflow/shared'" because moduleResolution "bundler" doesn't resolve Bun workspace packages without explicit paths. With `rootDir: ./src` also set, cross-package paths caused TS6059. Removed `rootDir` constraint and `declaration: true`, then added paths mapping.
- **Fix:** Set `declaration: false`, `declarationMap: false`, removed `rootDir` from backend tsconfig; added `"paths": { "@intelliflow/shared": ["../shared/src/types.ts"] }`
- **Files modified:** packages/backend/tsconfig.json
- **Verification:** `bunx tsc --noEmit` passes with no errors
- **Committed in:** `23b5248` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — tsconfig resolution)
**Impact on plan:** Necessary for tsc type checking to work across Bun workspaces. No scope creep.

## Issues Encountered

None beyond the tsconfig resolution issue documented above.

## Next Phase Readiness

- workflows table schema is ready — run `bun run db:push` to apply migration
- All shared types exported and importable by frontend via `@intelliflow/shared`
- 9 REST endpoints available for frontend workflow list page and canvas editor
- No blockers for Phase 3 Plan 02 (frontend workflow management list)

---
*Phase: 03-workflow-orchestration*
*Completed: 2026-03-19*
