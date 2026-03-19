# Phase 2: AI Provider and Model Configuration - Research

**Researched:** 2026-03-19
**Domain:** OpenAI-compatible API provider/model CRUD management, connectivity testing
**Confidence:** HIGH

## Summary

Phase 2 adds admin management of AI providers and models. The user has locked the scope to OpenAI-compatible protocol only (no CLI, no custom HTTP), with no model parameter configuration in v1. The core work is: two new database tables (providers, models) with a parent-child relationship, backend CRUD modules following the established document-types pattern, a frontend card-layout page with modal forms, and a connectivity test endpoint that sends a simple Chat Completions request.

The existing codebase provides strong patterns to follow. Phase 1 established `document-types` as a reference CRUD module (routes + service + schema + frontend page), Eden Treaty for type-safe API calls, and reusable UI components (Modal, Badge, Toast, Table). This phase is architecturally straightforward — it extends the same patterns with the addition of: (1) a parent-child entity relationship with cascade status logic, (2) an external HTTP call for connectivity testing, and (3) a card-based layout instead of a table-based layout.

**Primary recommendation:** Follow the document-types module pattern exactly for backend structure. Use native `fetch` (available in Bun) to call the OpenAI-compatible Chat Completions endpoint for connectivity testing. Store API keys as plain text in v1 (single-tenant internal tool), with a TODO for encryption in production hardening.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- v1 仅实现 **OpenAI 兼容协议**（Chat Completions 格式），不实现 CLI 命令行调用
- 开发阶段使用火山方舟 Coding Plan（Base URL: `https://ark.cn-beijing.volces.com/api/coding/v3`）
- 生产环境切换为火山方舟正式 API（Base URL: `https://ark.cn-beijing.volces.com/api/v3`）
- 两者接口格式完全一致，切换只需改 Base URL
- 认证方式：API Key（请求头 Bearer Token）
- Provider 和 Model 在同一页面，**卡片布局**
- 每个 Provider 是一张卡片，卡片内直接展示其下所有 Model 列表（不做收起/展开）
- Model 的新增/编辑使用**弹窗表单**（Modal），复用现有 Modal 组件
- Provider 的新增/编辑同样使用弹窗表单
- Provider 卡片上有"测试连接"按钮
- 后端发送一个简单的 Chat Completions 请求（如发送 "hi"）验证配置
- 测试结果用 **Toast 通知**展示（成功/失败 + 错误信息）
- 停用 Provider 时，其下所有 Model **自动级联停用**，界面置灰
- 重新启用 Provider 后，Model 恢复各自原状态
- **v1 不做参数配置**（temperature、max_tokens、top_p 等）— 全部使用 API 默认值
- 可用模型（Coding Plan 套餐）：doubao-seed-2.0-pro, doubao-seed-2.0-lite, deepseek-v3.2, kimi-k2.5, glm-4.7, minimax-m2.5, doubao-seed-2.0-code, doubao-seed-code

### Claude's Discretion
- Provider 卡片的具体视觉样式和布局细节
- Model 列表在卡片内的排列方式
- 测试连接按钮的具体位置和加载状态展示
- 错误提示信息的措辞

### Deferred Ideas (OUT OF SCOPE)
- CLI 命令行调用方式（原需求 v1 首选）— 暂缓，先用 OpenAI 兼容 API
- 其他 Provider 类型（DashScope 原生、自定义 HTTP）— 暂缓
- 模型参数配置（temperature、max_tokens、top_p、自定义 JSON）— 后续按需添加
- 用量与限制（AIMC 需求中的 2.5.3 节）— v2 范围
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIMC-01 | 管理员可创建 Provider 实例（选择类型、填写名称、API 地址、认证信息） | DB schema for providers table; backend POST route; frontend modal form. v1 type is always "openai_compatible" |
| AIMC-02 | 管理员可编辑和删除 Provider 实例 | Backend PATCH/DELETE routes following document-types pattern; delete blocked if has models (or cascade delete) |
| AIMC-03 | 管理员可测试 Provider 连通性 | Backend POST `/providers/:id/test` endpoint using native fetch to call Chat Completions with "hi" message |
| AIMC-04 | 管理员可启用/停用 Provider 实例 | Backend PATCH `/:id/status` with cascade logic — set all child models' `isActive` to false when disabling, restore original state when re-enabling |
| AIMC-05 | 管理员可在 Provider 下添加模型（模型 ID、显示名称、部署类型、调用方式、参数配置） | DB schema for models table with FK to providers; backend POST route. v1: deployment_type field stored but parameters deferred |
| AIMC-06 | 管理员可编辑、启用/停用、删除模型 | Backend PATCH/DELETE/status routes for models, same pattern as document-types |
| AIMC-07 | 模型支持标记部署类型（线上云端/本地私有） | `deployment_type` enum column in models table: "cloud" / "local" |
| AIMC-08 | 模型支持配置 CLI 命令行调用模板（v1 首选） | **Deferred per user decision.** DB column `cli_template` can be nullable varchar, not exposed in v1 UI. Store field for forward compatibility |
| AIMC-09 | 模型支持配置参数（temperature、max_tokens、top_p 等） | **Deferred per user decision.** DB column `parameters` can be nullable JSONB, not exposed in v1 UI |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Elysia | ^1.2.25 | Backend HTTP framework | Already in use, provides type-safe routes |
| Drizzle ORM | ^0.39.3 | Database schema + queries | Already in use, established patterns |
| postgres | ^3.4.5 | PostgreSQL driver | Already in use (postgres.js) |
| SolidJS | (existing) | Frontend framework | Already in use |
| Eden Treaty | (existing) | Type-safe API client | Already in use |
| Tailwind CSS v4 | (existing) | Styling | Already in use with indigo theme |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `fetch` | Built-in (Bun) | Chat Completions API call for connectivity test | No additional HTTP client needed — Bun's fetch is fully capable |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | openai npm package | Overkill — we only need a single POST for connectivity test. openai SDK adds ~2MB dependency for one API call. Native fetch is sufficient |
| Native fetch | ofetch/ky | Unnecessary abstraction for a single endpoint call |

**Installation:**
```bash
# No new dependencies needed — all libraries already installed from Phase 1
```

## Architecture Patterns

### Recommended Project Structure
```
packages/backend/src/modules/
├── providers/
│   ├── providers.routes.ts    # Elysia routes (CRUD + test connectivity)
│   └── providers.service.ts   # Business logic + DB queries
├── models/
│   ├── models.routes.ts       # Elysia routes (CRUD under provider)
│   └── models.service.ts      # Business logic + DB queries

packages/backend/src/db/
└── schema.ts                  # Add providers + models tables

packages/shared/src/
└── types.ts                   # Add Provider + Model types

packages/frontend/src/
├── pages/admin/
│   └── ModelConfiguration.tsx # Card-layout page for providers + models
```

### Pattern 1: Parent-Child CRUD with Cascade Status
**What:** Providers own models. Disabling a provider cascades to all its models.
**When to use:** Any parent-child entity where parent status affects children.
**Implementation approach:**

The cascade disable/re-enable requires tracking "original" model status. Two approaches:

**Approach A (Recommended — Simple column):** Add `is_provider_disabled: boolean` to models table.
- When provider is disabled: set all child models `is_provider_disabled = true` (models appear disabled regardless of their own `is_active`)
- When provider is re-enabled: set all child models `is_provider_disabled = false` (models revert to their own `is_active` state)
- Frontend shows model as active only when both `is_active = true` AND `is_provider_disabled = false`
- This preserves each model's own active/inactive state independently

**Approach B (Alternative):** Store original states in a JSON column before cascade. More complex, less transparent.

### Pattern 2: Connectivity Test via Chat Completions
**What:** POST to provider's base URL + `/chat/completions` with minimal payload.
**When to use:** Verifying provider configuration is correct.
**Example:**
```typescript
// In providers.service.ts
export async function testProviderConnection(provider: {
  baseUrl: string;
  apiKey: string;
}): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: "doubao-seed-2.0-lite", // cheapest model for testing
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        message: `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
        latencyMs,
      };
    }

    return { success: true, message: "连接成功", latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: message.includes("timeout") ? "连接超时（15秒）" : message,
      latencyMs,
    };
  }
}
```

### Pattern 3: Card Layout for Provider + Model Display
**What:** Each provider is a card containing its models as a list/mini-table.
**When to use:** This page specifically — providers are few (1-3), so cards work better than a flat table.
**Layout concept:**
```
┌─────────────────────────────────────────────┐
│ Provider: 火山方舟 (Coding Plan)    [测试] [编辑] [停用] │
│ Base URL: https://ark.cn-beijing...          │
│ 状态: ● 正常                                  │
│ ──────────────────────────────────────────── │
│ 模型名称          │ 模型 ID      │ 部署  │ 状态 │ 操作 │
│ Doubao Seed Pro   │ doubao-s...  │ 云端  │ 正常 │ ... │
│ DeepSeek V3.2     │ deepseek...  │ 云端  │ 正常 │ ... │
│                        [+ 添加模型]           │
└─────────────────────────────────────────────┘
```

### Anti-Patterns to Avoid
- **Don't nest model routes under provider routes in Elysia:** Elysia plugin composition makes deeply nested routes complex. Keep `/providers` and `/models` as separate route groups. Models reference `providerId` in their body/params, not via URL nesting.
- **Don't encrypt API keys in v1:** This is a single-tenant internal tool. Encryption adds complexity (key management, rotation) without meaningful security gain. Store as varchar, add TODO for production hardening.
- **Don't use the openai npm package:** We only need one fetch call for connectivity testing. The full SDK is unnecessary overhead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request timeout | Manual timeout with Promise.race | `AbortSignal.timeout(ms)` | Built into Bun/Web APIs, handles cleanup correctly |
| Form validation | Custom validation framework | Elysia's `t.Object()` (TypeBox) | Already used in document-types, handles validation + OpenAPI |
| UUID generation | Custom ID generation | PostgreSQL `gen_random_uuid()` via Drizzle `defaultRandom()` | Already established pattern in schema.ts |
| Toast notifications | Custom notification system | Existing `showToast()` utility | Already built and in use |

**Key insight:** This phase adds no new technical domains. It extends established patterns (CRUD, modals, status toggles) with one new concern: an outbound HTTP call for connectivity testing, which native fetch handles well.

## Common Pitfalls

### Pitfall 1: Connectivity Test Model Requirement
**What goes wrong:** The Chat Completions endpoint requires a `model` field. If the provider has no models configured yet, what model ID to use for testing?
**Why it happens:** Provider creation and model creation are separate steps.
**How to avoid:** The test endpoint should accept an optional `testModelId` parameter. If not provided, use a hardcoded default (`doubao-seed-2.0-lite` for Coding Plan). Alternatively, require at least the model field in the test request body.
**Warning signs:** Test always fails with "model not found" error.

### Pitfall 2: Cascade Status Race Condition
**What goes wrong:** Admin disables provider while another admin is editing a model under it.
**Why it happens:** No transaction isolation between cascade update and individual model update.
**How to avoid:** Use a database transaction for the cascade status update. In practice, this is a low-risk internal tool with few admins, but wrapping in `db.transaction()` is cheap insurance.
**Warning signs:** Model shows "active" after provider was disabled.

### Pitfall 3: API Key Exposure in Frontend
**What goes wrong:** API key is returned in full in list/get responses, visible in browser dev tools.
**Why it happens:** Backend returns all fields without filtering.
**How to avoid:** Backend should mask the API key in responses (e.g., return `"sk-...abc123"` showing only last 6 chars). Only store and use the full key server-side. The full key is never sent back to the frontend after creation.
**Warning signs:** API key visible in network tab of browser dev tools.

### Pitfall 4: Base URL Trailing Slash Inconsistency
**What goes wrong:** User enters `https://ark.cn-beijing.volces.com/api/v3/` with trailing slash, and the test endpoint concatenates to `https://...v3//chat/completions`.
**Why it happens:** No URL normalization.
**How to avoid:** Strip trailing slashes from `baseUrl` before saving to DB. Simple: `baseUrl.replace(/\/+$/, "")`.
**Warning signs:** 404 errors during connectivity test despite correct base URL.

### Pitfall 5: Eden Treaty Type Inference for New Routes
**What goes wrong:** Frontend Eden Treaty client doesn't see new provider/model routes.
**Why it happens:** New route modules not registered in backend `index.ts`, or TypeScript not picking up the chain.
**How to avoid:** Register new routes in `packages/backend/src/index.ts` via `.use(providerRoutes).use(modelRoutes)` — the `App` type export will automatically include them. Ensure the chain order is correct.
**Warning signs:** TypeScript errors in frontend when accessing `api.api.providers`.

## Code Examples

### Database Schema Extension
```typescript
// In packages/backend/src/db/schema.ts

export const providerTypeEnum = pgEnum("provider_type", ["openai_compatible"]);
export const deploymentTypeEnum = pgEnum("deployment_type", ["cloud", "local"]);

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: providerTypeEnum("type").default("openai_compatible").notNull(),
  baseUrl: varchar("base_url", { length: 500 }).notNull(),
  apiKey: varchar("api_key", { length: 500 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const models = pgTable("models", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id),
  modelId: varchar("model_id", { length: 200 }).notNull(), // e.g. "doubao-seed-2.0-pro"
  displayName: varchar("display_name", { length: 100 }).notNull(),
  deploymentType: deploymentTypeEnum("deployment_type").default("cloud").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isProviderDisabled: boolean("is_provider_disabled").default(false).notNull(),
  // Deferred v1: parameters JSONB, cli_template varchar
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Shared Types Extension
```typescript
// In packages/shared/src/types.ts

export type ProviderType = "openai_compatible";
export type DeploymentType = "cloud" | "local";

export interface Provider extends BaseEntity {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyMasked: string; // Never expose full key
  isActive: boolean;
}

export interface Model extends BaseEntity {
  providerId: string;
  modelId: string;
  displayName: string;
  deploymentType: DeploymentType;
  isActive: boolean;
  isProviderDisabled: boolean;
}
```

### Route Registration
```typescript
// In packages/backend/src/index.ts
import { providerRoutes } from "./modules/providers/providers.routes";
import { modelRoutes } from "./modules/models/models.routes";

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok" as const, timestamp: new Date().toISOString() }))
  .use(authRoutes)
  .use(userRoutes)
  .use(documentTypeRoutes)
  .use(providerRoutes)
  .use(modelRoutes)
  .listen(3001);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| openai npm SDK for all AI calls | Native fetch for simple calls, SDK only when streaming needed | 2025+ | Reduces dependency size, simpler for non-streaming use |
| Separate admin pages per entity | Combined card layout for parent-child entities | UI pattern | Better UX when entities are tightly coupled |

**Deprecated/outdated:**
- The original v1 requirement specified CLI command line (`claude -p "prompt"`) as the primary invocation method. This has been deferred in favor of OpenAI-compatible API calls.

## Open Questions

1. **Connectivity test model ID**
   - What we know: Test needs a model ID. Provider may have no models yet at test time.
   - What's unclear: Should test use a hardcoded model or require user to specify?
   - Recommendation: Accept optional `modelId` in the test request. Default to first model under the provider, or hardcode `doubao-seed-2.0-lite` as fallback. This is Claude's discretion per CONTEXT.md.

2. **Delete provider with existing models**
   - What we know: Providers own models via FK.
   - What's unclear: Should deleting a provider cascade-delete its models, or block deletion?
   - Recommendation: Block deletion if models exist (consistent with document-types pattern which blocks on associated documents). Require admin to delete models first, or add a "force delete" confirmation.

3. **API key edit UX**
   - What we know: API key is masked in responses.
   - What's unclear: How to handle the edit form — show masked key, require re-entry, or leave blank to keep unchanged?
   - Recommendation: In the edit modal, show the key field as empty with placeholder "保持原密钥不变，或输入新密钥". If left empty, don't update the key. This is Claude's discretion.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis — `packages/backend/src/modules/document-types/` (CRUD pattern reference)
- Existing codebase analysis — `packages/backend/src/db/schema.ts` (Drizzle schema pattern)
- Existing codebase analysis — `packages/frontend/src/pages/admin/DocumentTypeManagement.tsx` (frontend CRUD pattern)
- Phase 2 CONTEXT.md — user decisions and locked constraints

### Secondary (MEDIUM confidence)
- OpenAI Chat Completions API format — well-documented standard, 火山方舟 is confirmed OpenAI-compatible
- Drizzle ORM pgEnum and pgTable patterns — consistent with existing usage in schema.ts

### Tertiary (LOW confidence)
- None — this phase uses established patterns with no new technical domains

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all libraries already in use
- Architecture: HIGH — extends established CRUD pattern with well-understood parent-child relationship
- Pitfalls: HIGH — identified from direct codebase analysis and common API integration patterns

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
