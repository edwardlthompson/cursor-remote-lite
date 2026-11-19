# Changelog

## Unreleased

## 1.9.4

- **OpenShouter-friendly alerts**: Agent finished / waiting / test posts use a visible clock (`setWhen` + `setShowWhen(true)`), `CATEGORY_MESSAGE`, and a fresh notification id each time — not ongoing. The persistent listen FGS stays ongoing with no timestamp so it keeps the process alive without triggering a shout.

## 1.9.3

- **Usage bar**: show Cursor’s included-usage % (from the desktop “Usage N%” chip) between History and the composer.
- **Silent notifications**: recreate alert channels as `*_v3` (OEMs lock Silent on old channel ids); FGS listen uses a separate quiet channel; alerts force `setSilent(false)` + sound; menu → Fix silent notifications.

## 1.9.2

- **Android notifications**: detect/request `POST_NOTIFICATIONS` (was denied → app importance NONE, silent alerts); restart SSE listener on config refresh; test alerts use the high-importance channel; menu links to system notification settings.
- **Composer drafts**: typed text persists per Cursor window across app switches and Dual/Files/Chat — restored when you come back (cleared on Send).

## 1.9.1

- **Files reading-only**: hide composer / History on Files; `[hidden]` now actually hides (`display:flex` was winning).
- **No file hopping**: Files mode never auto-follows Cursor tab polls; Changes updates no longer steal an open preview.
- **Stay connected in background**: Android no longer pauses the WebView; foreground keepalive always runs; UI heartbeat keeps the relay session alive until you Unpair.
- **Stuck UI**: SW `cache: no-store` + ⋯ → Reload app UI (UI 22).

## 1.9.0

- **Dual pane layout**: **Chat | Dual pane | Files | Screen** — left / both (draggable split) / right / desktop Screen on any landscape device.
- **Editor sync**: open Cursor tabs (Agents `ui-tab-system-tab`) appear in the pane; focus/close both ways; Open… lists open editors + workspace typeahead.
- **Markdown Preview/Source** toggle for `.md` files in the Files pane.
- **Tablet density**: removed window-status strip, quick-prompt chips, post-turn file pills in chat, and the Changed-files/Diff footer on file preview.
- **Windows path fix**: normalize VS Code `/c:/…` workspace roots so `BUILD_PLAN.md` and Open… resolve on Windows.
- **Bootstrap child**: `BUILD_PLAN.md`, `docs/GAP_LIST.md`, slash recipes (`/tour` `/coach` `/verify` `/build` `/ship`), app icon in README.
- Backlog: plan remote Windows/Linux Cursor control app.

## 1.8.3

- **Android signing**: release APKs use a persistent GitHub Actions keystore (`KEYSTORE_B64`) so updates install over previous builds without uninstall.
- **versionCode**: encode semver (e.g. 1.8.3 → 10803) instead of workflow `run_number`, so sideloads are never a “downgrade” vs older android.yml builds.

## 1.8.2

- **Files tab + dual pane**: new **Files** button between Chat and Screen. Phone: full-height pane in the same layout as chat (list + empty state; diffs inline). Tablet landscape (≥900px): tapping **Files** shows chat and the Files pane side-by-side (chat left, changed files / diff right); window status strip unchanged.
- **Android Back**: system Back closes the ⋯ menu / sheets / file viewer (and returns from Change address) instead of killing the app; main UI sends the task to the background.
- **In-app updates**: Check for app update queries GitHub Releases, downloads `CursorRemote.apk`, and opens the installer; runs automatically once each time the app opens.

## 1.8.1

- **Clipboard bridge**: paste phone clipboard into Cursor’s composer; pull selection / last code block back to the phone (composer buttons + menu).
- **Tablet landscape dashboard**: at ≥900px landscape, window status strip (idle / running / waiting) + side panel for changed files with Keep/Undo.
- **Android finish alerts**: dedicated high-importance channels with sound/vibration; “Agent finished” always notifies (like desktop), even if that window is open on the phone.

## 1.8.0

Away-faster slice: tray host, quicker prompts, diffs, multi-device lock.

- **Windows tray + autostart**: `CursorRemote.exe` runs as a system-tray app (no babysitting a console). First run enables Start with Windows; tray menu covers relay log, ADB pair, keep-awake, Quit (stops relay). MSI seeds HKCU Run.
- **Quick prompts**: chip row above the composer (Continue / Fix tests / …); long-press to delete, `+` to add; persisted on device.
- **Notification Continue / Reply**: Web Push actions, Android notification actions, and Telegram Done inline buttons (`Continue` / `Reply`).
- **Diff review sheet**: tap a changed file for a unified git diff; Keep / Undo / prev-next from the sheet.
- **Multi-device active-viewer lock**: per-window control lock so phone and tablet do not double-approve; Take control steals; 90s idle TTL.

Still free / MIT — no license key.

## 1.7.0

Ship build: remaining free gaps vs len5ky closed for release.

- **Telegram forum topics**: per-window topics in forum groups (`/sync`), thread-routed prompts; flat-chat fallback.
- **DOM fixture corpus**: `test/fixtures/agents-*.html` + linkedom tests for waiting buttons, questionnaires, sidebar history.
- **Extension marketplace-ready**: icon/banner/keywords; VSIX on Releases; `npm run ext:publish:ovsx` when `OVSX_PAT` is set.
- **Docs**: `docs/ARCHITECTURE.md`, `docs/TELEGRAM.md`, `docs/EXTENSION.md`.
- Setup panel, Approve/Skip/Stop, network modes, persistence, parallel watchers (from 1.6.x gap work).

Still free / MIT — no license key.

## 1.6.0

- Windows EXE/MSI, Linux deb/tar.gz, Android APK releases.
- ADB auto-install + pairing deep link (quoted for device shell).
- English UI, Agents virtualized chat extract for SMS view.
