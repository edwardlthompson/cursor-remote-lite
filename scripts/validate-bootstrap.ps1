# Child-scoped bootstrap validation for cursor-remote-lite (not full parent farm).
param(
  [switch]$Quick,
  [switch]$Agent
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if ($Agent) { $Quick = $true }

$required = @(
  'README.md', 'LICENSE', 'SECURITY.md', 'BUILD_PLAN.md', 'AGENTS.md', 'COMPLETED_TASKS.md',
  'bootstrap.config.json', '.template-version', '.template-update.json', 'TEMPLATE_INDEX.json',
  'docs/GAP_LIST.md', 'docs/help/BATCH_COMMANDS.md', 'docs/ARGUS_REMOTE.md', 'docs/UPGRADING_FROM_TEMPLATE.md',
  'argus.contract.json', 'argus.remote.json', 'rules.manifest.json',
  'branding/brand.json', 'branding/brand.schema.json', 'branding/assets/app-icon-1024.png',
  '.goldenpath.json', 'ux-baseline.json', 'config/tokens.json',
  'package.json', 'server.mjs', 'app/index.html', 'app/sw.js',
  '.cursor/commands/build.md', '.cursor/commands/tour.md', '.cursor/commands/cleanup.md',
  'scripts/agent-run.py', 'scripts/lib/agent_run_env.py', 'scripts/lib/argus_contract.py'
)

$missing = @()
foreach ($rel in $required) {
  if (-not (Test-Path (Join-Path $Root $rel))) { $missing += $rel }
}
if ($missing.Count) {
  Write-Host 'FAIL: missing required bootstrap artifacts:'
  $missing | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host "OK: $($required.Count) required paths present"

$py = 'C:\Python315\python.exe'
if (-not (Test-Path $py)) {
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) { $py = $cmd.Source }
}
if (-not (Test-Path $py)) {
  Write-Host 'WARN: Python not found; skip argus.contract check'
} else {
  $checkPy = Join-Path $env:TEMP 'cr-validate-argus.py'
  @"
import sys
from pathlib import Path
ROOT = Path(r'$Root')
sys.path.insert(0, str(ROOT / 'scripts' / 'lib'))
from argus_contract import check
from argus_remote import status
c = check(ROOT)
s = status(ROOT)
print('contract', c[0], c[1])
print('remote', s[0], s[1])
sys.exit(c[0] or s[0])
"@ | Set-Content -Path $checkPy -Encoding utf8
  & $py $checkPy
  $code = $LASTEXITCODE
  Remove-Item $checkPy -Force -ErrorAction SilentlyContinue
  if ($code -ne 0) { exit $code }
  Write-Host 'OK: argus contract + remote status'
}

$bp = Get-Content (Join-Path $Root 'BUILD_PLAN.md') -Raw
foreach ($m in @('remaining-tally','open-prs-sync','template-gaps-sync','local-agent-lane','cloud-agent-lane')) {
  if ($bp -notmatch [regex]::Escape($m)) {
    Write-Host "FAIL: BUILD_PLAN missing marker $m"
    exit 1
  }
}
Write-Host 'OK: BUILD_PLAN Argus markers'

if ($Quick) {
  Write-Host 'validate-bootstrap: quick OK'
  exit 0
}

Write-Host 'Running npm test…'
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'validate-bootstrap: OK'
exit 0
