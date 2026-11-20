# Start Here

> First file for humans and agents on **Cursor Remote Lite**. Word list: [`help/GLOSSARY.md`](help/GLOSSARY.md) — [**AGENT**](help/GLOSSARY.md) / [**HUMAN**](help/GLOSSARY.md) / [**ADB**](help/GLOSSARY.md) / [**AUTO**](help/GLOSSARY.md).

## What this repo is

Phone/tablet remote for **desktop Cursor** (MIT, self-hosted). Node relay + CDP, GitHub Pages UI (`app/`), Android WebView (`android/`), Windows tray EXE/MSI, Linux packages.

- **Bootstrap child** of [agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap) (`1.13.1`) — ops surface only; not a multi-stack template farm.
- **App upstream (READ-only):** [Suchenl/cursor-remote-lite](https://github.com/Suchenl/cursor-remote-lite).
- **Gaps / board:** [`GAP_LIST.md`](GAP_LIST.md) · [`BUILD_PLAN.md`](../BUILD_PLAN.md) · Argus: [`ARGUS_REMOTE.md`](ARGUS_REMOTE.md).

## Three commands

| Need | Cursor | Elsewhere |
|------|--------|-----------|
| First run | `/tour` | [`help/TOUR.md`](help/TOUR.md) |
| What next | `/coach` | [`help/COACH.md`](help/COACH.md) |
| Ship / verify | `/verify` then `/ship` | `npm test` · [`help/BATCH_COMMANDS.md`](help/BATCH_COMMANDS.md) |

Cheat sheet: [`help/BATCH_COMMANDS.md`](help/BATCH_COMMANDS.md). Cursor modes: [`CURSOR_MODES.md`](CURSOR_MODES.md).

On session start: name the next 🔲 `[AGENT]` row on `BUILD_PLAN.md`; skim CHANGELOG `[Unreleased]` (first ~20 lines).

## Read order

1. `README.md` → this file → `AGENTS.md`
2. `BUILD_PLAN.md` Sequential · `docs/GAP_LIST.md` (**B** template / **C** product / **D** Argus)
3. Pair + host: README “Install” · tray EXE or `npm run public` · `npm run pair`
4. UI work → `app/` · Android → `android/` · packaging → `packaging/`

Session checklist: [`help/SESSION_START.md`](help/SESSION_START.md).

## First-time path (5 minutes)

1. Install **Node 22+**, open this repo, `npm install` · `npm test`.
2. Prefer **CursorRemote.exe / MSI** (system tray) or `npm run public` for a foreground relay + tunnel.
3. Pair: `npm run pair` (QR / deep link) or tray → Pair over ADB when a device is connected.
4. On tablet/phone: open **Chat | Dual pane | Files | Screen**; confirm finish alerts / OpenShouter if you use them.
5. Type `/tour` in Cursor Agent (or read [`help/TOUR.md`](help/TOUR.md)).

Never commit `.env` or pairing secrets. Device tokens stay hashed under `~/.cursor-remote-lite`.

## Agent day-to-day

| Command | When |
|---------|------|
| `/coach` | Next BUILD_PLAN row |
| `/build` | Implement next open `[AGENT]` row |
| `/verify` | Before PR / release |
| `/cleanup` | Archive ✅ rows; sync GAP_LIST Status |
| `/upgrade` | Plan parent-template gaps only |

Gates: `npm test` · `python scripts/agent-run.py validate-bootstrap` · `npm run health`.
