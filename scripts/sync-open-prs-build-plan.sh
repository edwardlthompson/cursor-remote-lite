#!/usr/bin/env bash
# Sync open Dependabot / release PRs into BUILD_PLAN.md managed block.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/lib/sync_open_prs_build_plan.py" --root "$ROOT" "$@"
