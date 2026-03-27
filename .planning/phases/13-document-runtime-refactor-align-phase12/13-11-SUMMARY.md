---
phase: 13
plan: 11
status: completed
started: 2026-03-27T10:00:00Z
completed: 2026-03-27T10:35:00Z
---

## Summary

Re-ran UAT tests for Phase 13 to verify the 2 gap fixes from Plan 13-10 (progress display + desensitize upstream data). All previously-failed tests now pass. Additionally discovered and fixed a bug where `isGenerationActive` incorrectly treated user-input nodes (input_transform, desensitize) as background generation, which prevented the executor form from rendering.

## Key Results

- **Test 3 (Progress display):** PASS — Document list shows `进度: N/M · 节点名` for in-progress documents
- **Test 5 (Desensitize upstream data):** PASS — Upstream text received, auto-detection triggered, found 5 sensitive items
- **Tests 6, 7, 10, 11, 16:** PASS — Full pipeline (InputTransform → Desensitize → ModelCall → Restore → Export) verified on completed document
- **Test 16 (Auto-save):** PASS — `已自动保存` indicator confirmed in action bars

## Additional Fix

- **isGenerationActive bug:** `DocumentWorkspace.tsx:isGenerationActive()` returned `true` for any `in_progress` node, including `input_transform` and `desensitize` nodes waiting for user input. This blocked the executor form from rendering. Fixed to exclude user-input node types at the current step index.

## UAT Final Score

- **20 tests total:** 14 passed, 0 issues, 6 skipped (infrastructure limitations: no multi-model workflow, no network simulation, no canvas drag)
- **Both gaps:** resolved

## Infrastructure Fix

- **Port conflict:** Changed backend port from 4001 to 14001 to avoid conflict with QQ app on localhost:4001. Updated `packages/backend/src/index.ts`, `packages/frontend/vite.config.ts`, and `CLAUDE.md`.

## Key Files

### Modified
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` — Fixed `isGenerationActive` to exclude user-input nodes
- `packages/backend/src/index.ts` — Port change 4001 → 14001
- `packages/frontend/vite.config.ts` — Proxy target port change
- `CLAUDE.md` — Updated port documentation
- `.planning/phases/13-document-runtime-refactor-align-phase12/13-UAT.md` — Updated all test results

## Deviations

- Found and fixed `isGenerationActive` bug not covered in original plan — this was blocking the executor form for input_transform and desensitize nodes
- Port change from 4001 to 14001 due to QQ app conflict (not in original plan scope)
