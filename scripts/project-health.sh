#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "=== cursor-remote-lite health ==="
echo "template: $(tr -d '\r\n' < .template-version)"
echo "version:  $(node -p "require('./package.json').version")"
open=$(grep -cE '^- 🔲 ' BUILD_PLAN.md || true)
done=$(grep -cE '^- ✅ ' BUILD_PLAN.md || true)
echo "BUILD_PLAN open=$open done=$done"
bash scripts/validate-bootstrap.sh --quick
echo "project-health: OK"
