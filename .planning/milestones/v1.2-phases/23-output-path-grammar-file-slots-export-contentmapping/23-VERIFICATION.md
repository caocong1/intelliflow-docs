---
name: 23-output-path-grammar-file-slots-export-contentmapping
phase: 23
date: 2026-03-27
status: passed
---

# Phase 23 Verification Report

**Phase Goal:** Unified output path grammar (segmentKey), file slot semantics for input transform nodes, and functional contentMapping in export nodes.
**Verified:** 2026-03-27
**Status:** PASSED
**Score:** 9/9 criteria verified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OutputDef has segmentKey; VariableRef has fieldPath; OutputDef.id uses type-specific prefixes | PASS | `types.ts` L93-98 (segmentKey on OutputDef), L108-113 (fieldPath on VariableRef), L133-154 (machineKey/fileSlotId/fileSlotLabel on FormFieldDef); `derive-outputs.ts` uses field-/fileslot-/namedoutput-/model-/desensitized-/restored- prefixes |
| 2 | resolvePromptTemplate() refactored into resolveRef() with 6-level priority chain | PASS | `model-call.service.ts` L80-159: `resolveRef()` checks fieldsByKey→fields→fileSlots→namedOutputs→models→direct property; `resolvePromptTemplate()` L166-229 delegates to `resolveRef()` |
| 3 | FormFieldDef has optional fileSlotId and fileSlotLabel; frontend renders separate upload areas per slot | PASS | `types.ts` L151-153; `InputTransformConfig.tsx` L594-626 (inputs + collision detection); `InputTransformExecutor.tsx` L553-591 (per-slot upload areas) + L201-215 (uploadFile with slotId) |
| 4 | outputData includes fileSlots aggregation view; files array unchanged | PASS | `input-transform.service.ts` L243-327 (`buildFileSlots()`), L257-268 (outputData has both `files` and `fileSlots`) |
| 5 | {{n1.tender_doc}} resolves to file slot .text; {{n1.text}} returns merged text | PASS | `model-call.service.ts` L104-108 (fileSlots return .text); L142-156 (direct property "text" fallback); `derive-outputs.ts` L35-43 (merged output always present) |
| 6 | derive-outputs.ts generates per-slot OutputDef for file fields with fileSlotId | PASS | `derive-outputs.ts` L13-22: file fields with `fileSlotId` produce distinct `fileslot-` OutputDef; `hasFileField` check L35 generates merged `file-upload` output for backward compat |
| 7 | export.service.ts resolveContent() and getExportPreview() both use contentMapping via loadNodeConfig() | PASS | `export.service.ts` L32-57 (loadNodeConfig); L723-725 (generateExport); L787-788 (getExportPreview) — both public functions call loadNodeConfig and pass contentMapping to resolveContent |
| 8 | Export with contentMapping referencing 3 upstream outputs produces file with all 3 segments in order | PASS | `export.service.ts` L81-101: iterates contentMapping in order, calls resolveRef(), joins with `"\n\n"`, skips with warn on failure |
| 9 | VariablePicker and PromptEditor use segmentKey format; validation.ts checks segmentKey cross-type uniqueness | PASS | `VariablePicker.tsx` L286-294 (segmentKey in VariableRef.outputId); `PromptEditor.tsx` L282-288 (segmentKey in storage key) + L69-70 (display lookup by segmentKey first); `validation.ts` L369-397 Rule 11 uniqueness; L399-459 Rule 7 outputIdSet built with segmentKey |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types.ts` | OutputDef.segmentKey, VariableRef.fieldPath, FormFieldDef.machineKey/fileSlotId/fileSlotLabel | VERIFIED | L93-98, L108-113, L133-154 |
| `packages/frontend/src/lib/flow-engine/derive-outputs.ts` | Per-slot OutputDef generation with segmentKey | VERIFIED | L13-43 (input_transform), L47-61 (model_call), L13-22 (fileslot outputs) |
| `packages/backend/src/modules/runtime/model-call.service.ts` | resolveRef() 6-level priority chain | VERIFIED | L80-159 (resolveRef), L166-229 (resolvePromptTemplate delegates) |
| `packages/backend/src/modules/runtime/input-transform.service.ts` | fileSlots aggregation, fieldsByKey, buildFileSlots() | VERIFIED | L197-290 (confirmInputTransform), L235-241 (fieldsByKey build), L298-327 (buildFileSlots) |
| `packages/backend/src/modules/runtime/export.service.ts` | loadNodeConfig, contentMapping via resolveContent | VERIFIED | L32-57 (loadNodeConfig), L66-166 (resolveContent with contentMapping), L723-725 (generateExport), L787-788 (getExportPreview) |
| `packages/backend/src/modules/workflows/validation.ts` | segmentKey uniqueness (Rule 11), broken-ref check (Rule 7) | VERIFIED | L369-397 (Rule 11), L399-459 (Rule 7: outputIdSet uses segmentKey) |
| `packages/frontend/src/components/workflow/config/InputTransformConfig.tsx` | fileSlotId/fileSlotLabel inputs, collision detection | VERIFIED | L594-626 (advanced settings), L143-173 (validation + collision) |
| `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` | Per-slot upload areas, slotId in confirm payload | VERIFIED | L553-591 (slot card rendering), L201-215 (uploadFile with slotId), L313-320 (confirm payload includes slotId) |
| `packages/frontend/src/components/workflow/config/ExportConfig.tsx` | contentMapping config with VariablePicker + drag reorder | VERIFIED | L214-224 (VariablePicker reuse), L52-80 (drag reorder), L44-50 (segmentKey-based resolveLabel) |
| `packages/frontend/src/components/workflow/prompt/VariablePicker.tsx` | segmentKey in VariableRef, type icons | VERIFIED | L286-294 (handleSelectOutput with segmentKey), L310-323 (getOutputTypeIcon with prefix detection) |
| `packages/frontend/src/components/workflow/prompt/PromptEditor.tsx` | segmentKey format storage and display | VERIFIED | L282-288 (insertVariable storage key), L69-70 (resolveVarDisplayName by segmentKey first) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| derive-outputs.ts | OutputDef.id format | `${nodeId}-field-${key}` | WIRED | All node types use typed prefixes; segmentKey set for all |
| resolveRef() | fieldsByKey lookup | Priority 1 check | WIRED | `od.fieldsByKey[segmentKey]` L91-95 |
| resolveRef() | fileSlots lookup | Priority 3 check | WIRED | `od.fileSlots[segmentKey].text` L104-108 |
| confirmInputTransform() | outputData.fileSlots | buildFileSlots() helper | WIRED | L244, L265, L267 |
| generateExport() | contentMapping | loadNodeConfig() → resolveContent() | WIRED | L723-725 |
| getExportPreview() | contentMapping | loadNodeConfig() → resolveContent() | WIRED | L787-788 |
| VariablePicker | segmentKey in VariableRef | output.segmentKey \|\| output.id | WIRED | L287-292 |
| PromptEditor | segmentKey in {{}} storage | segmentKey in data-var | WIRED | L285-288 |
| validation.ts Rule 7 | outputIdSet | `${n.id}.${o.segmentKey\|\|o.id}` | WIRED | L400-405 |
| validation.ts Rule 11 | segmentKey uniqueness | Map from segmentKey→id | WIRED | L369-397 |
| InputTransformExecutor | slotId in upload | uploadFile(file, slotId) | WIRED | L201-215, L573-591 |
| InputTransformExecutor | slotId in confirm | fileOutputs[].slotId | WIRED | L313-320 |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-----------|-------------|--------|----------|
| Phase 23 scope | Output path grammar + file slots + contentMapping | SATISFIED | All 9 criteria verified from code |
| Section 二 of design doc | segmentKey canonical form, OutputDef prefixes, resolveRef priority chain | SATISFIED | types.ts + model-call.service.ts + derive-outputs.ts |
| Gap #2 of design doc | fileSlotId/fileSlotLabel semantics, fileSlots aggregation | SATISFIED | types.ts + input-transform.service.ts + InputTransformExecutor.tsx |
| Gap #4a of design doc | contentMapping runtime, loadNodeConfig(), getExportPreview() | SATISFIED | export.service.ts fully implements Steps 1-4 of Gap #4a |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | N/A | N/A | No TODO/FIXME/PLACEHOLDER comments found in modified files; no empty implementations |

### Human Verification Required

None — all criteria are verifiable through static code analysis. No visual appearance, real-time behavior, or external service integration required for verification.

### Gaps Summary

No gaps found. All 9 success criteria are fully implemented:
- Type layer: OutputDef.segmentKey, VariableRef.fieldPath, FormFieldDef.machineKey/fileSlotId/fileSlotLabel all present
- Resolution engine: resolveRef() with 6-level priority chain, shared between prompt templates and export content
- File slots: per-slot OutputDef generation, buildFileSlots() aggregation, separate upload areas in executor, slotId in confirm payload
- contentMapping: loadNodeConfig() loads from DB, both generateExport() and getExportPreview() use it, segments joined with "\n\n"
- Frontend: VariablePicker uses segmentKey in VariableRef, type icons via prefix detection; PromptEditor stores segmentKey in data-var; ExportConfig reuses VariablePicker with drag reorder
- Validation: Rule 11 (segmentKey uniqueness), Rule 7 (outputIdSet with segmentKey)

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
