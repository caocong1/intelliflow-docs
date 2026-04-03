---
phase: 27-permission-security
plan: "01"
subsystem: backend / authorization
tags: [permissions, auth, write-authorization, phase-27]
dependency_graph:
  requires: []
  provides:
    - id: "canEditDocument-helper"
      type: "function"
      path: "packages/backend/src/modules/versions/versions.service.ts"
  affects:
    - "runtime write routes (future Phase 27 plans)"
tech_stack:
  added:
    - "Drizzle ORM query (leftJoin + role = 'owner' check)"
  patterns:
    - "Creator-or-owner boolean check"
    - "Single shared helper for Phase 27 write policy"
key_files:
  created: []
  modified:
    - path: "packages/backend/src/modules/versions/versions.service.ts"
      change: "Added canEditDocument() export beside existing isDocumentProjectMember()"
decisions:
  - |
    Query pattern: leftJoin projectMembers filtering on role='owner' in the join
    condition rather than a CASE WHEN in the select, so non-owner memberships are
    excluded from the result set and we only need a null-check on the row.
key_links:
  - "versions.service.ts::canEditDocument -> documents.createdBy + projectMembers.role='owner'"
metrics:
  duration: "2 minutes"
  completed: "2026-04-03T08:09:00Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 27 Plan 01: Add canEditDocument Write-Authorization Helper

## One-liner

Added `canEditDocument(documentId, userId)` returning true for document creator or project owner, as the shared write-access gate for Phase 27 runtime routes.

## Completed Tasks

| # | Name | Commit | Verification |
|---|------|--------|--------------|
| 1 | Add canEditDocument() beside the existing membership helper | 4738032 | `bunx tsc --noEmit` passes for versions.service.ts; TypeScript errors only in unrelated files (statistics.service.ts, migration scripts) |

## What Was Built

`canEditDocument(documentId, userId)` exported from `packages/backend/src/modules/versions/versions.service.ts`:

- Selects the document row left-joined with `projectMembers` where `projectId` matches and `userId` matches and `role = 'owner'`
- Returns `true` when either `documents.createdBy === userId` or the owner membership row is non-null
- Returns `false` when the document does not exist or the user has no qualifying membership
- `isDocumentProjectMember()` is preserved unchanged for read-only route plans

## Acceptance Criteria — All Met

- [x] `export async function canEditDocument(documentId: string, userId: string): Promise<boolean>` present
- [x] Checks `documents.createdBy` for creator identity
- [x] Checks `projectMembers.role === 'owner'` for project ownership
- [x] `isDocumentProjectMember` still exported unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Auth Gates

None.

## Deferred Issues (Out of Scope)

TypeScript reports 8 `TS2578: Unused '@ts-expect-error'` directives in `packages/backend/src/modules/statistics/statistics.service.ts` and 2 type errors in migration scripts. These are pre-existing issues in unrelated files and do not affect the Phase 27 helper.

---

## Self-Check: PASSED

- Commit `4738032` exists: YES
- `versions.service.ts` modified: YES
- `canEditDocument` exported: YES
- `isDocumentProjectMember` preserved: YES
