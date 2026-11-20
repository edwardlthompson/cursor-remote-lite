# Parallel Agent Scopes

> Isolated file scopes for Cursor Remote Lite when a sprint runs more than one AGENT at once.  
> No two agents may touch the same path prefix. Parent `examples/*` farm does **not** apply here.

## Rules

1. One branch per agent: `feature/agent-<task-slug>` (or `feature/local-<slug>` / Cloud `cursor/*`)
2. Orchestrator owns [`BUILD_PLAN.md`](../BUILD_PLAN.md) — parallel agents never edit it
3. Shared contracts (WS message shapes, `argus.contract.json`, pairing) stay **Sequential**
4. Forbidden for parallel agents: `BUILD_PLAN.md`, `COMPLETED_TASKS.md`, `docs/GAP_LIST.md` Status columns (orchestrator `/cleanup`)
5. Prefer native `/worktree` or `/best-of-n` for heavy installs; see [`.cursor/worktrees.json`](../.cursor/worktrees.json)

## Product scopes (defaults)

| Lane | Scope prefix | Notes |
|------|--------------|--------|
| Pages UI | `app/` | Phone/tablet shell, SW cache bumps |
| Android | `android/` | WebView, NotifyService, signing |
| Packaging | `packaging/` | Win tray, Linux deb, build scripts |
| Extension | `extension/` | VSIX / OVSX |
| Relay | `server.mjs`, `auth.mjs`, `notify.mjs`, `files.mjs`, `presence.mjs`, `headless.mjs`, `*.mjs` at repo root (except `setup.mjs` when Sequential) | CDP + HTTP |
| Docs / ops | `docs/`, `scripts/`, `.github/workflows/` | One agent at a time preferred |
| Tests | `test/` | May follow the lane under test |

Open LOCAL vs CLOUD rows must not prefix-overlap. Standing queues: **Local agent** / **Cloud agent** on the board.

## Status helper

```bash
npm run sprint-status          # human text
npm run sprint-status -- --json
```

Parses open `🔲 [AGENT]` rows on `BUILD_PLAN.md` (skips ⏸). Does **not** pull the parent `check-*.sh` farm.

## When to use parallel

Only when the board has two or more independent open AGENT rows with non-overlapping scopes. Otherwise stay Sequential (`/build` one row at a time).
