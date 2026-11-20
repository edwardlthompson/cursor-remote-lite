# Build (Cursor Remote Lite)

Execute the next open 🔲 `[AGENT]` row on @BUILD_PLAN.md without asking, unless blocked on HUMAN/secrets.

## Loop

1. Pick the first 🔲 `[AGENT]` in Sprint 2 order: **B** (T1…) then **C** (P5…) — skip ⏸ parked unless the user unparks.
2. Implement the row; run `npm test` when code/docs tests apply.
3. Mark the BUILD_PLAN row ✅.
4. **Same turn:** set the matching @docs/GAP_LIST.md **B/C/D** Status to ✅ Done (or Closed).
5. Nudge the human to commit + `/push` when a remote exists. Never silent `git push`.

## Wrap-up

When the active sprint section’s AGENT rows are all ✅ or ⏸:

1. Run @.cursor/commands/cleanup.md (archive ✅ → COMPLETED_TASKS; slim board; refresh tally).
2. Confirm GAP_LIST Status columns match archived work.

If parent `scripts/agent-run.py` exists (T1), prefer its `build-sprint-status` / `watch-agent-gates` loop instead of steps 1–2.

Stop on repeated test failure (3 strikes) or missing secrets (e.g. P4 `OVSX_PAT`).
