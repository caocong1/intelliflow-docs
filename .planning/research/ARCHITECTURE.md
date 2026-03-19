# Architecture Research

**Domain:** Enterprise AI document generation platform with workflow orchestration
**Researched:** 2026-03-19
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Admin    │  │ Document │  │ Workflow  │  │ Project &       │  │
│  │ Console  │  │ Workbench│  │ Designer  │  │ Doc Management  │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └───────┬──────────┘  │
├───────┴──────────────┴──────────────┴────────────────┴──────────────┤
│                        API Layer (NestJS + Fastify)                  │
│  Authentication / Authorization / Rate Limiting / SSE Streaming     │
├─────────────────────────────────────────────────────────────────────┤
│                        Application Services                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Auth &   │  │ Workflow │  │ Model     │  │ Document &      │  │
│  │ User Svc │  │ Engine   │  │ Invocation│  │ Project Svc     │  │
│  └──────────┘  └──────────┘  │ Layer     │  └──────────────────┘  │
│  ┌──────────┐  ┌──────────┐  └───────────┘  ┌──────────────────┐  │
│  │ Desensi- │  │ Export   │  ┌───────────┐  │ Material &      │  │
│  │ tization │  │ Service  │  │ Workspace │  │ Context Svc     │  │
│  │ Service  │  └──────────┘  │ Manager   │  │ (M4+ scope)     │  │
│  └──────────┘                └───────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Infrastructure Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │PostgreSQL│  │ File     │  │ BullMQ    │  │ Redis            │  │
│  │ (Prisma) │  │ System   │  │ Task Queue│  │ (Cache/Pub-Sub)  │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Approach: Modular Monolith

For a 50-user internal enterprise tool, a **modular monolith** (NestJS) is the correct starting architecture. Microservices would add deployment and operational complexity with zero benefit at this scale.

**Why modular monolith:**
- 50 concurrent users does not justify distributed system overhead
- Single team developing the product -- no organizational need for service boundaries
- Shared PostgreSQL transactions simplify consistency (workflow state + file index + execution log in one transaction)
- NestJS module system enforces boundaries at the code level without network overhead
- Can extract modules into services later if needed (module boundaries are the extraction seam)

**Why not a tangled monolith:**
- The workflow engine, model invocation layer, and desensitization service have fundamentally different concerns and security boundaries
- Clean internal boundaries prevent a costly rewrite when extracting the model invocation layer for v2 API mode

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Admin Console** | Model provider/model config, doc type management, workflow design, usage stats, user management | API Layer |
| **Document Workbench** | Step-by-step node execution UI, streaming output display, multi-model comparison, inline editing | API Layer (HTTP + SSE) |
| **Workflow Designer** | Visual drag-and-drop node arrangement (React Flow), node config editing, variable system, flow validation preview | API Layer |
| **Project & Doc Management** | Project CRUD, member management, document listing/filtering/versioning, visibility controls | API Layer |
| **Auth & User Module** | User authentication (v1 password, v2 WeChat OAuth), JWT, RBAC via NestJS guards | PostgreSQL, all modules via guards |
| **Workflow Engine** | Flow definition storage, node state machine, step sequencing, parallel branch orchestration, rollback/skip logic, flow snapshot on document creation | PostgreSQL, BullMQ, Model Invocation Layer, Workspace Manager |
| **Model Invocation Layer** | Unified abstraction over CLI/API model calls, prompt assembly with variable substitution, streaming output relay, call result normalization | Workspace Manager, PostgreSQL, BullMQ |
| **Desensitization Service** | Sensitive info detection (local model only), mapping table management (pgcrypto encrypted), prompt rule injection for downstream nodes, restoration (local text replacement) | PostgreSQL, Workspace Manager, local private models only |
| **Export Service** | Markdown-to-DOCX/PDF/XLSX conversion, template-based formatting, batch export | Workspace Manager, PostgreSQL, BullMQ |
| **Workspace Manager** | Temporary directory lifecycle (create/materialize/collect/cleanup), file indexing in DB, binary file storage path management | PostgreSQL, File System |
| **Document & Project Service** | Project CRUD, membership, document metadata, version snapshots, visibility/permission enforcement | PostgreSQL, Workspace Manager |
| **Material & Context Service** | File upload and async parsing (BullMQ), text extraction and storage, token budget calculation, prompt context assembly, prompt cache adapter (M4+ scope) | PostgreSQL, File System, BullMQ, Redis |
| **SSE Gateway** | Server-Sent Events for streaming AI output, multiplexes multi-model streams per task | Frontend, CLI/API Executors, Redis (for multi-instance) |
| **Stats Module** | Usage statistics, audit logs, multi-dimension reporting | PostgreSQL (read-only aggregations) |

## Recommended Project Structure

```
server/
├── src/
│   ├── modules/
│   │   ├── auth/                  # Authentication & user management
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   └── entities/
│   │   ├── admin/                 # Doc types, provider/model config
│   │   │   ├── doc-type/
│   │   │   │   ├── doc-type.controller.ts
│   │   │   │   ├── doc-type.service.ts
│   │   │   │   └── entities/
│   │   │   ├── provider/
│   │   │   └── model/
│   │   ├── project/               # Project CRUD, membership, roles
│   │   │   ├── project.controller.ts
│   │   │   ├── project.service.ts
│   │   │   ├── member.service.ts
│   │   │   └── entities/
│   │   ├── document/              # Document CRUD, versioning, visibility
│   │   │   ├── document.controller.ts
│   │   │   ├── document.service.ts
│   │   │   ├── version.service.ts
│   │   │   └── entities/
│   │   ├── workflow/              # Flow definition + runtime execution
│   │   │   ├── definition/        # Flow & node config CRUD
│   │   │   │   ├── workflow.controller.ts
│   │   │   │   ├── workflow.service.ts
│   │   │   │   └── validation.service.ts
│   │   │   ├── engine/            # Runtime execution state machine
│   │   │   │   ├── engine.service.ts
│   │   │   │   ├── state-machine.ts
│   │   │   │   └── node-executors/  # Strategy pattern: one per node type
│   │   │   │       ├── executor.interface.ts
│   │   │   │       ├── input-transform.executor.ts
│   │   │   │       ├── desensitize.executor.ts
│   │   │   │       ├── model-call.executor.ts
│   │   │   │       ├── restore.executor.ts
│   │   │   │       └── export.executor.ts
│   │   │   └── entities/
│   │   ├── model-invocation/      # Unified model call abstraction
│   │   │   ├── invocation.service.ts
│   │   │   ├── prompt-assembler.ts      # Variable substitution, rule injection
│   │   │   ├── adapters/
│   │   │   │   ├── adapter.interface.ts
│   │   │   │   ├── cli.adapter.ts       # v1: CLI subprocess execution
│   │   │   │   └── api.adapter.ts       # v2: HTTP API calls
│   │   │   └── streaming/               # SSE relay
│   │   │       └── sse.gateway.ts
│   │   ├── desensitization/       # Mapping management, rule injection, recovery
│   │   │   ├── desensitize.service.ts
│   │   │   ├── restore.service.ts
│   │   │   └── entities/
│   │   ├── workspace/             # File system workspace lifecycle
│   │   │   ├── workspace.service.ts
│   │   │   ├── file-index.service.ts
│   │   │   └── entities/
│   │   ├── export/                # Format conversion, template rendering
│   │   │   ├── export.service.ts
│   │   │   └── renderers/
│   │   │       ├── docx.renderer.ts
│   │   │       ├── pdf.renderer.ts
│   │   │       └── xlsx.renderer.ts
│   │   ├── material/              # Project material library (M4+ scope)
│   │   │   ├── upload/
│   │   │   ├── parsing/
│   │   │   ├── context-assembly/
│   │   │   └── entities/
│   │   └── stats/                 # Usage statistics, audit
│   │       ├── stats.controller.ts
│   │       └── stats.service.ts
│   ├── common/                    # Shared utilities
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   └── utils/
│   ├── config/                    # Environment & app configuration
│   ├── database/                  # Prisma schema, migrations, seeds
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seeds/
│   └── main.ts
client/
├── src/
│   ├── pages/
│   │   ├── admin/                 # Admin console pages
│   │   ├── project/               # Project management pages
│   │   ├── document/              # Document list, detail pages
│   │   ├── workbench/             # Document generation workbench
│   │   └── workflow-designer/     # Visual flow editor
│   ├── components/
│   │   ├── workflow/              # Flow editor components (React Flow)
│   │   ├── workbench/             # Node execution UI components
│   │   │   ├── InputTransformStep.tsx
│   │   │   ├── DesensitizeStep.tsx
│   │   │   ├── ModelCallStep.tsx
│   │   │   ├── RestoreStep.tsx
│   │   │   └── ExportStep.tsx
│   │   └── common/
│   ├── hooks/
│   │   ├── useSSE.ts              # SSE streaming hook
│   │   └── useWorkbench.ts        # Workbench state management
│   ├── services/                  # API client functions
│   └── store/                     # Zustand state management
```

### Structure Rationale

- **modules/workflow/engine/node-executors/:** Each of the 5 node types has distinct execution logic. The Strategy pattern (one executor per node type) keeps the engine generic while each executor handles its specific behavior. New node types (outline confirmation, human review, material selection) plug in by adding new executor files with zero changes to the engine.
- **modules/model-invocation/adapters/:** The CLI vs API distinction is an implementation detail hidden behind a unified interface. v1 ships with CLI only; API adapter plugs in for v2 without changing any upstream code.
- **modules/desensitization/:** Isolated because it has unique security constraints (local models only, pgcrypto encrypted storage, no data leaves server). Coupling this with general model invocation would create security boundary violations.
- **modules/workspace/:** Separated from document module because workspace lifecycle (materialize/collect/cleanup) is infrastructure-level logic, not business logic. Multiple modules (executors, export, material parsing) all depend on workspace services.
- **modules/material/:** Entirely separate for M4+ scope. Can be developed independently without touching workflow or document modules.

## Architectural Patterns

### Pattern 1: Node Execution State Machine

**What:** Each document generation session is a finite state machine. The workflow engine tracks which node is current, manages transitions (next/skip/rollback), and enforces flow rules.

**When to use:** All workflow execution -- this is the core runtime model.

**Trade-offs:** State machines are explicit and debuggable, but can become complex with many transition rules. For this project, the linear-with-parallel-branches nature of flows (not arbitrary DAGs) keeps complexity manageable.

```
Node States:
  PENDING -> ACTIVE -> COMPLETED -> (rollback) -> ACTIVE
                    -> SKIPPED   -> (rollback) -> ACTIVE
                    -> FAILED    -> (retry)    -> ACTIVE

Document States:
  DRAFT -> EXECUTING -> COMPLETED
```

**Implementation:**

```typescript
enum NodeStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

// State transitions are atomic DB operations
class WorkflowStateMachine {
  async advance(taskId: string, action: 'next' | 'skip' | 'rollback', targetStep?: number) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUniqueOrThrow({ where: { id: taskId } });
      const nextState = this.computeTransition(task, action, targetStep);
      // On rollback: archive outputs of steps N+1..current, reset to PENDING
      // On skip: mark optional nodes as SKIPPED, advance to next required
      await tx.task.update({ where: { id: taskId }, data: nextState });
      await this.createVersionSnapshot(tx, taskId, task.currentStep);
      return nextState;
    });
  }
}
```

### Pattern 2: Workspace Materialization / Collection Cycle

**What:** For CLI model calls, the system materializes data from PostgreSQL into temporary filesystem directories before execution, then collects results back afterward. DB is the single source of truth; filesystem is transient.

**When to use:** Every CLI model invocation.

**Trade-offs:** Adds I/O overhead (DB -> file -> DB round-trip), but this is negligible compared to AI generation time (seconds to minutes). API mode (v2) bypasses this entirely -- reads from DB, writes to DB.

```
Materialize:  DB text content ──write──> /tmp/workspace/{taskId}/s1/input.md
              DB binary files ──copy───> /tmp/workspace/{taskId}/s1/_raw/
Execute:      CLI agent reads input files, writes output files
Collect:      /tmp/workspace/{taskId}/s2/output.md ──read──> DB node_outputs.text_content
              Output metadata ──record──> DB file indexes
Cleanup:      rm -rf /tmp/workspace/{taskId}/  (or archive for debugging)
```

**Implementation:**

```typescript
@Injectable()
class WorkspaceManager {
  async materialize(taskId: string, stepNumber: number): Promise<string> {
    // 1. Create temp directory: /tmp/workspace/{taskId}/
    // 2. Query node_outputs from DB for upstream steps
    // 3. Write text content to files in step subdirectories
    // 4. Copy binary files from permanent storage
    // 5. If desensitization active, write mapping.json (encrypted read from DB)
    // 6. Return workspace root path
  }

  async collect(taskId: string, stepNumber: number, workspacePath: string): Promise<void> {
    // 1. Scan output directory for new/changed files
    // 2. Read text files -> store in node_outputs table
    // 3. Move binary files to permanent storage
    // 4. Update file_index records in DB
    // 5. Clean up temp workspace
  }
}
```

### Pattern 3: Unified Model Executor (Adapter Pattern)

**What:** Abstract CLI and API model invocation behind a common interface. The workflow engine does not know or care which invocation method is used. Selection is driven by the model's `invoke_type` config field.

**When to use:** Every model call node execution.

**Trade-offs:** Adds an abstraction layer, but the abstraction is strongly justified -- the two methods have fundamentally different I/O patterns (file-based vs. in-memory) and both must produce identical event streams.

```typescript
interface ModelInvocationAdapter {
  invoke(params: InvocationParams): Observable<ExecutionEvent>;
  cancel(invocationId: string): Promise<void>;
}

// CLI Adapter (v1): materializes files, spawns subprocess, reads stdout
@Injectable()
class CliAdapter implements ModelInvocationAdapter {
  invoke(params: InvocationParams): Observable<ExecutionEvent> {
    return new Observable(subscriber => {
      // 1. Materialize workspace
      // 2. Assemble CLI command from model's command template
      // 3. spawn() child process
      // 4. Stream stdout as token events
      // 5. On exit: collect results from workspace back to DB
      // 6. Emit model_start, token, model_done/model_error
    });
  }
}

// API Adapter (v2): reads from DB, calls HTTP API, writes to DB
@Injectable()
class ApiAdapter implements ModelInvocationAdapter {
  invoke(params: InvocationParams): Observable<ExecutionEvent> {
    return new Observable(subscriber => {
      // 1. Read input content from DB (no filesystem needed)
      // 2. HTTP streaming request to model API
      // 3. Parse SSE/streaming response
      // 4. Write result to DB
      // 5. Emit same event types as CLI adapter
    });
  }
}
```

### Pattern 4: Prompt Assembly Pipeline

**What:** Centralized prompt construction that resolves variables, injects desensitization rules, and substitutes file paths. All model invocations go through this single assembly point.

**When to use:** Every model call node, before execution.

**Trade-offs:** Centralization adds a single point of complexity, but prevents the far worse problem of scattered string concatenation across multiple services. Makes prompt debugging and auditing possible.

```typescript
@Injectable()
class PromptAssembler {
  assemble(nodeConfig: NodeConfig, context: ExecutionContext): AssembledPrompt {
    let prompt = nodeConfig.promptTemplate;

    // 1. Replace system variables
    prompt = this.replaceSystemVars(prompt, context);
    // {{workDir}}, {{inputDir}}, {{outputDir}}, {{outputFileName}}

    // 2. Inject desensitization rules (if in desensitized segment)
    if (context.hasDesensitization) {
      // CRITICAL: getRulesForPrompt() returns ONLY type descriptions
      // e.g., "<!-- 000001 --> represents a company name"
      // NEVER real values -- those are only in getMappingForRestore()
      const rules = this.desensitizationService.getRulesForPrompt(context.taskId);
      prompt = prompt.replace('{{desensitizationRules}}', rules);
    }

    // 3. Replace user-defined variables
    prompt = this.replaceUserVars(prompt, context.userInputs);

    // 4. Log assembled prompt (with sensitive values redacted) for debugging
    this.auditLog.recordPrompt(context.taskId, context.stepNumber, prompt);

    return { systemPrompt: nodeConfig.systemPrompt, userPrompt: prompt };
  }
}
```

### Pattern 5: SSE Event Multiplexing for Streaming

**What:** Multi-model parallel generation streams results to the frontend via Server-Sent Events. Each model invocation emits events (`model_start`, `token`, `model_done`, `model_error`) multiplexed onto a single SSE connection per document task.

**When to use:** Document workbench during model call node execution.

**Trade-offs:** SSE is simpler than WebSocket for this use case (server-to-client unidirectional). Client sends cancel/select requests via regular HTTP POST. For multi-instance deployment, Redis pub/sub relays events across instances.

```
Browser (SSE client)
    |
    |  GET /api/tasks/{id}/stream  (SSE connection)
    |
    v
SSE Gateway ──> Workflow Engine ──> Model Invocation Layer
                                        |
                        ┌───────────────┼───────────────┐
                        v               v               v
                   CLI Process 1   CLI Process 2   CLI Process 3
                   (glm-5)         (kimi-k2.5)     (deepseek-v3.2)
                        |               |               |
                        └───────┬───────┘───────────────┘
                                v
                        SSE Multiplexer (tags each chunk with model ID)
                                |
                                v
                        Browser renders in parallel output cards
```

```typescript
@Controller('tasks')
class TaskController {
  @Sse(':id/stream')
  streamExecution(@Param('id') taskId: string): Observable<MessageEvent> {
    return this.executionService.getEventStream(taskId).pipe(
      map(event => ({
        type: event.type,  // model_start | token | model_done | model_error | all_done
        data: JSON.stringify(event.payload),
      })),
    );
  }
}
```

### Pattern 6: Flow Snapshot on Document Creation

**What:** When a user creates a document and selects a flow, the system deep-copies the entire flow definition (node sequence, configs, prompt templates, model selections) into the document record. Subsequent admin edits to the flow do not affect in-progress documents.

**When to use:** Every document creation. This directly enforces business rule #7.

**Trade-offs:** Duplicates flow definition data, but storage cost is trivial (JSON blob per document). The alternative -- runtime referencing of live flow config -- is a serious correctness bug waiting to happen.

## Data Flow

### Core Document Generation Flow (Happy Path)

```
1. User creates document
   -> API creates DB record + working directory path
   -> Snapshot flow definition into document record
   -> Initialize state machine at step 1

2. Input Transform node (step 1)
   -> User fills form, uploads files
   -> Parse uploads (sync for small files, async BullMQ for large/media)
   -> Write structured content to DB node_outputs
   -> Update node state: COMPLETED

3. Desensitization node (step 2, optional)
   -> Local private model identifies sensitive info
   -> User confirms/edits mapping table
   -> pgcrypto encrypt mapping -> store in DB
   -> Register rules for downstream prompt injection
   -> Update node state: COMPLETED

4. Model Call node(s) (step 3+, possibly parallel)
   -> Prompt Assembler resolves template:
      a. System variables (paths)
      b. Desensitization rules (type descriptions only, never real values)
      c. User-defined variables
   -> For each selected model (parallel via BullMQ jobs):
      CLI: materialize workspace -> spawn process -> stream stdout via SSE -> collect results
      API: read DB content -> HTTP call -> stream response via SSE -> write to DB
   -> User selects best output (multi-model mode)
   -> Update node state: COMPLETED

5. Information Recovery node (optional, paired with step 2)
   -> Read encrypted mapping from DB
   -> Replace <!-- 000001 --> placeholders with real values
   -> Pure local operation, zero AI involvement
   -> Show before/after comparison to user
   -> Update node state: COMPLETED

6. Export node (final step)
   -> User selects format (DOCX/PDF/XLSX/MD) + template
   -> Render via format-specific renderer
   -> Store export file in filesystem + index in DB
   -> Update document status: COMPLETED
```

### Rollback Flow

```
User clicks "Rollback to Step N"
    |
    v
Workflow Engine (within DB transaction):
  1. Verify rollback allowed (step N < current step)
  2. Archive current outputs of steps N+1..current to version history
  3. Reset states of steps N+1..current to PENDING
  4. Set current step to N, state to ACTIVE
  5. Create version snapshot for audit trail
  6. Frontend navigates to step N executor UI
```

### File Parsing Flow (Async via BullMQ)

```
1. User uploads file -> API stores in filesystem, creates DB record (status: uploading)
2. API enqueues BullMQ job (status: parsing)
3. Worker picks up job:
   a. Word -> mammoth -> text + structure
   b. PDF  -> pdf-parse -> text + page mapping
   c. Excel -> exceljs -> text (markdown table format)
   d. Image -> OCR API call -> text
   e. Audio/Video -> speech-to-text API -> text
4. Worker stores parsed text in DB (status: ready)
5. On failure: status -> parse_failed, user can retry
```

### Multi-Model Parallel Execution Flow

```
Workflow Engine reaches model call node configured for multi-model
    |
    v
Model Invocation Layer:
  - Read node config: models = [glm-5, kimi-k2.5, deepseek-v3.2]
  - For each model, create BullMQ job with shared taskId
    |
    ├──> Job: glm-5      ──> CLI/API adapter ──> stream events
    ├──> Job: kimi-k2.5  ──> CLI/API adapter ──> stream events
    └──> Job: deepseek   ──> CLI/API adapter ──> stream events
              |            |            |
              v            v            v
         SSE Multiplexer (tags chunks with model ID)
              |
              v
         Single SSE connection to browser
              |
         All models done? -> node state: AWAITING_SELECTION
         User picks best  -> node state: COMPLETED
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 users (v1 target) | Single server monolith. PostgreSQL on same or adjacent server. Local filesystem. BullMQ with 2-4 workers for CLI processes. Redis for SSE + caching. This is sufficient and correct for v1. |
| 50-200 users | Dedicated PostgreSQL server. More BullMQ workers (CLI processes are memory-heavy, 500MB+ each). PgBouncer for connection pooling. Monitor workspace disk I/O. |
| 200+ users | File system upgrades to MinIO/S3 (already planned in storage design doc). Task queue workers on separate machines. PostgreSQL read replicas for stats queries. Redis pub/sub for multi-instance SSE relay. |

### Scaling Priorities

1. **First bottleneck: CLI process concurrency.** Each CLI model call spawns a subprocess consuming significant memory. With 50 users and multi-model mode, peak concurrent CLI processes could reach 50-200. Solution: BullMQ with configurable concurrency limits per worker, priority queues, and backpressure to the frontend ("queued, position N").

2. **Second bottleneck: Workspace disk I/O.** Materializing and collecting files for CLI calls creates disk churn. Solution: Use tmpfs (RAM disk) for workspace directories if memory allows; otherwise SSD with adequate IOPS. Implement aggressive workspace cleanup after collection.

3. **Third bottleneck: SSE connection count.** Each active document generation holds an SSE connection. At 200+ concurrent users, this strains a single Node.js instance. Solution: Redis pub/sub to relay SSE events, allowing any backend instance to serve any client.

## Anti-Patterns

### Anti-Pattern 1: Treating File System as Source of Truth

**What people do:** Use file existence or directory contents to determine workflow state (e.g., "if s3/ exists, step 3 is done").
**Why it's wrong:** No ACID transactions, race conditions on concurrent access, partial writes from failed CLI processes, filesystem state diverges from DB state after any failure.
**Do this instead:** PostgreSQL is the single source of truth for all execution state. File system is a transient workspace for CLI execution only (materialization/collection pattern).

### Anti-Pattern 2: Synchronous CLI Execution in Request Handlers

**What people do:** The API endpoint that triggers model generation spawns the CLI process synchronously and waits for completion before responding.
**Why it's wrong:** CLI calls take 30 seconds to 10+ minutes. HTTP connections time out. Server threads are blocked. No graceful cancellation. No progress feedback.
**Do this instead:** Enqueue CLI execution as a BullMQ job. Return immediately with a task ID. Stream progress via SSE on a separate connection. The task queue handles retries, timeouts, and concurrency.

### Anti-Pattern 3: Live Flow Config During Execution

**What people do:** Workflow execution directly reads the flow definition from the admin config table at each step.
**Why it's wrong:** If admin edits a flow mid-execution, the document's remaining steps change unexpectedly. Directly violates business rule #7.
**Do this instead:** Snapshot the complete flow definition into the document record at creation time. The engine reads only from the snapshot.

### Anti-Pattern 4: Leaking Real Values in Desensitization

**What people do:** Pass the full desensitization mapping (including `original` real values) through the model invocation layer or include it in prompts.
**Why it's wrong:** Defeats the entire purpose of desensitization. Real values must never reach any online AI model.
**Do this instead:** The `DesensitizationService` exposes two strictly separate methods: `getRulesForPrompt()` (returns only type descriptions, safe for any model) and `getMappingForRestore()` (returns real values, restricted to local-only restore executor). Enforce this separation at the architecture level.

### Anti-Pattern 5: Monolithic Prompt String Building

**What people do:** Build prompts by concatenating strings with inline variable replacement scattered across multiple services.
**Why it's wrong:** Hard to test, debug, or audit. Injection vulnerabilities. Desensitization rule injection gets missed. No way to review what was actually sent to the model.
**Do this instead:** Centralize all prompt assembly in the `PromptAssembler` service with discrete stages, each independently testable. Log assembled prompts (redacted) for debugging.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| AI Models (CLI, v1) | Subprocess spawn via `child_process` | Handle stdout/stderr streaming, process signals (SIGTERM for cancel), exit codes, timeout enforcement. Each model has its own command template. |
| AI Models (API, v2) | HTTP client with SSE streaming | Provider-specific adapters (OpenAI-compatible, DashScope, custom HTTP). Handle rate limits, retries, partial failures. |
| WeChat Work OAuth (future) | OAuth 2.0 redirect flow | v1 skips this. Auth module uses strategy pattern so WeChat adapter plugs in later without refactoring. |
| File parsing libraries | In-process or BullMQ worker | mammoth (DOCX), pdf-parse (PDF), exceljs (XLSX). Run in task queue workers to avoid blocking main event loop for large files. |

### Internal Module Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Workflow Engine <-> Node Executors | Strategy pattern (direct call) | Engine is generic, executors are specific. Register executors by node type enum. Adding new node types = adding new executor class. |
| Workflow Engine <-> Model Invocation | Service interface (direct call) | Engine calls `invocationService.invoke()`, receives `Observable<ExecutionEvent>` |
| Model Invocation <-> Workspace Manager | Service interface (direct call) | CLI adapter calls `workspaceManager.materialize()` and `.collect()`. API adapter skips workspace entirely. |
| Prompt Assembler <-> Desensitization | Service interface | Assembler calls `desensitizeService.getRulesForPrompt(taskId)` -- returns safe text only, never real values |
| Any Module <-> PostgreSQL | Repository layer (Prisma) | Each module owns its Prisma models. Cross-module data access goes through service interfaces, not direct table queries. |
| Backend <-> Frontend (streaming) | SSE over HTTP | Single SSE endpoint per task. Events multiplexed with model ID. Client reconnects on drop with `Last-Event-ID`. |

## Build Order (Dependencies for Roadmap)

The following build order reflects hard technical dependencies and maps directly to the milestone plan in PROJECT.md.

### M1: Foundation -- build order within milestone

| Order | Component | Depends On | Rationale |
|-------|-----------|------------|-----------|
| 1 | Database schema + Prisma setup + migrations | Nothing | Everything depends on this |
| 2 | Auth & User Module (JWT, guards, RBAC) | Database | Gates all API endpoints |
| 3 | Workspace Manager (directory lifecycle, file indexing) | Database | Infrastructure for later modules |
| 4 | Admin: Provider & Model config CRUD | Auth, Database | Required before any model can be referenced |
| 5 | Admin: Document Type management CRUD | Auth, Database | Required before flows can be created |

### M2: Workflow Orchestration -- build order within milestone

| Order | Component | Depends On | Rationale |
|-------|-----------|------------|-----------|
| 1 | Flow definition CRUD (store/retrieve configs) | M1 complete, DocType | Foundation for flow editing |
| 2 | Node type registry + validation rules | Flow definition | Enforce flow correctness at save time |
| 3 | Variable system (template engine) | Node type registry | {{variable}} substitution used by all nodes |
| 4 | Flow validation engine | Node types, variable system | Start/end rules, desensitize pairing, etc. |
| 5 | Visual flow editor (React Flow frontend) | All backend flow APIs | Admin UX for designing flows |

### M3: Document Generation Runtime -- build order within milestone (most complex)

| Order | Component | Depends On | Rationale |
|-------|-----------|------------|-----------|
| 1 | Workflow state machine | M2 complete | Core execution loop (next/skip/rollback) |
| 2 | Node executor: Input Transform | State machine, Workspace | Simplest executor, validates the pattern |
| 3 | CLI Adapter (v1 model invocation) | Workspace Manager | The v1 execution engine |
| 4 | Prompt Assembler | Variable system | Template rendering, path substitution |
| 5 | Node executor: Model Call | CLI Adapter, Prompt Assembler | Most complex executor |
| 6 | SSE streaming infrastructure | Model Call executor | Required for model call UI |
| 7 | Node executor: Desensitize | Local model invocation | Depends on local model being callable |
| 8 | Desensitization rule injection | Prompt Assembler, Desensitize | Extend assembler for rule injection |
| 9 | Node executor: Restore | Desensitization Service | Local text replacement, relatively simple |
| 10 | Node executor: Export | Workspace Manager | Format conversion, template rendering |
| 11 | Document workbench UI | All executors, SSE | Step-by-step user interface |
| 12 | Project management (CRUD, members) | Auth | Can be built in parallel with items 1-10 |

### M4+: Enhancement -- minimal interdependencies, flexible order

- Material & Context Service (file parsing, token budget, context assembly)
- Statistics & Audit dashboards
- Usage limits & quotas
- WeChat OAuth integration
- Workspace archival & cleanup automation

## Sources

- [Windmill: Fastest self-hostable workflow engine](https://www.windmill.dev/blog/launch-week-1/fastest-workflow-engine) -- PostgreSQL-based state transitions as single transacted statements
- [PGFlow: Postgres-centric workflow engine](https://github.com/pgflow-dev/pgflow) -- All workflow state in Postgres, queryable with SQL
- [Absurd Workflows: Durable Execution With Just Postgres](https://lucumr.pocoo.org/2025/11/3/absurd-workflows/) -- Durable execution patterns using PostgreSQL
- [State of Workflow Orchestration Ecosystem 2025](https://www.pracdata.io/p/state-of-workflow-orchestration-ecosystem-2025) -- Landscape overview
- [Design Patterns for Gen AI Applications](https://code-b.dev/blog/gen-ai-architecture) -- AI application architecture patterns
- [Azure: Generate Documents from Your Data](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/idea/generate-documents-from-your-data) -- Document generation reference architecture
- [Smarter PII Handling in LLMs](https://www.firstsource.com/insights/blogs/when-privacy-meets-performance-smarter-way-handle-pii-llms) -- Data masking patterns for AI pipelines
- [AWS: What is Data Masking](https://aws.amazon.com/what-is/data-masking/) -- Tokenization and substitution masking approaches
- Project requirements: `docs/requirements/v4-current.md`
- Project storage architecture: `docs/design/storage-architecture.md`
- Project material context design: `docs/design/material-context-design.md`

---
*Architecture research for: IntelliFlow Docs -- Enterprise AI Document Generation Platform*
*Researched: 2026-03-19*
