# Completed tasks

Archived from `BUILD_PLAN.md` via `/cleanup`. Newest sections first.

## Local polish P11–P15 + Restart Cursor (2026-11-25)

- ✅ [AGENT][LOCAL] **P11** **Multi-bucket 5h / 7d color-changing concentric quota ring dock + expandable drawer** — concentric SVG rings + stacked bar drawer + DOM usage prober (chip → remaining; scrape multi-bucket when popover open) — UI 36
- ✅ [AGENT][LOCAL] **P12** **Finish ACTION `\b` + exclude tool/step pills** — `ACTION`/`WAIT` word boundaries + tool/step/revert `data-testid` exclusion in `buttonsIn()`; `"Running…"` no longer matches Run
- ✅ [AGENT][LOCAL] **P13** **Local read-only transcript fallback + 3 s live CDP auto-upgrade** — `transcript.mjs` mirrors `~/.cursor/projects/*/agent-transcripts`; amber `#liveBanner`; auto-upgrade when `:9222` opens (UI 37)
- ✅ [AGENT][LOCAL] **P14** **Detached `-Worker` IDE relauncher & Android 17 ADB deep-link quoting** — already in `start-cursor.ps1` (`-Worker`) and `adb-pair.mjs` (single-quoted VIEW URI)
- ✅ [AGENT][LOCAL] **P15** **Remove Screen view** — dropped Screen tab / `#screenView` / CDP screencast; Chat · Dual pane · Files only (UI 38)
- ✅ [AGENT][LOCAL] **Restart Cursor with debug port** — phone ⋯ menu + tray + `POST /api/cursor/launch` → `start-cursor.ps1`/`.sh` (UI 34)
- ✅ [AGENT][LOCAL] Review the USB/ADB pairing path against the PhoneBox GHSA-j6qc-pm3p-fhg7 pattern and document the result — **not affected** (no `adb reverse`; ADB is install + deep-link only; control uses tunnel + device token) → [`SECURITY.md`](SECURITY.md) (news P2, 2026-11-25)
- ✅ [AGENT][LOCAL] Audit the phone remote against Cursor 3.31 Agents Window / IDE UI changes — hardened sidebar/tab filters + locked-mode note; see [`docs/CURSOR_AGENTS_331.md`](docs/CURSOR_AGENTS_331.md) (news P2, 2026-11-25)
- ✅ [AGENT][LOCAL] **P10** **Android 15/16/17 edge-to-edge WindowInsets padding** — `FrameLayout` + `ViewCompat.setOnApplyWindowInsetsListener` (`systemBars | displayCutout | ime`, `CONSUMED`) around WebView; `androidx.core:core`

## P10 Android edge-to-edge insets (2026-11-25)

- ✅ [AGENT][LOCAL] **P10** Wrap WebView in `FrameLayout`; pad with `systemBars | displayCutout | ime` via `ViewCompat` / `WindowInsetsCompat.CONSUMED`; add `androidx.core:core`.

## News: Cursor 3.31 Agents Window audit (2026-11-25)

- ✅ [AGENT][LOCAL] Audited against [Agents Window 3.31](https://cursor.com/docs/release-notes/agents-window#nov-20-2026): core chat CDP path OK; hardened Project tab/sidebar filters + locked Agent-mode note. Docs: `docs/CURSOR_AGENTS_331.md` (UI 35).

## News: PhoneBox GHSA ADB review (2026-11-25)

- ✅ [AGENT][LOCAL] Reviewed USB/ADB path vs [GHSA-j6qc-pm3p-fhg7](https://github.com/ersinkoc/phonebox/security/advisories/GHSA-j6qc-pm3p-fhg7): **not affected** — no `adb reverse`; ADB only installs APK + opens one-time pair deep link; relay auth is device Bearer token over tunnel. Documented in `SECURITY.md`.

## Hotfix 1.10.1 — pairing wipe (2026-11-19)

- **Symptom:** devices paired and looked good, then bounced to the pairing screen.
- **Cause:** Android `WebStorage.deleteAllData()` inside `clearUi` / native `clearCacheAndReload`, also triggered by WS `reloadUi` after `sync-ui` / `/api/ui/reload`.
- **Fix:** stop wiping WebStorage; UI 33 `forceReloadUi` clears caches only; Windows packaging includes `sync-app.mjs`.
- **Operator note:** pre-1.10.1 APKs still wipe on ADB `clearUi` — avoid that after pair until this APK is installed.

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
