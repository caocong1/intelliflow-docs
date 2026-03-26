---
phase: 19-statistics-audit-dashboard
verified: 2026-03-26T10:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 8/13
  gaps_closed:
    - "KPI cards render correct values for docCount and avgSuccessRate"
    - "Model stats success rate displays correct percentage value"
    - "User stats tab shows per-user table with document count"
    - "Workflow stats tab shows per-workflow table with usage count"
    - "Overview tab recent audit records table shows data"
  gaps_remaining: []
  regressions: []
---

# Phase 19: Statistics & Audit Dashboard Verification Report

**Phase Goal:** Administrators have full visibility into platform usage, model costs, and generation audit trails
**Verified:** 2026-03-26T10:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 06)

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | GET /admin/statistics/overview returns KPI data | VERIFIED | getOverviewKpis returns all 8 fields; endpoint registered in routes.ts |
| 2  | GET /admin/statistics/trends returns time-series data | VERIFIED | getTrends uses date_trunc with granularity param |
| 3  | GET /admin/statistics/by-model returns per-model aggregation | VERIFIED | getByModel groups by modelId/modelName |
| 4  | GET /admin/statistics/by-user returns per-user aggregation | VERIFIED | getByUser groups by userId/users.displayName |
| 5  | GET /admin/statistics/by-workflow returns per-workflow aggregation | VERIFIED | getByWorkflow with document/workflow joins |
| 6  | GET /admin/statistics/audit/by-user returns paginated audit | VERIFIED | getAuditByUser with pagination |
| 7  | GET /admin/statistics/audit/by-document returns paginated audit | VERIFIED | getAuditByDocument with pagination |
| 8  | GET /admin/statistics/audit/document-detail/:documentId works | VERIFIED | getDocumentDetail with nodeExecutions join |
| 9  | All endpoints accept shared filter params | VERIFIED | sharedQuery schema with all filter params; extractFilters helper |
| 10 | KPI cards render correct docCount and avgSuccessRate values | VERIFIED | KpiCards.tsx line 23 key="docCount", line 27 key="avgSuccessRate"; OverviewData interface matches backend fields |
| 11 | Overview tab recent audit records table shows data | VERIFIED | flattenAuditRecords() correctly uses response?.data ?? [] (line 151); maps AuditDocumentRow fields to AuditRecord |
| 12 | Workflow stats tab shows correct usage counts | VERIFIED | WorkflowStats.tsx uses row.callCount (line 103); fetchByWorkflow return type declares callCount; backend returns callCount |
| 13 | Model stats success rate displays correct percentage | VERIFIED | ModelStats.tsx line 98: Number(row.successRate).toFixed(1)% — no double-multiplication |
| 14 | User stats table shows correct user names and document counts | VERIFIED | UserStats.tsx line 105: row.userName; line 110: row.docCount; fetchByUser type uses userName+docCount |
| 15 | Audit tab by-user and by-document sub-tabs with expandable rows | VERIFIED | AuditDetails component has both sub-tabs, expandable rows, pagination, document-detail fetch |
| 16 | Dashboard accessible via sidebar and /admin/statistics route | VERIFIED | Sidebar has 统计面板 link to /admin/stats; both /admin/stats and /admin/statistics routes registered |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/frontend/src/lib/api/statistics.ts` | API types matching backend field names | VERIFIED | OverviewData: docCount+avgSuccessRate (lines 15,19); fetchByUser: userName+docCount (line 58); fetchByWorkflow: callCount+docCount (line 62) |
| `packages/frontend/src/pages/admin/stats/KpiCards.tsx` | Card keys matching OverviewData interface | VERIFIED | key: "docCount" (line 23), key: "avgSuccessRate" (line 27) — both are valid keyof OverviewData |
| `packages/frontend/src/pages/admin/stats/ModelStats.tsx` | successRate rendered without double-multiplication | VERIFIED | Number(row.successRate).toFixed(1)% (line 98) — no * 100 |
| `packages/frontend/src/pages/admin/stats/UserStats.tsx` | Uses userName and docCount fields | VERIFIED | row.userName (line 105), row.docCount (line 110); chart yAxis uses u.userName (line 30) |
| `packages/frontend/src/pages/admin/stats/WorkflowStats.tsx` | Uses callCount and docCount fields | VERIFIED | chart series w.callCount (line 37), table row.callCount (line 103), row.docCount (line 109), sortedByCallCount sorts by callCount (line 123) |
| `packages/frontend/src/pages/admin/stats/OverviewCharts.tsx` | flattenAuditRecords extracts PaginatedResponse.data | VERIFIED | response?.data ?? [] (line 151); maps doc.userName, doc.workflowName, doc.totalTokens, doc.totalDuration, doc.estimatedCost, doc.createdAt (lines 155-163) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `statistics.ts` OverviewData | `statistics.service.ts` getOverviewKpis | field names docCount+avgSuccessRate | WIRED | Both use docCount (svc line 152) and avgSuccessRate (svc line 156) |
| `KpiCards.tsx` card.key | `statistics.ts` OverviewData | key values are keyof OverviewData | WIRED | "docCount" and "avgSuccessRate" are valid OverviewData keys |
| `statistics.ts` fetchByUser | `statistics.service.ts` getByUser | field names userName+docCount | WIRED | svc line 268 userName, line 270 docCount |
| `statistics.ts` fetchByWorkflow | `statistics.service.ts` getByWorkflow | field names callCount+docCount | WIRED | svc line 344 callCount, line 346 docCount |
| `WorkflowStats.tsx` row access | `statistics.ts` fetchByWorkflow | row.callCount, row.docCount | WIRED | WorkflowStats lines 103+109 match return type definition |
| `OverviewCharts.tsx` flattenAuditRecords | `statistics.ts` fetchAuditByDocument | PaginatedResponse<AuditDocumentRow>.data | WIRED | Extracts .data array, maps .userName/.workflowName/.totalTokens/.totalDuration/.estimatedCost/.createdAt |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| STAT-01 | 19-01, 19-06 | 管理员可查看总览面板：总调用次数、总 Token 消耗、活跃用户数、文档生成数、总成本估算 | SATISFIED | KpiCards renders all 8 KPI fields with correct keys; overview endpoint returns correct data |
| STAT-02 | 19-02, 19-06 | 管理员可按模型查看使用统计：调用次数、Token 消耗、成功率、成本、趋势图 | SATISFIED | ModelStats renders callCount, totalTokens, successRate (no double-mult), estimatedCost; trend chart in OverviewCharts |
| STAT-03 | 19-03, 19-06 | 管理员可按用户查看使用统计：使用频率、文档生成数、Token 消耗、成本 | SATISFIED | UserStats renders userName, callCount, docCount, totalTokens, estimatedCost — all correct fields |
| STAT-04 | 19-04, 19-05, 19-06 | 管理员可查看生成记录审计明细：谁、用什么流程、哪些节点、哪些模型、耗时、Token 数、成本 | SATISFIED | AuditDetails with by-user/by-document tabs; expandable document detail rows; flattenAuditRecords fixed to show recent records |
| STAT-05 | 19-01 | 管理员可按部门/项目/文档类型/流程多维度交叉查看统计数据 | SATISFIED | sharedQuery schema with projectId, documentTypeId, workflowId, department params wired to all endpoints |
| STAT-06 | 19-03, 19-06 | 管理员可按流程查看使用统计：使用次数、用户分布、文档数、趋势 | SATISFIED | WorkflowStats renders callCount (usage), userCount, docCount; chart uses w.callCount |
| STAT-07 | 19-01 | 所有统计面板支持自定义日期范围和时间粒度（日/周/月）筛选 | SATISFIED | StatisticsFilters interface with dateFrom/dateTo/granularity; FilterBar wired to all sub-tabs |

### Anti-Patterns Found

None. Scan of all 6 modified files returned no TODO/FIXME/placeholder/return-null patterns.

### Human Verification Required

The following items require a running application to confirm:

#### 1. KPI Card Values Display Correctly

**Test:** Load the /admin/stats page with a seeded or real dataset. Inspect the 8 KPI cards.
**Expected:** "文档生成数" and "平均成功率(%)" show non-zero values matching actual data, not NaN or 0.
**Why human:** Runtime data dependency — cannot verify actual API response values without a running server and database.

#### 2. Model Stats Success Rate Formatting

**Test:** View the Model Stats tab. Check the "成功率" column values.
**Expected:** Values display as "95.0%" not "9500.0%".
**Why human:** Percentage rendering requires a live API response to observe the corrected output.

#### 3. Overview Audit Table Populates

**Test:** View the Overview tab "最近审计记录" table.
**Expected:** Up to 10 rows showing createdAt (formatted), userName, workflowName, "-" for model, totalTokens, totalDuration, estimatedCost.
**Why human:** Requires actual audit records in database to confirm rows render correctly.

## Re-verification Summary

All 5 gaps from the initial verification (score 8/13) were closed by Plan 06. The changes were frontend-only — the backend API was verified correct in the initial pass.

**Gap 1 — KPI field name mismatch:** `OverviewData` interface now uses `docCount` (line 15) and `avgSuccessRate` (line 19) matching backend `getOverviewKpis` return (svc lines 152, 156). `KpiCards` card keys updated to match.

**Gap 2 — Model stats double-multiplication:** Removed `* 100` from `ModelStats.tsx` line 98. Backend SQL `ROUND(... * 100.0 / COUNT(*), 2)` already returns a 0-100 range value.

**Gap 3 — User stats field names:** `fetchByUser` return type now declares `userName` and `docCount`. `UserStats` renders `row.userName` (line 105) and `row.docCount` (line 110). Chart yAxis uses `u.userName` (line 30).

**Gap 4 — Workflow stats field names:** `fetchByWorkflow` return type now declares `callCount` and `docCount`. `WorkflowStats` chart series uses `w.callCount` (line 37), table uses `row.callCount` (line 103) and `row.docCount` (line 109), sort uses `callCount` (line 123).

**Gap 5 — Overview audit structural bug:** `flattenAuditRecords()` now extracts `response?.data ?? []` from `PaginatedResponse<AuditDocumentRow>` and maps `AuditDocumentRow` fields (`userName`, `workflowName`, `totalTokens`, `totalDuration`, `estimatedCost`, `createdAt`) to the `AuditRecord` display interface. The previous code was treating the paginated response object as an array and accessing `doc.records` (a field that does not exist).

No regressions detected in the 8 previously-passing truths (backend APIs 1-9, audit sub-tabs, routing).

---

_Verified: 2026-03-26T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
