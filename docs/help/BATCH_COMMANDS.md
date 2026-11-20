# Agent shortcuts (cheat sheet)

Type **`/`** in Cursor Agent chat for this repo (`cursor-remote-lite`).

Child of [agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap) (`1.13.1`). Gap list: [`docs/GAP_LIST.md`](../GAP_LIST.md). Live board: [`BUILD_PLAN.md`](../../BUILD_PLAN.md). Argus: [`docs/ARGUS_REMOTE.md`](../ARGUS_REMOTE.md).

Full parent command catalog also lives under `.cursor/commands/` (synced from the template). Agent registry: [`docs/BATCH_COMMANDS.md`](../BATCH_COMMANDS.md).

## Try these first

| Command | When to use |
|---------|-------------|
| `/bootstrap` | Confirm bootstrap-child + Argus lineage |
| `/tour` | First-run: pair device, Chat/Dual/Files/Screen, tray relay |
| `/coach` | Next action from BUILD_PLAN + health |
| `/verify` | Before PR/release: `npm test`, skim CHANGELOG |
| `/build` | Work the next open `[AGENT]` row on BUILD_PLAN |
| `/ship` | Commit (if asked), tag, GitHub Release all platforms |
| `/cleanup` | Archive ✅ BUILD_PLAN rows → `COMPLETED_TASKS.md`; **update GAP_LIST B/C/D** |
| `/ideas` | Rank next features from GAP_LIST (do not implement until you say so) |
| `/upgrade` | Plan parent-template gaps (GAP_LIST **B**); apply only named items |

## Building

| Command | Does |
|---------|------|
| `/feature` | Implement one BUILD_PLAN row end-to-end |
| `/fix` | Diagnose relay / APK / Pages / pairing |
| `/docs` | README, GAP_LIST, CHANGELOG |
| `/status` | Board + git + Argus remote status |
| `/ci` | CI / workflow triage |

## Template / Argus (parent recipes)

| Command | Does |
|---------|------|
| `/upgrade` | Compare to agent-project-bootstrap; plan only |
| `/gates` | Run available gate scripts when present |
| `/dependabot` | Dependabot PR triage |
| `/update-deps` | Dependency update pass |

## Devices

| Command | Does |
|---------|------|
| Pair now | `node adb-pair.mjs` from `%LOCALAPPDATA%\CursorRemoteLite` |
| Install APK | `adb install -r` latest `CursorRemote.apk` from GitHub Releases |

## Before you publish

`/ship` pushes tags and runs `.github/workflows/release.yml` (EXE, MSI, deb, APK, VSIX). Only when you intend to publish.

## Gap list discipline

BUILD_PLAN rows that encode GAP_LIST **B** (template), **C** (product), or **D** (Argus) must flip the matching gap **Status** when the board row goes ✅.
