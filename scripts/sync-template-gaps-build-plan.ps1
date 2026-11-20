# Sync GAP_LIST section B open rows into BUILD_PLAN.md managed block.
param(
  [switch]$Apply,
  [switch]$Check
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { throw "python not found" }
$argsList = @("$Root\scripts\lib\sync_template_gaps_build_plan.py", "--root", $Root)
if ($Apply) { $argsList += "--apply" }
if ($Check) { $argsList += "--check" }
& $py.Source @argsList
exit $LASTEXITCODE
