---
phase: 13-document-runtime-refactor-align-phase12
verified: 2026-03-25T04:30:00Z
status: human_needed
score: 11/12 must-haves verified
human_verification:
  - test: "Execute full workflow end-to-end: create document, input transform, desensitize (auto-detect), model call (SSE streaming), restore, export (Word/PDF/Markdown, no PPT)"
    expected: "All 5 nodes complete in sequence with Chinese UI throughout; desensitize auto-triggers on mount; export produces downloadable file"
    why_human: "SSE streaming, auto-detect on mount, and file download require real browser interaction; Playwright was blocked at desensitize node in UAT (root cause fixed in Plan 10, not yet re-tested)"
  - test: "Refresh browser mid-workflow during model call SSE streaming"
    expected: "Page resumes at correct node, polls /status endpoint, displays 模型生成中... state, does NOT re-trigger model call"
    why_human: "SSE reconnect safety and state polling cannot be verified by static analysis alone"
  - test: "Document list progress for in_progress document"
    expected: "Progress bar and '进度: N/M · 节点名' text visible under in_progress document title"
    why_human: "UAT reported this missing (Test 3 failed); Plan 10 added backend subqueries. Re-test needed to confirm data flows to frontend render guard"
  - test: "Open completed document — verify read-only mode and re-execute from node"
    expected: "All executors render in read-only state; clicking 从此节点重新执行 shows confirmation dialog; confirming rolls back and enters execution mode"
    why_human: "Read-only mode is driven by document status; requires a fully-completed document in the test environment"
  - test: "Network disconnect banner"
    expected: "Disconnecting network shows '网络连接已断开，正在尝试重新连接...' amber banner; reconnect shows '已重新连接' green flash"
    why_human: "navigator.onLine events cannot be triggered programmatically in Playwright accessibility snapshots"
---

# Phase 13: Document Runtime Refactor — Verification Report

**Phase Goal:** Refactor document runtime to align with Phase 12 workflow editor output. All 5 node executors working with real configs, Chinese UI, state persistence, and end-to-end document generation flow.
**Verified:** 2026-03-25T04:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DocumentRuntimeState includes workflowNodes with full config for each node | VERIFIED | `packages/shared/src/types.ts` line 422: `workflowNodes: WorkflowNodeDef[]`; `runtime.service.ts` line 501 populates from JOIN, line 520 includes in return |
| 2 | resolvePromptTemplate matches `{{nodeId.outputId}}` format | VERIFIED | `model-call.service.ts` line 17-20: function signature + comment confirm nodeId-based resolution |
| 3 | Export resolveContent finds model outputs from models Record structure | VERIFIED | `export.service.ts` lines 59-64: explicit `output.models` Record check before legacy fallback |
| 4 | model_call_logs table exists and records every model API call | VERIFIED | `schema.ts` line 249: table defined; `model-call.service.ts` lines 187, 220, 382, 421: INSERT after each call |
| 5 | DocumentWorkspace passes real config from workflowNodes to each executor | VERIFIED | `DocumentWorkspace.tsx` lines 109-113: `getNodeConfig` helper; lines 277, 553, 928: used for all executors |
| 6 | All 5 executors display Chinese UI with substantive content | VERIFIED | InputTransformExecutor: `field.id` key, Chinese labels; DesensitizeExecutor: `onMount` auto-detect, `信息脱敏` heading; ModelCallExecutor: `生成中`, `重试`, `选择此输出`; RestoreExecutor: `信息恢复`, `手动修正`; ExportExecutor: `文件导出`, PPT filtered |
| 7 | DesensitizeExecutor auto-triggers detection on mount | VERIFIED | `DesensitizeExecutor.tsx` line 2: `onMount` imported; line 88: `onMount(() => {...})` with phase + input check |
| 8 | ExportExecutor hides PPT option | VERIFIED | `ExportExecutor.tsx` line 53: `.filter((f) => f !== "ppt")`; line 58: `legacy !== "ppt"` guard |
| 9 | Workflow preview shows node list with type icons in create document modal | VERIFIED | `WorkflowPreview.tsx` exists with `流程预览`, `共 N 个节点`; `ProjectHome.tsx` line 10 imports it, line 734 renders it |
| 10 | NetworkBanner and AutoSaveIndicator mounted in DocumentWorkspace | VERIFIED | `DocumentWorkspace.tsx` lines 15-20: both imported; line 390: `<NetworkBanner />`; line 464: `<AutoSaveIndicator status={saveStatus()} />` |
| 11 | InputTransform outputData.text fixed; draft save body shape fixed | VERIFIED | `input-transform.service.ts` line 172: `text: combinedText` in outputData; `DocumentWorkspace.tsx` lines 73, 170: `JSON.stringify({ data })` / `JSON.stringify({ data: { text: content } })` |
| 12 | Document list progress (end-to-end from backend to rendered bar) | PARTIAL | Backend: `documents.service.ts` lines 33-35, 132-143: type + subqueries present. Frontend: `ProjectHome.tsx` line 562: `<Show when={doc.totalSteps && ...}>` guard present. UAT test 3 reported "no progress bar" — fixed in Plan 10 but not yet re-tested. |

**Score:** 11/12 truths fully verified (1 partial — needs human re-test)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/shared/src/types.ts` | VERIFIED | `workflowNodes`, `InputSource`, `ModelCallLog` interfaces present |
| `packages/backend/src/db/schema.ts` | VERIFIED | `modelCallLogs` table, `executionRound` + `isCurrent` on nodeExecutions |
| `packages/backend/src/modules/runtime/runtime.service.ts` | VERIFIED | `workflowNodes` populated from JOIN, `isCurrent` filters on all queries, rollback versioning |
| `packages/backend/src/modules/runtime/model-call.service.ts` | VERIFIED | `resolvePromptTemplate` uses nodeId, `modelCallLogs` INSERT after each call |
| `packages/backend/src/modules/runtime/export.service.ts` | VERIFIED | `output.models` Record lookup before legacy array fallback |
| `packages/backend/src/modules/runtime/input-transform.service.ts` | VERIFIED | `text: combinedText` in outputData (Plan 10 fix confirmed) |
| `packages/backend/src/modules/runtime/model-call-log.routes.ts` | VERIFIED | Admin route `/admin/model-call-logs` with `requireAdmin`, pagination, filters |
| `packages/backend/src/modules/documents/documents.service.ts` | VERIFIED | `progressStep`, `totalSteps`, `currentNodeLabel` subqueries in `listDocuments` |
| `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` | VERIFIED | `getNodeConfig`, `NetworkBanner`, `AutoSaveIndicator`, `readOnly` mode, rollback, fixed draft save |
| `packages/frontend/src/components/workspace/StepperBar.tsx` | VERIFIED | Chinese node type labels map (`输入转换`, `信息脱敏`, `模型调用`, `信息恢复`, `文件导出`); color-coded status circles |
| `packages/frontend/src/components/workspace/NetworkBanner.tsx` | VERIFIED | `navigator.onLine` monitoring, `网络连接已断开...` Chinese banner |
| `packages/frontend/src/components/workspace/AutoSaveIndicator.tsx` | VERIFIED | File exists with `保存中...`/`已自动保存` states |
| `packages/frontend/src/components/workspace/WorkflowPreview.tsx` | VERIFIED | `流程预览`, `共 N 个节点`, `WorkflowNodeDef[]` prop |
| `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` | VERIFIED | `field.id` key, Chinese labels, file upload |
| `packages/frontend/src/components/workspace/nodes/DesensitizeExecutor.tsx` | VERIFIED | `onMount` auto-detect, `信息脱敏` heading, `categories` config, `重新检测` button |
| `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx` | VERIFIED | `modelIds` from config, Chinese status labels, SSE reconnect polling |
| `packages/frontend/src/components/workspace/nodes/RestoreExecutor.tsx` | VERIFIED | `信息恢复`, `手动修正`, `确认恢复结果`, split-view |
| `packages/frontend/src/components/workspace/nodes/ExportExecutor.tsx` | VERIFIED | `文件导出`, PPT filtered, `下载文件` |
| `packages/frontend/src/components/workspace/nodes/ModelCompareView.tsx` | VERIFIED | `选择此输出`, `源码视图` Chinese labels |
| `packages/frontend/src/pages/admin/ModelCallLogs.tsx` | VERIFIED | `模型调用日志` heading, filter bar, table |
| `packages/frontend/src/pages/projects/ProjectHome.tsx` | VERIFIED | `WorkflowPreview` integrated (line 734), `progressStep`/`totalSteps` display (line 562) |
| `packages/frontend/src/lib/flow-engine/derive-outputs.ts` | VERIFIED | Multi-output per `inputSources` for desensitize/restore: `{displayName}.脱敏` / `{displayName}.恢复` |
| `packages/backend/src/modules/workflows/validation.ts` | VERIFIED | Rule 9: max 1 desensitize node enforced (`工作流最多只能包含一个【信息脱敏】节点`) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `runtime.service.ts` | `shared/types.ts` | `DocumentRuntimeState.workflowNodes` from workflow JOIN | WIRED | Line 501: `const workflowNodes = (docRows[0]?.nodes as WorkflowNodeDef[]) ?? []`; line 520: included in return |
| `model-call.service.ts` | `db/schema.ts` | INSERT into `modelCallLogs` after each model call | WIRED | Lines 187, 220, 382, 421: `db.insert(modelCallLogs).values(...)` |
| `DocumentWorkspace.tsx` | `shared/types.ts` | `DocumentRuntimeState.workflowNodes` used in `getNodeConfig` | WIRED | Lines 109-113: `getNodeConfig` reads `s.workflowNodes.find(n => n.id === nodeExec.nodeId)` |
| `NetworkBanner.tsx` | `DocumentWorkspace.tsx` | Mounted inside workspace | WIRED | `DocumentWorkspace.tsx` line 390: `<NetworkBanner />` |
| `model-call-log.routes.ts` | `db/schema.ts` | Queries `modelCallLogs` table | WIRED | `model-call-log.routes.ts` lines 4, 56-80: imports and queries `modelCallLogs` |
| `model-call-log.routes.ts` | `backend/index.ts` | Route registered in app | WIRED | `index.ts` line 54: `.use(modelCallLogRoutes)` |
| `WorkflowEditor.tsx` | `FlowCanvas.tsx` | `syncInputSources()` called on `onConnectionComplete` | WIRED | `WorkflowEditor.tsx` lines 282-283, 341-349: `syncInputSources()` called after edge add |
| `input-transform.service.ts` | `runtime.service.ts` | `outputData.text` read by `advanceNode` | WIRED | `input-transform.service.ts` line 172: `text: combinedText`; `runtime.service.ts` lines 243-272: reads `inputSources` and maps upstream `outputData` fields |
| `DocumentWorkspace.tsx` | `runtime.routes.ts` | Draft save PUT with `{ data: ... }` body | WIRED | Lines 73, 170: `JSON.stringify({ data })` / `JSON.stringify({ data: { text: content } })` |
| `documents.service.ts` | `node_executions table` | Progress subqueries for `listDocuments` | WIRED | Lines 132-143: correlated SQL subqueries with `is_current = true` filter |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| DOC-01 | 13-06, 13-08, 13-10 | Create document from project, select workflow | SATISFIED | `WorkflowPreview` in create modal (ProjectHome line 734) |
| DOC-02 | 13-01, 13-08 | System creates working directory on init | SATISFIED | `runtime.service.ts` `initDocumentExecution` creates `data/workspaces/{docId}` with `input/output/export` subdirs |
| DOC-03 | 13-02, 13-08, 13-10 | Workspace shows progress navigation bar | SATISFIED | `StepperBar.tsx` with Chinese labels; `DocumentWorkspace.tsx` renders stepper |
| DOC-04 | 13-01, 13-02, 13-08 | Workspace shows current node operation area | SATISFIED | `DocumentWorkspace.tsx` `getNodeConfig` wires real configs to all 5 executors |
| DOC-05 | 13-02, 13-06, 13-08 | Node history panel and document progress | SATISFIED | `CompletedNodeCard`, completed view components, progress bar in `ProjectHome` |
| NODE-01 | 13-03, 13-08, 13-09, 13-10 | Input transform: fill text, upload file | SATISFIED | `InputTransformExecutor.tsx` with `field.id` key, file upload, Chinese UI |
| NODE-02 | 13-03, 13-08 | Upload Word/PDF/image/audio/video, auto-parse | SATISFIED | `InputTransformExecutor.tsx` upload logic preserved, `input-transform.service.ts` parse |
| NODE-03 | 13-03, 13-08 | View and modify parsed file results | SATISFIED | `InputTransformExecutor.tsx` editable parsed results |
| NODE-04 | 13-03, 13-08, 13-10 | Confirm writes input data to step subdirectory | SATISFIED | `input-transform.service.ts` `writeFile` to `outputDir/output.txt`; `outputData.text` now correct |
| NODE-05 | 13-03, 13-08, 13-09, 13-10 | Local model detects sensitive info | SATISFIED | `DesensitizeExecutor.tsx` `onMount` auto-detect; upstream data now flows via `outputData.text` |
| NODE-06 | 13-03, 13-08, 13-09 | Confirm/reject desensitize items, manual mark | SATISFIED | `DesensitizeExecutor.tsx` checklist UI, manual mark capability |
| NODE-07 | 13-03, 13-08, 13-09 | Mapping encrypted in DB, local copy in workdir | SATISFIED | `desensitize.service.ts` mapping stored in DB; local file write preserved |
| NODE-08 | 13-01, 13-03, 13-08, 13-09 | Desensitize rules auto-injected into model prompts | SATISFIED | `model-call.service.ts` variable resolution via `{{nodeId.outputId}}` format; desensitize outputData propagated |
| NODE-09 | 13-04, 13-08 | Model call via unified abstraction layer | SATISFIED | `model-call.service.ts` SSE streaming execution |
| NODE-10 | 13-04, 13-08 | Single or multi-model comparison mode | SATISFIED | `ModelCallExecutor.tsx` `isMultiModel()` logic with tab view |
| NODE-11 | 13-04, 13-08 | Parallel multi-model calls | SATISFIED | `model-call.service.ts` `Promise.allSettled` parallel execution |
| NODE-12 | 13-04, 13-08 | SSE streaming output with status states | SATISFIED | `ModelCallExecutor.tsx` status labels: `等待中`, `生成中`, `已完成`, `失败` |
| NODE-13 | 13-04, 13-08, 13-09 | Switch between model outputs, Markdown/source view | SATISFIED | `ModelCallExecutor.tsx` tab switching; `ModelCompareView.tsx` `源码视图` toggle |
| NODE-14 | 13-04, 13-08, 13-09 | Single model retry, preserve others | SATISFIED | `ModelCallExecutor.tsx` per-model `重试` button |
| NODE-15 | 13-04, 13-08, 13-09 | Multi-model side-by-side comparison | SATISFIED | `ModelCompareView.tsx` side-by-side with `选择此输出` |
| NODE-16 | 13-04, 13-08, 13-09 | Select best output as final | SATISFIED | `ModelCallExecutor.tsx` `选择此输出` sets `selectedModelId` |
| NODE-17 | 13-05, 13-08, 13-09 | Local restore: replace placeholders with real values | SATISFIED | `RestoreExecutor.tsx` restore logic preserved; multi-source `inputData.sources` format supported |
| NODE-18 | 13-05, 13-08, 13-09 | Before/after comparison with highlights | SATISFIED | `RestoreExecutor.tsx` split view: `脱敏文本（恢复前）` / `恢复文本（恢复后）` |
| NODE-19 | 13-05, 13-08, 13-09 | Failed restore items highlighted, manual correction | SATISFIED | `RestoreExecutor.tsx` `手动修正` button on failed items |
| NODE-20 | 13-05, 13-08 | Export format selection (Word/PDF/Markdown) | SATISFIED | `ExportExecutor.tsx` `导出格式` selector, PPT filtered out |
| NODE-21 | 13-05, 13-08 | Export preview | SATISFIED | `ExportExecutor.tsx` preview area preserved |
| NODE-22 | 13-01, 13-05, 13-08 | Set filename, download, stored in export/ | SATISFIED | `ExportExecutor.tsx` `下载文件`; `export.service.ts` `resolveContent` models Record fix |
| NOPS-01 | 13-02, 13-08 | Confirm/next to advance workflow | SATISFIED | `DocumentWorkspace.tsx` action buttons wire to advance API |
| NOPS-02 | 13-02, 13-07, 13-08 | Inline editor with auto-save | SATISFIED | `InlineEditor` + `AutoSaveIndicator` + 1.5s debounce in `debouncedDraftSave` |
| NOPS-03 | 13-02, 13-08 | Skip optional nodes | SATISFIED | `DocumentWorkspace.tsx` skip API call wired to action bar |
| NOPS-04 | 13-02, 13-08 | Rollback to previous node with reset | SATISFIED | `DocumentWorkspace.tsx` rollback API + confirmation dialog (`确认重新执行？后续节点状态将被重置`) |
| RECV-01 | 13-07, 13-08, 13-09, 13-10 | Auto-save draft on editable nodes | SATISFIED | `debouncedDraftSave` 1.5s debounce; `JSON.stringify({ data })` body shape fixed (Plan 10) |
| RECV-02 | 13-07, 13-08 | Browser refresh resumes to last state from DB | SATISFIED | `DocumentWorkspace.tsx` init API loads `DocumentRuntimeState` from DB; UAT Test 17 passed |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ModelCallExecutor.tsx` | 777 | `return null` inside `Show` block | Info | Not a stub — this is a SolidJS side-effect pattern used to auto-select a single completed model inside a reactive `Show`. Legitimate usage. |
| `DesensitizeExecutor.tsx` | 57 | `return []` in a signal initializer | Info | Not a stub — initializes empty `items` signal. Legitimate default value. |

No blocker or warning anti-patterns found in executor or backend service files.

---

### Human Verification Required

#### 1. End-to-End Workflow Execution (5 nodes in sequence)

**Test:** Log in as a non-admin user, navigate to a project, click "新建文档", select a workflow that includes all 5 node types, create the document. Then execute each node in sequence.
**Expected:**
- Input transform: form fields from workflow config render with Chinese labels; file upload parses; "确认并继续" advances to next node
- Desensitize: immediately detects sensitive info on entering node (no manual button); amber theme UI; "重新检测" button visible; "确认脱敏" advances
- Model call: SSE streaming shows "等待中" → "生成中" → "已完成"; Markdown rendered output; "选择此输出" enables advance
- Restore: split-view "脱敏文本（恢复前）" / "恢复文本（恢复后）" with highlights; "确认恢复结果" advances
- Export: Word/PDF/Markdown format options only (no PPT); "下载文件" triggers download
**Why human:** SSE streaming, auto-detect trigger, and file download cannot be verified by static analysis. UAT was blocked at desensitize step (now fixed by Plan 10 — needs re-test).

#### 2. SSE Reconnect Safety

**Test:** Start model call execution. While SSE is streaming, refresh the browser page.
**Expected:** Page resumes at model call node, shows "模型生成中，正在获取最新状态..." polling state, does NOT call the execute endpoint again, displays result once streaming completes.
**Why human:** SSE disconnect and reconnect behavior requires live browser interaction and network state.

#### 3. Document List Progress Display

**Test:** Create a document and execute only the first node (leaving it in_progress). Return to the project document list.
**Expected:** The document row shows a small progress bar and "进度: 1/N · 输入转换" text below the title.
**Why human:** UAT Test 3 reported this missing. Plan 10 added the backend subqueries and frontend already had the render guard. Root cause confirmed fixed in code, but no re-test has been performed.

#### 4. Completed Document Read-Only Mode

**Test:** Open a document where all nodes are completed.
**Expected:** All executors render in read-only mode; each completed node shows a "从此节点重新执行" button; clicking it shows a confirmation dialog "确认重新执行？后续节点状态将被重置"; confirming calls rollback and re-enters execution mode.
**Why human:** Requires a completed document in the test environment; read-only rendering depends on runtime document status.

#### 5. Network Disconnect Banner

**Test:** While on the document workspace, disable network connectivity (DevTools Network → Offline).
**Expected:** Amber banner appears: "网络连接已断开，正在尝试重新连接..."; re-enabling network triggers "已重新连接" green flash that disappears after 3 seconds.
**Why human:** `navigator.onLine` events cannot be simulated via Playwright accessibility snapshots.

---

### Gaps Summary

No gaps blocking goal achievement were found in automated verification. All 29 requirement IDs (DOC-01 through DOC-05, NODE-01 through NODE-22, NOPS-01 through NOPS-04, RECV-01 through RECV-02) have implementation evidence in the codebase.

The two UAT blocker gaps identified during testing (Test 3 — progress display; Test 5 — desensitize receiving upstream data) were addressed by Plan 10 (gap closure plan). Code evidence confirms both fixes are applied:
- `input-transform.service.ts` line 172: `text: combinedText` added to `outputData`
- `DocumentWorkspace.tsx` lines 73, 170: draft save body wrapped in `{ data }` envelope
- `documents.service.ts` lines 132-143: `progressStep`, `totalSteps`, `currentNodeLabel` subqueries added

The UAT was run before Plan 10 was executed. The remaining uncertainty is whether the fixes work correctly end-to-end in a live browser, which requires human re-testing of the 5 items listed above.

---

_Verified: 2026-03-25T04:30:00Z_
_Verifier: Claude (gsd-verifier)_
