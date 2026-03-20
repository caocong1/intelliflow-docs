# Phase 9: Integration Polish & UX Guards - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 2 specific integration issues found during v1.0 audit:
1. **DTYPE-04-GUARD** — document type delete association guard (raw DB FK error → friendly UX)
2. **PROJ-05-ISOWNER** — frontend ownership derivation uses `createdBy` instead of `projectMembers` role

No new features. Pure polish on existing functionality.

</domain>

<decisions>
## Implementation Decisions

### 删除保护交互方式
- 点击删除按钮后，先异步查询关联的工作流（不在列表加载时预取）
- 如果有关联工作流：确认弹窗中直接展示「无法删除」+ 工作流名称列表，按钮置灰
- 如果无关联工作流：仍显示确认弹窗（「确定删除 XXX 吗」），用户确认后再执行删除
- 只检查直接关联的工作流（workflows 表的 documentTypeId FK），不检查间接关联的文档
- 复用现有的确认弹窗模式

### 错误信息内容
- 展示完整的工作流名称列表，不截断，不管数量多少
- 文案风格：简洁专业，告知原因并提供解决建议
- 参考文案：「无法删除：以下工作流正在使用该文档类型，请先修改或删除这些工作流。」+ 工作流名称列表

### 权限判断修复范围
- ProjectHome.tsx 和 ProjectSettings.tsx 两处都修复
- isOwner 改为基于 projectMembers 表的 role 字段判断，不再使用 createdBy
- 所有 role=owner 的成员都算负责人（支持多负责人场景，符合 PROJ-08 要求）

### Claude's Discretion
- 判断身份的具体数据来源方式（检查现有接口返回值，选择最合适的实现方式）
- 确认弹窗的 loading 状态设计
- 工作流名称列表的具体展示样式

</decisions>

<specifics>
## Specific Ideas

- 确认弹窗预检查模式：点击删除 → loading → 显示结果（可删除/不可删除），复用现有弹窗组件
- 错误文案要给出行动建议（「请先修改或删除这些工作流」），不只是报错

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DocumentTypeManagement.tsx` 已有确认弹窗模式（confirmAction state + modal），可复用扩展
- `document-types.service.ts:110` 的 `deleteDocumentType()` 已有 TODO 注释标记需要添加关联检查
- `ProjectList` 接口已返回 `userRole: "owner" | "participant" | null` 字段

### Established Patterns
- 确认弹窗：confirmAction state → modal 展示 → 用户确认 → 执行操作
- API 错误处理：后端抛出错误 → 前端 catch 展示 toast 或弹窗提示

### Integration Points
- `deleteDocumentType()` 需要查询 workflows 表的 documentTypeId 关联
- `ProjectHome.tsx:164` isOwner() 和 `ProjectSettings.tsx:73` createdBy 检查需要改为 role 判断
- 项目详情 API 可能需要返回当前用户的 role（如果尚未返回）

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-integration-polish-ux-guards*
*Context gathered: 2026-03-20*
