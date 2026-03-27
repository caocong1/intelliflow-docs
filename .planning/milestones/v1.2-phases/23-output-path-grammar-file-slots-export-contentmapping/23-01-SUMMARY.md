---
phase: 23-output-path-grammar-file-slots-export-contentmapping
plan: 01
subsystem: api, database, ui
tags: [segmentKey, OutputDef, VariableRef, FormFieldDef, derive-outputs, validation, file-slots]

# Dependency graph
requires:
  - phase: 22-bug-fixes-form-field-type-extension
    provides: FormFieldType union, machineKey field, derive-outputs machineKey support
provides:
  - OutputDef.segmentKey for canonical variable path resolution
  - VariableRef.fieldPath for nested JSON field access (Phase 24)
  - FormFieldDef.fileSlotId/fileSlotLabel for file slot semantics
  - segmentKey-aware derive-outputs for all node types (input_transform, model_call, desensitize, restore)
  - documentFiles.slotId column for file-slot association
  - validation.ts segmentKey uniqueness check (Rule 11)
  - validation.ts Rule 7 updated to use segmentKey format
affects: [23-02, 23-03, phase-24]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "segmentKey as canonical variable path identifier in OutputDef"
    - "Type-prefixed OutputDef.id: field-{key}, fileslot-{slotId}, model-{modelId}"
    - "outputIdSet built from segmentKey for variable reference validation"

key-files:
  created:
    - packages/backend/drizzle/0007_add_document_files_slot_id.sql
  modified:
    - packages/shared/src/types.ts
    - packages/frontend/src/lib/flow-engine/derive-outputs.ts
    - packages/backend/src/db/schema.ts
    - packages/backend/src/modules/workflows/validation.ts

key-decisions:
  - "segmentKey is optional on OutputDef (backward compatible with existing data)"
  - "validation.ts uses o.segmentKey || o.id fallback for pre-existing workflows without segmentKey"
  - "File slots with fileSlotId generate fileslot-prefixed OutputDef; merged file-upload output kept for backward compat"
  - "desensitize/restore segmentKey derived from src.outputId for consistent upstream reference"

patterns-established:
  - "segmentKey: canonical variable path identifier, used in OutputDef and validation"
  - "Type-prefixed OutputDef.id pattern: {nodeId}-{type}-{segmentKey}"

requirements-completed: [OUTPUT-PATH-01, FILE-SLOT-01, EXPORT-CM-01]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 23 Plan 01: Foundation Types + Derive-Outputs + Schema + Validation Summary

**segmentKey-based output path grammar in shared types, derive-outputs with type-prefixed IDs, documentFiles.slotId column, and validation.ts segmentKey uniqueness/reference checks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T03:04:17Z
- **Completed:** 2026-03-27T03:07:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended OutputDef with segmentKey, VariableRef with fieldPath, FormFieldDef with fileSlotId/fileSlotLabel
- Rewrote derive-outputs to generate segmentKey for all node types with type-prefixed IDs (field/fileslot/model)
- Added documentFiles.slotId nullable column with migration SQL
- Added segmentKey cross-type uniqueness validation (Rule 11) and updated Rule 7 to use segmentKey format

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend shared types + derive-outputs with segmentKey and file slot support** - `332cd7e` (feat)
2. **Task 2: Add documentFiles.slotId column + update validation.ts for segmentKey** - `547d08b` (feat)

## Files Created/Modified
- `packages/shared/src/types.ts` - Added segmentKey to OutputDef, fieldPath to VariableRef, fileSlotId/fileSlotLabel to FormFieldDef
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` - segmentKey-aware output derivation for all 5 node types
- `packages/backend/src/db/schema.ts` - Added slotId column to documentFiles table
- `packages/backend/drizzle/0007_add_document_files_slot_id.sql` - Migration SQL for slot_id column
- `packages/backend/src/modules/workflows/validation.ts` - Rule 11 (segmentKey uniqueness) + Rule 7 updated for segmentKey

## Decisions Made
- segmentKey is optional on OutputDef for backward compatibility with existing workflows
- validation.ts uses `o.segmentKey || o.id` fallback so pre-existing workflows without segmentKey still validate
- File fields with fileSlotId generate separate fileslot-prefixed outputs; merged file-upload output preserved for backward compat
- desensitize/restore nodes derive segmentKey from src.outputId for consistent upstream variable reference

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shared types and derive-outputs ready for 23-02 (backend runtime: resolveRef, confirmInputTransform fileSlots, export contentMapping resolution)
- validation.ts segmentKey checks ready for frontend variable picker integration in 23-03
- documentFiles.slotId column ready for file slot upload association

---
*Phase: 23-output-path-grammar-file-slots-export-contentmapping*
*Completed: 2026-03-27*
