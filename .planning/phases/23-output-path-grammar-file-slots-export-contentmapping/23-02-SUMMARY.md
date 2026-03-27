---
phase: 23-output-path-grammar-file-slots-export-contentmapping
plan: 02
subsystem: api
tags: [resolveRef, segmentKey, fieldsByKey, fileSlots, contentMapping, export, variable-resolution]

# Dependency graph
requires:
  - phase: 23-output-path-grammar-file-slots-export-contentmapping
    provides: segmentKey on OutputDef, VariableRef with fieldPath, FormFieldDef with fileSlotId/fileSlotLabel
provides:
  - resolveRef() with 6-level priority chain for segmentKey-based variable resolution
  - fieldsByKey and fileSlots in confirmInputTransform outputData
  - contentMapping-driven export content assembly via resolveRef
  - loadNodeConfig helper for loading ExportConfig from workflow JSONB
affects: [23-03, phase-24, phase-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveRef 6-level priority: fieldsByKey -> fields -> fileSlots -> namedOutputs -> models -> direct property"
    - "contentMapping resolution with skip-on-failure + console.warn for missing refs"
    - "loadNodeConfig pattern: nodeExecution -> document -> workflow -> nodes JSONB -> config"

key-files:
  created: []
  modified:
    - packages/backend/src/modules/runtime/model-call.service.ts
    - packages/backend/src/modules/runtime/input-transform.service.ts
    - packages/backend/src/modules/runtime/export.service.ts

key-decisions:
  - "resolveRef uses 6-level priority chain matching the research spec exactly"
  - "Failed contentMapping refs are skipped with console.warn, not errors (per user constraint)"
  - "Empty contentMapping falls through to existing upstream-scan logic for backward compatibility"
  - "buildFileSlots validates slotId against formField definitions to prevent stale references"

patterns-established:
  - "resolveRef: canonical variable resolution function, reusable across model-call and export services"
  - "loadNodeConfig: reusable pattern for loading any node config from workflow JSONB via document join"

requirements-completed: [OUTPUT-PATH-02, FILE-SLOT-02, EXPORT-CM-02]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 23 Plan 02: Backend Runtime - resolveRef + fileSlots + Export ContentMapping Summary

**resolveRef() with 6-level priority chain for segmentKey resolution, fileSlots aggregation in input transform outputData, and contentMapping-driven export content assembly**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T03:09:43Z
- **Completed:** 2026-03-27T03:14:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extracted resolveRef() from resolvePromptTemplate() with 6-level priority chain (fieldsByKey, fields, fileSlots, namedOutputs, models, direct property)
- Added fileSlots aggregation to confirmInputTransform outputData, grouping files by fileSlotId with concatenated parsedText
- Wired export contentMapping resolution via loadNodeConfig() + resolveRef(), with backward-compatible fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract resolveRef() and refactor resolvePromptTemplate + update confirmInputTransform** - `c328342` (feat)
2. **Task 2: Wire export contentMapping via loadNodeConfig + resolveRef** - `577c5f1` (feat)

## Files Created/Modified
- `packages/backend/src/modules/runtime/model-call.service.ts` - Extracted resolveRef() with 6-level priority chain, refactored resolvePromptTemplate() to delegate to it
- `packages/backend/src/modules/runtime/input-transform.service.ts` - Added fileSlots to outputData, extended fileOutputs with optional slotId, added buildFileSlots helper
- `packages/backend/src/modules/runtime/export.service.ts` - Added loadNodeConfig(), updated resolveContent() with contentMapping support, wired generateExport() and getExportPreview()

## Decisions Made
- resolveRef uses 6-level priority chain matching the research spec exactly
- Failed contentMapping refs are skipped with console.warn, not errors (per user constraint from CONTEXT.md)
- Empty contentMapping falls through to existing upstream-scan logic for full backward compatibility
- buildFileSlots validates slotId against formField definitions to prevent stale/invalid references

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- resolveRef() exported and ready for frontend VariablePicker preview in 23-03
- fileSlots in outputData ready for frontend file slot rendering in 23-03
- contentMapping fully functional for export config panels in 23-03
- namedOutputs stub (priority level 4) ready for Phase 24 structured output implementation

---
*Phase: 23-output-path-grammar-file-slots-export-contentmapping*
*Completed: 2026-03-27*
