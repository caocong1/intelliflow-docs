---
phase: 25-export-table-rendering-system-prompt-separation
verified: 2026-03-27T00:00:00Z
status: passed
score: 8/8 must-haves verified
gaps: []
---

# Phase 25: Export Table Rendering + System Prompt Separation — Verification Report

**Phase Goal:** Upgrade Word export to render Markdown tables and support system/user prompt separation in model calls
**Verified:** 2026-03-27
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Word export renders Markdown tables as docx.Table objects with borders and bold headers | VERIFIED | `createWordTable()` (export.service.ts L213-258): `BorderStyle.SINGLE` borders color `999999`, header row uses `parseInlineFormatting()` for bold text, `ShadingType.SOLID` gray `#E8E8E8`, `tableHeader: true`, alternating rows `#F5F5F5`. Uses `WidthType.DXA` with equal `Math.floor(9000 / colCount)` distribution. |
| 2 | Word export supports ordered lists, nested lists, and code blocks | VERIFIED | `parseMarkdownToElements()` (L275-429): ordered list regex `/^(\s*)(\d+)\.\s+(.+)/` with 3-level nesting via numbering config; nested bullet regex `/^(\s+)[-*]\s+(.+)/` with 3-level nesting via `bullet: { level }`; `createCodeBlock()` (L260-270) uses `Courier New` font size 18, `ShadingType.SOLID` `#F3F4F6` gray background. |
| 3 | ModelCallConfig has optional systemPromptTemplate field | VERIFIED | `packages/shared/src/types.ts` L187: `systemPromptTemplate?: string` added to `ModelCallConfig` interface with JSDoc comment "Optional system prompt template for AI persona/role". |
| 4 | When systemPromptTemplate is set, API sends [{role:"system",...}, {role:"user",...}] two messages | VERIFIED | `openai-compatible.strategy.ts` L20-21: conditional `messages.push({ role: "system", content: resolvedSystemPrompt })` prepended, then user message always pushed. `claude-agent-sdk.strategy.ts` L40: `...(resolvedSystemPrompt && { system: resolvedSystemPrompt })` spreads top-level `system` field. |
| 5 | When systemPromptTemplate is not set, behavior unchanged (single user message) | VERIFIED | All strategy implementations check `if (resolvedSystemPrompt)` before adding system message. When undefined, code is identical to pre-change behavior. Optional parameter pattern ensures no breaking changes. |
| 6 | Both prompt templates support {{variable}} interpolation and desensitize rule injection | VERIFIED | `resolvePromptTemplate()` called twice per call path: user prompt with `desensitizeRules` (L588), system prompt with `[]` empty array (L603). Variable interpolation via `allExecs` mapping works identically for both. |
| 7 | Frontend config panel shows two text areas (System Prompt / User Prompt) for model call nodes | VERIFIED | `ModelCallConfig.tsx` L102-303: `systemPromptExpanded` signal, `hasSystemPrompt()` check, collapsible section with "+ 添加 System Prompt" button (L259-267), 50-char truncated summary (L283-287), full PromptEditor (L290-295), "移除" button (L278-279). User Prompt label conditionally shows "User Prompt" vs "提示词模板" (L304). |
| 8 | Model call logs record system and user messages separately | VERIFIED | DB schema L271: `systemPrompt: text("system_prompt")` nullable column. Migration `0008_add_model_call_logs_system_prompt.sql` adds column. `model-call-log.routes.ts` L68: API returns `systemPrompt: modelCallLogs.systemPrompt`. Frontend `ModelCallLogs.tsx` L11: interface has `systemPrompt: string | null`; L56-57: separate collapse signals; L259-293: dual collapsible sections for System Prompt and User Prompt. |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/modules/runtime/export.service.ts` | State-machine parser with table/list/code support | VERIFIED | `parseMarkdownToElements()` (NORMAL/IN_TABLE/IN_CODE_BLOCK states), `createWordTable()`, `createCodeBlock()`, `parseMarkdownTable()`, `drawPdfTable()`, `generateWordBuffer()` with numbering config, `generatePdfBuffer()` with full state machine |
| `packages/shared/src/types.ts` | systemPromptTemplate field on ModelCallConfig | VERIFIED | L187: `systemPromptTemplate?: string` |
| `packages/backend/src/db/schema.ts` | systemPrompt column on modelCallLogs | VERIFIED | L271: `systemPrompt: text("system_prompt")` |
| `packages/backend/drizzle/0008_add_model_call_logs_system_prompt.sql` | DB migration adding system_prompt column | VERIFIED | Single-line `ALTER TABLE "model_call_logs" ADD COLUMN "system_prompt" text;` |
| `packages/backend/src/modules/runtime/strategies/base.strategy.ts` | resolvedSystemPrompt optional param | VERIFIED | L34: `resolvedSystemPrompt?: string` in execute params |
| `packages/backend/src/modules/runtime/strategies/openai-compatible.strategy.ts` | Messages array with optional system role | VERIFIED | L20-21: conditional system message prepended |
| `packages/backend/src/modules/runtime/strategies/claude-agent-sdk.strategy.ts` | Top-level system param | VERIFIED | L40: spread `system` field in simple_chat; L118-119: prepend in autonomous mode |
| `packages/backend/src/modules/runtime/model-call.service.ts` | Dual resolve, pass-through, log | VERIFIED | L580-590: user prompt with desensitizeRules; L593-603: system prompt with empty array; L416,444,478: passed to strategy and logged |
| `packages/backend/src/modules/runtime/model-call.routes.ts` | System prompt resolution in routes | VERIFIED | L70-82: resolve system prompt with empty desensitize rules; L93: passed to executeModelCall |
| `packages/backend/src/modules/runtime/model-call-log.routes.ts` | API returns systemPrompt | VERIFIED | L68: `systemPrompt: modelCallLogs.systemPrompt` in select |
| `packages/frontend/src/components/workflow/config/ModelCallConfig.tsx` | Collapsible System Prompt editor | VERIFIED | L102-303: full implementation with add/expand/collapse/remove |
| `packages/frontend/src/pages/admin/ModelCallLogs.tsx` | Dual prompt display | VERIFIED | L11: interface field; L56-57: collapse signals; L259-293: dual collapsible sections |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `parseMarkdownToElements` | `generateWordBuffer` | Returns `Element[]` mixed array | WIRED | `children: parseMarkdownToElements(content)` at L465 |
| `generatePdfBuffer` | `drawPdfTable` | Inline call when table lines detected | WIRED | L548: `drawPdfTable(doc, headers, rows, startX)` inside `flushPdfTable()` |
| `model-call.routes.ts` | `resolvePromptTemplate` | Dual call for system+user prompts | WIRED | L57-67: user with desensitizeRules; L72-82: system with empty array |
| `model-call.service.ts` | `strategy.execute` | Passes resolvedSystemPrompt to strategy | WIRED | L416: `{..., resolvedSystemPrompt}` in execute; L653: in background; L887: in retry |
| `openai-compatible.strategy.ts` | `fetch` | messages array with optional system role | WIRED | L20-21: `messages.push({ role: "system", ... })`; L9: destructured from params |
| `claude-agent-sdk.strategy.ts` | `requestBody` | Top-level system field | WIRED | L40: `...(resolvedSystemPrompt && { system: resolvedSystemPrompt })` |
| `ModelCallConfig.tsx` | `props.onChange` | Updates systemPromptTemplate in config | WIRED | L264,295,278: `props.onChange({ ...props.config, systemPromptTemplate: ... })` |
| `ModelCallLogs.tsx` | `/api/admin/model-call-logs` | Reads systemPrompt from API response | WIRED | L11: `systemPrompt: string \| null` in interface; L68 backend returns field |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| EXP-TABLE | 25-01 | Word/PDF export renders Markdown tables | SATISFIED | `createWordTable()` + `drawPdfTable()` with full border, bold+gray header, alternating rows |
| EXP-LIST | 25-01 | Word/PDF export renders ordered and nested lists | SATISFIED | 3-level ordered via numbering config; 3-level nested via bullet level; PDF via indent+prefix |
| EXP-CODE | 25-01 | Word/PDF export renders fenced code blocks | SATISFIED | `createCodeBlock()` (gray bg, Courier New); PDF code block (gray rect, Courier font) |
| SYS-PROMPT-TYPE | 25-02 | systemPromptTemplate field on ModelCallConfig | SATISFIED | types.ts L187 |
| SYS-PROMPT-BACKEND | 25-02 | Backend resolves and passes system prompt | SATISFIED | Dual resolvePromptTemplate calls in routes + service |
| SYS-PROMPT-STRATEGY | 25-02 | OpenAI and Claude strategies handle system prompt | SATISFIED | OpenAI: messages array with system role; Claude: top-level system param |
| SYS-PROMPT-LOG | 25-02 | systemPrompt logged in DB | SATISFIED | DB column + migration + log inserts |
| SYS-PROMPT-UI | 25-03 | Frontend config shows collapsible System Prompt editor | SATISFIED | ModelCallConfig.tsx full implementation |
| SYS-PROMPT-LOG-UI | 25-03 | Log detail shows dual prompt sections | SATISFIED | ModelCallLogs.tsx with separate collapse signals |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | N/A | N/A | No TODO/FIXME/placeholder comments found in any implementation files. No stub implementations. All functions contain substantive logic. |

---

### Human Verification Required

None — all success criteria are verifiable programmatically via code inspection.

---

### Notable Implementation Details

**DB Migration Required:** The `0008_add_model_call_logs_system_prompt.sql` migration must be applied for system prompt logging to work. The column is nullable, so existing logs will simply have `null` for `system_prompt`.

**ROADMAP.md Stale:** The Phase 25 implementation section (L64-66, L85-87, L105-107) still shows plans 25-02 and 25-03 as `[ ]` incomplete, while the completion checklist (L272-274) correctly shows all three as `[x]`. Recommend updating the implementation section to reflect `[x]` for all three plans.

---

### Gaps Summary

None. All 8 success criteria are fully verified with substantive, wired implementations. No stubs, no missing links, no anti-patterns.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
