#!/usr/bin/env bash
# Sync GAP_LIST section B open rows into BUILD_PLAN.md managed block.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/lib/sync_template_gaps_build_plan.py" --root "$ROOT" "$@"
