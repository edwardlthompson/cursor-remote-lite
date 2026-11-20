# Agent Router

1. **Live board:** `BUILD_PLAN.md` (Sequential before Parallel) — 🔲 open · ✅ done · ❌ blocked
2. **Gaps vs parent:** `docs/GAP_LIST.md` (sections **B/C/D** mirror the board) · slash recipes: `docs/help/BATCH_COMMANDS.md` · full catalog: `.cursor/commands/`
3. **Argus:** `argus.remote.json` (off by default) · `argus.contract.json` · `docs/ARGUS_REMOTE.md`
4. **Parent template:** [edwardlthompson/agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap) — pin in `.template-version` / `bootstrap.config.json`
5. **Gap discipline:** when a BUILD_PLAN row for B/C/D goes ✅, update that gap’s Status in `docs/GAP_LIST.md` the same turn (`/cleanup`)

> Legacy `.cursorrules` is deprecated. Use `.cursor/rules/*.mdc` and this file instead.

## Project Overview & Architecture

<!-- bootstrap-project-card -->
**Product:** Cursor Remote Lite
**Purpose:** Free MIT phone/tablet remote control for desktop Cursor (fork of Suchenl/cursor-remote-lite) with tray packaging, Dual pane editors, clipboard, multi-device lock, and OpenShouter-ready finish alerts
**Stack:** node
<!-- /bootstrap-project-card -->

This repository is a **bootstrap child** of `edwardlthompson/agent-project-bootstrap` (`distribution_tier: foss`). App upstream (READ-only): [Suchenl/cursor-remote-lite](https://github.com/Suchenl/cursor-remote-lite).

- **Relay:** Node (`server.mjs`) + CDP → Cursor; phone/tablet UI on GitHub Pages (`app/`)
- **Android:** WebView shell (`android/`) — no Google services required
- **Windows host:** tray EXE/MSI via packaging + `%LOCALAPPDATA%\CursorRemoteLite`
- **Agent ops:** `BUILD_PLAN.md`, `COMPLETED_TASKS.md`, `/tour` `/coach` `/verify` `/build` `/ship` `/cleanup` `/ideas`

## Environment & Dependency Management

| Tool | Role |
|------|------|
| Node.js 22+ | Relay, tests (`npm test`), Pages app |
| cloudflared | Public tunnel (`npm run public` / tray) |
| GitHub CLI (`gh`) | Pages setup / releases |
| Android SDK / adb | APK install + pair |
| Python 3.11+ | Argus scripts (`scripts/argus-remote.py`) when present |

Never commit `.env` or pairing secrets. Device tokens stay hashed under `~/.cursor-remote-lite`.

## Build, Test, and Validation Commands

```bash
npm install
npm test
npm run public          # relay + tunnel
npm run pair            # QR / deep link
python scripts/argus-remote.py status   # Argus remote (disabled by default)
```

Android release APKs: GitHub Actions `release.yml` / `android.yml`.

## Living memory

Archive finished board rows with `/cleanup` → `COMPLETED_TASKS.md`. Do not invent Sprint work until the user confirms `/ideas` or names a BUILD_PLAN row.
