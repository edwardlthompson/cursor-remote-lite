# Completed tasks

Archived from `BUILD_PLAN.md` via `/cleanup`. Newest sections first.

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
