# Phase 9: Integration Polish & UX Guards - Research

**Researched:** 2026-03-20
**Domain:** Backend association guards + Frontend ownership derivation
**Confidence:** HIGH

## Summary

This phase addresses two discrete integration gaps found during the v1.0 audit. Both are well-scoped fixes on existing, working code with clear patterns already established.

**Issue 1 (DTYPE-04-GUARD):** The `deleteDocumentType()` service function currently deletes directly without checking for associated workflows. The `workflows` table has a `documentTypeId` FK referencing `document_types.id`. The user decision specifies a pre-check UX flow: click delete -> async query for associated workflows -> show result in modal (either "cannot delete" with workflow names, or "confirm delete").

**Issue 2 (PROJ-05-ISOWNER):** `ProjectHome.tsx` line 164 uses `project()?.createdBy === auth.user()?.id` to determine ownership, and `ProjectSettings.tsx` line 73 uses the same pattern for access gating. Both should use the `projectMembers` role instead. The project list API already returns `userRole` per project, but the project detail API (`getProject`) does NOT return the current user's role -- it only returns `createdBy` and `memberCount`.

**Primary recommendation:** Add a backend endpoint for checking workflow associations on document type, refactor the frontend delete flow to use a pre-check modal pattern, and either add `userRole` to the project detail API response or use the existing members list endpoint to derive ownership on the frontend.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Click delete button triggers async query for associated workflows (not pre-fetched in list)
- If associated workflows exist: modal shows "cannot delete" + full workflow name list, button disabled
- If no associated workflows: standard confirm modal, user confirms then delete executes
- Only check direct FK associations (workflows.documentTypeId), not indirect document associations
- Reuse existing confirm modal pattern
- Show full workflow name list, no truncation regardless of count
- Copy style: concise professional, state reason + provide resolution suggestion
- Reference copy: "cannot delete: the following workflows are using this document type, please modify or delete these workflows first" + workflow name list
- Fix both ProjectHome.tsx and ProjectSettings.tsx
- isOwner derived from projectMembers role field, not createdBy
- All role=owner members count as owners (supports multi-owner per PROJ-08)

### Claude's Discretion
- Data source approach for identity check (inspect existing API responses, choose best implementation)
- Loading state design for confirm modal
- Workflow name list display styling

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DTYPE-04 | Admin can delete document type (only when no associations) | Backend: add `getWorkflowsByDocumentTypeId()` query; Frontend: pre-check modal pattern with loading/result states |
| PROJ-05 | Project owner can invite/remove members | Frontend: fix `isOwner()` derivation in ProjectHome.tsx and ProjectSettings.tsx to use role-based check instead of createdBy |
</phase_requirements>

## Architecture Patterns

### Issue 1: Document Type Delete Guard

**Current flow (broken):**
```
Click delete -> Confirm modal ("are you sure?") -> Call DELETE API -> DB FK error if workflows exist
```

**Target flow (per user decision):**
```
Click delete -> Loading state -> Call check-associations API ->
  If has workflows: Show "cannot delete" modal with workflow names, button disabled
  If no workflows: Show "confirm delete" modal, user confirms -> Call DELETE API
```

**Backend changes needed:**

1. **New service function** in `document-types.service.ts`: query workflows table for rows matching `documentTypeId`, return workflow names.

```typescript
// document-types.service.ts
export async function getAssociatedWorkflows(documentTypeId: string): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: workflows.id, name: workflows.name })
    .from(workflows)
    .where(eq(workflows.documentTypeId, documentTypeId));
}
```

2. **New route** in `document-types.routes.ts`: `GET /:id/associations` that returns associated workflow names. This keeps the pre-check separate from the delete action.

3. **Optional backend guard**: Also add a guard in `deleteDocumentType()` itself as defense-in-depth (check before delete, throw `HAS_ASSOCIATED_WORKFLOWS` error). The route handler already has a catch for `HAS_ASSOCIATED_DOCUMENTS` -- rename/extend to `HAS_ASSOCIATED_WORKFLOWS`.

**Frontend changes needed:**

4. **Extend `confirmAction` state** in `DocumentTypeManagement.tsx`: Currently `{ docType, action: "toggle" | "delete" }`. Extend to support a loading + result phase:
   - User clicks delete -> set confirmAction with action "delete"
   - Modal opens -> immediately fetches `GET /document-types/:id/associations`
   - Loading state shown in modal
   - If workflows returned: show "cannot delete" message + workflow list, disable confirm button
   - If no workflows: show standard "confirm delete" text, enable confirm button

### Issue 2: Frontend Ownership Derivation

**Current state analysis:**

- `ProjectHome.tsx:164` -- `const isOwner = () => project()?.createdBy === auth.user()?.id;`
- `ProjectSettings.tsx:73` -- `if (proj.createdBy !== auth.user()?.id) { navigate(...); return; }`
- `getProject()` API returns: `{ id, name, description, department, createdBy, memberCount, ... }` -- NO `userRole` field
- `listProjects()` API returns: includes `userRole` field via subquery join
- `listMembers()` API returns: full member list with `role` per member

**Two options for fix:**

**Option A (Recommended): Add `userRole` to getProject() response**
- Modify `getProject()` in `projects.service.ts` to accept `userId` parameter
- Add the same `userRole` subquery used in `listProjects()`
- Update route handler to pass `user!.id`
- Frontend simply reads `userRole` from project detail response
- Minimal frontend change, consistent with list API pattern

**Option B: Use members list on frontend**
- Fetch `/projects/:id/members` and find current user's role
- More API calls, requires both project + members loaded before rendering
- ProjectSettings already fetches members, so partially available

**Option A is cleaner** because it matches the pattern already used in `listProjects()` and requires only a single API response for the frontend to derive ownership.

**Frontend fix pattern:**
```typescript
// ProjectHome.tsx - change from:
const isOwner = () => project()?.createdBy === auth.user()?.id;
// to:
const isOwner = () => project()?.userRole === "owner";

// ProjectSettings.tsx - change from:
if (proj.createdBy !== auth.user()?.id) { navigate(...); }
// to:
if (proj.userRole !== "owner") { navigate(...); }
```

### Established Patterns to Reuse

| Pattern | Where Used | Apply To |
|---------|-----------|----------|
| `confirmAction` signal + Modal | DocumentTypeManagement.tsx L28-31 | Extend for delete pre-check |
| Eden Treaty API calls | All frontend pages | New associations endpoint call |
| Error throw + route catch | document-types.routes.ts L117-126 | Backend guard for delete |
| `userRole` subquery join | projects.service.ts L110-117 | Add to `getProject()` |
| Drizzle `eq()` + `select()` | Throughout backend services | New association query |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Association check | Custom SQL JOIN in delete | Separate query function + reusable endpoint | Clean separation, testable |
| Modal state machine | Complex multi-state signal | Extend existing confirmAction with loading/result phases | Matches existing codebase pattern |

## Common Pitfalls

### Pitfall 1: Race Condition on Delete
**What goes wrong:** User opens delete modal, associations checked (none found), another admin creates a workflow with that document type, user confirms delete -- FK violation.
**How to avoid:** Keep the backend guard in `deleteDocumentType()` as defense-in-depth. The frontend pre-check is UX sugar; the backend must also validate. Return user-friendly error if the backend guard triggers.

### Pitfall 2: Project Detail Type Mismatch
**What goes wrong:** Adding `userRole` to `getProject()` response changes the type. Frontend `ProjectDetail` type in both ProjectHome.tsx and ProjectSettings.tsx must be updated to include `userRole`.
**How to avoid:** Update the `ProjectDetail` type definition in both files to include `userRole: "owner" | "participant" | null`.

### Pitfall 3: ProjectSettings Access Gate Timing
**What goes wrong:** `ProjectSettings.tsx:73` checks ownership during `fetchProject()`. If `userRole` is null (user not a member), the redirect fires. This is correct behavior but must handle the null case properly.
**How to avoid:** Check `proj.userRole !== "owner"` which naturally handles null (non-member) and "participant" cases.

### Pitfall 4: Modal Loading Flash
**What goes wrong:** If the association check returns instantly (no workflows), the modal flashes a loading state for a split second before showing the confirm dialog.
**How to avoid:** Use a minimum display time or render the loading state only after a short delay (e.g., show modal title immediately, show content after API returns).

## Code Examples

### Backend: Association Check Endpoint
```typescript
// document-types.routes.ts - new endpoint
.get(
  "/:id/associations",
  async ({ params, set }) => {
    const workflows = await getAssociatedWorkflows(params.id);
    return { workflows };
  },
  { params: t.Object({ id: t.String() }) },
)
```

### Backend: Defense-in-depth Guard
```typescript
// document-types.service.ts - update deleteDocumentType
export async function deleteDocumentType(id: string): Promise<{ success: true }> {
  const associated = await getAssociatedWorkflows(id);
  if (associated.length > 0) {
    throw new Error("HAS_ASSOCIATED_WORKFLOWS");
  }
  // ... existing delete logic
}
```

### Frontend: Pre-check Modal State
```typescript
// DocumentTypeManagement.tsx - extended state
const [deleteCheckLoading, setDeleteCheckLoading] = createSignal(false);
const [associatedWorkflows, setAssociatedWorkflows] = createSignal<{ id: string; name: string }[]>([]);

// When confirmAction is set to delete, trigger the check
// Use createEffect or inline in the click handler
```

### Frontend: isOwner Fix
```typescript
// ProjectHome.tsx
type ProjectDetail = {
  // ... existing fields
  userRole: "owner" | "participant" | null;
};
const isOwner = () => project()?.userRole === "owner";

// ProjectSettings.tsx
if (proj.userRole !== "owner") {
  navigate(`/projects/${params.id}`, { replace: true });
  return;
}
```

## Open Questions

1. **Route handler error key for workflows**
   - What we know: The route already catches `HAS_ASSOCIATED_DOCUMENTS`. The actual issue is workflows, not documents.
   - Recommendation: Add `HAS_ASSOCIATED_WORKFLOWS` error handling. Keep the existing `HAS_ASSOCIATED_DOCUMENTS` handler for future use when documents table is populated.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all 6 affected files in the repository
- DB schema in `packages/backend/src/db/schema.ts` -- confirmed FK relationship `workflows.documentTypeId -> documentTypes.id`
- `projects.service.ts` -- confirmed `userRole` subquery pattern in `listProjects()` but absent from `getProject()`
- `ProjectHome.tsx:164` and `ProjectSettings.tsx:73` -- confirmed `createdBy` comparison pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all changes within existing codebase patterns
- Architecture: HIGH - both fixes follow established patterns already in the codebase
- Pitfalls: HIGH - identified from direct code inspection of actual implementation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- internal codebase, no external dependency changes)
