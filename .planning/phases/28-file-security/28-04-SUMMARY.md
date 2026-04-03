---
phase: 28-file-security
plan: 04
subsystem: security
tags: [path-traversal, filename-sanitization, export, security, backend]

# Dependency graph
requires:
  - phase: 28-01
    provides: sanitizeFilename() and assertWithinRoot() in common/sanitize.ts
provides:
  - generateExport() sanitizes filenames before writing (FSEC-07)
  - downloadExport() validates storagePath against export root (FSEC-08)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [path-traversal-defense, defense-in-depth]

key-files:
  created: []
  modified:
    - packages/backend/src/modules/runtime/export.service.ts

key-decisions:
  - "generateExport keeps originalName as raw filename for display; only storagePath uses safeFilename"
  - "downloadExport assertWithinRoot throws AppError 400 (propagated by Elysia), not silent null return"

patterns-established:
  - "Defense in depth: sanitizeFilename on write, assertWithinRoot on read"

requirements-completed: [FSEC-07, FSEC-08]

# Metrics
duration: 1min
completed: 2026-04-03
---

# Phase 28 Plan 04: Export Path Traversal Defense Summary

**sanitizeFilename on generateExport write + assertWithinRoot on downloadExport read — both FSEC requirements met**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-03T08:38:14Z
- **Completed:** 2026-04-03T08:39:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- generateExport sanitizes the user-supplied filename with sanitizeFilename() before constructing the on-disk storage path (FSEC-07) — a malicious "../../../tmp/evil.pdf" becomes "tmp_evil_pdf" on disk
- downloadExport validates the DB-stored storagePath with assertWithinRoot() before readFile (FSEC-08) — a tampered "/tmp/evil.pdf" throws AppError 400 before any file is read
- originalName in the DB record and the download response filename remain the user's original display name

## Task Commits

Each task was committed atomically:

1. **Task 1+2: sanitizeFilename in generateExport + assertWithinRoot in downloadExport** - `6c9f813` (feat)

**Plan metadata:** N/A (single commit for both tasks)

## Files Created/Modified
- `packages/backend/src/modules/runtime/export.service.ts` - Added sanitizeFilename import and applied to generateExport storage path; added assertWithinRoot import and applied to downloadExport before readFile

## Decisions Made

- generateExport keeps originalName as the raw filename for display purposes (not sanitized) — only the storage path on disk is sanitized
- downloadExport lets assertWithinRoot throw AppError(400) which propagates via Elysia; tampered paths are rejected with HTTP 400, not silently served as null

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in statistics.service.ts and migration scripts (out of scope — deferred)
- export.service.ts compiles cleanly with no errors

## Next Phase Readiness

- Phase 28 (file-security) is now complete — all 4 plans done
- Phase 28 establishes full path traversal defense: sanitizeFilename applied at all file write points (files.service.ts, input-transform.service.ts, export.service.ts) and assertWithinRoot applied at all file read points (files.service.ts, export.service.ts)

---
*Phase: 28-file-security*
*Completed: 2026-04-03*
