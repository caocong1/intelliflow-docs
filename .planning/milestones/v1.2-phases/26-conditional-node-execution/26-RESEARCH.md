# Phase 26: Conditional Node Execution - Research

**Researched:** 2026-03-27
**Domain:** Runtime execution rules, condition evaluation, workflow configuration UI
**Confidence:** HIGH

## Summary

Phase 26 adds conditional execution rules to workflow nodes, enabling automatic skip or block actions based on upstream output values. The implementation touches four layers: shared types (new `NodeCondition`, `NodeExecutionRule` types, `blocked` status), backend runtime (condition evaluation in `advanceNode()` and `executeDocumentPipeline()`), database (pgEnum extension for `blocked` status), and frontend (condition configuration UI in workflow editor + blocked node display in workspace).

The design document (`docs/design/flow-node-capability-analysis.md` Gap #5) provides a complete specification. Phase 24's `resolveRef()` with `fieldPath` support and `VariableRef` with `fieldPath` are prerequisites that are already implemented. The core implementation pattern is: evaluate conditions using the existing `resolveRef()` function before entering each node, reusing the same variable resolution infrastructure that prompt templates and contentMapping use.

**Primary recommendation:** Add condition evaluation as a pre-entry check in `advanceNode()` (and the background pipeline loop), reusing `resolveRef()` for value resolution. The `executionRule` field goes on each node config type. The condition configuration UI is a new reusable `ExecutionRuleEditor` component embedded at the bottom of `ConfigPanel` for all 5 node types.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Condition configuration UI: collapsible "execution conditions" panel at the **bottom of each node's config panel**, collapsed when empty
- Row-based rule builder: each condition is one row `[upstream variable picker] [operator dropdown] [value input]`, with "+" to add conditions, AND/OR logic selector at top
- Variable picker **reuses existing VariablePicker component**
- **All 5 node types** can have execution conditions
- Blocked nodes show **red "blocked" label** in the left node list, consistent with existing completed/skipped/failed label styles
- "Return to upstream" button triggers **confirmation dialog** warning that rollback clears intermediate outputs, then executes `rollbackToNode`
- Skip vs Block naming: Chinese labels -- "skip" = auto-skip and continue; "block" = stop pipeline, must fix
- No default action on new rules -- user must explicitly choose skip or block
- Skipped nodes show **gray "skipped" label + skip reason** (which condition triggered)
- Manual skip shows "user skipped", conditional skip shows "conditional skip: XXX"
- Comparison value uses **text input + smart suggestion dropdown** based on historical output values or predefined common values

### Claude's Discretion
- Blocked node content area display style (inline warning card vs full-screen block page vs other)
- Blocking reason information detail level (concise description vs full condition list)
- exists/not_exists operator value input handling
- Smart suggestion data source strategy

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| SolidJS | Frontend framework | Project standard |
| Drizzle ORM | Database queries | Project standard |
| PostgreSQL pgEnum | Status enum | Already used for `node_execution_status` |
| `resolveRef()` | Variable value resolution | Existing 6-level priority chain in `model-call.service.ts` |
| `VariablePicker` | Variable selection UI | Existing component, reused for condition sourceRef |
| `rollbackToNode()` | Node rollback | Existing function in `runtime.service.ts` |

### No New Dependencies Required
This phase requires no new npm packages. All functionality is built on existing infrastructure.

## Architecture Patterns

### Type Definitions (shared/types.ts)

```typescript
// New types to add
interface NodeCondition {
  sourceRef: VariableRef;  // reuses existing VariableRef with fieldPath
  operator: "equals" | "not_equals" | "exists" | "not_exists" | "contains";
  value?: string;          // not needed for exists/not_exists
}

interface NodeExecutionRule {
  action: "skip" | "block";
  conditions: NodeCondition[];
  logic: "and" | "or";
}

// Extend NodeExecutionStatus
type NodeExecutionStatus = "pending" | "in_progress" | "completed" | "skipped" | "failed" | "blocked";
```

The `executionRule` field is added to ALL 5 config interfaces (`InputTransformConfig`, `DesensitizeConfig`, `ModelCallConfig`, `RestoreConfig`, `ExportConfig`) as an optional field:

```typescript
executionRule?: NodeExecutionRule;
```

### Database Migration

The `nodeExecutionStatusEnum` in `schema.ts` (line 201) currently has 5 values. Adding `"blocked"` requires:

1. A Drizzle migration that runs `ALTER TYPE node_execution_status ADD VALUE 'blocked'`
2. Update the pgEnum definition in `schema.ts`

**Critical pattern:** PostgreSQL `ADD VALUE` to an enum is non-transactional in PG < 12 but the project likely runs PG 12+. Either way, Drizzle handles this via generated SQL migrations.

### Condition Evaluation Logic (Backend)

The core evaluation function:

```typescript
// New function in runtime.service.ts (or a new conditions.service.ts)
function evaluateExecutionRule(
  rule: NodeExecutionRule,
  nodeExecs: Array<{ nodeId: string; outputData: Record<string, unknown> | null }>
): { triggered: boolean; reason: string } {
  const results = rule.conditions.map(cond => {
    const value = resolveRef(
      { nodeId: cond.sourceRef.nodeId, outputId: cond.sourceRef.outputId, fieldPath: cond.sourceRef.fieldPath },
      nodeExecs
    );
    return evaluateCondition(cond, value);
  });

  const triggered = rule.logic === "and"
    ? results.every(r => r)
    : results.some(r => r);

  return { triggered, reason: buildReasonString(rule, results) };
}

function evaluateCondition(cond: NodeCondition, resolvedValue: string | undefined): boolean {
  switch (cond.operator) {
    case "exists": return resolvedValue !== undefined;
    case "not_exists": return resolvedValue === undefined;
    case "equals": return resolvedValue === cond.value;
    case "not_equals": return resolvedValue !== cond.value;
    case "contains": return resolvedValue?.includes(cond.value ?? "") ?? false;
  }
}
```

### Insertion Point in advanceNode()

In `runtime.service.ts::advanceNode()` at line 235-237, after finding the next pending node but **before** setting it to `in_progress`:

```typescript
// After: const nextNode = nextNodes[0];
// Before: await db.update(nodeExecutions).set({ status: "in_progress" ...

// NEW: Check execution rule
const nextNodeDef = wfData.nodes.find(n => n.id === nextNode.nodeId);
const executionRule = nextNodeDef?.config?.executionRule;

if (executionRule) {
  const allCurrentExecs = await getCurrentExecutions(documentId);
  const { triggered, reason } = evaluateExecutionRule(executionRule, allCurrentExecs);

  if (triggered) {
    if (executionRule.action === "skip") {
      // Auto-skip: set status to skipped with reason, recurse to next
      await db.update(nodeExecutions).set({
        status: "skipped",
        outputData: { skipReason: reason, skipType: "conditional" },
        completedAt: now, updatedAt: now
      }).where(eq(nodeExecutions.id, nextNode.id));
      // Recursively advance to find the real next node
      return advanceNode(documentId, nextNode.id, userId);
    }

    if (executionRule.action === "block") {
      // Block: set status to blocked with reason, do NOT advance further
      await db.update(nodeExecutions).set({
        status: "blocked",
        outputData: { blockReason: reason, blockType: "conditional" },
        updatedAt: now
      }).where(eq(nodeExecutions.id, nextNode.id));
      // Return current state (blocked node is now visible)
      // ... return buildRuntimeState
    }
  }
}
// ... continue with normal in_progress flow
```

### Insertion Point in Background Pipeline

In `background.service.ts::executeDocumentPipeline()` at line 244 (after auto-skip check, before setting `in_progress`):

```typescript
// After skippable+autoAdvance check, before "Update node to in_progress"
// NEW: Check execution rule
const executionRule = nodeDef.config?.executionRule;
if (executionRule) {
  const allCurrentExecs = await db.select()
    .from(nodeExecutions)
    .where(and(eq(nodeExecutions.documentId, documentId), eq(nodeExecutions.isCurrent, true)))
    .orderBy(asc(nodeExecutions.stepOrder));

  const { triggered, reason } = evaluateExecutionRule(executionRule, allCurrentExecs);

  if (triggered && executionRule.action === "skip") {
    // Auto-skip in background
    await db.update(nodeExecutions).set({
      status: "skipped", completedAt: new Date(), updatedAt: new Date(),
      outputData: { skipReason: reason, skipType: "conditional" }
    }).where(eq(nodeExecutions.id, exec.id));
    continue; // next node in loop
  }

  if (triggered && executionRule.action === "block") {
    // STOP the pipeline — set blocked, notify, mark task as needs_attention
    await db.update(nodeExecutions).set({
      status: "blocked", updatedAt: new Date(),
      outputData: { blockReason: reason, blockType: "conditional" }
    }).where(eq(nodeExecutions.id, exec.id));
    // Send block notification
    await notifyBlocked(userId, documentId, nodeDef.label, reason);
    // Mark background task — not failed, but stopped
    await db.update(backgroundTasks).set({
      status: "failed", errorMessage: `节点「${nodeDef.label}」被条件阻断：${reason}`,
      updatedAt: new Date()
    }).where(eq(backgroundTasks.id, task.id));
    return; // Stop pipeline
  }
}
```

### Frontend: ExecutionRuleEditor Component

New component at `packages/frontend/src/components/workflow/config/ExecutionRuleEditor.tsx`:

```
ExecutionRuleEditor (collapsible panel)
├── Header: "执行条件" + expand/collapse toggle + condition count badge
├── Action selector: "跳过" / "阻断" (radio/select, required)
├── Logic selector: AND / OR toggle (when >1 condition)
└── Condition rows (For each):
    ├── VariablePicker (reused, for sourceRef)
    ├── Operator dropdown (equals/not_equals/exists/not_exists/contains)
    ├── Value input (text + smart suggestions, hidden for exists/not_exists)
    ├── Remove button (-)
    └── Add button (+) at bottom
```

**Mount point:** In `ConfigPanel.tsx`, after the node-type-specific config panel and before the "node outputs" section (around line 200). The `ExecutionRuleEditor` renders for ALL node types (unlike RuntimeSettings which excludes input_transform and export).

### Frontend: Blocked Node Display in Workspace

In `DocumentWorkspace.tsx`, extend the status handling:

1. **StepperBar.tsx:** Add `blocked` status color (red), label "已阻断"
2. **DocumentWorkspace.tsx:** Add a `<Match when={node.status === "blocked"}>` case in `renderExecutor()` that shows:
   - Red warning card with block reason
   - "返回修改上游" button (with confirmation dialog)
   - The button calls `rollbackToNode()` targeting the earliest stepOrder among all `sourceRef.nodeId` values
3. **NodeHistoryPanel.tsx:** Add `blocked: { label: "已阻断", variant: "error" }` to statusBadge map

### Frontend: Conditional Skip Display

Extend the existing "skipped" display to differentiate:
- `outputData.skipType === "conditional"` -> show "条件跳过：{skipReason}"
- No `skipType` or `skipType !== "conditional"` -> show "用户跳过"

### Rollback Target Calculation

When a blocked node has multiple conditions referencing different upstream nodes, the rollback target is the **earliest stepOrder** among all `sourceRef.nodeId` values:

```typescript
function getRollbackTarget(
  executionRule: NodeExecutionRule,
  nodeExecs: NodeExecution[]
): number {
  const sourceNodeIds = new Set(executionRule.conditions.map(c => c.sourceRef.nodeId));
  const stepOrders = nodeExecs
    .filter(ne => sourceNodeIds.has(ne.nodeId))
    .map(ne => ne.stepOrder);
  return Math.min(...stepOrders);
}
```

### Workflow Validation Extension

In `validation.ts::validateWorkflow()`, add a new rule to validate executionRule references:
- Each `sourceRef.nodeId` must exist in the workflow
- Each `sourceRef.nodeId` must be upstream of the node (check via edges)
- Each `sourceRef.outputId` (segmentKey) must exist in the source node's outputs
- `value` must be provided when operator is `equals`, `not_equals`, or `contains`
- `value` must be empty/absent when operator is `exists` or `not_exists`

### Recommended Project Structure for New Files

```
packages/shared/src/types.ts               # Add NodeCondition, NodeExecutionRule, extend NodeExecutionStatus
packages/backend/src/db/schema.ts           # Add "blocked" to nodeExecutionStatusEnum
packages/backend/drizzle/XXXX_add_blocked.sql  # Migration
packages/backend/src/modules/runtime/
  ├── conditions.service.ts                 # NEW: evaluateExecutionRule(), evaluateCondition()
  ├── runtime.service.ts                    # Modify advanceNode() to call condition evaluation
  └── background.service.ts                 # Modify pipeline loop for condition evaluation
packages/backend/src/modules/workflows/
  └── validation.ts                         # Add executionRule validation rule
packages/frontend/src/components/workflow/config/
  ├── ExecutionRuleEditor.tsx               # NEW: condition rule builder UI
  └── ConfigPanel.tsx                       # Mount ExecutionRuleEditor for all node types
packages/frontend/src/components/workspace/
  ├── StepperBar.tsx                        # Add blocked status styling
  ├── NodeHistoryPanel.tsx                  # Add blocked status badge
  └── nodes/BlockedNodeCard.tsx             # NEW: blocked display + rollback button
packages/frontend/src/pages/workspace/
  └── DocumentWorkspace.tsx                 # Handle blocked status in renderExecutor
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variable resolution | Custom condition value resolver | `resolveRef()` from `model-call.service.ts` | Already handles 6-level priority chain + fieldPath |
| Node rollback | Custom rollback logic for blocked nodes | `rollbackToNode()` from `runtime.service.ts` | Already handles executionRound tracking, isCurrent flagging |
| Variable selection UI | New variable browser for conditions | Existing `VariablePicker` component | Consistent UX, already supports fieldPath tree for JSON schemas |
| Upstream node detection | Custom graph traversal | `getUpstreamNodeIds()` from `ConfigPanel.tsx` | Already does BFS backward from a node through edges |

**Key insight:** This phase is primarily an integration/orchestration task. Almost all building blocks exist -- the work is connecting them with new condition evaluation logic and UI.

## Common Pitfalls

### Pitfall 1: pgEnum Migration for "blocked"
**What goes wrong:** Drizzle's `pgEnum` with `ADD VALUE` can fail if done inside a transaction. PostgreSQL requires enum value additions to be committed before use.
**Why it happens:** Drizzle may wrap migrations in transactions by default.
**How to avoid:** Generate the migration and verify the SQL uses `ALTER TYPE node_execution_status ADD VALUE IF NOT EXISTS 'blocked'` outside a transaction block. Test the migration on a fresh database.
**Warning signs:** Migration fails with "cannot add enum value inside a transaction"

### Pitfall 2: Recursive advanceNode and Condition Evaluation
**What goes wrong:** `advanceNode()` already has recursive calls (line 300 for autoAdvance restore nodes). Adding condition evaluation creates another recursion path (skip -> advance to next -> might also have conditions).
**Why it happens:** Multiple nodes in sequence could all have skip conditions.
**How to avoid:** Ensure the recursive pattern is consistent. When a node is conditionally skipped, the recursion should reuse the same `advanceNode()` flow. Add a recursion depth guard (e.g., max 50 iterations) to prevent infinite loops from misconfigured circular conditions.
**Warning signs:** Stack overflow or infinite loop in advanceNode

### Pitfall 3: Background Pipeline State Mismatch
**What goes wrong:** `background.service.ts` pre-loads executions at line 178-187 and iterates the snapshot. If condition evaluation reads fresh data from DB but the loop references stale `executions` array, status can be inconsistent.
**Why it happens:** The loop uses a pre-fetched `executions` array but advanceNode modifies DB state.
**How to avoid:** For condition evaluation in the background pipeline, always query fresh `nodeExecutions` from DB rather than using the stale `executions` snapshot. The background pipeline already calls `advanceNode()` which does fresh queries.
**Warning signs:** Conditions evaluate against stale outputData

### Pitfall 4: resolveRef Returns undefined for Incomplete Upstream
**What goes wrong:** If a condition references an upstream node that hasn't completed yet (status is `pending` or `in_progress`), `resolveRef()` returns `undefined` because `outputData` is null.
**How to avoid:** Per the design doc: "condition referencing incomplete upstream evaluates to false (no trigger)". This is the correct default behavior since `resolveRef` returns `undefined` -> `exists` returns false, `equals` returns false, etc. Document this behavior explicitly.
**Warning signs:** Conditions triggering unexpectedly on nodes with null outputData

### Pitfall 5: Blocked Status Not Handled in All UI Locations
**What goes wrong:** The `NodeExecutionStatus` type is checked in many frontend locations: `StepperBar.tsx`, `DocumentWorkspace.tsx`, `NodeHistoryPanel.tsx`, `ActionBar.tsx`, and various executor components. Missing any one creates rendering bugs.
**Why it happens:** The status is a union type but TypeScript won't error on non-exhaustive checks in `if` chains (only in `switch` with `never` checks).
**How to avoid:** Grep for all usages of `NodeExecutionStatus`, `node.status`, and status string literals across the frontend. Create a checklist of every file that needs the `blocked` case added.
**Warning signs:** Blocked nodes rendering as "pending" or showing no content

### Pitfall 6: Rollback Confirmation Dialog and State
**What goes wrong:** User clicks "return to upstream" but the rollback clears intermediate outputs. If the user doesn't realize this, they lose work.
**Why it happens:** `rollbackToNode()` marks all downstream `isCurrent` rows as not current and creates fresh execution rows.
**How to avoid:** The confirmation dialog (per user decision) must clearly state what will be cleared. Show the list of nodes between the rollback target and the blocked node.
**Warning signs:** User complaints about lost intermediate outputs after rollback

## Code Examples

### Condition Evaluation (verified pattern based on existing resolveRef)

```typescript
// Source: model-call.service.ts resolveRef pattern
import { resolveRef } from "./model-call.service";
import type { NodeCondition, NodeExecutionRule } from "@intelliflow/shared";

export function evaluateCondition(
  cond: NodeCondition,
  resolvedValue: string | undefined,
): boolean {
  switch (cond.operator) {
    case "exists":
      return resolvedValue !== undefined;
    case "not_exists":
      return resolvedValue === undefined;
    case "equals":
      return resolvedValue === cond.value;
    case "not_equals":
      return resolvedValue !== cond.value;
    case "contains":
      return resolvedValue !== undefined && resolvedValue.includes(cond.value ?? "");
    default:
      return false;
  }
}

export function evaluateExecutionRule(
  rule: NodeExecutionRule,
  nodeExecs: Array<{ nodeId: string; outputData: Record<string, unknown> | null }>,
): { triggered: boolean; reason: string } {
  const results = rule.conditions.map((cond) => {
    const value = resolveRef(
      { nodeId: cond.sourceRef.nodeId, outputId: cond.sourceRef.outputId, fieldPath: cond.sourceRef.fieldPath },
      nodeExecs,
    );
    return { cond, value, met: evaluateCondition(cond, value) };
  });

  const triggered = rule.logic === "and"
    ? results.every((r) => r.met)
    : results.some((r) => r.met);

  const metConditions = results.filter((r) => r.met);
  const reason = metConditions
    .map((r) => `${r.cond.sourceRef.variableName} ${r.cond.operator} ${r.cond.value ?? ""}`.trim())
    .join(rule.logic === "and" ? " AND " : " OR ");

  return { triggered, reason };
}
```

### ExecutionRuleEditor Component Structure (SolidJS pattern)

```typescript
// Source: matches ConfigPanel.tsx and VariablePicker.tsx patterns
interface ExecutionRuleEditorProps {
  rule: NodeExecutionRule | undefined;
  upstreamNodes: FlowNodeData[];
  edges: FlowEdgeData[];
  currentNodeId: string;
  onChange: (rule: NodeExecutionRule | undefined) => void;
}

// Collapsible panel pattern (consistent with other config sections)
export default function ExecutionRuleEditor(props: ExecutionRuleEditorProps) {
  const [expanded, setExpanded] = createSignal(!!props.rule);
  const hasRule = () => !!props.rule;
  // ... row-based condition builder using For each + VariablePicker
}
```

### exists/not_exists Value Input Handling (Claude's Discretion Recommendation)

For `exists` and `not_exists` operators, **hide the value input entirely** (not just disable it). This is cleaner UX -- the operator itself is the complete condition. When switching from `equals` to `exists`, clear the `value` field. When switching back from `exists` to `equals`, show the value input again (empty).

### Blocked Node Display (Claude's Discretion Recommendation)

Use an **inline warning card** within the node content area (not a full-screen block page). Rationale:
- Keeps the workspace context visible (user can see the stepper, other nodes)
- Consistent with how `failed` nodes are displayed (inline error message)
- Shows: red border card with warning icon, block reason text, and "返回修改上游" button

For blocking reason detail level, show a **concise description** with expandable full details:
- Default: "条件阻断：质检结果.hasBlockingIssues 等于 true"
- Expandable: full list of all conditions and their evaluation results

### Smart Suggestion Strategy (Claude's Discretion Recommendation)

For the value input smart suggestions, use a **simple approach**: when the selected `sourceRef` variable points to a node that has been executed (has `outputData`), extract the current value and show it as the first suggestion. No need for a complex historical value tracking system -- this is sufficient for the primary use case (quality check fields like `"true"`, `"false"`, `"passed"`, `"failed"`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual skip only (`skippable` flag) | Conditional skip + manual skip | Phase 26 | Nodes can be auto-skipped based on upstream values |
| 5-value status enum | 6-value status enum (+ `blocked`) | Phase 26 | New blocked state for condition-triggered pipeline stops |
| Linear pipeline execution | Conditional pipeline with skip/block | Phase 26 | Quality gates and conditional workflows possible |

## Open Questions

1. **Background task status for blocked pipelines**
   - What we know: When a node is blocked in background mode, the pipeline stops. The design says "send notification."
   - What's unclear: Should the background task status be `"failed"` (current approach) or should we add a new `"blocked"` status to the `backgroundTasks` table?
   - Recommendation: Use `"failed"` status with a descriptive `errorMessage` starting with "条件阻断:" prefix. This avoids another enum migration and the notification system already handles failures. The frontend can differentiate by checking the errorMessage prefix if needed.

2. **Re-evaluation after rollback**
   - What we know: User rolls back -> modifies upstream -> advances again -> blocked node is re-evaluated.
   - What's unclear: The rollback creates new execution rows (new round). When `advanceNode()` reaches the previously-blocked node, it will naturally re-evaluate because it's now a fresh `pending` node.
   - Recommendation: No special handling needed. The existing rollback + advance flow naturally re-evaluates. Verify this in testing.

## Sources

### Primary (HIGH confidence)
- `docs/design/flow-node-capability-analysis.md` Gap #5 -- complete specification for conditional execution
- `packages/shared/src/types.ts` -- current type definitions (VariableRef with fieldPath, NodeExecutionStatus, all config types)
- `packages/backend/src/modules/runtime/runtime.service.ts` -- advanceNode(), rollbackToNode(), skipNode() implementations
- `packages/backend/src/modules/runtime/background.service.ts` -- full pipeline orchestrator
- `packages/backend/src/modules/runtime/model-call.service.ts` -- resolveRef() and resolveFieldPath()
- `packages/backend/src/db/schema.ts` -- nodeExecutionStatusEnum definition (5 values)
- `packages/frontend/src/components/workflow/config/ConfigPanel.tsx` -- config panel structure
- `packages/frontend/src/components/workflow/prompt/VariablePicker.tsx` -- variable picker with schema tree
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` -- workspace status handling
- `packages/frontend/src/components/workspace/StepperBar.tsx` -- status colors and labels
- `packages/backend/src/modules/workflows/validation.ts` -- workflow validation rules

### Secondary (MEDIUM confidence)
- 26-CONTEXT.md -- user decisions and implementation constraints

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist in the codebase, no new dependencies
- Architecture: HIGH -- design doc provides complete spec, insertion points are clear in existing code
- Pitfalls: HIGH -- identified from direct code analysis of advanceNode recursion, pgEnum migration, and status handling spread

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no external dependency changes expected)
