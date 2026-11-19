# Changelog

## Unreleased

### Closing gaps vs len5ky/CursorRemote (still free / MIT)

- **Extension**: Cursor/VS Code sidebar to start/stop the relay, show CDP + device status, pair, ADB pair, open phone app (`extension/`, package with `npm run ext:package`).
- **Networking modes**: `tunnel` (default), `lan` / Tailscale-friendly (`HOST=0.0.0.0`), and `localhost` (`--localhost` or `CR_NETWORK=localhost`).
- **Status API**: `GET /api/status` for the extension and health checks (no device token).
- **Persistence**: last alert, watched window IDs/titles, network mode, and start metadata survive relay restarts in `~/.cursor-remote-lite/state.json`.
- **Telegram (optional)**: free notify bridge + `/start` chat linking (`npm run telegram`, `TELEGRAM_BOT_TOKEN`).
- **Multi-window**: confirm notify watcher already polls all CDP windows in parallel; status now exposes watcher stats.
- **Fixtures**: basic extract regression tests under `test/`.

Monetization remains out of scope — this project stays free.

## 1.6.0

- Windows EXE/MSI, Linux deb/tar.gz, Android APK releases.
- ADB auto-install + pairing deep link (quoted for device shell).
- English UI, Agents virtualized chat extract for SMS view.
