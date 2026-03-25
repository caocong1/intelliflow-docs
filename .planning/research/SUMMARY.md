# Project Research Summary

**Project:** IntelliFlow Docs v1.1 -- Operations Enhancement & Smart Editing
**Domain:** Enterprise internal AI-powered document generation platform
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

IntelliFlow is an enterprise-internal AI document generation platform where users compose document workflows from 5 node types (input conversion, desensitization, model call, information restore, file export) to drive multi-model parallel generation. The v1.0 platform is already built and running on a Bun monorepo with ElysiaJS + Drizzle ORM + SolidJS + PostgreSQL. The v1.1 milestone adds operational maturity (background generation, analytics, quotas), user productivity (search, favorites, recent access), and a high-value differentiator (AI-assisted inline editing).

The recommended approach for v1.1 is to build incrementally on the existing architecture without introducing new infrastructure dependencies. The architecture research strongly recommends keeping the stack lean: in-process background execution with PostgreSQL persistence instead of Redis/BullMQ, direct SQL aggregation for analytics instead of a separate analytics store, and `pg_trgm` with ILIKE for Chinese-friendly search instead of Elasticsearch or tsvector. This "right-size for 50 concurrent users" principle runs through every architectural decision and is the correct call for an internal tool.

The primary risks are: (1) background execution decoupling -- detaching the workflow engine from the HTTP request lifecycle without breaking existing foreground streaming; (2) AI inline editing complexity -- markdown-aware diffing, streaming UX, and the security constraint that post-restore editing must use local-only models; (3) quota enforcement gaps -- quotas must be checked in both the HTTP request path and the background execution loop, or background jobs silently bypass limits. All three are well-understood and have concrete prevention strategies documented in the architecture and pitfalls research.

## Key Findings

### Recommended Stack

**Note:** STACK.md was researched for the original v1.0 build and recommends NestJS + Prisma + React + Vite. The actual v1.0 codebase uses **ElysiaJS + Drizzle ORM + SolidJS + Bun + Tailwind CSS v4**. All v1.1 architecture research is correctly based on the actual stack. STACK.md remains useful as a reference for technology rationale (PostgreSQL, Redis, SSE, document format libraries) but its framework recommendations do not apply.

**Actual stack (from ARCHITECTURE.md):**
- **ElysiaJS** on **Bun**: Backend framework with plugin composition, Eden Treaty for type-safe API
- **SolidJS + Tailwind CSS v4**: Frontend SPA
- **Drizzle ORM + PostgreSQL 18**: Database with 14+ tables, `pgEnum` types
- **SSE via ReadableStream**: Real-time streaming for model output
- **OpenAI-compatible API**: Model call strategy pattern (base -> openai-compatible, claude-agent-sdk)
- **WeChat Work integration**: OAuth + `sendTextCardMessage()` already built

**From STACK.md (still applicable for v1.1):**
- **PostgreSQL pg_trgm**: Chinese-friendly trigram search, no segmentation extension needed
- **SSE (Server-Sent Events)**: Continue using for background task status and inline edit streaming
- **Document format libraries** (mammoth, pdf-parse, exceljs, docx, md-to-pdf): For export node enhancements if needed

### Expected Features

**Must have (table stakes):**
- Background AI generation with task persistence -- long generations currently block the browser
- In-app completion notification -- required once background generation exists
- Usage statistics dashboard (overview, per-model, per-user) -- admins need cost visibility
- Generation record audit trail -- enterprise compliance requirement
- Quota limits (per-user daily/monthly) with over-limit handling (warn/block)
- DTYPE-04 document association guard -- tech debt, prevents deleting document types with associated documents

**Should have (differentiators):**
- WeChat Work completion notification -- low marginal cost, leverages existing integration
- Global cross-project search with `pg_trgm` -- power user productivity
- Recent access list + favorites -- standard productivity patterns
- Multi-dimension statistics (department/project/doc-type/flow) -- management visibility
- AI-assisted inline editing -- highest-value differentiator, selection-triggered with inline diff

**Defer (v2+):**
- Real-time collaborative editing (CRDT/OT complexity, single-editor model is fine)
- Per-token billing/chargeback to departments
- Elasticsearch (overkill at current scale)
- AI auto-complete while typing (copilot-style)
- Export analytics to Excel/PDF

### Architecture Approach

The v1.1 architecture extends the existing modular ElysiaJS backend with 4 new modules (notification, stats, quota, search) and 2 new services within the existing runtime module (background execution, inline editing). No new infrastructure dependencies are introduced. All features build on the existing PostgreSQL database with 4 new tables (`background_tasks`, `quotas`, `user_favorites`, `user_recent_access`) and new GIN trigram indexes for search. The key architectural pattern is "decouple execution from HTTP lifecycle" -- background execution uses `setTimeout(fn, 0)` to fire-and-forget the workflow loop, with PostgreSQL as the task state store.

**Major components:**
1. **Background execution service** (`background.service.ts`) -- Runs workflow nodes in a detached async loop, updates `background_tasks` table for progress tracking, triggers notifications on completion/failure
2. **Notification service** (`notification.service.ts`) -- Thin wrapper over existing `wecom.service.ts`, sends WeChat Work text card messages for task completion
3. **Statistics service** (`stats.service.ts`) -- Aggregation queries over existing `modelCallLogs` and `nodeExecutions` tables, time-series with `date_trunc`
4. **Quota guard** (`quota.guard.ts`) -- ElysiaJS `onBeforeHandle` plugin that checks user quotas before model calls, must also be called inside background execution loop
5. **Search service** (`search.service.ts`) -- `ILIKE` queries with `pg_trgm` GIN indexes, permission-aware via `projectMembers` join
6. **Inline edit service** (`inline-edit.service.ts`) -- SSE streaming endpoint for AI text editing, with security constraint enforcement (local-only models after restore node)

### Critical Pitfalls

1. **Background execution bypassing quotas** -- Quota checks at the HTTP layer miss background jobs. Must check quotas inside `background.service.ts` before each model call node, or background jobs silently exceed limits.
2. **Desensitization data leakage via inline editing** -- After the information restore node, real sensitive data is present. The inline edit endpoint must enforce local-only model usage post-restore. This requires checking `nodeExecutions` for completed restore nodes before allowing a model call.
3. **SSE connection management** -- Background generation reduces SSE pressure (users leave the page), but inline editing adds new streaming connections. Continue using the single-connection-per-document multiplexing pattern. Detect client disconnect and clean up.
4. **Working directory disk exhaustion** -- Background generation runs without user oversight, potentially creating more temp files. Implement cleanup for completed background task working directories.
5. **Workflow config mutation mid-execution** -- Already mitigated in v1.0 via workflow snapshots, but background execution makes this more critical since tasks run longer without user observation. Verify background execution reads from snapshot, not live workflow config.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Schema Migration + Tech Debt
**Rationale:** All v1.1 features need new tables and indexes. DTYPE-04 is a standalone fix with zero risk. Ship infrastructure first.
**Delivers:** 4 new tables (`background_tasks`, `quotas`, `user_favorites`, `user_recent_access`), `pg_trgm` extension, GIN trigram indexes on documents/projects, `inline_edit` addition to `callSourceEnum`, DTYPE-04 association guard.
**Addresses:** DTYPE-04 guard (table stakes), database foundation for all other features.
**Avoids:** Schema migration conflicts later; closes tech debt early.
**Effort:** 2-3 days.

### Phase 2: Background Execution + Notifications
**Rationale:** Highest user-value feature. Unblocks notification features. Must exist before quota enforcement matters (quotas are meaningless if generation is foreground-only since users self-throttle by waiting).
**Delivers:** Background generation toggle, task status polling, in-app notification, WeChat Work push notification on completion/failure.
**Uses:** Existing `runtime.service.ts` (extract `advanceNode`), existing `wecom.service.ts` (`sendTextCardMessage`), new `background_tasks` table.
**Implements:** `background.service.ts`, `background.routes.ts`, `notification.service.ts`.
**Avoids:** Over-engineering with Redis/BullMQ; keeps in-process execution with PostgreSQL persistence.
**Effort:** 8-13 days.

### Phase 3: Statistics & Audit Dashboard
**Rationale:** Admins need usage visibility before setting quotas. Analytics reads existing `modelCallLogs` data -- no write-side changes needed. Natural prerequisite for informed quota configuration.
**Delivers:** Overview dashboard (total calls, tokens, cost, active users), per-model breakdown, per-user breakdown, time-series trends, generation audit trail detail view.
**Uses:** Existing `modelCallLogs` and `nodeExecutions` tables, Drizzle `sql` tagged templates for aggregation.
**Implements:** `stats.service.ts`, `stats.routes.ts`, admin Statistics page with charting.
**Avoids:** Separate analytics database (overkill at 50-user scale).
**Effort:** 8-12 days.

### Phase 4: Quota Management
**Rationale:** Informed by usage data from Phase 3. Must enforce in both HTTP path (ElysiaJS plugin) and background execution loop.
**Delivers:** Per-user daily/monthly call and token limits, warning threshold (80% default), over-limit handling (warn/block), admin quota management UI.
**Uses:** `quotas` table, `modelCallLogs` for usage counting.
**Implements:** `quota.service.ts`, `quota.guard.ts` (ElysiaJS `onBeforeHandle`), admin QuotaManagement page.
**Avoids:** Quota check only in middleware (must also check in background loop).
**Effort:** 5-8 days.

### Phase 5: Search, Recent Access, Favorites
**Rationale:** Independent user-facing polish features. Low complexity, high productivity value. No dependency on other v1.1 features.
**Delivers:** Global cross-project search (documents, projects, workflows), recent access list (last 50 items per user), favorites toggle, dashboard integration.
**Uses:** `pg_trgm` GIN indexes, `user_favorites` and `user_recent_access` tables, permission-aware queries via `projectMembers` join.
**Implements:** `search.service.ts`, `favorites.service.ts`, SearchBar component, SearchResults page.
**Avoids:** Elasticsearch/external search engine; tsvector (requires Chinese segmentation extension).
**Effort:** 6-10 days.

### Phase 6: AI-Assisted Inline Editing
**Rationale:** Most complex feature, most isolated from others. Benefits from all infrastructure being stable. Highest risk (streaming + diffing + security constraint).
**Delivers:** Selection-triggered AI actions (rewrite, simplify, expand, fix, translate, custom instruction), inline diff preview, accept/reject per change, streaming response, security-aware model filtering (local-only after restore).
**Uses:** Existing model call SSE streaming infrastructure, existing `InlineEditor.tsx`.
**Implements:** `inline-edit.service.ts`, `inline-edit.routes.ts`, `AIEditDialog.tsx`, enhanced `InlineEditor.tsx`.
**Avoids:** Copilot-style auto-complete (disruptive in document context); sidebar chat panel (inline is the established pattern).
**Effort:** 8-12 days.

### Phase Ordering Rationale

- **Schema first (Phase 1):** Every subsequent phase depends on new tables or indexes. Shipping migrations early avoids conflicts.
- **Background execution before analytics (Phase 2 before 3):** Background tasks generate data that analytics can aggregate. Also, background execution is the single highest-value user feature.
- **Analytics before quotas (Phase 3 before 4):** Admins need to observe actual usage patterns before setting sensible limits. Setting quotas blind leads to either too-restrictive limits (user frustration) or too-generous limits (no protection).
- **Search/favorites are independent (Phase 5):** Could technically be built in parallel with any phase. Placed after quotas because admin features take priority over user convenience features.
- **Inline editing last (Phase 6):** Highest complexity, highest risk, most isolated. Markdown diffing, streaming UX, and security-aware model filtering are all novel. Benefits from runtime stability established by earlier phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Background Execution):** Needs careful design of how to detach `advanceNode` from HTTP request context. The existing runtime is tightly coupled to SSE response streams. Research how to create a non-streaming variant of `executeModelCall()`.
- **Phase 6 (AI Inline Editing):** Needs research into markdown-aware diff libraries for SolidJS, streaming diff rendering UX patterns, and how to integrate accept/reject UI into the existing `InlineEditor.tsx` component.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema + Tech Debt):** Standard Drizzle migration + simple FK check. Well-documented.
- **Phase 3 (Statistics):** Standard SQL aggregation queries. No novel patterns.
- **Phase 4 (Quotas):** Standard rate-limiting pattern. ElysiaJS `onBeforeHandle` is well-documented.
- **Phase 5 (Search/Favorites/Recent):** Standard CRUD + `pg_trgm` is well-documented PostgreSQL feature.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | STACK.md was researched for v1.0 and recommends a different framework stack (NestJS/Prisma/React) than what was actually built (ElysiaJS/Drizzle/SolidJS). Technology-level recommendations (PostgreSQL, SSE, doc format libs) remain valid. Framework-level recommendations are superseded by the actual codebase. |
| Features | HIGH | FEATURES.md is well-researched for v1.1 scope with clear complexity estimates, dependency mapping, and anti-features. Effort estimates (36-58 days total) are realistic. |
| Architecture | HIGH | ARCHITECTURE.md is grounded in the actual v1.0 codebase with specific file paths, table names, and code patterns. Component boundaries are clear. The "no new infrastructure" principle is well-justified for the 50-user scale. |
| Pitfalls | MEDIUM | PITFALLS.md was researched for the original v1.0 build. Most pitfalls (desensitization leakage, SSE management, workflow mutation) remain relevant for v1.1. Some pitfalls (CLI process management, Prisma migrations, BullMQ job failures) reference technologies not in the actual stack. The underlying concerns are valid even if specific technology references are off. |

**Overall confidence:** HIGH

### Gaps to Address

- **SolidJS charting library:** ARCHITECTURE.md mentions Chart.js with `solid-chartjs` or `@solid-primitives/canvas` for the statistics dashboard, but confidence is low. Validate that a suitable SolidJS-compatible charting solution exists before Phase 3 planning.
- **Markdown diff library for SolidJS:** AI inline editing requires word-level or line-level markdown-aware diffing. No specific library was recommended. Research needed during Phase 6 planning.
- **Background task recovery on server restart:** ARCHITECTURE.md mentions a "startup recovery sweep" for tasks stuck in `running` status, but does not detail the implementation. Design this during Phase 2 planning.
- **In-app notification delivery mechanism:** FEATURES.md mentions "poll or SSE-push for real-time" in-app notifications but ARCHITECTURE.md does not specify which approach. Decide during Phase 2 planning (recommendation: simple polling, since the user is not on the page during background generation).
- **Per-department/per-project quotas:** Listed as a differentiator in FEATURES.md but not included in the 6-phase plan. Defer to v1.2 or add as an extension to Phase 4 if time permits.

## Sources

### Primary (HIGH confidence)
- Existing v1.0 codebase (`packages/backend/src/db/schema.ts`, `packages/backend/src/modules/runtime/`) -- actual architecture baseline
- [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) -- trigram search for Chinese text
- [WeChat Work Application Message API](https://developer.work.weixin.qq.com/document/path/90236) -- push notification integration
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html) -- evaluated and rejected in favor of pg_trgm

### Secondary (MEDIUM confidence)
- [AI UX Patterns: Inline Action](https://www.shapeof.ai/patterns/inline-action) -- selection-triggered editing patterns
- [UI Patterns for AI in Document Editors](https://aipatterns.substack.com/p/ai-patterns-for-document-editors) -- diff preview, accept/reject
- [Token Usage Tracking](https://www.statsig.com/perspectives/tokenusagetrackingcontrollingaicosts) -- quota and metering patterns
- [API Rate Limiting Best Practices 2025](https://zuplo.com/learning-center/10-best-practices-for-api-rate-limiting-in-2025) -- rate limiting strategies

### Tertiary (LOW confidence)
- Chart.js + `solid-chartjs` for SolidJS charting -- needs validation
- `remark-docx` as alternative Markdown-to-Word pipeline -- fallback option

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
