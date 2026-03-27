# Phase 23: Output Path Grammar + File Slots + Export ContentMapping - Research

**Researched:** 2026-03-27
**Domain:** Variable resolution system, file slot semantics, export content assembly
**Confidence:** HIGH

## Summary

Phase 23 establishes three interconnected capabilities: (1) a unified output path grammar using `segmentKey` as the canonical identifier in variable references, replacing opaque UUIDs; (2) file slot semantics for input transform nodes, allowing distinct file upload areas with individual variable references; (3) making the existing but non-functional `contentMapping` in export nodes actually work at runtime.

The design is thoroughly documented in `docs/design/flow-node-capability-analysis.md` (Section 2 + Section 3 Gaps #2 and #4a). The codebase is well-structured with clear separation: shared types in `packages/shared/src/types.ts`, output derivation in `derive-outputs.ts`, variable resolution in `model-call.service.ts`, and export logic in `export.service.ts`. All changes are additive or refactoring of existing code -- no new infrastructure dependencies.

**Primary recommendation:** Implement in three layers: (1) shared types + derive-outputs first (foundation), (2) backend resolveRef + confirmInputTransform + export.service (runtime), (3) frontend config panels + executor + variable picker (UI). Full data reset is acceptable per design doc -- no migration needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- machineKey input placed in "advanced settings" collapsible area per form field, not in the main config flow
- Real-time inline validation for machineKey format (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`), red text below input on violation
- Cross-type segmentKey collision within a node: field-level real-time prompt "conflicts with [xx] field identifier"
- validation.ts also performs secondary validation on save
- Each fileSlot renders as independent card area with fileSlotLabel as title, containing drag-upload zone and uploaded file list
- Variable path hints (e.g. `{{n1.tender_doc}}`) shown only on admin config page, not on user execution page
- Mixed layout: fileSlotId cards in config order first, non-fileSlotId file fields as "other files" area after
- fileSlotId and fileSlotLabel configuration placed in file-type field's "advanced settings" collapsible area (same area as machineKey)
- contentMapping references joined with double newline (`\n\n`), no titles or dividers
- Empty contentMapping preserves existing fallback logic (nearest upstream node content), fully backward compatible
- getExportPreview shows merged full preview text, identical to actual export result
- contentMapping variable resolution failure: skip that segment + log warning, continue export; preview shows missing indicator
- VariablePicker grouped by node, each output item prefixed with type icon (text field=T, file slot=file icon, model output=robot icon)
- Selected variable shown as readable label chip in PromptEditor (e.g. [n1.project_name]), underlying storage `{{n1.project_name}}`
- No search/filter needed for VariablePicker at current scale (5-8 nodes)
- ExportConfig contentMapping reuses VariablePicker component, selected items added to list, supports drag reorder for export order

### Claude's Discretion
- Whether machineKey auto-generates a suggested value from label (e.g. "project_name" from "项目名称") -- decide based on implementation complexity
- Specific icon choices and color schemes
- Advanced settings collapsible area default expanded/collapsed state

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Architecture Patterns

### Change Topology

This phase touches 3 layers across the stack. All changes follow the existing patterns established in the codebase.

```
packages/shared/src/types.ts          — Type definitions (foundation)
packages/frontend/src/lib/flow-engine/derive-outputs.ts  — OutputDef generation
packages/frontend/src/components/workflow/config/        — Admin config panels
packages/frontend/src/components/workflow/prompt/        — VariablePicker + PromptEditor
packages/frontend/src/components/workspace/nodes/        — InputTransformExecutor
packages/backend/src/modules/runtime/model-call.service.ts   — resolveRef (extracted from resolvePromptTemplate)
packages/backend/src/modules/runtime/input-transform.service.ts — fileSlots aggregation
packages/backend/src/modules/runtime/export.service.ts   — contentMapping resolution
packages/backend/src/modules/workflows/validation.ts     — segmentKey uniqueness
packages/backend/src/db/schema.ts                        — documentFiles.slotId column
```

### Pattern 1: Type-First Development

**What:** All changes start with `packages/shared/src/types.ts`. This is the single source of truth shared by frontend and backend.
**When to use:** Every modification in this phase.

Current types to modify:
```typescript
// FormFieldDef — add machineKey, fileSlotId, fileSlotLabel
interface FormFieldDef {
  id: string;
  machineKey?: string;        // NEW: stable identifier for variable paths
  label: string;
  type: "text" | "textarea" | "file";
  required: boolean;
  fileCountMode?: "single" | "unlimited";
  acceptedFileTypes?: string[];
  fileSlotId?: string;        // NEW: file slot identifier
  fileSlotLabel?: string;     // NEW: file slot display name
}

// OutputDef — add segmentKey
interface OutputDef {
  id: string;
  name: string;
  description?: string;
  segmentKey?: string;        // NEW: path resolution identifier
}

// VariableRef — add fieldPath
interface VariableRef {
  nodeId: string;
  outputId: string;           // NOW stores segmentKey (not OutputDef.id)
  variableName: string;
  fieldPath?: string;         // NEW: for nested JSON field access
}
```

### Pattern 2: OutputDef.id Prefixed by Type

**What:** OutputDef.id uses type-specific prefixes for disambiguation.
**Format:**
- Text/textarea fields: `{nodeId}-field-{segmentKey}`
- File slots: `{nodeId}-fileslot-{segmentKey}`
- Model outputs: `{nodeId}-model-{modelId}`

Current `derive-outputs.ts` uses `{nodeId}-field-{field.id}` (UUID). Change to use `field.machineKey || field.id` as segmentKey.

### Pattern 3: resolveRef() Priority Chain

**What:** Extract `resolveRef()` from `resolvePromptTemplate()` with a defined lookup priority.
**Priority order:**
1. `od.fieldsByKey?.[segmentKey]` -- machineKey lookup
2. `od.fields?.[segmentKey]` -- UUID fallback
3. `od.fileSlots?.[segmentKey]` -- file slot (default: `.text`)
4. `od.namedOutputs?.[segmentKey]` -- named outputs (Phase 24, stub only)
5. `od.models?.[segmentKey]` -- model output (default: `.content`)
6. `od[segmentKey]` -- direct property (text, confirmedAt, etc.)

### Pattern 4: loadNodeConfig() for Export

**What:** Export service loads its own node config from the workflow definition stored in the database, rather than receiving it through the API route.
**Call chain:**
```
generateExport(documentId, nodeExecutionId, ...)
  -> loadNodeConfig(documentId, nodeExecutionId)  // NEW helper
     -> query nodeExecutions for nodeId
     -> query documents for workflowId
     -> query workflows.nodes JSONB for matching node
     -> return config as ExportConfig
  -> resolveContent(documentId, nodeExecutionId, contentMapping)
```

### Anti-Patterns to Avoid

- **Passing contentMapping through API routes:** The design explicitly states "do not modify route layer parameters" -- the service loads its own config.
- **Dual-format compatibility layers:** The system is in dev; old data can be reset. No migration scripts, no dual-read logic.
- **Hand-rolling variable resolution twice:** Extract `resolveRef()` once, share between `resolvePromptTemplate()` and `resolveContent()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variable path parsing | Custom per-use-case parsers | Single `resolveRef()` function | Design doc specifies unified algorithm with 6-level priority chain |
| Node config loading from DB | Inline queries in each function | `loadNodeConfig()` helper | Used by both `generateExport()` and `getExportPreview()` |
| segmentKey uniqueness validation | Per-type separate checks | Single collector pass in `validation.ts` | Must check cross-type uniqueness within a node |
| File slot grouping | Frontend grouping logic | Backend `fileSlots` aggregation in `confirmInputTransform()` | Source of truth for downstream variable resolution |

## Common Pitfalls

### Pitfall 1: VariableRef.outputId Semantic Change
**What goes wrong:** `outputId` currently stores `OutputDef.id` (e.g., `n1-field-a3f2e1d4-...`). After this phase, it stores `segmentKey` (e.g., `project_name`). If any code still constructs lookups using the old format, variable resolution silently fails.
**Why it happens:** Multiple files construct or consume `VariableRef.outputId`.
**How to avoid:** Search all usages of `outputId` across the codebase. Key locations: `VariablePicker.tsx` L44-49, `ExportConfig.tsx` L28-31, `PromptEditor.tsx` L32-37, `validation.ts` L251-308.
**Warning signs:** Variables render as raw `{{...}}` text instead of resolving.

### Pitfall 2: validation.ts Still Checks `outputIdSet` with Old Format
**What goes wrong:** Current `validation.ts` L251-256 builds `outputIdSet` as `${n.id}.${o.id}` and checks variable references against it. After OutputDef.id format changes, the broken-reference check (Rule 7) must use segmentKey, not the full OutputDef.id.
**Why it happens:** The validation builds its lookup set from `OutputDef.id`, but `VariableRef.outputId` now stores `segmentKey`.
**How to avoid:** Update Rule 7 to build lookup set as `${n.id}.${o.segmentKey}` and compare against `VariableRef.outputId` (which is now segmentKey). Also update Rule 10 (contentMapping) to match.

### Pitfall 3: confirmInputTransform() Must Build Both `fields` and `fieldsByKey`
**What goes wrong:** If `fieldsByKey` is not populated, `resolveRef()` step 1 (`od.fieldsByKey?.[segmentKey]`) misses and falls through, potentially hitting wrong data.
**Why it happens:** `confirmInputTransform()` currently only builds `fields` keyed by UUID.
**How to avoid:** Load the workflow's `FormFieldDef[]` in `confirmInputTransform()` to get `machineKey` values, then build both `fields` (by UUID) and `fieldsByKey` (by machineKey).

### Pitfall 4: File Slot Upload Must Associate Files with Correct Slot
**What goes wrong:** Current frontend has a single upload area for all files. After this phase, each file slot needs its own upload area, and the backend must know which slotId each file belongs to.
**Why it happens:** The current `handleFileSelect` and `uploadFile` functions in `InputTransformExecutor.tsx` treat all files uniformly.
**How to avoid:** Frontend must pass `slotId` with each upload (or in the confirm payload). Backend `confirmInputTransform()` groups files by slotId to build `fileSlots` aggregation.

### Pitfall 5: Export ContentMapping Resolution Uses Same resolveRef as Prompts
**What goes wrong:** If `resolveContent()` implements its own ad-hoc resolution logic, it may diverge from how prompt templates resolve variables.
**Why it happens:** Copy-paste instead of reuse.
**How to avoid:** Both `resolvePromptTemplate()` and `resolveContent()` must call the same `resolveRef()` function.

## Code Examples

### derive-outputs.ts -- Updated Input Transform Case

```typescript
// derive-outputs.ts — input_transform case
case "input_transform": {
  const outputs: OutputDef[] = [];
  for (const field of config.formFields) {
    if (field.type === "text" || field.type === "textarea") {
      const key = field.machineKey || field.id;
      outputs.push({
        id: `${nodeId}-field-${key}`,
        name: field.label || "未命名",
        description: `用户输入项: ${field.label}`,
        segmentKey: key,
      });
    } else if (field.type === "file" && field.fileSlotId) {
      outputs.push({
        id: `${nodeId}-fileslot-${field.fileSlotId}`,
        name: field.fileSlotLabel || field.label || "文件槽位",
        description: `文件槽位: ${field.fileSlotLabel}`,
        segmentKey: field.fileSlotId,
      });
    }
  }
  // Keep merged text output for backward compat
  const hasFileField = config.formFields.some((f) => f.type === "file");
  if (hasFileField) {
    outputs.push({
      id: `${nodeId}-file-upload`,
      name: "文件输出 (合并)",
      description: "所有文件合并文本",
      segmentKey: "text",
    });
  }
  return outputs;
}
```

### resolveRef() -- Extracted from resolvePromptTemplate

```typescript
// model-call.service.ts — new resolveRef function
export function resolveRef(
  ref: { nodeId: string; outputId: string; fieldPath?: string },
  nodeExecs: Array<{ nodeId: string; outputData: Record<string, unknown> | null }>,
): string | undefined {
  const exec = nodeExecs.find((e) => e.nodeId === ref.nodeId);
  if (!exec?.outputData) return undefined;

  const od = exec.outputData as Record<string, unknown>;
  const segmentKey = ref.outputId;

  // Priority 1: fieldsByKey (machineKey lookup)
  const fieldsByKey = od.fieldsByKey as Record<string, unknown> | undefined;
  if (fieldsByKey?.[segmentKey] !== undefined) {
    return String(fieldsByKey[segmentKey]);
  }

  // Priority 2: fields (UUID fallback)
  const fields = od.fields as Record<string, unknown> | undefined;
  if (fields?.[segmentKey] !== undefined) {
    return String(fields[segmentKey]);
  }

  // Priority 3: fileSlots
  const fileSlots = od.fileSlots as Record<string, { text: string }> | undefined;
  if (fileSlots?.[segmentKey]) {
    return fileSlots[segmentKey].text;
  }

  // Priority 4: namedOutputs (Phase 24 stub)
  const namedOutputs = od.namedOutputs as Record<string, { content: string }> | undefined;
  if (namedOutputs?.[segmentKey]) {
    return namedOutputs[segmentKey].content;
  }

  // Priority 5: models
  const models = od.models as Record<string, { content: string; status: string }> | undefined;
  if (models?.[segmentKey]) {
    return models[segmentKey].content;
  }

  // Priority 6: direct property
  if (od[segmentKey] !== undefined) {
    return typeof od[segmentKey] === "string"
      ? (od[segmentKey] as string)
      : JSON.stringify(od[segmentKey]);
  }

  return undefined;
}
```

### confirmInputTransform() -- fileSlots Aggregation

```typescript
// input-transform.service.ts — updated outputData construction
// Need to load workflow config to get machineKey and fileSlotId mappings
const outputData = {
  fields: formData,                    // existing: by UUID
  fieldsByKey: buildFieldsByKey(formData, formFieldDefs),  // NEW: by machineKey
  files: fileOutputs.map((f) => ({     // existing: unchanged
    fileId: f.fileId,
    name: f.name,
    parsedText: f.parsedText,
  })),
  fileSlots: buildFileSlots(fileOutputs, formFieldDefs),  // NEW: by slotId
  text: combinedText,                  // existing: unchanged
  confirmedAt: new Date().toISOString(),
};
```

### export.service.ts -- resolveContent with contentMapping

```typescript
// export.service.ts — updated resolveContent
async function resolveContent(
  documentId: string,
  nodeExecutionId: string,
  contentMapping: VariableRef[],
): Promise<string> {
  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId));

  if (contentMapping.length > 0) {
    const nodeExecs = executions.map((e) => ({
      nodeId: e.nodeId,
      outputData: e.outputData as Record<string, unknown> | null,
    }));

    const segments: string[] = [];
    for (const ref of contentMapping) {
      const value = resolveRef(ref, nodeExecs);
      if (value) {
        segments.push(value);
      } else {
        console.warn(`Export contentMapping: could not resolve ${ref.nodeId}.${ref.outputId}`);
      }
    }
    return segments.join("\n\n");
  }

  // Fallback: existing logic (backward compatible)
  // ... existing resolveContent body unchanged ...
}
```

## Key Implementation Details

### DB Schema Change

`documentFiles` table needs a nullable `slotId` column:
```typescript
// schema.ts — add to documentFiles table
slotId: varchar("slot_id", { length: 100 }),  // nullable, links to FormFieldDef.fileSlotId
```

This requires a new migration file. Existing records have `slotId = null` which is correct (no slot association).

### VariablePicker Icon Mapping

Per user decision, output items need type-specific icons:
```typescript
const OUTPUT_TYPE_ICONS: Record<string, string> = {
  field: "T",           // Text field
  fileslot: "file-icon", // File slot (use SVG)
  model: "robot-icon",   // Model output (use SVG)
};
```

Determine type from `OutputDef.id` prefix: split on first `-` after nodeId to get `field`/`fileslot`/`model`.

### ExportConfig ContentMapping -- Drag Reorder

User decision: contentMapping items support drag reorder. SolidJS drag-and-drop can use `@thisbeyond/solid-dnd` (already common in SolidJS ecosystem) or a simple manual implementation with `onDragStart/onDragOver/onDrop` HTML5 events. Given the small list size (typically 3-5 items), HTML5 native drag events suffice -- no library needed.

### machineKey Auto-Generation (Claude's Discretion)

**Recommendation:** Auto-generate a suggestion from label using pinyin-to-ascii conversion is too complex and requires a Chinese-to-pinyin library. Instead, leave the field empty with a placeholder hint like `project_name` and let the admin fill it manually. The machineKey is optional anyway -- UUID fallback works. This keeps implementation simple.

### Advanced Settings Default State (Claude's Discretion)

**Recommendation:** Default collapsed. Most fields will not need machineKey or fileSlotId, and keeping it collapsed reduces visual noise in the common case. The collapsible should show a subtle indicator (e.g., dot or count) when advanced settings have values configured.

## Open Questions

1. **How does `confirmInputTransform()` know which FormFieldDef belongs to which file?**
   - What we know: Currently, files are uploaded independently and linked to a nodeExecution, not to a specific form field. The `fileOutputs` array has `{ fileId, name, parsedText }` with no field association.
   - What's unclear: How the frontend communicates which file slot each uploaded file belongs to.
   - Recommendation: Extend the upload payload/confirm body to include `slotId` per file entry. Frontend groups uploads by slot; backend builds `fileSlots` from these associations. The confirm endpoint body changes to `fileOutputs: Array<{ fileId, name, parsedText, slotId?: string }>`.

2. **Does model_call OutputDef need segmentKey in this phase?**
   - What we know: Design doc says model_call uses `modelId` as segmentKey. Current derive-outputs already generates `{nodeId}-model-{modelId}`.
   - What's unclear: Whether to add `segmentKey: modelId` to model_call OutputDefs now or defer to Phase 24.
   - Recommendation: Add it now. It is trivial (one line in derive-outputs) and ensures the VariablePicker uses consistent segmentKey format for all output types.

## Sources

### Primary (HIGH confidence)
- `docs/design/flow-node-capability-analysis.md` -- Complete design specification for output path grammar (Section 2), file slots (Gap #2), and export contentMapping (Gap #4a)
- `packages/shared/src/types.ts` -- Current type definitions (OutputDef L93-97, VariableRef L107-111, FormFieldDef L114-123, ExportConfig L168-179)
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` -- Current output derivation logic (62 lines)
- `packages/backend/src/modules/runtime/model-call.service.ts` -- Current resolvePromptTemplate (L20-68)
- `packages/backend/src/modules/runtime/export.service.ts` -- Current resolveContent (L16-92), generateExport (L227-291), getExportPreview (L293-304)
- `packages/backend/src/modules/runtime/input-transform.service.ts` -- Current confirmInputTransform (L151-196)
- `packages/backend/src/modules/workflows/validation.ts` -- Current validation rules (399 lines)
- `packages/frontend/src/components/workflow/prompt/VariablePicker.tsx` -- Current variable picker (174 lines)
- `packages/frontend/src/components/workflow/prompt/PromptEditor.tsx` -- Current prompt editor (426 lines)
- `packages/frontend/src/components/workflow/config/InputTransformConfig.tsx` -- Current form field config (305 lines)
- `packages/frontend/src/components/workflow/config/ExportConfig.tsx` -- Current export config (151 lines)
- `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` -- Current executor (592 lines)

### Secondary (MEDIUM confidence)
- `.planning/phases/23-output-path-grammar-file-slots-export-contentmapping/23-CONTEXT.md` -- User decisions and implementation constraints

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all changes within existing codebase patterns
- Architecture: HIGH -- design doc provides complete specification with code examples
- Pitfalls: HIGH -- identified from direct code reading, specific line numbers referenced

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable internal project, no external dependency concerns)
