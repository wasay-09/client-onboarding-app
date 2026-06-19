#!/usr/bin/env sh
# Auto-check when the agent finishes — only if .ts/.tsx files changed, so plain
# chat turns are untouched. Lint runs once at the repo root; typecheck is per-package.
if [ -z "$(git status --porcelain | grep -E '\.tsx?$')" ]; then
  exit 0
fi
pnpm lint && pnpm -r typecheck || exit 2   # exit 2 -> Claude is asked to fix before stopping
