#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (cloud containers); local dev sessions
# already have their own node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotent: npm install is a fast no-op when node_modules already matches
# the lockfile. --no-audit / --no-fund cut a few seconds off the cold path.
npm install --no-audit --no-fund
