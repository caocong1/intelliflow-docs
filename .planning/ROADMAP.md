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
- [x] **Phase 5: Document Creation Runtime** - Workspace UI, all 5 node executors, multi-model streaming, common operations, failure recovery (completed 2026-03-25, verified via Phase 13)
- [x] **Phase 6: Phase 1 Formal Verification & Housekeeping** - Verify Phase 1 implementation, update stale checkboxes and ROADMAP status (completed 2026-03-19)
- [x] **Phase 7: Model Parameter Configuration** - Complete AIMC-05 parameter config, implement AIMC-09 (completed 2026-03-19)
- [x] **Phase 8: Integration Bug Fixes** - Fix validation overlay shape, provider name in model list, shared type sync (completed 2026-03-20)
- [x] **Phase 9: Integration Polish & UX Guards** - Association check guard for document type delete, fix frontend ownership derivation (completed 2026-03-20)
- [x] **Phase 10: Non-Admin Read API Access** - Split doc-type/workflow listing to requireAuth so non-admin users can create documents (completed 2026-03-20)
- [x] **Phase 11: Pre-Phase 5 API Access Fixes** - Split user/model/workflow-detail routes to requireAuth for non-admin access, closing INT-NEW-02/INT-NEW-03 (completed 2026-03-20)
- [x] **Phase 14: Milestone Tracking Housekeeping** - Fix RECV-03 tracking, Phase 5 stale metadata, Phase 13 verification discrepancy, Phase 5 VERIFICATION.md (completed 2026-03-25)
- [x] **Phase 15: Integration Bug Fixes — Export URL, PPT Cleanup, Type Sync** - Fix ExportCompleted download URL, remove phantom PPT format, sync shared User type avatar field (completed 2026-03-25)

## Phase Details

> **Note:** Phase 5 is the primary remaining work (34 requirements). Phase 11 fixes integration issues (INT-NEW-02, INT-NEW-03) and Phase 5 readiness blockers discovered in re-audit #5.

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
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, NODE-01, NODE-02, NODE-03, NODE-04, NODE-05, NODE-06, NODE-07, NODE-08, NODE-09, NODE-10, NODE-11, NODE-12, NODE-13, NODE-14, NODE-15, NODE-16, NODE-17, NODE-18, NODE-19, NODE-20, NODE-21, NODE-22, NOPS-01, NOPS-02, NOPS-03, NOPS-04, RECV-01, RECV-02, RECV-03 (deferred to v2)
**Success Criteria** (what must be TRUE):
  1. User can create a document within a project (select document type, choose workflow, enter title) and the system creates a working directory automatically
  2. Workspace shows progress navigation (completed/in-progress/pending nodes), current node operation area, and history panel for past nodes
  3. User can execute input transform nodes (fill text, upload Word/PDF/image/audio/video files, view parsed results, edit, confirm to write to step directory)
  4. Desensitization node uses local model to identify and highlight sensitive info; user confirms per-item; mappings are encrypted in DB; sanitized rules (type descriptions only, no real values) auto-inject into subsequent model call prompts
  5. Model call node executes via unified CLI abstraction with SSE streaming output (waiting/thinking/generating/done states); user can choose single or multi-model mode, compare outputs side-by-side, retry failed models individually, and select the best output
  6. Restore node replaces placeholders with real values locally, shows before/after diff with highlights, and allows manual correction of failed recoveries
  7. Export node lets user choose format (Word/PDF/Markdown), preview the result, set filename, and download; exported file is stored in working directory export/ folder
  8. User can confirm/next, inline-edit current output, skip optional nodes, and roll back to previous nodes (resetting downstream state) at any node
  9. System auto-saves drafts per node; user can close browser and resume from last state; user can cancel in-progress AI generation *(RECV-03 deferred to v2)*
**Plans**: 8 plans

Plans:
- [ ] 05-01-PLAN.md — Runtime DB schema (nodeExecutions, desensitizeMappings), shared runtime types, node config augmentation (autoAdvance, allowEdit, skippable, modelIds)
- [ ] 05-02-PLAN.md — Runtime orchestration API (init, advance, rollback, skip, draft save) + workspace UI shell (stepper, node area, history panel, action bar)
- [ ] 05-03-PLAN.md — Input transform node executor (file upload with txt/pdf/docx parsing, editable results, confirm to step directory)
- [ ] 05-04-PLAN.md — Desensitize node executor (local model detection, inline highlight + checklist UI, mapping storage, sanitized rule injection)
- [ ] 05-05-PLAN.md — Model call node executor (OpenAI-compatible API with SSE streaming, multi-model parallel, tab switching, side-by-side comparison, retry, output selection)
- [ ] 05-06-PLAN.md — Restore node executor (placeholder replacement from mappings, before/after diff with green/red highlights, inline manual correction)
- [ ] 05-07-PLAN.md — Export node executor (Word/PDF/Markdown generation, in-page preview, filename editor, download with export/ storage)
- [ ] 05-08-PLAN.md — Inline Markdown WYSIWYG editor, skip logic wiring, auto-save on edit, RECV-03 deferred acknowledgement

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

### Phase 9: Integration Polish & UX Guards
**Goal**: Fix minor integration issues found during v1.0 audit — document type delete association guard and frontend ownership derivation
**Depends on**: Phase 1, Phase 4
**Requirements**: DTYPE-04, PROJ-05
**Gap Closure:** Closes integration gaps DTYPE-04-GUARD, PROJ-05-ISOWNER from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. Deleting a document type with associated workflows returns a user-friendly error message (not raw DB FK error)
  2. Frontend `isOwner()` checks projectMembers role instead of `createdBy` field
**Plans**: 1 plan

Plans:
- [ ] 09-01-PLAN.md — Association check in deleteDocumentType + fix isOwner() in ProjectHome.tsx

### Phase 10: Non-Admin Read API Access
**Goal**: Non-admin users can list active document types and workflows when creating documents, fixing the cross-phase wiring gap between admin-only Phase 1/3 endpoints and Phase 4's non-admin user flows
**Depends on**: Phase 1, Phase 3
**Requirements**: DMGT-01
**Gap Closure:** Closes integration gap INT-NEW-01 from v1.0 audit (re-audit #4)
**Success Criteria** (what must be TRUE):
  1. Non-admin authenticated users can call GET /api/document-types and GET /api/workflows to list active items (requireAuth, not requireAdmin)
  2. Admin-only mutations (create, edit, delete, toggle) remain behind requireAdmin
  3. ProjectHome document creation modal shows populated doc type and workflow selectors for non-admin users
**Plans**: 1 plan

Plans:
- [ ] 10-01-PLAN.md — Split doc-type/workflow routes: requireAuth for listing, requireAdmin for mutations

### Phase 11: Pre-Phase 5 API Access Fixes
**Goal**: Non-admin project owners can invite members and Phase 5 runtime can access models and workflow details without admin privileges
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 10
**Requirements**: PROJ-05
**Gap Closure:** Closes integration gaps INT-NEW-02, INT-NEW-03 and Phase 5 readiness blockers from v1.0 audit (re-audit #5)
**Success Criteria** (what must be TRUE):
  1. Non-admin project owner can search users and invite members without 403 (requireAuth user search endpoint)
  2. Non-admin authenticated users can call GET /api/models to list active models (requireAuth, not requireAdmin)
  3. Non-admin authenticated users can call GET /api/workflows/:id to load a single workflow definition (requireAuth, not requireAdmin)
  4. Admin-only mutations (create, edit, delete users/models) remain behind requireAdmin
**Plans**: 1 plan

Plans:
- [ ] 11-01-PLAN.md — Split user/model/workflow-detail routes: requireAuth for read, requireAdmin for mutations (Phase 10 pattern)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5
Note: Phase 4 depends on Phase 1 (not Phase 3), so Phases 3 and 4 could potentially execute in parallel.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Auth + Document Types | 3/3 | Complete | 2026-03-19 |
| 2. AI Provider and Model Configuration | 2/2 | Complete   | 2026-03-19 |
| 3. Workflow Orchestration | 5/5 | Complete   | 2026-03-19 |
| 4. Project + Document + Version + File System Infrastructure | 6/6 | Complete | 2026-03-20 |
| 5. Document Creation Runtime | 8/8 | Complete | 2026-03-25 |
| 6. Phase 1 Formal Verification & Housekeeping | 1/1 | Complete | 2026-03-19 |
| 7. Model Parameter Configuration | 1/1 | Complete | 2026-03-19 |
| 8. Integration Bug Fixes | 1/1 | Complete | 2026-03-20 |
| 9. Integration Polish & UX Guards | 1/1 | Complete | 2026-03-20 |
| 10. Non-Admin Read API Access | 1/1 | Complete    | 2026-03-20 |
| 11. Pre-Phase 5 API Access Fixes | 1/1 | Complete    | 2026-03-20 |
| 12. Workflow Editor Fixes & Config Panel Alignment | 7/7 | Complete | 2026-03-20 |
| 13. Document Runtime Refactor | 10/10 | Complete    | 2026-03-25 |
| 14. Milestone Tracking Housekeeping | 1/1 | Complete    | 2026-03-25 |
| 15. Integration Bug Fixes — Export URL, PPT Cleanup, Type Sync | 1/1 | Complete   | 2026-03-25 |

### Phase 12: Workflow Editor Fixes & Config Panel Alignment

**Goal:** Fix the workflow visual editor so it produces valid, runtime-compatible workflows — with node/edge deletion, config panel alignment to shared types, auto-derived outputs, undo/redo, real-time autosave, comprehensive validation, prompt optimization, and polished UI/UX
**Requirements**: FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-08, FLOW-09, FLOW-10, FLOW-11, FLOW-13
**Depends on:** Phase 11
**Plans:** 7/7 plans complete

Plans:
- [ ] 12-01-PLAN.md — Shared type updates (DesensitizeConfig categories, ExportConfig ppt, FormFieldDef) + flow engine library (types, store, coordinate, edge-paths, derive-outputs)
- [ ] 12-02-PLAN.md — Custom SVG+HTML canvas infrastructure (FlowCanvas, FlowViewport, FlowNode, EdgeRenderer) + migrate from @dschz/solid-flow
- [ ] 12-03-PLAN.md — Selection system (click, multi-select, rubber-band), deletion with confirmation, batch drag, MiniMap
- [ ] 12-04-PLAN.md — Config panel overhaul (all 5 panels aligned to shared types, RuntimeSettings, remove OutputsEditor)
- [ ] 12-05-PLAN.md — Undo/redo + debounced autosave + validation expansion (full-field + linear flow) + 变量→节点输出 rename
- [ ] 12-06-PLAN.md — UI/UX polish (edge animation, edge midpoint drag, alignment guides, node design, NodeLibraryPanel) + human verification
- [ ] 12-07-PLAN.md — Prompt optimization (backend endpoint + frontend dialog with model picker and meta-prompt)

### Phase 13: Document Runtime Refactor — Align with Phase 12 Editor

**Goal:** Refactor the document creation runtime (workspace UI, all 5 node executors, orchestration) to align with Phase 12's restructured shared types, flow engine, and config panel changes — so users can create documents and execute workflows end-to-end with the new editor output
**Depends on:** Phase 5, Phase 12
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, NODE-01 through NODE-22, NOPS-01 through NOPS-04, RECV-01, RECV-02
**Success Criteria** (what must be TRUE):
  1. DocumentWorkspace loads workflow config from backend and passes real configs (not empty objects) to each executor component
  2. Runtime advanceNode propagates upstream outputData to downstream node inputData
  3. Export resolveContent correctly finds model outputs from the `models` Record structure (not stale `modelOutputs` Array)
  4. All 5 executor UIs display in Chinese and work correctly with the new config structures (categories, modelIds[], VariableRef, etc.)
  5. User can create a document, execute a workflow created in the Phase 12 editor end-to-end, and export the result
**Plans**: 10 plans

Plans:
- [ ] 13-01-PLAN.md — Backend data flow fixes (init API with workflowNodes, nodeId-based variable resolution, export resolveContent)
- [ ] 13-02-PLAN.md — Model call logging (model_call_logs table, write on execute/retry)
- [ ] 13-03-PLAN.md — DocumentWorkspace config wiring + executor null guards
- [ ] 13-04-PLAN.md — Executor UI redesign: InputTransform + Desensitize (Chinese, Stitch-based)
- [ ] 13-05-PLAN.md — Executor UI redesign: ModelCall + Restore + Export (Chinese, Stitch-based)
- [ ] 13-06-PLAN.md — Workflow preview in create modal + document list progress display
- [ ] 13-07-PLAN.md — Network banner, auto-save indicator, error handling
- [ ] 13-08-PLAN.md — Completed document read-only mode + re-execution versioning
- [ ] 13-09-PLAN.md — Multi-input desensitize/restore data flow and executor UI
- [ ] 13-10-PLAN.md — Gap closure: Fix upstream data flow (outputData.text), draft save body shape, and document list progress subqueries

### Phase 14: Milestone Tracking Housekeeping

**Goal:** Close all documentation and tracking gaps identified by v1.0 milestone audit — fix RECV-03 tracking inconsistency, update stale Phase 5 metadata, create Phase 5 VERIFICATION.md, and align Phase 13 verification frontmatter
**Depends on:** Phase 13
**Requirements**: RECV-03 (moved to v2 scope)
**Gap Closure:** Closes all tracking/documentation gaps from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. RECV-03 marked as deferred to v2 in REQUIREMENTS.md (not `[x] Complete`)
  2. ROADMAP.md Phase 5 shows `[x]` and "8/8 Complete"
  3. Phase 5 has a VERIFICATION.md referencing Phase 13's coverage of 33/34 requirements
  4. Phase 13 VERIFICATION.md frontmatter `status` matches body text (`human_needed`)
**Plans**: 1 plan

Plans:
- [x] 14-01-PLAN.md — Fix all tracking inconsistencies, create Phase 5 VERIFICATION.md, verify all artifacts aligned

### Phase 15: Integration Bug Fixes — Export URL, PPT Cleanup, Type Sync

**Goal:** Fix cross-phase integration bugs found during v1.0 audit — ExportCompleted download URL (404), phantom PPT format option, and shared User type avatar field sync
**Depends on:** Phase 13
**Requirements**: DOC-05, NODE-20
**Gap Closure:** Closes integration gaps (ExportCompleted URL, PPT mismatch, User type split) and flow gaps (completed doc re-download, PPT export) from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. ExportCompleted download button uses correct URL pattern `/export/${nodeExecutionId}/download` and returns 200
  2. PPT format removed from shared ExportConfig type and ExportConfig.tsx editor (not supported by backend)
  3. Shared User type includes `avatar?: string | null` matching the backend response
**Plans**: 1 plan

Plans:
- [ ] 15-01-PLAN.md — Fix ExportCompleted download URL, remove PPT from types/editor, add avatar to shared User type
