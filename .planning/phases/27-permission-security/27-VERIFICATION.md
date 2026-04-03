---
phase: 27-permission-security
verified: 2026-04-03T08:30:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
gap_resolved:
  - truth: "Requirement PERM-03 requires all sub-route write endpoints to use canEditDocument()"
    resolution: "REQUIREMENTS.md updated: [ ] → [x] on line 14, 'Pending' → 'Complete' on line 81"
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "Line 14: '**PERM-03**: 所有子路由写端点改用 canEditDocument()...' still shows [ ] instead of [x]. Line 81: PERM-03 table row still shows 'Pending' instead of 'Complete'."
      - path: "packages/backend/src/modules/runtime/desensitize.routes.ts"
        issue: "None — implementation is correct (detect + confirm use canEditDocument; rules uses isDocumentProjectMember)"
      - path: "packages/backend/src/modules/runtime/model-call.routes.ts"
        issue: "None — implementation is correct (execute/retry/select/revalidate/ai-fix use canEditDocument; status uses isDocumentProjectMember)"
      - path: "packages/backend/src/modules/runtime/restore.routes.ts"
        issue: "None — implementation is correct (execute + text use canEditDocument)"
      - path: "packages/backend/src/modules/runtime/inline-edit.routes.ts"
        issue: "None — implementation is correct (stream uses canEditDocument)"
      - path: "packages/backend/src/modules/runtime/input-transform.routes.ts"
        issue: "None — implementation is correct (upload + confirm use canEditDocument)"
    missing:
      - "REQUIREMENTS.md PERM-03 checkbox change: [ ] → [x] (line 14)"
      - "REQUIREMENTS.md PERM-03 status table update: Pending → Complete (line 81)"
---

# Phase 27: Permission Security Verification Report

**Phase Goal:** Enforce creator-or-owner write authorization across all runtime routes, preventing regular project members from mutating document state while preserving membership-based read access.
**Verified:** 2026-04-03T08:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `canEditDocument(documentId, userId)` exported from `versions.service.ts` returns true for document creator OR project owner | VERIFIED | `versions.service.ts` lines 230-249: function checks `row.createdBy === userId \|\| row.ownerMembershipId !== null` via leftJoin on `projectMembers.role = "owner"` |
| 2 | `isDocumentProjectMember(documentId, userId)` still exists as read-only membership helper | VERIFIED | `versions.service.ts` lines 216-228: unchanged function, returns `rows.length > 0` |
| 3 | All 6 core runtime write handlers (init, advance, rollback, draft, skip, start-background) use `canEditDocument` before any mutation | VERIFIED | `runtime.routes.ts` lines 67, 116, 141, 167, 193, 218 — all call `await canEditDocument(params.documentId, user!.id)` |
| 4 | `GET /runtime/:documentId` continues to use `isDocumentProjectMember` so read-only members can inspect runtime state | VERIFIED | `runtime.routes.ts` line 92: `const isMember = await isDocumentProjectMember(params.documentId, user!.id)` |
| 5 | All sub-route write endpoints use `canEditDocument` (PERM-03) | VERIFIED | 19 guards across 5 route files; REQUIREMENTS.md updated |
| 6 | Export generate uses `canEditDocument`; preview and download stay on `isDocumentProjectMember` | VERIFIED | `export.routes.ts` line 39: `generate` uses `canEditDocument`; lines 14, 74: preview and download use `isDocumentProjectMember` |
| 7 | All 403 messages use `仅文档创建者或项目负责人` wording | VERIFIED | 19 handlers across 7 route files all return matching 403 error text |
| 8 | Background-task dedupe and concurrency-limit logic in `start-background` remains after the new permission gate | VERIFIED | `runtime.routes.ts` lines 224-255: dedupe check (lines 225-239) and concurrency limit (lines 242-255) execute after `canEditDocument` gate at line 218 |

**Score:** 5/5 must-haves verified. All requirements satisfied — PERM-03 gap resolved by updating REQUIREMENTS.md.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/modules/versions/versions.service.ts` | Exports `canEditDocument` and `isDocumentProjectMember` | VERIFIED | Line 230: `export async function canEditDocument`; Line 216: `export async function isDocumentProjectMember` |
| `packages/backend/src/modules/runtime/runtime.routes.ts` | 6 write handlers + 1 GET, correctly guarded | VERIFIED | 6x `canEditDocument` guards (lines 67,116,141,167,193,218); 1x `isDocumentProjectMember` GET (line 92) |
| `packages/backend/src/modules/runtime/desensitize.routes.ts` | detect + confirm use `canEditDocument`; rules uses `isDocumentProjectMember` | VERIFIED | Lines 51,88: `canEditDocument`; Line 130: `isDocumentProjectMember` |
| `packages/backend/src/modules/runtime/model-call.routes.ts` | execute/retry/select/revalidate/ai-fix use `canEditDocument`; status uses `isDocumentProjectMember` | VERIFIED | Lines 30,122,202,264,340: `canEditDocument`; Line 232: `isDocumentProjectMember` |
| `packages/backend/src/modules/runtime/restore.routes.ts` | execute + text use `canEditDocument` | VERIFIED | Lines 51,87: `canEditDocument` |
| `packages/backend/src/modules/runtime/inline-edit.routes.ts` | stream uses `canEditDocument` | VERIFIED | Line 20: `canEditDocument` |
| `packages/backend/src/modules/runtime/input-transform.routes.ts` | upload + confirm use `canEditDocument` | VERIFIED | Lines 16,52: `canEditDocument` |
| `packages/backend/src/modules/runtime/export.routes.ts` | generate uses `canEditDocument`; preview/download use `isDocumentProjectMember` | VERIFIED | Line 39: `canEditDocument`; Lines 14,74: `isDocumentProjectMember` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| All 7 runtime route modules | `versions.service.ts::canEditDocument` | `import { canEditDocument }` + guard call | WIRED | 19 mutation handlers across 7 route files call `await canEditDocument(params.documentId, user!.id)` before any service call |
| `runtime.routes.ts::GET /:documentId` | `versions.service.ts::isDocumentProjectMember` | `import { isDocumentProjectMember }` + guard call | WIRED | Line 92 calls `await isDocumentProjectMember(params.documentId, user!.id)` |
| `desensitize.routes.ts::GET rules` | `versions.service.ts::isDocumentProjectMember` | import + guard call | WIRED | Line 130: `await isDocumentProjectMember(params.documentId, user!.id)` |
| `model-call.routes.ts::GET status` | `versions.service.ts::isDocumentProjectMember` | import + guard call | WIRED | Line 232: `await isDocumentProjectMember(params.documentId, user!.id)` |
| `export.routes.ts::GET preview/download` | `versions.service.ts::isDocumentProjectMember` | import + guard call | WIRED | Lines 14,74: `await isDocumentProjectMember(params.documentId, user!.id)` |
| `runtime.routes.ts::start-background` dedupe/concurrency | Permission gate placement | `canEditDocument` at line 218, dedupe at lines 225-239, concurrency at lines 242-255 | WIRED | Dedup and concurrency checks remain below the permission gate — authorized users still get those protections |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERM-01 | 27-01 | `canEditDocument()` permission function (creator/owner write) | SATISFIED | `versions.service.ts` lines 230-249; leftJoin on `role = "owner"`; checks `createdBy === userId` |
| PERM-02 | 27-02 | `runtime.routes.ts` all write endpoints use `canEditDocument()` | SATISFIED | 6 handlers verified; all 403 messages correct |
| PERM-03 | 27-03 | All sub-route write endpoints use `canEditDocument()` | SATISFIED | Implementation verified correct (19 guards across 5 route files); REQUIREMENTS.md updated — [x] checkbox and 'Complete' status |
| PERM-04 | 27-04 | Export generate endpoint uses `canEditDocument()` | SATISFIED | `export.routes.ts` line 39; 403 message: "仅文档创建者或项目负责人可生成导出" |
| PERM-05 | 27-02, 27-03, 27-04 | Read-only endpoints keep `isDocumentProjectMember()` | SATISFIED | `runtime.routes.ts` GET (line 92), `desensitize.rules` (line 130), `model-call.status` (line 232), `export.preview` (line 14), `export.download` (line 74) — all use `isDocumentProjectMember` |

**Orphaned requirements:** None found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `statistics.service.ts` | 81,116,179,215,246,279,311,430 | Unused `@ts-expect-error` directives | INFO | Pre-existing, unrelated to Phase 27 |
| `migrate-json-fields.ts` | 280 | Type `NodeDef[]` not assignable to `JSONValue` | INFO | Pre-existing, unrelated to Phase 27 migration script |
| `migrate-named-output-prompts.ts` | 132 | Same `NodeDef[]` type mismatch | INFO | Pre-existing, unrelated to Phase 27 migration script |

No Phase 27 files contain anti-patterns. No `TODO`/`FIXME`/`PLACEHOLDER` comments found in any verified runtime route files.

### Human Verification Required

None — all checks are programmatic and verified.

### Gaps Summary

All gaps resolved. Phase 27 implementation is complete and correct:
- 19 write-guard calls across 7 route files wired to `canEditDocument()`
- 5 read-only endpoints correctly use `isDocumentProjectMember()`
- `canEditDocument` encodes creator-or-owner rule via `documents.createdBy` and `projectMembers.role = "owner"`
- REQUIREMENTS.md updated for PERM-03 ([x] checkbox + 'Complete' status)

---

_Verified: 2026-04-03T08:30:00Z_
_Verifier: Claude (gsd-verifier)_
