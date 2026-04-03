---
phase: 28-file-security
plan: 02
subsystem: security
tags: [path-traversal, membership-guard, storage-path, security, backend]

# Dependency graph
requires:
  - phase: 28-01
    provides: sanitizeFilename() and assertWithinRoot() in packages/backend/src/common/sanitize.ts
provides:
  - Server-controlled storagePath generation (uuid + sanitized filename, no client input)
  - isDocumentProjectMember guard on POST /files (403 for non-members)
  - isDocumentProjectMember guard on GET /files (403 for non-members)
affects: [phase-28-03, phase-28-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-controlled-paths, membership-gate, defense-in-depth]

key-files:
  created: []
  modified:
    - packages/backend/src/modules/files/files.routes.ts

key-decisions:
  - "storagePath removed from client body; server generates join(getUploadPath(documentId), uuid + sanitizeFilename(originalName))"
  - "isDocumentProjectMember guard on both POST and GET /files endpoints"
  - "originalName kept in body as display name (safe - never used for filesystem access)"
  - "All three tasks committed as one atomic change (same file, same commit)"

patterns-established:
  - "Server-side path generation: never trust client-supplied paths for filesystem operations"
  - "Membership gate pattern: isDocumentProjectMember before any document-scoped operation"

requirements-completed: [FSEC-03, FSEC-04, FSEC-05]

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 28 Plan 02: File Upload and Listing Security Summary

**Server-generated storage paths and membership-gated file upload/list endpoints — clients can no longer inject paths or access files from unauthorized documents**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T08:32:06Z
- **Completed:** 2026-04-03T08:34:46Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Removed `storagePath` from POST /files body schema; server generates it as `join(getUploadPath(documentId), randomUUID() + "_" + sanitizeFilename(originalName))`
- Added `isDocumentProjectMember` membership guard to POST /files (403 with "仅项目成员可上传文件" for non-members)
- Added `isDocumentProjectMember` membership guard to GET /files (403 with "仅项目成员可查看文件列表" for non-members)
- `originalName` retained in body as display name (safe — not used for filesystem access)

## Task Commits

All three tasks implemented in one atomic commit since they modify the same file:

1. **Task 1 + 2 + 3: storagePath injection fix + membership guards** - `da294e2` (fix)

## Files Created/Modified
- `packages/backend/src/modules/files/files.routes.ts` - Complete rewrite: server-side storagePath generation, membership guard on POST /files, membership guard on GET /files

## Decisions Made

- Kept `originalName` in the request body — it is the user-facing display name only, never used for filesystem access; `sanitizeFilename` is applied before embedding in the generated storagePath
- Single commit for all three tasks (same file, logically distinct tasks; atomic by implementation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `statistics.service.ts` and migration scripts (out of scope — documented in 28-01 deferred-items)
- Biome lint errors (non-null assertion, template literal preference) are style rules only — TypeScript compilation passes cleanly for files.routes.ts

## Next Phase Readiness

- `files.routes.ts` fully secured — ready for plan 28-03 (input-transform file sanitization) and plan 28-04 (export service path hardening)
- All three FSEC requirements (FSEC-03, FSEC-04, FSEC-05) now complete

---
*Phase: 28-file-security*
*Completed: 2026-04-03*
