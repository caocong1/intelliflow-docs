# Phase 7: Model Parameter Configuration - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

为现有的模型添加/编辑流程增加 temperature、max_tokens、top_p 参数配置。管理员在添加或编辑模型时可设置这些参数，参数值持久化到数据库并可通过 API 获取。不涉及工作流节点级别的参数覆盖。

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

用户将所有实现细节交由 Claude 决定，包括：

- **参数默认值与约束** — 各参数的默认值、最小/最大范围、是否可选
- **UI 布局与交互** — 参数字段在模型弹窗中的位置、输入方式（滑块/数字输入）、是否折叠
- **参数作用域** — 本阶段仅存储模型级别的默认参数，供后续工作流节点调用时使用
- **数据库 schema 设计** — 字段类型、nullable 策略、迁移方式
- **API 接口变更** — create/update model 的请求体扩展、响应体变更
- **前端验证逻辑** — 输入范围校验、错误提示

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Modal` 组件 (`components/ui/Modal`): 模型添加/编辑弹窗已使用，参数字段直接加入现有表单
- `Badge` 组件 (`components/ui/Badge`): 状态标签展示
- `showToast` (`components/ui/Toast`): 操作反馈
- `inputClass` / `labelClass` 样式变量: ModelConfiguration.tsx 中已定义，可直接复用

### Established Patterns
- **Backend**: Elysia + Drizzle ORM，typebox schema 验证，service 层分离
- **Frontend**: SolidJS 信号式状态管理，表单用 `createSignal` + `onInput` 模式
- **DB**: models 表当前字段：id, providerId, modelId, displayName, isActive, isProviderDisabled, createdAt, updatedAt — 无参数字段

### Integration Points
- **Schema**: `packages/backend/src/db/schema.ts` — models 表需新增 temperature, maxTokens, topP 字段
- **Service**: `packages/backend/src/modules/models/models.service.ts` — createModel/updateModel 需扩展
- **Routes**: `packages/backend/src/modules/models/models.routes.ts` — body schema 需扩展
- **Frontend**: `packages/frontend/src/pages/admin/ModelConfiguration.tsx` — Model 类型、modelForm、模型弹窗表单需扩展

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-model-parameter-configuration*
*Context gathered: 2026-03-19*
