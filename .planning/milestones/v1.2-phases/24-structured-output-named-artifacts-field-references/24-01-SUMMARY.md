---
phase: 24-structured-output-named-artifacts-field-references
plan: 01
subsystem: api, runtime
tags: [ajv, json-schema, named-outputs, field-path, validation, sse]

# Dependency graph
requires:
  - phase: 23-output-path-grammar-file-slots-export-contentmapping
    provides: resolveRef 6-level priority chain, segmentKey-based variable resolution
provides:
  - resolveFieldPath() for deep JSON access with dot/bracket/[*] traversal
  - validateModelOutput() 2-layer JSON validation (syntax + ajv schema)
  - parseNamedOutputs() delimiter extraction with _default fallback
  - resolveRef fieldPath support for namedOutputs, models, and direct properties
  - Multi-level fieldPath in prompt template {{nodeId.segmentKey.field.path}} syntax
  - JSON Schema and named output delimiter auto-injection into prompts
  - namedOutputs validation (ID format, uniqueness, segmentKey collision)
  - derive-outputs namedOutputs mode generating per-artifact OutputDef
  - POST revalidate endpoint for re-checking JSON after manual edit
  - POST ai-fix endpoint for streaming JSON repair using same model
affects: [24-02, 24-03, 24-04, 25-export-table-rendering-system-prompt-separation]

# Tech tracking
tech-stack:
  added: [ajv@8.18.0]
  patterns: [2-layer output validation, delimiter-based named output parsing, fieldPath deep access]

key-files:
  modified:
    - packages/backend/src/modules/runtime/model-call.service.ts
    - packages/backend/src/modules/runtime/model-call.routes.ts
    - packages/backend/src/modules/workflows/validation.ts
    - packages/frontend/src/lib/flow-engine/derive-outputs.ts

key-decisions:
  - "resolveFieldPath uses recursive descent with [*] array traversal returning JSON.stringify of mapped results"
  - "Named output parsing falls back to _default artifact when delimiter markers not found in content"
  - "AI fix endpoint streams repair via SSE and auto-validates fixed output"
  - "Prompt injection appends schema/delimiter instructions after desensitize rules"

patterns-established:
  - "2-layer validation: JSON.parse syntax check then ajv schema validation"
  - "Delimiter format: ===OUTPUT:id=== / ===END:id=== for named output extraction"
  - "fieldPath resolution: dot.key, bracket[N], and [*] traversal in resolveFieldPath"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 24 Plan 01: Structured Output & Named Artifacts Backend Foundation Summary

**JSON validation pipeline with ajv, named output delimiter parsing, deep fieldPath resolution, and revalidate/ai-fix API endpoints**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T04:09:50Z
- **Completed:** 2026-03-27T04:16:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Backend JSON validation pipeline with 2-layer validation (JSON.parse + ajv schema) integrated into model execution flow
- Named output delimiter parsing (===OUTPUT:id===) with fallback to _default when delimiters not found
- Deep fieldPath resolution supporting dot notation, bracket indices, and [*] array traversal
- Prompt injection for JSON Schema instructions and named output delimiter format
- Two new API endpoints: revalidate (re-check JSON after edit) and ai-fix (stream JSON repair)
- Frontend derive-outputs extended for namedOutputs mode
- Workflow validation extended for namedOutputs ID format/uniqueness and jsonSchema type checking

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend validation + derive-outputs** - `ba90e95` (feat)
2. **Task 2: Backend service + routes** - `cb4a5de` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/backend/src/modules/runtime/model-call.service.ts` - Added resolveFieldPath, validateModelOutput, parseNamedOutputs; extended resolveRef for fieldPath, resolvePromptTemplate for multi-level paths + prompt injection; integrated validation/parsing into execution flow
- `packages/backend/src/modules/runtime/model-call.routes.ts` - Added revalidate and ai-fix endpoints; passed config to resolvePromptTemplate and executeModelCall
- `packages/backend/src/modules/workflows/validation.ts` - Added namedOutputs ID validation, jsonSchema type validation, segmentKey collision check
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` - Extended model_call case for namedOutputs mode
- `packages/backend/package.json` - Added ajv dependency

## Decisions Made
- resolveFieldPath uses recursive descent with [*] array traversal returning JSON.stringify of mapped results
- Named output parsing falls back to _default artifact when delimiter markers not found in content
- AI fix endpoint streams repair via SSE and auto-validates fixed output
- Prompt injection appends schema/delimiter instructions after desensitize rules (order: desensitize > jsonSchema > namedOutputs)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All backend foundation for structured output and named artifacts is in place
- Frontend plans (24-02, 24-03, 24-04) can now build UI for JSON Schema editor, named output config, and field reference picker
- Types already extended in shared package from prior work

---
*Phase: 24-structured-output-named-artifacts-field-references*
*Completed: 2026-03-27*
