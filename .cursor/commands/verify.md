# Verify before merge (Cursor Remote Lite)

1. **Tests** — `npm test` (must pass).
2. **Docs** — skim `CHANGELOG.md` Unreleased / latest; GAP_LIST B/C/D Status matches BUILD_PLAN ✅ rows.
3. **Argus** — if Python available: `python scripts/argus-remote.py status` (expect `enabled=False`); contract files present.
4. **Android/UI** — if `app/` or Android changed: remind Pages sync + device **Reload app UI**.
5. **CI** — if already pushed, check GitHub Actions (`android.yml` / `release.yml` / Argus stubs).

If `scripts/agent-run.py` exists (GAP_LIST **T1**), also run parent `/gates` / `/ci` recipes.

Report pass/fail per step; do not ship on red tests.
