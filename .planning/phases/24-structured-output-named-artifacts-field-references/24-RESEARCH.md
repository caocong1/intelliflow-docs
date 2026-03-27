# Phase 24: Structured Output + Named Artifacts + Field References - Research

**Researched:** 2026-03-27
**Domain:** Model output structuring, JSON validation, named artifact parsing, nested field reference resolution
**Confidence:** HIGH

## Summary

Phase 24 extends model call nodes with three layered capabilities: (1) structured output format declaration (`outputFormat` + `jsonSchema`) with automatic JSON validation and `format_error` status, (2) named artifacts via `===OUTPUT:id===` delimiter parsing so a single model call can produce multiple independently referenceable content blocks, and (3) deep field-path resolution (`{{n3.clause_list.items[0].name}}`) for JSON outputs with tree-based selection in VariablePicker.

The foundation is already well-prepared by Phase 23, which established the `segmentKey`-based variable resolution system and the 6-level `resolveRef()` priority chain -- including a stub for `namedOutputs` at priority level 4. The `VariableRef.fieldPath` field already exists in types.ts (added in Phase 23). The primary work is: extending `ModelCallConfig` with new fields, implementing JSON validation + delimiter parsing in the backend, extending `resolveRef()` to handle `fieldPath`, and building frontend UI for format error display, named output cards, JSON schema editor, and tree-based field picker.

**Primary recommendation:** Implement in 3-4 plans: (1) shared types + backend output parsing/validation + resolveRef fieldPath, (2) frontend config UI (outputFormat/jsonSchema/namedOutputs panels), (3) frontend runtime UI (format_error display, named output cards, AI fix JSON), (4) VariablePicker tree expansion for JSON field selection. Plan 4 may merge into plan 3 if scope permits.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- JSON validation UX: auto-trigger JSON.parse after model output completes; fail marks `format_error` status immediately
- Two-layer validation when `jsonSchema` present: JSON.parse first, then schema-level validation (field types, required fields), errors displayed separately
- Error display: red error box at top of model output card with specific error message (e.g. "Line 5: Expected comma"), card border turns red
- Fix approach: default manual edit area + error hints, plus "AI Fix" button. User chooses manual or AI fix
- AI fix: calls model to attempt JSON format repair, shows before/after diff comparison, user confirms before adopting
- User clicks "Re-validate" button after manual edit to re-check
- Named artifact cards: vertical card list, each card title shows artifact name (e.g. "blueprint", "clause_list")
- Each artifact card embeds existing InlineEditor, click to edit, editing one artifact doesn't affect others
- Save updates corresponding `namedOutputs[id].content`
- Multi-model + named artifacts: group by model first (e.g. "GPT-4o" / "Claude"), then vertical named artifact cards within each group. Model comparison view aligns by artifact name
- Fallback: AI output not following `===OUTPUT:id===...===END:id===` delimiter format stores entire output as single default artifact, frontend shows yellow warning bar: "模型未按预期格式输出，已合并为单个产物"
- JSON Schema config UI: code editor (Monaco/CodeMirror) for admin to write JSON Schema directly, with syntax highlighting and basic validation
- Schema editor position: below `outputFormat` dropdown, conditionally shown when "json" selected, hidden for "text"/"markdown"
- `jsonSchema` is optional: omitted = JSON.parse syntax validation only; present = additional schema structure validation
- When `jsonSchema` present, system auto-appends Schema guidance to prompt end (similar to existing desensitize rule injection)
- Field reference picker: when upstream node has `jsonSchema`, VariablePicker shows expandable tree structure, clicking leaf node auto-generates full path (e.g. `{{n3.clause_list.items[0].name}}`)
- Array index support: fixed index (`items[0]`) and traversal syntax (`items[*].name`), traversal returns array
- `fieldPath` syntax: `key(.key)*([index](.key)*)*` where `[*]` is traversal marker

### Claude's Discretion
- Code editor specific choice (Monaco vs CodeMirror etc.)
- AI fix JSON specific calling strategy (which model, prompt design)
- Fallback strategy for field references without jsonSchema
- Card spacing, error box styling and other visual details
- `[*]` traversal specific implementation approach

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ajv | 8.x | JSON Schema validation | Industry standard, referenced in design doc; supports draft-07 and 2020-12 |
| @codemirror/lang-json | 6.x | JSON Schema editor | Lightweight, tree-shakeable; already SolidJS-compatible via vanilla JS API |
| codemirror | 6.x | Base editor framework | Modular architecture, small bundle vs Monaco's ~2MB |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @codemirror/lint | 6.x | JSON syntax error underlines in schema editor | Paired with lang-json |
| @codemirror/view | 6.x | Editor view layer | Core dependency of CodeMirror 6 |
| @codemirror/state | 6.x | Editor state management | Core dependency of CodeMirror 6 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CodeMirror 6 | Monaco Editor | Monaco is ~2MB bundled, overkill for single JSON schema field; CodeMirror 6 is ~150KB tree-shaken |
| ajv | zod / joi | ajv validates standard JSON Schema objects directly; zod/joi require schema translation |

**Installation:**
```bash
bun add ajv @codemirror/lang-json @codemirror/lint @codemirror/view @codemirror/state codemirror
```

Note: ajv is backend-only (validation in model-call.service.ts). CodeMirror packages are frontend-only.

## Architecture Patterns

### Change Topology

```
packages/shared/src/types.ts          ← ModelCallConfig fields, ModelOutput.status, NamedOutputDef type
packages/backend/src/modules/runtime/
  model-call.service.ts               ← JSON validation, delimiter parsing, resolveRef fieldPath
  model-call.routes.ts                ← revalidate endpoint, AI fix endpoint
packages/backend/src/modules/workflows/
  validation.ts                       ← namedOutputs segmentKey uniqueness
packages/frontend/src/lib/flow-engine/
  derive-outputs.ts                   ← namedOutputs → OutputDef generation
packages/frontend/src/components/workflow/config/
  ModelCallConfig.tsx                  ← outputFormat/jsonSchema/namedOutputs config UI
  JsonSchemaEditor.tsx                 ← NEW: CodeMirror-based schema editor
packages/frontend/src/components/workflow/prompt/
  VariablePicker.tsx                   ← tree expansion for JSON fields
packages/frontend/src/components/workspace/nodes/
  ModelCallExecutor.tsx                ← format_error UI, named output cards
  NamedOutputCard.tsx                  ← NEW: single named output card with InlineEditor
packages/frontend/src/components/workspace/completed/
  ModelCallCompleted.tsx               ← named output cards in completed view
```

### Pattern 1: JSON Validation Pipeline (Backend)
**What:** After model output completes, run validation pipeline before marking status
**When to use:** When `outputFormat === "json"` on the ModelCallConfig
**Example:**
```typescript
// In model-call.service.ts, after collecting model output content
function validateModelOutput(content: string, config: ModelCallConfig): {
  status: "completed" | "format_error";
  errors?: string[];
} {
  if (config.outputFormat !== "json") return { status: "completed" };

  // Layer 1: JSON.parse syntax check
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return { status: "format_error", errors: [`JSON 语法错误: ${e.message}`] };
  }

  // Layer 2: Schema validation (if jsonSchema provided)
  if (config.jsonSchema) {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(config.jsonSchema);
    if (!validate(parsed)) {
      const schemaErrors = validate.errors?.map(
        (e) => `${e.instancePath || "/"}: ${e.message}`
      ) ?? [];
      return { status: "format_error", errors: schemaErrors };
    }
  }

  return { status: "completed" };
}
```

### Pattern 2: Named Output Delimiter Parsing
**What:** Parse `===OUTPUT:id===...===END:id===` delimiters from model output into named segments
**When to use:** When `namedOutputs` array is configured on ModelCallConfig
**Example:**
```typescript
function parseNamedOutputs(
  rawContent: string,
  expectedIds: string[],
): { namedOutputs: Record<string, { content: string; format: string }>; fallback: boolean } {
  const regex = /===OUTPUT:(\w+)===\n?([\s\S]*?)===END:\1===/g;
  const parsed: Record<string, { content: string; format: string }> = {};
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawContent)) !== null) {
    const [, id, content] = match;
    parsed[id] = { content: content.trim(), format: "text" };
  }

  // Check if all expected IDs were found
  const allFound = expectedIds.every((id) => id in parsed);
  if (!allFound || Object.keys(parsed).length === 0) {
    // Fallback: store entire output as single default artifact
    return {
      namedOutputs: { _default: { content: rawContent, format: "text" } },
      fallback: true,
    };
  }

  return { namedOutputs: parsed, fallback: false };
}
```

### Pattern 3: Field Path Resolution in resolveRef
**What:** Extend existing `resolveRef()` to handle `fieldPath` for deep JSON access
**When to use:** When `ref.fieldPath` is present (e.g., `items[0].name`)
**Example:**
```typescript
function resolveFieldPath(value: unknown, fieldPath: string): string | undefined {
  // Parse fieldPath: "items[0].name" → ["items", 0, "name"]
  const segments: (string | number)[] = [];
  for (const part of fieldPath.split(".")) {
    const bracketMatch = part.match(/^(\w+)\[(\d+|\*)\]$/);
    if (bracketMatch) {
      segments.push(bracketMatch[1]);
      segments.push(bracketMatch[2] === "*" ? "*" : Number(bracketMatch[2]));
    } else {
      segments.push(part);
    }
  }

  let current: unknown = value;
  for (const seg of segments) {
    if (current == null) return undefined;
    if (seg === "*") {
      // Traversal: map over array, continue path resolution for remaining segments
      if (!Array.isArray(current)) return undefined;
      const remaining = segments.slice(segments.indexOf(seg) + 1);
      const results = current.map((item) =>
        resolveFieldPath(item, remaining.join("."))
      ).filter(Boolean);
      return JSON.stringify(results);
    }
    current = (current as Record<string, unknown>)[String(seg)];
  }

  return typeof current === "string" ? current : JSON.stringify(current);
}
```

### Pattern 4: Prompt Schema Injection
**What:** Auto-append JSON Schema guidance to prompt when `jsonSchema` is configured
**When to use:** During `resolvePromptTemplate()` when ModelCallConfig has jsonSchema
**Example:**
```typescript
// Similar to existing desensitize rule injection at end of resolvePromptTemplate
if (config.jsonSchema) {
  resolved += `\n\n请严格按照以下 JSON Schema 格式输出：\n\`\`\`json\n${JSON.stringify(config.jsonSchema, null, 2)}\n\`\`\``;
}

// For namedOutputs, inject delimiter format instructions
if (config.namedOutputs?.length) {
  const format = config.namedOutputs
    .map((o) => `===OUTPUT:${o.id}===\n[${o.name}内容]\n===END:${o.id}===`)
    .join("\n\n");
  resolved += `\n\n请按以下格式分段输出，每个产物用指定分隔符包裹：\n${format}`;
}
```

### Anti-Patterns to Avoid
- **Validating JSON during streaming:** Never try to parse partial JSON during SSE streaming. Wait for complete event, then validate.
- **Storing parsed JSON in outputData:** Store content as string, parse on demand. Avoids double-serialization issues with PostgreSQL JSONB.
- **Blocking model output on validation failure:** `format_error` is a post-completion status, not a failure. The output content is preserved for manual editing.
- **Mutating namedOutputs in-place:** Each named output card should update only its own `namedOutputs[id].content` via a PATCH-style endpoint, not rewrite the entire outputData.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom validator | ajv 8.x | Handles edge cases: $ref, oneOf, nested arrays, format keywords |
| Code editor for JSON Schema | Custom textarea with syntax highlighting | CodeMirror 6 with @codemirror/lang-json | Bracket matching, auto-indent, error gutters, proper undo/redo |
| JSON pointer/path resolution | Regex-only parser | Structured segment parser | Regex alone fails on nested brackets, escaped dots, edge cases |

**Key insight:** JSON Schema validation has hundreds of edge cases (type coercion, $ref resolution, format validation). ajv is battle-tested; a custom validator will have subtle bugs.

## Common Pitfalls

### Pitfall 1: AI Not Following Delimiter Format
**What goes wrong:** Models frequently ignore formatting instructions, especially for `===OUTPUT:id===` delimiters
**Why it happens:** LLMs treat formatting instructions as soft guidance, not hard constraints
**How to avoid:** Always implement the fallback path (store as single `_default` artifact with warning). Make the delimiter regex tolerant of minor variations (whitespace, case). Consider repeating format instructions at both start and end of prompt.
**Warning signs:** High fallback rate in production; test with multiple models during development

### Pitfall 2: JSON.parse Error Messages Are Cryptic
**What goes wrong:** Native `JSON.parse` errors say "Unexpected token < at position 42" which is unhelpful
**Why it happens:** Native parser provides minimal error context
**How to avoid:** Use the error message but also show the content around the error position. Consider a lenient JSON parser for better error messages (or at minimum, show line/column numbers by counting newlines before the error position).
**Warning signs:** Users can't find the error to fix it

### Pitfall 3: Field Path Resolution on Non-JSON Content
**What goes wrong:** `{{n3.blueprint.field}}` fails silently when blueprint content isn't JSON
**Why it happens:** Named output content could be text/markdown, not just JSON
**How to avoid:** When `fieldPath` is present, attempt `JSON.parse` on content. If parse fails, log a clear warning and return the raw `{{...}}` placeholder. Frontend VariablePicker should only show field tree for outputs where `format === "json"` or where `jsonSchema` is configured.
**Warning signs:** Unresolved `{{...}}` tokens in final prompts

### Pitfall 4: CodeMirror 6 Integration with SolidJS
**What goes wrong:** CodeMirror 6 is imperative (DOM-based), SolidJS is reactive — mismatch causes stale state or double-renders
**Why it happens:** Directly binding CodeMirror state to SolidJS signals without proper lifecycle management
**How to avoid:** Create a wrapper component that: (1) creates EditorView in `onMount`, (2) uses `createEffect` to push external value changes via `EditorView.dispatch`, (3) uses `EditorView.updateListener` to emit changes outward, (4) destroys view in `onCleanup`. Never let SolidJS re-render the container div.
**Warning signs:** Editor content resets on parent re-render, or edits don't propagate to parent state

### Pitfall 5: outputData Size Growth with Named Outputs
**What goes wrong:** `outputData` JSONB column grows large when storing multiple named outputs per model, times multiple models
**Why it happens:** N models x M named outputs x content strings all in one JSONB field
**How to avoid:** This is acceptable for the current scale (internal tool, ~5 models max, ~5 named outputs max). Monitor but don't prematurely optimize. If needed later, move content to separate storage.
**Warning signs:** Slow nodeExecution queries, large polling payloads

## Code Examples

### outputData Structure with Named Outputs
```typescript
// nodeExecution.outputData for a model_call node with namedOutputs
{
  models: {
    "model-uuid-1": {
      modelId: "model-uuid-1",
      modelDisplayName: "GPT-4o",
      content: "===OUTPUT:blueprint===\n...\n===END:blueprint===\n===OUTPUT:clause_list===\n...\n===END:clause_list===",
      status: "completed",  // or "format_error" for JSON validation failures
    }
  },
  namedOutputs: {
    "blueprint": {
      content: "...",
      format: "markdown",
      modelId: "model-uuid-1",  // which model produced this
    },
    "clause_list": {
      content: "{\"items\": [...]}",
      format: "json",
      modelId: "model-uuid-1",
    }
  },
  // format_error metadata (when applicable)
  formatErrors: {
    "model-uuid-1": ["JSON 语法错误: Unexpected token at line 5"],
  },
  selectedContent: "...",
  text: "...",
  fallbackWarning: false,  // true when delimiter parsing failed
}
```

### ModelCallConfig Extended Type
```typescript
interface ModelCallConfig {
  type: "model_call";
  displayName: string;
  stepDescription?: string;
  modelIds: string[];
  modelNames?: Record<string, string>;
  promptTemplate: string;
  inputRefs: VariableRef[];
  // Phase 24 additions:
  outputFormat?: "text" | "json" | "markdown";
  jsonSchema?: object;
  namedOutputs?: Array<{
    id: string;       // segmentKey, e.g. "blueprint"
    name: string;     // display name, e.g. "投标蓝图"
    format: "text" | "json" | "markdown";
    jsonSchema?: object;
  }>;
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
}
```

### derive-outputs.ts Extension for namedOutputs
```typescript
case "model_call":
  if (config.namedOutputs && config.namedOutputs.length > 0) {
    // Named outputs mode: each named output becomes a separate OutputDef
    return config.namedOutputs.map((no) => ({
      id: `${nodeId}-namedoutput-${no.id}`,
      name: no.name,
      description: `命名产物: ${no.name}`,
      segmentKey: no.id,
    }));
  }
  // Default: per-model outputs (existing behavior)
  return config.modelIds.map((modelId) => ({
    id: `${nodeId}-model-${modelId}`,
    name: config.modelNames?.[modelId] ?? modelId,
    description: "模型生成输出",
    segmentKey: modelId,
  }));
```

### resolveRef Extension for fieldPath
```typescript
// In resolveRef(), after finding the base value via the 6-level priority chain:
if (ref.fieldPath) {
  let rawValue: unknown;
  // For namedOutputs and models, parse .content as JSON
  if (namedOutputs?.[segmentKey]) {
    try { rawValue = JSON.parse(namedOutputs[segmentKey].content ?? ""); } catch { return undefined; }
  } else if (modelsMap?.[segmentKey]) {
    try { rawValue = JSON.parse(modelsMap[segmentKey].content ?? ""); } catch { return undefined; }
  } else {
    // For fields/direct values, try JSON.parse on the string value
    try { rawValue = JSON.parse(String(baseValue)); } catch { return undefined; }
  }
  return resolveFieldPath(rawValue, ref.fieldPath);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single text output per model | Named outputs via delimiter parsing | This phase | Multiple referenceable artifacts from one model call |
| `ModelOutput.status` = pending/streaming/completed/failed | Adds `format_error` | This phase | JSON validation failures are recoverable, not terminal |
| Flat variable reference `{{n3.segmentKey}}` | Deep field path `{{n3.segmentKey.field.path}}` | This phase | JSON outputs become composable |

**Backward compatibility:**
- No `outputFormat` / `namedOutputs` configured → existing behavior unchanged
- `resolveRef()` already has namedOutputs stub at priority 4 (Phase 23)
- `VariableRef.fieldPath` already exists in types.ts (Phase 23)

## Open Questions

1. **AI Fix JSON — which model to use?**
   - What we know: User's discretion area. Need to call a model to attempt JSON repair.
   - What's unclear: Should it use the same model that produced the error, or a different one? Should it be configurable?
   - Recommendation: Use the same model that produced the error output. Pass the original prompt + the broken output + error messages as context. This is simplest and most likely to produce compatible output. Make model selection a discretion decision during implementation.

2. **Multi-model + namedOutputs: how to store per-model named outputs?**
   - What we know: CONTEXT.md says "group by model first, then named artifacts within each group"
   - What's unclear: Should `namedOutputs` in outputData be per-model or global? If user selects model A's output, should named outputs reflect model A's artifacts?
   - Recommendation: Store `namedOutputs` keyed by `{namedOutputId}` with a `modelId` field indicating source. When user selects a model, the displayed named outputs filter to that model's artifacts. The variable reference `{{n3.blueprint}}` resolves to the *selected* model's blueprint (via `selectedOutputKey`).

3. **VariablePicker tree for schemas without jsonSchema**
   - What we know: CONTEXT.md says "无 jsonSchema 时的处理方式由 Claude 根据实现复杂度决定"
   - What's unclear: Should we try to infer structure from actual output content?
   - Recommendation: Without `jsonSchema`, show flat output reference only (no tree expansion). This is simple and avoids runtime content parsing in the editor. Users can still manually type `{{n3.output.field}}` paths — they just won't get picker assistance.

## Sources

### Primary (HIGH confidence)
- `packages/shared/src/types.ts` — current type definitions, ModelOutput.status, VariableRef with fieldPath stub
- `packages/backend/src/modules/runtime/model-call.service.ts` — resolveRef() with 6-level priority chain including namedOutputs stub
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` — current OutputDef derivation for model_call nodes
- `docs/design/flow-node-capability-analysis.md` Section 3 Gap #3 — full design specification
- `24-CONTEXT.md` — user decisions from discuss-phase

### Secondary (MEDIUM confidence)
- ajv library: well-known JSON Schema validator, API is stable (training knowledge verified by widespread ecosystem usage)
- CodeMirror 6: modular editor framework, verified by project's existing pattern of using vanilla JS libraries with SolidJS wrappers

### Tertiary (LOW confidence)
- `[*]` array traversal syntax implementation: no established library for this exact syntax; will need custom implementation. The syntax is custom to this project.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ajv is the clear choice for JSON Schema validation; CodeMirror 6 is the lightweight choice for code editing
- Architecture: HIGH - design doc is detailed, existing code has stubs (resolveRef namedOutputs, VariableRef.fieldPath), patterns are clear extensions of Phase 23 work
- Pitfalls: HIGH - based on direct code analysis of existing patterns and known LLM behavior with structured output

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain, no external dependency changes expected)
