# Phase 21: AI-Assisted Inline Editing - Research

**Researched:** 2026-03-26
**Domain:** Frontend text selection UI + SSE streaming + inline diff preview (SolidJS + Elysia backend)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Toolbar Trigger**: Floating bubble near text selection in InlineEditor textarea, using `selectionchange` events
2. **Preset Actions**: 改写 (Rewrite), 精简 (Simplify), 扩写 (Expand), 纠错 (Fix grammar), 自定义 (Custom instruction) -- flat single row layout
3. **Translate REMOVED**: 翻译 (Translate) is explicitly NOT included
4. **Custom Instruction UX**: Inline input box + send button within floating toolbar (no modal)
5. **Diff Display**: Dual mode with toggle -- inline diff (red strikethrough deletions, green additions) AND side-by-side diff
6. **Accept/Reject Granularity**: Whole-result only (no per-hunk)
7. **Reject Behavior**: Restore original text, toolbar remains visible for retry
8. **Accept Behavior**: Apply immediately to editor content, diff preview disappears, user still clicks node "确认" to persist via `onDraftSave`
9. **Streaming Display**: Real-time SSE streaming replacement, then transitions to diff preview after completion
10. **Cancel During Streaming**: Supported via AbortController, discards all and restores original
11. **Model Selector**: Inline dropdown at toolbar end showing current model name
12. **Security Constraint**: After restore node = only local/private models; auto-filter + hint text + lock icon
13. **Default Model**: First model from node config (`config.modelIds[0]`), falls back to first local model under security constraint

### Claude's Discretion

No explicit discretion areas were noted -- all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None raised during discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIED-01 | User selects text in node output editor, AI floating toolbar appears | Textarea `selectionchange` listener + floating positioning; InlineEditor.tsx already has selection APIs (`selectionStart`/`selectionEnd`) |
| AIED-02 | Toolbar provides preset actions: rewrite, simplify, expand, fix grammar, translate, custom instruction | CONTEXT.md removes translate; 4 presets + custom instruction with inline input |
| AIED-03 | AI edits shown as inline diff preview (red deletions, green additions) with per-change accept/reject | CONTEXT.md narrows to whole-result accept/reject; dual-mode diff (inline + side-by-side) with toggle |
| AIED-04 | AI edit responses stream via SSE in real-time | Existing SSE pattern in ModelCallExecutor + backend model-call.service.ts; new lightweight endpoint needed |
| AIED-05 | After restore node: only local/private models available; before restore: all online models | `deploymentType` field on providers table (`cloud` \| `local`); `listActiveModels()` already returns `deploymentType`; security context derived from node position in `DocumentRuntimeState.nodes` |
| AIED-06 | User can choose AI model for editing, list auto-filtered by security context | Model selector dropdown in toolbar; filter models by `deploymentType === "local"` when post-restore |
</phase_requirements>

## Summary

Phase 21 adds AI-assisted inline editing to the existing InlineEditor component. Users select text in a node output editor's textarea, a floating toolbar appears with preset AI actions (rewrite, simplify, expand, fix grammar, custom instruction), the AI generates a replacement via SSE streaming, and the result is shown as an inline diff preview with accept/reject controls.

The existing codebase provides strong foundations: InlineEditor.tsx already has textarea selection APIs, ModelCallExecutor.tsx demonstrates the SSE streaming pattern with AbortController, the backend model-call.service.ts has the strategy-based model execution pipeline, and `callSourceEnum` already includes `inline_edit`. The `providers.deploymentType` field (`cloud` | `local`) enables the security filtering requirement.

The main new work involves: (1) a floating toolbar component with selection-aware positioning, (2) a new lightweight backend SSE endpoint for inline edits, (3) a text diff computation and rendering system, and (4) security context derivation from the workflow node graph.

**Primary recommendation:** Build this as a self-contained feature layer on top of InlineEditor -- add a floating toolbar component, a dedicated backend endpoint for inline edit SSE streaming, and a diff preview overlay. Reuse existing SSE patterns and model execution strategies.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SolidJS | (existing) | UI framework | Already used throughout project |
| Elysia | (existing) | Backend HTTP framework | Already used for all routes |
| diff-match-patch | 1.0.5 | Text diff computation | Google's battle-tested diff library, minimal (~45KB), no dependencies, ideal for character-level text diffs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | - | - | All other needs covered by existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| diff-match-patch | jsdiff (npm `diff`) | jsdiff is more popular but diff-match-patch has better character-level diff + patch support, and the Google algorithm handles CJK text well |
| diff-match-patch | Hand-rolled string diff | Would miss edge cases with CJK characters, whitespace, and multi-line content |
| Floating toolbar via JS | CSS `:has(:selection)` | CSS approach not feasible -- need selection coordinates for positioning |

**Installation:**
```bash
bun add diff-match-patch
bun add -D @types/diff-match-patch
```

## Architecture Patterns

### Recommended Project Structure
```
packages/frontend/src/
├── components/workspace/
│   ├── InlineEditor.tsx              # MODIFY: add selection listener, render AIEditToolbar
│   ├── AIEditToolbar.tsx             # NEW: floating toolbar with actions + model selector
│   ├── AIEditDiffPreview.tsx         # NEW: inline/side-by-side diff rendering
│   └── useTextSelection.ts          # NEW: hook for textarea selection tracking
packages/backend/src/
├── modules/runtime/
│   ├── inline-edit.routes.ts         # NEW: SSE streaming endpoint for inline edits
│   └── inline-edit.service.ts        # NEW: prompt construction + model execution
```

### Pattern 1: Textarea Selection Tracking
**What:** Custom hook that listens to `selectionchange` and `mouseup` on a textarea, tracks selection range and position for floating toolbar placement.
**When to use:** When InlineEditor textarea has a non-collapsed selection.
**Example:**
```typescript
// useTextSelection.ts
import { createSignal, onCleanup, onMount } from "solid-js";

interface SelectionState {
  text: string;
  start: number;
  end: number;
  rect: { top: number; left: number; width: number; height: number };
}

export function useTextSelection(textareaId: string) {
  const [selection, setSelection] = createSignal<SelectionState | null>(null);

  function updateSelection() {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      setSelection(null);
      return;
    }

    const text = textarea.value.slice(start, end);
    // Get textarea bounding rect for toolbar positioning
    const rect = textarea.getBoundingClientRect();
    // Approximate selection position using character offset
    // For a textarea, use line height and character width approximation
    setSelection({ text, start, end, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } });
  }

  onMount(() => {
    document.addEventListener("selectionchange", updateSelection);
    onCleanup(() => document.removeEventListener("selectionchange", updateSelection));
  });

  return selection;
}
```

### Pattern 2: SSE Streaming for Inline Edit (Backend)
**What:** Lightweight endpoint that takes selected text + action + model ID, constructs a prompt, and streams the response via SSE.
**When to use:** When user triggers an AI edit action from the floating toolbar.
**Example:**
```typescript
// inline-edit.routes.ts — mirrors model-call.routes.ts SSE pattern
.get(
  "/:documentId/inline-edit/:nodeExecutionId/stream",
  async ({ params, query, user, set }) => {
    // Validate membership, get model, construct prompt
    const prompt = buildInlineEditPrompt(query.action, query.selectedText, query.customInstruction);
    const stream = await executeInlineEdit(params.documentId, params.nodeExecutionId, query.modelId, prompt, user!.id);
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }
)
```

### Pattern 3: Diff Computation and Rendering
**What:** Use diff-match-patch to compute character-level diffs between original selected text and AI result, render as inline or side-by-side view.
**When to use:** After SSE streaming completes, transition to diff preview.
**Example:**
```typescript
import DiffMatchPatch from "diff-match-patch";

const dmp = new DiffMatchPatch();

function computeDiff(original: string, modified: string) {
  const diffs = dmp.diff_main(original, modified);
  dmp.diff_cleanupSemantic(diffs);
  return diffs; // Array of [operation, text] tuples: -1=delete, 0=equal, 1=insert
}

// Render inline diff
function InlineDiffView(props: { diffs: [number, string][] }) {
  return (
    <span>
      <For each={props.diffs}>
        {([op, text]) => (
          <Switch>
            <Match when={op === -1}>
              <span class="bg-red-100 text-red-800 line-through">{text}</span>
            </Match>
            <Match when={op === 1}>
              <span class="bg-green-100 text-green-800">{text}</span>
            </Match>
            <Match when={op === 0}>
              <span>{text}</span>
            </Match>
          </Switch>
        )}
      </For>
    </span>
  );
}
```

### Pattern 4: Security Context Derivation
**What:** Determine if the current node is "after a restore node" by examining the `DocumentRuntimeState.nodes` array — if any preceding node has `nodeType === "restore"` and is completed, the current node is in a post-restore security context.
**When to use:** When rendering the model selector dropdown in AIEditToolbar.
**Example:**
```typescript
function isPostRestoreContext(nodes: NodeExecution[], currentNodeIndex: number): boolean {
  // Check if any completed restore node exists before the current node
  for (let i = 0; i < currentNodeIndex; i++) {
    if (nodes[i].nodeType === "restore" && nodes[i].status === "completed") {
      return true;
    }
  }
  return false;
}
```

### Anti-Patterns to Avoid
- **Do NOT modify the textarea value during streaming**: During SSE streaming, render the streaming text in a separate overlay/container, not by mutating textarea value. Mutating textarea value during streaming would cause cursor jump issues and conflict with user interactions.
- **Do NOT create a full model call execution for inline edits**: Inline edits should use a lightweight endpoint that does not create nodeExecution records or update outputData during streaming. Only log to `model_call_logs` with `callSource = 'inline_edit'`.
- **Do NOT use `innerHTML` for diff rendering**: Use SolidJS JSX with `<For>` to render diff segments. Never insert raw HTML.
- **Do NOT duplicate SSE parsing logic**: Extract shared SSE parsing into a utility function reused between ModelCallExecutor and the new inline edit streaming.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text diff computation | Custom string comparison | diff-match-patch | CJK text handling, semantic cleanup, battle-tested edge case coverage |
| SSE stream parsing | New SSE parser | Extract existing `startStreaming` pattern from ModelCallExecutor | Already handles buffer splitting, error recovery, AbortController |
| Floating element positioning | Manual coordinate math | Textarea `getBoundingClientRect()` + relative positioning | Simple relative positioning from textarea container is sufficient |

**Key insight:** The existing codebase already solves 80% of this feature. The SSE streaming pattern, model execution strategies, and callSource enum are ready. The main new work is the UI layer (floating toolbar + diff preview) and a thin backend endpoint.

## Common Pitfalls

### Pitfall 1: Textarea Selection Loss on Blur
**What goes wrong:** When user clicks a toolbar button, the textarea loses focus, and `selectionStart`/`selectionEnd` reset to 0.
**Why it happens:** Click on toolbar triggers blur on textarea before the click handler runs.
**How to avoid:** Save the selection range in state when it changes. Use `mousedown` + `preventDefault()` on toolbar buttons to prevent textarea blur. Alternatively, read selection on `mouseup` and store it in a signal before any toolbar interaction.
**Warning signs:** Selection is empty when the action handler reads it.

### Pitfall 2: Streaming Text Rendering Flicker
**What goes wrong:** Each SSE delta causes a full re-render of the streaming content area, causing visible flicker.
**Why it happens:** Replacing the entire content string on each delta.
**How to avoid:** Use a SolidJS signal that accumulates deltas. The reactive system handles fine-grained updates. Avoid creating new DOM elements for each delta -- append to a single text node or use a pre element.
**Warning signs:** Visible text "jumping" during streaming.

### Pitfall 3: Security Context Not Updating After Node Navigation
**What goes wrong:** User navigates between nodes but the model filter still shows the old security context.
**Why it happens:** Security context computed once at mount, not reactively.
**How to avoid:** Make `isPostRestoreContext` a reactive computation (derived signal) that depends on the current node index.
**Warning signs:** User sees online models available after navigating to a post-restore node.

### Pitfall 4: Diff Rendering with CJK Characters
**What goes wrong:** Diff shows excessive character-level changes for Chinese text where word-level would be more readable.
**Why it happens:** diff-match-patch defaults to character-level diffs.
**How to avoid:** Call `dmp.diff_cleanupSemantic(diffs)` after `diff_main()` to merge adjacent tiny diffs into more meaningful semantic chunks. This is critical for Chinese text.
**Warning signs:** Diff shows individual character changes instead of word/phrase changes.

### Pitfall 5: Race Condition Between Cancel and Accept
**What goes wrong:** User clicks cancel while the last SSE chunk arrives, resulting in partial content being accepted.
**Why it happens:** Cancel sets a flag but the SSE handler processes one more event.
**How to avoid:** Use AbortController.abort() to hard-stop the fetch stream. After abort, ignore any pending state updates by checking an `isCancelled` flag.
**Warning signs:** Partial AI content appears in the editor after cancellation.

## Code Examples

### Inline Edit Backend Prompt Construction
```typescript
// Source: Derived from existing model-call.service.ts patterns

const ACTION_PROMPTS: Record<string, string> = {
  rewrite: "请改写以下文本，保持原意但使用不同的表达方式：\n\n",
  simplify: "请精简以下文本，去除冗余，保持核心信息：\n\n",
  expand: "请扩写以下文本，增加细节和深度，保持原有风格：\n\n",
  fix: "请修正以下文本中的语法、拼写和标点错误，保持原意：\n\n",
};

function buildInlineEditPrompt(action: string, selectedText: string, customInstruction?: string): string {
  if (action === "custom" && customInstruction) {
    return `${customInstruction}\n\n${selectedText}`;
  }
  const prefix = ACTION_PROMPTS[action];
  if (!prefix) throw new Error(`Unknown action: ${action}`);
  return `${prefix}${selectedText}\n\n请只返回修改后的文本，不要添加解释或额外内容。`;
}
```

### Floating Toolbar Positioning
```typescript
// Source: Derived from InlineEditor.tsx textarea selection pattern

function getToolbarPosition(textarea: HTMLTextAreaElement, containerRect: DOMRect) {
  const textareaRect = textarea.getBoundingClientRect();
  // Position toolbar above the textarea, horizontally centered
  // For more precise positioning, use a hidden div mirror technique
  return {
    top: textareaRect.top - containerRect.top - 44, // 44px toolbar height + gap
    left: (textareaRect.width - 400) / 2, // 400px estimated toolbar width, centered
  };
}
```

### SSE Streaming Utility (Extracted)
```typescript
// Source: Extracted from ModelCallExecutor.tsx startStreaming pattern

export async function streamSSE(
  url: string,
  onDelta: (data: string) => void,
  onComplete: (fullContent: string) => void,
  onError: (error: string) => void,
  abortSignal: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: abortSignal,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        try {
          const event = JSON.parse(dataStr) as SSEEvent;
          if (event.type === "delta") onDelta(event.data);
          else if (event.type === "complete") onComplete(event.data);
          else if (event.type === "error") onError(event.data);
        } catch { /* skip unparseable */ }
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Modal dialog for AI edits | Inline floating toolbar near selection | 2024-2025 | Notion, Google Docs, and Cursor all use floating toolbars; modal dialogs break flow |
| Full-page diff view | Inline diff within editor | 2024-2025 | Users expect in-context previews, not separate diff pages |
| Polling for AI results | SSE streaming | Already implemented | Real-time feedback is standard for AI features |

**Deprecated/outdated:**
- Sidebar chat panels for inline editing: Research (noted in project Out of Scope) confirms inline is the mainstream pattern
- Per-hunk accept/reject: User explicitly chose whole-result only -- simpler and sufficient for selected-text edits

## Open Questions

1. **Toolbar positioning precision for multi-line selections**
   - What we know: Textarea selection coordinates are not directly accessible via DOM API; `getBoundingClientRect()` gives the entire textarea rect, not the selection rect
   - What's unclear: How precise does the toolbar positioning need to be? For a textarea (not contenteditable), getting exact selection coordinates requires a mirror div technique
   - Recommendation: Start with positioning the toolbar above the textarea (near the top), offset by a reasonable amount. If users need more precise positioning, implement a hidden mirror div approach in a follow-up

2. **Inline edit endpoint: GET with query params vs POST with body**
   - What we know: Existing model-call execute uses GET for SSE streaming; but inline edit needs to send selectedText which could be long
   - What's unclear: Whether GET query params can reliably hold long selected text (URL length limits ~2000 chars)
   - Recommendation: Use POST for the inline edit endpoint, returning SSE stream from a POST request. Elysia supports this. The selectedText could exceed URL limits for large selections

## Sources

### Primary (HIGH confidence)
- Codebase analysis: InlineEditor.tsx, ModelCallExecutor.tsx, model-call.service.ts, model-call.routes.ts -- existing SSE streaming patterns
- Codebase analysis: schema.ts -- `callSourceEnum` already has `inline_edit`, `deploymentTypeEnum` has `cloud` | `local`
- Codebase analysis: models.service.ts `listActiveModels()` -- already returns `deploymentType`
- Codebase analysis: shared/types.ts -- `DocumentRuntimeState` includes `workflowNodes` and `nodes` for security context derivation

### Secondary (MEDIUM confidence)
- diff-match-patch: Well-known Google library, stable API since 2012, widely used for text diffing including CJK text

### Tertiary (LOW confidence)
- None -- all findings are based on codebase analysis and well-established libraries

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Only one new dependency (diff-match-patch), everything else exists in the codebase
- Architecture: HIGH - Patterns directly mirror existing ModelCallExecutor/model-call SSE patterns
- Pitfalls: HIGH - Based on practical textarea selection behavior and SolidJS reactivity model

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- no fast-moving dependencies)
