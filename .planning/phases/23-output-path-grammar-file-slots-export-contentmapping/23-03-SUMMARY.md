---
phase: 23-output-path-grammar-file-slots-export-contentmapping
plan: 03
subsystem: ui
tags: [InputTransformConfig, ExportConfig, VariablePicker, PromptEditor, InputTransformExecutor, machineKey, fileSlot, contentMapping]
---

# Summary: 23-03 — Frontend UI for Output Path Grammar, File Slots & Export ContentMapping

## What was built

### Task 1: InputTransformConfig + VariablePicker + PromptEditor
- **InputTransformConfig.tsx**: Collapsible advanced settings per form field with machineKey validation, cross-type collision detection, fileSlotId/fileSlotLabel for file fields, dot indicator badge
- **VariablePicker.tsx**: Type icons (T text, folder file slot, robot model, lock/unlock desensitize/restore), segmentKey-based selection, grouped by node
- **PromptEditor.tsx**: Label chips display `nodeLabel.outputName`, store `{{nodeId.segmentKey}}`, backward compat lookup

### Task 2: InputTransformExecutor + ExportConfig contentMapping
- **InputTransformExecutor.tsx**: Independent file slot cards with labels, "other files" area, slotId in confirm payload, backward compatible
- **ExportConfig.tsx**: ContentMapping with VariablePicker selection, drag-reorderable list, order numbers, readable labels, remove buttons

### Task 3: Visual verification via Playwright
- All UI elements verified through Playwright browser automation
- Two bugs discovered and fixed:
  - `contentMapping` undefined crash on existing export nodes (added `?? []` default)
  - `resolveLabel` showing nodeId instead of node label (removed early `variableName` return)

## Commits

| Commit | Description |
|--------|-------------|
| `7fe7ddb` | feat(23-03): add advanced settings, type icons, and segmentKey-based variable selection |
| `e9056d8` | feat(23-03): add file slot cards in executor and contentMapping drag reorder in export config |
| `2a2f477` | fix(23-03): guard ExportConfig contentMapping against undefined and fix resolveLabel display |

## Files Modified

- `packages/frontend/src/components/workflow/config/InputTransformConfig.tsx`
- `packages/frontend/src/components/workflow/config/ExportConfig.tsx`
- `packages/frontend/src/components/workflow/prompt/VariablePicker.tsx`
- `packages/frontend/src/components/workflow/prompt/PromptEditor.tsx`
- `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx`

## Decisions

- [23-03]: ExportConfig `mapping()` accessor with `?? []` for backward compat with existing export nodes lacking contentMapping
- [23-03]: resolveLabel always resolves from upstream node data for correct node label display
