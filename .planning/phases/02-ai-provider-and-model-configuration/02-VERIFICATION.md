---
phase: 02-ai-provider-and-model-configuration
verified: 2026-03-19T00:00:00Z
status: human_needed
score: 15/15 must-haves verified (automated)
human_verification:
  - test: "Full provider and model CRUD flow in browser"
    expected: "Admin can create, edit, toggle, delete providers and models end-to-end with no JS errors"
    why_human: "Card layout rendering, modal behavior, form submission flow, and toast display require browser verification"
  - test: "Connectivity test button"
    expected: "Click '测试连接' shows spinner, then toast with '连接成功, 延迟: Xms' or error message"
    why_human: "Real HTTP dispatch and toast feedback require runtime verification"
  - test: "Cascade status visualization"
    expected: "Toggling a provider to '停用' immediately greys out all its model rows; re-enabling restores normal appearance"
    why_human: "Visual opacity cascade and reactive state update require browser verification"
  - test: "Non-admin user access"
    expected: "Non-admin cannot see 'AI 模型配置' in sidebar; direct navigation to /admin/model-config shows Forbidden"
    why_human: "Role-based rendering and route guard behavior require browser verification"
  - test: "Delete provider blocked when models exist"
    expected: "Clicking delete on a provider with models shows error toast '请先删除该供应商下的所有模型'"
    why_human: "Error response handling from backend 409 through to toast display requires runtime verification"
---

# Phase 2: AI Provider and Model Configuration — Verification Report

**Phase Goal:** AI provider and model configuration admin page with CRUD, connectivity testing, and cascade status
**Verified:** 2026-03-19
**Status:** human_needed — all automated checks pass; 5 items require browser verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Provider CRUD endpoints return correct JSON responses | VERIFIED | `providers.routes.ts` exposes GET, POST, PATCH /:id, DELETE /:id, PATCH /:id/status, POST /:id/test — all wired to service functions with error handling |
| 2 | Model CRUD endpoints return correct JSON responses under a provider | VERIFIED | `models.routes.ts` exposes GET /by-provider/:providerId, POST, PATCH /:id, DELETE /:id, PATCH /:id/status — all wired to service functions |
| 3 | Connectivity test sends Chat Completions POST (openai_compatible) or GET /global/health (opencode) and returns success/failure with latency | VERIFIED | `providers.service.ts` lines 205–231: branches on `provider.type`, uses `AbortSignal.timeout(15000)`, measures `Date.now()` before/after, returns `{ success, message, latencyMs }` |
| 4 | Disabling a provider cascades to all its models; re-enabling restores original model states | VERIFIED | `toggleProviderStatus()` uses `db.transaction()`, flips `isActive`, then sets `isProviderDisabled = true/false` on all child models (lines 167–179) |
| 5 | API key masked in all response payloads (only last 6 chars visible) | VERIFIED | `maskApiKey()` in providers.service.ts returns `"sk-...${key.slice(-6)}"` or `"***"`; `toProviderRow()` always applies masking; `apiKey` column never selected in `providerColumns` response projection |
| 6 | Base URL trailing slashes stripped on save | VERIFIED | `stripTrailingSlashes(url)` called in both `createProvider()` and `updateProvider()` (lines 90, 107) |
| 7 | Admin can see a card-layout page listing all providers with their models | VERIFIED | `ModelConfiguration.tsx` 830 lines: card layout, `For each={providers()}`, embedded model mini-table per card, loading skeleton, empty state |
| 8 | Admin can create/edit a provider via modal (conditional fields by type) | VERIFIED | Provider modal (lines 620–744): type select disables on edit, conditional `<Show>` renders API Key for openai_compatible or username+password for opencode, form submits via Eden Treaty |
| 9 | Admin can test provider connectivity and see toast result | VERIFIED | `handleTestConnection()` calls `api.api.providers({id}).test.post()`, shows `showToast("连接成功, 延迟: ${result.latencyMs}ms", "success")` or error toast; button shows spinner during test |
| 10 | Admin can enable/disable a provider and cascade models visually | VERIFIED | `handleToggleProvider()` calls `api.api.providers({id}).status.patch()`; model list div has `opacity-50` class when `!provider.isActive`; individual model rows have `opacity-50` when `model.isProviderDisabled` |
| 11 | Admin can add/edit/delete/toggle models under a provider | VERIFIED | Model modal, `handleModelSubmit()`, `handleToggleModel()`, `handleDelete()` all wired via Eden Treaty `api.api.models` |
| 12 | Sidebar shows 'AI 模型配置' nav item for admin users only | VERIFIED | `Sidebar.tsx` line 79: `<A href="/admin/model-config">` inside `<Show when={auth.isAdmin()}>` block |
| 13 | Route registered at /admin/model-config behind AdminRoute guard | VERIFIED | `App.tsx` lines 61–67: `<Route path="/admin/model-config">` wrapped in `<AdminRoute>` component |
| 14 | providerRoutes and modelRoutes registered in Elysia app | VERIFIED | `index.ts` lines 4–5: imports both; lines 16–17: `.use(providerRoutes).use(modelRoutes)` chained after documentTypeRoutes |
| 15 | providers and models tables defined with correct schema | VERIFIED | `schema.ts`: `providerTypeEnum`, `deploymentTypeEnum`, `providers` table with FK-free columns, `models` table with `providerId` FK, `isProviderDisabled` column |

**Score:** 15/15 automated truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/db/schema.ts` | providers and models table definitions with enums | VERIFIED | Contains `providerTypeEnum`, `deploymentTypeEnum`, `providers`, `models` tables. Note: `deploymentType` moved to providers table (Plan 02 deviation) |
| `packages/shared/src/types.ts` | Provider, Model, ProviderType, DeploymentType types | VERIFIED | All 6 types present: `ProviderType`, `DeploymentType`, `Provider`, `Model`, `ProviderWithModels`, `ConnectivityTestResult`. `Provider` includes `deploymentType` reflecting the schema change |
| `packages/backend/src/modules/providers/providers.service.ts` | Provider CRUD + connectivity test | VERIFIED | 261 lines; exports `listProviders`, `createProvider`, `updateProvider`, `deleteProvider`, `toggleProviderStatus`, `testProviderConnection` + `maskApiKey` helper |
| `packages/backend/src/modules/providers/providers.routes.ts` | Elysia routes for provider endpoints | VERIFIED | Exports `providerRoutes`; 6 endpoints all behind `requireAdmin`; typed body schemas |
| `packages/backend/src/modules/models/models.service.ts` | Model CRUD business logic | VERIFIED | 117 lines; exports `listModelsByProvider`, `createModel`, `updateModel`, `deleteModel`, `toggleModelStatus` |
| `packages/backend/src/modules/models/models.routes.ts` | Elysia routes for model endpoints | VERIFIED | Exports `modelRoutes`; 5 endpoints all behind `requireAdmin` |
| `packages/frontend/src/pages/admin/ModelConfiguration.tsx` | Card-layout page for provider and model management | VERIFIED | 830 lines (well above 200-line minimum); card layout, all CRUD modals, connectivity test, cascade visualization |
| `packages/frontend/src/components/nav/Sidebar.tsx` | Updated sidebar with AI model config nav item | VERIFIED | Line 79: `href="/admin/model-config"` with text "AI 模型配置" inside admin `<Show>` block |
| `packages/frontend/src/App.tsx` | Route registration for /admin/model-config | VERIFIED | `ModelConfiguration` imported and routed at `/admin/model-config` inside `<AdminRoute>` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/backend/src/index.ts` | `providerRoutes`, `modelRoutes` | `.use()` plugin registration | VERIFIED | Lines 16–17: `.use(providerRoutes).use(modelRoutes)` present |
| `providers.service.ts` | `schema.ts` providers table | Drizzle ORM queries | VERIFIED | `db.select(providerColumns).from(providers)` in `listProviders()`, `createProvider()`, etc. |
| `models.service.ts` | `schema.ts` models table | Drizzle ORM queries | VERIFIED | `db.select(modelColumns).from(models)` in `listModelsByProvider()`, etc. |
| `ModelConfiguration.tsx` | `/api/providers` | Eden Treaty client | VERIFIED | `api.api.providers.get()`, `api.api.providers.post()`, `api.api.providers({id}).patch()`, `.delete()`, `.status.patch()`, `.test.post()` |
| `ModelConfiguration.tsx` | `/api/models` | Eden Treaty client | VERIFIED | `api.api.models["by-provider"]({providerId}).get()`, `api.api.models.post()`, `api.api.models({id}).patch()`, `.delete()`, `.status.patch()` |
| `Sidebar.tsx` | `/admin/model-config` | A tag href | VERIFIED | Line 79: `<A href="/admin/model-config">` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AIMC-01 | 02-01, 02-02 | 管理员可创建 Provider 实例（选择类型、填写名称、API 地址、认证信息） | SATISFIED | `createProvider()` + POST /api/providers + provider modal form with type/name/baseUrl/apiKey/username fields |
| AIMC-02 | 02-01, 02-02 | 管理员可编辑和删除 Provider 实例 | SATISFIED | `updateProvider()` + `deleteProvider()` (blocked if has models) + edit/delete modal UI |
| AIMC-03 | 02-01, 02-02 | 管理员可测试 Provider 连通性 | SATISFIED | `testProviderConnection()` branches by type; UI shows spinner + toast result |
| AIMC-04 | 02-01, 02-02 | 管理员可启用/停用 Provider 实例 | SATISFIED | `toggleProviderStatus()` in transaction with cascade; toggle button in card header |
| AIMC-05 | 02-01, 02-02 | 管理员可在 Provider 下添加模型（模型 ID、显示名称、部署类型、调用方式、参数配置） | PARTIALLY SATISFIED | Model ID, display name implemented. Deployment type moved to provider level (intentional). CLI call template and parameter config deferred (AIMC-08/09) |
| AIMC-06 | 02-01, 02-02 | 管理员可编辑、启用/停用、删除模型 | SATISFIED | `updateModel()`, `toggleModelStatus()`, `deleteModel()` + edit/toggle/delete UI per model row |
| AIMC-07 | 02-01, 02-02 | 模型支持标记部署类型（线上云端/本地私有） | SATISFIED | `deploymentType` enum on providers table (moved from models in Plan 02); shown as badge in card header |
| AIMC-08 | (orphaned — no plan claimed it) | 模型支持配置 CLI 命令行调用模板（v1 首选） | NOT IMPLEMENTED | Explicitly deferred in plan: "parameters and cliTemplate NOT added in v1 per user decision". REQUIREMENTS.md marks as Pending. This is an acknowledged deferral. |
| AIMC-09 | (orphaned — no plan claimed it) | 模型支持配置参数（temperature、max_tokens、top_p 等） | NOT IMPLEMENTED | Same deferral decision as AIMC-08. REQUIREMENTS.md marks as Pending. Acknowledged deferral. |

**AIMC-08 and AIMC-09 are orphaned** — mapped to Phase 2 in REQUIREMENTS.md but claimed by no plan. Both are explicitly deferred by user decision documented in the PLAN. They remain unchecked in REQUIREMENTS.md. No gap is raised here because the deferral is intentional and documented, but they must be assigned to a future phase.

---

## Schema Deviation: deploymentType Location

Plan 01 placed `deploymentType` on the `models` table. Plan 02 (during user testing) moved it to the `providers` table. This is reflected consistently across:
- `schema.ts` — `deploymentType` on `providers`, absent from `models`
- `shared/src/types.ts` — `Provider` interface has `deploymentType`, `Model` does not
- `providers.service.ts` and `providers.routes.ts` — handle `deploymentType` in provider CRUD
- `ModelConfiguration.tsx` — `deploymentType` select in provider form, badge shown in provider card header

The PLAN 01 `must_haves` specified `deploymentType` on models, but the implemented design is coherent and was explicitly decided during verification. This deviation does not break any AIMC requirement.

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `ModelConfiguration.tsx` (multiple lines) | `placeholder=` attribute | Info | Legitimate HTML form placeholder text — not a code stub |

No blockers or warnings found. All service functions have real DB operations. All route handlers call real service functions. No `return null`, `return {}`, or console-only implementations found.

---

## Human Verification Required

### 1. Full CRUD Flow

**Test:** Log in as admin, navigate to "AI 模型配置" in the sidebar. Create a provider (OpenAI 兼容 type, any name, any base URL, any API key). Verify the provider card appears. Edit the name. Toggle status to disabled. Re-enable. Add a model under the provider. Edit the model. Toggle model status. Delete the model. Delete the provider.
**Expected:** Each operation completes without JS errors. After each mutation the list refreshes to reflect the change. Provider card shows badges for type, deployment type, and status.
**Why human:** Card layout rendering, modal open/close behavior, form wiring, and reactive list refresh require browser verification.

### 2. Connectivity Test

**Test:** With a provider created, click "测试连接" on its card.
**Expected:** Button shows "测试中..." with spinner. After response, a toast appears: green "连接成功, 延迟: Xms" if the endpoint is reachable, or red error message if not. Button returns to normal state.
**Why human:** Real HTTP dispatch to external endpoint and toast lifecycle require runtime verification.

### 3. Cascade Status Visualization

**Test:** Create a provider with at least one model. Toggle the provider to "停用".
**Expected:** The entire model list section greys out (opacity-50). Model status badge shows "供应商已停用" (warning variant). Toggle the provider back to "启用" — models return to normal appearance.
**Why human:** Visual opacity transition and reactive signal cascade require browser verification.

### 4. Non-Admin Access Control

**Test:** Log in as a non-admin user. Verify sidebar does not show "AI 模型配置". Navigate directly to `/admin/model-config`.
**Expected:** Sidebar shows no "AI 模型配置" entry. Direct URL navigation shows the Forbidden page.
**Why human:** Role-conditional rendering and `<AdminRoute>` fallback require browser verification.

### 5. Provider Delete Blocked by Models

**Test:** Create a provider with at least one model. Click "删除" on the provider (without first deleting the model).
**Expected:** Delete confirmation modal opens. On confirm, an error toast appears: "请先删除该供应商下的所有模型".
**Why human:** 409 error response path through Eden Treaty to toast display requires runtime verification.

---

## Gaps Summary

No automated gaps found. All 15 must-have truths verified. All 9 artifacts exist and are substantive and wired. All 6 key links confirmed.

AIMC-08 and AIMC-09 are intentionally deferred with user approval and are recorded as Pending in REQUIREMENTS.md. They should be assigned to a future phase (Phase 3 or a dedicated backlog phase).

AIMC-05 is marked partially satisfied because model-level parameter configuration and CLI template (the "调用方式、参数配置" parts of the requirement) are covered by AIMC-08 and AIMC-09 which are deferred. The core "add model with ID and display name" functionality is fully implemented.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
