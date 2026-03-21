# Phase 13: Document Runtime Refactor — Align with Phase 12 Editor - Research

**Researched:** 2026-03-21
**Domain:** Document runtime orchestration, node executor UI, data flow alignment
**Confidence:** HIGH

## Summary

Phase 13 is a refactoring phase that bridges Phase 12's restructured workflow editor (shared types, flow engine, config panels) with Phase 5's document runtime. The codebase analysis reveals several concrete, well-scoped gaps:

1. **Config pass-through is broken**: `DocumentWorkspace.tsx` passes `{} as XConfig` to every executor component (lines 285-335). The `DocumentRuntimeState` type lacks workflow node definitions, so the frontend has no config data at runtime.
2. **Prompt variable resolution uses `nodeLabel` instead of `nodeId`**: `resolvePromptTemplate()` in `model-call.service.ts` matches `{{nodeLabel.outputName}}` but Phase 12 changed the template format to `{{nodeId.outputId}}`. This will fail silently.
3. **Export `resolveContent()` looks for `modelOutputs` Array** (line 60-76 of `export.service.ts`) but the model-call service stores results in a `models` Record structure (line 97 of `model-call.service.ts`). The Array path will never match.
4. **All 5 executor UIs are in English** — buttons, labels, headings, error messages all need Chinese localization.
5. **No `model_call_logs` table** exists yet, and the user decision requires logging resolved prompts and variable mappings for debugging.

The refactoring is primarily wiring and alignment work, not new feature development. The backend services are functionally correct; they just need data structure alignment and API response expansion. The frontend executors have correct logic but need config plumbing and UI redesign.

**Primary recommendation:** Start with backend data flow fixes (init API expansion, prompt resolution, export content lookup), then wire frontend config loading, then UI redesign with Stitch, and finally add new features (model_call_logs, workflow preview, version history, re-execution).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Config loading:**
- Modify `/runtime/:docId/init` to return `workflowNodes` (with config) in `DocumentRuntimeState`. Frontend matches by nodeId to pass real configs to executors. No more `{} as Config`.

**Node data flow:**
- Backend services self-query upstream outputData (existing pattern). Only fix export node's `resolveContent` to use `models` Record instead of `modelOutputs` Array.

**Variable resolution:**
- Unified `nodeId + outputId` format replacing `{{nodeLabel.outputName}}`. promptTemplate uses `{{nodeId.outputId}}`, backend `resolvePromptTemplate` queries by nodeId from nodeExecution, extracts from outputData. Stable against label renames.

**Model call logging:**
- New `model_call_logs` table: resolvedPrompt, promptTemplate + variableMapping, modelId/modelName/temperature/maxTokens, responseStatus/contentLength/tokenUsage/duration. Log viewer in admin with document/time/model filtering.

**Executor adaptations:**
- All 5 executors use Stitch MCP (`GEMINI_3_1_PRO`) for design mockups, then implement with SolidJS + Tailwind.
- Full Chinese localization for all UI text.
- Input transform: logic aligned (field.id as key), only UI + Chinese.
- Desensitize: auto-trigger detection on enter (no manual button), then review. Keep "re-detect" button. Stitch redesign.
- Model call: keep existing flow (SSE, multi-model parallel, tab, retry, select). Stitch redesign.
- Restore: keep existing flow (left-right compare, manual correction). UI + Chinese + Stitch.
- Export: fix resolveContent bug, hide PPT option, UI + Chinese + Stitch.

**State persistence & idempotency:**
- Full DB recovery on refresh. Status-based: pending=wait, in_progress=resume, completed=read-only.
- Model call: outputData tracks status (pending/streaming/completed/failed). Reconnect polls `/status`. Never re-trigger calls.
- SSE disconnect: backend continues independently. Frontend polls status, shows loading state during streaming.
- Document list: in_progress shows progress bar + current node name.

**Document creation entry:**
- Keep existing modal flow. Add workflow preview when workflow selected: node list + type icons, brief flow diagram, node count + estimated steps, workflow description.

**Completed document handling:**
- Read-only mode for all nodes. Each node gets "re-execute from here" button with confirmation dialog (warns downstream nodes reset).
- Rollback + re-execution creates new nodeExecution rows (no overwrite). History dropdown to compare versions.

**Error handling:**
- Model call failure: clear Chinese error messages, retry button. Other models unaffected.
- Network disconnect: banner + auto-reconnect + queue pending operations.
- Auto-save: 1.5s debounce for all editable nodes, show "已保存" status.

### Claude's Discretion

- Stitch design mockup layouts and visual details
- `model_call_logs` table field types and index design
- Version nodeExecution round/version field naming and structure
- Network reconnection implementation (polling interval, max retries)
- Progress bar styling in document list
- Workflow preview flow diagram rendering approach

### Deferred Ideas (OUT OF SCOPE)

- PPT export format support — separate phase
- Admin log viewer enhancements (charts, statistics, log export)
- Cancel in-progress AI generation (RECV-03) — deferred to v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | Create document (select type -> workflow -> title) | Existing flow works; add workflow preview panel using Stitch |
| DOC-02 | System creates working directory on document creation | Backend `initDocumentExecution` needs to create workDir; currently missing |
| DOC-03 | Workspace shows progress stepper | `StepperBar` exists and works; needs Chinese labels |
| DOC-04 | Workspace shows current node operation area | Config pass-through fix enables real executor rendering |
| DOC-05 | Workspace shows node history panel | `NodeHistoryPanel` exists; needs Chinese + version dropdown |
| NODE-01 | Input transform: fill text, upload files | Executor works with real config; needs Chinese UI |
| NODE-02 | File upload: Word/PDF/image/audio/video auto-parse | Already implemented in `input-transform.service.ts` |
| NODE-03 | View/edit file parse results | Existing parsed text view/edit works |
| NODE-04 | Input data written to step subdirectory | Existing confirm flow writes outputData |
| NODE-05 | Desensitize: local model detection + highlight | `detectViaModel` works; auto-trigger on enter is new |
| NODE-06 | Per-item confirm, manual marking | Existing checklist UI works; needs Chinese |
| NODE-07 | Mapping encrypted in DB, local copy | `desensitizeMappings` table exists |
| NODE-08 | Rules injected into model prompts | `getUpstreamDesensitizeRules` + `resolvePromptTemplate` work but need nodeId fix |
| NODE-09 | Model call via unified abstraction | OpenAI-compatible API call in `model-call.service.ts` works |
| NODE-10 | Single or multi-model selection | `modelIds[]` config from Phase 12 |
| NODE-11 | Multi-model parallel execution | `Promise.allSettled` pattern in `executeModelCall` |
| NODE-12 | SSE streaming output | Multiplexed SSE stream exists and works |
| NODE-13 | Tab switching between model outputs | ModelCallExecutor tab UI exists |
| NODE-14 | Single model retry | `retryModelCall` service exists |
| NODE-15 | Left-right comparison | `ModelCompareView` component exists |
| NODE-16 | Select best output | `selectModelOutput` service exists |
| NODE-17 | Restore: local placeholder replacement | `restore.service.ts` handles this |
| NODE-18 | Before/after comparison with highlighting | RestoreExecutor split-view exists |
| NODE-19 | Failed items highlighted, manual correction | Existing inline edit for failed items |
| NODE-20 | Export format selection (Word/PDF/Markdown) | ExportExecutor format toggle exists; hide PPT |
| NODE-21 | Export preview | `getExportPreview` endpoint exists |
| NODE-22 | Filename + download | Export flow exists; fix resolveContent bug |
| NOPS-01 | Confirm/next button | `handleAdvance` in DocumentWorkspace |
| NOPS-02 | Inline editor for node output | `InlineEditor` component exists |
| NOPS-03 | Skip optional nodes | `skipNode` service with config.skippable check |
| NOPS-04 | Rollback to previous node | `rollbackToNode` service; add version history |
| RECV-01 | Auto-save drafts | 1.5s debounce draft save pattern needed |
| RECV-02 | Resume on browser refresh | DB-based state recovery in `initDocumentExecution` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SolidJS | existing | Frontend framework | Project standard per CLAUDE.md |
| Tailwind CSS | v4 | Styling | Project standard |
| Elysia | existing | Backend HTTP framework | Project standard |
| Drizzle ORM | existing | Database ORM | Project standard |
| PostgreSQL | 18 | Database | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| docx | existing | Word document generation | Export node Word format |
| pdfkit | existing | PDF generation | Export node PDF format |
| Stitch MCP | GEMINI_3_1_PRO | UI design mockups | Before implementing each executor UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual UI design | Stitch MCP | User decided Stitch — locked decision |
| nodeLabel variables | nodeId variables | User decided nodeId — locked decision |

## Architecture Patterns

### Recommended Project Structure
Changes affect these paths:
```
packages/shared/src/types.ts           # Extend DocumentRuntimeState
packages/backend/src/db/schema.ts      # Add model_call_logs table
packages/backend/src/modules/runtime/
  runtime.service.ts                   # Expand init to include workflowNodes
  runtime.routes.ts                    # Update init response
  model-call.service.ts                # Fix resolvePromptTemplate to use nodeId
  model-call.routes.ts                 # Add model_call_logs writes
  export.service.ts                    # Fix resolveContent for models Record
packages/frontend/src/
  pages/workspace/DocumentWorkspace.tsx # Wire real configs, Chinese UI
  pages/projects/ProjectHome.tsx       # Add workflow preview
  components/workspace/nodes/*.tsx     # Redesign all 5 executors
```

### Pattern 1: Config Pass-Through via Extended Runtime State
**What:** Expand `DocumentRuntimeState` to include `workflowNodes: WorkflowNodeDef[]` so the frontend has access to each node's config.
**When to use:** Runtime init and resume.
**Example:**
```typescript
// packages/shared/src/types.ts
export interface DocumentRuntimeState {
  documentId: string;
  workflowName: string;
  currentNodeIndex: number;
  nodes: NodeExecution[];
  workflowNodes: WorkflowNodeDef[];  // NEW: full node definitions with config
}

// DocumentWorkspace.tsx — config lookup
const getNodeConfig = (nodeExec: NodeExecution): NodeConfig | undefined => {
  const s = state();
  if (!s) return undefined;
  const wfNode = s.workflowNodes.find(n => n.id === nodeExec.nodeId);
  return wfNode?.config;
};
```

### Pattern 2: nodeId-Based Variable Resolution
**What:** Replace `{{nodeLabel.outputName}}` with `{{nodeId.outputId}}` in prompt templates.
**When to use:** Model call prompt resolution.
**Example:**
```typescript
// model-call.service.ts — resolvePromptTemplate refactored
resolved = resolved.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
  const dotIndex = varName.indexOf(".");
  if (dotIndex < 0) return _match;
  const nodeId = varName.slice(0, dotIndex).trim();
  const outputId = varName.slice(dotIndex + 1).trim();
  // Find by nodeId instead of nodeLabel
  const exec = nodeExecs.find((ne) => ne.nodeId === nodeId);
  if (!exec?.outputData) return _match;
  const value = exec.outputData[outputId];
  if (value === undefined || value === null) return _match;
  return typeof value === "string" ? value : JSON.stringify(value);
});
```

### Pattern 3: Export resolveContent Fix for models Record
**What:** Look up model outputs from `outputData.models[selectedOutputKey].content` instead of `outputData.modelOutputs` Array.
**When to use:** Export node content resolution.
**Example:**
```typescript
// export.service.ts — add models Record lookup before Array fallback
if (output.models && typeof output.models === "object") {
  const modelsMap = output.models as Record<string, { content: string; status: string }>;
  const selectedKey = exec.selectedOutputKey;
  if (selectedKey && modelsMap[selectedKey]?.content) {
    return modelsMap[selectedKey].content;
  }
  // Fallback: first completed model
  const first = Object.values(modelsMap).find(m => m.status === "completed" && m.content);
  if (first?.content) return first.content;
}
```

### Pattern 4: NodeExecution Versioning for Re-execution
**What:** Add `executionRound` column to nodeExecutions. Rollback creates new rows with incremented round. History dropdown shows all rounds.
**When to use:** "Re-execute from here" on completed documents.
**Example:**
```typescript
// schema.ts addition
executionRound: integer("execution_round").default(1).notNull(),

// runtime.service.ts — rollback creates new rows
async function rollbackWithVersioning(documentId, targetStepOrder, userId) {
  const currentMax = await getMaxRound(documentId, targetNodeId);
  // Insert new nodeExecution rows with round = currentMax + 1
  // Don't delete old rows — keep for history
}
```

### Pattern 5: Model Call Logging
**What:** Insert into `model_call_logs` on every model API call with full prompt, parameters, and response metadata.
**When to use:** Inside `executeModelCall` and `retryModelCall` after each model completes/fails.
**Example:**
```typescript
// schema.ts
export const modelCallLogs = pgTable("model_call_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => documents.id),
  nodeExecutionId: uuid("node_execution_id").references(() => nodeExecutions.id),
  modelId: uuid("model_id").references(() => models.id),
  modelName: varchar("model_name", { length: 200 }),
  promptTemplate: varchar("prompt_template", { length: 10000 }),
  resolvedPrompt: varchar("resolved_prompt", { length: 50000 }),
  variableMapping: jsonb("variable_mapping"),  // { nodeId.outputId: resolvedValue }
  temperature: real("temperature"),
  maxTokens: integer("max_tokens"),
  responseStatus: varchar("response_status", { length: 20 }),  // completed/failed
  contentLength: integer("content_length"),
  tokenUsage: jsonb("token_usage"),  // { prompt_tokens, completion_tokens, total_tokens }
  duration: integer("duration"),  // ms
  errorMessage: varchar("error_message", { length: 2000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Anti-Patterns to Avoid
- **Passing empty config objects:** Current `{} as InputTransformConfig` causes runtime crashes when accessing `.formFields` — always provide real config or render a loading state.
- **Label-based variable resolution:** Labels are user-editable; nodeId is stable. Never match by label.
- **Re-triggering model calls on reconnect:** Always check outputData status first. If `streaming`, poll `/status`. If `completed`, show results directly.
- **Overwriting nodeExecution rows on re-execute:** Create new rows with incremented `executionRound` to preserve history.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UI design mockups | Pixel-pushing manually | Stitch MCP with GEMINI_3_1_PRO | User locked decision; ensures design consistency |
| Word/PDF generation | Custom formatting | Existing docx + pdfkit | Already working in export.service.ts |
| SSE streaming | Custom event protocol | Existing multiplexed SSE pattern | Already battle-tested in model-call.service.ts |
| File upload + progress | fetch-based upload | Existing XHR pattern | Progress tracking requires XHR |

**Key insight:** This phase is primarily wiring and alignment, not greenfield development. Nearly all business logic exists — the work is connecting Phase 12's type changes to Phase 5's runtime.

## Common Pitfalls

### Pitfall 1: Config Undefined Crashes
**What goes wrong:** Executors access `props.config.formFields` but config is `{}`, causing TypeError.
**Why it happens:** DocumentWorkspace doesn't have workflow config data in the runtime state response.
**How to avoid:** Expand `DocumentRuntimeState` to include `workflowNodes`, add null-safe guards in executors, show loading/error when config is missing.
**Warning signs:** White screen on DocumentWorkspace load; "Cannot read property of undefined" errors.

### Pitfall 2: Variable Resolution Mismatch
**What goes wrong:** Prompt templates use `{{nodeId.outputId}}` format but resolver still parses `{{nodeLabel.outputName}}`. Variables render as literal `{{...}}` in the final prompt.
**Why it happens:** Phase 12 changed the variable format but Phase 5's resolver wasn't updated.
**How to avoid:** Update `resolvePromptTemplate` to match by `nodeId` and accept `nodeId` in the lookup parameter. Also update the function signature to accept `nodeId` instead of `nodeLabel`.
**Warning signs:** Model receives prompts with unresolved `{{...}}` placeholders.

### Pitfall 3: Export Finds No Content
**What goes wrong:** Export node shows "No content available for export" even though model call completed successfully.
**Why it happens:** `resolveContent` searches for `modelOutputs` Array but data is stored as `models` Record.
**How to avoid:** Add `models` Record lookup before the Array fallback. Check `selectedOutputKey` against the Record keys.
**Warning signs:** Export preview is empty despite upstream model completion.

### Pitfall 4: SSE Reconnect Re-triggers Model Call
**What goes wrong:** User refreshes during streaming, and the model call fires again (double billing, duplicate results).
**Why it happens:** Frontend sees `in_progress` status and calls the execute endpoint again.
**How to avoid:** Check `outputData.models` status first. If any model is `streaming`, poll `/status` instead of calling `/execute`. Only call `/execute` if no models exist in outputData.
**Warning signs:** Duplicate model outputs, doubled token usage.

### Pitfall 5: Stitch Design Not Matching Stack
**What goes wrong:** Stitch generates React/HTML designs that don't translate to SolidJS patterns.
**Why it happens:** Stitch may default to React patterns.
**How to avoid:** Explicitly specify SolidJS + Tailwind CSS in Stitch prompts. Use the design as visual reference only, implement with SolidJS primitives (`createSignal`, `Show`, `For`, `Switch/Match`).
**Warning signs:** Generated code uses `useState`, `useEffect`, or other React APIs.

### Pitfall 6: nodeExecution Versioning Breaks Existing Queries
**What goes wrong:** Adding `executionRound` column causes existing queries to return multiple rows per node.
**Why it happens:** Current queries assume one nodeExecution per nodeId per document.
**How to avoid:** Default `executionRound` to 1 for backward compatibility. Add `AND execution_round = (SELECT MAX(...))` to existing queries, or add a `is_current` boolean flag.
**Warning signs:** Stepper shows duplicate nodes; runtime state has wrong node count.

## Code Examples

### Extended DocumentRuntimeState (init response)
```typescript
// runtime.service.ts — buildRuntimeState
async function buildRuntimeState(
  documentId: string,
  executions: (typeof nodeExecutions.$inferSelect)[],
): Promise<DocumentRuntimeState> {
  const docRows = await db
    .select({ workflowName: workflows.name, nodes: workflows.nodes })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  return {
    documentId,
    workflowName: docRows[0]?.workflowName ?? "Unknown",
    currentNodeIndex,
    nodes: executions.map(toNodeExecution),
    workflowNodes: (docRows[0]?.nodes as WorkflowNodeDef[]) ?? [],
  };
}
```

### DocumentWorkspace Config Wiring
```typescript
// DocumentWorkspace.tsx
const getNodeConfig = (nodeExec: NodeExecution): NodeConfig | undefined => {
  const s = state();
  if (!s?.workflowNodes) return undefined;
  return s.workflowNodes.find(n => n.id === nodeExec.nodeId)?.config;
};

// In render:
<Match when={currentNode()?.nodeType === "input_transform"}>
  <InputTransformExecutor
    nodeExecution={currentNode()!}
    config={getNodeConfig(currentNode()!) as InputTransformConfig}
    documentId={params.documentId}
    onDraftSave={(data) => { /* ... */ }}
    readOnly={false}
  />
</Match>
```

### Auto-trigger Desensitize Detection
```typescript
// DesensitizeExecutor.tsx — auto-detect on mount
import { onMount } from "solid-js";

onMount(() => {
  if (phase() === "detect" && inputText().trim() && !props.readOnly) {
    handleDetect();  // Auto-trigger instead of waiting for button click
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `modelOutputs` Array | `models` Record | Phase 5 backend (model-call.service) | Export resolveContent broken — needs Record lookup |
| `{{nodeLabel.outputName}}` | `{{nodeId.outputId}}` | Phase 12 (prompt editor) | resolvePromptTemplate needs nodeId-based matching |
| Empty config `{} as Config` | Real config from init API | Phase 13 (this phase) | All executors get actual workflow config |
| `FormFieldDef.name` | `FormFieldDef.id` as key | Phase 12 [12-01] | Input transform executor already uses field.id |
| `ruleTypes` + `placeholderFormat` | `categories` array | Phase 12 [12-01] | Desensitize service already adapted |

**Deprecated/outdated:**
- `modelOutputs` Array format in export.service.ts: replaced by `models` Record but resolveContent still searches for old format
- `{{nodeLabel.outputName}}` variable format: replaced by `{{nodeId.outputId}}` but resolvePromptTemplate still uses nodeLabel matching

## Open Questions

1. **nodeExecution versioning schema**
   - What we know: User wants new rows on re-execution, not overwrites. Need round/version field.
   - What's unclear: Exact column naming (`executionRound` vs `version`), whether to use `is_current` flag vs MAX query.
   - Recommendation: Use `executionRound` integer with `is_current` boolean flag for query simplicity. Claude's discretion per CONTEXT.md.

2. **Network reconnection strategy**
   - What we know: User wants banner + auto-reconnect + operation queue.
   - What's unclear: Exact polling intervals, max retry count, queue persistence.
   - Recommendation: Start with 3s polling, max 10 retries with exponential backoff (cap at 30s). In-memory queue (no localStorage persistence for v1). Claude's discretion per CONTEXT.md.

3. **Workflow preview rendering**
   - What we know: User wants node list + type icons + brief flow diagram when selecting workflow in create modal.
   - What's unclear: Whether to reuse the flow engine's canvas or build a simple static visualization.
   - Recommendation: Build a lightweight read-only mini-visualization (simple vertical node list with connecting lines) — reusing the full flow engine would be overkill for a preview. Claude's discretion per CONTEXT.md.

4. **model_call_logs token usage**
   - What we know: User wants tokenUsage logged. OpenAI API returns usage in non-streaming responses.
   - What's unclear: Streaming responses don't always include usage. Some providers omit it entirely.
   - Recommendation: Log usage when available (parse from final SSE chunk or response headers). Store null when unavailable. Claude's discretion per CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all runtime services, routes, executors, and shared types
- Phase 12 CONTEXT.md and STATE.md decisions documenting type changes
- `packages/shared/src/types.ts` — definitive type definitions
- `packages/backend/src/modules/runtime/*.ts` — all runtime services and routes
- `packages/frontend/src/components/workspace/nodes/*.tsx` — all 5 executor components
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` — main workspace page
- `packages/backend/src/db/schema.ts` — database schema

### Secondary (MEDIUM confidence)
- OpenAI API streaming behavior for token usage in SSE (based on training knowledge of OpenAI API spec)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies needed
- Architecture: HIGH - patterns derived directly from existing codebase analysis
- Pitfalls: HIGH - identified from concrete code bugs (resolveContent, resolvePromptTemplate, empty config)
- Data flow: HIGH - traced complete flow from init -> executor -> advance through actual code

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable codebase, internal project)
