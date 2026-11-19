# Changelog

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
