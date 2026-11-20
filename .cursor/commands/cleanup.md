# BUILD_PLAN archive cleanup

Always invoked at end of `/build` when the sprint/feature block is complete (mandatory wrap-up); may still be run alone. Moves finished work off the active board into @COMPLETED_TASKS.md when local gates pass.

**Gap list:** whenever a BUILD_PLAN row that maps to @docs/GAP_LIST.md (sections **B**, **C**, or **D**) is marked ✅, update that gap row’s **Status** column the same turn (Done / Closed / Present — never leave the gap list stale).

**Do not archive** while any `[AGENT]` or `[AUTO]` row in the active sprint/feature block is still 🔲 or ❌. Rows auto-completed by `/build` automation (✅ HUMAN/ADB) may be archived with AGENT/AUTO work. Items in `HUMAN_BACKLOG.md` stay 🔲 on the board until a human clears them.

## Step 1 — Confirm completion

- All executed `[AGENT]` and `[AUTO]` rows in the active block are ✅
- Replace 🔲 → ✅ only for rows verified done **this session**
- Matching @docs/GAP_LIST.md B/C/D rows updated to Done/Closed

## Step 2 — Archive to COMPLETED_TASKS.md

Prepend a new dated section at the top of @COMPLETED_TASKS.md (immediately after the file header):

```markdown
## {Sprint or feature name} ({YYYY-MM-DD})

- ✅ [OWNER] Original description

```

Copy every ✅ row from the finished block verbatim (keep owner labels and descriptions).

## Step 3 — Slim BUILD_PLAN.md

Remove the archived ✅ rows from the active board.

**Finished sprint:**

- Delete or collapse the sprint section on the active board
- Add a summary line pointing at COMPLETED_TASKS.md
- Append a row to the **Archive** table

**Finished feature:**

- Remove the completed feature’s ✅ rows
- Leave backlog / other open sections intact

## Step 4 — Refresh tally

Update the `<!-- remaining-tally -->` counts to match remaining 🔲 rows.
