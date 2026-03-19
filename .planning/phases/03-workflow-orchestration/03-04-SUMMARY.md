---
phase: 03-workflow-orchestration
plan: "04"
subsystem: frontend
tags: [config-panel, node-forms, prompt-editor, variable-picker, solidjs]

# Dependency graph
requires:
  - phase: 03-workflow-orchestration
    plan: "03"
    provides: WorkflowEditor three-column layout with config panel slot; selectedNodeId signal
  - phase: 03-workflow-orchestration
    plan: "01"
    provides: shared types (InputTransformConfig, DesensitizeConfig, ModelCallConfig, RestoreConfig, ExportConfig, OutputDef, VariableRef)
provides:
  - ConfigPanel right-side slide-out with type-specific config forms for all 5 node types
  - PromptEditor textarea with {{ trigger, variable insertion, and colored tag preview
  - VariablePicker dropdown grouped by source node + system variables section
  - OutputsEditor for managing named content block outputs on any node
  - All node config forms wired into WorkflowEditor via config/outputs/label callbacks
affects: [03-05, workflow-execution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ConfigPanel uses 'as unknown as T' double-cast for node config — WorkflowNodeData stores config as Record<string,unknown> at storage layer; cast is pragmatic at component boundary"
    - "getUpstreamNodeIds BFS traversal over edges[] for computing upstream variable scope"
    - "PromptEditor: plain textarea (editing) + preview div (tag rendering) split — textarea cannot render rich content; preview div parses {{...}} patterns into colored spans"
    - "VariablePicker groups outputs by upstream node; system variables in separate section at bottom"
    - "queue.shift() guard: replaced non-null assertion with explicit undefined check for Biome compliance"

key-files:
  created:
    - packages/frontend/src/components/workflow/config/ConfigPanel.tsx
    - packages/frontend/src/components/workflow/config/OutputsEditor.tsx
    - packages/frontend/src/components/workflow/config/InputTransformConfig.tsx
    - packages/frontend/src/components/workflow/config/DesensitizeConfig.tsx
    - packages/frontend/src/components/workflow/config/ModelCallConfig.tsx
    - packages/frontend/src/components/workflow/config/RestoreConfig.tsx
    - packages/frontend/src/components/workflow/config/ExportConfig.tsx
    - packages/frontend/src/components/workflow/prompt/PromptEditor.tsx
    - packages/frontend/src/components/workflow/prompt/VariablePicker.tsx
  modified:
    - packages/frontend/src/pages/admin/WorkflowEditor.tsx (added ConfigPanel, handlers for config/outputs/label changes)

key-decisions:
  - "Used 'as unknown as T' double-cast instead of direct 'as T' for config type coercion — TypeScript requires intermediate unknown step when Record<string,unknown> doesn't sufficiently overlap with concrete config interface types"
  - "Biome forbids non-null assertions (!) — replaced queue.shift()! with explicit undefined guard and pairedNode()! with optional chaining"
  - "PromptEditor uses textarea+preview split approach — textareas cannot render inline JSX elements; a separate preview div below the textarea renders {{varName}} as colored tag chips"
  - "Variable name convention: {nodeLabel}.{outputName} — namespaced by node label to disambiguate same-named outputs across different nodes"
  - "getUpstreamNodeIds uses BFS over edges traversed backward from current node — supports multi-hop upstream variable access"

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 3 Plan 04: Node Configuration Panel Summary

**Right-side config panel with 5 type-specific node forms and PromptEditor with {{variable}} tag system — complete node configuration UX for the workflow editor**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-19T11:12:21Z
- **Completed:** 2026-03-19T11:17:41Z
- **Tasks:** 2 (executed together in 1 commit)
- **Files created/modified:** 10

## Accomplishments

- Created ConfigPanel: w-80 slide-in right panel with colored left border per node type, editable node label in header, close button, and scrollable body with type-specific form + OutputsEditor footer. Uses BFS upstream traversal to compute available variables for prompt/export nodes.
- Created OutputsEditor: add/edit/remove named content block outputs (OutputDef[]). Each output has name and description inputs. "添加输出" button creates with UUID id.
- Created InputTransformConfig: FormFieldDef list editor with up/down reorder buttons, name/label/type(select)/required(checkbox) per field, allowFileUpload toggle, accepted file types multi-select when upload enabled.
- Created DesensitizeConfig: rule type pill toggles (姓名/身份证号/手机号/地址/银行卡号/邮箱/自定义), placeholder format input with variable hint, local model dropdown from GET /api/models.
- Created RestoreConfig: desensitize node pairing selector (dropdown of all desensitize nodes in flow), green "已配对" or amber "未配对" status badge with descriptive message.
- Created ExportConfig: format radio group (Word/PDF/Markdown) with descriptions, template selector placeholder, content mapping checkbox list of upstream node outputs.
- Created ModelCallConfig: display name input, model selector (grouped by provider via GET /api/models), PromptEditor integration with upstream variable computation.
- Created PromptEditor: textarea with onInput detecting `{{` to open VariablePicker, "插入变量" button, preview section (only shown when `{{` present) with colored tag chips per node type (blue/orange/purple/green/red for node types, gray for system vars), Esc key closes picker.
- Created VariablePicker: dropdown with search filter, outputs grouped by source node (icon + label header), system variables section (工作目录/输入目录/输出目录/脱敏规则). Click outside closes via onBlur delay.
- Updated WorkflowEditor: replaced placeholder right column with ConfigPanel, added handleConfigChange/handleOutputsChange/handleLabelChange functions that update the nodes array store.

## Task Commits

1. **Tasks 1 & 2: Config panel, all node forms, prompt editor with variable system** - `b602324` (feat)

## Files Created/Modified

- `packages/frontend/src/components/workflow/config/ConfigPanel.tsx` — slide-out container, BFS upstream traversal, Switch/Match type dispatch
- `packages/frontend/src/components/workflow/config/OutputsEditor.tsx` — add/edit/remove OutputDef[]
- `packages/frontend/src/components/workflow/config/InputTransformConfig.tsx` — FormFieldDef list + file upload toggle
- `packages/frontend/src/components/workflow/config/DesensitizeConfig.tsx` — rule type toggles + local model selector
- `packages/frontend/src/components/workflow/config/ModelCallConfig.tsx` — model selector + PromptEditor integration
- `packages/frontend/src/components/workflow/config/RestoreConfig.tsx` — pairing selector + status badge
- `packages/frontend/src/components/workflow/config/ExportConfig.tsx` — format selector + content mapping
- `packages/frontend/src/components/workflow/prompt/PromptEditor.tsx` — textarea + {{ trigger + colored preview
- `packages/frontend/src/components/workflow/prompt/VariablePicker.tsx` — grouped dropdown + search + system vars
- `packages/frontend/src/pages/admin/WorkflowEditor.tsx` — ConfigPanel wired, debug span removed, 3 handler functions added

## Decisions Made

- Used `as unknown as T` double-cast for config type coercion at component boundary — direct `as T` from `Record<string,unknown>` is rejected by TypeScript when types don't sufficiently overlap; intermediate `unknown` is the correct pattern
- Biome lint rule `noNonNullAssertion` forbids `!` — replaced `queue.shift()!` with explicit `undefined` guard; replaced `pairedNode()!` with `pairedNode()?.` optional chain
- PromptEditor uses textarea + separate preview div — textarea cannot render inline JSX, so the editing surface stays plain text with `{{varName}}` syntax and a preview div below renders colored tag chips
- Variable naming convention `{nodeLabel}.{outputName}` — scoped by node label to prevent collisions when multiple nodes have identically named outputs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript TS2352 double-cast errors in ConfigPanel**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `nodeConfig() as InputTransformConfig` rejected because `Record<string,unknown>` doesn't overlap with the concrete config interface type
- **Fix:** Changed all config casts to `as unknown as T` pattern (correct TypeScript coercion through unknown)
- **Files modified:** ConfigPanel.tsx
- **Committed in:** `b602324`

**2. [Rule 2 - Biome] Replaced non-null assertions for Biome compliance**
- **Found during:** Task 1 (IDE diagnostics)
- **Issue:** `queue.shift()!` and `pairedNode()!.data.label` trigger Biome `noNonNullAssertion` error
- **Fix:** Added explicit `undefined` check for queue.shift(); used optional chaining `?.` for pairedNode()
- **Files modified:** ConfigPanel.tsx, RestoreConfig.tsx
- **Committed in:** `b602324`

---

**Total deviations:** 2 auto-fixed (1 TypeScript cast, 1 Biome lint)
**Impact on plan:** No scope change. Both fixed within single commit.

## Self-Check: PASSED

Files verified present:
- packages/frontend/src/components/workflow/config/ConfigPanel.tsx — FOUND
- packages/frontend/src/components/workflow/prompt/PromptEditor.tsx — FOUND
- packages/frontend/src/components/workflow/prompt/VariablePicker.tsx — FOUND
Commit b602324 — FOUND

## Next Phase Readiness

- All 5 node types fully configurable via the right-side panel
- Config changes propagate to the nodes store and will be saved via WorkflowEditor's Save button
- PromptEditor {{variable}} system is ready; variables are computed from upstream node outputs via BFS edge traversal
- OutputDef[] on each node is the foundation for the variable reference system used in Plan 03-05 (execution)
- No blockers for Plan 03-05 (workflow execution engine)

---
*Phase: 03-workflow-orchestration*
*Completed: 2026-03-19*
