# Phase 16: Fix Version History & Dead Code Cleanup - Research

**Researched:** 2026-03-25
**Domain:** SolidJS routing params, dead code cleanup, documentation accuracy
**Confidence:** HIGH

## Summary

Phase 16 addresses a high-severity integration bug where the VersionHistory.tsx component reads route params using `useParams<{ id: string }>()` but the route in App.tsx registers the parameter as `:documentId`. This mismatch means `params.id` is always `undefined`, causing all API calls on the version history page to fail silently. The fix is a single-line change from `{ id: string }` to `{ documentId: string }` plus updating all `params.id` references to `params.documentId`.

Additionally, DocumentDetail.tsx is orphaned dead code -- it exists in the codebase but is never imported or routed to in App.tsx. It can be safely deleted. Finally, REQUIREMENTS.md has a coverage count that needs review based on audit findings.

**Primary recommendation:** Change `useParams<{ id: string }>()` to `useParams<{ documentId: string }>()` in VersionHistory.tsx, update all 3 occurrences of `params.id` to `params.documentId`, delete DocumentDetail.tsx, and correct the REQUIREMENTS.md coverage count.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VER-02 | 用户可查看版本列表（时间线形式） | Fix param mismatch so `listVersions(documentId)` receives actual document ID instead of `undefined`. Backend + Timeline + VersionHistory UI all exist and are correct; only the param binding is broken. |
| VER-03 | 用户可对比两个版本（Diff 查看） | Same param fix enables version loading, which in turn enables the compare mode selection and diff API call. VersionDiff component and backend `getVersionDiff` are fully implemented with LCS algorithm. |
</phase_requirements>

## Architecture Patterns

### The Bug: Route Param Name Mismatch

**Route definition** (App.tsx line 59):
```tsx
<Route path="/documents/:documentId/versions" component={VersionHistory} />
```

**Component reads** (VersionHistory.tsx line 28):
```tsx
const params = useParams<{ id: string }>();
```

SolidJS Router's `useParams` returns an object keyed by the route parameter name. Since the route uses `:documentId`, the params object has a `documentId` property, not `id`. The result: `params.id` is always `undefined`.

**Impact on API calls** (3 occurrences of `params.id`):
1. **Line 44:** `api.api.documents({ id: params.id }).get()` -- fetches document info for breadcrumb (undefined ID = 404)
2. **Line 58:** `api.api.versions.get({ query: { documentId: params.id } })` -- lists versions (undefined = empty/error)
3. **Line 148:** `href={/documents/${params.id}}` -- breadcrumb link (broken href)

### The Fix Pattern

```tsx
// BEFORE (broken)
const params = useParams<{ id: string }>();
// ... params.id (undefined)

// AFTER (fixed)
const params = useParams<{ documentId: string }>();
// ... params.documentId (correct value from URL)
```

### Dead Code: DocumentDetail.tsx

**Evidence it's orphaned:**
- NOT imported in App.tsx (confirmed by grep -- zero matches for `import.*DocumentDetail` in App.tsx)
- NOT imported anywhere else in the codebase (grep found only its own `export default function` declaration)
- The route `/documents/:documentId` maps directly to `DocumentWorkspace` (App.tsx line 58), not DocumentDetail
- Was likely a pre-Phase-13 architecture artifact; Phase 13 refactored document workspace to handle both detail view and execution

**Safe to delete:** DocumentDetail.tsx imports VisibilityBadge, Badge, api client -- all used elsewhere, so no cascade issues.

### REQUIREMENTS.md Coverage Count

Current text (lines 293-298):
```
- v1 requirements: 85 total (AIMC-08 moved to Out of Scope, RECV-03 deferred to v2)
- Mapped to phases: 85
- Satisfied: 82
- Pending: 2 (VER-02, VER-03 -- Phase 16)
- Deferred: 1 (RECV-03)
```

The phase description says to correct to 84. The actual requirement count by enumeration:
- AUTH: 4, AIMC: 8 items listed (01-07, 09; AIMC-08 excluded), DTYPE: 5, FLOW: 13, PROJ: 9, DOC: 5, NODE: 22, NOPS: 4, DMGT: 6, VER: 3, FSYS: 4, RECV: 3
- Total listed in REQUIREMENTS.md: 86 items defined, minus AIMC-08 (Out of Scope) = 85 v1 items
- Of those: 82 satisfied + 2 pending + 1 deferred = 85

**Note:** The "85 total" count appears mathematically correct (85 = 82 + 2 + 1). If the user instruction says correct to 84, the planner should apply the user's stated correction. One interpretation: RECV-03 (deferred to v2) should not count toward v1 total, making it 84 v1 requirements with 82 satisfied + 2 pending.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route param access | Custom URL parsing | `useParams<{ documentId: string }>()` | SolidJS Router's built-in typed params |
| Version diff | New diff algorithm | Existing `computeLineDiff` in versions.service.ts | LCS-based diff already fully implemented |
| Timeline UI | New timeline component | Existing `Timeline` component | Already built and used by VersionHistory |

## Common Pitfalls

### Pitfall 1: Forgetting to Update All param.id References
**What goes wrong:** Changing the type but missing one of the 3 `params.id` usage sites
**How to avoid:** Search for all occurrences of `params.id` in VersionHistory.tsx -- there are exactly 3 (lines 44, 58, 148). All must become `params.documentId`.

### Pitfall 2: Eden Treaty API Path for Document Fetch
**What goes wrong:** The document fetch uses `api.api.documents({ id: params.id }).get()` -- the param key `id` here is the Eden Treaty path parameter, NOT the useParams key. This `id` should stay as `id` in the API call object.
**How to avoid:** Only change the VALUE passed, not the API call structure:
```tsx
// CORRECT: change params.id to params.documentId, keep { id: ... } as the API param
api.api.documents({ id: params.documentId }).get()
```

### Pitfall 3: Not Verifying VisibilityBadge Import Safety
**What goes wrong:** Deleting DocumentDetail.tsx might seem risky if it exports shared components
**How to avoid:** Already verified -- DocumentDetail.tsx only imports from other modules, exports nothing used elsewhere. VisibilityBadge is independently imported by ProjectHome.tsx.

## Code Examples

### Fix 1: VersionHistory.tsx Param Update

```tsx
// Line 28: Change type parameter
const params = useParams<{ documentId: string }>();

// Line 44: Update document fetch
const docRes = await api.api.documents({ id: params.documentId }).get();

// Line 58: Update versions list fetch
const res = await api.api.versions.get({ query: { documentId: params.documentId } });

// Line 148: Update breadcrumb href
<A href={`/documents/${params.documentId}`} ...>
```

### Fix 2: Delete DocumentDetail.tsx

```bash
rm packages/frontend/src/pages/documents/DocumentDetail.tsx
```

No import cleanup needed -- it's not imported anywhere.

### Fix 3: REQUIREMENTS.md Coverage Count

Update the Coverage section per user instruction (change 85 to 84).

## Backend Verification

The backend is fully functional and does not need changes:

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/versions?documentId=X` | GET | List versions for document | Working |
| `/api/versions/:id` | GET | Get single version | Working |
| `/api/versions/:id/diff/:idB` | GET | Compute LCS diff between two versions | Working |
| `/api/versions` | POST | Create version snapshot | Working |

All endpoints use `requireAuth` guard and `isDocumentProjectMember` permission check. The service layer includes LCS-based diff computation and proper JOIN with users table for creator names.

## Scope Assessment

This is a minimal, surgical fix phase:

| Task | Files Changed | Complexity |
|------|---------------|------------|
| Fix param mismatch | 1 file (VersionHistory.tsx) | Trivial -- 4 line changes |
| Delete dead code | 1 file deletion (DocumentDetail.tsx) | Trivial |
| Fix coverage count | 1 file (REQUIREMENTS.md) | Trivial -- number edit |

**Estimated effort:** Under 5 minutes. Single plan is appropriate.

## Sources

### Primary (HIGH confidence)
- `packages/frontend/src/pages/documents/VersionHistory.tsx` -- direct code inspection
- `packages/frontend/src/App.tsx` -- route definition verification
- `packages/frontend/src/pages/documents/DocumentDetail.tsx` -- dead code confirmation
- `packages/backend/src/modules/versions/versions.routes.ts` -- backend API verification
- `packages/backend/src/modules/versions/versions.service.ts` -- diff algorithm verification
- `.planning/v1.0-MILESTONE-AUDIT.md` -- audit findings

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md coverage count interpretation (user instruction says 84, enumeration yields 85)

## Metadata

**Confidence breakdown:**
- Param mismatch fix: HIGH -- direct code inspection confirms the bug and fix
- Dead code deletion: HIGH -- grep confirms zero imports of DocumentDetail
- Backend correctness: HIGH -- code review shows working endpoints
- Coverage count: MEDIUM -- mathematical enumeration differs from user instruction; planner should apply user's stated value

**Research date:** 2026-03-25
**Valid until:** Indefinite (bug fix, not version-sensitive)
