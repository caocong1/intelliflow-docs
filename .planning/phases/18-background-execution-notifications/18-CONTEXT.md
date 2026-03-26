# Phase 18: Background Execution + Notifications - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

将文档生成从前端驱动改为后端独立运行，用户关掉页面/刷新后任务继续执行。新增应用内通知系统和企业微信推送，让用户在离开页面后仍能收到生成结果。

**关键认知：** 后台执行是后端的透明运行模式，不是一个面向用户的独立功能。前端工作区体验和之前几乎完全一样，只是数据源从前端状态变成后端状态。不需要独立的任务列表页面、侧边栏任务入口、后台触发按钮。

</domain>

<decisions>
## Implementation Decisions

### 后台执行模式
- 所有文档生成默认后台执行，不是用户手动选择的可选模式
- 前端页面和之前几乎完全一样，后台执行只是后端运行逻辑的变化
- 无并发上限（不需要排队或限制机制）
- 服务器启动时检测 `running` 状态的孤儿任务，标记为失败并发送通知

### 工作区行为
- 用户刷新或重新进入文档工作区时，恢复实时进度（已完成节点显示结果，运行中节点显示加载）
- 文档列表页用状态 Badge + 旋转动画显示生成状态（生成中/已完成/生成失败）
- 轮询刷新状态（具体间隔 Claude 决定），显示倒计时刷新数字 + 手动刷新按钮

### 应用内通知
- 通知铃铛图标放在侧边栏底部，用户头像旁边，带未读数字角标
- 点击铃铛右侧滑出通知抽屉，不离开当前页面
- 任务完成或失败时弹出 Toast 提示（复用现有 Toast 组件），可点击跳转到文档
- 点击单条通知标记已读并跳转到对应文档，另外提供「全部标记已读」按钮

### 企业微信推送
- 使用现有 `sendTextCardMessage` 接口发送 TextCard 通知
- 成功标题：「✅ 文档生成完成」，描述包含项目名、文档名、耗时
- 失败标题：「❌ 文档生成失败」，描述包含项目名、文档名、简要失败原因
- 按钮文字：成功为「查看文档」，失败为「查看详情」
- 链接直接跳转到对应文档工作区

### 失败与重试
- 从失败节点重试（已完成节点结果保留），不从头重新执行
- 重试入口在工作区内，与现有节点执行体验一致
- 失败节点显示红色状态 + 错误摘要（如「模型调用超时」）+ 重试按钮
- 用户也可以修改输入后再重试

### Claude's Discretion
- 轮询间隔时长
- Toast 组件样式扩展（如需要新增 info/warning 类型）
- 通知抽屉的详细布局和样式
- 通知数据持久化方案
- 孤儿任务检测的具体实现策略

</decisions>

<specifics>
## Specific Ideas

- 轮询刷新应显示倒计时数字（让用户知道什么时候会自动刷新），并提供手动刷新按钮
- 企业微信推送的卡片格式参考现有邀请通知的风格（`wecom.routes.ts` 中的项目邀请推送）
- 后台执行对用户来说是透明的 — 用户不需要理解「前台执行」和「后台执行」的区别

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendTextCardMessage` (wecom.service.ts): 企业微信 TextCard 推送已就绪，接受 toUserIds + card 参数
- `Badge` 组件 (ui/Badge.tsx): 4 种变体 (success/warning/error/info)，可用于任务状态标签
- `Toast` 组件 (ui/Toast.tsx): success/error 两种类型，3 秒自动消失，可扩展为可点击跳转
- `Sidebar` 组件 (nav/Sidebar.tsx): 侧边栏底部有用户信息区域，可在旁边添加铃铛图标

### Established Patterns
- 节点执行状态通过 `nodeExecutions` 表追踪 (runtime.service.ts)，有 status/errorMessage 字段
- 工作流拓扑排序和节点执行逻辑已在 runtime.service.ts 中实现
- 企业微信推送已有使用先例：项目邀请通知 (wecom.routes.ts:303)

### Integration Points
- `runtime.service.ts` — 需要改造为后端独立运行（当前由前端逐节点驱动）
- `DocumentWorkspace.tsx` — 需要从后端轮询状态替代前端驱动执行
- `Sidebar.tsx` — 添加通知铃铛入口
- `wecom.service.ts` — 复用 sendTextCardMessage 发送生成结果通知
- 文档列表页 — 添加生成状态 Badge 显示

</code_context>

<deferred>
## Deferred Ideas

None — 讨论保持在 Phase 范围内。

</deferred>

---

*Phase: 18-background-execution-notifications*
*Context gathered: 2026-03-26*
