# Coach (Cursor Remote Lite)

Output: **one next action** + optional Why. No health novels.

1. Read @BUILD_PLAN.md remaining-tally and the first 🔲 `[AGENT]` row (Sprint 2 B → C order unless user named otherwise).
2. If dirty tree / unpushed commits → **commit** (if asked) then remind `/push` — never silent `git push`.
3. If open AGENT rows → recommend `/build` on that row; on ✅, update @docs/GAP_LIST.md Status.
4. If board empty of AGENT work → `/ideas` (GAP_LIST) or `/upgrade` for template gaps.
5. If Argus/lineage files missing → `/bootstrap`.

Optional (when T1 lands): `python scripts/agent-run.py project-health`.

Begin now.
