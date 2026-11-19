# One-shot Windows bootstrap for Cursor Remote Lite.
# Checks Node / cloudflared / gh, installs npm deps, runs non-interactive setup, then prints next steps.
# Usage (from an external PowerShell window, not Cursor's terminal):
#   powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
param(
  [string]$Repo = 'cursor-remote-app',
  [switch]$SkipPages,
  [switch]$SkipSleepHints
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Test-Cmd($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host ''
Write-Host '== Cursor Remote Lite Windows bootstrap =='
Write-Host ''

if (-not (Test-Cmd 'node')) {
  Write-Host 'Node.js is required (22+). Install from https://nodejs.org/ then re-run this script.'
  exit 1
}
$nodeMajor = [int]((node -v) -replace '^v','' -split '\.')[0]
if ($nodeMajor -lt 22) {
  Write-Host "Node.js 22+ required (found $(node -v))."
  exit 1
}
Write-Host "Node $(node -v) OK"

if (-not (Test-Cmd 'cloudflared')) {
  if (Test-Cmd 'winget') {
    Write-Host 'Installing cloudflared via winget...'
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  } else {
    Write-Host 'cloudflared missing. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
    exit 1
  }
}
if (-not (Test-Cmd 'gh')) {
  if (Test-Cmd 'winget') {
    Write-Host 'Installing GitHub CLI via winget...'
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
  } else {
    Write-Host 'GitHub CLI (gh) missing. Install: https://cli.github.com/'
    exit 1
  }
}

# Refresh PATH for newly installed tools in this session
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

if (-not (Test-Cmd 'cloudflared')) { Write-Host 'cloudflared still not on PATH. Open a new terminal and re-run.'; exit 1 }
if (-not (Test-Cmd 'gh')) { Write-Host 'gh still not on PATH. Open a new terminal and re-run.'; exit 1 }
Write-Host "cloudflared $(cloudflared --version 2>&1 | Select-Object -First 1) OK"
Write-Host "gh $((gh --version | Select-Object -First 1)) OK"

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'GitHub CLI is not logged in. Running gh auth login...'
  gh auth login
  if ($LASTEXITCODE -ne 0) { Write-Host 'GitHub login failed.'; exit 1 }
}

Write-Host ''
Write-Host 'Installing npm dependencies...'
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
$setupArgs = @('--yes', '--repo', $Repo)
if ($SkipPages) { $setupArgs += '--no-pages' }
node setup.mjs @setupArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipSleepHints) {
  Write-Host ''
  Write-Host 'Recommended (prevent sleep while plugged in):'
  Write-Host '  powercfg /change standby-timeout-ac 0'
  Write-Host '  powercfg /change monitor-timeout-ac 10'
  Write-Host '  powercfg /change hibernate-timeout-ac 0'
  Write-Host 'Run those in an Administrator PowerShell if you want the phone to stay connected.'
}

Write-Host ''
Write-Host 'Starting Cursor with the debugging port…'
powershell -ExecutionPolicy Bypass -File .\start-cursor.ps1

Write-Host ''
Write-Host 'Starting public relay in a new window…'
Start-Process powershell -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', "Set-Location '$PSScriptRoot'; npm run public")

Start-Sleep -Seconds 4

Write-Host ''
Write-Host 'Trying automatic phone pairing over ADB (install APK if present + open deep link)…'
node .\adb-pair.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Host 'ADB auto-pair skipped or failed. Manual path:'
  Write-Host '  npm run pair'
  Write-Host '  (or put CursorRemote.apk next to this folder, connect a phone with USB debugging, and re-run: npm run adb-pair)'
}

Write-Host ''
Write-Host 'Relay window should stay open. Re-pair anytime with: npm run pair   or   npm run adb-pair'
Write-Host ''
