---
phase: 21-ai-assisted-inline-editing
verified: 2026-03-26T15:10:00Z
status: human_needed
score: 11/11 must-haves verified
human_verification:
  - test: "Select text in a node output InlineEditor and confirm floating toolbar appears near selection"
    expected: "AIEditToolbar renders above the selected text with 4 preset buttons (改写/精简/扩写/纠错), 自定义 button, and model selector"
    why_human: "Toolbar positioning (top - 48px, centered) and visibility require browser rendering to verify"
  - test: "Click a preset action (e.g. 精简) while text is selected"
    expected: "Blue streaming overlay appears with 'AI 正在生成...' text that fills progressively; toolbar switches to showing 取消 button"
    why_human: "SSE streaming visual progression requires a live backend + network call"
  - test: "After streaming completes, verify diff preview appears"
    expected: "AIEditDiffPreview renders with 内联对比 view active, showing red strikethrough deletions and green additions; toggle to 并排对比 shows two columns"
    why_human: "Diff rendering with actual AI text requires end-to-end execution"
  - test: "Click 接受 and verify text replacement; click 拒绝 and verify restoration"
    expected: "Accept replaces exactly the selected range with AI result; Reject returns to idle state with original text unchanged"
    why_human: "State machine transitions and DOM mutation require browser execution"
  - test: "Test 取消 during active streaming"
    expected: "Streaming overlay disappears, state returns to idle, original text is preserved"
    why_human: "AbortController cancellation requires live SSE connection"
  - test: "Set up a workflow with a restore node preceding the current node; open inline editor"
    expected: "Model selector shows lock icon; dropdown shows only local-model entries with '当前节点包含恢复数据，仅显示本地模型' hint; attempting cloud model via API returns 403"
    why_human: "Post-restore security context requires a real document with correct node graph topology"
  - test: "Verify onMouseDown+preventDefault prevents textarea blur on toolbar button clicks"
    expected: "After clicking a toolbar button, textarea retains its selection (selection state does not clear)"
    why_human: "Focus/blur behavior requires interactive browser testing"
---

# Phase 21: AI-Assisted Inline Editing Verification Report

**Phase Goal:** Users can select text in node output editors and use AI to rewrite, simplify, expand, fix, or translate it with streaming inline diff preview
**Verified:** 2026-03-26T15:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/runtime/:documentId/inline-edit/:nodeExecutionId/stream returns SSE stream with delta/complete/error events | VERIFIED | `inline-edit.routes.ts` L17-82: POST endpoint exists, returns `new Response(stream, { "Content-Type": "text/event-stream" })`; service emits status/delta/complete/error SSEEvent objects |
| 2 | Inline edit logs are written to model_call_logs with callSource='inline_edit' | VERIFIED | `inline-edit.service.ts` L202-222: `db.insert(modelCallLogs).values({ callSource: "inline_edit", ... })` on success; L232-253: same insert on failure path |
| 3 | Security constraint enforced: requests for post-restore nodes with non-local model IDs are rejected with 403 | VERIFIED | `inline-edit.service.ts` L90-110: `validateModelSecurity` throws `forbidden(...)` for non-local; `inline-edit.routes.ts` L57-61: AppError statusCode preserved in catch block |
| 4 | When user selects text in the InlineEditor textarea, a floating toolbar appears near the selection | VERIFIED | `InlineEditor.tsx` L115: `useTextSelection(() => textareaRef)` wired; L453-468: IIFE renders `AIEditToolbar` when `sel && aiEditState() !== "diff_preview" && !props.readOnly && props.documentId` |
| 5 | Toolbar shows 4 preset actions (改写/精简/扩写/纠错) + custom instruction button in a flat row | VERIFIED | `AIEditToolbar.tsx` L14-19: `PRESET_ACTIONS` array with rewrite/simplify/expand/fix; L109-119: `<For>` renders preset buttons; L122-155: custom input toggle |
| 6 | Toolbar shows a model selector dropdown at right end with the current model name | VERIFIED | `AIEditToolbar.tsx` L160-262: model selector with dropdown, `selectedModelName()` display, chevron icon |
| 7 | Model selector filters to local-only models when in post-restore security context, with hint text and lock icon | VERIFIED | `AIEditToolbar.tsx` L33-38: `availableModels()` filters to `deploymentType === "local"` when `isPostRestore`; L170-186: lock icon; L204-223: hint text "当前节点包含恢复数据，仅显示本地模型" |
| 8 | AIEditDiffPreview renders inline diff (red strikethrough + green additions) and side-by-side diff with toggle | VERIFIED | `AIEditDiffPreview.tsx` L23-27: `dmp.diff_main` + `diff_cleanupSemantic`; L74-92: inline view with `bg-red-100 text-red-800 line-through` and `bg-green-100 text-green-800`; L95-135: side-by-side grid; L44-67: toggle buttons |
| 9 | Accept button applies the AI result; Reject button restores original text | VERIFIED | `InlineEditor.tsx` L256-272: `handleAccept` splices `completedContent()` into `localContent()` at selection range; L274-279: `handleReject` resets state without modifying content |
| 10 | Selecting text in InlineEditor triggers toolbar; clicking action streams via SSE; diff appears after; cancel aborts | VERIFIED | `InlineEditor.tsx` L200-244: `handleAIAction` calls `streamSSE` to `/api/runtime/${documentId}/inline-edit/${nodeExecutionId}/stream`; L247-253: `handleCancel` calls `abortController?.abort()`; state machine transitions idle→streaming→diff_preview |
| 11 | InlineEditor in DocumentWorkspace receives all 6 AI context props | VERIFIED | `DocumentWorkspace.tsx` L1058-1069: all 6 props passed: `documentId`, `nodeExecutionId`, `nodes`, `currentNodeIndex`, `availableModels`, `defaultModelId` |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/modules/runtime/inline-edit.service.ts` | Prompt construction + model execution + audit logging | VERIFIED | 260 lines; exports `buildInlineEditPrompt`, `isPostRestoreNode`, `validateModelSecurity`, `executeInlineEdit`; real DB queries, real strategy dispatch, real `model_call_logs` insert |
| `packages/backend/src/modules/runtime/inline-edit.routes.ts` | POST SSE streaming endpoint | VERIFIED | 83 lines; POST `/:documentId/inline-edit/:nodeExecutionId/stream`; Elysia schema validation; project membership check; AppError status preserved |
| `packages/frontend/src/components/workspace/useTextSelection.ts` | Reactive hook tracking textarea selection | VERIFIED | 72 lines; mouseup+keyup listeners; `SelectionState` with text/start/end/rect; cleanup in `onCleanup` |
| `packages/frontend/src/components/workspace/AIEditToolbar.tsx` | Floating toolbar with AI actions + model selector | VERIFIED | 267 lines; 4 presets + custom input; model dropdown with `deploymentType` filtering; lock icon; `onMouseDown+preventDefault` on all action buttons |
| `packages/frontend/src/components/workspace/AIEditDiffPreview.tsx` | Inline and side-by-side diff with accept/reject | VERIFIED | 159 lines; `diff-match-patch` with `diff_cleanupSemantic`; inline/side-by-side toggle; red deletions/green additions using SolidJS `<For>`/`<Switch>/<Match>`; no innerHTML |
| `packages/frontend/src/lib/sse-stream.ts` | Shared SSE streaming utility | VERIFIED | 110 lines; `streamSSE` supports GET/POST; Bearer token from localStorage; buffer split on `\n\n`; delta/complete/error callbacks; AbortError silently handled |
| `packages/frontend/src/components/workspace/InlineEditor.tsx` | Integrated inline editor with full AI editing | VERIFIED | 493 lines; AI state machine (idle/streaming/diff_preview); `useTextSelection` wired; `AIEditToolbar`/`AIEditDiffPreview` rendered conditionally; `streamSSE` called to backend; `isPostRestore` derived via `createMemo` |
| `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` | Passes AI editing context props to InlineEditor | VERIFIED | Model fetch via `GET /api/models` on mount (fire-and-forget); `defaultModelId` derived from `wfNode?.config?.modelIds?.[0]`; all 6 props passed at InlineEditor call site L1058-1069 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `inline-edit.routes.ts` | `inline-edit.service.ts` | `executeInlineEdit` call | WIRED | L4-9: imports all 4 functions; L28-47: calls isPostRestoreNode, validateModelSecurity, buildInlineEditPrompt, executeInlineEdit |
| `inline-edit.service.ts` | `strategies/*` | `getStrategy` + `strategy.execute` | WIRED | L5: `import { getStrategy }` from `./strategies`; L177-186: `getStrategy(model.providerType)` → `strategy.execute(...)` |
| `inline-edit.service.ts` | `model_call_logs` table | `db.insert` with `callSource='inline_edit'` | WIRED | L202-222: insert on success; L232-253: insert on failure |
| `useTextSelection.ts` | `AIEditToolbar.tsx` | selection signal for visibility/positioning | WIRED | `InlineEditor.tsx` L115: `useTextSelection(() => textareaRef)`; L454: `sel.rect` passed to `AIEditToolbar` as `selectionRect` |
| `AIEditDiffPreview.tsx` | `diff-match-patch` | `dmp.diff_main` + `diff_cleanupSemantic` | WIRED | L1: `import DiffMatchPatch from "diff-match-patch"`; L13: `const dmp = new DiffMatchPatch()`; L24-26: used in `createMemo` |
| `AIEditToolbar.tsx` | model selector | `deploymentType` filtering | WIRED | L33-38: `filter((m) => m.deploymentType === "local")` when `isPostRestore` |
| `InlineEditor.tsx` | `AIEditToolbar.tsx` | conditional rendering on selection | WIRED | L453-468: IIFE guard pattern renders `AIEditToolbar` when `sel` is non-null |
| `InlineEditor.tsx` | `AIEditDiffPreview.tsx` | conditional rendering on diff state | WIRED | L478-489: IIFE renders `AIEditDiffPreview` when `aiEditState() === "diff_preview"` |
| `InlineEditor.tsx` | `sse-stream.ts` | `streamSSE` to inline-edit endpoint | WIRED | L4: `import { streamSSE }`; L216-237: `streamSSE({ url: /api/runtime/${documentId}/inline-edit/${nodeExecutionId}/stream, method: "POST", ... })` |
| `InlineEditor.tsx` | `useTextSelection.ts` | selection tracking hook | WIRED | L5: `import { useTextSelection }`; L115: `const selection = useTextSelection(() => textareaRef)` |
| `DocumentWorkspace.tsx` | `InlineEditor.tsx` | AI editing props | WIRED | L1058-1069: documentId/nodeExecutionId/nodes/currentNodeIndex/availableModels/defaultModelId all passed |
| `index.ts` | `inline-edit.routes.ts` | `.use(inlineEditRoutes)` | WIRED | `index.ts` L20: import; L61: `.use(inlineEditRoutes)` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AIED-01 | 21-02, 21-03 | AI 浮动工具栏在选中文本时出现 | SATISFIED | `useTextSelection` + `AIEditToolbar` conditional render in `InlineEditor`; toolbar gate on `selection() && !readOnly && documentId` |
| AIED-02 | 21-02, 21-03 | 预置操作：重写、简化、扩展、修正语法、自定义指令 (翻译 explicitly removed per CONTEXT.md user decision) | SATISFIED | 4 presets (rewrite/simplify/expand/fix) + custom instruction in `AIEditToolbar`; translate intentionally excluded per `21-CONTEXT.md` L20: "翻译 (Translate) is NOT included — user explicitly removed this action" |
| AIED-03 | 21-02, 21-03 | 内联差异预览（红色删除/绿色新增），接受/拒绝 | SATISFIED | `AIEditDiffPreview` with diff-match-patch; inline + side-by-side toggle; accept/reject handlers in `InlineEditor` |
| AIED-04 | 21-01, 21-03 | SSE 流式响应，实时展示 | SATISFIED | Backend SSE endpoint streams delta/complete/error; `streamSSE` utility; streaming overlay in `InlineEditor` with progressive content accumulation |
| AIED-05 | 21-01, 21-03 | 恢复节点后仅允许本地/私有模型（安全约束） | SATISFIED | `isPostRestoreNode` DB query; `validateModelSecurity` throws 403 for cloud models; frontend `isPostRestore` memo filters models and mirrors backend constraint |
| AIED-06 | 21-01, 21-02, 21-03 | 模型选择器，根据安全约束自动过滤 | SATISFIED | Model selector in `AIEditToolbar` with `deploymentType` filtering; `validSelectedModelId` memo auto-corrects when filtered list changes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | All new files contain real implementations |

No TODO/FIXME/PLACEHOLDER comments found in any new files. No empty implementations detected. All handlers contain substantive logic.

### Human Verification Required

#### 1. Toolbar Visibility on Text Selection

**Test:** Open a document in the workspace, navigate to a completed node's output in InlineEditor (not read-only), click and drag to select some text.
**Expected:** The AIEditToolbar floats above the selection showing 改写/精简/扩写/纠错 buttons, a 自定义 button, and a model selector at the right.
**Why human:** Toolbar absolute positioning (`top - 48px`, `left: 50%`, `transform: translateX(-50%)`) and mouseup event firing require browser rendering to verify.

#### 2. SSE Streaming Progressive Display

**Test:** With text selected, click 精简.
**Expected:** Toolbar shows 取消 button; blue overlay appears reading "AI 正在生成..." and fills progressively as tokens arrive.
**Why human:** SSE streaming and real-time DOM updates require a live backend and network connection.

#### 3. Diff Preview After Streaming

**Test:** Wait for streaming to complete.
**Expected:** Blue overlay disappears; AIEditDiffPreview renders with 内联对比 active, showing red strikethrough for removed text and green for additions. Toggle to 并排对比 shows two-column layout.
**Why human:** Actual diff rendering depends on AI output content and requires end-to-end execution.

#### 4. Accept and Reject Controls

**Test:** In diff preview, click 接受.
**Expected:** Selected text in the textarea is replaced exactly with the AI result; diff preview closes; editor returns to idle.
**Test:** Alternatively click 拒绝.
**Expected:** Diff preview closes; original text is unchanged; editor returns to idle.
**Why human:** Selection range replacement (`content.slice(0, start) + completed + content.slice(end)`) correctness requires real interaction.

#### 5. Cancel During Streaming

**Test:** Click a preset action, then immediately click 取消.
**Expected:** Streaming stops, blue overlay disappears, state returns to idle, original text is preserved.
**Why human:** AbortController cancellation and SSE stream teardown require a live connection to verify.

#### 6. Post-Restore Security Context

**Test:** Set up a workflow with a restore node marked as completed, with the target model-call node after it. Open that node's InlineEditor.
**Expected:** Model selector shows a lock icon next to the model name. Dropdown shows only local-deployment models with "当前节点包含恢复数据，仅显示本地模型" at top. Attempting to call the endpoint with a cloud model ID returns HTTP 403.
**Why human:** Requires a real document with a completed restore node at a lower stepOrder than the target node.

#### 7. Toolbar Blur Prevention

**Test:** Select text in InlineEditor, then click a preset action button without releasing the mouse.
**Expected:** Textarea retains its selection (selection state does not clear before the action fires).
**Why human:** `onMouseDown + preventDefault` blur prevention behavior requires interactive browser testing; cannot be verified by static analysis.

### Scope Note: AIED-02 Translate Action

REQUIREMENTS.md AIED-02 lists "翻译" (translate) as a required preset action, but the implementation omits it. This is intentional: `21-CONTEXT.md` line 20 records "翻译 (Translate) is NOT included — user explicitly removed this action." The REQUIREMENTS.md entry is marked complete and the RESEARCH.md maps AIED-02 as satisfied by the 4 remaining presets plus custom instruction. This is a documented scope reduction, not a defect.

---

_Verified: 2026-03-26T15:10:00Z_
_Verifier: Claude (gsd-verifier)_
