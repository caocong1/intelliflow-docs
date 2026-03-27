---
phase: 18-background-execution-notifications
verified: 2026-03-26T08:00:00Z
status: human_needed
score: 7/7 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "Per-user concurrent background task limit enforced (max 3) — 429 guard added to start-background route"
    - "Global background task list across all projects — tabbed NotificationDrawer with tasks tab added"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Start background generation, close tab, reopen later"
    expected: "Generation continues and completes; workspace recovers real-time state on re-entry"
    why_human: "Cannot verify server-side async execution and browser tab close behavior programmatically"
  - test: "Trigger generation failure, then click retry button"
    expected: "Retry restarts pipeline from failed node; workspace shows updated progress"
    why_human: "Requires live environment with controllable failure conditions"
  - test: "WeChat push on completion and failure"
    expected: "TextCard messages arrive with correct document title, project name, and navigation URL"
    why_human: "Requires live WeChat Work configuration and actual API call"
  - test: "Notification bell badge updates after background task completes"
    expected: "Badge shows correct unread count within 15 seconds of task completion"
    why_human: "Requires live execution and timing verification"
---

# Phase 18: Background Execution + Notifications — Verification Report

**Phase Goal:** Users can submit document generation to run in the background, leave the page, and get notified when it completes or fails
**Verified:** 2026-03-26T08:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (previous score 5/7, gaps closed: SC-6 concurrency limit + SC-2 global task list)

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | User can start background generation, close tab, generation continues on server | VERIFIED | `executeDocumentPipeline` is fire-and-forget from `POST /start-background`; regression check: still present at runtime.routes.ts line 252. |
| SC-2 | User can view task list showing all background tasks with status from document list and detail page | VERIFIED | `GET /runtime/my-tasks` endpoint joins backgroundTasks with documents and projects; NotificationDrawer "任务" tab renders cross-project task list with 排队中/生成中/已完成/生成失败 status indicators. |
| SC-3 | Background task completion creates in-app notification with unread badge; clicking navigates to document | VERIFIED | `notifyCompletion()` calls `createNotification`; NotificationBell polls every 15s; drawer click calls markNotificationRead + navigate. Unchanged from previous verification. |
| SC-4 | Completion or failure sends WeChat Work TextCard push with document link | VERIFIED | `sendTextCardMessage` called in both notifyCompletion and notifyFailure with best-effort try/catch. Unchanged from previous verification. |
| SC-5 | Failure notification includes reason; user can retry | VERIFIED | notifyFailure includes errorMessage; workspace shows failed nodes with retry button. Unchanged from previous verification. |
| SC-6 | Per-user concurrent background task limit enforced (max 3) | VERIFIED | `MAX_CONCURRENT_TASKS_PER_USER = 3` at module scope (runtime.routes.ts line 17); drizzle count query on backgroundTasks WHERE userId AND status IN ('queued','running') (lines 225–233); returns HTTP 429 with Chinese error message when activeCount >= 3 (lines 235–238). |
| SC-7 | Server startup detects orphaned running tasks, marks failed, sends notification | VERIFIED | `detectOrphanTasks()` called in index.ts on startup. Unchanged from previous verification. |

**Score:** 7/7 success criteria verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/modules/runtime/runtime.routes.ts` | Concurrent limit guard + GET /my-tasks endpoint | VERIFIED | MAX_CONCURRENT_TASKS_PER_USER=3 at line 17; 429 guard at lines 224–238; GET /my-tasks route at lines 24–53 with leftJoin to documents and projects. |
| `packages/backend/src/modules/runtime/background.service.ts` | Background pipeline orchestrator + orphan detection | VERIFIED | Unchanged. Exports executeDocumentPipeline and detectOrphanTasks. |
| `packages/backend/src/db/schema.ts` | notifications table + documentStatusEnum with failed | VERIFIED | Unchanged. |
| `packages/backend/src/modules/notifications/notifications.service.ts` | Notification CRUD: 5 exported functions | VERIFIED | Unchanged. |
| `packages/backend/src/modules/notifications/notifications.routes.ts` | REST API for notifications (4 endpoints) | VERIFIED | Unchanged. |
| `packages/frontend/src/api/client.ts` | getMyTasks API helper | VERIFIED | Exported at line 59; fetches `/api/runtime/my-tasks` with Bearer token; follows same raw fetch pattern as other helpers. |
| `packages/frontend/src/components/notifications/NotificationDrawer.tsx` | Tabbed drawer with notifications and global task list | VERIFIED | `activeTab` signal (line 65); `fetchTasks` (line 86) calls `getMyTasks({limit:30})`; tab bar with "通知" and "任务" buttons; statusConfig renders 排队中/生成中/已完成/生成失败 with colored dots; empty state "暂无后台任务"; lazy-loaded on first tab switch. |
| `packages/frontend/src/components/notifications/NotificationBell.tsx` | Bell icon with unread count badge, 15s polling | VERIFIED | Unchanged. |
| `packages/frontend/src/components/ui/Toast.tsx` | Extended Toast with action prop and info type | VERIFIED | Unchanged. |
| `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` | Polling workspace with background execution + state recovery | VERIFIED | Unchanged. |
| `packages/frontend/src/pages/projects/ProjectHome.tsx` | Document list with status badges and 10s polling | VERIFIED | Unchanged. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `runtime.routes.ts` | `backgroundTasks` table | count query for concurrency guard | VERIFIED | Line 4 import; count query at lines 225–233. |
| `runtime.routes.ts` | GET /runtime/my-tasks | new route before parameterized routes | VERIFIED | Registered at line 24 before `/:documentId` routes to avoid param capture. |
| `NotificationDrawer.tsx` | GET /runtime/my-tasks | getMyTasks called in fetchTasks | VERIFIED | Line 7 import; fetchTasks (line 86) calls getMyTasks; invoked on first tasks tab switch and on drawer open when tab is tasks. |
| `client.ts` | GET /runtime/my-tasks | fetch /api/runtime/my-tasks | VERIFIED | Line 65: fetch with Authorization header. |
| `background.service.ts` | `runtime.service.ts` | imports initDocumentExecution, advanceNode | VERIFIED | Unchanged — regression check passed. |
| `runtime.routes.ts` | `background.service.ts` | POST /start-background fires executeDocumentPipeline | VERIFIED | Line 252: fire-and-forget call unchanged; concurrency guard inserted before it. |
| `index.ts` | `background.service.ts` | detectOrphanTasks on startup | VERIFIED | Unchanged — regression check passed. |
| `background.service.ts` | `notifications.service.ts` | createNotification on completion/failure | VERIFIED | Unchanged — regression check passed. |
| `background.service.ts` | `wecom.service.ts` | sendTextCardMessage on completion/failure | VERIFIED | Unchanged — regression check passed. |
| `Sidebar.tsx` | `NotificationBell.tsx` | renders bell, mounts NotificationDrawer | VERIFIED | Unchanged — regression check passed. |

---

## Requirements Coverage

| Requirement | Description | Plans | Status | Evidence |
|-------------|-------------|-------|--------|----------|
| BGND-01 | 用户可将文档生成任务提交到后台执行，关闭页面后任务继续运行 | 18-01, 18-05 | SATISFIED | Fire-and-forget pipeline; concurrency guard does not affect flow for users within limit. |
| BGND-02 | 后台任务状态（排队中/执行中/已完成/失败）在文档列表和详情页可见 | 18-03, 18-06 | SATISFIED | Status badges in ProjectHome; my-tasks endpoint returns status; task list in drawer shows all 4 states. |
| BGND-03 | 用户可查看后台任务列表，了解所有进行中和已完成的任务 | 18-03, 18-05, 18-06 | SATISFIED | GET /runtime/my-tasks returns cross-project task list; NotificationDrawer "任务" tab renders it. |
| BGND-04 | 后台生成完成后，用户在应用内收到通知（通知列表+未读徽标） | 18-02, 18-04, 18-06 | SATISFIED | createNotification on completion; NotificationBell badge; tabbed drawer preserves notification list in "通知" tab. |
| BGND-05 | 后台生成完成后，用户收到企业微信 TextCard 推送通知，点击可跳转到文档 | 18-02 | SATISFIED | sendTextCardMessage called on completion and failure. |
| BGND-06 | 后台生成失败时，通知包含失败原因和重试入口 | 18-01, 18-02, 18-04 | SATISFIED | notifyFailure includes errorMessage; workspace retry button present. |

**Orphaned requirements:** None — all 6 BGND requirements are covered by plans.

---

## Anti-Patterns Found

No blocker or warning anti-patterns found in new code. The `return null` at NotificationDrawer.tsx line 170 is a legitimate SolidJS IIFE side-effect pattern (calling `checkAndFetch()` inside JSX during render), not a stub.

---

## Human Verification Required

### 1. Background execution survives tab close

**Test:** Start a document generation from the workspace, immediately close the browser tab, wait 30–60 seconds, reopen the document workspace.
**Expected:** Generation continues to completion; workspace recovers with completed node outputs and document status "completed".
**Why human:** Cannot verify server-side async execution and browser tab close behavior programmatically.

### 2. Failed node retry flow

**Test:** Trigger a generation failure (e.g., use an invalid API key or misconfigured model node), observe failed node display in workspace, click retry.
**Expected:** Workspace shows red banner with error text; retry button re-triggers background execution from the failed node; polling resumes and shows progress.
**Why human:** Requires live environment with controllable failure conditions.

### 3. WeChat Work TextCard push delivery

**Test:** Configure APP_BASE_URL and WeChat Work credentials, trigger a completed generation for a user with `wecomUserId` set.
**Expected:** TextCard message arrives in WeChat Work app with document title, project name, duration, and "查看文档" button linking to workspace.
**Why human:** Requires live WeChat Work API integration and credentials.

### 4. Notification bell unread badge live update

**Test:** Have a background task complete while user is on a different page; observe bell badge within 15 seconds.
**Expected:** Bell badge increments to show new unread count without page refresh.
**Why human:** Requires live execution and time-based observation.

---

## Re-Verification Gap Closure Summary

Both gaps from the initial verification are now closed.

**Gap 1 — Per-user concurrent task limit (SC-6): CLOSED.** The `POST /start-background` handler now counts active (queued/running) tasks for the user via a drizzle count aggregate query before allowing the pipeline to fire. If the count is >= 3, it returns HTTP 429 with "已达到并发任务上限（最多 3 个），请等待现有任务完成后再试". The constant `MAX_CONCURRENT_TASKS_PER_USER = 3` is defined at module scope for easy tuning. No regression to existing pipeline flow.

**Gap 2 — Global background task list (SC-2 / BGND-03): CLOSED.** A new `GET /runtime/my-tasks` endpoint returns all background tasks for the current user across all projects, joining with documents and projects tables to include document title and project name. The `NotificationDrawer` was extended with a tab bar ("通知" / "任务"); the tasks tab lazy-loads the cross-project list using `getMyTasks()` and renders each task with a colored status dot, document title, project name, relative timestamp, and click-to-navigate. The existing notification list is preserved unchanged in the "通知" tab.

All 7 success criteria are now verified at the code level. Phase goal is structurally achieved. Remaining items in human_verification require a live environment (background tab persistence, retry flow, WeChat push delivery, bell badge timing).

---

_Verified: 2026-03-26T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
