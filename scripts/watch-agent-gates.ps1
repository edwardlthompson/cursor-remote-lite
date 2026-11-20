# Minimal gate watcher for /build until full parent farm lands (GAP T2/T6).
param(
  [switch]$Once,
  [switch]$Autofix,
  [string]$Scope = 'auto'
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
Write-Host "watch-agent-gates once=$Once scope=$Scope (child: npm test + validate-bootstrap --quick)"
& (Join-Path $PSScriptRoot 'validate-bootstrap.ps1') -Quick
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm test
exit $LASTEXITCODE
