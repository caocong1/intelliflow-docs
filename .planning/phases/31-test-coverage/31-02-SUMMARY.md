---
phase: 31-test-coverage
plan: 02
subsystem: frontend
tags: [test, xss, dompurify, vitest, jsdom]
dependency_graph:
  requires:
    - 31-01
  provides:
    - sanitize-html.test.ts
  affects:
    - packages/frontend/src/lib/sanitize.ts
tech_stack:
  added: [jsdom]
  patterns: [vitest jsdom environment, DOMPurify allowlist testing]
key_files:
  created: [packages/frontend/src/lib/sanitize.test.ts]
  modified: [packages/frontend/package.json]
decisions:
  - "Adjusted test expectations to match actual DOMPurify allowlist: img and body tags are not in ALLOWED_TAGS so they are stripped entirely, rather than having attributes stripped"
metrics:
  duration: "~15 minutes"
  completed: 2026-04-04
---

# Phase 31 Plan 02: sanitizeHtml Test Suite

**One-liner:** 15-case vitest suite for DOMPurify XSS defense covering dangerous tag removal, attribute stripping, and safe tag preservation.

## Task Summary

### Task 1: Write sanitizeHtml tests

**Commit:** `c16b3b8` — test(31-02): add sanitizeHtml test suite with 15 test cases

**Files created:**
- `packages/frontend/src/lib/sanitize.test.ts` — 15 test cases across 3 suites

**Files modified:**
- `packages/frontend/package.json` — added `jsdom@^25.0.1` as devDependency

**Verification:**
```
bun run vitest run src/lib/sanitize.test.ts
✓ 15 passed (15)
Test Files: 1 passed
```

## Test Suite Structure

**Suite 1 — removes dangerous tags** (4 tests):
- `removes script tags entirely` — standalone and inline script tags stripped
- `removes iframe tags` — iframe elements completely removed
- `removes object and embed tags` — Flash/plugin content removed
- `removes svg with script inside` — SVG with embedded script has script tag stripped

**Suite 2 — strips dangerous attributes** (5 tests):
- `removes onerror attributes from img tags` — img not in allowlist, element stripped entirely
- `removes onclick attributes` — div onclick stripped, content preserved
- `removes onload attributes` — body not in allowlist, content text preserved
- `strips javascript: href values from anchors` — javascript: href stripped from anchors
- `allows safe href values` — https href preserved

**Suite 3 — preserves safe HTML tags** (6 tests):
- `preserves paragraph and inline formatting tags` — p, strong, em, code
- `preserves heading tags` — h1, h2
- `preserves list tags` — ul, li
- `preserves blockquote`
- `preserves pre tags for code blocks`
- `preserves span with class attribute`

## Deviations from Plan

**Rule 2 (Auto-add critical functionality): Network infrastructure**
- **Issue:** Bun's package installation failed repeatedly (network timeouts downloading package manifests from registry.npmjs.org)
- **Fix:** Switched to Chinese npm mirror (registry.npmmirror.com) via `.bunfig.toml`; used `npm install` as fallback; installed `jsdom@^25.0.1` as devDependency in frontend package
- **Impact:** All 15 tests pass, no functional deviation from plan intent

**Rule 1 (Auto-fix bugs): Test expectation correction**
- **Issue:** Two tests had incorrect expectations matching the plan but not the actual allowlist
  - `onerror img` test expected `<img src="x">` but `img` is not in ALLOWED_TAGS so the entire tag is stripped
  - `onload body` test expected `<body>text</body>` but `body` is not in ALLOWED_TAGS so the body wrapper is stripped
- **Fix:** Adjusted test expectations to reflect the conservative allowlist (ALLOWED_TAGS = `p, br, strong, em, code, pre, h1-h6, ul, ol, li, a, span, div, blockquote, hr`)
- **Files modified:** `sanitize.test.ts` (lines 33, 42)

## Test Results

```
Test Files  1 passed (1)
Tests      15 passed (15)
Duration   363ms (transform 21ms, setup 0ms, import 33ms, tests 26ms, environment 215ms)
```

## Self-Check: PASSED

- [x] `packages/frontend/src/lib/sanitize.test.ts` exists and runs
- [x] `c16b3b8` commit exists in git log
- [x] All 3 suites (15 test cases) pass
- [x] Script tags completely removed
- [x] onerror, onclick, onload attributes stripped
- [x] javascript: href values stripped from anchors
- [x] Safe HTML tags preserved (p, em, strong, code, h1, h2, ul, blockquote, pre, span)
