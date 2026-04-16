# /deploy-41

Commit current changes, push, and deploy the active branch to `10.10.9.41`.

## Preflight

1. Confirm cwd is the IntelliFlow repo root.
2. Run:
   - `git branch --show-current`
   - `git status --short`
3. If detached HEAD or conflict markers, stop and ask.
4. If no local changes and branch is not ahead of origin, say nothing to deploy and stop.

## Plan

Before writing, produce a short plan:
- Current branch
- Commit batches to create (group by concern, not folder)
- Verification per batch
- Final deploy: `scripts/deploy-41-from-git.sh <branch>`

Proceed automatically unless commit grouping is ambiguous.

## Commit rules

- Never `git add .` — stage only batch files
- Keep tests with the code they validate
- Shared package changes go with the dependent batch
- Common groups:
  - `packages/backend/**` + backend tests
  - `packages/frontend/**` + frontend tests
  - `packages/shared/**` with dependent batch
  - DB/schema: `packages/backend/src/db/**`, `drizzle/**`
  - Ops: `docs/ops/**`, `ops/systemd/**`, deploy scripts

## Verification per batch

- Backend: `bunx vitest run <touched-test-files>`
- Frontend: `bunx vite build` if UI files changed
- DB: ensure schema files committed together

## Deploy

```bash
scripts/deploy-41-from-git.sh "$(git branch --show-current)"
```

Do NOT use rsync. The script handles: git pull, bun install, db:push, frontend build, backend restart, health check.

## Report

Present after completion:

- **Branch**: name
- **Commits**: subjects created
- **Push**: success/failed
- **Remote actions**: install / db push / frontend build / backend restart
- **Health**: `/api/health` result
- **Issues**: any skipped steps and why
