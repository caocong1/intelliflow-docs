# Roadmap: IntelliFlow（智文平台）

## Overview

IntelliFlow delivers an AI document generation platform where users orchestrate document generation workflows using five node types (input transform, desensitize, model call, restore, export), driving multi-model parallel generation, comparison, and iteration to produce high-quality documents.

## Milestones

- **v1.0 MVP** — Phases 1-16 (shipped 2026-03-25) | [details](milestones/v1.0-ROADMAP.md)
- **v1.1 运营增强与智能编辑** — Phases 17-22 (shipped 2026-03-27) | [details](milestones/v1.1-ROADMAP.md)
- **v1.2 节点能力增强** — Phases 23-26 (shipped 2026-03-27) | [details](milestones/v1.2-ROADMAP.md)
- **v1.3 安全与契约修复（部分）** — Phases 27-29 (shipped 2026-04-03) | [details](milestones/v1.3-ROADMAP.md)
- **v1.4 质量与测试** — Phases 30-31 (shipped 2026-04-04)
- **v1.5 AI 自动生成流程** — Phases 32-37 (active, 0/6 shipped)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-16) — SHIPPED 2026-03-25</summary>

- [x] Phase 1: Foundation + Auth + Document Types (3/3 plans) — completed 2026-03-19
- [x] Phase 2: AI Provider and Model Configuration (2/2 plans) — completed 2026-03-19
- [x] Phase 3: Workflow Orchestration (5/5 plans) — completed 2026-03-19
- [x] Phase 4: Project + Document + Version + File System Infrastructure (6/6 plans) — completed 2026-03-20
- [x] Phase 5: Document Creation Runtime (8/8 plans) — completed 2026-03-25
- [x] Phase 6: Phase 1 Formal Verification & Housekeeping (1/1 plan) — completed 2026-03-19
- [x] Phase 7: Model Parameter Configuration (1/1 plan) — completed 2026-03-19
- [x] Phase 8: Integration Bug Fixes (1/1 plan) — completed 2026-03-20
- [x] Phase 9: Integration Polish & UX Guards (1/1 plan) — completed 2026-03-20
- [x] Phase 10: Non-Admin Read API Access (1/1 plan) — completed 2026-03-20
- [x] Phase 11: Pre-Phase 5 API Access Fixes (1/1 plan) — completed 2026-03-20
- [x] Phase 12: Workflow Editor Fixes & Config Panel Alignment (7/7 plans) — completed 2026-03-20
- [x] Phase 13: Document Runtime Refactor (11/11 plans) — completed 2026-03-25
- [x] Phase 14: Milestone Tracking Housekeeping (1/1 plan) — completed 2026-03-25
- [x] Phase 15: Integration Bug Fixes — Export/PPT/Type Sync (1/1 plan) — completed 2026-03-25
- [x] Phase 16: Fix Version History & Dead Code Cleanup (1/1 plan) — completed 2026-03-25

</details>

<details>
<summary>v1.1 运营增强与智能编辑 (Phases 17-22) — SHIPPED 2026-03-27</summary>

- [x] Phase 17: Schema Migration + Tech Debt (2/2 plans) — completed 2026-03-26
- [x] Phase 18: Background Execution + Notifications (6/6 plans) — completed 2026-03-26
- [x] Phase 19: Statistics & Audit Dashboard (6/6 plans) — completed 2026-03-26
- [x] Phase 20: Search + Favorites + Recent Access (3/3 plans) — completed 2026-03-26
- [x] Phase 21: AI-Assisted Inline Editing (3/3 plans) — completed 2026-03-27
- [x] Phase 22: Bug Fixes + Form Field Type Extension (3/3 plans) — completed 2026-03-27

</details>

<details>
<summary>v1.2 节点能力增强 (Phases 23-26) — SHIPPED 2026-03-27</summary>

- [x] Phase 23: Output Path Grammar + File Slots + Export ContentMapping (3/3 plans) — completed 2026-03-27
- [x] Phase 24: Structured Output + Named Artifacts + Field References (4/4 plans) — completed 2026-03-27
- [x] Phase 25: Export Table Rendering + System Prompt Separation (3/3 plans) — completed 2026-03-27
- [x] Phase 26: Conditional Node Execution (4/4 plans) — completed 2026-03-27

</details>

<details>
<summary>v1.3 安全与契约修复（部分）(Phases 27-29) — SHIPPED 2026-04-03</summary>

- [x] Phase 27: Permission Security (4/4 plans) — completed 2026-04-03
- [x] Phase 28: File Security (4/4 plans) — completed 2026-04-03
- [x] Phase 29: XSS Defense (4/4 plans) — completed 2026-04-03

</details>

<details>
<summary>v1.4 质量与测试 (Phases 30-31) — SHIPPED 2026-04-04</summary>

- [x] Phase 30: TypeScript Quality + Contract Fixes (2/2 plans) — completed 2026-04-04
- [x] Phase 31: Test Coverage (3/3 plans) — completed 2026-04-04

</details>

### v1.5 AI 自动生成流程 (Active)

- [ ] Phase 32: Data Model + Backend Skeleton + Model Role Binding
- [ ] Phase 33: Deterministic Blueprint Compiler + Request Normalization
- [ ] Phase 34: AI Generation Pipeline (Analysis → Blueprint → Enrichment → Review → Revision)
- [ ] Phase 35: Validation-Fix Loop + Job Persistence + API Endpoints
- [ ] Phase 36: Frontend Wizard + Result Preview + Editor Handoff
- [ ] Phase 37: Testing & Tuning

## Phase Details

*(Phases 27-29 details archived in [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md))*

### Phase 30: TypeScript Quality + Contract Fixes
**Goal**: All runtime API calls use typed wrappers instead of `as any` casts, and shared type contracts accurately reflect actual backend behavior
**Depends on**: Phase 29
**Requirements**: TSQL-01~04, CONT-01~04
**Success Criteria** (what must be TRUE):
  1. DocumentWorkspace.tsx, ExportExecutor.tsx, and VersionHistory.tsx contain zero `as any` casts for Eden Treaty API calls
  2. The DocumentStatus type includes "failed" and the backend document list API accepts status=failed as a filter parameter
  3. InputSource.outputId and VariableRef.outputId have JSDoc comments explaining their semantics, and validation.ts contains inline comments on outputId comparison logic
  4. All runtime API calls in the frontend go through typed wrapper functions in client.ts

### Phase 31: Test Coverage
**Goal**: Automated tests verify that security fixes and contract corrections work as specified, providing regression protection
**Depends on**: Phase 28, Phase 29, Phase 30
**Requirements**: TEST-01~03
**Success Criteria** (what must be TRUE):
  1. sanitize.test.ts passes: path traversal strings are neutralized, null bytes are stripped, normal filenames pass through, and assertWithinRoot throws on escape attempts
  2. sanitize-html.test.ts passes: script tags are removed, onerror attributes are stripped, safe HTML tags (p, em, strong, code) are preserved
  3. document-status.test.ts passes: "failed" is a valid DocumentStatus value and the filter function accepts it

### Phase 32: Data Model + Backend Skeleton + Model Role Binding
**Goal**: The persistence layer and backend module scaffolding are in place, with model role binding configured so the orchestrator (built in later phases) has stable foundations to build on
**Depends on**: Phase 31
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, GEN-01, GEN-02, MROLE-01, MROLE-02, MROLE-03
**Success Criteria** (what must be TRUE):
  1. A Drizzle migration creates the `workflow_generation_jobs` table with all required columns (id, createdBy, documentTypeId, workflowName, status enum, progress, requestPayload, normalizedRequest, intentSummary, blueprintDraft, reviewReport, finalBlueprint, compiledWorkflow, validationReport, generatedWorkflowId, errorMessage, timestamps), the status column accepts all five enum values (`queued / running / completed / failed / review_needed`), and `modelCallLogs.callSource` accepts `workflow_generation`
  2. Shared types (`WorkflowGenerationRequest`, `WorkflowBlueprintDraft`, `StageDraft`, `NormalizedGenerationRequest`, `EnrichedWorkflowBlueprint`, `FinalBlueprint`, `CompiledWorkflowDraft`) are exported from the shared types package and import cleanly from both backend and frontend
  3. `packages/backend/src/modules/workflow-generator/` exists with all seven files (routes, service, orchestrator, compiler, validation-fix, prompts, types); the service layer supports job CRUD, status transitions, and summary formatting, covered by a unit smoke test that inserts and reads back a job row
  4. An admin can open the AI Provider settings area and configure five model role bindings (`analysis / blueprint / prompt / review / repair`); the default strategy assigns every role to the same model, and overriding any single role persists correctly and is returned on subsequent reads

### Phase 33: Deterministic Blueprint Compiler + Request Normalization
**Goal**: The compiler and request normalization path are complete and validated independently of AI — a `FinalBlueprint` input produces a legal workflow draft that passes `validateWorkflow()` on the first try, giving the AI pipeline (next phase) a stable deterministic target
**Depends on**: Phase 32
**Requirements**: PIPE-01, COMP-01, COMP-02, COMP-03, COMP-04, VFIX-01
**Success Criteria** (what must be TRUE):
  1. Stage 0 request normalization (code-only) accepts a `WorkflowGenerationRequest`, validates required fields, strips whitespace, derives safe `machineKey` values for groups and files, infers default `acceptedFileTypes` when omitted, converts any `direction: "output"` file items into named-artifact requirements, and emits a `NormalizedGenerationRequest`
  2. Given a hand-authored `FinalBlueprint` fixture, the compiler emits a `CompiledWorkflowDraft` (nodes/edges) whose structure is linear (`input_transform → desensitize? → stage_1..n → restore? → stage_post? → export`) and which passes `validateWorkflow()` without modification
  3. Input field compilation maps `fileGroups/files` to `FormFieldDef[]` — input file items become `type: "file"` with required, fileCountMode, acceptedFileTypes, and system-generated `machineKey / fileSlotId / fileSlotLabel` — and form fields survive a round-trip through the workflow editor's field renderer
  4. Stage node compilation produces stable ids, non-empty labels and displayNames, non-empty `promptTemplate`, unique `namedOutputs` ids, and attaches `simpleFields` or `jsonSchema` whenever a stage emits JSON; restore sources point only to named artifacts that will actually be exported, and `export.contentMapping` selects only content that belongs in the final document
  5. The validation-fix module (stub level) can call `validateWorkflow()` on a compiler output and return structured pass/fail — enough that Phase 34 can plug AI stages into this pipeline without re-designing the contract

### Phase 34: AI Generation Pipeline (Analysis → Blueprint → Enrichment → Review → Revision)
**Goal**: The orchestrator runs the full multi-stage AI pipeline against a `NormalizedGenerationRequest` and produces a `FinalBlueprint` that feeds cleanly into the Phase 33 compiler
**Depends on**: Phase 33
**Requirements**: GEN-03, GEN-04, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06
**Success Criteria** (what must be TRUE):
  1. The orchestrator runs stages 1-5 in sequence (analysis → blueprint → enrichment → review → revision), persists each intermediate artifact to the corresponding `workflow_generation_jobs` column, advances the `progress` integer, and uses the Phase 32 model role bindings to select which model handles each stage
  2. All stage prompts (system + main templates for every stage) live in `workflow-generator.prompts.ts` — no prompt strings are scattered across orchestrator/service/routes files
  3. Stage 1 analysis emits a structured `intentSummary / inputStrategy / artifactStrategy / riskList`, explicitly recording whether a desensitize link is needed and whether multi-stage generation is warranted, and the orchestrator uses these flags when driving later stages
  4. Stage 2 blueprint generation returns a `WorkflowBlueprintDraft` containing `inputFields`, `preRestoreStages`, `restoreSources`, `postRestoreStages`, and `exportPlan` that remains linear (no DAG branching)
  5. Stage 3 enrichment attaches system+main prompts to every stage, fills `outputPrompt` for every named output, attaches `simpleFields` or `jsonSchema` wherever a stage emits JSON, and populates `stepDescription`, emitting an `EnrichedWorkflowBlueprint`
  6. Stage 4 review runs against the review model, emits a structured `reviewReport + revisionInstructions` that checks input coverage, file group mapping, named artifacts, prompt quality, export plan, and engine constraints; Stage 5 revision consumes those instructions (1-2 rounds max) and emits a `FinalBlueprint`
  7. Running the orchestrator against a golden-path generation request produces a `FinalBlueprint` that the Phase 33 compiler turns into a workflow passing `validateWorkflow()` without entering the repair loop

### Phase 35: Validation-Fix Loop + Job Persistence + API Endpoints
**Goal**: The end-to-end backend path is wired through admin-accessible HTTP endpoints: admin submits a request, the orchestrator drives the pipeline, the validation-repair loop recovers from bad blueprints, and the final `draft` workflow lands in the database — all steps traceable via `workflow_generation_jobs`
**Depends on**: Phase 34
**Requirements**: VFIX-02, VFIX-03, VFIX-04, API-01, API-02, API-03, API-04, API-05, FAIL-01, FAIL-03
**Success Criteria** (what must be TRUE):
  1. When compilation of a `FinalBlueprint` fails `validateWorkflow()`, the validation-fix module converts each error into a structured repair instruction, feeds it to the repair model which mutates the blueprint (not the compiled workflow), then recompiles and re-validates — and this loop can execute up to 3 rounds before giving up
  2. If the repair loop exhausts its 3-round budget, the job is marked `review_needed`, the full error stack and every intermediate artifact (request / normalized / blueprint / review / compiled / validation) remain persisted, and the generated workflow row is NOT created
  3. On successful completion, Stage 8 creates a `draft` workflow row, populates `generatedWorkflowId` on the job, stores intermediate artifacts, and emits a summary containing input items, file group mappings, stage nodes, named artifacts, export plan, and warnings/assumptions
  4. `POST /workflow-generator/jobs` accepts a complete `WorkflowGenerationRequest`, creates a job row in `queued` status, kicks off orchestration asynchronously, and returns `{ jobId, status }`; `GET /workflow-generator/jobs/:id` returns job state + progress + current stage name + summary + warnings + generated workflow overview; `GET /workflow-generator/jobs` returns recent jobs for admin; `POST /workflow-generator/jobs/:id/regenerate` re-runs the pipeline with the original request preserved
  5. All `/workflow-generator/*` endpoints enforce `requireAdmin`, return shapes that match Eden Treaty typed wrappers in the style of v1.4 TSQL work, and reject non-admin callers with 403
  6. For every failed job, the job row and all intermediate artifacts that existed before failure are retained (no cleanup) — queryable via `GET /workflow-generator/jobs/:id` regardless of terminal status

### Phase 36: Frontend Wizard + Result Preview + Editor Handoff
**Goal**: An admin can drive the full generator from the UI — open the menu, fill the wizard, watch the job progress, review the preview, and land in the workflow editor to continue fine-tuning
**Depends on**: Phase 35
**Requirements**: WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05, WIZ-06, FERE-01, FERE-02, FERE-03, FAIL-02
**Success Criteria** (what must be TRUE):
  1. A new admin menu entry "AI 自动生成流程" is visible in the sidebar and navigates to `/admin/workflow-ai`; the existing "新建流程" entry in workflow management remains unchanged
  2. The wizard form collects all six required fields (documentTypeId, workflowName, workflowGoal, mainPrompt, fileGroups, exportFormats) and all eight optional fields (sensitiveDataLevel, desiredArtifacts, referenceStyle, hardConstraints, qualityMode, defaultWorkflowCandidate, templatePreference, referenceMaterials), with client-side required-field validation
  3. The file group editor supports add/edit/delete/reorder with all group-level fields (groupId, groupName, groupDescription, required, priority); the file item editor inside each group supports add/edit/delete with all item-level fields (fileId, name, description, direction, required, fileCountMode, acceptedFileTypes) and shows a "output" semantics hint when `direction: output` is selected
  4. After submit, the wizard polls `GET /workflow-generator/jobs/:id`, renders the current stage name, overall progress, and most recent error; on failure the UI shows "查看错误摘要" and "重新生成" buttons, with distinct messaging for each failure category (invalid request / model call failure / illegal blueprint / repair exhausted / persistence failure)
  5. On job completion, the result preview renders the workflow description, input field list, stage node list, per-stage named artifacts, export content plan, and warnings/assumptions, followed by a "进入流程编辑器" button that redirects to `/admin/workflows/:id/edit`
  6. The jobs list page shows recent generation jobs for the admin, supports status filtering, and clicking a row opens the corresponding job detail view

### Phase 37: Testing & Tuning
**Goal**: Automated tests cover the critical generator paths (normalization, compiler, repair, end-to-end happy path, end-to-end failure path) so that regressions are caught before they reach admins
**Depends on**: Phase 36
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Unit tests cover request normalization (whitespace cleanup, machineKey generation, output-item conversion), blueprint → workflow compiler (stable ids, linear structure, form field mapping), named artifact id uniqueness, export mapping generation, and validation-error → repair-instruction conversion
  2. Integration tests cover: create job → happy path → draft workflow exists and passes `validateWorkflow()`; create job → compiler fails once → repair loop fixes it → job completes; create job → model call fails → job marked `failed` with full intermediate state; create job → repair budget exhausted → job marked `review_needed` with no workflow created
  3. Frontend tests cover wizard form validation (required fields), file group CRUD and reorder, job submission, polling state rendering (queued/running/completed/failed/review_needed), result preview rendering, and editor handoff navigation

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation + Auth + Document Types | v1.0 | 3/3 | Complete | 2026-03-19 |
| 2. AI Provider and Model Configuration | v1.0 | 2/2 | Complete | 2026-03-19 |
| 3. Workflow Orchestration | v1.0 | 5/5 | Complete | 2026-03-19 |
| 4. Project + Document + Version + File System | v1.0 | 6/6 | Complete | 2026-03-20 |
| 5. Document Creation Runtime | v1.0 | 8/8 | Complete | 2026-03-25 |
| 6. Phase 1 Verification | v1.0 | 1/1 | Complete | 2026-03-19 |
| 7. Model Parameter Configuration | v1.0 | 1/1 | Complete | 2026-03-19 |
| 8. Integration Bug Fixes | v1.0 | 1/1 | Complete | 2026-03-20 |
| 9. Integration Polish & UX Guards | v1.0 | 1/1 | Complete | 2026-03-20 |
| 10. Non-Admin Read API Access | v1.0 | 1/1 | Complete | 2026-03-20 |
| 11. Pre-Phase 5 API Access Fixes | v1.0 | 1/1 | Complete | 2026-03-20 |
| 12. Workflow Editor Fixes | v1.0 | 7/7 | Complete | 2026-03-20 |
| 13. Document Runtime Refactor | v1.0 | 11/11 | Complete | 2026-03-25 |
| 14. Milestone Tracking Housekeeping | v1.0 | 1/1 | Complete | 2026-03-25 |
| 15. Integration Bug Fixes — Export/PPT/Type | v1.0 | 1/1 | Complete | 2026-03-25 |
| 16. Version History & Dead Code Cleanup | v1.0 | 1/1 | Complete | 2026-03-25 |
| 17. Schema Migration + Tech Debt | v1.1 | 2/2 | Complete | 2026-03-26 |
| 18. Background Execution + Notifications | v1.1 | 6/6 | Complete | 2026-03-26 |
| 19. Statistics & Audit Dashboard | v1.1 | 6/6 | Complete | 2026-03-26 |
| 20. Search + Favorites + Recent Access | v1.1 | 3/3 | Complete | 2026-03-26 |
| 21. AI-Assisted Inline Editing | v1.1 | 3/3 | Complete | 2026-03-27 |
| 22. Bug Fixes + Form Field Type Extension | v1.1 | 3/3 | Complete | 2026-03-27 |
| 23. Output Path Grammar + File Slots | v1.2 | 3/3 | Complete | 2026-03-27 |
| 24. Structured Output + Named Artifacts | v1.2 | 4/4 | Complete | 2026-03-27 |
| 25. Word Table Rendering + System Prompt | v1.2 | 3/3 | Complete | 2026-03-27 |
| 26. Conditional Node Execution | v1.2 | 4/4 | Complete | 2026-03-27 |
| 27. Permission Security | v1.3 | 4/4 | Complete | 2026-04-03 |
| 28. File Security | v1.3 | 4/4 | Complete | 2026-04-03 |
| 29. XSS Defense | v1.3 | 4/4 | Complete | 2026-04-03 |
| 30. TypeScript Quality + Contract Fixes | v1.4 | 2/2 | Complete | 2026-04-04 |
| 31. Test Coverage | v1.4 | 3/3 | Complete | 2026-04-04 |
| 32. Data Model + Backend Skeleton + Model Role Binding | v1.5 | 0/? | Not started | - |
| 33. Deterministic Blueprint Compiler + Normalization | v1.5 | 0/? | Not started | - |
| 34. AI Generation Pipeline | v1.5 | 0/? | Not started | - |
| 35. Validation-Fix Loop + Job Persistence + API | v1.5 | 0/? | Not started | - |
| 36. Frontend Wizard + Result Preview + Editor Handoff | v1.5 | 0/? | Not started | - |
| 37. Testing & Tuning | v1.5 | 0/? | Not started | - |
