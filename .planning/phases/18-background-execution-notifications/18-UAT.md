---
status: complete
phase: 18-background-execution-notifications
source: 18-01-SUMMARY.md, 18-02-SUMMARY.md, 18-03-SUMMARY.md, 18-04-SUMMARY.md, 18-05-SUMMARY.md, 18-06-SUMMARY.md
started: 2026-03-26T07:35:00Z
updated: 2026-03-26T08:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Trigger Background Execution
expected: In the workspace, clicking the generate button triggers background execution. The page returns immediately (no step-by-step blocking flow). A "queued" or "running" status appears and the workspace begins polling for updates.
result: issue
reported: "handleAdvance directly called startBackgroundExecution without first advancing input_transform node, causing 400 error from backend"
severity: major

### 2. Workspace Polling During Generation
expected: While generation is running, the workspace polls every ~3 seconds with a visible countdown timer. A manual refresh button is also available. Node results populate progressively as backend completes each step.
result: pass

### 3. Workspace State Recovery on Refresh
expected: Refreshing the browser page during active generation automatically recovers the state — polling resumes without losing track of progress.
result: pass

### 4. Generation Completion Toast
expected: When background generation finishes successfully, a toast notification appears with a success message. If the workspace is open, polling stops and final results are displayed.
result: skipped
reason: Generation failed due to model timeout; could not verify success toast. Failure toast was verified.

### 5. Generation Failure Display
expected: If a node fails during background execution, the workspace shows a red error banner with the error message and a retry button. Clicking retry re-triggers background execution.
result: pass

### 6. Document List Status Badges
expected: In the project document list, documents show status badges: spinning "生成中" for in-progress, "已完成" for completed, "生成失败" (red) for failed. The list auto-polls every ~10 seconds when any document is in_progress.
result: pass

### 7. Notification Bell & Unread Count
expected: The sidebar shows a notification bell icon. It displays a red unread count badge that updates periodically (~15s polling). The badge caps at 99+.
result: pass

### 8. Notification Drawer
expected: Clicking the bell opens a slide-out drawer from the right showing notification list with type icons, relative timestamps, and a "mark all read" option. Clicking a notification marks it read and navigates to the document workspace.
result: pass

### 9. Generation Completion Notification
expected: After a background generation completes, a new notification appears in the drawer with the document title and project name. The unread badge increments.
result: skipped
reason: Generation failed due to model timeout; verified failure notification instead (see Test 10).

### 10. Generation Failure Notification
expected: If background generation fails, a failure notification appears in the drawer with an error summary.
result: pass

### 11. Concurrent Task Limit
expected: When a user already has 3 background tasks running/queued, attempting to start another returns an error (HTTP 429) with a clear Chinese message about the limit being exceeded.
result: pass

### 12. Task List Tab in Drawer
expected: The notification drawer has two tabs: "通知" (notifications) and "任务" (tasks). Switching to the tasks tab shows a list of all background tasks across projects with status indicators (排队中/生成中/已完成/生成失败), document name, project name, and timestamps. Clicking a task navigates to the workspace.
result: pass

### 13. Orphan Task Detection on Server Restart
expected: If the server restarts while tasks are running, those orphaned tasks are automatically marked as failed with a failure notification created for each.
result: pass

## Summary

total: 13
passed: 9
issues: 1
pending: 0
skipped: 2

## Gaps

- truth: "Clicking generate button in workspace triggers background execution without error"
  status: failed
  reason: "User reported: handleAdvance directly called startBackgroundExecution without first advancing input_transform node, causing 400 error from backend"
  severity: major
  test: 1
  root_cause: "DocumentWorkspace.tsx handleAdvance() called startBackgroundExecution() directly without first completing input_transform node via advance API"
  artifacts:
    - path: "packages/frontend/src/pages/workspace/DocumentWorkspace.tsx"
      issue: "handleAdvance missing advance call for input_transform nodes before startBackgroundExecution"
  missing:
    - "Add advance API call for input_transform nodes before calling startBackgroundExecution"
  debug_session: ""
