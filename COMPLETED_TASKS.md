# Completed tasks

Archived from `BUILD_PLAN.md` via `/cleanup`. Newest sections first.

## Parked leftovers unparked (2026-11-19)

- ✅ [AGENT] **T4** Product `PARALLEL_AGENT_SCOPES.md` + `npm run sprint-status` (`scripts/build-sprint-status.mjs`)
- ✅ [AGENT] **T7** `docs/RELEASE_SUPPLY_CHAIN.md` — keep custom `release.yml`; Release Please/SBOM deferred by design
- ✅ [AGENT] **P4** OVSX publish job on Release workflow (skips when `OVSX_PAT` unset) + EXTENSION.md
- ✅ [AGENT] **P5** `docs/en/ui-tablet-dualpane.gif` wired into README (PNG still linked)

## Sprint 2 — Template / product / Argus gaps (2026-11-19)

Bootstrap child catch-up to parent `1.13.1` + product polish. (Parked T4/T7/P4/P5 closed in a later section above.)

### B — Template

- ✅ [AGENT] **T0** Argus core + lineage markers (`argus.*`, rules manifest, AGENTS.md, SECURITY.md, board lanes)
- ✅ [AGENT] **T3a** Slash commands — sync `.cursor/commands/` + `docs/help/*` + cheat sheet from parent
- ✅ [AGENT] **T1** Full `scripts/agent-run.py` gate suite + `validate-bootstrap.sh` (keep `npm test` as primary)
- ✅ [AGENT] **T2** Weekly health / Dependabot automerge / Scorecard / CodeQL workflows (cherry-pick; keep existing `android.yml` + `release.yml`)
- ✅ [AGENT] **T3b** Finish help tree — wire `docs/START_HERE.md` / `FIRST_30_DAYS.md` to this product (not template examples)
- ✅ [AGENT] **T5** Install `sync-template-gaps-build-plan` / `sync-open-prs-build-plan` Monday cron
- ✅ [AGENT] **T6** Pre-commit / gitleaks / dependency-review

### C — Product

- ✅ [AGENT] **P1–P3** Dual pane editors / picker / multi-tab (Sprint 1)
- ✅ [AGENT] **P9** **Windows without a console** — tray `WinExe` + `win:hidden`; FreeConsole after extract; cloudflared `windowsHide`
- ✅ [AGENT] **P6** Document APK keystore backup (`docs/APK_KEYSTORE.md`)
- ✅ [AGENT] **P7** Prune stale `devices.json` after re-pairs (`devices prune` + startup)
- ✅ [AGENT] **P8** **Remote Windows + Linux control app** — architecture plan (`docs/REMOTE_DESKTOP_APP_PLAN.md`)

### D — Argus Runner

- ✅ [AGENT] **D1**–**D8** Lineage, contract v2, remote off-switch, rules manifest, board lanes, CI stubs, fleet shipping canary, parent pin `1.13.1`

## Sprint 1 — Dual pane = Cursor editors (2026-11-19)

Goal: **Chat | Dual pane | Files | Screen** — max space for chat/files; editors synced both ways.

- ✅ [AGENT] CDP helpers + WS: editors / focus / close / open / suggest
- ✅ [AGENT] Dual pane UI: tab strip, Open… typeahead, active-tab preview; phone↔Cursor sync
- ✅ [AGENT] Tablet density: hide window-status strip + quick-prompt chips; draggable dual divider; **Files** full-pane tab
- ✅ [AGENT] v1.9.2 — notify permission + SSE restart; composer drafts per window; UI 23
- ✅ [AGENT] v1.9.3 — usage bar + silent-channel reset (`*_v3`)
- ✅ [AGENT] v1.9.4 — Agent alerts timestamped for OpenShouter; listen FGS stays quiet/ongoing

### Ship criteria (met)

- [x] Open editors in Cursor appear as tabs in Dual/Files within ~2s
- [x] Tapping a tab focuses that editor in Cursor and shows preview
- [x] Closing a tab on mobile closes it in Cursor; closing in Cursor removes it on mobile
- [x] Open… suggests workspace files as you type; Open still uses Quick Open
- [x] `npm test` green

### Follow-on shipped same day (not separate BUILD_PLAN rows)

- v1.9.5 — local test alerts + SSE reconnect replay
- v1.9.6 — DND-safe `*_v4` alert channels
- v1.9.7 — modern “Stop generation” busy detection; Agent-finished over WS
- UI 26–28 — Markdown Preview fixes for `BUILD_PLAN.md` (comments, relative links, task lists, `pre-wrap`)
- UI 29 — single compact Stop on the “Agent is running” row (hide duplicate actionBar Stop)
- UI 30 — bust stuck WebView SW shells after Pages clobber

### HUMAN QA (confirmed 2026-11-19)

- ✅ [HUMAN] Allow notifications; test notification; OpenShouter / shade shouts **Agent finished** on prompt completion
