---
phase: 17-schema-migration-tech-debt
verified: 2026-03-26T05:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 17: Schema Migration Tech Debt — Verification Report

**Phase Goal:** Reset migration history to single baseline and implement document-type delete guard
**Verified:** 2026-03-26
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New tables (background_tasks, user_favorites, user_recent_access) exist in schema.ts with correct columns and constraints | VERIFIED | Lines 308-348 of schema.ts define all 3 tables with correct FK references, defaults, and unique constraints |
| 2 | callSourceEnum includes the inline_edit value | VERIFIED | schema.ts line 247: `"inline_edit"` present in callSourceEnum array |
| 3 | pg_trgm extension is enabled and GIN trigram indexes exist on documents.title, documents.description, projects.name, projects.description, workflows.name | VERIFIED | 0001_extensions_and_indexes.sql: `CREATE EXTENSION IF NOT EXISTS pg_trgm` + 5 trigram GIN indexes |
| 4 | zhparser extension is enabled with text search configuration and tsvector generated columns + GIN indexes on all searchable fields | VERIFIED | 0001_extensions_and_indexes.sql: extension + DO block for zhparser_cfg + 5 tsvector ADD COLUMN + 5 GIN FTS indexes (10 CREATE INDEX total) |
| 5 | Migration history is clean — single generated initial migration plus one custom SQL migration for extensions/indexes | VERIFIED | drizzle/ contains exactly 0000_slimy_true_believers.sql + 0001_extensions_and_indexes.sql; _journal.json has exactly 2 entries |
| 6 | Deleting a document type with associated workflows or documents is blocked with a clear error listing both | VERIFIED | document-types.service.ts: `deleteDocumentType` queries both `getAssociatedWorkflows` and `getAssociatedDocuments` in parallel, throws `HAS_ASSOCIATIONS` error with structured data if either is non-empty |
| 7 | Soft-deleted documents (isDeleted=true) are excluded from the association check | VERIFIED | `getAssociatedDocuments` at line 134: `.where(and(eq(workflows.documentTypeId, documentTypeId), eq(documents.isDeleted, false)))` |
| 8 | Route returns 409 with structured associations data (workflows + documents arrays) | VERIFIED | document-types.routes.ts lines 145-158: catches `HAS_ASSOCIATIONS`, sets status 409, returns `{ error, workflows, documents }` |
| 9 | Frontend shows a Dialog with the full list of associated workflows and documents when deletion is blocked | VERIFIED | DocumentTypeManagement.tsx: `deleteFailedInfo` signal drives a dedicated Modal (lines 619-658) with workflow names and document titles; also pre-check dialog at lines 547-571 showing associations before confirming delete |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/db/schema.ts` | All table/enum definitions including new tables and extended callSourceEnum | VERIFIED | backgroundTasks, userFavorites, userRecentAccess defined lines 308-348; 4 new enums lines 303-306; inline_edit in callSourceEnum line 247 |
| `packages/backend/drizzle/meta/_journal.json` | Clean journal with 2 entries | VERIFIED | 2 entries: idx 0 (0000_slimy_true_believers) and idx 1 (0001_extensions_and_indexes) |
| `packages/backend/drizzle/0000_slimy_true_believers.sql` | Clean generated migration with full schema including new tables | VERIFIED | Contains CREATE TABLE for background_tasks (line 16), user_favorites (line 219), user_recent_access (line 228) with unique constraints |
| `packages/backend/drizzle/0001_extensions_and_indexes.sql` | Custom migration: pg_trgm, zhparser, 5 trigram GIN indexes, 5 tsvector columns, 5 FTS indexes | VERIFIED | All 40 lines present; 10 CREATE INDEX IF NOT EXISTS statements |
| `packages/backend/src/modules/document-types/document-types.service.ts` | Delete guard with getAssociatedDocuments joining through workflows | VERIFIED | `getAssociatedDocuments` function exists (lines 127-136), innerJoin through workflows, isDeleted=false filter; `deleteDocumentType` calls both checks in parallel |
| `packages/backend/src/modules/document-types/document-types.routes.ts` | 409 response with HAS_ASSOCIATIONS handling + workflows/documents arrays | VERIFIED | HAS_ASSOCIATIONS catch block at lines 145-158; returns both arrays with `?? []` fallback |
| `packages/frontend/src/pages/admin/DocumentTypeManagement.tsx` | Dialog showing associated workflows and documents on delete failure | VERIFIED | Two-layer defense: pre-check dialog (lines 547-571) + post-409 deleteFailedInfo modal (lines 619-658); Close-only button on failure modal |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/backend/src/db/schema.ts` | `packages/backend/drizzle/*.sql` | drizzle-kit generate (pattern: `CREATE TABLE.*background_tasks`) | VERIFIED | 0000 migration contains `CREATE TABLE "background_tasks"` at line 16 |
| `packages/backend/src/modules/document-types/document-types.service.ts` | `packages/backend/src/db/schema.ts` | Drizzle query joining documents → workflows → documentTypes (pattern: `innerJoin.*workflows`) | VERIFIED | `getAssociatedDocuments` uses `.innerJoin(workflows, eq(documents.workflowId, workflows.id))` with documentTypeId filter |
| `packages/backend/src/modules/document-types/document-types.routes.ts` | `packages/backend/src/modules/document-types/document-types.service.ts` | catch block reading associations from error (pattern: `associations`) | VERIFIED | Route catch reads `assocErr.associations?.workflows ?? []` and `assocErr.associations?.documents ?? []` |
| `packages/frontend/src/pages/admin/DocumentTypeManagement.tsx` | `packages/backend/src/modules/document-types/document-types.routes.ts` | API call receiving 409 with workflows/documents arrays (pattern: `409`) | VERIFIED | `handleDelete` checks `error.status === 409` and extracts `errData.workflows` / `errData.documents`; pre-check uses `/associations` GET endpoint |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEBT-01 | 17-01, 17-02 | 文档类型删除时检查关联文档，有关联则阻止删除并提示 (DTYPE-04 守卫) | SATISFIED | Backend guard blocks deletion when workflows or non-deleted documents exist; frontend Dialog shows full association list; marked `[x]` in REQUIREMENTS.md |

No orphaned requirements found — DEBT-01 is the only requirement mapped to Phase 17 in REQUIREMENTS.md and both plans claim it.

---

### Anti-Patterns Found

No anti-patterns detected. Scanned:
- `packages/backend/src/db/schema.ts` — no TODOs, no stubs
- `packages/backend/drizzle/0001_extensions_and_indexes.sql` — all statements use `IF NOT EXISTS` / DO block guards (idempotent)
- `packages/backend/src/modules/document-types/document-types.service.ts` — no remaining DTYPE-04 TODO; complete implementation
- `packages/backend/src/modules/document-types/document-types.routes.ts` — no stubs, complete error handling
- `packages/frontend/src/pages/admin/DocumentTypeManagement.tsx` — no placeholders; two-layer delete guard implemented

---

### Human Verification Required

#### 1. Delete guard pre-check UX with associations present

**Test:** Create a document type, create a workflow using it, then attempt to delete the document type in the admin UI
**Expected:** The confirmation dialog immediately shows the association list and the "确认删除" button is disabled (not a Close-only dialog, but the confirm dialog with delete button disabled)
**Why human:** The pre-check fires a parallel API call on button click; the UI conditional (`associatedWorkflows().length > 0 || associatedDocuments().length > 0`) that disables the delete button requires live browser state to verify

#### 2. Post-409 delete failure Dialog

**Test:** Bypass the pre-check (e.g., trigger delete while another session creates a document), observe a 409 being returned by the server
**Expected:** The "无法删除文档类型" Modal appears listing workflows and documents; only a "关闭" button is present with no force-delete option
**Why human:** Requires a race-condition scenario to hit the post-409 path when pre-check passed but associations exist at delete time

#### 3. Migration runs cleanly on a fresh database

**Test:** Drop and recreate the database, run `bun drizzle-kit migrate` or the equivalent push command
**Expected:** Both migrations apply without errors — 0000 creates all 19 tables including the 3 new v1.1 tables; 0001 enables extensions and creates indexes
**Why human:** zhparser extension requires OS-level installation; migration outcome depends on server environment

---

## Summary

Phase 17 fully achieves its goal. The migration baseline is clean: the drizzle journal has exactly 2 entries matching exactly 2 SQL files, with the new v1.1 tables (backgroundTasks, userFavorites, userRecentAccess), 4 new enums, and the inline_edit callSource value all present in schema.ts and reflected in the generated migration. The custom idempotent SQL migration correctly enables pg_trgm and zhparser with 10 GIN indexes and 5 tsvector generated columns.

The DTYPE-04 delete guard is fully implemented end-to-end: the service queries both workflows and non-deleted documents via the correct indirect join (documents → workflows → documentTypes), throws a structured HAS_ASSOCIATIONS error, the route returns a 409 with both arrays, and the frontend implements a two-layer defense (pre-check dialog with disabled confirm button, plus a post-409 dedicated failure Modal with only a Close button).

DEBT-01 is satisfied and marked complete in REQUIREMENTS.md.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
