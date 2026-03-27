---
phase: 26-conditional-node-execution
plan: "03"
subsystem: ui
tags: [conditional-execution, node-block, rollback, solidjs]

# Dependency graph
requires:
  - phase: "26-01"
    provides: "NodeCondition/NodeExecutionRule types, 'blocked' status in NodeExecutionStatus, conditions.service.ts, advanceNode/background pipeline with skip/block"
provides:
  - "Blocked node display with red inline warning card and rollback button"
  - "StepperBar red circle + '(已阻断)' label for blocked nodes"
  - "NodeHistoryPanel '已阻断' badge and conditional skip vs user skip differentiation"
  - "DocumentWorkspace blocked Match case, hasBlockedNodes memo, handleBlockedRollback from workflowNodes executionRule"
affects:
  - "Phase 26-02 (condition configuration UI uses same executionRule types)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BlockedNodeCard as pure display component — onRollback delegates to parent, no config access"
    - "Rollback target computed in DocumentWorkspace by reading workflowNodes executionRule.conditions, finding earliest sourceRef by stepOrder"
    - "Conditional skip vs user skip differentiation via outputData.skipType field"

key-files:
  created:
    - "packages/frontend/src/components/workspace/nodes/BlockedNodeCard.tsx"
  modified:
    - "packages/frontend/src/components/workspace/StepperBar.tsx"
    - "packages/frontend/src/components/workspace/NodeHistoryPanel.tsx"
    - "packages/frontend/src/pages/workspace/DocumentWorkspace.tsx"

key-decisions:
  - "BlockedNodeCard is pure display — parent (DocumentWorkspace) computes rollback target from workflowNodes config"
  - "handleBlockedRollback uses executionRule.conditions sourceRef.nodeId values, sorts by stepOrder, picks earliest"
  - "Conditional skip shows '条件跳过', manual skip shows '用户跳过' — both stored in outputData.skipType"

patterns-established:
  - "getNodeBadge() helper in NodeHistoryPanel handles blocked/skipped status label differentiation"
  - "isAllCompleted already correctly excludes 'blocked' (not in completed/skipped list)"
  - "hasBlockedNodes guard added to current-node Match so blocked nodes don't render as active executors"

requirements-completed: [COND-05, COND-06, COND-07]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 26 Plan 03: Conditional Node Execution - Workspace Display Summary

**Blocked node UI with red inline warning card, rollback to earliest upstream source, and conditional skip differentiation from manual skip**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T14:23:01+08:00
- **Completed:** 2026-03-27T14:27:35+08:00
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 3

## Accomplishments

- StepperBar shows red (#ef4444) circle and "(已阻断)" status label for blocked nodes; red connecting line
- NodeHistoryPanel displays "已阻断" error badge; `getNodeBadge()` differentiates conditional skip ("条件跳过") from manual skip ("用户跳过")
- BlockedNodeCard.tsx: inline red warning card with block reason and "返回修改上游" button calling onRollback (pure display, no config access)
- DocumentWorkspace: `hasBlockedNodes` memo, `handleBlockedRollback()` computing target from `workflowNodes` executionRule.conditions, blocked Match case in view Switch, blocked icon + reason in background progress list

## Task Commits

1. **Task 1: StepperBar + NodeHistoryPanel blocked status styling** - `d933810` (feat)
2. **Task 2: BlockedNodeCard + DocumentWorkspace integration** - `9355594` (feat)

## Files Created/Modified

- `packages/frontend/src/components/workspace/StepperBar.tsx` - Red circle + line for blocked status, "(已阻断)" label
- `packages/frontend/src/components/workspace/NodeHistoryPanel.tsx` - "已阻断" error badge, getNodeBadge() for conditional vs user skip
- `packages/frontend/src/components/workspace/nodes/BlockedNodeCard.tsx` - Inline warning card with blockReason and rollback button
- `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` - hasBlockedNodes, handleBlockedRollback, blocked Match case, blocked icon in progress list

## Decisions Made

- BlockedNodeCard delegates rollback target computation to DocumentWorkspace (not a config-access component)
- `handleBlockedRollback` looks up `executionRule.conditions`, collects all `sourceRef.nodeId` values, finds the earliest by stepOrder — consistent with how conditions reference upstream nodes
- `isAllCompleted` already correctly treats blocked as non-complete (only includes completed/skipped)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

All three Phase 26 plans complete:
- 26-01: Backend types, conditions.service.ts, runtime/background pipeline integration, workflow validation
- 26-02: Frontend UI for condition configuration (separate plan)
- 26-03: Workspace display of blocked/skipped nodes with rollback interaction
- PostgreSQL migration must be run: `ALTER TYPE node_execution_status ADD VALUE IF NOT EXISTS 'blocked';`

## Self-Check: PASSED

All commits found (d933810, 9355594, dd8eb82). All files created/modified exist.

---
*Phase: 26-conditional-node-execution*
*Plan: 26-03*
*Completed: 2026-03-27*
