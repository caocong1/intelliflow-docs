# Phase 18: Background Execution + Notifications - Research

**Researched:** 2026-03-26
**Domain:** Backend task execution, in-app notifications, WeChat Work push notifications
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 所有文档生成默认后台执行，不是用户手动选择的可选模式
- 前端页面和之前几乎完全一样，后台执行只是后端运行逻辑的变化
- 无并发上限（不需要排队或限制机制）
- 服务器启动时检测 `running` 状态的孤儿任务，标记为失败并发送通知
- 用户刷新或重新进入文档工作区时，恢复实时进度（已完成节点显示结果，运行中节点显示加载）
- 文档列表页用状态 Badge + 旋转动画显示生成状态（生成中/已完成/生成失败）
- 轮询刷新状态，显示倒计时刷新数字 + 手动刷新按钮
- 通知铃铛图标放在侧边栏底部，用户头像旁边，带未读数字角标
- 点击铃铛右侧滑出通知抽屉，不离开当前页面
- 任务完成或失败时弹出 Toast 提示（复用现有 Toast 组件），可点击跳转到文档
- 点击单条通知标记已读并跳转到对应文档，另外提供「全部标记已读」按钮
- 使用现有 `sendTextCardMessage` 接口发送 TextCard 通知
- 成功标题：「✅ 文档生成完成」，失败标题：「❌ 文档生成失败」
- 从失败节点重试（已完成节点结果保留），不从头重新执行
- 重试入口在工作区内，与现有节点执行体验一致
- 失败节点显示红色状态 + 错误摘要 + 重试按钮

### Claude's Discretion
- 轮询间隔时长
- Toast 组件样式扩展（如需要新增 info/warning 类型）
- 通知抽屉的详细布局和样式
- 通知数据持久化方案
- 孤儿任务检测的具体实现策略

### Deferred Ideas (OUT OF SCOPE)
None — 讨论保持在 Phase 范围内。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BGND-01 | 用户可将文档生成任务提交到后台执行，关闭页面后任务继续运行 | Backend runtime orchestrator pattern; `backgroundTasks` table already exists in schema; runtime.service.ts refactoring to run autonomously |
| BGND-02 | 后台任务状态在文档列表和详情页可见 | Polling API pattern; existing `statusMap` in ProjectHome.tsx; Badge component reuse; document status enum extension |
| BGND-03 | 用户可查看后台任务列表 | Per CONTEXT.md: no separate task list page; task visibility integrated into document list badges and workspace state recovery |
| BGND-04 | 应用内通知（通知列表+未读徽标） | New `notifications` DB table; Sidebar bell icon; notification drawer component; polling for unread count |
| BGND-05 | 企业微信 TextCard 推送通知 | Existing `sendTextCardMessage` in wecom.service.ts; proven pattern from project invitation push |
| BGND-06 | 失败通知包含失败原因和重试入口 | Existing `rollbackToNode` for retry from failed step; errorMessage field on nodeExecutions; workspace retry UX |
</phase_requirements>

## Summary

This phase transforms the document generation runtime from a frontend-driven step-by-step model to a backend-autonomous execution model. Currently, the frontend calls `POST /runtime/:documentId/init` to create node execution rows, then triggers each node individually (model calls via SSE, desensitize/restore/export via dedicated routes). The frontend drives the `advanceNode` flow. The change makes the backend orchestrate the entire pipeline independently after the user confirms input, so the browser tab can be closed.

The `backgroundTasks` table already exists in the schema (added in Phase 17 migration planning) with `queued/running/completed/failed` status enum. The core work is: (1) a backend orchestrator function that runs the full node pipeline, (2) a `notifications` table for in-app notifications, (3) frontend polling to recover workspace state and show progress, (4) notification UI (bell + drawer + toast), and (5) WeChat Work push on completion/failure.

**Primary recommendation:** Build a backend `executeDocumentPipeline(documentId, userId)` function that runs all nodes sequentially using existing node-type services, wrapped in try/catch to handle failures at any node. Use the existing `backgroundTasks` table to track overall status. Add a `notifications` table for in-app notifications. Frontend polls `GET /runtime/:documentId` to recover state on page load and at intervals during execution.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Elysia | existing | HTTP routes for polling APIs and notification endpoints | Already used throughout backend |
| Drizzle ORM | existing | DB queries for notifications table, background tasks | Already used throughout backend |
| SolidJS | existing | Frontend components (notification drawer, bell icon, toast extension) | Already used throughout frontend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@solidjs/router` | existing | Navigation from notification click to document | Already used for routing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling | WebSocket/SSE | WebSocket adds infrastructure complexity; polling is simpler and sufficient for 5-10s intervals. User already decided on polling. |
| Separate job queue (BullMQ) | In-process execution | No Redis dependency needed; single-server deployment; `backgroundTasks` table is the queue |
| Push notifications via SSE | Polling for notifications | SSE requires persistent connections and reconnect logic; polling for notification count is simpler |

## Architecture Patterns

### Recommended Project Structure
```
packages/backend/src/modules/
├── runtime/
│   ├── runtime.service.ts        # Existing — add executeDocumentPipeline()
│   ├── runtime.routes.ts         # Existing — add polling status endpoint
│   ├── background.service.ts     # NEW — background task lifecycle, orphan detection
│   └── ... (existing node-type routes)
├── notifications/
│   ├── notifications.service.ts  # NEW — CRUD, mark read, unread count
│   └── notifications.routes.ts   # NEW — GET /notifications, PATCH read, etc.
└── wecom/
    └── wecom.service.ts          # Existing — reuse sendTextCardMessage

packages/frontend/src/
├── components/
│   ├── nav/
│   │   └── Sidebar.tsx           # MODIFY — add bell icon with unread badge
│   ├── notifications/
│   │   ├── NotificationBell.tsx   # NEW — bell icon + unread count
│   │   └── NotificationDrawer.tsx # NEW — slide-out notification list
│   └── ui/
│       └── Toast.tsx             # MODIFY — add clickable variant with navigation
└── pages/workspace/
    └── DocumentWorkspace.tsx     # MODIFY — polling-based state recovery
```

### Pattern 1: Backend Pipeline Orchestrator
**What:** A single async function that runs all workflow nodes in topological order, using existing node-type service functions.
**When to use:** When user initiates document generation (replaces frontend-driven step-by-step flow).
**Key insight:** The current `advanceNode` logic already handles node-to-node data passing. The orchestrator calls each node's service function directly (model-call, desensitize, restore, export) and uses `advanceNode` to progress state.

```typescript
// runtime.service.ts — new function
export async function executeDocumentPipeline(
  documentId: string,
  userId: string,
  startFromNodeId?: string, // for retry from failed node
): Promise<void> {
  // 1. Init execution (or resume from startFromNodeId)
  const state = await initDocumentExecution(documentId, userId);

  // 2. Loop through nodes in order
  for (const node of state.nodes) {
    if (node.status === 'completed' || node.status === 'skipped') continue;
    if (node.status !== 'in_progress') continue;

    try {
      // Execute node based on type
      switch (node.nodeType) {
        case 'input_transform':
          // Input already confirmed before background execution starts
          break;
        case 'desensitize':
          await executeDesensitizeNode(documentId, node.id, userId);
          break;
        case 'model_call':
          await executeModelCallNode(documentId, node.id, userId);
          break;
        case 'restore':
          await executeRestoreNode(documentId, node.id, userId);
          break;
        case 'file_export':
          await executeExportNode(documentId, node.id, userId);
          break;
      }
      // Advance to next node
      await advanceNode(documentId, node.id, userId);
    } catch (error) {
      // Mark node as failed, update background task
      await markNodeFailed(documentId, node.id, error.message);
      throw error; // Propagated to background task handler
    }
  }
}
```

### Pattern 2: Notifications Table + Polling
**What:** A `notifications` table in PostgreSQL with polling endpoint for unread count and notification list.
**When to use:** For in-app notification system (bell icon, drawer, toast on completion).

```typescript
// Schema addition
export const notificationTypeEnum = pgEnum("notification_type", [
  "generation_completed",
  "generation_failed",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: varchar("message", { length: 1000 }),
  documentId: uuid("document_id").references(() => documents.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Pattern 3: Background Task Lifecycle
**What:** Use `backgroundTasks` table (already in schema) to track document generation lifecycle.
**When to use:** Every document generation creates a background task row.

```
User confirms input → POST /runtime/:documentId/start-background
  → Insert backgroundTask (status: queued)
  → Spawn async executeDocumentPipeline()
  → Update backgroundTask (status: running)
  → On success: status=completed, create notification, send WeChat push
  → On failure: status=failed, create notification, send WeChat push
```

### Pattern 4: Orphan Task Detection on Startup
**What:** On server start, query `backgroundTasks` where `status = 'running'` — these are orphans from a previous crash.
**When to use:** In server initialization, before accepting requests.

```typescript
// background.service.ts
export async function detectOrphanTasks(): Promise<void> {
  const orphans = await db
    .select()
    .from(backgroundTasks)
    .where(eq(backgroundTasks.status, "running"));

  for (const task of orphans) {
    await db.update(backgroundTasks)
      .set({ status: "failed", errorMessage: "服务器重启，任务中断", updatedAt: new Date() })
      .where(eq(backgroundTasks.id, task.id));

    // Mark running nodeExecutions as failed too
    // Create notification
    // Send WeChat push
  }
}

// index.ts — call on startup
await detectOrphanTasks();
```

### Pattern 5: Polling with Countdown Timer
**What:** Frontend polls backend at fixed intervals, showing countdown to next refresh.
**When to use:** Document list page and workspace page during active generation.

**Recommended intervals:**
- Document workspace (active generation): 3 seconds — user is watching progress
- Document list page: 10 seconds — less urgent, background awareness
- Notification unread count: 15 seconds — low priority, just badge update

```typescript
// SolidJS polling pattern
const [countdown, setCountdown] = createSignal(POLL_INTERVAL);

const pollTimer = setInterval(() => {
  setCountdown(prev => {
    if (prev <= 1) {
      fetchStatus(); // actual poll
      return POLL_INTERVAL;
    }
    return prev - 1;
  });
}, 1000);

onCleanup(() => clearInterval(pollTimer));
```

### Anti-Patterns to Avoid
- **Running model calls synchronously in the orchestrator**: Model calls use SSE streaming to the frontend. For background execution, use a non-streaming variant that collects the full response. Do NOT try to reuse SSE streams.
- **Polling too aggressively**: Do not poll faster than 3 seconds. The backend is a single process.
- **Storing notifications in memory**: Always persist to DB. Server restarts would lose all notifications.
- **Coupling notification creation with WeChat push**: Create in-app notification first (fast, reliable), then attempt WeChat push separately (may fail, should not block).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue | Custom queue with locks | `backgroundTasks` table + in-process async | Single server, no Redis needed; table provides persistence and crash recovery |
| WeChat push | Custom HTTP client | Existing `sendTextCardMessage` | Already implemented and proven in invitation flow |
| Notification polling | WebSocket infrastructure | HTTP polling with `setInterval` | Simpler, no persistent connection management, sufficient for this use case |
| Countdown timer | Complex timer library | Simple `setInterval` + `createSignal` | SolidJS reactivity makes this trivial |

**Key insight:** This project runs on a single server with PostgreSQL. There is no need for Redis, message queues, or WebSocket infrastructure. The `backgroundTasks` table IS the job queue, and in-process `Promise` execution with try/catch IS the job runner.

## Common Pitfalls

### Pitfall 1: Model Call Requires Non-Streaming Variant
**What goes wrong:** The current `executeModelCall` in `model-call.service.ts` returns an SSE `ReadableStream` designed for browser consumption. Calling this from the backend orchestrator would not work — there is no browser to consume the stream.
**Why it happens:** The function was designed for frontend-driven SSE streaming.
**How to avoid:** Create a `executeModelCallBackground()` variant that collects the full response internally (consumes the stream and aggregates chunks) or calls the model API directly without SSE wrapping. The variant should write results to `nodeExecutions.outputData` just like the SSE version does on completion.
**Warning signs:** If model call results are empty or the orchestrator hangs waiting on an unconsumed stream.

### Pitfall 2: Input Transform Node Requires User Interaction
**What goes wrong:** The `input_transform` node type requires user input (file upload, text entry, field filling). It cannot be executed automatically in the background.
**Why it happens:** This is a human-interaction node, not an automated node.
**How to avoid:** Background execution starts AFTER the user has confirmed the input transform node. The orchestrator should begin from the first non-input-transform node, or simply skip already-completed nodes. The `initDocumentExecution` flow should separate "user confirms input" from "start background pipeline".
**Warning signs:** The orchestrator tries to "execute" an input_transform node with no data.

### Pitfall 3: Document Status Enum Missing "failed"
**What goes wrong:** The current `documentStatusEnum` only has `draft | in_progress | completed`. There is no `failed` state. When a background task fails, the document status has no way to reflect this.
**Why it happens:** Original design assumed frontend-driven execution where failures are handled interactively.
**How to avoid:** Add `"failed"` to `documentStatusEnum`. Create a migration. Update the frontend `statusMap` to include a red "failed" badge variant.
**Warning signs:** Failed documents show as "in_progress" forever.

### Pitfall 4: Race Condition on Concurrent Page Load and Background Execution
**What goes wrong:** User opens workspace while background pipeline is advancing a node. The frontend poll reads state that changes mid-request.
**Why it happens:** Background orchestrator and polling API both read/write `nodeExecutions`.
**How to avoid:** This is actually fine with the current design because each operation is a separate DB transaction. The poll will show a consistent snapshot. Just ensure the frontend handles transitions gracefully (node was "in_progress" on last poll, now "completed" — update UI smoothly).
**Warning signs:** UI flickers or shows inconsistent state between polls.

### Pitfall 5: WeChat Push Fails Silently
**What goes wrong:** WeChat access token expires, or user has no `wecomUserId`, and the push fails without any feedback.
**Why it happens:** WeChat API is external and unreliable.
**How to avoid:** Wrap WeChat push in try/catch. Log failures but never let them block in-app notification creation or task completion. The in-app notification is the primary channel; WeChat push is best-effort.
**Warning signs:** Users report not receiving WeChat notifications but no errors in logs.

### Pitfall 6: Orphan Detection Must Also Handle nodeExecutions
**What goes wrong:** Orphan detection only marks `backgroundTasks` as failed but leaves `nodeExecutions` rows stuck in `in_progress` status.
**Why it happens:** Forgetting that `nodeExecutions` and `backgroundTasks` are separate tables tracking related state.
**How to avoid:** Orphan detection should: (1) mark backgroundTask as failed, (2) mark any `in_progress` nodeExecutions for that document as failed, (3) update document status to failed, (4) create notification, (5) send WeChat push.

## Code Examples

### Extending Toast for Clickable Navigation
```typescript
// Toast.tsx modification
type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  action?: { label: string; href: string }; // NEW: clickable action
};

export function showToast(
  message: string,
  type: "success" | "error" | "info",
  action?: { label: string; href: string },
) {
  const id = nextId++;
  setToasts((prev) => [...prev, { id, message, type, action }]);
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 5000); // Longer timeout for actionable toasts
}
```

### WeChat Push for Generation Complete
```typescript
// Reusing existing sendTextCardMessage pattern from wecom.routes.ts:303
await sendTextCardMessage([user.wecomUserId], {
  title: "✅ 文档生成完成",
  description: `<div class="gray">项目：${projectName}</div><div class="normal">文档「${documentTitle}」已生成完成，耗时 ${duration}</div>`,
  url: `${baseUrl}/projects/${projectId}/documents/${documentId}/workspace`,
  btntxt: "查看文档",
});
```

### Background Task Start Route
```typescript
// runtime.routes.ts — new endpoint
.post(
  "/:documentId/start-background",
  async ({ params, user, set }) => {
    // 1. Verify input_transform is confirmed
    // 2. Create backgroundTask row (status: queued)
    // 3. Fire-and-forget: executeDocumentPipeline()
    //    .then(() => markComplete + notify)
    //    .catch((err) => markFailed + notify)
    // 4. Return immediately with task ID
    return { taskId, status: "queued" };
  },
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Frontend drives each node step | Backend runs full pipeline autonomously | This phase | User can close browser; server crash recovery possible |
| No notification system | In-app notifications + WeChat push | This phase | Users stay informed without watching the screen |
| Document status: draft/in_progress/completed | Add "failed" status | This phase | Failed generations clearly visible in UI |

## Open Questions

1. **Model call auto-selection in background mode**
   - What we know: Current flow requires user to select preferred model output when multiple models return results. In background mode, there is no user to select.
   - What's unclear: Should the first model's output be auto-selected? Or should the document pause at model_call and wait for user selection?
   - Recommendation: Auto-select the first model output (or the one marked `isDefault` in config). Users can change selection when they open the workspace later. This keeps background execution fully automated. Alternatively, if the workflow only has one model configured, auto-select is obvious; if multiple, pause execution and notify user to select — but this partially breaks "background" promise. **Planner should decide based on user preference.**

2. **Notification retention policy**
   - What we know: Notifications will accumulate over time.
   - What's unclear: How long to retain notifications? Auto-cleanup?
   - Recommendation: Keep last 100 notifications per user. Add a `createdAt` index and prune on read. Low priority — can defer cleanup to a later phase.

3. **Frontend transition from frontend-driven to polling-based**
   - What we know: DocumentWorkspace.tsx currently drives execution interactively. The workspace UI stays "almost the same" per user decision.
   - What's unclear: How much of the existing workspace interaction changes? Does the user still see live SSE streaming for model calls, or just poll for completed results?
   - Recommendation: For the workspace page, when user is actively watching: show SSE streaming for model calls if the user opens workspace while a model_call node is running. For background mode (user returns after execution): show completed results from DB. The workspace should detect whether execution is "live" (user watching) vs "background" (user returned later) and adapt display accordingly.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/backend/src/modules/runtime/runtime.service.ts` — current execution model
- Codebase analysis: `packages/backend/src/modules/runtime/model-call.routes.ts` — SSE streaming pattern
- Codebase analysis: `packages/backend/src/modules/wecom/wecom.service.ts` — sendTextCardMessage API
- Codebase analysis: `packages/backend/src/db/schema.ts` — existing tables including `backgroundTasks`
- Codebase analysis: `packages/backend/src/index.ts` — server entry point (no startup hooks yet)
- Codebase analysis: `packages/frontend/src/components/nav/Sidebar.tsx` — sidebar layout for bell icon
- Codebase analysis: `packages/frontend/src/components/ui/Toast.tsx` — toast component (success/error only)
- Codebase analysis: `packages/frontend/src/pages/projects/ProjectHome.tsx` — document list with status badges

### Secondary (MEDIUM confidence)
- SolidJS polling patterns — standard setInterval + createSignal approach (well-known pattern)
- Elysia fire-and-forget async pattern — Promise-based, no special library needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - patterns derived directly from existing codebase analysis
- Pitfalls: HIGH - identified from concrete code review (SSE streaming, missing enum value, orphan detection gaps)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable — no external dependency changes expected)
