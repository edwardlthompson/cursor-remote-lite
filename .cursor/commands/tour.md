# Tour (Cursor Remote Lite)

Walk a first-time human (or coding agent) through this repo. Do not dump whole files. After each stop, wait for a question or “ready” before the next.

1. **Bootstrap child** — Read @AGENTS.md project card and @docs/GAP_LIST.md section A (one sentence: fork of Suchenl + child of agent-project-bootstrap). Point at @docs/help/BATCH_COMMANDS.md for `/` recipes.
2. **Board** — Open @BUILD_PLAN.md: remaining-tally, backlog, Argus lanes (local/cloud). Explain 🔲 / ✅ / ❌ and OWNER labels.
3. **Run locally** — From the repo (or `%LOCALAPPDATA%\CursorRemoteLite` packaged install): `npm install` → tray/`npm run public` → `npm run pair`. Pair phone/tablet; open Chat | Dual pane | Files | Screen.
4. **Smoke** — Send a chat message; ⋯ → test notification; confirm Agent-finished shouts when a turn ends. Optional: open `BUILD_PLAN.md` in Files Preview.
5. **Ship path** — Point at Releases (EXE/MSI/APK) and `/verify` before `/ship`. Mention Argus is wired but remote is `enabled: false` (`docs/ARGUS_REMOTE.md`).
6. **Next** — Offer `/coach` for the next BUILD_PLAN row, `/ideas` for GAP_LIST ranking, `/upgrade` for parent template gaps (section B).

If the tool has no slash commands, the same walk is `docs/help/TOUR.md` (template) plus this product path.
