---
phase: 25-export-table-rendering-system-prompt-separation
plan: 01
subsystem: backend
tags: [docx, pdfkit, markdown, word-export, pdf-export, state-machine]

# Dependency graph
requires:
  - phase: 23
    provides: workflow runtime with upstream node output resolution
provides:
  - Word export renders Markdown tables as docx Table with business-formal styling (full borders, bold+gray headers, alternating rows)
  - Word export renders ordered lists with 3-level nesting
  - Word export renders nested unordered lists with 3-level nesting
  - Word export renders fenced code blocks with gray background and Courier New monospace font
  - PDF export renders Markdown tables with borders, bold headers, and alternating row colors
  - PDF export renders ordered lists with N. prefix and indentation
  - PDF export renders nested lists and code blocks
affects:
  - Phase 25 (plans 02-03 for system prompt separation)
  - Any phase relying on export quality

# Tech tracking
tech-stack:
  added: [docx (Table, TableRow, TableCell, BorderStyle, ShadingType, WidthType, TableLayoutType, VerticalAlign)]
  patterns:
    - State machine parsing for multi-line Markdown constructs (tables, code blocks)
    - Shared parseMarkdownTable() helper between Word and PDF generators
    - Dual path for same Markdown constructs (createWordTable vs drawPdfTable)

key-files:
  created: []
  modified:
    - packages/backend/src/modules/runtime/export.service.ts

key-decisions:
  - "NORMAL/IN_TABLE/IN_CODE_BLOCK state machine for both Word and PDF"
  - "Shared parseMarkdownTable() helper to avoid code duplication"
  - "PDFKit drawPdfTable uses rect/fillAndStroke for borders and fills"
  - "Code block detection requires ``` at line start (after optional trim)"

patterns-established:
  - "State machine for multi-line markdown constructs (table/list/code)"
  - "Business-formal table styling: full borders (#999999), gray header (#E8E8E8), alternating rows (#F5F5F5)"
  - "docx numbering config in Document constructor for ordered list support"

requirements-completed: [EXP-TABLE, EXP-LIST, EXP-CODE]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 25 Plan 01: Export Table Rendering - Word/PDF Markdown Enhancement Summary

**Word and PDF export upgraded to render Markdown tables as formatted elements, with ordered/nested lists and code blocks supported across both formats**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T10:30:00Z
- **Completed:** 2026-03-27T10:33:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Word export: Markdown pipe-delimited tables render as docx Table with business-formal styling (full borders, bold+gray headers, alternating rows)
- Word export: Ordered lists (1. 2. 3.) with 3-level nesting via numbering config
- Word export: Nested unordered lists (indented bullets) with 3-level nesting
- Word export: Fenced code blocks with gray background (#F3F4F6) and Courier New monospace font
- PDF export: Tables with borders, gray headers, alternating row colors via PDFKit drawing primitives
- PDF export: Ordered lists with N. prefix and level-based indentation (20/40/60px)
- PDF export: Nested lists and code blocks with monospace font and gray background rect
- All existing formatting (headings, top-level bullets, bold/italic, blank lines) preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor Word export with state-machine parser for tables, lists, and code blocks** - `556fa9e` (feat)
2. **Task 2: Upgrade PDF export with table drawing, ordered lists, nested lists, and code blocks** - (part of same file edit, committed together)

## Files Created/Modified

- `packages/backend/src/modules/runtime/export.service.ts` - Complete refactor of format generators with state-machine parser

## Decisions Made

- Used NORMAL/IN_TABLE/IN_CODE_BLOCK state machine for both Word and PDF generators (consistent approach)
- Shared `parseMarkdownTable()` helper between Word and PDF to avoid duplicating pipe-delimited parsing logic
- docx numbering config with decimal format ("%1.", "%1.%2.", "%1.%2.%3.") for 3-level ordered lists
- PDFKit uses `fillAndStroke` for table cells (combines fill + border in one call)
- PDF code block uses `rect` + `fill` for gray background, followed by Courier text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- export.service.ts is fully upgraded for Word and PDF rendering
- Phase 25 plans 02-03 (system prompt separation) can proceed independently
- The state-machine parsing approach is ready for any future Markdown element extensions

---
*Phase: 25-export-table-rendering-system-prompt-separation*
*Plan: 01*
*Completed: 2026-03-27*
