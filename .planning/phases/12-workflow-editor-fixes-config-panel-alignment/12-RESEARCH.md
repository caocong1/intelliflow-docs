# Phase 12: Workflow Editor Fixes & Config Panel Alignment - Research

**Researched:** 2026-03-20
**Domain:** SolidJS workflow editor (SolidFlow canvas, config panels, undo/redo, autosave, validation)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 键盘 Delete/Backspace 删除选中的节点或边
- 删除节点时自动删除所有连入/连出的边
- 删除前显示确认对话框
- 边的删除：点击选中边（高亮显示）+ Delete 键
- 支持框选 + Ctrl/Shift 点击多选节点，可批量移动和批量删除
- 所有流程图操作（节点增删、边增删、节点移动、所有配置修改）都实时自动保存到后端
- 支持 Ctrl+Z 撤销 / Ctrl+Shift+Z 恢复，覆盖所有操作
- 右上角显示自动保存状态（"保存中..." + 动画）
- 验证按钮独立于保存，验证通过后显示"已验证"状态
- 验证通过后如果内容被修改并自动保存，验证状态重置为"未验证"
- 模型调用节点：modelId 单选改为 modelIds[] 多选（checkbox 列表）
- 运行时字段 autoAdvance、allowEdit、skippable 在每个节点配置面板底部以"运行时设置"折叠区暴露
- 全面检查所有 5 个节点配置面板，确保共享类型中的每个字段在 UI 中都有对应输入控件
- 配置面板样式一致性：交给 ui-ux-pro-max 审查并统一
- 节点名称（label）确保正确传递给运行时
- "表单字段"改名为"用户输入项"
- 去掉英文字段名（name），自动从显示标签（label）生成
- 输入转换的输出配置与具体设置一一对应
- 移除手动 OutputsEditor，输出完全从配置自动派生
- 脱敏节点配置改为管理员添加脱敏类别（名称+描述），占位符格式系统内定
- 导出格式增加 PPT，变为 word/pdf/markdown/ppt
- 提示词编辑器旁加"优化提示词"按钮
- "变量"概念改名为"节点输出"
- 强制线性流程：每个节点最多 1 个输入连接 + 1 个输出连接
- 新连接自动替换旧连接（保持线性）
- 自动连接：拖放新节点时连接到最近的没有输出线的节点
- 连接线加流动动画效果
- 支持多种线型（曲线、直线、折线）
- 连接线中间可拖拽调整形状
- 节点样式交给 ui-ux-pro-max 统一设计
- 扩展为全配置字段验证
- 增加线性流程验证
- 拖动节点时显示对齐辅助线
- MiniMap 中节点根据类型显示不同颜色
- 顶部工具栏显示验证状态和上次保存时间

### Claude's Discretion
- 撤销/恢复的具体实现方案（命令模式 vs 快照 vs diff）
- 自动保存的防抖策略和频率
- 对齐辅助线的具体视觉效果和吸附距离
- 提示词优化的默认 meta-prompt 内容
- 连接线拖拽调整形状的具体交互细节
- 各节点的 autoAdvance/allowEdit/skippable 默认值

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Summary

Phase 12 is a comprehensive overhaul of the workflow visual editor to produce valid workflows that Phase 5 runtime can execute. The current editor has fundamental gaps: no node/edge deletion, no undo/redo, manual save only, ModelCallConfig still uses single modelId dropdown instead of modelIds[] multi-select, no runtime settings (autoAdvance/allowEdit/skippable) exposed, manual OutputsEditor instead of auto-derived outputs, and validation only checks a subset of fields.

The work spans six major areas: (1) canvas interaction (deletion, multi-select, alignment guides, connection constraints), (2) config panel alignment with shared types, (3) auto-derived outputs replacing manual OutputsEditor, (4) undo/redo + real-time autosave, (5) validation expansion, and (6) UI/UX polish via ui-ux-pro-max skill. The codebase is well-structured with clear separation: canvas components in `workflow/canvas/`, config panels in `workflow/config/`, prompt editor in `workflow/prompt/`, and the page orchestrator in `WorkflowEditor.tsx`.

**Primary recommendation:** Structure plans around the six areas above, starting with shared type changes and auto-output derivation (foundational), then config panel fixes, then canvas interactions, then undo/autosave, then validation expansion, and finally UI/UX polish as the last plan.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dschz/solid-flow | (installed) | Flow canvas — nodes, edges, handles, minimap, controls | Already in use; SolidJS port of React Flow |
| solid-js | (installed) | Reactive UI framework | Project standard |
| @solidjs/router | (installed) | Client routing | Project standard |
| Tailwind CSS v4 | (installed) | Utility-first CSS | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ui-ux-pro-max skill | N/A | Design review & style unification | Node cards, config panels, connection lines, NodeLibraryPanel |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Snapshot-based undo/redo | Command pattern undo/redo | Snapshot is simpler for this scale (< 50 nodes); command pattern adds complexity with no benefit at this workflow size |
| Custom alignment guides | External library | No SolidFlow-compatible alignment library exists; must implement custom |

## Architecture Patterns

### Recommended Project Structure
```
packages/frontend/src/
├── components/workflow/
│   ├── canvas/
│   │   ├── WorkflowCanvas.tsx      # SolidFlow wrapper (add deletion, multi-select, alignment)
│   │   ├── NodeLibraryPanel.tsx     # Drag source (UI polish)
│   │   ├── ValidationOverlay.tsx    # Validation display (extend)
│   │   ├── edges/
│   │   │   └── DataFlowEdge.tsx     # Custom edge (add animation, line types, draggable)
│   │   └── nodes/
│   │       └── *.tsx                # 5 node components (UI redesign)
│   ├── config/
│   │   ├── ConfigPanel.tsx          # Config container (add RuntimeSettings, remove OutputsEditor)
│   │   ├── OutputsEditor.tsx        # TO BE REMOVED — replaced by auto-derivation
│   │   ├── RuntimeSettings.tsx      # NEW — autoAdvance/allowEdit/skippable collapsible section
│   │   ├── InputTransformConfig.tsx # Rename fields, auto-generate name from label
│   │   ├── DesensitizeConfig.tsx    # Categories with name+description, system-defined placeholders
│   │   ├── ModelCallConfig.tsx      # modelIds[] multi-select checkboxes, "optimize prompt" button
│   │   ├── RestoreConfig.tsx        # Minor — add runtime settings
│   │   └── ExportConfig.tsx         # Add PPT format, remove user content input
│   └── prompt/
│       ├── PromptEditor.tsx         # Rename "变量" to "节点输出"
│       └── VariablePicker.tsx       # Rename "变量" to "节点输出"
├── hooks/
│   └── useUndoRedo.ts              # NEW — snapshot-based undo/redo hook
├── pages/admin/
│   └── WorkflowEditor.tsx          # Orchestrator (autosave, undo/redo, validation state)
packages/shared/src/
│   └── types.ts                    # Update ExportConfig format union, DesensitizeConfig structure
packages/backend/src/modules/workflows/
│   └── validation.ts               # Extend full-field + linear flow validation
```

### Pattern 1: Snapshot-based Undo/Redo
**What:** Store complete `{ nodes, edges }` snapshots in a bounded array. Ctrl+Z pops from undo stack to redo stack; Ctrl+Shift+Z reverses.
**When to use:** Workflow editor with < 100 nodes where serialization cost is negligible.
**Recommendation:** Use a `createUndoRedo(initialState)` hook that returns `{ push, undo, redo, canUndo, canRedo }`. Cap history at ~50 entries. Push a snapshot on every meaningful operation (node add/delete, edge add/delete, config change, node move end). Do NOT push on every pixel of a drag — only on `onNodeDragStop` equivalent.

### Pattern 2: Debounced Autosave
**What:** After any state change (node/edge/config), start a 1.5-second debounce timer. If no further changes within the window, fire PUT to backend. Show "保存中..." indicator during save, "已保存" on success.
**When to use:** Real-time persistence without manual save button.
**Recommendation:** Use `createEffect` watching a serialized version of `{ nodes, edges }`. On change, clear previous timer and start new one. Save function reuses existing `handleSave` logic minus the validation step. Validation is triggered separately via a dedicated button.

### Pattern 3: Auto-Derived Outputs
**What:** Each node type computes its `outputs[]` deterministically from its config, eliminating manual OutputsEditor.
**When to use:** Replace the current manual OutputsEditor pattern.
**Rules:**
- `input_transform`: Each text/textarea field -> 1 output (using field label as name); file upload -> 1 "文件输出 (动态)" output
- `model_call`: Each selected modelId -> 1 output (using model display name)
- `desensitize`: Fixed 1 output ("脱敏后文本")
- `restore`: Fixed 1 output ("恢复后文本")
- `export`: Fixed 1 output ("导出文件")

Implement as a pure function `deriveOutputs(nodeType, config) => OutputDef[]` in shared or frontend. Call it inside `handleConfigChange` so outputs are always in sync.

### Pattern 4: Linear Connection Enforcement
**What:** Each node allows max 1 source edge and max 1 target edge. New connections replace existing ones.
**When to use:** WorkflowCanvas `onConnect` handler.
**Implementation:** In `handleConnect`, before adding the new edge: (1) find and remove any existing edge with same target (replacing inbound), (2) find and remove any existing edge with same source (replacing outbound), (3) then add the new edge.

### Anti-Patterns to Avoid
- **Storing derived state:** Do NOT store auto-derived outputs separately from config. Always compute them from config. The `outputs` field in node data should be the result of `deriveOutputs()`.
- **Undo on every keystroke:** Do NOT push undo state on every character typed in config fields. Debounce config changes or only push on blur/field commit.
- **Blocking autosave:** Do NOT prevent user interaction during autosave. Save in background; only show status indicator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Edge animation | Custom SVG animation system | CSS `stroke-dasharray` + `stroke-dashoffset` animation on edge paths | Browser-optimized, simple, performant |
| Debounce timer | Manual setTimeout management | A simple `createDebounce` utility (3 lines) | Prevent timer leak bugs |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Already used throughout codebase |
| Keyboard shortcuts | Custom keydown tracker | Single `keydown` listener on editor root div | Keep it simple; only need Delete, Ctrl+Z, Ctrl+Shift+Z |

**Key insight:** This phase is primarily about wiring up existing patterns correctly and filling gaps in the UI. Most work is in connecting config panel fields to shared types, not in building new infrastructure.

## Common Pitfalls

### Pitfall 1: SolidFlow Store Reactivity
**What goes wrong:** Mutating SolidFlow node/edge stores incorrectly breaks reactivity. Spreading objects (`{...n, data: {...n.data, config}}`) is required; direct mutation is silent.
**Why it happens:** SolidFlow uses SolidJS stores internally. SolidJS stores track property access, not object identity.
**How to avoid:** Always use `setNodes(nodes.map(...))` pattern (already established in codebase). Never mutate node.data directly.
**Warning signs:** Config changes not reflecting on canvas nodes; undo not working.

### Pitfall 2: Auto-Output Derivation Breaking Downstream References
**What goes wrong:** When outputs are auto-derived, their IDs change, breaking `contentMapping` and `inputRefs` in downstream nodes that reference those output IDs.
**Why it happens:** If outputs are regenerated with new UUIDs on every config change, downstream VariableRef.outputId becomes stale.
**How to avoid:** Use deterministic output IDs based on config (e.g., `${nodeId}-field-${fieldId}` for input_transform, `${nodeId}-model-${modelId}` for model_call). Or, diff old and new outputs and preserve IDs for unchanged outputs.
**Warning signs:** Prompt template variables showing as "unknown" after config edit.

### Pitfall 3: Autosave Race Conditions
**What goes wrong:** Rapid edits trigger overlapping save requests. A slow save completes after a fast save, overwriting newer data with older data.
**Why it happens:** Debounce only prevents rapid fire, but doesn't prevent overlapping requests.
**How to avoid:** Use a save queue: if a save is in-flight, queue the next save. When in-flight completes, fire queued save with latest state. Alternatively, use an abort controller to cancel in-flight requests.
**Warning signs:** Edits "reverting" after save completes.

### Pitfall 4: Undo/Redo + Autosave Conflict
**What goes wrong:** Undo triggers a state change, which triggers autosave, which saves the undone state. User expects undo to be local until manual confirmation.
**Why it happens:** Autosave watches all state changes indiscriminately.
**How to avoid:** Autosave should save on undo/redo too — this is correct behavior per the user decision ("所有操作都实时自动保存"). The undo stack is purely client-side for session convenience.
**Warning signs:** None — this is actually the intended behavior per CONTEXT.md.

### Pitfall 5: Edge Deletion UX Confusion
**What goes wrong:** Users can't figure out how to select and delete edges because edges have small click targets.
**Why it happens:** SVG paths are thin (2px stroke) and hard to click precisely.
**How to avoid:** Add an invisible wider hit area (10-12px transparent stroke) behind the visible edge. SolidFlow/React Flow typically supports `interactionWidth` prop on edges.
**Warning signs:** Users complaining they can't select edges.

### Pitfall 6: ExportConfig Format Type Mismatch
**What goes wrong:** Adding "ppt" to format options but shared type still defines `format: "word" | "pdf" | "markdown"`.
**Why it happens:** Forgetting to update the shared type when adding new format options.
**How to avoid:** Update `ExportConfig.format` union type in `packages/shared/src/types.ts` FIRST, then update frontend and backend.
**Warning signs:** TypeScript errors or runtime mismatches.

## Code Examples

### Auto-Derived Outputs Function
```typescript
// Place in: packages/frontend/src/components/workflow/config/deriveOutputs.ts
import type { OutputDef, NodeConfig } from "@intelliflow/shared";

export function deriveOutputs(nodeId: string, config: NodeConfig): OutputDef[] {
  switch (config.type) {
    case "input_transform": {
      const outputs: OutputDef[] = [];
      for (const field of config.formFields) {
        if (field.type === "text" || field.type === "textarea") {
          outputs.push({
            id: `${nodeId}-field-${field.id}`,
            name: field.label || field.name,
            description: `用户输入项: ${field.label}`,
          });
        }
      }
      if (config.allowFileUpload) {
        outputs.push({
          id: `${nodeId}-file-upload`,
          name: "文件输出 (动态)",
          description: "运行时按实际上传数量展开",
        });
      }
      return outputs;
    }
    case "model_call":
      return config.modelIds.map((modelId) => ({
        id: `${nodeId}-model-${modelId}`,
        name: modelId, // Will be replaced with display name at render time
        description: "模型生成输出",
      }));
    case "desensitize":
      return [{ id: `${nodeId}-desensitized`, name: "脱敏后文本" }];
    case "restore":
      return [{ id: `${nodeId}-restored`, name: "恢复后文本" }];
    case "export":
      return [{ id: `${nodeId}-exported`, name: "导出文件" }];
  }
}
```

### Snapshot Undo/Redo Hook
```typescript
// Place in: packages/frontend/src/hooks/useUndoRedo.ts
import { createSignal } from "solid-js";

type Snapshot<T> = T;

export function createUndoRedo<T>(initial: T, maxHistory = 50) {
  const [undoStack, setUndoStack] = createSignal<Snapshot<T>[]>([]);
  const [redoStack, setRedoStack] = createSignal<Snapshot<T>[]>([]);
  const [current, setCurrent] = createSignal<T>(initial);

  function push(state: T) {
    setUndoStack((prev) => [...prev.slice(-(maxHistory - 1)), current()]);
    setRedoStack([]);
    setCurrent(() => state);
  }

  function undo(): T | null {
    const stack = undoStack();
    if (stack.length === 0) return null;
    const prev = stack[stack.length - 1];
    setUndoStack(stack.slice(0, -1));
    setRedoStack((r) => [...r, current()]);
    setCurrent(() => prev);
    return prev;
  }

  function redo(): T | null {
    const stack = redoStack();
    if (stack.length === 0) return null;
    const next = stack[stack.length - 1];
    setRedoStack(stack.slice(0, -1));
    setUndoStack((u) => [...u, current()]);
    setCurrent(() => next);
    return next;
  }

  return {
    current,
    push,
    undo,
    redo,
    canUndo: () => undoStack().length > 0,
    canRedo: () => redoStack().length > 0,
  };
}
```

### Linear Connection Enforcement
```typescript
// In WorkflowCanvas.tsx handleConnect:
function handleConnect(connection: EdgeConnection) {
  // Enforce linear: remove existing edges with same source or target
  const filtered = props.edges.filter(
    (e) => e.source !== connection.source && e.target !== connection.target
  );
  const updated = addEdge(connection, filtered as unknown as EdgeConnection[]) as unknown as WFEdge[];
  props.setEdges(updated);
}
```

### CSS Edge Flow Animation
```css
/* Add to edge SVG path via style prop */
@keyframes edge-flow {
  from { stroke-dashoffset: 24; }
  to { stroke-dashoffset: 0; }
}
.edge-animated {
  stroke-dasharray: 8 4;
  animation: edge-flow 0.6s linear infinite;
}
```

### RuntimeSettings Collapsible Component
```typescript
// Place in: packages/frontend/src/components/workflow/config/RuntimeSettings.tsx
// A shared collapsible section added to bottom of every config panel
// Fields: autoAdvance (boolean toggle), allowEdit (boolean toggle), skippable (boolean toggle)
// Defaults: autoAdvance=false, allowEdit=true, skippable=false
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual OutputsEditor | Auto-derived from config | Phase 12 | Eliminates user error, ensures runtime alignment |
| Single modelId select | modelIds[] checkbox list | Phase 12 | Enables multi-model parallel generation |
| Manual save button | Debounced autosave + status indicator | Phase 12 | Better UX, no data loss |
| No undo/redo | Snapshot-based Ctrl+Z / Ctrl+Shift+Z | Phase 12 | Standard editor expectation |
| "变量" terminology | "节点输出" terminology | Phase 12 | Aligns with Phase 5 runtime concepts |

**Deprecated/outdated:**
- `OutputsEditor.tsx`: Will be removed — replaced by auto-derivation
- `modelId` field in ModelCallConfig: Already deprecated in shared types, UI must stop using it
- `name` field in FormFieldDef: Will be auto-generated from `label`

## Open Questions

1. **SolidFlow edge selection API**
   - What we know: SolidFlow is a SolidJS port of React Flow. React Flow supports `onEdgeClick`, `edgesSelectable`, and edge selection state.
   - What's unclear: Exact API surface of `@dschz/solid-flow` for edge selection/click handling (package not available for inspection).
   - Recommendation: Test at implementation time. If SolidFlow lacks `onEdgeClick`, intercept SVG click events on the edge component directly (DataFlowEdge already renders custom SVG).

2. **SolidFlow alignment/snapping support**
   - What we know: React Flow has built-in `snapToGrid` but no alignment guides. Alignment guides require custom implementation in both React Flow and SolidFlow.
   - What's unclear: Whether SolidFlow exposes `onNodeDrag` or similar event for computing guide positions.
   - Recommendation: Implement alignment guides using `onNodeDrag` callback if available; otherwise use a MutationObserver or polling approach on node positions during drag.

3. **Prompt optimization API endpoint**
   - What we know: User wants "优化提示词" button that calls an AI model to improve the current prompt.
   - What's unclear: Whether to create a new backend endpoint or reuse existing model call infrastructure.
   - Recommendation: Create a new POST `/api/prompts/optimize` endpoint that accepts `{ promptText, modelId, metaPrompt? }` and returns optimized text. Reuse existing model call service internally.

4. **DesensitizeConfig type change scope**
   - What we know: Current type uses `ruleTypes: string[]` and `placeholderFormat: string`. New design requires `categories: Array<{ name: string; description: string }>` with system-defined placeholder format.
   - What's unclear: Whether Phase 5 runtime desensitize executor already handles the new format or needs changes.
   - Recommendation: Update shared type, update config panel, and check/update the Phase 5 desensitize executor to consume the new category structure. The placeholder format (`[TYPE_N]`) becomes a constant, not user-configurable.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: All 18 workflow-related source files read and analyzed
- `packages/shared/src/types.ts`: Shared type definitions confirming field gaps
- `packages/backend/src/modules/workflows/validation.ts`: Current validation logic analyzed
- `12-CONTEXT.md`: User decisions and constraints

### Secondary (MEDIUM confidence)
- React Flow documentation patterns (applied to SolidFlow by analogy): edge animation, alignment guides, connection enforcement
- General SolidJS reactivity patterns: store update semantics, createEffect for autosave

### Tertiary (LOW confidence)
- `@dschz/solid-flow` specific API capabilities: Package unavailable for direct inspection; inferred from imports and usage in codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies needed
- Architecture: HIGH - Clear patterns established in codebase, well-understood modification points
- Pitfalls: HIGH - Based on direct code analysis identifying specific gaps and risks
- SolidFlow edge/drag APIs: LOW - Package not available for inspection; may need experimentation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase, no external dependency changes expected)
