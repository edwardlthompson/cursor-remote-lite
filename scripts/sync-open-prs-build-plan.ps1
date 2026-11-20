# Sync open Dependabot / release PRs into BUILD_PLAN.md managed block.
param(
  [switch]$Apply,
  [switch]$Check,
  [string]$PrsJson = ""
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { throw "python not found" }
$argsList = @("$Root\scripts\lib\sync_open_prs_build_plan.py", "--root", $Root)
if ($Apply) { $argsList += "--apply" }
if ($Check) { $argsList += "--check" }
if ($PrsJson) { $argsList += @("--prs-json", $PrsJson) }
& $py.Source @argsList
exit $LASTEXITCODE
