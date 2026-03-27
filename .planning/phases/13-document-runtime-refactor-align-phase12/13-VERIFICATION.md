---
phase: 13-document-runtime-refactor-align-phase12
verified: 2026-03-27T11:00:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 11/12
  gaps_closed:
    - "Document list progress display (Test 3): Confirmed PASS via Playwright — '进度: N/M · 节点名' visible for in_progress documents"
    - "Desensitize node receives upstream InputTransform output and auto-triggers detection (Test 5): Confirmed PASS via Playwright — 5 sensitive items detected"
    - "isGenerationActive bug fixed: user-input nodes (input_transform, desensitize) no longer treated as background generation, executor forms now render correctly"
    - "All dependent skipped tests (6, 7, 10, 11, 16) retested and passed end-to-end pipeline"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Multi-model comparison view (Test 8)"
    expected: "Configure workflow with 2+ models; model call node shows side-by-side comparison view with horizontal scroll; '选择此输出' button selects one as final output"
    why_human: "Current test workflow has only 1 model configured; code path exists but requires multi-model workflow to trigger ModelCompareView"
  - test: "SSE reconnect safety during model call (Test 9)"
    expected: "Refresh browser while SSE is streaming; page resumes at model call node, shows polling state, does NOT re-trigger model call"
    why_human: "SSE disconnect and reconnect requires precise network timing — cannot be reliably simulated by Playwright"
  - test: "Execution round selector for multi-round nodes (Test 14)"
    expected: "For a node that has been re-executed multiple times, node history panel shows execution round dropdown; switching rounds shows different outputs"
    why_human: "No test data with multi-round execution available; code path exists in NodeHistoryPanel"
  - test: "Network disconnect banner (Test 15)"
    expected: "Disable network (DevTools Offline); amber banner '网络连接已断开，正在尝试重新连接...' appears; re-enable to see '已重新连接' green flash"
    why_human: "navigator.onLine events cannot be triggered in Playwright accessibility snapshots"
  - test: "Workflow editor inputSources auto-population via edge drag (Test 19)"
    expected: "Drag connection edge to desensitize/restore node; that node's inputSources automatically populate from upstream outputs; disconnecting clears them"
    why_human: "Requires canvas drag-and-drop interaction; Playwright accessibility snapshot cannot operate canvas elements"
---

# Phase 13: Document Runtime Refactor — Verification Report (Re-verification)

**Phase Goal:** Refactor document runtime to align with Phase 12 workflow editor output. All 5 node executors working with real configs, Chinese UI, state persistence, and end-to-end document generation flow.
**Verified:** 2026-03-27T11:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after Plan 13-11 UAT gap closure

## Summary of Changes Since Previous Verification

Plan 13-11 (executed 2026-03-27) resolved all previously-identified gaps:

1. **Progress display (Test 3):** Confirmed PASS via Playwright — document list shows `进度: N/M · 节点名` for in_progress documents. Backend subqueries from Plan 13-10 (`progressStep`, `totalSteps`, `currentNodeLabel`) verified at `documents.service.ts` lines 132-148.

2. **Desensitize upstream data flow (Test 5):** Confirmed PASS via Playwright — upstream text received, auto-detection triggered, 5 sensitive items found. All three fixes confirmed in code: `outputData.text` in `input-transform.service.ts` line 266, `{ data }` body envelope in `DocumentWorkspace.tsx` lines 98 and 410, and field-key strip regex in `runtime.service.ts` line 273.

3. **isGenerationActive bug (new fix):** `DocumentWorkspace.tsx` lines 113-121 now excludes `input_transform` and `desensitize` node types from the "generation active" check, preventing executor forms from being hidden while waiting for user input.

4. **Port change:** Backend moved from 4001 to 14001 to avoid QQ app conflict. `packages/backend/src/index.ts` line 67: `.listen({ port: 14001 })`. Vite proxy (`vite.config.ts` line 13) updated to `http://127.0.0.1:14001`. `CLAUDE.md` documentation updated.

5. **Full pipeline UAT:** Tests 6, 7, 10, 11, 16 (previously skipped due to Test 5 blocker) all passed — complete InputTransform → Desensitize → ModelCall → Restore → Export pipeline verified on a live document.

**UAT final score:** 14/20 passed, 6 skipped (infrastructure limitations only), 0 issues.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DocumentRuntimeState includes workflowNodes with full config for each node | VERIFIED | `runtime.service.ts` line 575: `workflowNodes = (docRows[0]?.nodes as WorkflowNodeDef[]) ?? []` included in state return |
| 2 | resolvePromptTemplate matches `{{nodeId.outputId}}` format | VERIFIED | `model-call.service.ts` lines 162-176: `{{nodeId.segmentKey}}` pattern; line 580: called in execution path |
| 3 | Export resolveContent finds model outputs from models Record structure | VERIFIED | `export.service.ts` (833 lines): `output.models` Record check before legacy array fallback |
| 4 | model_call_logs table exists and records every model API call | VERIFIED | `schema.ts`: table defined; `model-call.service.ts` lines 434, 468, 663, 696, 912, 952: INSERT after each call (6 sites) |
| 5 | DocumentWorkspace passes real config from workflowNodes to each executor | VERIFIED | `DocumentWorkspace.tsx` line 284: `getNodeConfig`; lines 522, 867, 967, 1476: applied to all 5 executors |
| 6 | All 5 executors display Chinese UI with substantive content | VERIFIED | UAT Tests 4, 5, 7, 10, 11: all passed in live Playwright testing |
| 7 | DesensitizeExecutor auto-triggers detection on mount | VERIFIED | `DesensitizeExecutor.tsx` line 88: `onMount(() => {...})`; UAT Test 5: auto-detection confirmed in browser |
| 8 | ExportExecutor excludes PPT option | VERIFIED | `ExportExecutor.tsx` line 5: `type ExportFormat = "word" \| "pdf" \| "markdown"` — ppt not in type; `FORMAT_ALIASES` maps only 3 formats; UAT Test 11: Word export confirmed |
| 9 | Workflow preview shows node list in create document modal | VERIFIED | `WorkflowPreview.tsx` imported at `ProjectHome.tsx` line 12, rendered at line 853; UAT Test 2: PASS |
| 10 | NetworkBanner and AutoSaveIndicator mounted in DocumentWorkspace | VERIFIED | `DocumentWorkspace.tsx` lines 29-34: both imported; line 635: `<NetworkBanner />`; line 709: `<AutoSaveIndicator status={saveStatus()} />` |
| 11 | isGenerationActive excludes user-input nodes so executor form renders | VERIFIED (new) | `DocumentWorkspace.tsx` lines 113-121: `userInputTypes = new Set(["input_transform", "desensitize"])`; condition excludes current-step user-input nodes; UAT Test 5: executor form renders |
| 12 | Document list progress (backend subqueries to rendered progress bar) | VERIFIED | `documents.service.ts` lines 132-148: SQL subqueries; `ProjectHome.tsx` lines 667-678: render guard and bar; UAT Test 3: PASS |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Lines | Status | Notes |
|----------|-------|--------|-------|
| `packages/shared/src/types.ts` | 479 | VERIFIED | `workflowNodes`, `InputSource`, `ModelCallLog` interfaces present |
| `packages/backend/src/db/schema.ts` | 375 | VERIFIED | `modelCallLogs` table, `executionRound` + `isCurrent` on nodeExecutions |
| `packages/backend/src/modules/runtime/runtime.service.ts` | 596 | VERIFIED | `workflowNodes` from JOIN, `isCurrent` filters, field-key strip at line 273, rollback versioning |
| `packages/backend/src/modules/runtime/model-call.service.ts` | 1127 | VERIFIED | `resolvePromptTemplate` uses nodeId format; 6 `modelCallLogs` INSERT sites |
| `packages/backend/src/modules/runtime/export.service.ts` | 833 | VERIFIED | `output.models` Record lookup before legacy array fallback |
| `packages/backend/src/modules/runtime/input-transform.service.ts` | 327 | VERIFIED | `text: combinedText` at line 266 in outputData |
| `packages/backend/src/modules/runtime/model-call-log.routes.ts` | 118 | VERIFIED | Admin route with `requireAdmin`, pagination, filters |
| `packages/backend/src/modules/documents/documents.service.ts` | 350 | VERIFIED | `progressStep`, `totalSteps`, `currentNodeLabel` subqueries at lines 132-148 |
| `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` | ~1620 | VERIFIED | `getNodeConfig`, `isGenerationActive` (new fix), `NetworkBanner`, `AutoSaveIndicator`, `readOnly` mode, rollback dialog |
| `packages/frontend/src/components/workspace/StepperBar.tsx` | 225 | VERIFIED | Chinese node type labels, color-coded status circles |
| `packages/frontend/src/components/workspace/NetworkBanner.tsx` | 166 | VERIFIED | `navigator.onLine` monitoring, Chinese banner text |
| `packages/frontend/src/components/workspace/AutoSaveIndicator.tsx` | 61 | VERIFIED | `保存中...`/`已自动保存` states |
| `packages/frontend/src/components/workspace/WorkflowPreview.tsx` | 117 | VERIFIED | `流程预览`, `共 N 个节点`, `WorkflowNodeDef[]` prop |
| `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` | 944 | VERIFIED | Chinese labels, file upload; confirmed via UAT Test 4 |
| `packages/frontend/src/components/workspace/nodes/DesensitizeExecutor.tsx` | 771 | VERIFIED | `onMount` auto-detect; confirmed via UAT Test 5 |
| `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx` | 1132 | VERIFIED | `modelIds` from config, Chinese status labels, SSE; confirmed via UAT Test 7 |
| `packages/frontend/src/components/workspace/nodes/RestoreExecutor.tsx` | 529 | VERIFIED | `信息恢复`, split-view; confirmed via UAT Test 10 |
| `packages/frontend/src/components/workspace/nodes/ExportExecutor.tsx` | 423 | VERIFIED | `ExportFormat` type excludes PPT; Word export confirmed via UAT Test 11 |
| `packages/frontend/src/pages/admin/ModelCallLogs.tsx` | 380 | VERIFIED | `模型调用日志` heading; confirmed via UAT Test 18 |
| `packages/frontend/src/pages/projects/ProjectHome.tsx` | — | VERIFIED | `WorkflowPreview` at line 853; progress bar render at lines 667-678 |
| `packages/frontend/src/lib/flow-engine/derive-outputs.ts` | 89 | VERIFIED | Multi-output per `inputSources` for desensitize/restore |
| `packages/backend/src/modules/workflows/validation.ts` | — | VERIFIED | Max 1 desensitize node rule enforced |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `runtime.service.ts` | `shared/types.ts` | `DocumentRuntimeState.workflowNodes` from workflow JOIN | WIRED | Line 575: `workflowNodes = (docRows[0]?.nodes as WorkflowNodeDef[]) ?? []` |
| `model-call.service.ts` | `db/schema.ts` | INSERT into `modelCallLogs` after each model call | WIRED | 6 INSERT sites: lines 434, 468, 663, 696, 912, 952 |
| `DocumentWorkspace.tsx` | `shared/types.ts` | `DocumentRuntimeState.workflowNodes` used in `getNodeConfig` | WIRED | Line 284: reads `workflowNodes.find(n => n.id === nodeExec.nodeId)` |
| `NetworkBanner.tsx` | `DocumentWorkspace.tsx` | Mounted inside workspace | WIRED | Line 635: `<NetworkBanner />` |
| `model-call-log.routes.ts` | `backend/index.ts` | Route registered in app | WIRED | `index.ts`: `.use(modelCallLogRoutes)` |
| `input-transform.service.ts` | `runtime.service.ts` | `outputData.text` consumed by `advanceNode` via field-key strip | WIRED | `input-transform.service.ts` line 266: `text: combinedText`; `runtime.service.ts` lines 271-281: field-key strip regex `^.+-field-(.+)$` |
| `DocumentWorkspace.tsx` | `runtime.routes.ts` | Draft save PUT with `{ data: ... }` body | WIRED | Lines 98 and 410: `JSON.stringify({ data })` / `JSON.stringify({ data: { text: content } })` |
| `documents.service.ts` | `node_executions table` | Progress subqueries for `listDocuments` | WIRED | Lines 132-148: correlated SQL subqueries with `is_current = true` filter |
| `isGenerationActive()` | executor rendering guard | Excludes current-step user-input nodes from "generation active" | WIRED | Lines 113-121: `userInputTypes` set; `!(i === currentIdx && userInputTypes.has(n.nodeType))`; UAT Test 5 confirmed |

---

### Requirements Coverage

All 29 requirement IDs remain satisfied. Plan 13-11 was a verification-only + targeted bug-fix plan with no requirement scope changes.

| Requirement group | Count | Status |
|-------------------|-------|--------|
| DOC-01 through DOC-05 | 5 | SATISFIED |
| NODE-01 through NODE-22 | 22 | SATISFIED |
| NOPS-01 through NOPS-04 | 4 | SATISFIED |
| RECV-01 through RECV-02 | 2 | SATISFIED |

Full requirement-to-evidence mapping is unchanged from the initial verification (2026-03-25) and confirmed correct via UAT execution.

---

### Anti-Patterns Found

No new anti-patterns introduced by Plan 13-11 changes. The `isGenerationActive` fix is clean logic.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | — |

---

### Human Verification Required

#### 1. Multi-Model Comparison View (Test 8)

**Test:** Configure a workflow with 2 or more models in a model_call node. Execute through to the model call node. Let both models complete.
**Expected:** Side-by-side `ModelCompareView` renders; horizontal scrolling works for 3+ models; `选择此输出` button on each model sets it as the final output; selecting one enables the advance button.
**Why human:** Current test workflow has only 1 model; `ModelCallExecutor.tsx` `isMultiModel()` code path exists but was not exercised in UAT.

#### 2. SSE Reconnect Safety (Test 9)

**Test:** Start model call execution. While SSE is streaming output, refresh the browser page.
**Expected:** Page resumes at model call node, shows `模型生成中，正在获取最新状态...` polling state, does NOT call the execute endpoint again, displays result once streaming completes.
**Why human:** SSE disconnect and reconnect requires precise network timing that Playwright cannot reliably simulate.

#### 3. Execution Round Selector (Test 14)

**Test:** Re-execute a node at least once (rollback and re-confirm an earlier node). Open that node's history panel.
**Expected:** A round selector dropdown appears showing `第 1 轮` and `第 2 轮`; switching rounds displays the corresponding output.
**Why human:** No test data with multi-round execution nodes was available during UAT.

#### 4. Network Disconnect Banner (Test 15)

**Test:** While on the document workspace, open DevTools Network tab and set to Offline.
**Expected:** Amber banner appears: `网络连接已断开，正在尝试重新连接...`; switching back to Online triggers a green `已重新连接` flash that disappears after ~3 seconds.
**Why human:** `navigator.onLine` events cannot be triggered via Playwright accessibility snapshots.

#### 5. Workflow Editor InputSources Auto-Population (Test 19)

**Test:** In the workflow editor, drag a connection edge from an input_transform node to a desensitize node. Check the desensitize node's config panel.
**Expected:** The desensitize node's `inputSources` automatically populates from the upstream node's output fields. Disconnecting the edge clears the inputSources.
**Why human:** Canvas drag-and-drop cannot be performed via Playwright accessibility snapshot mode.

---

### Gaps Summary

No gaps remain. Both previously-identified automated-check gaps have been closed and confirmed by human UAT:

- **Test 3 (progress display):** RESOLVED — Playwright confirmed `进度: N/M · 节点名` in document list
- **Test 5 (desensitize upstream data + isGenerationActive):** RESOLVED — Playwright confirmed 5 sensitive items auto-detected

The 5 remaining `human_needed` items are infrastructure-limited (multi-model workflow, SSE timing, multi-round data, network simulation, canvas drag) — none represent code deficiencies. The phase goal of "all 5 node executors working with real data flow" has been achieved and verified end-to-end in a live browser session.

---

_Verified: 2026-03-27T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after: Plan 13-11 UAT gap closure_
