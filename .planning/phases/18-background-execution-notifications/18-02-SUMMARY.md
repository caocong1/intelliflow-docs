---
phase: 18-background-execution-notifications
plan: 02
subsystem: notifications
tags: [notifications, wecom, push, background-tasks, drizzle, postgresql]

# Dependency graph
requires:
  - phase: 18-background-execution-notifications
    plan: 01
    provides: backgroundTasks table, notifications table, executeDocumentPipeline, detectOrphanTasks
provides:
  - Notification CRUD service (createNotification, getNotifications, getUnreadCount, markRead, markAllRead)
  - REST API for notifications (GET /notifications, GET /unread-count, PATCH /:id/read, PATCH /read-all)
  - In-app + WeChat push on pipeline completion and failure
  - Orphan detection notification integration
affects: [18-03, 18-04, frontend-notifications, workspace-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [best-effort WeChat push with try/catch, notification helper extraction for reuse]

key-files:
  created:
    - packages/backend/src/modules/notifications/notifications.service.ts
    - packages/backend/src/modules/notifications/notifications.routes.ts
  modified:
    - packages/backend/src/modules/runtime/background.service.ts
    - packages/backend/src/index.ts

key-decisions:
  - "WeChat push titles use plain text (no emoji) for enterprise compatibility"
  - "Notification helpers extracted as private functions in background.service.ts for cohesion"

patterns-established:
  - "Notification dispatch: in-app first (must succeed), WeChat push second (best-effort try/catch)"
  - "Document context helper: join documents+projects for notification content"

requirements-completed: [BGND-04, BGND-05, BGND-06]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 18 Plan 02: Notification Service and Pipeline Integration Summary

**Notification CRUD API with in-app + WeChat TextCard push on background pipeline completion, failure, and orphan detection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T06:40:35Z
- **Completed:** 2026-03-26T06:43:59Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Notification service with full CRUD: create, list with pagination, unread count, mark read, mark all read
- REST API routes with auth guard: 4 endpoints under /notifications prefix
- Pipeline completion triggers generation_completed notification + WeChat TextCard push with document title, project name, duration
- Pipeline failure triggers generation_failed notification + WeChat push with error summary
- Orphan detection creates failure notifications and sends WeChat push for each orphaned task
- WeChat push is best-effort (try/catch wrapped), never blocks in-app notification creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notifications service and REST API routes** - `7999c68` (feat)
2. **Task 2: Integrate notification creation and WeChat push into background pipeline and orphan detection** - `74f68f3` (feat)

## Files Created/Modified
- `packages/backend/src/modules/notifications/notifications.service.ts` - Notification CRUD: createNotification, getNotifications, getUnreadCount, markRead, markAllRead
- `packages/backend/src/modules/notifications/notifications.routes.ts` - REST API: GET /, GET /unread-count, PATCH /:id/read, PATCH /read-all with requireAuth guard
- `packages/backend/src/modules/runtime/background.service.ts` - Added notifyCompletion/notifyFailure helpers, wired into pipeline completion/failure/orphan detection
- `packages/backend/src/index.ts` - Registered notificationRoutes in Elysia app chain

## Decisions Made
- WeChat push titles use plain text instead of emoji prefixes for enterprise compatibility
- Notification helper functions (notifyCompletion, notifyFailure, getDocumentContext, getUserWecomId) kept as private functions within background.service.ts for cohesion rather than creating a separate notification dispatch module
- formatDuration outputs Chinese-localized duration strings (e.g., "2分30秒")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. APP_BASE_URL environment variable is optional (defaults to http://localhost:3000).

## Next Phase Readiness
- Notification API ready for Plan 03 to build frontend notification polling or SSE
- Plan 04 can build frontend background trigger button and status display
- All notification types (generation_completed, generation_failed) are created and pushable

## Self-Check: PASSED

All files exist. All commit hashes verified.

---
*Phase: 18-background-execution-notifications*
*Completed: 2026-03-26*
