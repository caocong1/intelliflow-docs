---
description: Commit the current IntelliFlow changes in logical batches, push the active branch, and deploy that branch to 10.10.9.41.
---

# /update-41

Use this command when the user wants the current IntelliFlow branch committed and deployed to the `10.10.9.41` environment.

## Preflight

1. Read `.agents/skills/update-41/SKILL.md`.
2. Read `docs/ops/41-service-management.md`.
3. Confirm the current working directory is the IntelliFlow repo root.
4. Run these checks first:
   - `git branch --show-current`
   - `git status --short`
   - `git status --porcelain --untracked-files=all`
5. If the repo is in detached HEAD, stop and ask.
6. If there are conflict markers, stop and ask.
7. If there are no local changes and the branch is not ahead of origin, say there is nothing to deploy and stop.

## Plan

Before doing any write operation, produce a short plan that includes:

- the current branch
- the commit batches you intend to create
- the verification you will run for each batch
- the final deploy step: `scripts/deploy-41-from-git.sh <branch>`

Proceed automatically unless commit grouping is too ambiguous to do safely.

## Commands

Execute the workflow from `.agents/skills/update-41/SKILL.md`.

Operational requirements:

1. Build commit batches from the current diff.
2. For each batch:
   - stage only that batch's files
   - run the smallest meaningful verification
   - commit with a concise, content-based message
3. Push the active branch to `origin`.
4. Run:

```bash
scripts/deploy-41-from-git.sh "$(git branch --show-current)"
```

5. Do not use `git add .`.
6. Do not use `rsync` for this command.
7. If the push fails or the remote deploy script fails, stop and surface the failing step.

## Verification

After execution:

1. List the commits created in this run with `git log --oneline --max-count=<n>`.
2. Confirm the local branch is pushed:
   - `git status -sb`
3. Confirm the remote repo pulled the expected head:
   - rely on `scripts/deploy-41-from-git.sh` output
4. Confirm service health from the deploy script output:
   - `systemctl status intelliflow-backend`
   - `curl http://127.0.0.1:14001/api/health`

## Summary

Present:

## Result
- **Action**: committed and deployed current branch to 41
- **Status**: success | partial | failed
- **Branch**: current branch name
- **Commits**: the commit subjects created in this run
- **Remote**: which of install / db push / frontend build / backend restart actually ran
- **Health**: final `/api/health` result

## Next Steps

- If deployment succeeded, mention the app is updated on `10.10.9.41`.
- If a step failed, say exactly what to inspect next.
- If command discovery does not work in the current Codex session, tell the user to reopen the session after installing the command link.
