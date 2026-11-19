# Gap list

Child of **[agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap)** (template `.template-version` = `1.13.1`).  
Upstream app fork: **[Suchenl/cursor-remote-lite](https://github.com/Suchenl/cursor-remote-lite)** (READ-only).

## A. Fork vs Suchenl upstream (shipped here)

| Area | Upstream | This fork |
|------|----------|-----------|
| License / monetization | MIT | MIT, no donate / license wall |
| Windows packaging | Manual Node | **Tray EXE + MSI**, Start with Windows, keep-awake, ADB pair |
| Linux packaging | Manual | **deb + tar.gz** |
| Android | APK | APK + **heads-up finish/wait sound**, in-app GitHub update, Back doesn’t kill |
| Dual pane | Phone layout | **Chat \| Dual pane \| Files \| Screen**; draggable split; no status strip / chips |
| Diffs | Preview / Keep-Undo | **Unified git diff** sheet + inline pane diffs |
| Clipboard | — | **Push / pull** phone ↔ Cursor |
| Multi-device | Shared session | **Per-window control lock** + Take control |
| Notifications | Basic / SSE | Done always notifies; Continue / Reply / Approve actions; Telegram forum topics |
| Docs / agent ops | README | **BUILD_PLAN**, slash commands, this gap list (bootstrap child) |

## B. Template gaps (bootstrap parent)

Plan-only until `/upgrade` from the parent template. Tracked on `BUILD_PLAN.md` under **Template gaps**.

| # | Gap | Notes |
|---|-----|--------|
| T1 | Full `scripts/agent-run.py` gate suite | Parent has smoke/watch; this repo uses `npm test` today |
| T2 | Weekly health / Dependabot automerge docs | Optional for a small Node relay |
| T3 | FIRST_30_DAYS / AGENT_MEMORY | Add when onboarding contributors |
| T4 | Parallel agent scopes | Not needed until multi-agent sprints |

## C. Product gaps (next work)

| # | Gap | Status |
|---|-----|--------|
| P1 | **Editor tabs in Dual pane** — bidirectional tab + content sync; Open… typeahead | Sprint 1 (shipped; HUMAN QA) |
| P2 | **File picker** — open BUILD_PLAN / Simple Browser / any workspace file via Quick Open | Sprint 1 |
| P3 | Multi-tab strip UI when several editors open | Sprint 1 |
| P4 | OVSX publish automation | Parked (needs `OVSX_PAT`) |
| P5 | Live tablet dual-pane README GIF | Screenshot landed; GIF optional |
| P6 | Persistent APK signing already done; document keystore backup | Docs |
| P7 | Prune stale `devices.json` entries after re-pairs | Nice-to-have |
| P8 | **Remote Windows + Linux app** — plan Electron/Tauri/native client to control Cursor on a laptop via relay/CDP (parity with Dual/Files) | Backlog on BUILD_PLAN |

## D. Explicit non-goals (for now)

Auto-approve policies, Wear OS, iOS TestFlight, guest share links, rewriting Cursor’s Agents UI.
