---
phase: 27-permission-security
plan: "04"
subsystem: backend / authorization
tags: [permissions, auth, export, write-authorization, phase-27]
dependency_graph:
  requires:
    - id: "canEditDocument-helper"
      type: "function"
      from: "27-01-SUMMARY.md"
  provides:
    - id: "export-generation-guard"
      type: "route guard"
      via: "canEditDocument on POST generate"
tech_stack:
  added:
    - canEditDocument guard on export generation route
  patterns:
    - creator-or-owner write authorization for export generation
    - membership-based read for export preview/download
key_files:
  created: []
  modified:
    - path: packages/backend/src/modules/runtime/export.routes.ts
      change: "import canEditDocument; replace membership guard in generate with creator-or-owner guard"
decisions:
  - id: "export-guard-strategy"
    decision: "Generate endpoint uses canEditDocument; preview and download stay on isDocumentProjectMember"
    rationale: "Phase 27 gap: export generation is a write action (like delete) requiring creator-or-owner; preview and download are read-only and should remain accessible to all project members"
key_metrics:
  duration: "<5 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  files_modified: 1
---

# Phase 27 Plan 04: Export Generation Permission Guard

## One-liner

Restricted export generation to document creators and project owners using `canEditDocument`, keeping preview and download accessible to all project members.

## Completed Tasks

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Move export generation to creator-or-owner access | `04fcbfe` | Done |
| 2 | Preserve membership-only access for preview and download | `04fcbfe` | Done |

## Changes

### `packages/backend/src/modules/runtime/export.routes.ts`

**Import added:**
```typescript
import { canEditDocument, isDocumentProjectMember } from "../versions/versions.service";
```

**`POST /:documentId/export/:nodeExecutionId/generate` guard changed:**

Before:
```typescript
const isMember = await isDocumentProjectMember(params.documentId, user!.id);
if (!isMember) {
  set.status = 403;
  return { error: "仅项目成员可生成导出" };
}
```

After:
```typescript
const canEdit = await canEditDocument(params.documentId, user!.id);
if (!canEdit) {
  set.status = 403;
  return { error: "仅文档创建者或项目负责人可生成导出" };
}
```

**`preview` and `download` routes:** Unchanged — still use `isDocumentProjectMember` so read-only project members retain export visibility.

**Download headers:** Unchanged — `content-type` from `result.mimeType`, `content-disposition` using `attachment; filename="${encodeURIComponent(result.filename)}"`.

## Verification

- `rg -n "canEditDocument\(" packages/backend/src/modules/runtime/export.routes.ts` → `39:      const canEdit = await canEditDocument(params.documentId, user!.id);`
- `rg -n "preview|download|isDocumentProjectMember\(" packages/backend/src/modules/runtime/export.routes.ts` → `preview` and `download` still call `isDocumentProjectMember`
- `bunx tsc --noEmit` → 0 errors in `export.routes.ts`; pre-existing errors in unrelated files (`statistics.service.ts`, migration scripts) are out of scope

## Deviations from Plan

None — plan executed exactly as written.

## Auth Gates

None.

## Self-Check: PASSED

- File modified: `packages/backend/src/modules/runtime/export.routes.ts` exists
- Commit found: `04fcbfe` present in history
- `canEditDocument` import present at line 3
- `canEditDocument` call at line 39 in `generate` handler
- `preview` (line 14) and `download` (line 74) still use `isDocumentProjectMember`
- Download headers unchanged at lines 87 and 93
