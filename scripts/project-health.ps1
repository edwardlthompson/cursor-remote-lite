# Lightweight health for /coach (child — no parent gate farm).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '=== cursor-remote-lite health ==='
Write-Host ("template: " + (Get-Content .template-version -Raw).Trim())
Write-Host ("version:  " + (Get-Content package.json | ConvertFrom-Json).version)

$bp = Get-Content BUILD_PLAN.md -Raw
$open = ([regex]::Matches($bp, '(?m)^- 🔲 ')).Count
$done = ([regex]::Matches($bp, '(?m)^- ✅ ')).Count
Write-Host "BUILD_PLAN open=$open done=$done"

& (Join-Path $PSScriptRoot 'validate-bootstrap.ps1') -Quick
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'project-health: OK'
exit 0
