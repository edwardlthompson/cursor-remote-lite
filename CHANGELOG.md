# Changelog

## Unreleased

### Closing gaps vs len5ky/CursorRemote (still free / MIT)

- **Extension**: Cursor/VS Code sidebar + **Setup panel** (network mode, repo path, pair/ADB, Telegram instructions). `npm run ext:package` → `cursor-remote-lite.vsix` (also on GitHub Releases).
- **Networking modes**: `tunnel` (default), `lan` / Tailscale-friendly (`HOST=0.0.0.0`), and `localhost` (`--localhost` or `CR_NETWORK=localhost`).
- **Status API**: `GET /api/status` for the extension and health checks (no device token).
- **Persistence**: last alert, watched window IDs/titles, network mode, and start metadata survive relay restarts in `~/.cursor-remote-lite/state.json`.
- **Telegram (optional)**: waiting alerts with **Approve / Skip / Stop** inline buttons; plain text prompts go to Cursor via headless CDP (`headless.mjs`). Watcher runs when Telegram is enabled even without phone push.
- **Multi-window**: notify watcher Promise.all-polls all CDP windows; status exposes watcher stats.
- **Fixtures**: `npm run test:fixtures` covers pairing quotes, Agents extract markers, status/network, Telegram/headless wiring.

Monetization remains out of scope — this project stays free.

## 1.6.0

- Windows EXE/MSI, Linux deb/tar.gz, Android APK releases.
- ADB auto-install + pairing deep link (quoted for device shell).
- English UI, Agents virtualized chat extract for SMS view.
