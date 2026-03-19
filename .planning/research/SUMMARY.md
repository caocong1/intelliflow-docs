# Project Research Summary

**Project:** IntelliFlow — AI Document Generation Platform (智文平台)
**Domain:** Enterprise internal AI workflow orchestration and document generation
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

IntelliFlow is a visual workflow orchestration platform that drives multi-model AI document generation for enterprise teams. Expert implementations of systems like this use a modular monolith architecture — not microservices — for sub-200-user scale, pairing a NestJS backend with a React Flow visual editor and BullMQ for asynchronous AI task execution. The core technical challenge is that the v1 execution engine uses CLI subprocess spawning (e.g., `claude -p "..."`) which requires a file-materialization/collection cycle: data is written from PostgreSQL to a temporary working directory before CLI execution, then results are collected back into PostgreSQL afterward. This pattern is non-negotiable for CLI compatibility and must be treated as a first-class architectural concern from day one.

The recommended approach is a pnpm monorepo with NestJS 11 (Fastify adapter) + Prisma 7 + PostgreSQL 16 on the backend, and React 19 + Vite 6 + React Flow 12 + Ant Design 5 on the frontend. Node.js 22 LTS is required by pdf-parse 2.x. The key differentiator is the five-node workflow engine — InputTransform, Desensitize, ModelCall, Restore, Export — implemented via the Strategy pattern with one executor per node type. This design allows future node types (outline confirmation, human review, material selection) to be added as new files with zero changes to the engine core.

The three primary risks are data integrity (filesystem treated as source of truth instead of PostgreSQL), security (real sensitive values leaking into AI model prompts via desensitization mapping), and operational stability (CLI processes hanging without timeout/cleanup). All three are well-understood and have proven mitigations: the materialization/collection pattern, strict architectural separation of `getRulesForPrompt()` vs `getMappingForRestore()` in the desensitization service, and BullMQ-backed process management with per-model configurable timeouts. The workflow config snapshot pattern — deep-copying flow definitions into documents at creation time — is the single most important correctness decision in the entire system and enforces business rule #7 explicitly.

## Key Findings

### Recommended Stack

The stack is a cohesive, opinionated enterprise TypeScript monorepo. NestJS 11 provides the DI container, guard/interceptor system, and module boundaries that keep a complex 15+ table domain manageable. Prisma 7 (pure TypeScript, no Rust engine) delivers 3x query performance and 90% smaller bundles versus Prisma 6 — it is the correct ORM for this project. BullMQ 5 on Redis 7 handles all async work: CLI process dispatch, file parsing, export jobs, and cleanup cron tasks. React Flow 12 is the only viable choice for the visual workflow editor — it is the industry standard for node-based UIs in React, used by Stripe and Typeform. See `.planning/research/STACK.md` for full alternatives analysis.

**Core technologies:**
- **NestJS 11 + Fastify adapter**: Backend framework — enterprise DI/module system with high-performance HTTP
- **React 19 + Vite 6**: Frontend SPA — no SSR needed for internal tool, millisecond HMR
- **PostgreSQL 16 + Prisma 7**: Primary data store — schema-first ORM, pgcrypto for desensitization mapping encryption
- **Redis 7 + BullMQ 5**: Task queue and cache — CLI process dispatch, parallel AI jobs, SSE relay for multi-instance
- **@xyflow/react 12 (React Flow)**: Visual workflow editor — industry standard, custom nodes, drag-and-drop
- **Node.js child_process.spawn**: CLI model invocation (v1) — native, streaming stdout, process group management
- **SSE (Server-Sent Events)**: AI output streaming — NestJS `@Sse()` decorator, single connection multiplexed per task
- **TipTap 2**: Inline markdown editor — headless, ProseMirror-based, full React control
- **mammoth + pdf-parse + exceljs**: File parsing — Word/PDF/Excel input extraction
- **docx + md-to-pdf (Puppeteer)**: Document export — programmatic DOCX generation, high-fidelity PDF rendering

**Critical version constraints:**
- Node.js >= 22.x LTS (pdf-parse 2.x hard requirement)
- PostgreSQL >= 16 (RLS improvements, pgcrypto stability)
- TypeScript >= 5.7 (Prisma 7 requirement)
- Redis >= 7.x (BullMQ 5.x requirement)

### Expected Features

See `.planning/research/FEATURES.md` for full dependency graph and feature complexity breakdown.

**Must have (table stakes):**
- User auth (username/password v1) and role-based access (admin/user)
- AI provider and model configuration CRUD with connectivity testing
- Document type management
- Visual workflow orchestration editor (5 node types: InputTransform, Desensitize, ModelCall, Restore, Export)
- Document creation workspace with step-by-step node execution UI
- Multi-model parallel AI calling with SSE streaming output
- Information desensitization (local-only model) with encrypted mapping storage and prompt injection
- Information recovery (placeholder-to-real-value replacement, before/after diff view)
- File export (Word and Markdown minimum for MVP)
- Version snapshots per node completion with rollback capability
- Project management (CRUD, member management)

**Should have (differentiators):**
- Visual workflow editor with live validation and flow preview (admin self-service)
- Cross-model side-by-side comparison view
- Desensitization prompt injection (type descriptions auto-injected, zero manual work)
- Working directory browser (full transparency into generated artifacts)
- Audit trail with CLI command logs (exact reproducibility)

**Defer to M4+:**
- Project resource library (RAG/context injection — use Long Context + Caching per material-context-design.md, not full vector RAG)
- Statistics and audit dashboards
- Usage limits and quota management
- WeChat Work (WeCom) OAuth integration
- Background generation with notification
- PDF/Excel export polish beyond basics

### Architecture Approach

IntelliFlow uses a **modular monolith** (single NestJS application with strict module boundaries) deployed on a single server. At the 50-user target scale, microservices would add operational complexity with zero benefit. NestJS module boundaries serve as future extraction seams if a component needs to become an independent service in v2. The six core architectural patterns documented in ARCHITECTURE.md are: (1) Node Execution State Machine with atomic Prisma transactions, (2) Workspace Materialization/Collection Cycle for CLI compatibility, (3) Unified Model Executor (Adapter pattern hiding CLI vs API), (4) Centralized Prompt Assembly Pipeline, (5) SSE Event Multiplexing for multi-model streaming, and (6) Flow Snapshot on Document Creation for configuration immutability.

**Major components:**
1. **Workflow Engine** — state machine, node sequencing, rollback/skip logic, reads from flow snapshot only, never live config
2. **Model Invocation Layer** — unified CLI/API adapter interface, prompt assembly pipeline, SSE streaming relay
3. **Desensitization Service** — local model identification only, pgcrypto-encrypted mapping, strict rule/value separation at API level
4. **Workspace Manager** — tmp directory lifecycle (materialize/collect/cleanup), file indexing in DB
5. **Export Service** — Markdown-to-DOCX/PDF/XLSX via format-specific renderer classes (Strategy pattern)
6. **SSE Gateway** — single connection per task, multiplexed model event streams with model ID tagging
7. **Admin Console** (frontend) — provider/model config, document types, visual flow editor (React Flow)
8. **Document Workbench** (frontend) — step-by-step execution UI, streaming output, multi-model comparison

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full list with detection guidance. Top 5:

1. **Filesystem as source of truth** — PostgreSQL must be the single source of truth. Filesystem is ephemeral workspace only. Every file has a DB record. Collect results back to DB immediately after CLI execution. Any code reading filesystem state without a corresponding DB query is a bug.

2. **Desensitization data leakage** — The desensitization service must expose exactly two methods: `getRulesForPrompt()` (type descriptions only, safe for cloud models) and `getMappingForRestore()` (real values, restricted to local restore executor). Real values must never enter the model invocation layer. Enforce with unit tests.

3. **Workflow config mutation affecting running documents** — Snapshot the complete flow definition into the document record at creation time. Workflow engine reads ONLY from the snapshot, never from the live admin config table. This is business rule #7.

4. **CLI process management failures** — All CLI spawns must have configurable timeouts (default 5-10 min), PIDs tracked in DB, orphan cleanup on server restart, stdout streamed to file not memory buffer, BullMQ-backed cancellation. Never spawn CLI processes synchronously in HTTP handlers.

5. **SSE connection explosion** — Use exactly ONE SSE connection per document execution, multiplexing all model streams by event type with model ID field on each token event. The requirements define this protocol in Appendix A. Do not create per-model SSE connections.

## Implications for Roadmap

The hard technical dependency chain in ARCHITECTURE.md confirms the existing M1/M2/M3/M4 milestone structure is correctly ordered. The build order within each milestone is non-negotiable due to strict component dependencies.

### Phase 1: Foundation Infrastructure

**Rationale:** Database schema, authentication, and workspace manager are zero-dependency prerequisites. Everything else references these. Getting the schema right early avoids painful migrations. Workspace Manager is infrastructure that both Phase 2 (file uploads) and Phase 3 (CLI execution) depend on.
**Delivers:** Working NestJS + PostgreSQL + Redis + BullMQ backend. Authenticated API with JWT. Admin CRUD for providers, models, document types. Workspace directory lifecycle service. Docker Compose dev environment.
**Addresses:** User auth, RBAC, AI provider management, AI model configuration, document type management.
**Avoids:** Schema drift (use storage-architecture.md data models as starting point); over-engineering auth (Passport.js strategy pattern allows WeCom OAuth swap later without refactoring).

### Phase 2: Workflow Orchestration Editor

**Rationale:** Workflow definitions (config storage, validation, variable system) must exist before document creation can reference them. Flow validation is complex enough to warrant its own phase before adding runtime execution. The React Flow visual editor depends on all backend flow APIs being stable.
**Delivers:** Full workflow CRUD with node type registry, variable system (template engine with `{{variable}}` substitution), and flow validation (start/end rules, desensitize pairing check, variable resolution). Visual React Flow editor for admins. Workflow activation/deactivation.
**Uses:** React Flow 12 for visual editor, NestJS validation service, Prisma for flow definition storage.
**Implements:** Flow definition module, node type registry, variable template engine, visual flow designer frontend.
**Avoids:** React Flow learning curve — start with linear-only workflows, add parallel branches and conditional routing incrementally; variable circular reference bugs — validate at workflow save time, not execution time.

### Phase 3: Document Generation Runtime

**Rationale:** This is the most complex milestone with the most internal dependencies. The build order within Phase 3 must be strictly respected: state machine first, input transform executor second (validates the pattern with the simplest case), CLI adapter third, prompt assembler fourth, model call executor fifth, SSE streaming sixth, desensitization/restore seventh and eighth, export last. Multi-model parallel execution comes AFTER single-model execution is proven stable.
**Delivers:** Complete document generation workflow covering all 5 node types, CLI model invocation with SSE streaming, desensitization with encrypted mapping and prompt injection, information recovery, document export (Word + Markdown). Multi-model parallel comparison view. Project management.
**Uses:** BullMQ for async CLI dispatch, child_process.spawn with timeout/PID tracking, pgcrypto for mapping encryption, mammoth/pdf-parse for input files, docx/md-to-pdf for export, TipTap for inline editing.
**Implements:** Workflow state machine, all 5 node executors (Strategy pattern), CLI adapter, Prompt Assembler, SSE Gateway, Desensitization/Restore services, Export renderers (DOCX, PDF, XLSX).
**Avoids:** All 5 critical pitfalls — filesystem-as-truth, desensitization leakage, config mutation, CLI process failures, SSE connection explosion.

### Phase 4: Enhancement and Scale

**Rationale:** These features are independent subsystems that do not block core document generation. Building them after Phase 3 allows the team to validate the core flow first, then layer on value-adds without risk to the working product.
**Delivers:** Project resource library (file upload, async parsing via BullMQ, Long Context + Caching approach from material-context-design.md), statistics/audit dashboards, usage limits and quotas, WeChat Work OAuth (Passport.js strategy plugin), workspace archival automation.
**Avoids:** Full vector RAG pipeline — the Long Context + Caching approach is already decided and appropriate for this domain.

### Phase Ordering Rationale

- Database schema must come first because Prisma migrations are sequential and reworking a flawed relational model late in development is expensive. The storage-architecture.md document provides a well-defined starting schema.
- Auth gates all admin APIs, which gate all workflow operations, which gate all document operations. This dependency chain means auth cannot be deferred even partially.
- Workspace Manager is infrastructure used by both Phase 2 (file uploads in input transform preview) and Phase 3 (CLI workspace lifecycle). Building it in Phase 1 prevents blocking during later phases.
- The visual flow editor (React Flow) belongs in Phase 2 because it depends on stable backend flow APIs. Building frontend before backend APIs are finalized causes rework.
- SSE streaming infrastructure should be built alongside the Model Call executor (Phase 3), not before — there is no value in streaming infrastructure without a producer.
- Multi-model parallel execution is explicitly sequenced AFTER single-model execution is working. Debugging multiplexed SSE with three concurrent CLI processes before single-stream is stable creates unnecessary complexity.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 3 (CLI integration per model):** Each AI CLI tool (`claude`, `glm`, `kimi`, etc.) has its own argument conventions, stdout format, and exit code behavior. These must be empirically validated when implementing the CLI adapter. The adapter interface is correct; per-model command templates need documentation and testing.
- **Phase 3 (Local desensitization model):** No specific local model is named for PII identification. Locally-deployable NER/classification models that work on Chinese enterprise content need evaluation before Phase 3 desensitization executor implementation begins.
- **Phase 4 (Material context assembly):** Token budget calculation and prompt cache adapter implementation depend on specific model provider APIs. Research needed when Phase 4 begins.

Phases with standard patterns (skip research-phase):

- **Phase 1:** NestJS + Prisma + PostgreSQL + BullMQ follows well-documented official patterns. JWT/Passport.js auth is a solved problem with extensive NestJS examples.
- **Phase 2:** React Flow 12 has extensive documentation for custom nodes and drag-and-drop sidebar. Workflow CRUD is standard NestJS module work.
- **Phase 3 (State machine, Export):** Prisma transaction-based state machine and format conversion libraries all follow documented patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core libraries verified with official sources and npm registry. Version constraints confirmed against dependency requirements. Alternatives rigorously compared with clear rationale. |
| Features | HIGH | Directly extracted from v4-current.md (primary source of truth). Feature dependencies explicitly mapped. Deferral decisions cross-referenced with meeting notes and design docs. |
| Architecture | HIGH | Patterns validated against production examples (Windmill, PGFlow) and AI application architecture references. Modular monolith decision is correct for stated 50-user scale. |
| Pitfalls | HIGH | Pitfalls derived from project requirements business rules (#7 config immutability), security requirements (desensitization constraints), and storage architecture design decisions. Well-grounded in project-specific context, not generic warnings. |

**Overall confidence:** HIGH

### Gaps to Address

- **CLI tool behavior per model:** The exact command-line interface, output format, and error handling for each supported AI CLI tool must be empirically validated during Phase 3 CLI adapter implementation. This is a research task, not a risk.
- **Local desensitization model selection:** No specific model is named for Chinese PII identification. Evaluation of locally-deployable NER models needs to happen before Phase 3 desensitization work begins.
- **Export template design:** The Word export template format (styles, headers, footers, company branding) is a design decision not covered by research. Needs UX specification before Phase 3 export work begins.
- **WeCom OAuth specifics:** Enterprise WeChat OAuth has corp ID / agent ID nuances. Needs dedicated research when Phase 4 planning begins.
- **Chinese content in format conversion:** All document conversion libraries (docx, md-to-pdf) need testing with Chinese content and complex tables. Flagged as moderate risk (Pitfall 6); should be addressed with test fixtures early in Phase 3 export work.

## Sources

### Primary (HIGH confidence)
- `docs/requirements/v4-current.md` — Feature extraction, business rules, SSE event protocol (Appendix A)
- `docs/design/storage-architecture.md` — DB + filesystem hybrid design, materialization/collection pattern, pgcrypto encryption spec
- `docs/design/material-context-design.md` — RAG deferral rationale, Long Context + Caching approach
- [NestJS Official Documentation](https://docs.nestjs.com/) — Framework patterns, SSE decorator, Passport integration
- [Prisma 7 Release Announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) — Pure TypeScript engine, performance data
- [React Flow / xyflow v12](https://reactflow.dev) — Custom node capabilities, ELKjs auto-layout
- [BullMQ Official](https://bullmq.io/) — Queue patterns, concurrency control, cron scheduling
- [pgcrypto PostgreSQL Docs](https://www.postgresql.org/docs/current/pgcrypto.html) — Field-level encryption functions

### Secondary (MEDIUM confidence)
- [Windmill: Fastest self-hostable workflow engine](https://www.windmill.dev/blog/launch-week-1/fastest-workflow-engine) — PostgreSQL state transition patterns
- [PGFlow: Postgres-centric workflow engine](https://github.com/pgflow-dev/pgflow) — All workflow state in Postgres approach
- [Design Patterns for Gen AI Applications](https://code-b.dev/blog/gen-ai-architecture) — AI application architecture patterns
- [Smarter PII Handling in LLMs](https://www.firstsource.com/insights/blogs/when-privacy-meets-performance-smarter-way-handle-pii-llms) — Data masking for AI pipelines
- [TipTap Documentation](https://tiptap.dev/docs/editor/markdown) — Markdown extension capabilities
- [Prisma 7 Performance (InfoQ)](https://www.infoq.com/news/2026/01/prisma-7-performance/) — Performance benchmark data

### Tertiary (LOW confidence)
- [md-to-pdf GitHub](https://github.com/simonhaenisch/md-to-pdf) — PDF export approach; needs validation with Chinese content and complex tables
- [remark + remark-docx](https://github.com/dolanmiu/docx) — Alternative Word export pipeline; fallback only if primary docx library proves insufficient

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
