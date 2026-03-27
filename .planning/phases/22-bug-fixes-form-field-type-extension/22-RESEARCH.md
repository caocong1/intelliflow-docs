# Phase 22: Bug Fixes + Form Field Type Extension - Research

**Researched:** 2026-03-27
**Domain:** Background execution bug fixes + Input transform form field type extension
**Confidence:** HIGH

## Summary

This phase has two distinct workstreams: (1) fixing two known bugs in `background.service.ts`, and (2) extending the input transform node's form field system with new types and machineKey support. Both workstreams are well-scoped with clear code locations and established patterns to follow.

The bug fixes are surgical: change `"file_export"` to `"export"` at L259 of background.service.ts, and add a `skippable && autoAdvance` check in the node execution loop at L216-223. The form field extension follows the existing pattern of type-discriminated field configurations (like the `file` type's `fileCountMode` and `acceptedFileTypes`), adding new types to `FormFieldDef.type`, optional `machineKey`, and corresponding frontend controls and backend validation.

**Primary recommendation:** Fix bugs first (minimal risk, immediate value), then extend the type system bottom-up: shared types -> backend validation -> frontend config -> frontend executor -> derive-outputs + machineKey -> outputData dual-view.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Select/Multiselect options are plain text lists (stored value = display text)
- Options managed via list UI with add/delete/sort in config panel
- select stores selected text; multiselect joins with comma (e.g. "high,medium")
- Support default values for select (single) and multiselect (multiple)
- multiselect has no max selection limit
- machineKey input collapsed under "Advanced Settings", hidden by default
- machineKey auto-generates suggestion from field label, user can modify
- machineKey has real-time format validation with red error text, blocks save if invalid
- Use native browser controls: number -> `<input type="number">`, date -> `<input type="date">`, datetime -> `<input type="datetime-local">`, select -> `<select>`, multiselect -> multi-checkbox or native multi-select
- number field: no min/max/step configuration, pure numeric input
- date/datetime supports default values (e.g. "today"), no date range restrictions
- Date values passed as ISO format: date -> "2025-03-26", datetime -> "2025-03-26T14:30:00"
- Tailwind styling consistent with existing text/textarea/file controls
- Frontend: real-time + submit-time dual validation; errors shown below field in red text + red border
- Required field enforcement consistent with existing text/textarea behavior
- Backend also validates: required, type correctness, select value in options list

### Claude's Discretion
- machineKey auto-generation strategy (pinyin, field_N, or other)
- multiselect: native `<select multiple>` vs checkbox group
- Specific error message text
- Two bug fix implementation details

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Standard Stack

### Core (Already in project)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| SolidJS | Frontend framework | Project standard, all components use createSignal/For/Show/Index |
| Tailwind CSS | Styling | Project standard per CONTEXT.md, consistent with existing controls |
| Drizzle ORM | Database queries | Project standard for all backend DB operations |
| @intelliflow/shared | Shared types | Monorepo shared package for FormFieldDef, NodeConfig, etc. |

### No New Dependencies Required
This phase extends existing patterns using existing libraries. No new packages needed.

## Architecture Patterns

### Bug Fix 1: Export Node Type Mismatch

**Location:** `packages/backend/src/modules/runtime/background.service.ts` L259
**Current:** `case "file_export":` -- does not match `WorkflowNodeType = "export"` in types.ts L87
**Fix:** Change to `case "export":`

This is a one-line fix. The `exec.nodeType` comes from the database which stores the value from the `WorkflowNodeType` enum. The enum defines `"export"` but the switch case checks `"file_export"`, so export nodes fall through to the `default` branch and are silently skipped.

### Bug Fix 2: Skippable+AutoAdvance Semantics

**Location:** `packages/backend/src/modules/runtime/background.service.ts` L216-223
**Current behavior:** Loop only checks `exec.status === "completed" || "skipped"` to skip nodes. All other nodes are directly executed.
**Required behavior:** Nodes with `skippable === true && autoAdvance === true` in their config should be auto-skipped instead of executed.

**Implementation pattern:**
```typescript
// After the existing status check (L220-222), before setting in_progress:
const nodeDef = wfNodeMap.get(exec.nodeId);
if (nodeDef?.config?.skippable && nodeDef?.config?.autoAdvance) {
  // Auto-skip this node in background mode
  await skipNode(documentId, exec.id, userId);
  continue;
}
```

**Key consideration:** The `skipNode` function in `runtime.service.ts` (L401-466) already handles marking the node as "skipped" and advancing to the next node. However, `background.service.ts` already calls `advanceNode` at L276 after each node execution. Using `skipNode` directly would advance the state, but the loop continues iterating over the pre-loaded `executions` array. Since `skipNode` modifies DB state and the loop uses a pre-fetched snapshot, the approach should be:
1. Use the simpler approach: directly update the node status to "skipped" in the DB (matching what `skipNode` does internally at L427-429)
2. Let the existing `advanceNode` call at L276 handle progression
3. OR skip the `advanceNode` call for auto-skipped nodes by using `continue` after the skip logic

The cleanest approach: set status to "skipped" directly and `continue` (skipping the `advanceNode` call), since `advanceNode` expects the node to have been executed and stores output data.

### FormFieldDef Type Extension

**Current type definition** (`packages/shared/src/types.ts` L114-123):
```typescript
interface FormFieldDef {
  id: string;
  label: string;
  type: "text" | "textarea" | "file";
  required: boolean;
  fileCountMode?: "single" | "unlimited";
  acceptedFileTypes?: string[];
}
```

**Extended type:**
```typescript
interface FormFieldDef {
  id: string;
  label: string;
  type: "text" | "textarea" | "file" | "number" | "date" | "datetime" | "select" | "multiselect";
  required: boolean;
  machineKey?: string;           // Optional stable identifier, /^[a-zA-Z_][a-zA-Z0-9_]*$/
  // File-specific
  fileCountMode?: "single" | "unlimited";
  acceptedFileTypes?: string[];
  // Select/Multiselect-specific
  options?: string[];            // Plain text option list
  defaultValue?: string;         // Single default for text/number/date/datetime/select
  defaultValues?: string[];      // Multiple defaults for multiselect
}
```

### FIELD_TYPE_OPTIONS Extension Pattern

**Current** (`InputTransformConfig.tsx` L4-8):
```typescript
const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "单行文本", icon: "T", color: "bg-slate-100 text-slate-600" },
  { value: "textarea", label: "多行文本", icon: "¶", color: "bg-blue-100 text-blue-600" },
  { value: "file", label: "文件上传", icon: "...", color: "bg-purple-100 text-purple-600" },
];
```

**Add entries for:**
- `number`: "数字", icon "#", green color scheme
- `date`: "日期", icon calendar-like, amber color scheme
- `datetime`: "日期时间", icon clock-like, orange color scheme
- `select`: "单选", icon list-like, cyan color scheme
- `multiselect`: "多选", icon checkbox-like, teal color scheme

### Config Panel: Type-Specific Settings

Follow the existing pattern of `<Show when={field().type === "file"}>` (L213-295) for conditional config rendering. New type-specific config blocks:

1. **select/multiselect**: Options list management UI (add/delete/reorder text items) + default value selector
2. **number**: No extra config (per user decision)
3. **date/datetime**: Optional default value setting ("today" shortcut)

### machineKey in Advanced Settings

Pattern: collapsible section within each field card, below the required checkbox. Uses a `<Show>` toggle with a "Advanced Settings" header. Contains:
- machineKey input with real-time regex validation
- Auto-suggestion on label change (Claude's discretion for strategy)

**Recommended auto-generation strategy:** Simple transliteration-free approach using `field_N` pattern (e.g., `field_1`, `field_2`), since label is Chinese text and pinyin conversion would require a library. User can manually type meaningful keys like `project_name`.

### derive-outputs.ts Update

**Current** (`derive-outputs.ts` L11-16): Uses `field.id` (UUID) to build output IDs.
**Change:** Use `field.machineKey || field.id` as the segment key.

```typescript
// Current:
id: `${nodeId}-field-${field.id}`

// Updated:
const segmentKey = field.machineKey || field.id;
id: `${nodeId}-field-${segmentKey}`
```

**Important:** New field types (number, date, datetime, select, multiselect) should also generate OutputDefs, not just text/textarea. The current code (L12) filters to `field.type === "text" || field.type === "textarea"`. This must be expanded to include all non-file types.

### outputData Dual-View

**Current outputData structure** (from `input-transform.service.ts` L165-174):
```typescript
const outputData = {
  fields: formData,     // { [fieldId]: value }
  files: [...],
  text: combinedText,
  confirmedAt: "..."
};
```

**Extended structure:**
```typescript
const outputData = {
  fields: formData,          // { [fieldId]: value } - backward compatible
  fieldsByKey: fieldsByKey,   // { [machineKey]: value } - new dual view
  files: [...],
  text: combinedText,
  confirmedAt: "..."
};
```

The `fieldsByKey` map is built by iterating formFields config, looking up each field's machineKey, and mapping `machineKey -> formData[field.id]`.

### Variable Resolution Update

**Current** (`model-call.service.ts` L42-51): Resolves `{{nodeId.outputId}}` by looking up `outputData[outputId]`, then falling back to `outputData.fields[fieldKey]`.

**Extension for machineKey:** Add a third fallback that checks `outputData.fieldsByKey[outputId]`:
```typescript
if (value === undefined || value === null) {
  const fieldsByKey = od.fieldsByKey as Record<string, unknown> | undefined;
  if (fieldsByKey) {
    value = fieldsByKey[outputId];
  }
}
```

This enables `{{nodeId.project_name}}` syntax when machineKey is "project_name".

### Executor Field Rendering

**Current** (`InputTransformExecutor.tsx` L276-323): `renderField()` handles text and textarea. File fields are rendered separately.

**Extension:** Add cases in `renderField()` for:
- `number`: `<input type="number">` with same styling
- `date`: `<input type="date">`
- `datetime`: `<input type="datetime-local">`
- `select`: `<select>` with `<option>` from field.options
- `multiselect`: checkbox group or `<select multiple>`

**Layout consideration:** number/date/datetime are single-column like text. select is single-column. multiselect may need full width (col-span-2) depending on option count.

**textFields filter update** (L328): Currently filters `f.type !== "file"`. This already works for new types since they are all non-file. No change needed.

### Backend Validation

**Location:** `packages/backend/src/modules/workflows/validation.ts` -- this is workflow structure validation (save-time).

**Runtime validation** for form submission happens in the input-transform confirm endpoint. Currently in `input-transform.routes.ts` or `InputTransformExecutor.tsx` (frontend only basic required check).

**New backend validations needed:**
1. **number**: Check value is numeric (not NaN after parseFloat)
2. **date**: Check ISO date format (YYYY-MM-DD)
3. **datetime**: Check ISO datetime format (YYYY-MM-DDTHH:mm:ss)
4. **select**: Check value is in field.options array
5. **multiselect**: Check each comma-separated value is in field.options
6. **machineKey format**: `/^[a-zA-Z_][a-zA-Z0-9_]*$/` validation at workflow save time
7. **machineKey uniqueness**: No duplicate machineKeys within the same node

### Recommended Project Structure Changes

```
packages/shared/src/types.ts                    # FormFieldDef type extension
packages/backend/src/modules/runtime/
  background.service.ts                          # Bug fixes (2 changes)
  input-transform.service.ts                     # confirmInputTransform: add fieldsByKey + validate new types
  model-call.service.ts                          # resolvePromptTemplate: add fieldsByKey fallback
packages/backend/src/modules/workflows/
  validation.ts                                  # machineKey format + uniqueness validation
packages/frontend/src/components/workflow/config/
  InputTransformConfig.tsx                        # FIELD_TYPE_OPTIONS + type-specific config + machineKey UI
packages/frontend/src/components/workspace/nodes/
  InputTransformExecutor.tsx                      # renderField: new type controls + validation
packages/frontend/src/lib/flow-engine/
  derive-outputs.ts                               # machineKey-based output IDs + include new types
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date parsing/validation | Custom regex for date formats | `new Date(value).toISOString()` or simple regex `/^\d{4}-\d{2}-\d{2}$/` | Edge cases with time zones, leap years |
| machineKey from Chinese labels | Pinyin conversion library | Simple `field_N` auto-suggestion | Adding a pinyin library for one feature is overkill |
| Options list drag-and-drop | Custom drag-and-drop implementation | Up/down move buttons (existing pattern from moveField) | Matches existing field reorder pattern exactly |

## Common Pitfalls

### Pitfall 1: Background Service Skip + Advance State Mismatch
**What goes wrong:** Calling `skipNode()` from runtime.service.ts inside the background loop causes double-advancement because the loop also calls `advanceNode()` at L276.
**Why it happens:** `skipNode()` already advances to the next pending node internally.
**How to avoid:** Either (a) use `skipNode()` and `continue` to skip `advanceNode()`, or (b) directly update DB status to "skipped" without calling `skipNode()` and let `advanceNode()` handle progression.
**Warning signs:** Nodes getting skipped in the execution order, or "Node execution not found" errors.

### Pitfall 2: derive-outputs Breaking Existing Variable References
**What goes wrong:** Changing output ID format from `${nodeId}-field-${field.id}` to `${nodeId}-field-${field.machineKey}` breaks existing workflows that reference the UUID-based ID.
**Why it happens:** Saved workflow configs contain VariableRef with the old outputId format.
**How to avoid:** Use `field.machineKey || field.id` so existing workflows without machineKey continue to use UUID-based IDs. Only workflows where machineKey is explicitly set will use the new format.
**Warning signs:** Broken variable references in prompt templates after upgrade.

### Pitfall 3: formData Key Mismatch Between Fields and fieldsByKey
**What goes wrong:** formData from frontend uses `field.id` as keys. When building `fieldsByKey`, you need to cross-reference the field config to map id -> machineKey.
**Why it happens:** The confirm endpoint receives `formData: Record<string, string>` keyed by field.id. The config with machineKey information must be loaded separately.
**How to avoid:** Load the workflow node config in `confirmInputTransform` to access machineKey mappings. The config is available via the document's workflow.

### Pitfall 4: Multiselect Comma-in-Value Ambiguity
**What goes wrong:** If an option text contains a comma, comma-joined storage becomes ambiguous.
**Why it happens:** User decision specifies comma-separated storage for multiselect.
**How to avoid:** Document that option texts must not contain commas. Add validation in the config panel to reject commas in option text. Alternatively, store as JSON array string, but user decision says comma-join.

### Pitfall 5: Select Default Value Not in Options
**What goes wrong:** Admin sets a default value, then removes that option from the list.
**Why it happens:** Default value and options list are managed independently.
**How to avoid:** Clear defaultValue/defaultValues when the referenced option is removed from the list.

## Code Examples

### Bug Fix 1: Export Node Type
```typescript
// background.service.ts L259 - BEFORE:
case "file_export": {

// AFTER:
case "export": {
```

### Bug Fix 2: Skippable+AutoAdvance Check
```typescript
// background.service.ts, inside the loop after L222, before L224:
const nodeDef = wfNodeMap.get(exec.nodeId);
if (nodeDef?.config?.skippable && nodeDef?.config?.autoAdvance) {
  // Auto-skip: mark as skipped and continue without executing
  const skipTime = new Date();
  await db
    .update(nodeExecutions)
    .set({ status: "skipped", completedAt: skipTime, updatedAt: skipTime })
    .where(eq(nodeExecutions.id, exec.id));
  // Update progress
  const progress = Math.round(((i + 1) / totalNodes) * 100);
  await db
    .update(backgroundTasks)
    .set({ progress, updatedAt: skipTime })
    .where(eq(backgroundTasks.id, task.id));
  continue;  // Skip execution and advanceNode
}
```

Note: The `nodeDef` lookup already exists at L224, so move it before the skip check to avoid duplication.

### machineKey Validation (workflow save-time)
```typescript
// In validation.ts, inside the formFields validation block:
const MACHINE_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const machineKeys = new Set<string>();

for (const field of fields) {
  if (field.machineKey) {
    if (!MACHINE_KEY_REGEX.test(field.machineKey)) {
      errors.push({
        nodeId: node.id,
        field: "machineKey",
        message: `字段 "${field.label}" 的 machineKey "${field.machineKey}" 格式不合法`,
        severity: "error",
      });
    }
    if (machineKeys.has(field.machineKey)) {
      errors.push({
        nodeId: node.id,
        field: "machineKey",
        message: `字段 "${field.label}" 的 machineKey "${field.machineKey}" 与其他字段重复`,
        severity: "error",
      });
    }
    machineKeys.add(field.machineKey);
  }
}
```

### fieldsByKey Construction
```typescript
// In confirmInputTransform, after building outputData:
// Load workflow config to get machineKey mappings
const wfConfig = await getWorkflowConfigForNode(documentId, nodeExecutionId);
const fieldsByKey: Record<string, string> = {};
if (wfConfig?.formFields) {
  for (const field of wfConfig.formFields) {
    if (field.machineKey && formData[field.id] !== undefined) {
      fieldsByKey[field.machineKey] = formData[field.id];
    }
  }
}

const outputData = {
  fields: formData,
  fieldsByKey,
  files: [...],
  text: combinedText,
  confirmedAt: new Date().toISOString(),
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UUID-only field IDs | UUID + optional machineKey | This phase | Enables human-readable variable references |
| 3 field types (text/textarea/file) | 8 field types | This phase | Richer form input capabilities |
| fields-only outputData | fields + fieldsByKey dual view | This phase | Backward compatible, enables machineKey references |

## Open Questions

1. **How to load workflow config in confirmInputTransform**
   - What we know: `confirmInputTransform` receives `documentId` and `nodeExecutionId` but not the workflow config
   - What's unclear: Whether to pass it from the route handler or query it inside the service
   - Recommendation: Query inside the service using `getWorkflowForDocument` pattern (already used in runtime.service.ts)

2. **Multiselect control choice**
   - What we know: User said "multi-checkbox or native multi-select" (Claude's discretion)
   - Recommendation: Use checkbox group -- better UX for small option lists typical in form builders, more touch-friendly, visible state without click

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all files listed in CONTEXT.md code_context section
- `packages/shared/src/types.ts` -- FormFieldDef, WorkflowNodeType, NodeConfig definitions
- `packages/backend/src/modules/runtime/background.service.ts` -- both bugs verified at exact line numbers
- `packages/backend/src/modules/runtime/model-call.service.ts` L20-68 -- resolvePromptTemplate implementation
- `packages/backend/src/modules/runtime/input-transform.service.ts` -- confirmInputTransform and outputData structure
- `packages/frontend/src/components/workflow/config/InputTransformConfig.tsx` -- FIELD_TYPE_OPTIONS and addField patterns
- `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` -- renderField and form submission
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` -- output ID generation
- `packages/backend/src/modules/workflows/validation.ts` -- workflow validation patterns
- `docs/design/flow-node-capability-analysis.md` -- bug descriptions and machineKey design

### Secondary (MEDIUM confidence)
- `packages/backend/src/modules/runtime/runtime.service.ts` L401-466 -- skipNode implementation

## Metadata

**Confidence breakdown:**
- Bug fixes: HIGH - exact line numbers verified, root cause clear
- Type extension: HIGH - follows established patterns with clear code locations
- machineKey + dual-view: HIGH - design doc provides detailed specification
- Variable resolution: HIGH - resolvePromptTemplate code inspected, extension path clear

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable internal project, no external dependency changes)
