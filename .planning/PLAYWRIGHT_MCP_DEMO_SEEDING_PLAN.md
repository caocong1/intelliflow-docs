# Playwright MCP Demo Seeding Handoff

## Goal
- Use `playwright-mcp` interactively, not a long standalone script.
- Log into the local app, create one demo project, then create and generate at least one document for every business demo workflow.
- Prefer page interaction first. Use browser-context API calls only if a specific UI action is blocked or unstable.

## Important Context
- The demo workflows have already been seeded into the database in this repo session.
- Current business demo workflows in the local DB:
  - `bid_response` / `招投标通用生成流程`
  - `solution_docs` / `解决方案建议书 Agent 流程`
  - `solution_docs` / `客户需求澄清问答单流程`
  - `requirement_design` / `需求规格与概要设计 Agent 流程`
  - `technical_analysis` / `技术选型与 PoC 结论 Agent 流程`
  - `technical_analysis` / `故障复盘与改进项流程`
  - `implementation_delivery` / `实施交付与验收策划 Agent 流程`
  - `implementation_delivery` / `项目周报与风险追踪流程`
  - `procurement_selection` / `软硬件采购比选与推荐 Agent 流程`
  - `meeting-notes` / `会议纪要→行动项流程`
- New flows use:
  - local desensitize model: `Gemma 4 26b`
  - multi-model review nodes: up to 3 cloud models
- `chrome-devtools` MCP was unusable in the prior session with `Transport closed`. This handoff assumes `playwright-mcp` is available and healthy.

## Credentials
- Use the credentials already provided by the user in the new session context.
- Do not persist the password into repo files.
- If the reopened session does not contain the password, ask the user to provide it again before operating.

## Project To Create
- Project name: `内部展示 Demo 项目`
- Description: `自动创建：用于展示多类 Agent 工作流文档`
- Department: `解决方案部`

## Documents To Create
- Create one document per workflow with these titles:
  - `招投标通用生成流程` → `Demo - 招投标响应文件`
  - `解决方案建议书 Agent 流程` → `Demo - 解决方案建议书`
  - `客户需求澄清问答单流程` → `Demo - 客户需求澄清问答单`
  - `需求规格与概要设计 Agent 流程` → `Demo - 需求规格与概要设计`
  - `技术选型与 PoC 结论 Agent 流程` → `Demo - 技术选型与 PoC 结论`
  - `故障复盘与改进项流程` → `Demo - 故障复盘与改进项`
  - `实施交付与验收策划 Agent 流程` → `Demo - 实施交付与验收策划`
  - `项目周报与风险追踪流程` → `Demo - 项目周报与风险追踪`
  - `软硬件采购比选与推荐 Agent 流程` → `Demo - 软硬件采购比选与推荐`
  - `会议纪要→行动项流程` → `Demo - 会议纪要与行动项`

## Page Paths
- Login: `/login`
- Project list: `/projects`
- Project home: `/projects/:id`
- Document workspace: `/documents/:documentId`

## Interaction Strategy
- Work one document at a time.
- Use Playwright MCP to observe the actual rendered UI before clicking.
- After every major action:
  - wait for the page to stabilize
  - confirm the current node/status visually or via page text
  - record failures immediately instead of blindly continuing

## Step-by-Step Plan

### 1. Login
- Open `/login`.
- If enterprise WeCom login UI is shown, use the password-login toggle.
- Fill username and password.
- Submit and wait until URL no longer contains `/login`.
- Verify authenticated state by checking the left nav or landing page.

### 2. Create Or Reuse Demo Project
- Open `/projects`.
- Search for `内部展示 Demo 项目`.
- If it exists, open it.
- If not:
  - create a new project
  - fill name, description, department as above
  - open the created project page

### 3. Create Documents
- On the project page, use `新建文档`.
- For each target workflow:
  - choose the correct document type
  - choose the workflow
  - set the mapped title above
  - set a short description like `自动创建，用于展示流程：<workflow name>`
  - create the document
- After creation, open the new document workspace.

### 4. Fill Input Nodes
- Each workflow starts with `输入转换`.
- For all non-file fields:
  - fill realistic internal demo content based on field label
  - do not leave required fields empty
  - keep content plausible and concise
- For file fields:
  - leave empty unless the page hard-requires upload
  - if upload is required, create a tiny local `.md` or `.txt` temp file during the session and upload it
- Prefer these demo values when labels match:
  - project/product name: `智慧园区综合平台建设`
  - customer name: `华东制造集团`
  - business goal / requirement summary: describe unified platform, device integration, better delivery and operations
  - current environment: describe scattered legacy systems and inconsistent interfaces
  - constraints: budget control, compatibility,国产化, short schedule
  - dates: use near-future valid dates
  - numeric fields: use small realistic integers
  - select/multiselect: choose the first sensible option or first 1-2 options
- Confirm the input node.

### 5. Drive Generation
- After input is confirmed, trigger background generation from the workspace.
- The pipeline will likely pause on interactive nodes.
- When paused on `model_call`:
  - review that content exists
  - click the primary confirm / continue action
- When paused on `restore`:
  - execute restore if the page exposes an explicit action
  - confirm restore
  - continue
- When paused on `export`:
  - generate `Word` first
  - after file generation succeeds, confirm / continue so the document can finish

### 6. Success Criterion Per Document
- Target state:
  - document status becomes `completed`, or
  - all nodes show `completed` / `skipped`, including export
- If a workflow blocks export due to `qa_gate`, that is not success for this task. Adjust upstream inputs if feasible and retry once.

## Workflow-Specific Notes
- `招投标通用生成流程`
  - If it asks for bid/tender context, fill enough company and project data to avoid empty outputs.
- `解决方案建议书 Agent 流程`
  - Competitor material is optional; if left empty, the differentiator node may auto-skip.
- `实施交付与验收策划 Agent 流程`
  - `delivery_mode=remote` and `hardware_installation=no` may skip the onsite node.
- `软硬件采购比选与推荐 Agent 流程`
  - Clarification node may auto-skip if upstream says no clarification needed.

## Failure Handling
- If any document fails:
  - capture the failing node label and visible error text
  - take a screenshot
  - retry only once if the failure looks transient
- If login fails:
  - stop and ask user to re-confirm credentials
- If Playwright MCP becomes unstable:
  - stop and report exactly which action failed; do not switch back to a long blind script

## Final Deliverable For The Reopened Session
- Report:
  - project id/name used
  - all 10 documents created
  - per document: completed / failed / blocked
  - screenshots or notes for any remaining failures
