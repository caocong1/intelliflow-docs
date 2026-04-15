#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_FILE="$ROOT_DIR/.agents/commands/update-41.md"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
COMMANDS_DIR="$CODEX_HOME/commands"
TARGET_FILE="$COMMANDS_DIR/update-41.md"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Source command file not found: $SOURCE_FILE" >&2
  exit 1
fi

mkdir -p "$COMMANDS_DIR"
ln -sfn "$SOURCE_FILE" "$TARGET_FILE"

echo "Installed /update-41 command:"
echo "  $TARGET_FILE -> $SOURCE_FILE"
