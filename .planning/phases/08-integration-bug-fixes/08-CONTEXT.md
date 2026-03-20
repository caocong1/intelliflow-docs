# Phase 8: Integration Bug Fixes - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three cross-phase integration issues discovered during v1.0 audit: validation overlay response shape mismatch, model list missing provider display names, and shared Model type out of sync with backend schema. No new features — pure bug fixes.

</domain>

<decisions>
## Implementation Decisions

### Validation overlay response shape (BROKEN-01)
- Fix frontend to match backend's actual response: `{ valid, errors }` (not `{ data: { errors } }`)
- Frontend WorkflowEditor.tsx line 181 incorrectly wraps in `result.data?.errors` — should read `errors` directly from response
- Keep backend response shape as-is (it's correct and clean)

### Model list provider name (MISSING-01)
- Add LEFT JOIN on `providers` table in `listActiveModels()` to include `providerName` field
- Return `providerName` alongside existing model fields
- Frontend model call config node uses this to group/label models by provider display name instead of UUID
- Update `ModelRow` type to include `providerName: string`

### Shared Model type sync (MISSING-02)
- Add `temperature`, `maxTokens`, `topP` optional fields to `Model` interface in `shared/types.ts`
- Fields should be `number | null` to match backend schema and `ModelRow`
- Check all frontend consumers of `Model` type to ensure they handle the new optional fields gracefully

### Claude's Discretion
- Exact frontend parsing logic for validation response
- Whether to also add `providerName` to the shared `Model` type or keep it backend-only
- Any additional type cleanup discovered during the fix

</decisions>

<specifics>
## Specific Ideas

No specific requirements — user confirmed all three bugs should be fixed in the most reasonable way. Straightforward bug fixes with minimal blast radius.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ValidationOverlay.tsx`: Already well-structured component, only needs correct data input
- `ValidationError` type: Already defined in both `shared/types.ts` (`WorkflowValidationError`) and `ValidationOverlay.tsx` — should align
- `modelColumns` in `models.service.ts`: Central column selection object, easy to extend with JOIN fields

### Established Patterns
- Backend routes return `{ data: [...] }` for list endpoints but `{ valid, errors }` for validation — frontend must handle both shapes
- Drizzle ORM with explicit column selection (`modelColumns` object pattern)
- Shared types in `packages/shared/src/types.ts` are the contract between frontend and backend

### Integration Points
- `WorkflowEditor.tsx:178-182`: Validation response parsing (bug site)
- `models.service.ts:33-38`: `listActiveModels()` query (bug site)
- `models.routes.ts:14-19`: GET `/models/` endpoint returning active models
- `shared/types.ts:51-57`: `Model` interface definition (bug site)
- `ModelConfiguration.tsx`: Frontend model admin page (consumer of model data)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-integration-bug-fixes*
*Context gathered: 2026-03-20*
