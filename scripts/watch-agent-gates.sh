#!/usr/bin/env bash
# Minimal gate watcher for /build until full parent farm lands (GAP T2/T6).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "watch-agent-gates (child: validate-bootstrap --quick + npm test)"
bash scripts/validate-bootstrap.sh --quick
npm test
