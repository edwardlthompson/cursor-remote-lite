param([switch]$Json)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$argsList = @("$Root\scripts\build-sprint-status.mjs")
if ($Json) { $argsList += "--json" }
& node @argsList
exit $LASTEXITCODE
