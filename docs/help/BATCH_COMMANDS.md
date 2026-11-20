# Agent shortcuts (cheat sheet)

Type **`/`** in Cursor Agent chat for this repo (`cursor-remote-lite`).

Child of [agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap). Gap list: [`docs/GAP_LIST.md`](../GAP_LIST.md). Live board: [`BUILD_PLAN.md`](../../BUILD_PLAN.md).

## Try these first

| Command | When to use |
|---------|-------------|
| `/bootstrap` | Confirm bootstrap-child layout (BUILD_PLAN, gaps, commands) |
| `/tour` | First-run: pair device, open Chat/Files/Screen, tray relay |
| `/coach` | What to do next from BUILD_PLAN + health |
| `/verify` | Before PR/release: `npm test`, skim CHANGELOG |
| `/build` | Work the next open `[AGENT]` row on BUILD_PLAN |
| `/ship` | Commit (if asked), tag, GitHub Release all platforms |
| `/cleanup` | Archive finished ✅ BUILD_PLAN rows → `COMPLETED_TASKS.md`; slim the live board |
| `/ideas` | Rank next features from GAP_LIST (do not implement until you say so) |

## Building

| Command | Does |
|---------|------|
| `/feature` | Implement one BUILD_PLAN row end-to-end |
| `/fix` | Diagnose relay / APK / Pages / pairing |
| `/docs` | README, GAP_LIST, CHANGELOG, Architecture |

## Devices

| Command | Does |
|---------|------|
| Pair now | `node adb-pair.mjs` from `%LOCALAPPDATA%\CursorRemoteLite` with devices on USB |
| Install APK | `adb install -r` latest `CursorRemote.apk` from GitHub Releases |

## Before you publish

`/ship` pushes tags and runs `.github/workflows/release.yml` (EXE, MSI, deb, APK, VSIX). Only when you intend to publish.
