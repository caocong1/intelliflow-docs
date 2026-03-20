# Roadmap: IntelliFlow（智文平台）

## Overview

IntelliFlow delivers an AI document generation platform through five phases: foundation infrastructure and admin basics (auth, users, document types), AI model configuration, workflow orchestration with visual editor, project and document management infrastructure, and finally the complete document creation runtime with all five node types executing end-to-end. Each phase delivers a coherent, verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Auth + Document Types** - Backend/frontend scaffolding, user authentication, role-based access, and document type CRUD (completed 2026-03-19)
- [x] **Phase 2: AI Provider and Model Configuration** - Provider management, model configuration with CLI templates, connectivity testing (completed 2026-03-19)
- [x] **Phase 3: Workflow Orchestration** - Visual flow editor, 5 node types, variable system, flow validation, flow management (completed 2026-03-19)
- [x] **Phase 4: Project + Document + Version + File System Infrastructure** - Project CRUD with members, document management, version snapshots, working directory lifecycle (completed 2026-03-20)
- [ ] **Phase 5: Document Creation Runtime** - Workspace UI, all 5 node executors, multi-model streaming, common operations, failure recovery
- [ ] **Phase 6: Phase 1 Formal Verification & Housekeeping** - Verify Phase 1 implementation, update stale checkboxes and ROADMAP status
- [ ] **Phase 7: Model Parameter Configuration** - Complete AIMC-05 parameter config, implement AIMC-09
- [ ] **Phase 8: Integration Bug Fixes** - Fix validation overlay shape, provider name in model list, shared type sync

## Phase Details

### Phase 1: Foundation + Auth + Document Types
**Goal**: Administrators can manage users and document types on a working application with role-based access
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, DTYPE-01, DTYPE-02, DTYPE-03, DTYPE-04, DTYPE-05
**Success Criteria** (what must be TRUE):
  1. User can log in with username/password and session persists across browser refresh
  2. Admin can create, edit, and disable user accounts from the management UI
  3. System displays different navigation/features based on user role (admin vs regular user)
  4. Admin can create, edit, enable/disable, and delete document types with search
  5. Non-admin users cannot access admin-only pages (user management, document type management)
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Monorepo scaffolding, DB schema (users + sessions + document_types), seed script, dev stack
- [ ] 01-02-PLAN.md — Bearer token auth (sessions table, NOT JWT), login/logout, session persistence via localStorage, app layout with role-conditional sidebar
- [ ] 01-03-PLAN.md — User management CRUD (with session revocation on disable), document type management CRUD with search

### Phase 2: AI Provider and Model Configuration
**Goal**: Administrators can configure AI providers and models, verify connectivity, and prepare models for use in workflows
**Depends on**: Phase 1
**Requirements**: AIMC-01, AIMC-02, AIMC-03, AIMC-04, AIMC-05, AIMC-06, AIMC-07, AIMC-08, AIMC-09
**Success Criteria** (what must be TRUE):
  1. Admin can create a provider instance (type, name, API address, credentials) and test its connectivity from the UI
  2. Admin can add models under a provider with display name, deployment type (cloud/local), and CLI command template
  3. Admin can configure model parameters (temperature, max_tokens, top_p) and enable/disable individual models
  4. Admin can edit, delete, and toggle provider and model status; disabled providers/models are excluded from workflow selection
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — DB schema (providers + models), shared types, provider CRUD + connectivity test, model CRUD, route registration
- [ ] 02-02-PLAN.md — Frontend card-layout admin page with modal forms, connectivity test toast, cascade status visualization, sidebar nav

### Phase 3: Workflow Orchestration
**Goal**: Administrators can design, validate, and manage complete document generation workflows using a visual editor with five node types
**Depends on**: Phase 2
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-08, FLOW-09, FLOW-10, FLOW-11, FLOW-12, FLOW-13
**Success Criteria** (what must be TRUE):
  1. Admin can create a workflow for a document type and add/arrange/configure all 5 node types in a visual editor, with the same node type usable multiple times
  2. Admin can configure each node type: input transform (form fields, file upload, output files), desensitize (rules, placeholder format, local model), model call (prompt template with {{variable}} interpolation, model selection, I/O files), restore, and export (format, template, mapping)
  3. System validates workflow on save (start/end node rules, desensitize-restore pairing, required fields) and shows validation errors
  4. Admin can enable/disable, edit, delete, copy workflows and set a default workflow per document type
  5. Visual preview displays node flow and file data paths through the workflow
**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md — Shared workflow types, DB schema (workflows table with JSONB), backend CRUD + validation API
- [ ] 03-02-PLAN.md — Workflow management list page (table CRUD, filters, copy, set-default)
- [ ] 03-03-PLAN.md — Canvas editor with @dschz/solid-flow, custom node components, node library panel
- [ ] 03-04-PLAN.md — Node configuration panels for all 5 types, prompt editor with {{variable}} tag system
- [ ] 03-05-PLAN.md — Validation overlay with error navigation, data flow visualization, end-to-end verification

### Phase 4: Project + Document + Version + File System Infrastructure
**Goal**: Users can organize work in projects with team members, manage documents with visibility controls, and the system maintains version history and working directories
**Depends on**: Phase 1
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07, PROJ-08, PROJ-09, DMGT-01, DMGT-02, DMGT-03, DMGT-04, DMGT-05, DMGT-06, VER-01, VER-02, VER-03, FSYS-01, FSYS-02, FSYS-03, FSYS-04
**Success Criteria** (what must be TRUE):
  1. User can create a project, invite/remove members, and assign roles (owner with full permissions, participant with limited permissions)
  2. User can browse projects (created/joined/all), search, and see role-appropriate project home views
  3. User can view, search, filter, and soft-delete documents within a project; document creator can set visibility (self/project/specific members)
  4. Version snapshots are created per node completion; user can view version timeline and diff two versions
  5. Each document has a working directory with standardized structure; node outputs write to step subdirectories with DB indexing; directories archive on document deletion
**Plans**: 6 plans

Plans:
- [x] 04-01-PLAN.md — DB schema (projects, documents, versions, files tables + enums) and shared TypeScript types
- [x] 04-02-PLAN.md — Project CRUD API with member management + frontend pages (list with tabs, home, settings)
- [x] 04-03-PLAN.md — Document CRUD API with visibility controls, recycle bin, workspace directory creation + frontend integration
- [x] 04-04-PLAN.md — Version snapshot API with diff logic + Timeline component, VersionDiff component, document detail page
- [ ] 04-05-PLAN.md — Gap closure: FSYS-02 file indexing service (insertDocumentFile + POST /files endpoint)
- [ ] 04-06-PLAN.md — Gap closure: Fix pre-existing frontend TypeScript errors (replace t.Any() schemas, commit WorkflowEditor/Canvas fixes)

### Phase 5: Document Creation Runtime
**Goal**: Users can create documents and execute the full workflow end-to-end — from input through AI generation, desensitization, recovery, to final export — with streaming output, multi-model comparison, and failure recovery
**Depends on**: Phase 3, Phase 4
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, NODE-01, NODE-02, NODE-03, NODE-04, NODE-05, NODE-06, NODE-07, NODE-08, NODE-09, NODE-10, NODE-11, NODE-12, NODE-13, NODE-14, NODE-15, NODE-16, NODE-17, NODE-18, NODE-19, NODE-20, NODE-21, NODE-22, NOPS-01, NOPS-02, NOPS-03, NOPS-04, RECV-01, RECV-02, RECV-03
**Success Criteria** (what must be TRUE):
  1. User can create a document within a project (select document type, choose workflow, enter title) and the system creates a working directory automatically
  2. Workspace shows progress navigation (completed/in-progress/pending nodes), current node operation area, and history panel for past nodes
  3. User can execute input transform nodes (fill text, upload Word/PDF/image/audio/video files, view parsed results, edit, confirm to write to step directory)
  4. Desensitization node uses local model to identify and highlight sensitive info; user confirms per-item; mappings are encrypted in DB; sanitized rules (type descriptions only, no real values) auto-inject into subsequent model call prompts
  5. Model call node executes via unified CLI abstraction with SSE streaming output (waiting/thinking/generating/done states); user can choose single or multi-model mode, compare outputs side-by-side, retry failed models individually, and select the best output
  6. Restore node replaces placeholders with real values locally, shows before/after diff with highlights, and allows manual correction of failed recoveries
  7. Export node lets user choose format (Word/PDF/Markdown), preview the result, set filename, and download; exported file is stored in working directory export/ folder
  8. User can confirm/next, inline-edit current output, skip optional nodes, and roll back to previous nodes (resetting downstream state) at any node
  9. System auto-saves drafts per node; user can close browser and resume from last state; user can cancel in-progress AI generation
**Plans**: 1 plan

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD
- [ ] 05-04: TBD
- [ ] 05-05: TBD

### Phase 6: Phase 1 Formal Verification & Housekeeping
**Goal**: Formally verify Phase 1 implementation and close all housekeeping gaps (stale checkboxes, missing VERIFICATION.md, ROADMAP status)
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, DTYPE-01, DTYPE-02, DTYPE-03, DTYPE-04, DTYPE-05
**Gap Closure:** Closes verification gaps from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. VERIFICATION.md exists for Phase 1 with all 9 requirements assessed
  2. REQUIREMENTS.md checkboxes updated for AUTH-02, DTYPE-01–05
  3. ROADMAP.md Phase 1 checkbox marked complete
**Plans**: 1 plan

Plans:
- [ ] 06-01-PLAN.md — Run formal verification on Phase 1, update all stale tracking artifacts

### Phase 7: Model Parameter Configuration
**Goal**: Complete model parameter configuration (temperature, max_tokens, top_p) for AIMC-05 and AIMC-09
**Depends on**: Phase 2
**Requirements**: AIMC-05, AIMC-09
**Gap Closure:** Closes requirement gaps from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. Admin can configure model parameters (temperature, max_tokens, top_p) when adding or editing a model
  2. Parameter values are persisted and retrievable via API
  3. Frontend UI provides parameter configuration fields in model add/edit forms
**Plans**: 1 plan

Plans:
- [ ] 07-01-PLAN.md — Backend schema/API for model parameters + frontend parameter configuration UI

### Phase 8: Integration Bug Fixes
**Goal**: Fix cross-phase integration issues discovered during v1.0 audit — validation overlay display, model list provider names, and shared type sync
**Depends on**: Phase 3, Phase 7
**Requirements**: FLOW-10, FLOW-06
**Gap Closure:** Closes integration gaps BROKEN-01, MISSING-01, MISSING-02 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. Workflow validation overlay displays backend validation errors correctly (response shape aligned)
  2. Model call config groups models by provider display name (not UUID)
  3. Shared Model type includes temperature, maxTokens, topP fields from Phase 7
**Plans**: 1 plan

Plans:
- [ ] 08-01-PLAN.md — Fix validation response shape, add provider JOIN to listActiveModels, sync shared Model type

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5
Note: Phase 4 depends on Phase 1 (not Phase 3), so Phases 3 and 4 could potentially execute in parallel.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Auth + Document Types | 3/3 | Complete | 2026-03-19 |
| 2. AI Provider and Model Configuration | 2/2 | Complete   | 2026-03-19 |
| 3. Workflow Orchestration | 5/5 | Complete   | 2026-03-19 |
| 4. Project + Document + Version + File System Infrastructure | 4/6 | Gap Closure | 2026-03-20 |
| 5. Document Creation Runtime | 0/5 | Not started | - |
| 6. Phase 1 Formal Verification & Housekeeping | 1/1 | Complete | 2026-03-19 |
| 7. Model Parameter Configuration | 1/1 | Complete | 2026-03-19 |
| 8. Integration Bug Fixes | 0/1 | Not started | - |
