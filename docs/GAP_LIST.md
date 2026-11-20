# Gap list

Child of **[agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap)** (template `.template-version` = `1.13.1`).  
Upstream app fork: **[Suchenl/cursor-remote-lite](https://github.com/Suchenl/cursor-remote-lite)** (READ-only).  
Argus surface: [`ARGUS_REMOTE.md`](ARGUS_REMOTE.md) · `argus.contract.json` · `argus.remote.json` · `rules.manifest.json`.

**Board mirror:** every **B** / **C** / **D** row below has a matching BUILD_PLAN item. When the board row goes ✅, set **Status** here the same turn (`/cleanup` enforces this).

## A. Fork vs Suchenl upstream (shipped here)

| Area | Upstream | This fork |
|------|----------|-----------|
| License / monetization | MIT | MIT, no donate / license wall |
| Windows packaging | Manual Node | **Tray EXE + MSI**, Start with Windows, keep-awake, ADB pair |
| Linux packaging | Manual | **deb + tar.gz** |
| Android | APK | APK + **heads-up finish/wait sound**, OpenShouter-friendly timestamps, in-app GitHub update, Back doesn’t kill |
| Dual pane | Phone layout | **Chat \| Dual pane \| Files \| Screen**; editor tabs synced; Markdown Preview |
| Diffs | Preview / Keep-Undo | **Unified git diff** sheet + inline pane diffs |
| Clipboard | — | **Push / pull** phone ↔ Cursor |
| Multi-device | Shared session | **Per-window control lock** + Take control |
| Notifications | Basic / SSE | Done always notifies (WS + SSE); Continue / Reply / Approve; Telegram forum topics |
| Docs / agent ops | README | **BUILD_PLAN**, slash commands, this gap list, **Argus** markers (bootstrap child) |

## B. Template gaps (bootstrap parent `1.13.1`)

| # | Gap | Status |
|---|-----|--------|
| T0 | **Argus core** — `argus.*`, rules manifest, stub workflows, lineage `AGENTS.md` / `.template-update.json` / `SECURITY.md` | ✅ Done |
| T3a | **Slash commands** — parent `.cursor/commands/` + `docs/help/*` + cheat sheet | ✅ Done |
| T1 | Full `scripts/agent-run.py` gate suite + `validate-bootstrap.sh` | ✅ Done |
| T2 | Weekly health / Dependabot automerge / Scorecard / CodeQL workflows | ✅ Done |
| T3b | Finish help tree — product-specific `START_HERE` / `FIRST_30_DAYS` (not template examples) | ✅ Done |
| T4 | Parallel agent scopes + `scripts/build-sprint-status.sh` | ✅ Done |
| T5 | `sync-template-gaps-build-plan` / `sync-open-prs-build-plan` Monday cron | ✅ Done |
| T6 | Pre-commit / gitleaks / dependency-review | ✅ Done |
| T7 | Release Please / SBOM / package attestation docs | ✅ Done (docs; custom release.yml kept) |

## C. Product gaps (next work)

| # | Gap | Status |
|---|-----|--------|
| P1–P3 | Dual pane editors / picker / multi-tab | ✅ Done (Sprint 1) |
| P9 | **Windows without a console** — tray EXE/MSI already exists (`WinExe` + `--hidden`); verify no leftover console; doc + optional npm hidden launcher | ✅ Done |
| P5 | Live tablet dual-pane README GIF | ✅ Done |
| P6 | Document APK keystore backup | ✅ Done |
| P7 | Prune stale `devices.json` after re-pairs | ✅ Done |
| P8 | **Remote Windows + Linux app** — architecture plan | ✅ Done |
| P4 | OVSX publish automation | ✅ Done (CI job; skips until `OVSX_PAT` set) |

## D. Argus Runner connections

| # | Signal / marker | Status |
|---|-----------------|--------|
| D1 | Lineage child (`.template-version`, `.template-update.json`, `AGENTS.md`, `bootstrap.config.json`) | ✅ Done |
| D2 | Contract v2 + `required_files` | ✅ Done |
| D3 | Remote off-switch (`argus.remote.json`) | ✅ Done |
| D4 | Rules publish (`argus/rules` → `rules.manifest.json`) | ✅ Done |
| D5 | Board lanes (tally, open-PRs, template-gaps, local/cloud) | ✅ Done |
| D6 | CI stubs (`argus-remote-stub`, `argus-rules-manifest`) | ✅ Done |
| D7 | Fleet shipping canary (`shipping.yaml` → `cursor-remote-lite`) | ✅ Done |
| D8 | Parent pin (`parent.yaml` `expected_version` = `1.13.1`) | ✅ Done |

## E. Explicit non-goals (for now)

Auto-approve policies, Wear OS, iOS TestFlight, guest share links, rewriting Cursor’s Agents UI, wholesale copy of parent `scripts/check-*.sh` gate farm.
