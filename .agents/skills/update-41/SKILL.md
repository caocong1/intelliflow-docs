---
name: update-41
description: Commit current IntelliFlow repo changes in coherent content-based batches, push the active branch, then deploy that branch to 10.10.9.41 by pulling latest code on the server and conditionally running dependency install, database push, frontend build, and backend restart. Use when the user says "更新41" or asks to deploy the current branch to the 41 environment.
---

# Update 41

Use this skill for IntelliFlow's `10.10.9.41` deployment workflow.

This workflow has two distinct parts:

1. Local git work:
   - inspect the current branch and working tree
   - group changes into coherent commit batches by concern
   - run the smallest practical verification for each batch
   - create commits and push the active branch
2. Remote deployment:
   - SSH to `u@10.10.9.41`
   - pull the pushed branch into `/home/u/intelliflow-docs`
   - based on the pulled diff, decide whether to run dependency install, `db:push`, frontend build, and backend restart
   - verify service health

## Required reads

- `docs/ops/41-service-management.md`
- `scripts/deploy-41-from-git.sh`

## Local commit rules

- Default target branch: the current local branch from `git branch --show-current`
- Never use `git add .`
- Stage only the files for the current commit batch
- Keep tests with the code they validate
- If one file mixes multiple concerns and cannot be split safely, keep it with the dominant batch and explain that choice
- If the diff is ambiguous enough that you might accidentally combine unrelated work, stop and ask

## Commit grouping heuristics

Prefer grouping by behavior, not just by top-level folder.

Common groups in this repo:

- `packages/backend/**` plus matching backend tests
- `packages/frontend/**` plus matching frontend tests
- `packages/shared/**` with whichever backend/frontend batch depends on the shared change
- database/schema work:
  - `packages/backend/src/db/**`
  - `packages/backend/drizzle/**`
  - `packages/backend/drizzle.config.ts`
  - migration scripts under `packages/backend/src/scripts/migrate-*`
- ops/deploy work:
  - `docs/ops/**`
  - `ops/systemd/**`
  - deploy helper scripts

If the working tree clearly contains multiple separable concerns, make multiple commits in sequence. If it is one cohesive feature spanning backend, frontend, and shared files, one larger commit is acceptable.

## Verification heuristics

Run the cheapest verification that meaningfully covers the batch:

- backend/runtime batch:
  - targeted `bunx vitest run ...` for touched runtime tests when obvious
  - fallback: relevant backend test file(s) or a narrow build/type check
- frontend/UI batch:
  - prefer `bunx vite build` when touched files affect runtime UI
  - targeted frontend tests if they already exist and run cleanly
- database batch:
  - ensure schema/drizzle files are committed together
  - mention that remote deploy may run `bun run --filter @intelliflow/backend db:push`

If a known repo-wide check is already broken and unrelated to the current batch, say so explicitly instead of pretending verification passed.

## Remote deploy rules

The canonical remote deploy helper is:

```bash
scripts/deploy-41-from-git.sh <branch>
```

That helper is responsible for:

- pulling latest branch state on `10.10.9.41`
- optionally running `bun install --frozen-lockfile` if package manifests changed
- optionally running `bun run --filter @intelliflow/backend db:push` if DB-related files changed
- optionally rebuilding frontend with Node, not Bun
- optionally restarting `intelliflow-backend.service`
- printing service status and `/api/health`

Do not replace this with `rsync` unless the user explicitly asks to bypass the git-based flow.

## Expected final report

Report:

- branch name
- commit list created in this run
- whether push succeeded
- remote actions actually executed
- backend service status
- `/api/health` result
- any skipped step and why
