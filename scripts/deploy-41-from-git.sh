#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BRANCH="${1:-$(git -C "$ROOT_DIR" branch --show-current)}"
if [[ -z "$BRANCH" ]]; then
  echo "Unable to determine branch name." >&2
  exit 1
fi

REMOTE_HOST="${REMOTE_HOST:-10.10.9.41}"
REMOTE_USER="${REMOTE_USER:-u}"
REMOTE_PATH="${REMOTE_PATH:-/home/u/intelliflow-docs}"
SSH_PASSWORD="${SSH_PASSWORD- }"
EXPECTED_HEAD="$(git -C "$ROOT_DIR" rev-parse HEAD)"
BUN_BIN="${BUN_BIN:-/home/u/.bun/bin/bun}"

echo "==> Deploying branch '$BRANCH' to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
echo "==> Expected remote head: $EXPECTED_HEAD"

sshpass -p "$SSH_PASSWORD" ssh \
  -o StrictHostKeyChecking=no \
  "${REMOTE_USER}@${REMOTE_HOST}" \
  bash -s -- "$REMOTE_PATH" "$BRANCH" "$EXPECTED_HEAD" "$BUN_BIN" <<'REMOTE_EOF'
set -euo pipefail

REPO_PATH="$1"
BRANCH="$2"
EXPECTED_HEAD="$3"
BUN_BIN="$4"

cd "$REPO_PATH"

before_head="$(git rev-parse HEAD)"
current_branch="$(git branch --show-current || true)"

if [[ "$current_branch" != "$BRANCH" ]]; then
  git checkout "$BRANCH"
fi

git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

after_head="$(git rev-parse HEAD)"

echo "==> Remote branch: $BRANCH"
echo "==> Remote before: $before_head"
echo "==> Remote after:  $after_head"

if [[ "$after_head" != "$EXPECTED_HEAD" ]]; then
  echo "Remote HEAD does not match expected pushed commit." >&2
  exit 1
fi

changed_files="$(git diff --name-only "$before_head" "$after_head" || true)"

echo "==> Changed files"
if [[ -n "$changed_files" ]]; then
  printf '%s\n' "$changed_files"
else
  echo "(none)"
fi

needs_install=0
needs_db=0
needs_frontend=0
needs_backend_restart=0
needs_systemd_reload=0

if printf '%s\n' "$changed_files" | grep -Eq '^(package\.json|bun\.lock|packages/backend/package\.json|packages/frontend/package\.json)$'; then
  needs_install=1
fi

if printf '%s\n' "$changed_files" | grep -Eq '^(packages/backend/drizzle/|packages/backend/src/db/|packages/backend/drizzle\.config\.ts|packages/backend/src/scripts/migrate-)'; then
  needs_db=1
fi

if printf '%s\n' "$changed_files" | grep -Eq '^(packages/frontend/|packages/shared/|package\.json|bun\.lock|packages/frontend/package\.json)'; then
  needs_frontend=1
fi

if printf '%s\n' "$changed_files" | grep -Eq '^(packages/backend/|packages/shared/|package\.json|bun\.lock|packages/backend/package\.json)'; then
  needs_backend_restart=1
fi

if printf '%s\n' "$changed_files" | grep -Eq '^ops/systemd/intelliflow-backend\.service$'; then
  needs_systemd_reload=1
  needs_backend_restart=1
fi

echo "==> Planned remote actions"
echo "install=$needs_install db_push=$needs_db frontend_build=$needs_frontend backend_restart=$needs_backend_restart systemd_reload=$needs_systemd_reload"

if [[ "$needs_install" -eq 1 ]]; then
  echo "==> Running bun install --frozen-lockfile"
  "$BUN_BIN" install --frozen-lockfile
fi

if [[ "$needs_db" -eq 1 ]]; then
  echo "==> Running backend db:push"
  "$BUN_BIN" run --filter @intelliflow/backend db:push
fi

if [[ "$needs_frontend" -eq 1 ]]; then
  echo "==> Building frontend with Node"
  cd "$REPO_PATH/packages/frontend"
  /home/u/.nvm/versions/node/v20.12.2/bin/node node_modules/vite/bin/vite.js build
  cd "$REPO_PATH"
fi

if [[ "$needs_systemd_reload" -eq 1 ]]; then
  echo "==> Reloading systemd unit from repo source"
  printf ' \n' | sudo -S cp ops/systemd/intelliflow-backend.service /etc/systemd/system/intelliflow-backend.service
  printf ' \n' | sudo -S systemctl daemon-reload
fi

if [[ "$needs_backend_restart" -eq 1 ]]; then
  echo "==> Restarting backend service"
  printf ' \n' | sudo -S systemctl restart intelliflow-backend
else
  echo "==> Skipping backend restart"
fi

echo "==> Backend service status"
printf ' \n' | sudo -S systemctl status intelliflow-backend --no-pager

echo "==> Health check"
curl -sf http://127.0.0.1:14001/api/health
REMOTE_EOF
