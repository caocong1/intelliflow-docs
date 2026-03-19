# Domain Pitfalls

**Domain:** AI-powered document generation platform (enterprise internal)
**Researched:** 2026-03-19

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Filesystem as Source of Truth

**What goes wrong:** Treating the working directory filesystem as the primary data store. Files get corrupted, deleted, or desynchronized from DB state. Server restart or disk failure loses work.
**Why it happens:** The v1 CLI execution engine naturally reads/writes files, making it tempting to keep everything on disk.
**Consequences:** Data loss, inconsistent state between DB and filesystem, inability to query or audit, concurrent access races.
**Prevention:** Follow the materialization/recovery pattern from storage-architecture.md. DB is the single source of truth. Filesystem is ephemeral workspace only. Every file has a DB record. Recover results to DB immediately after CLI execution.
**Detection:** Any code that reads filesystem state without a corresponding DB query is a red flag.

### Pitfall 2: Workflow Config Mutation Affecting Running Documents

**What goes wrong:** Admin edits a workflow while users have documents mid-execution using that workflow. Changing prompts, node order, or variable definitions breaks in-flight documents.
**Why it happens:** Forgetting business rule #7: "workflow changes don't affect in-progress documents."
**Consequences:** Corrupted document generation, broken variable references, user confusion, data integrity violations.
**Prevention:** Snapshot the entire workflow configuration (nodes, prompts, variables, model selections) when a document is created. Store the snapshot in DB and/or meta.json. Execution engine reads ONLY from the snapshot, never from live workflow config.
**Detection:** If execution code imports or queries the workflow config table directly, it's likely buggy.

### Pitfall 3: Desensitization Data Leakage

**What goes wrong:** Real sensitive values (company names, amounts, personal info) accidentally sent to cloud AI models.
**Why it happens:** Desensitization mapping's `original` field leaks into prompt injection text. Or desensitization node uses a cloud model instead of local-only model.
**Consequences:** Security breach. Compliance violation. Trust destruction.
**Prevention:** (1) Prompt injection template MUST only include placeholder + type description, never `original` field. (2) Desensitization node enforces `deploy_type = 'local'` model filter at both UI and API level. (3) Unit tests that verify prompt assembly never contains original values. (4) DB-level encryption (pgcrypto) for mapping storage.
**Detection:** Audit all prompt assembly code. Search for `original` field access outside of the recovery node.

### Pitfall 4: CLI Process Management Failures

**What goes wrong:** Spawned CLI processes (e.g., `claude -p "..."`) hang indefinitely, zombie processes accumulate, orphaned processes after server restart, or stdout buffer overflow for large outputs.
**Why it happens:** CLI model calls can take minutes. Network issues, model hangs, or large outputs are common. No timeout or cleanup means resource exhaustion.
**Consequences:** Server resource exhaustion, users stuck in "generating" state forever, memory leaks from accumulated stdout buffers.
**Prevention:** (1) Always set timeout on spawn() (configurable per model, default 5-10 minutes). (2) Track all child process PIDs in DB. (3) On server startup, kill orphaned processes from previous run. (4) Stream stdout to file (not just memory buffer) for large outputs. (5) Implement cancel mechanism that kills the process group.
**Detection:** Monitor for long-running child processes. Alert on processes exceeding expected duration.

### Pitfall 5: SSE Connection Management at Scale

**What goes wrong:** SSE connections pile up, server runs out of file descriptors or memory. Disconnected clients leave zombie connections. Multi-model parallel streaming creates N connections per user.
**Why it happens:** SSE is a long-lived HTTP connection. Browsers have a limit of ~6 concurrent connections per domain. With multi-model streaming, connection exhaustion is easy.
**Consequences:** Users can't connect, server instability, browsers drop connections.
**Prevention:** (1) Use a SINGLE SSE connection per document execution, multiplexing all model streams via event types (the requirements already define this -- model_start, token, model_done events include model ID). (2) Implement heartbeat/keepalive. (3) Detect client disconnect and clean up. (4) Set reasonable connection timeout. (5) Use HTTP/2 which doesn't have the 6-connection limit.
**Detection:** Monitor active SSE connection count. Alert on connections exceeding user count.

## Moderate Pitfalls

### Pitfall 6: Markdown-to-Document Export Fidelity

**What goes wrong:** AI generates Markdown, but conversion to Word/PDF loses formatting, tables break, images are missing, Chinese characters render incorrectly.
**Prevention:** (1) Define a supported Markdown subset (headers, lists, tables, code blocks, bold/italic). (2) Build comprehensive test fixtures for each format conversion. (3) Use Puppeteer-based PDF generation (md-to-pdf) for high fidelity. (4) For Word, consider pre-built templates with content slot filling rather than pure Markdown-to-docx conversion. (5) Test with Chinese content from day one.

### Pitfall 7: Prompt Variable Injection Attacks

**What goes wrong:** User-supplied input (form fields, file content) contains variable syntax like `{{outputDir}}` or prompt injection attempts that manipulate AI behavior.
**Prevention:** (1) Sanitize user inputs before variable substitution -- escape or reject `{{...}}` patterns in user content. (2) Variable substitution happens in a defined order: system vars first, then user vars. (3) User content is injected as quoted/delimited blocks, not raw into prompt template.

### Pitfall 8: Working Directory Disk Space Exhaustion

**What goes wrong:** Working directories accumulate without cleanup. Each document generation creates multiple files across step directories. Over time, disk fills up.
**Prevention:** (1) Implement cleanup scheduler (BullMQ cron job). (2) Archive completed documents' working directories after configurable retention period. (3) Monitor disk usage with alerts. (4) The materialization/recovery pattern helps -- temp workspaces are cleaned immediately after CLI execution; only permanent storage (DB + binary file store) grows.

### Pitfall 9: BullMQ Job Failure Cascading

**What goes wrong:** A failed file parsing job or failed AI execution blocks downstream operations. Queue backs up. Users see "processing" status indefinitely.
**Prevention:** (1) Set maxRetries with exponential backoff for transient failures. (2) Implement dead letter queue for permanently failed jobs. (3) Expose job status to users via API (not just "processing" -- show retry count, error message). (4) Allow manual retry from UI. (5) Separate queues for different job types (file parsing, AI execution, export) so one failing type doesn't block others.

### Pitfall 10: Rollback Complexity Explosion

**What goes wrong:** User rolls back to an earlier node, but the desensitization mapping, file versions, and node states become inconsistent. Rolling back past a desensitization node is especially tricky.
**Prevention:** (1) On rollback, reset ALL downstream nodes to "pending" status. (2) Desensitization mapping is versioned and tied to execution ID. (3) Old files are moved to `_history/` directory, not deleted. (4) Re-execution creates new output records (append-only node_outputs table), never overwrites. (5) The workflow snapshot remains unchanged regardless of rollback.

## Minor Pitfalls

### Pitfall 11: Chinese Encoding Issues

**What goes wrong:** File names, prompt content, or AI output with Chinese characters get corrupted in CLI execution (stdout encoding), file paths, or database storage.
**Prevention:** Ensure UTF-8 everywhere: spawn() with `{ encoding: 'utf-8' }`, PostgreSQL with UTF-8 collation, filesystem with UTF-8 locale. Test with Chinese content in all pipelines.

### Pitfall 12: Race Conditions in Multi-Model Parallel Execution

**What goes wrong:** Multiple models write to the same step directory simultaneously. File name conflicts or partial writes.
**Prevention:** Each model writes to a uniquely named file (e.g., `report-{modelName}.md`). Node config already requires unique filenames per step directory. Use file locking or atomic write (write to temp, then rename).

### Pitfall 13: Prisma Migration Conflicts in Team Development

**What goes wrong:** Multiple developers create conflicting Prisma migrations. Schema drift between dev environments.
**Prevention:** (1) Use Prisma's migration workflow (`prisma migrate dev` + `prisma migrate deploy`). (2) Merge migrations sequentially in CI. (3) Never edit generated migration files. (4) Use a shared dev database or Docker Compose for consistent local setup.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| M1: Auth + Model Config | Over-engineering auth for v1 (trying to build WeCom OAuth early) | Stick to username/password. Passport.js strategy pattern allows easy swap later. |
| M1: Database Schema | Getting schema wrong requires painful migrations later | Invest in schema design upfront. Use the data models from storage-architecture.md and material-context-design.md as starting points. |
| M2: Workflow Editor | React Flow learning curve; custom node types are complex | Start with a simple linear workflow editor. Add parallel branches and conditional routing incrementally. |
| M2: Variable System | Variable resolution order, circular references, missing variables | Define clear variable resolution order. Validate at workflow save time, not execution time. |
| M3: CLI Execution | Process management, streaming, timeout, cleanup | Build a robust CliExecutor service with tests before integrating with workflow engine. |
| M3: Multi-model Streaming | SSE multiplexing, partial failure handling | Start with single-model execution. Add multi-model parallel after single-model is solid. |
| M3: Export | Format fidelity, Chinese rendering | Build format conversion as an isolated service with comprehensive test fixtures. |
| M4+: Resource Library | RAG complexity, token budget management | Already deferred by design. When building, follow material-context-design.md's Long Context + Caching approach. |

## Sources

- v4-current.md -- Business rules, security requirements, node interaction patterns
- storage-architecture.md -- Materialization/recovery pattern, data integrity approach
- material-context-design.md -- Risk identification (Section 8)
- [Node.js child_process documentation](https://nodejs.org/api/child_process.html) -- spawn() behavior and limitations
- [BullMQ best practices](https://docs.bullmq.io/) -- Queue management patterns
- [pgcrypto documentation](https://www.postgresql.org/docs/current/pgcrypto.html) -- Encryption limitations
