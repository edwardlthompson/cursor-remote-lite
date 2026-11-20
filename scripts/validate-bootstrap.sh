#!/usr/bin/env bash
# Child-scoped bootstrap validation for cursor-remote-lite (not full parent farm).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

QUICK=false
for arg in "$@"; do
  case "$arg" in
    --quick|--agent) QUICK=true ;;
  esac
done

REQUIRED=(
  README.md LICENSE SECURITY.md BUILD_PLAN.md AGENTS.md COMPLETED_TASKS.md
  bootstrap.config.json .template-version .template-update.json TEMPLATE_INDEX.json
  docs/GAP_LIST.md docs/help/BATCH_COMMANDS.md docs/ARGUS_REMOTE.md docs/UPGRADING_FROM_TEMPLATE.md
  argus.contract.json argus.remote.json rules.manifest.json
  branding/brand.json branding/brand.schema.json branding/assets/app-icon-1024.png
  .goldenpath.json ux-baseline.json config/tokens.json
  package.json server.mjs app/index.html app/sw.js
  .cursor/commands/build.md .cursor/commands/tour.md .cursor/commands/cleanup.md
  scripts/agent-run.py scripts/lib/agent_run_env.py scripts/lib/argus_contract.py
)

missing=0
for rel in "${REQUIRED[@]}"; do
  if [[ ! -e "$rel" ]]; then
    echo "FAIL: missing $rel"
    missing=1
  fi
done
[[ "$missing" -eq 0 ]] || exit 1
echo "OK: ${#REQUIRED[@]} required paths present"

PY=python3
command -v python3 >/dev/null 2>&1 || PY=python
"$PY" -c '
import sys
from pathlib import Path
ROOT = Path(".").resolve()
sys.path.insert(0, str(ROOT / "scripts" / "lib"))
from argus_contract import check
from argus_remote import status
c = check(ROOT)
s = status(ROOT)
print("contract", c[0], c[1])
print("remote", s[0], s[1])
sys.exit(c[0] or s[0])
'
echo "OK: argus contract + remote status"

for m in remaining-tally open-prs-sync template-gaps-sync local-agent-lane cloud-agent-lane; do
  grep -q "$m" BUILD_PLAN.md || { echo "FAIL: BUILD_PLAN missing marker $m"; exit 1; }
done
echo "OK: BUILD_PLAN Argus markers"

if [[ "$QUICK" == true ]]; then
  echo "validate-bootstrap: quick OK"
  exit 0
fi

npm test
echo "validate-bootstrap: OK"
