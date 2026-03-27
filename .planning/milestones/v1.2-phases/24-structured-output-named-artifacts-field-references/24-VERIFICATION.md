---
phase: 24-structured-output-named-artifacts-field-references
verified: 2026-03-27T12:00:00Z
status: passed
score: 8/8 must-haves verified
gaps: []
---

# Phase 24: Structured Output + Named Artifacts + Field References Verification Report

**Phase Goal:** Enable model call nodes to output structured JSON and multiple named artifacts, with downstream field-level references
**Verified:** 2026-03-27
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `ModelCallConfig` has `outputFormat` (text/json/markdown), `jsonSchema`, `stepDescription`, and `namedOutputs` fields | VERIFIED | `types.ts:189-196` — `outputFormat?: "text" \| "json" \| "markdown"`, `jsonSchema?: object`, `stepDescription?: string`, `namedOutputs?: NamedOutputDef[]` |
| 2 | `outputFormat: "json"` triggers automatic JSON validation; invalid JSON shows as `format_error` status with "fix and revalidate" UI | VERIFIED | `model-call.service.ts:238-269` — `validateModelOutput()` does JSON.parse (layer 1) + ajv schema (layer 2); `model-call.service.ts:504-511` — auto-calls on model completion; `model-call.routes.ts:304-312` — revalidate endpoint; `ModelCallExecutor.tsx:569-654` — red error box, revalidate + AI fix buttons |
| 3 | `ModelOutput.status` type includes `"format_error"` value | VERIFIED | `types.ts:436` — `status: "pending" \| "streaming" \| "completed" \| "failed" \| "format_error"` |
| 4 | `namedOutputs` mode: AI output parsed by `===OUTPUT:id===...===END:id===` delimiters into `outputData.namedOutputs[id]` | VERIFIED | `model-call.service.ts:276-311` — `parseNamedOutputs()` regex `/===OUTPUT:(\w+)===\n?([\s\S]*?)===END:\1===/g`; `model-call.service.ts:526-536` — stored in `outputData.namedOutputs` |
| 5 | Frontend renders named outputs as separate cards, each independently editable | VERIFIED | `NamedOutputCard.tsx` — card with title bar, format badge, InlineEditor embed (textarea), save/cancel; `ModelCallExecutor.tsx:1003-1059` — renders NamedOutputCard list grouped by model; `ModelCallCompleted.tsx:312-352` — renders in readonly mode |
| 6 | `{{n3.blueprint}}` returns named output content; `{{n3.clause_list.items[0].name}}` returns nested JSON field value | VERIFIED | `model-call.service.ts:200` — `resolveRef()` called with parsed `fieldPath`; `model-call.service.ts:114-124` — namedOutputs branch parses JSON and calls `resolveFieldPath()`; `model-call.service.ts:177-205` — `resolvePromptTemplate` parses multi-level `{{nodeId.segmentKey.fieldPath}}` |
| 7 | `resolveRef()` auto-unwraps namedOutput/model objects to `.content` when no fieldPath; parses `.content` as JSON when fieldPath present | VERIFIED | `model-call.service.ts:111-124` — namedOutputs: no fieldPath returns `.content` directly; fieldPath triggers `JSON.parse` + `resolveFieldPath`; `model-call.service.ts:127-140` — same for models branch |
| 8 | Fallback: if AI doesn't follow delimiter format, entire output stored as default single artifact with frontend warning | VERIFIED | `model-call.service.ts:306-310` — fallback returns `_default` artifact when not all IDs found; `ModelCallExecutor.tsx:96-99, 993-1000` — yellow warning bar "模型未按预期格式输出，已合并为单个产物"; `ModelCallCompleted.tsx:302-309` — same in completed view |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types.ts` | `NamedOutputDef`, extended `ModelCallConfig`, `ModelOutput.status: format_error`, `formatErrors` | VERIFIED | `types.ts:189-196`, `types.ts:424-429`, `types.ts:436`, `types.ts:439` |
| `packages/backend/src/modules/runtime/model-call.service.ts` | `resolveFieldPath`, `resolveRef` fieldPath, `validateModelOutput`, `parseNamedOutputs`, prompt injection | VERIFIED | `types.ts:22-68`, `model-call.service.ts:111-158`, `model-call.service.ts:238-311`, `model-call.service.ts:215-226` |
| `packages/backend/src/modules/runtime/model-call.routes.ts` | revalidate + ai-fix endpoints | VERIFIED | `model-call.routes.ts:261-333` (revalidate), `model-call.routes.ts:337-517` (ai-fix SSE) |
| `packages/backend/src/modules/workflows/validation.ts` | namedOutputs ID format/uniqueness, jsonSchema validation | VERIFIED | `validation.ts:315-338` (namedOutputs validation), `validation.ts:340-354` (jsonSchema) |
| `packages/frontend/src/lib/flow-engine/derive-outputs.ts` | namedOutputs mode OutputDef generation | VERIFIED | `derive-outputs.ts:47-61` — `config.namedOutputs` maps to per-artifact OutputDefs |
| `packages/frontend/src/components/workflow/config/ModelCallConfig.tsx` | outputFormat dropdown, conditional JsonSchemaEditor, namedOutputs builder | VERIFIED | Lines 314-475 — full implementation |
| `packages/frontend/src/components/workflow/config/JsonSchemaEditor.tsx` | CodeMirror 6 with JSON lint | VERIFIED | Lines 1-89 — CodeMirror integration, jsonParseLinter, external value push |
| `packages/frontend/src/components/workspace/nodes/NamedOutputCard.tsx` | Card with title, format badge, InlineEditor | VERIFIED | Lines 1-111 — full implementation |
| `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx` | format_error UI, named output cards, revalidate, ai-fix | VERIFIED | Lines 82-106, 375-480, 548-654, 993-1059 |
| `packages/frontend/src/components/workspace/completed/ModelCallCompleted.tsx` | Named output cards, format_error badge, fallback warning | VERIFIED | Lines 50-59, 283-290, 302-352 |
| `packages/frontend/src/components/workflow/prompt/VariablePicker.tsx` | buildSchemaTree, tree rendering, array [0]/[*] options | VERIFIED | Lines 1-512 — `SchemaTreeNode`, `buildSchemaTree`, `buildArrayChildren`, `SchemaTreeView` |
| `packages/frontend/src/components/workflow/prompt/PromptEditor.tsx` | Multi-level fieldPath regex, display name resolution | VERIFIED | Lines 28-105 — `parseVarKey`, `resolveVarDisplayName`, `resolveVarFullDisplayName` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ModelCallConfig.tsx` | `types.ts` | `config.outputFormat`, `config.jsonSchema`, `config.namedOutputs` | WIRED | Config component binds all 4 new fields to `ModelCallConfig` type |
| `JsonSchemaEditor.tsx` | `ModelCallConfig.tsx` | Conditional render `when outputFormat === "json"` | WIRED | `ModelCallExecutor.tsx:339` `<Show when={(props.config.outputFormat ?? "text") === "json"}>` |
| `model-call.service.ts` | `types.ts` | `ModelCallConfig.outputFormat/jsonSchema/namedOutputs` | WIRED | `validateModelOutput()` checks `config.outputFormat !== "json"`; `parseNamedOutputs()` uses `config.namedOutputs` |
| `model-call.service.ts resolveRef` | `resolveFieldPath helper` | `ref.fieldPath` triggers deep JSON access | WIRED | `model-call.service.ts:114-124` — `resolveFieldPath(parsed, ref.fieldPath)` called for namedOutputs; `model-call.service.ts:127-140` — same for models |
| `model-call.routes.ts revalidate` | `model-call.service.ts validateModelOutput` | Called in route handler | WIRED | `model-call.routes.ts:304` — `const validation = validateModelOutput(content, mcConfig)` |
| `model-call.routes.ts ai-fix` | `model-call.service.ts validateModelOutput` | Auto-validation after stream | WIRED | `model-call.routes.ts:454` — `const validation = validateModelOutput(fixedContent, mcConfig)` |
| `VariablePicker.tsx` | `types.ts NamedOutputDef.jsonSchema` | Reads upstream node config.namedOutputs[].jsonSchema or config.jsonSchema | WIRED | `VariablePicker.tsx:249-269` — `getSchemaForOutput()` checks both sources |
| `VariablePicker.tsx` | `PromptEditor.tsx` | `onSelect` callback inserts `{{nodeId.segmentKey.fieldPath}}` | WIRED | `VariablePicker.tsx:294` — `props.onSelect(variableName, ref)`; `PromptEditor.tsx:433-435` — `insertVariable(refToStorageKey(ref))` |
| `ModelCallExecutor.tsx` | `model-call.routes.ts revalidate` | `fetch POST .../revalidate` | WIRED | `ModelCallExecutor.tsx:383` — exact endpoint URL with documentId/nodeExecutionId/modelId |
| `ModelCallExecutor.tsx` | `model-call.routes.ts ai-fix` | `streamSSE POST .../ai-fix` | WIRED | `ModelCallExecutor.tsx:430` — `streamSSE({ url: .../ai-fix })` |
| `ModelCallExecutor.tsx` | `NamedOutputCard` | `import` + render with `onContentChange` | WIRED | `ModelCallExecutor.tsx:6` import; `ModelCallExecutor.tsx:1023,1049` — `<NamedOutputCard ... onContentChange={handleNamedOutputChange}>` |

### Requirements Coverage

No additional requirements mapped in REQUIREMENTS.md for phase 24.

### Anti-Patterns Found

None detected. All implementations are substantive and wired:

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | — |

Notable quality points:
- `resolveFieldPath` handles dot keys, bracket[0] indices, and `[*]` traversal correctly
- `validateModelOutput` does two-layer validation (JSON.parse + ajv schema) with `allErrors: true`
- `parseNamedOutputs` uses proper regex with `\w+` for IDs and `\1` backreference for `===END:===`
- `buildSchemaTree` limits recursion depth to 5 to prevent `$ref` loops
- `renderFormatError` shows editable textarea with revalidate + AI fix + adopt/cancel
- `NamedOutputCard` uses `renderMarkdown` for non-JSON formats, monospace `<pre>` for JSON

### Gaps Summary

No gaps found. All 8 success criteria are fully implemented and wired:

1. **Criterion 1 (types):** `outputFormat`, `jsonSchema`, `stepDescription`, `namedOutputs` all present in `ModelCallConfig` (`types.ts:189-196`); `format_error` present in `ModelOutput.status` (`types.ts:436`).

2. **Criterion 2 (JSON validation UI):** Backend `validateModelOutput()` at `model-call.service.ts:238-269`; revalidate endpoint at `model-call.routes.ts:261-333`; ai-fix SSE endpoint at `model-call.routes.ts:337-517`; `renderFormatError` helper at `ModelCallExecutor.tsx:569-654` with red error box, editable textarea, revalidate + AI fix buttons, and adopt/cancel controls.

3. **Criterion 3 (format_error type):** `types.ts:436` — `"format_error"` in `ModelOutput.status` union; `ModelCallExecutor.tsx:25` STATUS_LABELS map with `"format_error": "格式错误"`; `ModelCallExecutor.tsx:548-563` statusBadge case.

4. **Criterion 4 (namedOutputs parsing):** `parseNamedOutputs` at `model-call.service.ts:276-311` using `/===OUTPUT:(\w+)===\n?([\s\S]*?)===END:\1===/g`; stored in `outputData.namedOutputs` at `model-call.service.ts:531`.

5. **Criterion 5 (named output cards):** `NamedOutputCard.tsx` with title bar, format badge, edit mode with textarea; `ModelCallExecutor.tsx:1003-1059` renders cards grouped by model with `onContentChange`; `ModelCallCompleted.tsx:312-352` renders readonly.

6. **Criterion 6 (fieldPath resolution):** `resolveRef` at `model-call.service.ts:80-159` handles `ref.fieldPath` for namedOutputs (`model-call.service.ts:114-124`) and models (`model-call.service.ts:127-140`); `resolvePromptTemplate` parses multi-level `{{nodeId.segmentKey.fieldPath}}` at `model-call.service.ts:177-205`.

7. **Criterion 7 (auto-unwrap):** `model-call.service.ts:111-124` namedOutputs: returns `.content` when no fieldPath, `JSON.parse` + `resolveFieldPath` when fieldPath present; same pattern for models at `model-call.service.ts:127-140`.

8. **Criterion 8 (fallback):** `model-call.service.ts:306-310` returns `_default` artifact on fallback; `ModelCallExecutor.tsx:96-99, 993-1000` yellow warning bar; `ModelCallCompleted.tsx:302-309` same in completed view.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
