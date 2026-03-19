# Phase 7: Model Parameter Configuration - Research

**Researched:** 2026-03-19
**Domain:** Database schema extension, backend API extension, frontend form extension for model parameters
**Confidence:** HIGH

## Summary

Phase 7 adds temperature, max_tokens, and top_p parameter configuration to the existing model add/edit flow. This is a straightforward extension of the Phase 2 implementation: three nullable numeric columns added to the `models` table, backend route body schemas expanded, and frontend model modal form extended with parameter input fields.

The existing codebase provides a clean, well-established pattern. The `models` table in `packages/backend/src/db/schema.ts` currently has 7 columns (id, providerId, modelId, displayName, isActive, isProviderDisabled, createdAt, updatedAt). The service layer in `models.service.ts` uses explicit column selection (`modelColumns`) and typed input parameters. The frontend `ModelConfiguration.tsx` uses `createSignal`-based form state with `modelForm` containing `modelId` and `displayName`. All three layers need parallel extension.

The migration strategy uses `drizzle-kit push` (not migration files), as established in the project's `db:push` npm script. The database uses PostgreSQL with `drizzle-orm` v0.39.3.

**Primary recommendation:** Add three nullable `real` columns (temperature, maxTokens, topP) to the models table schema, extend the service/route/frontend form in parallel. Use number inputs with step/min/max attributes for frontend validation. Keep parameters nullable to preserve "use API defaults" behavior.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked -- all implementation details are at Claude's discretion.

### Claude's Discretion
- **Parameter defaults and constraints** -- default values, min/max ranges, whether optional
- **UI layout and interaction** -- field position in model modal, input method (slider/number input), whether collapsible
- **Parameter scope** -- this phase stores model-level default parameters only, for later use by workflow nodes
- **Database schema design** -- field types, nullable strategy, migration approach
- **API interface changes** -- create/update model request body extension, response body changes
- **Frontend validation logic** -- input range validation, error messages

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIMC-05 | Admin can add model under Provider (model ID, display name, deployment type, parameter configuration) | Extend POST `/models` body schema with optional temperature, maxTokens, topP fields; extend DB insert; extend frontend model form |
| AIMC-09 | Model supports parameter configuration (temperature, max_tokens, top_p, etc.) | Three nullable real columns in models table; persisted via service layer; returned in API responses; editable in frontend modal |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.39.3 | ORM for schema definition and queries | Already in use; models table defined here |
| drizzle-kit | ^0.30.5 | Schema push to database | Already in use; `bun run db:push` workflow |
| elysia | ^1.2.25 | Backend HTTP framework with typebox validation | Already in use; routes use `t.Object` for body schemas |
| solid-js | (current) | Frontend reactive framework | Already in use; `createSignal` + `onInput` pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sinclair/typebox | (bundled with elysia) | Request body schema validation | Route body definitions use `t.Object`, `t.Optional`, `t.Number` |

### Alternatives Considered
None -- this phase extends existing patterns, no new libraries needed.

**Installation:**
No new packages required.

## Architecture Patterns

### Recommended Change Structure
```
packages/backend/src/db/schema.ts          # Add 3 columns to models table
packages/backend/src/modules/models/
  models.service.ts                         # Extend ModelRow type, modelColumns, createModel, updateModel
  models.routes.ts                          # Extend POST/PATCH body schemas with optional numeric fields
packages/frontend/src/pages/admin/
  ModelConfiguration.tsx                    # Extend Model type, modelForm signal, modal form UI
```

### Pattern 1: Nullable Columns for Optional Parameters
**What:** Use nullable `real` columns (not `doublePrecision`) for temperature, maxTokens, topP. Null means "use API default."
**When to use:** When parameters are optional and absence has semantic meaning (use defaults).
**Example:**
```typescript
// In schema.ts - extend the models table
import { boolean, pgEnum, pgTable, real, integer, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const models = pgTable("models", {
  // ... existing columns ...
  temperature: real("temperature"),      // nullable, null = use API default
  maxTokens: integer("max_tokens"),      // nullable, null = use API default
  topP: real("top_p"),                   // nullable, null = use API default
});
```

### Pattern 2: Extend Service Layer with Explicit Column Selection
**What:** The service uses `modelColumns` object for explicit SELECT. New columns must be added there and to the `ModelRow` type.
**When to use:** Always -- the existing pattern requires it.
**Example:**
```typescript
// In models.service.ts
export type ModelRow = {
  // ... existing fields ...
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
};

const modelColumns = {
  // ... existing columns ...
  temperature: models.temperature,
  maxTokens: models.maxTokens,
  topP: models.topP,
} as const;
```

### Pattern 3: Typebox Optional Numeric Validation
**What:** Elysia uses `@sinclair/typebox` for runtime validation. Use `t.Optional(t.Nullable(t.Number()))` for optional numeric fields with range constraints.
**When to use:** Route body schema definitions.
**Example:**
```typescript
// In models.routes.ts - POST body
body: t.Object({
  providerId: t.String(),
  modelId: t.String({ minLength: 1, maxLength: 200 }),
  displayName: t.String({ minLength: 1, maxLength: 100 }),
  temperature: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 2 }))),
  maxTokens: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 1000000 }))),
  topP: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 1 }))),
}),
```

### Pattern 4: Frontend Form Extension with createSignal
**What:** Extend `modelForm` signal to include parameter fields. Use number inputs with HTML5 validation attributes.
**When to use:** Model create/edit modal form.
**Example:**
```typescript
// In ModelConfiguration.tsx
const [modelForm, setModelForm] = createSignal({
  modelId: "",
  displayName: "",
  temperature: null as number | null,
  maxTokens: null as number | null,
  topP: null as number | null,
});
```

### Anti-Patterns to Avoid
- **Storing parameters as JSON blob:** Don't use a `jsonb` column for parameters. Individual typed columns enable SQL-level validation and cleaner queries.
- **Non-nullable with magic defaults:** Don't use `default(1.0)` on columns. Null semantics ("use API default") are clearer than a magic number that might coincidentally match the API default.
- **Coupling parameter validation to model creation:** Don't reject model creation if parameters are out of range silently. Show clear validation errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number input validation | Custom JS validation | HTML5 `type="number"` with `min`/`max`/`step` + Typebox backend validation | Browser-native, accessible, consistent |
| Schema migration | Manual SQL ALTER TABLE | `bun run db:push` (drizzle-kit push) | Established project workflow, handles column additions |
| API type safety | Manual type assertions | Eden Treaty (already configured) | Automatic type inference from Elysia routes |

**Key insight:** This phase requires zero new infrastructure. Every tool needed is already in place from Phase 2.

## Common Pitfalls

### Pitfall 1: Forgetting to Update modelColumns
**What goes wrong:** New columns added to schema but not to the `modelColumns` selection object in `models.service.ts`, so they're never returned from queries.
**Why it happens:** The service uses explicit column selection (not `select *`), so new columns are invisible until added.
**How to avoid:** Update `modelColumns`, `ModelRow` type, and the frontend `Model` type as a single atomic change.
**Warning signs:** API returns model without parameter fields despite DB having the data.

### Pitfall 2: Incorrect Typebox Schema for Nullable Optional Numbers
**What goes wrong:** Using `t.Optional(t.Number())` allows undefined but not null. The frontend might send `null` to clear a parameter value.
**Why it happens:** TypeBox distinguishes between optional (can be absent) and nullable (can be null).
**How to avoid:** Use `t.Optional(t.Nullable(t.Number()))` to accept both undefined and null.
**Warning signs:** 422 validation errors when trying to clear a parameter value.

### Pitfall 3: Form State Not Reset When Switching Between Create/Edit
**What goes wrong:** Opening "create model" after editing a model shows the previous model's parameter values.
**Why it happens:** `openCreateModel` resets `modelForm` but new parameter fields might be forgotten.
**How to avoid:** Ensure `openCreateModel` resets all fields including temperature, maxTokens, topP to null. Ensure `openEditModel` populates them from the model object.
**Warning signs:** Stale parameter values appearing in the create form.

### Pitfall 4: max_tokens Type Mismatch
**What goes wrong:** Using `real` (float) for max_tokens when it should be an integer.
**Why it happens:** Grouping all three parameters together as "numeric" without considering their semantics.
**How to avoid:** Use `integer` for max_tokens, `real` for temperature and top_p.
**Warning signs:** Fractional max_tokens values like 4096.5 being accepted.

## Code Examples

### Database Schema Extension
```typescript
// packages/backend/src/db/schema.ts
import { boolean, integer, pgEnum, pgTable, real, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const models = pgTable("models", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").notNull().references(() => providers.id),
  modelId: varchar("model_id", { length: 200 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isProviderDisabled: boolean("is_provider_disabled").default(false).notNull(),
  temperature: real("temperature"),         // 0.0-2.0, null = API default
  maxTokens: integer("max_tokens"),         // 1-1000000, null = API default
  topP: real("top_p"),                      // 0.0-1.0, null = API default
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Frontend Number Input with Validation
```tsx
{/* Temperature field */}
<div>
  <label for="model-temperature" class={labelClass}>
    Temperature
    <span class="text-xs text-slate-400 ml-1">（可选，留空使用默认值）</span>
  </label>
  <input
    id="model-temperature"
    type="number"
    min="0"
    max="2"
    step="0.1"
    value={modelForm().temperature ?? ""}
    onInput={(e) => {
      const val = e.currentTarget.value;
      setModelForm((f) => ({
        ...f,
        temperature: val === "" ? null : Number.parseFloat(val),
      }));
    }}
    class={inputClass}
    placeholder="0.0 - 2.0"
  />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store params as JSON blob | Individual typed columns | Best practice | SQL validation, type safety, cleaner queries |
| Required params with defaults | Nullable params (null = use API default) | Common pattern | Clearer semantics, no magic numbers |

**Deprecated/outdated:**
- None relevant -- this is standard CRUD extension work.

## Open Questions

1. **Parameter display in model list rows**
   - What we know: Parameters need to be configurable in the add/edit modal
   - What's unclear: Whether parameter values should be visible in the model list table rows (the grid under each provider card)
   - Recommendation: Don't show parameters in the list rows -- the grid columns are already tight (displayName, modelId, status, actions). Parameters are visible when editing. This keeps the UI clean.

2. **Collapsible parameter section in modal**
   - What we know: The model modal currently has just 2 fields (modelId, displayName). Adding 3 more fields makes it longer.
   - What's unclear: Whether to use a collapsible/accordion section or just show all fields
   - Recommendation: Show all fields directly without collapsing. 5 fields is still a short form. A collapsible section adds interaction complexity for minimal benefit.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/backend/src/db/schema.ts` -- current models table definition
- Codebase analysis: `packages/backend/src/modules/models/models.service.ts` -- service layer patterns (ModelRow, modelColumns, createModel, updateModel)
- Codebase analysis: `packages/backend/src/modules/models/models.routes.ts` -- route body schema patterns (t.Object, t.Optional, t.String)
- Codebase analysis: `packages/frontend/src/pages/admin/ModelConfiguration.tsx` -- frontend form patterns (createSignal, modelForm, openCreateModel, openEditModel, handleModelSubmit)
- Codebase analysis: `packages/backend/drizzle.config.ts` -- migration uses drizzle-kit push
- Phase 2 research: `.planning/phases/02-ai-provider-and-model-configuration/02-RESEARCH.md` -- original model configuration patterns

### Secondary (MEDIUM confidence)
- OpenAI API parameter ranges: temperature 0-2, top_p 0-1, max_tokens model-dependent (standard across OpenAI-compatible APIs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, extending existing patterns
- Architecture: HIGH - direct codebase analysis of exact files to modify
- Pitfalls: HIGH - common patterns well understood from Phase 2 implementation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- no external dependencies)
