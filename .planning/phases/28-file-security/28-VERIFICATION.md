---
phase: 28-file-security
verified: 2026-04-03T08:45:00Z
status: passed
score: 7/7 truths verified
gaps: []
human_verification: []
---

# Phase 28: File Security Verification Report

**Phase Goal:** Add file security — path traversal defense, filename sanitization, membership-gated file access
**Verified:** 2026-04-03T08:45:00Z
**Status:** gaps_found (minor clarification note)
**Initial verification:** Yes

## Goal Achievement

### Observable Truths

| #   | Truth                                                                 | Status     | Evidence |
| --- | --------------------------------------------------------------------- | ---------- | -------- |
| 1   | sanitize.ts exports sanitizeFilename(basename) per spec              | VERIFIED   | sanitize.ts:18-40 — strips null bytes, path separators, leading dots, returns basename |
| 2   | sanitize.ts exports assertWithinRoot(root, path) per spec             | VERIFIED   | sanitize.ts:51-62 — resolve + prefix check with path.sep, throws AppError 400 |
| 3   | sanitizeFilename is pure TypeScript (no Node.js APIs)                 | VERIFIED   | sanitize.ts has no fs/path/ crypto imports; only uses string.replace() |
| 4   | POST /files: server generates storagePath, client storagePath ignored | VERIFIED   | files.routes.ts:22-25 — join(getUploadPath, randomUUID + sanitizeFilename(originalName)); body schema (t.Object) has no storagePath field |
| 5   | POST /files: isDocumentProjectMember guard returns 403 for non-members | VERIFIED   | files.routes.ts:17-21 — guard with message "仅项目成员可上传文件" |
| 6   | GET /files: isDocumentProjectMember guard returns 403 for non-members | VERIFIED   | files.routes.ts:54-58 — guard with message "仅项目成员可查看文件列表" |
| 7   | All file write operations sanitize user-supplied filenames           | VERIFIED   | input-transform.service.ts:111 (sanitizeFilename on file.name); export.service.ts:1382 (sanitizeFilename on filename param) |
| 8   | All file read operations validate storagePath before readFile          | VERIFIED   | export.service.ts:1447-1450 — assertWithinRoot(getExportPath, storagePath) before readFile; files.service.ts has no readFile operations |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/backend/src/common/sanitize.ts` | sanitizeFilename + assertWithinRoot exported | VERIFIED | Both functions present, pure TS, compile clean |
| `packages/backend/src/modules/files/files.routes.ts` | Server-generated storagePath, membership guards | VERIFIED | storagePath removed from body, guard on POST and GET, compiles clean |
| `packages/backend/src/modules/runtime/input-transform.service.ts` | sanitizeFilename applied to handleFileUpload | VERIFIED | line 111: join(uploadDir, sanitizeFilename(file.name)), compiles clean |
| `packages/backend/src/modules/runtime/export.service.ts` | sanitizeFilename on write, assertWithinRoot on read | VERIFIED | lines 1382-1383 (write), 1447-1450 (read), compiles clean |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| files.routes.ts | sanitize.ts | import sanitizeFilename | WIRED | files.routes.ts:6 imports it; used at line 24 |
| files.routes.ts | versions.service.ts | import isDocumentProjectMember | WIRED | files.routes.ts:7 imports it; used at lines 17 and 54 |
| input-transform.service.ts | sanitize.ts | import sanitizeFilename | WIRED | input-transform.service.ts:9 imports it; used at line 111 |
| export.service.ts | sanitize.ts | import both functions | WIRED | export.service.ts:4 imports sanitizeFilename + assertWithinRoot; used at lines 1382 and 1447 |
| generateExport | export.service.ts readFile | storagePath constructed from safeFilename | WIRED | safeFilename at line 1382, storagePath at line 1383, written at line 1384 |
| downloadExport | export.service.ts readFile | validatedPath from assertWithinRoot | WIRED | validatedPath at line 1447, readFile at line 1450 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| FSEC-01 | 28-01-PLAN.md | sanitizeFilename() utility | SATISFIED | sanitize.ts:18-40 — strips null bytes, path separators, leading dots |
| FSEC-02 | 28-01-PLAN.md | assertWithinRoot() utility | SATISFIED | sanitize.ts:51-62 — resolve + prefix check with path.sep |
| FSEC-03 | 28-02-PLAN.md | POST /files ignores client storagePath | SATISFIED | files.routes.ts:22-25 generates storagePath server-side; body schema has no storagePath field |
| FSEC-04 | 28-02-PLAN.md | POST /files isDocumentProjectMember guard | SATISFIED | files.routes.ts:17-21 returns 403 "仅项目成员可上传文件" |
| FSEC-05 | 28-02-PLAN.md | GET /files isDocumentProjectMember guard | SATISFIED | files.routes.ts:54-58 returns 403 "仅项目成员可查看文件列表" |
| FSEC-06 | 28-03-PLAN.md | input-transform.service.ts sanitizes file.name | SATISFIED | input-transform.service.ts:111 join(uploadDir, sanitizeFilename(file.name)) |
| FSEC-07 | 28-04-PLAN.md | export.service.ts sanitizes export filename | SATISFIED | export.service.ts:1382 sanitizeFilename(filename) before storagePath construction |
| FSEC-08 | 28-04-PLAN.md | downloadExport validates storagePath | SATISFIED | export.service.ts:1447 assertWithinRoot(getExportPath, storagePath) before readFile |

### Requirements.md Traceability Check

All 8 FSEC requirements are claimed complete in their respective plan SUMMARYs. REQUIREMENTS.md (FSEC-01 through FSEC-08) correctly maps to Phase 28 with no orphaned IDs. All 8 are verified as implemented.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| packages/backend/src/modules/statistics/statistics.service.ts | 81,116,... | Unused '@ts-expect-error' directives | WARNING | Pre-existing TS errors, out of scope for Phase 28 |
| packages/backend/src/scripts/migrate-json-fields.ts | 280 | Type mismatch NodeDef[] vs JSONValue | WARNING | Pre-existing migration script error, out of scope |
| packages/backend/src/scripts/migrate-named-output-prompts.ts | 132 | Type mismatch NodeDef[] vs JSONValue | WARNING | Pre-existing migration script error, out of scope |

No Phase 28 files contain TODO/FIXME/HACK/placeholder anti-patterns. The "placeholder" references in input-transform.service.ts and export.service.ts are inline code comments about PPT template placeholder strings — legitimate documentation, not stubs.

### TypeScript Compilation

Phase 28 files compile cleanly (`bunx tsc --noEmit`):
- `sanitize.ts` — no errors
- `files.routes.ts` — no errors
- `input-transform.service.ts` — no errors
- `export.service.ts` — no errors

Pre-existing errors in `statistics.service.ts` and migration scripts are unrelated to Phase 28.

### Human Verification Required

None — all requirements are verifiable programmatically.

### Gaps Summary

No blocking gaps found. All 8 FSEC requirements are implemented and wired.

**Minor clarification on FSEC-08:** The requirement states "downloadExport reads storagePath from DB and validates it before readFile." This is fully implemented in `export.service.ts:1447-1450`. `files.service.ts` does not contain any file-read operations (no `readFile`, `getFileStream`, or download functions). The ROADMAP Phase 28 success criteria refer specifically to "downloadExport" for the assertWithinRoot guard, which is satisfied. If future plans add a generic file download endpoint to files.service.ts, that endpoint will need FSEC-08 coverage at that time.

### FSEC Requirement Status Summary

| ID | Description | Plan | Status |
| -- | ----------- | ---- | ------ |
| FSEC-01 | sanitizeFilename() utility | 28-01 | IMPLEMENTED |
| FSEC-02 | assertWithinRoot() utility | 28-01 | IMPLEMENTED |
| FSEC-03 | POST /files server-side storagePath | 28-02 | IMPLEMENTED |
| FSEC-04 | POST /files membership guard | 28-02 | IMPLEMENTED |
| FSEC-05 | GET /files membership guard | 28-02 | IMPLEMENTED |
| FSEC-06 | input-transform file.name sanitization | 28-03 | IMPLEMENTED |
| FSEC-07 | export filename sanitization | 28-04 | IMPLEMENTED |
| FSEC-08 | downloadExport storagePath validation | 28-04 | IMPLEMENTED |

---

_Verified: 2026-04-03T08:45:00Z_
_Verifier: Claude (gsd-verifier)_
