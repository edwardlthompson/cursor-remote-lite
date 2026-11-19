# Build Plan

<!-- remaining-tally -->
**Remaining:** AGENT 0 · AUTO 0 · HUMAN 1 · ADB 0 · **1 open** (+ backlog)
<!-- /remaining-tally -->

Child of **[edwardlthompson/agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap)** (`1.13.1`).  
App upstream (READ-only): [Suchenl/cursor-remote-lite](https://github.com/Suchenl/cursor-remote-lite).

**Who:** `AGENT` code · `HUMAN` person · `ADB` device · `AUTO` CI/scripts  
**State:** 🔲 open · ✅ done · ❌ blocked

Format: `🔲 [AGENT] Short task`. Slash commands: [`docs/help/BATCH_COMMANDS.md`](docs/help/BATCH_COMMANDS.md). Gap board: [`docs/GAP_LIST.md`](docs/GAP_LIST.md).

---

## Product

### Open PRs (synced)

<!-- open-prs-sync:begin -->
_No open PRs._
<!-- open-prs-sync:end -->

### Template gaps (synced)

<!-- template-gaps-sync:begin -->
_No automated template-gap sync yet — see docs/GAP_LIST.md section B._
<!-- template-gaps-sync:end -->

---

## Sprint 1 — Dual pane = Cursor editors (picker + tabs + sync)

Goal: **Chat | Dual pane | Files | Screen** — max space for chat/files; editors synced both ways.

- ✅ [AGENT] CDP helpers + WS: editors / focus / close / open / suggest
- ✅ [AGENT] Dual pane UI: tab strip, Open… typeahead, active-tab preview; phone↔Cursor sync
- ✅ [AGENT] Tablet density: hide window-status strip + quick-prompt chips; draggable dual divider; **Files** full-pane tab
- ✅ [AGENT] SW v21 — Files reading-only; stop Changes poll stealing file preview; image attach
- 🔲 [HUMAN] Confirm Files has no composer; open a tab and ensure it stays put

### Ship criteria

- [x] Open editors in Cursor appear as tabs in Dual/Files within ~2s  
- [x] Tapping a tab focuses that editor in Cursor and shows preview  
- [x] Closing a tab on mobile closes it in Cursor; closing in Cursor removes it on mobile  
- [x] Open… suggests workspace files as you type; Open still uses Quick Open  
- [x] `npm test` green  

---

## Backlog

- 🔲 [AGENT] **Remote Windows + Linux control app** — plan a first-class remote client (not only phone/tablet WebView) that can drive Cursor on a Windows or Linux laptop over the existing relay/CDP path: install story, window attach, Dual/Files layout parity, offline/reconnect, and how it differs from the phone APK / Pages app. Capture architecture options (Electron / Tauri / native) before coding.

---

## Archive

Shipped through **1.8.3**: tray, tablet dual-pane, clipboard, multi-device lock, diffs, Android Back/updates, APK signing. See `CHANGELOG.md`.
