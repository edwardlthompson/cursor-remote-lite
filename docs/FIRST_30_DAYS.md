# First 30 days

> Playbook for **Cursor Remote Lite** after clone / first pair. Status: 🔲 open · ✅ done · ❌ blocked.  
> Walk with `/coach` or `/tour` (`docs/help/TOUR.md`). Industry **why**: [`BEST_PRACTICES.md`](BEST_PRACTICES.md). Gaps: [`GAP_LIST.md`](GAP_LIST.md).

<!-- bootstrap-project-card -->
**Product:** Cursor Remote Lite
**Purpose:** Free MIT phone/tablet remote for desktop Cursor (tray, Dual pane, finish alerts)
**Stack:** node
<!-- /bootstrap-project-card -->

## Week 1 — Host + first device

- 🔲 Read `docs/START_HERE.md` and skim `README.md` Install / Security
- 🔲 `npm install` · `npm test` green
- 🔲 Optional: `pip install pre-commit && pre-commit install` (gitleaks + basic hooks; see `.pre-commit-config.yaml`)
- 🔲 Prefer packaged host: install **CursorRemote.exe** / MSI (Start with Windows, keep-awake) — or `npm run public` for foreground relay
- 🔲 Pair one phone or tablet (`npm run pair` or tray → ADB pair); confirm Chat works end-to-end
- 🔲 On a tablet: open **Dual pane**, sync a Cursor tab, try Markdown Preview on `BUILD_PLAN.md`
- 🔲 Confirm finish alert (shade / OpenShouter) after a short Agent turn
- 🔲 Bookmark [`help/BATCH_COMMANDS.md`](help/BATCH_COMMANDS.md) (`/tour` · `/coach` · `/verify`)

## Week 2 — Security and GitHub

- 🔲 Review `SECURITY.md` reporting channel; never post pairing links publicly
- 🔲 Optional: `npm run 2fa` (Authenticator) for new-device pairing
- 🔲 Confirm workflows on `main`: **CodeQL**, **OpenSSF Scorecard** (schedule), **Weekly Health Check**, existing **android** / **release**
- 🔲 Dependabot: `.github/dependabot.yml` + auto-merge for patch/minor (`dependabot-automerge.yml`); optional secret `AUTOMERGE_TOKEN`
- 🔲 Paste repo About / topics from README pitch if Settings → General is empty
- 🔲 Backup APK signing keystore if you publish signed APKs ([`APK_KEYSTORE.md`](APK_KEYSTORE.md))

## Week 3 — Dual pane and packaging confidence

- 🔲 Exercise **Files** + unified git diff Keep/Undo from the phone
- 🔲 Clipboard push/pull once; multi-device lock with a second device if you have one
- 🔲 Install latest Release APK via ADB; confirm in-app update path still works
- 🔲 Linux or second Windows box: try deb / tray path from Releases (smoke only)
- 🔲 `/build` one open `[AGENT]` row from `BUILD_PLAN.md`; flip matching GAP_LIST **B/C/D** Status when done

## Week 4 — Operate like a maintained fork

- 🔲 Green local gates before dumping ideas: `npm test` · `python scripts/agent-run.py project-health`
- 🔲 `/ideas` or `/allideas` only after health is OK — then put ranked items on BUILD_PLAN (do not implement until you say so)
- 🔲 Skim `docs/GAP_LIST.md` **B** vs parent `1.13.1`; use `/upgrade` for plans only
- 🔲 One Dependabot leftover triage (`/dependabot`) + Scorecard awareness
- 🔲 Optional Telegram forum topics / Cursor extension if you use them (README)
- 🔲 `/verify` before every PR; `/ship` only when you intend a Release

## Next recommended action

Type **`/coach`** (or ask any agent to read this file + `BUILD_PLAN.md`). First session: `/tour` or `docs/help/TOUR.md`. Ranked backlog: `/ideas`. Full dump: `/allideas`.
