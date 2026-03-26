# Phase 21: AI-Assisted Inline Editing — Context

> Decisions gathered through discussion on 2026-03-26.
> This file guides research and planning agents — treat these as locked decisions.

## 1. Toolbar Trigger & Actions

### Trigger mechanism
- **Floating bubble**: When user selects text in the node output editor (InlineEditor textarea), a floating toolbar appears near the selection (above or below).
- Implementation: listen to `selectionchange` events on the textarea, compute selection position for toolbar placement.

### Preset actions (single row, flat layout)
- 改写 (Rewrite)
- 精简 (Simplify)
- 扩写 (Expand)
- 纠错 (Fix grammar)
- 自定义 (Custom instruction)

### Removed actions
- **翻译 (Translate) is NOT included** — user explicitly removed this action.

### Custom instruction UX
- **Inline input box**: Clicking "自定义" expands a text input + send button within the floating toolbar.
- User types instruction and presses Enter or clicks send. No modal dialog.

## 2. Diff Preview & Accept/Reject

### Diff display format
- **Dual mode with toggle**: Both inline diff and side-by-side diff are available, user can switch between them.
  - Inline: deletions shown with red strikethrough, additions with green background, in-place within the editor.
  - Side-by-side: left panel shows original, right panel shows AI result, differences highlighted.

### Accept/Reject granularity
- **Whole-result only**: Accept or reject the entire AI edit as one unit. No per-hunk accept/reject.

### Reject behavior
- **Restore original text**: Rejecting discards the AI result and restores the original selected text. Floating toolbar remains visible so user can retry with a different action.

### Accept behavior
- **Apply immediately**: Accepting replaces the selected text in the editor content. Diff preview disappears. User still needs to click the node's "确认" button to persist outputData via `onDraftSave`.

## 3. Streaming Experience

### Streaming display
- **Real-time streaming replacement**: SSE tokens stream in real-time, progressively replacing the selected area content. User sees text being written character by character.
- After streaming completes, the view transitions to diff preview (original vs new) with accept/reject buttons.

### Cancel during streaming
- **Supported**: A "取消" (Cancel) button is displayed during streaming. Clicking it aborts the SSE connection via AbortController.

### Cancel behavior
- **Discard and restore**: Canceling discards all generated content and fully restores the original text. Clean slate.

## 4. Model Selector & Security UX

### Model selector placement
- **Inline dropdown at toolbar end**: The floating toolbar shows the current model name at the right end. Clicking it opens a dropdown list of available models.

### Security constraint communication
- **Auto-filter + hint text**: When editing content after an information restore node:
  - The dropdown only shows local/private models (online models are filtered out).
  - A hint line at the top of the dropdown reads: "当前节点包含恢复数据，仅显示本地模型" (Current node contains restored data, only local models shown).
  - The model selector shows a lock icon to visually indicate the security constraint.

### Default model selection
- **First model from node config**: Uses the first model from the current node's model call configuration (`config.modelIds[0]`).
- Under security constraint: automatically falls back to the first available local model.

## Code Context

### Existing assets to leverage
| Asset | Path | Relevance |
|-------|------|-----------|
| InlineEditor | `packages/frontend/src/components/workspace/InlineEditor.tsx` | Target component — plain textarea with selection APIs available |
| ModelCallExecutor | `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx` | SSE streaming pattern with AbortController, phase state machine |
| RestoreExecutor | `packages/frontend/src/components/workspace/nodes/RestoreExecutor.tsx` | Security boundary — determines post-restore context |
| callSourceEnum | `packages/backend/src/db/schema.ts` | Already has `inline_edit` value (added in Phase 17) |
| OpenAI-compatible strategy | `packages/backend/src/modules/runtime/strategies/openai-compatible.strategy.ts` | Streaming SSE backend |
| Claude Agent SDK strategy | `packages/backend/src/modules/runtime/strategies/claude-agent-sdk.strategy.ts` | Streaming SSE backend |

### Key integration points
- InlineEditor needs to detect text selection and render floating toolbar
- New backend endpoint for inline edit SSE streaming (separate from full model call runtime)
- Security context must be derived from the node's position in the workflow (is it after a restore node?)
- Audit trail: inline edits logged to `model_call_logs` with `callSource = 'inline_edit'`

## Deferred Ideas

_(None raised during discussion)_
