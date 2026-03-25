# Feature Landscape — v1.1 Operations Enhancement & Smart Editing

**Domain:** AI-powered document generation platform (enterprise internal)
**Researched:** 2026-03-25
**Milestone:** v1.1 — Background generation, analytics, quota, search/favorites, AI inline editing

## Table Stakes

Features users expect for an operations-mature AI platform. Missing = product feels incomplete for admin/power users.

| Feature | Why Expected | Complexity | Dependencies (v1.0) | Notes |
|---------|--------------|------------|---------------------|-------|
| Usage statistics dashboard (overview) | Admins need visibility into platform adoption and cost; every AI SaaS shows this | Med | Model call logs already captured in DB during node execution | Total calls, total tokens, active users, doc count, total cost. Aggregate queries over existing execution records |
| Per-model usage breakdown | Must know which models cost the most and which fail often | Med | Model config + execution logs exist | Calls, tokens, success rate, cost per model. Standard drill-down |
| Per-user usage breakdown | Required for accountability and cost allocation in enterprise | Med | User table + execution logs exist | Usage frequency, docs generated, tokens consumed, cost per user |
| Generation record audit trail | Enterprise compliance requires full traceability of AI operations | Med | Node execution records + file index already stored | Per-generation detail: who, what flow, which nodes, models used, timing, token counts, cost. Admin-only call logs |
| Quota limits (daily/monthly per user) | Without limits, one user can exhaust the AI budget for everyone | Med | User table, model config exist | Per-user daily/monthly call count + token limits. Must enforce at model-call node execution time |
| Over-limit handling (warn/block) | Users need clear feedback when approaching or hitting limits | Low | Quota enforcement above | Three strategies per the requirements: warn, block, allow-with-notice |
| Background AI generation | Long generations (multi-model, large docs) block the user; competitors all support "close tab, come back later" | High | SSE streaming infra exists, node execution engine exists | Must decouple execution from browser session. Requires server-side task persistence |
| Completion notification (in-app) | If generation runs in background, user must know when it finishes | Med | Background generation above | In-app notification list / badge. Poll or SSE-push for real-time |
| Document search within project | Already exists in v1.0 (title/description keyword search) | -- | Already shipped | No new work needed |
| DTYPE-04 document association guard | Tech debt: prevent deletion of document types that have associated documents | Low | Document type + document tables exist | Simple FK check before delete. Spec says "only delete when no associated docs" |

## Differentiators

Features that elevate the product beyond basic expectations. Not strictly required, but significantly improve user experience and admin capability.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| WeChat Work completion notification | Users get push notification on their phone/desktop WeChat when background generation finishes, no need to keep checking the app | Med | WeChat Work API integration exists (OAuth, department query, project invitation notifications already built). Background generation must exist first | Use application message API (`POST /cgi-bin/message/send`). Text card message type is ideal: shows doc title, flow name, status, with a link back to the document. Rate limit: 200 msgs/member/min from same app, 10K/day — more than sufficient |
| Global cross-project search | Power users with many projects need to find docs/flows quickly without browsing each project | Med-High | PostgreSQL full-text search capability. Document visibility/permission system exists | PostgreSQL `tsvector`/`tsquery` with GIN index is sufficient for the user scale (50+ concurrent). No need for Elasticsearch. Must respect document visibility rules. Search across: documents (title, description), projects (name, description), flows (name) |
| Recent access list | Quick navigation to recently viewed/edited documents. Standard productivity pattern (like "Recent" in Google Docs, Notion, Figma) | Low | Need new `recent_access` table tracking user + entity + timestamp | Simple table: user_id, entity_type (document/project), entity_id, accessed_at. Query last N items ordered by timestamp. Update on document/project open |
| Favorites / bookmarks | Users want to pin frequently used projects, documents, and flows for quick access | Low | Need new `favorites` table | Simple table: user_id, entity_type, entity_id, created_at. Toggle favorite on/off. Filter views by "my favorites" |
| Multi-dimension statistics (dept/project/doc-type/flow) | Deeper analytics let management understand adoption patterns and optimize resource allocation | Med | Department info from WeChat Work, project/doc-type/flow data all exist | Aggregate queries with GROUP BY across dimensions. Time-series with week/month/year granularity. Custom date range |
| Flow usage statistics | Know which flows are popular, which are underused, helps admins optimize flow library | Low-Med | Flow + execution data exist | Usage count, user distribution, doc count, trend over time, per-node config frequency |
| Per-department/per-project quotas | Finer-grained cost control beyond per-user limits | Med | Department data from WeChat Work, project table exists | Hierarchical quota: check user limit first, then project limit, then department limit. More complex enforcement logic |
| AI-assisted inline editing | Transform the node output editor from a plain markdown editor into an AI-powered writing tool. Major differentiator vs. manual copy-paste-edit workflow | High | Markdown editor exists in node operation ("edit current content"). Model call infrastructure exists. Desensitization state awareness required (pre-restore: online models OK; post-restore: local models only) | See detailed UX patterns below |

## AI-Assisted Inline Editing — Detailed UX Patterns

This is the most complex differentiator. Based on research into Notion AI, Cursor, Type.ai, CKEditor AI, and documented AI editing patterns:

### Expected Interaction Model

1. **Selection-triggered actions**: User selects text in the markdown editor, a floating toolbar appears with AI actions (rewrite, simplify, expand, fix grammar, translate, custom instruction)
2. **Inline diff preview**: AI suggestion shown as inline diff — deletions in red/strikethrough, additions in green/highlighted. NOT a separate panel
3. **Accept/Reject per change**: User can accept all, reject all, or accept/reject individual hunks
4. **Custom instruction**: Free-text input for "make this more formal" or "add technical details about X"
5. **Streaming response**: Show AI output as it generates (reuse existing SSE streaming infrastructure)

### Security Constraint (Unique to This Platform)

The requirements specify a critical security rule:
- **Before information restore node**: AI editing can use online (cloud) models — sensitive data is still desensitized
- **After information restore node**: AI editing MUST only use local/private models — real sensitive data is present

This requires the inline editor to know which models are available based on the current node's position relative to the information restore node in the flow. The model selector in the AI edit toolbar must be filtered accordingly.

### Recommended Implementation Approach

- Reuse the existing model call infrastructure (OpenAI-compatible API + SSE streaming)
- Build a lightweight diff engine for markdown (word-level or line-level diff)
- Floating toolbar on text selection (not a sidebar — inline is the established pattern)
- Streaming the suggestion inline, then converting to diff view on completion
- Model picker filtered by desensitization state

### Complexity Drivers

- Markdown-aware diffing (must not break markdown syntax)
- Streaming + diff rendering interaction
- Security-aware model filtering based on flow position
- Undo/redo integration with the editor

## Anti-Features

Features to explicitly NOT build in v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time collaborative editing | Out of scope (CRDT/OT complexity). Business rule: one editor at a time | Already enforced in v1.0. Keep single-editor model |
| Custom user-defined analytics dashboards | Over-engineering for internal tool with known user roles | Provide the fixed dashboard layouts per requirements (overview, detail, multi-dimension) |
| AI auto-complete while typing (copilot-style) | High latency disrupts writing flow in document context; selection-based editing is more intentional and controllable | Implement selection-triggered AI editing only |
| Email/SMS notifications | Users are all on WeChat Work; adding email/SMS is unnecessary channel complexity | WeChat Work application message + in-app notification only |
| Export analytics to Excel/PDF | Premature optimization; admins will view dashboards in-app | Simple dashboard views. Add export later if requested |
| Elasticsearch/external search engine | Overkill for the user scale (50+ concurrent, not millions of docs). Adds infrastructure complexity | PostgreSQL full-text search with GIN indexes. Revisit only if search performance degrades significantly |
| Per-token billing/chargeback to departments | Complex financial system, not needed for internal tool | Show cost estimates for visibility, but don't build actual billing |
| AI editing in sidebar/chat panel | Research shows inline editing is the dominant pattern; sidebar breaks flow and feels disconnected | Inline selection-based editing with floating toolbar |

## Feature Dependencies

```
Background AI Generation
  --> In-App Completion Notification (can't notify without background tasks)
  --> WeChat Work Completion Notification (can't push without background tasks)

Quota Enforcement (per-user)
  --> Per-Department/Per-Project Quotas (extends the base mechanism)
  --> Over-Limit Handling (requires quota check infrastructure)

Usage Statistics Dashboard (overview)
  --> Multi-Dimension Statistics (extends base aggregation)
  --> Flow Usage Statistics (specialized view)

DTYPE-04 Document Association Guard
  --> (independent, no dependencies, pure tech debt fix)

Global Cross-Project Search
  --> (independent, but benefits from Recent Access for ranking signals)

Recent Access
  --> (independent, no dependencies)

Favorites
  --> (independent, no dependencies)

AI-Assisted Inline Editing
  --> (independent of other v1.1 features, but depends on v1.0 editor + model call infra)
```

## MVP Recommendation for v1.1

### Phase 1 — Foundation (do first)
1. **DTYPE-04 document association guard** — Pure tech debt, lowest risk, independent
2. **Background AI generation + in-app notification** — Enables the notification features; high user value since long generations currently block the browser
3. **WeChat Work completion notification** — Low marginal effort once background generation exists; leverages existing WeChat Work integration

### Phase 2 — Analytics & Control
4. **Usage statistics dashboard (overview + per-model + per-user)** — Admins need visibility before they can set meaningful quotas
5. **Generation record audit trail** — Pairs naturally with the dashboard
6. **Quota limits (per-user daily/monthly) + over-limit handling** — Informed by usage data from the dashboard
7. **Multi-dimension statistics + flow usage** — Extends the dashboard

### Phase 3 — User Productivity
8. **Recent access + favorites** — Quick wins, low complexity, immediate user value
9. **Global cross-project search** — Medium complexity, requires PostgreSQL FTS setup and permission-aware query

### Phase 4 — Smart Editing
10. **AI-assisted inline editing** — Highest complexity, most isolated from other features, benefits from all infrastructure being stable

### Rationale
- Background generation is the critical path — it unblocks notifications and is the highest-value user feature
- Analytics before quotas: you need to see usage patterns before setting sensible limits
- Search/favorites are independent quick wins that can slot in anywhere
- AI inline editing is the most complex and most isolated — do it last when everything else is stable

## Complexity Summary

| Feature | Complexity | Effort Estimate | Risk |
|---------|------------|-----------------|------|
| DTYPE-04 guard | Low | 1-2 days | Minimal |
| Background AI generation | High | 5-8 days | Medium — requires decoupling execution from SSE connection lifecycle |
| In-app notification | Med | 2-3 days | Low |
| WeChat Work notification | Med | 1-2 days | Low — API integration pattern already established |
| Usage dashboard (overview) | Med | 3-5 days | Low — aggregation queries over existing data |
| Audit trail detail view | Med | 2-3 days | Low — data already captured, need UI |
| Multi-dimension statistics | Med | 3-4 days | Low |
| Flow usage statistics | Low-Med | 2-3 days | Low |
| Quota enforcement | Med | 3-5 days | Medium — must not break existing generation flow |
| Recent access | Low | 1-2 days | Minimal |
| Favorites | Low | 1-2 days | Minimal |
| Global cross-project search | Med-High | 4-6 days | Medium — permission-aware FTS, Chinese text segmentation |
| AI inline editing | High | 8-12 days | High — diff rendering, streaming UX, security-aware model filtering |

**Total estimated effort: 36-58 days** (single developer)

## Sources

- [WeChat Work Application Message API](https://developer.work.weixin.qq.com/document/path/90236) — Official docs for push notification
- [WeChat Work Message Push Configuration](https://developer.work.weixin.qq.com/document/path/91770) — Rate limits and configuration
- [PostgreSQL Full Text Search Documentation](https://www.postgresql.org/docs/current/textsearch.html) — Official FTS docs
- [PostgreSQL FTS as Alternative to Elasticsearch](https://iniakunhuda.medium.com/postgresql-full-text-search-a-powerful-alternative-to-elasticsearch-for-small-to-medium-d9524e001fe0) — Validation of PG FTS for small-medium scale
- [AI UX Patterns: Inline Action](https://www.shapeof.ai/patterns/inline-action) — Selection-triggered AI editing pattern
- [UI Patterns for AI in Document Editors](https://aipatterns.substack.com/p/ai-patterns-for-document-editors) — Diff preview, accept/reject patterns
- [AI-Assisted Inline Editing: Systems & Workflows](https://www.emergentmind.com/topics/ai-assisted-inline-editing) — Context windows, latency targets, streaming
- [Token Usage Tracking: Controlling AI Costs](https://www.statsig.com/perspectives/tokenusagetrackingcontrollingaicosts) — Quota and metering patterns
- [AI Usage and Token Consumption Visibility](https://larridin.com/blog/ai-usage-token-visibility) — Enterprise cost control patterns
- [API Rate Limiting Best Practices 2025](https://zuplo.com/learning-center/10-best-practices-for-api-rate-limiting-in-2025) — Rate limiting strategies
- [Rate Limiting in AI Gateway](https://www.truefoundry.com/blog/rate-limiting-in-llm-gateway) — LLM-specific rate limiting (RPM, TPM, tiered)
- [Azure Background Jobs Guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs) — Background task architecture patterns
- [Long-Running Tasks: Polling vs SSE vs WebSocket](https://tyk.io/blog/moving-beyond-polling-to-async-apis/) — Async notification patterns
