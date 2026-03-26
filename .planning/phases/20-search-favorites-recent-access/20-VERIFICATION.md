---
phase: 20-search-favorites-recent-access
verified: 2026-03-26T10:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 20: Search, Favorites & Recent Access — Verification Report

**Phase Goal:** Users can quickly find and access any document or project across the platform through search, favorites, and recent history
**Verified:** 2026-03-26T10:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | GET /api/search?q=keyword returns matching projects, documents, and workflows grouped by type | VERIFIED | `search.service.ts:139-142` returns `{ projects: {items, total}, documents: {items, total}, workflows: {items, total} }` |
| 2  | Search results respect project membership and document visibility permissions | VERIFIED | `search.service.ts` joins `projectMembers` for project scope; applies full visibility filter (`project`/`createdBy`/`specific+documentVisibilityMembers`) on documents |
| 3  | POST /api/user-activity/favorites/toggle adds or removes a favorite | VERIFIED | `user-activity.service.ts:33` `toggleFavorite` — checks existence, deletes or inserts, returns `{ favorited: boolean }` |
| 4  | GET /api/user-activity/favorites returns user's favorites with target details | VERIFIED | `listFavorites` fetches from `userFavorites`, resolves names via batch Map, returns grouped `{ projects, documents, workflows }` |
| 5  | POST /api/user-activity/recent-access records an access event with 20-record cap | VERIFIED | `recordAccess` does `onConflictDoUpdate` upsert then OFFSET 20 eviction (`user-activity.service.ts:156-167`) |
| 6  | GET /api/user-activity/recent-access returns user's recent access history | VERIFIED | `listRecentAccess` queries `userRecentAccess` ordered by `accessedAt DESC` with limit |
| 7  | User can navigate to /search, /favorites, /recent from sidebar menu items | VERIFIED | `Sidebar.tsx:91,109,127` — three `<A href>` links; `App.tsx:64-66` — three `<Route>` registrations |
| 8  | User can type in search box and see results grouped by projects, documents, workflows | VERIFIED | `Search.tsx` uses `createResource` keyed on query signal, calls `globalSearch`, renders three group sections |
| 9  | User can view all favorites grouped by type on /favorites page | VERIFIED | `Favorites.tsx` (142 lines) — `createResource` calls `fetchFavorites`, renders three type sections with empty states |
| 10 | User can view recent access history as chronological list on /recent page | VERIFIED | `RecentAccess.tsx` (98 lines) — `createResource` calls `fetchRecentAccess`, renders single chronological list with type Badges |
| 11 | Star icon appears on project/document pages; clicking toggles favorite; detail pages record recent access | VERIFIED | `FavoriteButton.tsx` (59 lines) calls `toggleFavorite`; `ProjectList`, `ProjectHome`, `DocumentWorkspace` import it; `ProjectHome:287` and `DocumentWorkspace:211` call `recordAccess` on mount |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Lines | Status | Notes |
|----------|----------|-------|--------|-------|
| `packages/backend/src/modules/search/search.service.ts` | Cross-entity search with visibility filtering | 144 | VERIFIED | Exports `globalSearch`; ilike on name/title/description; proper visibility filter |
| `packages/backend/src/modules/search/search.routes.ts` | GET /search endpoint | 29 | VERIFIED | Exports `searchRoutes`; GET "/" with `q` and `limit` params |
| `packages/backend/src/modules/user-activity/user-activity.service.ts` | Favorites + recent access service | 232 | VERIFIED | Exports all 5 functions: `toggleFavorite`, `listFavorites`, `checkFavorites`, `recordAccess`, `listRecentAccess` |
| `packages/backend/src/modules/user-activity/user-activity.routes.ts` | Favorites and recent access endpoints | 81 | VERIFIED | Exports `userActivityRoutes`; 5 endpoints wired |
| `packages/frontend/src/lib/api/search.ts` | API client for search | 47 | VERIFIED | Exports `globalSearch` |
| `packages/frontend/src/lib/api/user-activity.ts` | API client for favorites/recent access | 112 | VERIFIED | Exports `fetchFavorites`, `fetchRecentAccess`, `toggleFavorite`, `checkFavorites`, `recordAccess` |
| `packages/frontend/src/pages/Search.tsx` | Search page with grouped results | 189 | VERIFIED | min_lines 60 satisfied; `createResource` keyed on query; three result groups |
| `packages/frontend/src/pages/Favorites.tsx` | Favorites page | 142 | VERIFIED | min_lines 40 satisfied; type-grouped display with empty states |
| `packages/frontend/src/pages/RecentAccess.tsx` | Recent access page | 98 | VERIFIED | min_lines 40 satisfied; chronological list with type Badge |
| `packages/frontend/src/components/favorites/FavoriteButton.tsx` | Reusable star toggle | 59 | VERIFIED | min_lines 25 satisfied; `toggleFavorite` call; `stopPropagation`; loading guard |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `search.service.ts` | `schema.ts` | `ilike` on projects/documents/workflows | WIRED | Line 1: imports `ilike`; lines 65, 91, 122 use it |
| `user-activity.service.ts` | `schema.ts` | `userFavorites`, `userRecentAccess` | WIRED | Lines 6-7: imports both tables; used throughout |
| `backend/src/index.ts` | `search.routes.ts`, `user-activity.routes.ts` | `.use()` registration | WIRED | `index.ts:63-64`: `.use(searchRoutes)`, `.use(userActivityRoutes)` |
| `Search.tsx` | `lib/api/search.ts` | `createResource` with reactive query signal | WIRED | Line 6: imports `globalSearch`; line 58: called in `createResource` |
| `Sidebar.tsx` | `/search`, `/favorites`, `/recent` | `<A href>` links | WIRED | Lines 91, 109, 127 confirmed |
| `App.tsx` | `Search`, `Favorites`, `RecentAccess` pages | `Route` registration | WIRED | Lines 64-66 confirmed |
| `FavoriteButton.tsx` | `lib/api/user-activity.ts` | `toggleFavorite` on click | WIRED | Line 2: import; line 25: called in click handler |
| `ProjectHome.tsx` | `lib/api/user-activity.ts` | `recordAccess` on mount | WIRED | Line 8: import; line 287: `recordAccess("project", params.id)` |
| `DocumentWorkspace.tsx` | `lib/api/user-activity.ts` | `recordAccess` on mount | WIRED | Line 26: import; line 211: `recordAccess("document", params.documentId)` |
| `Dashboard.tsx` | `lib/api/user-activity.ts` | `fetchRecentAccess`, `fetchFavorites` in `createResource` | WIRED | Lines 7-8: imports; lines 59-60: `createResource` calls |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| SRCH-01 | 20-01, 20-02 | 用户可通过全局搜索框跨项目搜索文档（标题、描述） | SATISFIED | `search.service.ts` queries documents with `ilike` on title/description; `Search.tsx` renders document results |
| SRCH-02 | 20-01, 20-02 | 用户可通过全局搜索框搜索项目（名称、描述）和流程（名称） | SATISFIED | `search.service.ts` queries projects (`ilike` name/description) and workflows (`ilike` name); rendered in Search.tsx |
| SRCH-03 | 20-01, 20-03 | 搜索结果遵守文档可见性权限，用户只能搜到有权访问的内容 | SATISFIED | `search.service.ts:84-97` applies exact `documentVisibilityMembers` filter matching `documents.service.ts` pattern |
| SRCH-04 | 20-01, 20-02, 20-03 | 用户可收藏/取消收藏项目和文档，在"我的收藏"视图快速访问 | SATISFIED | `toggleFavorite` backend + `FavoriteButton` component on ProjectList/ProjectHome/DocumentWorkspace; `/favorites` page shows grouped results |
| SRCH-05 | 20-01, 20-02, 20-03 | 系统自动记录用户最近访问的项目和文档，在"最近访问"视图展示 | SATISFIED | `recordAccess` fires on ProjectHome and DocumentWorkspace mount; `/recent` page shows chronological history with 20-cap |

All 5 requirements satisfied. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `Search.tsx` | 82 | `placeholder="搜索..."` (HTML input attribute) | Info | Not a code stub — standard HTML placeholder text, not an implementation gap |

No blockers or warnings found.

---

### Human Verification Required

#### 1. Search debounce behavior

**Test:** Navigate to /search, type a query, observe network requests
**Expected:** Search API called once after ~300ms pause, not on every keystroke
**Why human:** Debounce timing requires browser interaction to verify

#### 2. Star toggle visual state persistence

**Test:** Click star on a project card, navigate away, return to project list
**Expected:** Star remains filled (favorited state survives navigation)
**Why human:** Requires browser session and navigation flow to verify state refresh

#### 3. Recent access sidebar display

**Test:** Open ProjectHome and DocumentWorkspace for several items, then navigate to /recent
**Expected:** Visited items appear in reverse chronological order; list does not exceed 20 items
**Why human:** Requires multiple navigation actions and live backend

#### 4. Search results expansion

**Test:** Search for a term that returns more than 3 results in a category
**Expected:** "查看全部 N 条结果" button appears and expands or navigates to full results
**Why human:** Requires real data with >3 matches per category

---

### Gaps Summary

No gaps. All 11 observable truths verified. All 10 required artifacts exist with substantive implementations. All 9 key links confirmed wired. All 5 SRCH requirements satisfied across the three plans. The only anti-pattern hit was an HTML `placeholder` attribute (not a code stub).

Phase 20 goal is fully achieved: users can search across projects, documents, and workflows with permission filtering; favorite and unfavorite items from list and detail pages; view grouped favorites; and access automatic recent history capped at 20 records per user.

---

_Verified: 2026-03-26T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
