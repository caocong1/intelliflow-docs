# Phase 25: Export Table Rendering + System Prompt Separation - Research

**Researched:** 2026-03-27
**Domain:** Word/PDF export rich-text rendering + Model call system/user prompt separation
**Confidence:** HIGH

## Summary

This phase has two distinct work streams: (1) upgrading the Word and PDF export pipeline to render Markdown tables, ordered lists, nested lists, and code blocks; (2) adding system prompt support to the model call pipeline end-to-end (type definition, backend resolution, strategy dispatch, DB logging, frontend config, frontend log display).

The codebase is well-structured for both changes. The `parseMarkdownToParagraphs()` function in `export.service.ts` is a simple line-by-line Markdown-to-docx converter that currently handles headings, bullet lists, inline bold/italic, and blank lines. It processes content line-by-line, making it straightforward to add table detection (pipe-delimited lines), ordered list detection (`/^\d+\./`), nested list detection (indentation), and code block detection (triple backtick fences). The `docx` library (v9.6.1) already provides `Table`, `TableRow`, `TableCell`, `BorderStyle`, `ShadingType`, and `WidthType` exports. PDFKit (v0.18.0) supports table drawing via its low-level rect/text/line API.

For the system prompt work, the strategy pattern (`ModelCallStrategy` interface) currently accepts a single `resolvedPrompt` string. The interface needs extending to accept an optional `resolvedSystemPrompt`. Each strategy then handles it natively: OpenAI-compatible prepends a `{role:"system"}` message, Claude/Anthropic uses the top-level `system` parameter.

**Primary recommendation:** Implement export rendering first (no cross-cutting concerns), then system prompt (touches types, backend, DB, frontend).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Word export uses business-formal style: full borders, bold+gray header row, alternating row colors
- PDF export also upgraded with same table rendering capabilities
- Support ordered lists (1. 2. 3.), 3-level nested lists (including mixed nesting)
- System Prompt uses collapsible layout: collapsed by default, User Prompt always visible
- System Prompt empty -> hidden, shows "+ Add System Prompt" button
- System Prompt with value -> collapsed shows first 50 chars summary
- Both Prompt textareas support `{{nodeId.outputId}}` variable insertion (VariablePicker + PromptEditor)
- Existing `promptTemplate` auto-treated as `userPromptTemplate` -- backward compatible, no migration needed
- Desensitize rules only injected into User Prompt tail, System Prompt stays clean
- OpenAI Compatible: uses `[{role:"system",...}, {role:"user",...}]` messages array
- Claude/Anthropic: uses top-level `system` param + `[{role:"user",...}]` messages (native Anthropic way)
- Model call logs show "System Prompt" and "User Prompt" as collapsible sections
- DB modelCallLogs table gets new `systemPrompt` column

### Claude's Discretion
- Code block rendering approach (gray background monospace vs plain monospace)
- PDF table drawing implementation details
- Whether `prompt` field gets renamed to `userPrompt` (evaluate impact)
- Log collapse section UI details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| docx | ^9.6.1 | Word document generation | Already in use, Table/TableRow/TableCell/BorderStyle/ShadingType available |
| pdfkit | ^0.18.0 | PDF generation | Already in use, low-level drawing API for tables |
| SolidJS | (project standard) | Frontend UI | Already used throughout the frontend |

### Additional Imports Needed from docx
| Export | Purpose |
|--------|---------|
| `Table` | Table container |
| `TableRow` | Row container |
| `TableCell` | Cell container with borders/shading |
| `BorderStyle` | Border style enum (SINGLE, DOUBLE, etc.) |
| `ShadingType` | Cell shading (SOLID for fill colors) |
| `WidthType` | Column width type (PERCENTAGE, DXA) |
| `TableLayoutType` | Fixed vs auto table layout |
| `VerticalAlign` | Cell vertical alignment |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual markdown table parsing | unified/remark-gfm | Over-engineered for pipe-delimited tables; adds dependency |
| pdfkit manual drawing | pdfkit-table plugin | Extra dependency; pdfkit manual approach is ~50 lines and gives full control |

## Architecture Patterns

### Export Service Extension Points

The current `parseMarkdownToParagraphs()` (L155-204) processes content line-by-line. The extension strategy is to switch from pure line-by-line to a **state machine** that can accumulate multi-line blocks:

```
States: NORMAL, IN_TABLE, IN_CODE_BLOCK
Transitions:
  NORMAL + pipe-line -> IN_TABLE (start accumulating rows)
  IN_TABLE + non-pipe-line -> NORMAL (flush table, process line normally)
  NORMAL + ``` -> IN_CODE_BLOCK (start accumulating code)
  IN_CODE_BLOCK + ``` -> NORMAL (flush code block)
```

### Pattern: Markdown Table Parsing

Markdown tables follow this format:
```
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
```

Parsing approach:
1. Detect lines starting with `|`
2. Accumulate consecutive pipe-delimited lines
3. Identify separator row (contains `---`) to distinguish header from body
4. Split cells by `|`, trim whitespace
5. Apply inline formatting (`parseInlineFormatting()`) to each cell's content

### Pattern: Strategy Interface Extension for System Prompt

Current interface:
```typescript
// base.strategy.ts
interface ModelCallStrategy {
  execute(params: {
    model: ModelCallInput;
    resolvedPrompt: string;        // <-- currently single prompt
    sendEvent: (event: SSEEvent) => void;
  }): Promise<ModelCallResult>;
}
```

Extended interface:
```typescript
interface ModelCallStrategy {
  execute(params: {
    model: ModelCallInput;
    resolvedPrompt: string;
    resolvedSystemPrompt?: string;  // <-- NEW optional field
    sendEvent: (event: SSEEvent) => void;
  }): Promise<ModelCallResult>;
}
```

This is backward-compatible: existing calls without `resolvedSystemPrompt` continue to work.

### Pattern: Prompt Resolution Flow

Current flow (single prompt):
```
mcConfig.promptTemplate -> resolvePromptTemplate(template, ..., desensitizeRules) -> resolvedPrompt
```

New flow (dual prompt):
```
mcConfig.promptTemplate -> resolvePromptTemplate(template, ..., desensitizeRules) -> resolvedUserPrompt
mcConfig.systemPromptTemplate -> resolvePromptTemplate(template, ..., []) -> resolvedSystemPrompt
                                                              // ^^ no desensitize rules for system prompt
```

Key: `resolvePromptTemplate()` is already a pure function that takes a template string. Call it twice -- once for user prompt (with desensitize rules), once for system prompt (with empty rules array).

### Anti-Patterns to Avoid
- **Mixing table state into line-by-line loop**: Don't try to detect and render tables in a single pass without state accumulation. Tables are multi-line constructs.
- **Renaming `promptTemplate` to `userPromptTemplate` in the type**: This would break existing saved workflows. Keep `promptTemplate` as-is and add `systemPromptTemplate` alongside it.
- **Passing system prompt as part of resolvedPrompt string**: Each strategy must handle system prompt natively via its API format.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown table parsing | Full markdown AST parser | Simple pipe-split regex | Our tables are simple GFM format, no need for remark/unified |
| docx table styling | Low-level OOXML manipulation | docx library Table/TableRow/TableCell with BorderStyle/ShadingType | Library handles all XML generation |
| PDF table drawing | External table library | PDFKit rect/line/text primitives | ~50 lines, full control over styling |

## Common Pitfalls

### Pitfall 1: Markdown Table Separator Row
**What goes wrong:** Including the `|---|---|` separator row as a data row in the rendered table.
**Why it happens:** Treating all pipe-delimited lines uniformly.
**How to avoid:** After accumulating table lines, identify the separator row (matches `/^\|[\s\-:|]+\|$/`) and skip it. Lines before separator = header, lines after = body.
**Warning signs:** Extra empty/dashed row in rendered tables.

### Pitfall 2: docx Table Column Width
**What goes wrong:** Tables render with unpredictable column widths in Word.
**Why it happens:** Not specifying `width` on TableCell or using AUTO layout.
**How to avoid:** Calculate equal percentage widths based on column count. Use `WidthType.PERCENTAGE` with value like `Math.floor(100 / colCount)`.

### Pitfall 3: PDFKit Page Overflow for Large Tables
**What goes wrong:** Table rows overflow the page bottom without page break.
**Why it happens:** PDFKit doesn't auto-paginate custom-drawn content.
**How to avoid:** Track Y position; when approaching page bottom (`doc.y + rowHeight > doc.page.height - margin`), call `doc.addPage()`.

### Pitfall 4: Nested List Indentation Detection
**What goes wrong:** Nested lists not detected or wrong nesting level.
**Why it happens:** Mixed tabs/spaces in markdown content from LLM output.
**How to avoid:** Count leading whitespace; 2-4 spaces = level 1, 4-8 spaces = level 2. Be tolerant of both tabs and spaces.

### Pitfall 5: Code Block False Positive
**What goes wrong:** Lines starting with ``` inside normal text trigger code block mode.
**Why it happens:** LLM output may include backticks in various contexts.
**How to avoid:** Require ``` at the start of a line (after optional whitespace) for code fence detection.

### Pitfall 6: Strategy Backward Compatibility
**What goes wrong:** Existing model calls break when system prompt is undefined.
**Why it happens:** Not handling the optional `resolvedSystemPrompt` gracefully.
**How to avoid:** In each strategy, check `if (resolvedSystemPrompt)` before adding system message. When absent, behavior is identical to current code.

### Pitfall 7: DB Column Addition Without Default
**What goes wrong:** Adding a NOT NULL column to existing table fails.
**Why it happens:** Existing rows have no value for the new column.
**How to avoid:** The `systemPrompt` column must be nullable (`text("system_prompt")` without `.notNull()`). Existing logs have no system prompt, which is correct.

## Code Examples

### Word Table Rendering (docx v9.6.1)

```typescript
// Source: docx library API + project styling decisions
import { Table, TableRow, TableCell, Paragraph, TextRun, BorderStyle, ShadingType, WidthType } from "docx";

function createWordTable(headers: string[], rows: string[][]): Table {
  const colWidth = Math.floor(9000 / headers.length); // DXA units, ~full page width

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "999999",
  };
  const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  // Header row: bold text, gray background
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        children: [new Paragraph({ children: parseInlineFormatting(h) })],
        borders,
        shading: { type: ShadingType.SOLID, color: "E8E8E8" },
        width: { size: colWidth, type: WidthType.DXA },
      }),
    ),
  });

  // Data rows with alternating shading
  const dataRows = rows.map((row, rowIdx) =>
    new TableRow({
      children: row.map((cell) =>
        new TableCell({
          children: [new Paragraph({ children: parseInlineFormatting(cell) })],
          borders,
          shading: rowIdx % 2 === 1
            ? { type: ShadingType.SOLID, color: "F5F5F5" }
            : undefined,
          width: { size: colWidth, type: WidthType.DXA },
        }),
      ),
    }),
  );

  return new Table({ rows: [headerRow, ...dataRows] });
}
```

### Ordered List in docx

```typescript
// docx supports numbered lists via the numbering API
import { Paragraph, TextRun } from "docx";

// Ordered list item: use numbering reference
new Paragraph({
  children: [new TextRun({ text: "List item text" })],
  numbering: { reference: "ordered-list", level: 0 },
});

// Nested (level 1):
new Paragraph({
  children: [new TextRun({ text: "Nested item" })],
  numbering: { reference: "ordered-list", level: 1 },
});
```

Note: The Document must define a numbering config in its constructor:
```typescript
const doc = new Document({
  numbering: {
    config: [{
      reference: "ordered-list",
      levels: [
        { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START },
        { level: 1, format: "decimal", text: "%1.%2.", alignment: AlignmentType.START },
        { level: 2, format: "decimal", text: "%1.%2.%3.", alignment: AlignmentType.START },
      ],
    }],
  },
  sections: [{ children: paragraphs }],
});
```

### PDFKit Table Drawing

```typescript
// Source: PDFKit API
function drawPdfTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], startX: number) {
  const colWidth = (doc.page.width - 100) / headers.length;
  const rowHeight = 25;
  const margin = 50;
  let y = doc.y;

  function drawRow(cells: string[], isHeader: boolean, rowIdx: number) {
    // Check page overflow
    if (y + rowHeight > doc.page.height - margin) {
      doc.addPage();
      y = margin;
    }

    cells.forEach((cell, i) => {
      const x = startX + i * colWidth;
      // Background
      if (isHeader) {
        doc.rect(x, y, colWidth, rowHeight).fill("#E8E8E8").stroke();
      } else if (rowIdx % 2 === 1) {
        doc.rect(x, y, colWidth, rowHeight).fill("#F5F5F5").stroke();
      }
      // Border
      doc.rect(x, y, colWidth, rowHeight).stroke("#999999");
      // Text
      const font = isHeader ? "Helvetica-Bold" : "Helvetica";
      doc.font(font).fontSize(10).fillColor("#333333")
        .text(cell.trim(), x + 4, y + 6, { width: colWidth - 8, height: rowHeight - 8 });
    });
    y += rowHeight;
  }

  drawRow(headers, true, -1);
  rows.forEach((row, idx) => drawRow(row, false, idx));
  doc.y = y + 10;
}
```

### System Prompt in OpenAI-Compatible Strategy

```typescript
// Extension to openai-compatible.strategy.ts
const messages: Array<{ role: string; content: string }> = [];

if (resolvedSystemPrompt) {
  messages.push({ role: "system", content: resolvedSystemPrompt });
}
messages.push({ role: "user", content: resolvedPrompt });

const body: Record<string, unknown> = {
  model: model.modelId,
  messages,
  stream: true,
};
```

### System Prompt in Claude/Anthropic Strategy

```typescript
// Extension to claude-agent-sdk.strategy.ts (simple_chat mode)
const requestBody: Record<string, unknown> = {
  model: model.modelId,
  messages: [{ role: "user", content: resolvedPrompt }],
  max_tokens: model.maxTokens ?? 4096,
  stream: true,
};

// Native Anthropic system prompt: top-level "system" field
if (resolvedSystemPrompt) {
  requestBody.system = resolvedSystemPrompt;
}
```

## Integration Points Map

### Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `packages/shared/src/types.ts` L161-182 | Add `systemPromptTemplate?: string` to `ModelCallConfig` | Type-only, backward compatible |
| `packages/backend/src/db/schema.ts` L253-286 | Add `systemPrompt: text("system_prompt")` to `modelCallLogs` table | Schema change, needs migration |
| `packages/backend/src/modules/runtime/strategies/base.strategy.ts` | Add `resolvedSystemPrompt?: string` to execute params | Interface extension |
| `packages/backend/src/modules/runtime/strategies/openai-compatible.strategy.ts` | Build messages array with optional system message | ~5 lines changed |
| `packages/backend/src/modules/runtime/strategies/claude-agent-sdk.strategy.ts` | Add `system` field to request body when present | ~3 lines in simple_chat, ~2 lines in autonomous |
| `packages/backend/src/modules/runtime/model-call.service.ts` | Dual-resolve system+user prompts, pass both to strategy, log systemPrompt | Multiple functions: resolvePromptTemplate calls, executeModelCall, executeModelCallBackground, retryModelCall |
| `packages/backend/src/modules/runtime/model-call.routes.ts` | Pass systemPromptTemplate through resolution flow | ~10 lines in execute and retry routes |
| `packages/backend/src/modules/runtime/export.service.ts` | Replace `parseMarkdownToParagraphs` with state-machine parser, add table/list/code rendering | Major rewrite of L155-282 |
| `packages/frontend/src/components/workflow/config/ModelCallConfig.tsx` | Add collapsible System Prompt editor section | ~50 lines UI addition |
| `packages/frontend/src/pages/admin/ModelCallLogs.tsx` | Show system/user prompts as separate collapsible sections | ~30 lines UI change |

### DB Migration

New migration file: `0008_add_model_call_logs_system_prompt.sql`
```sql
ALTER TABLE "model_call_logs" ADD COLUMN "system_prompt" text;
```

Pattern matches existing migration style (see `0007_add_document_files_slot_id.sql`).

### Backward Compatibility Analysis

| Concern | Resolution |
|---------|------------|
| Existing workflows have `promptTemplate` but no `systemPromptTemplate` | `systemPromptTemplate` is optional (`?:`). When undefined, behavior is identical to current code. |
| Existing model call logs have no system prompt | New `system_prompt` column is nullable. Old logs show `null`. |
| Existing strategies receive no `resolvedSystemPrompt` | Optional parameter, strategies check `if (resolvedSystemPrompt)` before using. |
| `promptTemplate` field naming | Keep as-is. Adding `systemPromptTemplate` alongside is clear. No rename needed. |

### Recommendation on Claude's Discretion Items

1. **Code block rendering**: Use gray background (`#F3F4F6`) + monospace font (`Courier New` in docx, `Courier` in PDFKit). This matches the business-formal style of the rest of the document.

2. **PDF table implementation**: Use the manual rect/line/text approach shown in code examples above. No external library needed.

3. **`prompt` field rename to `userPrompt`**: **Do NOT rename.** The `promptTemplate` field is referenced in 10+ files across frontend/backend. The `resolvedPrompt` field is in the DB schema, strategies, routes, and log insertion. Renaming would be a Phase 17-style tech debt migration with no user-facing benefit. The naming `promptTemplate` (user) + `systemPromptTemplate` (system) is unambiguous.

4. **Log collapse UI**: Use SolidJS `Show` with a toggle signal. System prompt section hidden when null. Use the same expand/collapse pattern already used in the log detail row (`expandedId` signal pattern).

## Open Questions

1. **Ordered list numbering config scope**
   - What we know: docx requires a `numbering` config at Document level to support `numbering.reference` in Paragraphs
   - What's unclear: Whether the numbering config needs to also handle unordered bullet lists or if the existing `bullet: { level: 0 }` approach still works alongside
   - Recommendation: Test that `bullet` and `numbering` can coexist. They use different mechanisms in OOXML and should not conflict.

2. **PDFKit Chinese font support in tables**
   - What we know: PDFKit's built-in fonts (Helvetica, Courier) don't support CJK characters
   - What's unclear: Whether the project already has a CJK font registered for PDFKit
   - Recommendation: Check if the current PDF export handles Chinese text. If it uses Helvetica only, table content with Chinese characters will render as tofu. This is a pre-existing issue, not specific to this phase, but worth noting.

## Sources

### Primary (HIGH confidence)
- Project source code: `export.service.ts`, `model-call.service.ts`, `base.strategy.ts`, `openai-compatible.strategy.ts`, `claude-agent-sdk.strategy.ts`, `types.ts`, `schema.ts`, `ModelCallConfig.tsx`, `ModelCallLogs.tsx`, `PromptEditor.tsx`, `VariablePicker.tsx`, `model-call.routes.ts`
- [docx npm package](https://www.npmjs.com/package/docx) - v9.6.1 Table/Border/Shading API
- [docx table cell borders demo](https://github.com/dolanmiu/docx/blob/master/demo/20-table-cell-borders.ts) - BorderStyle usage
- [docx tables documentation](https://github.com/dolanmiu/docx/blob/master/docs/usage/tables.md) - Table/TableRow/TableCell API
- [ShadingType API](https://docx.js.org/api/variables/ShadingType.html) - Cell shading options
- [WidthType API](https://docx.js.org/api/variables/WidthType.html) - Column width types

### Secondary (MEDIUM confidence)
- Anthropic Messages API `system` parameter - based on known API behavior, verified in current `claude-agent-sdk.strategy.ts` request structure
- OpenAI chat completions `messages` array with `role: "system"` - well-established API pattern

## Metadata

**Confidence breakdown:**
- Export rendering (Word): HIGH - docx library API is well-documented, project already uses it
- Export rendering (PDF): HIGH - PDFKit primitives are straightforward
- System prompt strategy adaptation: HIGH - read both strategy implementations, changes are minimal
- System prompt DB/type changes: HIGH - read schema and types, changes are additive
- Frontend system prompt UX: HIGH - read ModelCallConfig.tsx and PromptEditor.tsx, reusable components exist

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable libraries, no fast-moving dependencies)
