# Phase 15: Integration Bug Fixes — Export URL, PPT Cleanup, Type Sync - Research

**Researched:** 2026-03-25
**Domain:** Cross-phase integration bug fixes (frontend URL routing, shared type cleanup, type contract alignment)
**Confidence:** HIGH

## Summary

Phase 15 addresses three integration issues identified during the v1.0 milestone audit. All three are straightforward fixes with clear root causes and well-defined solutions. No new libraries or architectural changes are needed — this is purely corrective work on existing code.

**Bug 1 (Medium):** `ExportCompleted.tsx` constructs download URLs using `/api/runtime/${documentId}/download/${filename}` — a route that does not exist. The correct pattern is `/api/runtime/${documentId}/export/${nodeExecutionId}/download`, which is already used correctly by both `ExportExecutor.tsx` (line 165) and `CompletedNodeCard.tsx` (line 619).

**Bug 2 (Low):** PPT format (`"ppt"`) is declared in the shared `ExportConfig` type (types.ts lines 170, 172) and exposed in the workflow editor (`ExportConfig.tsx` line 11), but the backend rejects it (export.routes.ts body schema only accepts `word | pdf | markdown`) and the runtime executor silently filters it out. Since no backend PPT generation exists, the fix is to remove PPT from types and UI.

**Bug 3 (Low):** The frontend `auth.tsx` defines a local `User` type with `avatar: string | null` (line 9), but the shared `User` interface in `types.ts` (line 12-17) lacks this field. The backend `auth.service.ts` returns `avatar` from the database (schema.ts line 18), so the shared type is simply incomplete.

**Primary recommendation:** Fix all three in a single plan — each is a 1-3 line change across well-identified files.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-05 | 工作台展示节点历史面板（查看已完成节点的输入输出记录） | Bug 1 fix enables re-download from completed export node view (ExportCompleted.tsx URL correction) |
| NODE-20 | 用户可选择导出格式（Word/PDF/Markdown） | Bug 2 fix removes phantom PPT option that is not backend-supported, aligning available formats with NODE-20's scope |
</phase_requirements>

## Architecture Patterns

### Bug 1: ExportCompleted Download URL

**Root cause:** `ExportCompleted.tsx` was written with a guessed URL pattern instead of matching the actual backend route.

**Current (broken):**
```typescript
// ExportCompleted.tsx lines 54, 62
const downloadUrl = `/api/runtime/${props.documentId}/download/${r.filename}`;
```

**Correct pattern (from ExportExecutor.tsx line 165 and CompletedNodeCard.tsx line 619):**
```typescript
const downloadUrl = `/api/runtime/${props.documentId}/export/${props.node.id}/download`;
```

**Key detail:** `props.node` is a `NodeExecution` object. `props.node.id` is the node execution UUID — exactly what the backend route `/:documentId/export/:nodeExecutionId/download` expects.

**Both `handleDownload` and `handleCopyAll` need fixing.** Additionally, `handleDownload` uses `window.open()` which won't send the auth token. The `CompletedNodeCard.tsx` approach (fetch with Authorization header, then create blob URL) is more robust. However, the `window.open` approach works if the backend doesn't require auth for download (it does — `requireAuth` guard is on the route). The `handleCopyAll` already uses `fetch()` but also lacks the Authorization header.

**Auth header requirement:** The export routes use `requireAuth`. Both functions need to include the Bearer token. `ExportExecutor.tsx` line 165 also uses `window.open` (same potential issue), but `CompletedNodeCard.tsx` line 620 correctly adds the auth header via fetch. The safest fix is to use the fetch+blob pattern from CompletedNodeCard for `handleDownload`, and add the auth header to `handleCopyAll`'s fetch call.

### Bug 2: PPT Format Removal

**Files to change:**
1. `packages/shared/src/types.ts` line 170 — remove `"ppt"` from `formats` array type
2. `packages/shared/src/types.ts` line 172 — remove `"ppt"` from deprecated `format` union
3. `packages/frontend/src/components/workflow/config/ExportConfig.tsx` line 5 — remove `"ppt"` from local `ExportFormat` type
4. `packages/frontend/src/components/workflow/config/ExportConfig.tsx` line 11 — remove the PPT entry from `FORMAT_OPTIONS` array

**No backend changes needed:** Backend already correctly excludes PPT from its schema validation.

**Runtime executor cleanup (optional):** `ExportExecutor.tsx` lines 43-58 have PPT filter logic that becomes dead code after this fix. Removing it makes the code cleaner but is not strictly necessary.

### Bug 3: Shared User Type Avatar Field

**Change:** Add `avatar?: string | null` to the `User` interface in `packages/shared/src/types.ts`.

```typescript
export interface User extends BaseEntity {
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string | null;  // <-- add this
}
```

**Why optional (`?`):** The avatar field is nullable in the DB schema (`varchar("avatar", { length: 500 })`), and the backend returns `avatar: user.avatar ?? null`. Making it optional means existing code that doesn't use avatar won't break.

**Frontend auth.tsx cleanup:** After updating the shared type, the local `User` type in `auth.tsx` can be replaced with an import from `@intelliflow/shared`. However, the local type also omits `createdAt`, `updatedAt`, `isActive` (fields from `BaseEntity` and `User`), so it serves as a narrower "session user" type. The simplest fix is to just add `avatar` to the shared type and leave `auth.tsx` as-is — no behavioral change needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File download with auth | `window.open(url)` | `fetch()` with Authorization header + blob URL | `window.open` cannot send Bearer tokens; route requires `requireAuth` |

## Common Pitfalls

### Pitfall 1: Auth Token on Download
**What goes wrong:** Using `window.open(url)` for authenticated download routes returns 401
**Why it happens:** Browser navigation requests don't include custom headers
**How to avoid:** Use fetch with Authorization header, create blob URL, trigger download via anchor element
**Warning signs:** Download works in dev (if auth is relaxed) but fails in production

### Pitfall 2: Existing Workflow Data with PPT
**What goes wrong:** Removing PPT from the type could break existing workflows saved with `format: "ppt"` or `formats: ["ppt"]`
**Why it happens:** Saved workflow JSON in the database may contain the PPT value
**How to avoid:** The runtime executor already filters PPT out (ExportExecutor.tsx lines 53, 58), so existing data is handled gracefully. The type change only affects TypeScript compilation, not runtime behavior. No data migration needed.
**Warning signs:** TypeScript errors in workflow loading code that deserializes stored configs

### Pitfall 3: Shared Type Change Breaking Frontend Build
**What goes wrong:** Adding avatar to shared User type could cause TS errors if code constructs User objects without avatar
**Why it happens:** Non-optional fields require all properties
**How to avoid:** Make avatar optional (`avatar?: string | null`) so existing code that constructs User objects without avatar continues to compile

## Code Examples

### Download with Auth Token (from CompletedNodeCard.tsx)
```typescript
// Source: packages/frontend/src/components/workspace/CompletedNodeCard.tsx lines 618-629
async function triggerDownload() {
  const url = `/api/runtime/${documentId}/export/${nodeId}/download`;
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename || "export";
  // ... click and revoke
}
```

### Backend Route Pattern (confirmed)
```typescript
// Source: packages/backend/src/modules/runtime/export.routes.ts line 72
"/:documentId/export/:nodeExecutionId/download"
// params: { documentId: string, nodeExecutionId: string }
```

## Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `packages/frontend/src/components/workspace/completed/ExportCompleted.tsx` | Fix download URL in `handleDownload` and `handleCopyAll`; add auth header | 54, 62 |
| `packages/shared/src/types.ts` | Remove `"ppt"` from ExportConfig format types; add `avatar` to User | 170, 172, ~16 |
| `packages/frontend/src/components/workflow/config/ExportConfig.tsx` | Remove PPT from ExportFormat type and FORMAT_OPTIONS array | 5, 11 |
| `packages/frontend/src/components/workspace/nodes/ExportExecutor.tsx` | (Optional) Remove dead PPT filter code | 43-58 |

## Open Questions

None. All three bugs have clear root causes, identified files, and straightforward fixes.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all affected files in the repository
- v1.0 Milestone Audit Report (`.planning/v1.0-MILESTONE-AUDIT.md`) — identified all three issues with file/line references

## Metadata

**Confidence breakdown:**
- Bug 1 (ExportCompleted URL): HIGH — exact broken line identified, correct pattern confirmed in two other files
- Bug 2 (PPT removal): HIGH — shared type, editor, executor, and backend route all inspected
- Bug 3 (User avatar): HIGH — DB schema, backend service, shared type, and frontend auth context all verified

**Research date:** 2026-03-25
**Valid until:** Indefinite (bug fixes, not library-dependent)
