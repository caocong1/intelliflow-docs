# Feature Landscape

**Domain:** AI-powered document generation platform (enterprise internal)
**Researched:** 2026-03-19

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User auth (username/password) | Can't use system without login | Low | v1 simplified; WeCom OAuth deferred |
| Role-based access (admin/user) | Enterprise tools need access control | Low | Two roles: system admin, regular user |
| AI model provider management | Core infrastructure -- must configure before anything works | Med | Provider CRUD + connectivity test |
| AI model configuration | Need models to call before workflows work | Med | Model CRUD, deploy type, invoke_type (CLI/API), parameter config |
| Document type management | Organizational structure for documents | Low | CRUD + enable/disable + ordering |
| Workflow orchestration (5 node types) | THE core feature -- the entire product premise | High | Visual editor with drag-drop, validation rules, variable system |
| Document creation + workspace | Users need a place to execute workflows | High | Step-by-step node execution UI, progress navigation |
| Multi-model parallel AI calling | Key value prop -- compare outputs across models | High | spawn() parallel CLI processes, SSE streaming, per-model status |
| File-system-driven data flow | Architectural requirement for CLI model compatibility | Med | Working directory creation, step subdirectories, file indexing in DB |
| Streaming AI output (SSE) | Users expect to see AI "typing" in real-time | Med | SSE protocol per requirements Appendix A |
| Information desensitization | Enterprise security requirement | High | Local-only AI for identification, mapping storage, prompt injection |
| Information recovery | Paired with desensitization | Med | Local string replacement, before/after diff display |
| File export (Word/PDF/Excel/MD) | Document generation is useless without export | Med | Markdown to multi-format conversion pipeline |
| Node common operations | UX essentials for workflow execution | Med | Confirm/next, edit current, skip ahead, rollback |
| Project management | Organization unit for documents | Med | CRUD, member management, project roles |
| Document list + management | Need to find and manage generated documents | Low | List, search, filter, soft delete |
| Version snapshots | Users need to track iteration history | Med | Auto-snapshot per node completion, diff view |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual workflow editor (React Flow) | Admin configures new doc types without dev involvement | High | Drag-drop node arrangement, live validation, preview |
| Cross-model comparison view | Side-by-side comparison of AI outputs is unique | Med | Split-pane UI, model quality labels |
| Desensitization prompt injection | Novel approach -- rules embedded in prompts, not content pre-processing | Low | System handles automatically once mapping defined |
| Workflow-as-config (no code) | Admins create any document generation flow via config alone | High | Variable system, prompt templates, input/output file mapping |
| Background generation + notification | Start generation, leave, get notified when done | Med | BullMQ background jobs + notification system |
| Inline AI-assisted editing | Edit node output with AI help at any step | Med | TipTap editor + model invocation within editor context |
| Working directory browsable | Full transparency into what the system produced | Low | File tree view of working directory |
| Conditional routing | Auto-branch workflows based on content properties | Med | Backend flow engine capability (e.g., word count thresholds) |
| Audit trail with CLI logs | Full reproducibility -- see exact commands and outputs | Low | Store stdout/stderr in _logs/ directories |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time collaborative editing | Massive complexity (CRDT/OT), one user per doc is a business rule (#1) | Single-user editing with version history |
| Custom node type creation by users | Unbounded complexity, security risk | Admin configures 5 fixed node types with flexible parameters |
| Built-in AI model hosting | Out of scope, operational burden | Integrate with external providers (CLI/API) |
| Full RAG pipeline in v1 | Over-engineering for initial launch (material-context-design.md already decided Long Context + Caching) | Defer to M4+, use direct context injection |
| Mobile app | Web-first internal tool, no mobile use case identified | Responsive web design only if needed later |
| Multi-tenant SaaS architecture | This is an internal company tool | Single-tenant deployment |
| Document approval workflow (v1) | Depends on human review node (deferred) | Simple status tracking; approval in future version |
| Enterprise WeChat OAuth (v1) | External dependency, not needed for core flow validation | Username/password for v1, WeCom OAuth in later milestone |

## Feature Dependencies

```
User Auth --> Role/Permission System --> All Admin Features
AI Provider Management --> AI Model Management --> Model Call Node
Document Type Management --> Workflow Management --> Document Creation
Workflow Editor (5 nodes) --> Workflow Validation --> Workflow Activation
Document Creation --> Working Directory Setup --> Node Execution
Information Desensitization --> Prompt Injection --> Model Call Nodes (in desensitized segment)
Information Desensitization --> Information Recovery (must be paired)
All Node Execution --> Version Snapshots
Model Call Node (streaming) --> SSE Infrastructure
Export Node --> Document Format Conversion Libraries
```

## MVP Recommendation

**Prioritize (M1-M3 per PROJECT.md):**

1. **Auth + User Management** -- gate for everything
2. **AI Provider/Model Configuration** -- prerequisite for any AI usage
3. **Document Type + Workflow Orchestration** -- the core differentiator
4. **Document Creation + Workspace + 5 Node Types** -- the core user experience
5. **Multi-model parallel calling + SSE streaming** -- the core value proposition
6. **Export (Word + Markdown minimum)** -- users need tangible output

**Defer to M4+:**

- Project resource library (RAG/context injection) -- complex, independent subsystem
- Statistics & audit dashboards -- nice-to-have, not blocking core flow
- Usage limits & quota management -- can be added after core flow works
- WeCom OAuth -- external dependency
- Background generation + notifications -- enhancement to existing flow
- PDF/Excel export polish -- Word + Markdown sufficient for MVP

## Sources

- Requirements v4-current.md -- direct feature extraction
- PROJECT.md -- milestone plan alignment
- storage-architecture.md -- storage decisions informing feature complexity
- material-context-design.md -- RAG deferral rationale
