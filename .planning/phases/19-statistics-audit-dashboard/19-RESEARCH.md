# Phase 19: Statistics & Audit Dashboard - Research

**Researched:** 2026-03-26
**Domain:** Data visualization dashboard (SolidJS + charting library + SQL aggregation)
**Confidence:** HIGH

## Summary

This phase adds an admin-only statistics dashboard with KPI cards, trend charts, dimension drill-downs (model/user/workflow), and audit detail views. The primary data source is the existing `model_call_logs` table, joined with `documents`, `users`, `workflows`, and `projects` tables for dimension filtering.

The key technical decision is the charting library. ECharts is the recommended choice: it has zero framework dependency (vanilla JS with DOM ref), works seamlessly with SolidJS via `onMount`/`onCleanup`, and provides all required chart types (line, area, bar, pie/doughnut) with built-in tooltip and legend interaction out of the box. No SolidJS-specific wrapper is needed.

The backend needs new aggregation API endpoints that perform `GROUP BY` queries with date truncation (`date_trunc`) for time-series data. All statistics derive from `model_call_logs` -- no new tables are needed. Cost estimation requires a design decision since there is no per-model pricing field; the simplest approach is adding `inputPricePerMToken` and `outputPricePerMToken` fields to the `models` table or computing cost from `budgetUsedUsd` where available.

**Primary recommendation:** Use ECharts (vanilla, no wrapper) with imperative `onMount` initialization in SolidJS components. Backend aggregation via Drizzle SQL with `date_trunc` grouping.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bento grid layout with mixed-size cards; 8 KPI cards (total calls, total tokens, active users, doc count, estimated cost, today's calls, avg duration, avg success rate)
- KPI cards show pure numbers, no period-over-period comparison
- Default date range: last 7 days; switchable to today/last 30 days/custom
- Overview page Bento grid includes 4 chart modules: call trend, model distribution, user TOP ranking, recent audit records
- Admin-only; sidebar gets new "统计面板" top-level menu entry
- Basic chart interaction only: hover tooltip, click legend to toggle series; no data export, no zoom/brush
- Drill-down via Tabs below overview: 模型统计 | 用户统计 | 流程统计 | 审计明细 (same page, no sub-routes)
- Shared filter bar at page top: date range + multi-dimension dropdowns (department/project/doc type/workflow)
- Time granularity toggle (day/week/month) as button group next to date range
- Filters shared across overview and all tabs
- Audit tab has two sub-tabs: "按用户" and "按文档" with expandable rows
- Audit coexists with existing ModelCallLogs (technical logs stay, audit is business-focused)
- Each audit record: who, which workflow, which nodes/models, duration, token count, cost

### Claude's Discretion
- Chart library choice (ECharts/Chart.js/other, must work with SolidJS)
- Trend chart type (area/line/bar, can mix per scenario)
- Dimension detail click behavior (expand row/side drawer/not supported)
- Whether audit expanded rows show full prompts and model output

### Deferred Ideas (OUT OF SCOPE)
- Personal usage statistics for regular users
- Data export (CSV/Excel)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STAT-01 | Overview dashboard: total calls, tokens, active users, doc count, estimated cost | KPI cards from `COUNT/SUM` on `model_call_logs`; active users from `COUNT(DISTINCT userId)`; cost from token usage + model pricing |
| STAT-02 | Per-model stats: calls, tokens, success rate, cost, trend | `GROUP BY modelId` + `date_trunc` for trends; success rate = `COUNT(status=completed)/COUNT(*)` |
| STAT-03 | Per-user stats: frequency, doc count, tokens, cost | `GROUP BY userId` joined with `users` table |
| STAT-04 | Audit detail: who, workflow, nodes, models, duration, tokens, cost | Join `model_call_logs` with `documents`, `workflows`, `node_executions`, `users` |
| STAT-05 | Cross-dimension filtering: department/project/doc type/workflow | Join chain: `model_call_logs` -> `documents` -> `projects` (department), `workflows` -> `document_types`; filter params on all aggregation queries |
| STAT-06 | Per-workflow stats: usage count, user distribution, doc count, trend | `GROUP BY workflowId` on documents table joined with model_call_logs |
| STAT-07 | Custom date range + time granularity (day/week/month) | `date_trunc(granularity, created_at)` in SQL; frontend date picker + granularity button group |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| echarts | ^5.5 | Charts (line, bar, pie, area) | Framework-agnostic, works with any DOM ref; richest built-in chart types; excellent tooltip/legend defaults; widely used in enterprise dashboards |
| drizzle-orm | (existing) | SQL aggregation queries | Already in project; supports raw SQL via `sql` template for `date_trunc` and complex aggregations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | ECharts has no SolidJS wrapper needed; use vanilla API |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ECharts | Chart.js | Lighter bundle but fewer built-in chart types; needs chartjs-adapter-date-fns for time axis; less polished tooltips |
| ECharts | Apache ECharts (same) | solid-echarts wrapper exists but unmaintained; vanilla API is simpler and equally effective |
| ECharts | @unovis/solid | SolidJS-native but small ecosystem, fewer chart types, less documentation |

**Installation:**
```bash
bun add echarts
```

## Architecture Patterns

### Recommended Project Structure
```
packages/frontend/src/pages/admin/
├── StatsDashboard.tsx           # Main page: filter bar + overview + tabs
├── stats/
│   ├── KpiCards.tsx              # 8 KPI metric cards (Bento grid)
│   ├── OverviewCharts.tsx        # 4 chart modules for overview
│   ├── ModelStats.tsx            # Model tab content
│   ├── UserStats.tsx             # User tab content
│   ├── WorkflowStats.tsx         # Workflow tab content
│   ├── AuditDetails.tsx          # Audit tab with sub-tabs
│   └── useChart.ts              # Shared ECharts hook (createEffect + onCleanup)

packages/backend/src/modules/
├── statistics/
│   ├── statistics.routes.ts     # GET /admin/statistics/* endpoints
│   └── statistics.service.ts    # Aggregation query logic
```

### Pattern 1: ECharts in SolidJS via onMount
**What:** Create a reusable hook that initializes ECharts on a div ref and handles resize/cleanup
**When to use:** Every chart component
**Example:**
```typescript
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

function useChart(container: () => HTMLDivElement | undefined) {
  let chart: echarts.ECharts | undefined;

  onMount(() => {
    const el = container();
    if (!el) return;
    chart = echarts.init(el);
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(el);
    onCleanup(() => { ro.disconnect(); chart?.dispose(); });
  });

  return (option: echarts.EChartsCoreOption) => chart?.setOption(option);
}
```

### Pattern 2: SQL Aggregation with date_trunc
**What:** Backend aggregation queries using PostgreSQL date_trunc for time-series grouping
**When to use:** All trend/time-series endpoints
**Example:**
```typescript
import { sql, eq, and, gte, lte, count, sum } from "drizzle-orm";

// Trend data grouped by time granularity
const trends = await db
  .select({
    period: sql<string>`date_trunc(${granularity}, ${modelCallLogs.createdAt})`.as("period"),
    callCount: count(),
    totalTokens: sum(sql`(${modelCallLogs.tokenUsage}->>'total_tokens')::int`),
  })
  .from(modelCallLogs)
  .where(and(gte(modelCallLogs.createdAt, dateFrom), lte(modelCallLogs.createdAt, dateTo)))
  .groupBy(sql`period`)
  .orderBy(sql`period`);
```

### Pattern 3: Shared Filter State
**What:** Single filter signal at page level, passed to overview + all tabs
**When to use:** The StatsDashboard page
**Example:**
```typescript
const [filters, setFilters] = createStore({
  dateFrom: sevenDaysAgo(),
  dateTo: today(),
  granularity: "day" as "day" | "week" | "month",
  department: "",
  projectId: "",
  documentTypeId: "",
  workflowId: "",
});
```

### Anti-Patterns to Avoid
- **Per-chart API calls:** Don't make separate API calls for each chart. Batch related stats into single endpoints (e.g., `/statistics/overview` returns all KPIs + chart data).
- **Client-side aggregation:** Don't fetch raw logs and aggregate in the browser. All aggregation must happen in PostgreSQL.
- **ECharts global import:** Don't `import echarts from "echarts"` (pulls entire 1MB bundle). Use tree-shakeable imports from `echarts/core`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/Canvas drawing | ECharts | Tooltip positioning, responsive resize, legend interaction are deceptively complex |
| Date range picker | Custom calendar component | HTML `<input type="date">` (existing pattern from ModelCallLogs) | Good enough for admin tool; no extra dependency |
| Number formatting | Custom formatters | `Intl.NumberFormat` | Handles locale-aware thousands separators, decimal places |
| Time-series grouping | JS-side date bucketing | PostgreSQL `date_trunc` | Correct timezone handling, vastly more efficient |

**Key insight:** The charting library handles all the hard visualization work. The real complexity is in writing correct SQL aggregation queries with proper joins and filters.

## Common Pitfalls

### Pitfall 1: ECharts Memory Leaks
**What goes wrong:** Charts not disposed on component unmount cause memory leaks
**Why it happens:** SolidJS component cleanup requires explicit `onCleanup`
**How to avoid:** Always call `chart.dispose()` in `onCleanup`; use `ResizeObserver` disconnect
**Warning signs:** Browser memory growing on tab switches

### Pitfall 2: Token Usage JSON Field Aggregation
**What goes wrong:** `tokenUsage` is a JSONB field with `{prompt_tokens, completion_tokens, total_tokens}`. Aggregating requires JSON extraction in SQL.
**Why it happens:** Token data is stored as JSON, not as separate columns
**How to avoid:** Use `(token_usage->>'total_tokens')::int` in SQL aggregations; handle NULL values with `COALESCE`
**Warning signs:** NULL results or type errors in aggregation queries

### Pitfall 3: Cost Estimation Without Pricing Data
**What goes wrong:** No per-model pricing exists in the schema. `budgetUsedUsd` only exists for Claude Agent SDK calls.
**Why it happens:** The platform is an internal tool; real billing was explicitly out of scope
**How to avoid:** Add `input_price_per_mtok` and `output_price_per_mtok` columns to `models` table (nullable, admin-configurable). Fall back to `budgetUsedUsd` for agent calls, and to zero when pricing not configured.
**Warning signs:** Cost displays showing 0 or N/A for most calls

### Pitfall 4: Large Dataset Performance
**What goes wrong:** Aggregation queries become slow with millions of log rows
**Why it happens:** No indexes on `created_at` + dimension columns for the model_call_logs table
**How to avoid:** Add composite indexes: `(created_at)`, `(model_id, created_at)`, `(user_id, created_at)`. Consider date range limits (e.g., max 90 days).
**Warning signs:** Dashboard load time > 2s

### Pitfall 5: ECharts Bundle Size
**What goes wrong:** Importing all of ECharts adds ~1MB to the frontend bundle
**Why it happens:** Default import pulls every chart type and component
**How to avoid:** Use tree-shakeable imports: `echarts/core` + only needed charts/components/renderers
**Warning signs:** Bundle size increase > 300KB

## Code Examples

### ECharts SolidJS Component
```typescript
// Reusable chart wrapper for SolidJS
import { onMount, onCleanup } from "solid-js";
import * as echarts from "echarts/core";

export function ChartContainer(props: { class?: string; option: () => echarts.EChartsCoreOption }) {
  let el: HTMLDivElement | undefined;
  let chart: echarts.ECharts | undefined;

  onMount(() => {
    if (!el) return;
    chart = echarts.init(el);
    chart.setOption(props.option());
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(el);
    onCleanup(() => { ro.disconnect(); chart?.dispose(); });
  });

  // Reactive update when option changes
  createEffect(() => {
    chart?.setOption(props.option(), true);
  });

  return <div ref={el} class={props.class ?? "w-full h-64"} />;
}
```

### Backend Overview KPI Endpoint
```typescript
// Single endpoint returning all overview KPIs
app.get("/admin/statistics/overview", async ({ query }) => {
  const { dateFrom, dateTo, department, projectId, docTypeId, workflowId } = query;
  const conditions = buildFilterConditions({ dateFrom, dateTo, department, projectId, docTypeId, workflowId });

  const [kpis] = await db
    .select({
      totalCalls: count(),
      totalTokens: sum(sql`COALESCE((${modelCallLogs.tokenUsage}->>'total_tokens')::int, 0)`),
      activeUsers: sql<number>`COUNT(DISTINCT ${modelCallLogs.userId})`,
      successCount: sql<number>`COUNT(*) FILTER (WHERE ${modelCallLogs.responseStatus} = 'completed')`,
      totalDuration: sum(modelCallLogs.duration),
    })
    .from(modelCallLogs)
    .leftJoin(documents, eq(modelCallLogs.documentId, documents.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(and(...conditions));

  // Document count is separate (not every doc has model calls)
  const [docCount] = await db
    .select({ value: sql<number>`COUNT(DISTINCT ${modelCallLogs.documentId})` })
    .from(modelCallLogs)
    .where(and(...conditions));

  return { ...kpis, documentCount: docCount.value };
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ECharts global import | Tree-shakeable `echarts/core` | ECharts 5.0 (2021) | ~60% bundle size reduction |
| Chart.js + wrapper libs | Vanilla Chart.js or ECharts with framework hooks | 2023+ | Wrappers often lag behind; vanilla API is more reliable |

**Deprecated/outdated:**
- `echarts/lib/*` deep imports: replaced by `echarts/core` + registered components in ECharts 5

## Open Questions

1. **Cost estimation pricing data**
   - What we know: `budgetUsedUsd` exists only for Agent SDK calls. No per-model pricing in schema.
   - What's unclear: Should pricing be admin-configurable per model, or hard-coded, or derived from provider APIs?
   - Recommendation: Add nullable `inputPricePerMTok`/`outputPricePerMTok` to `models` table. Admin fills in known prices. Display "N/A" when not configured. This is the simplest approach for an internal tool.

2. **Department dimension source**
   - What we know: `projects` table has a `department` varchar field. Users don't have a department field.
   - What's unclear: Is department filtering based on project's department or user's department?
   - Recommendation: Use project's `department` field since it exists. User department would require schema change.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/backend/src/db/schema.ts` - full data model with `modelCallLogs`, `documents`, `projects`, `workflows`, `users` tables
- Codebase analysis: `packages/frontend/src/pages/admin/ModelCallLogs.tsx` - existing admin page pattern with filters, pagination, expandable rows
- Codebase analysis: `packages/frontend/src/components/nav/Sidebar.tsx` - sidebar navigation pattern for adding new menu item
- ECharts official documentation - tree-shakeable imports, chart types, tooltip/legend configuration

### Secondary (MEDIUM confidence)
- ECharts + SolidJS integration pattern - based on ECharts being framework-agnostic (vanilla DOM API); no SolidJS-specific issues expected but not tested in this codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ECharts is well-established, framework-agnostic, works with any DOM-based framework
- Architecture: HIGH - follows existing codebase patterns (admin pages, Elysia routes, Drizzle queries)
- Pitfalls: HIGH - identified from schema analysis (JSONB aggregation, missing cost data, bundle size)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26
