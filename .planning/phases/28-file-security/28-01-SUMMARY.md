---
phase: 28-file-security
plan: 01
subsystem: security
tags: [path-traversal, filename-sanitization, security, backend]

# Dependency graph
requires: []
provides:
  - sanitizeFilename() - pure function stripping null bytes, path separators, leading dots
  - assertWithinRoot() - path traversal defense resolving and validating paths
affects: [phase-28-02, phase-28-03, phase-28-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function-security-utility, path-traversal-defense]

key-files:
  created: [packages/backend/src/common/sanitize.ts]
  modified: []

key-decisions:
  - "sanitizeFilename is pure TypeScript (no Node.js APIs) for testability"
  - "assertWithinRoot uses path.sep for cross-platform prefix check (Linux/Windows)"
  - "assertWithinRoot throws AppError 400 on traversal (not generic Error)"
  - "Both functions in single file for co-location of related security utilities"

patterns-established:
  - "Pure-function utilities: security functions without I/O are easier to test"
  - "Defense in depth: sanitizeFilename on input, assertWithinRoot on file access"

requirements-completed: [FSEC-01, FSEC-02]

# Metrics
duration: 38s
completed: 2026-04-03
---

# Phase 28 Plan 01: File Security Utilities Summary

**Two file security utility functions (sanitizeFilename and assertWithinRoot) for path traversal and filename injection defense**

## Performance

- **Duration:** 38s
- **Started:** 2026-04-03T08:29:39Z
- **Completed:** 2026-04-03T08:30:17Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Implemented `sanitizeFilename()` - pure TypeScript function stripping null bytes, path separators, and leading dots from user-supplied filenames
- Implemented `assertWithinRoot()` - Node.js path traversal defense using resolve() and strict prefix check
- Both functions exported from `packages/backend/src/common/sanitize.ts` and ready for import by file services

## Task Commits

Each task was committed atomically:

1. **Task 1 + 2: sanitizeFilename + assertWithinRoot** - `d560c60` (feat)

**Plan metadata:** N/A (single commit for both tasks)

## Files Created/Modified
- `packages/backend/src/common/sanitize.ts` - Security utility module exporting both functions

## Decisions Made

- `sanitizeFilename` is pure TypeScript (no Node.js imports) to allow unit testing without fs APIs
- `assertWithinRoot` uses `path.sep` for the prefix comparison so it works on both Linux and Windows
- Throws `AppError("Path traversal denied", 400)` on traversal to match the project's error pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `statistics.service.ts` and migration scripts (out of scope - deferred to `deferred-items.md`)
- `sanitize.ts` itself compiles cleanly with no errors

## Next Phase Readiness

- `sanitize.ts` ready to be imported by `files.service.ts` (plan 28-02), `input-transform.service.ts` (plan 28-03), and `export.service.ts` (plan 28-04)
- Both functions are implemented and TypeScript-verified

---
*Phase: 28-file-security*
*Completed: 2026-04-03*
