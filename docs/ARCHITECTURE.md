# Architecture — Cursor Remote Lite

Free, MIT-licensed relay that drives desktop Cursor from a phone (or Telegram) via the Chrome DevTools Protocol.

```
Phone (APK / PWA) ──HTTPS/WSS──► Cloudflare tunnel (optional)
                                      │
Telegram (optional) ──Bot API─────────┤
                                      ▼
                              relay (server.mjs)
                                      │
                              CDP :9222
                                      ▼
                                 Cursor IDE
```

## Processes

| Piece | Role |
|-------|------|
| `server.mjs` | HTTP + WebSocket relay, CDP sessions, `/api/status`, pairing |
| `notify.mjs` | Parallel per-window CDP watchers → Web Push / SSE / Telegram |
| `headless.mjs` | Approve / Skip / Stop / send prompt without a phone Session |
| `telegram.mjs` | Bot poll, forum topics per window, inline keyboards |
| `extension/` | Cursor/VS Code sidebar + setup panel that spawns the relay |
| `app/` | Phone UI (GitHub Pages or served by the relay) |
| `android/` | WebView shell (`com.cursorremote.lite`, launcher name **Cursor Remote**) |
| `presence.mjs` | Per-window active-viewer lock (phone vs tablet) |
| `packaging/windows/TrayHost/` | WinForms tray host + HKCU autostart / keep-awake |

## Network modes

- **tunnel** — bind `127.0.0.1`, Cloudflare quick tunnel (default for away-from-home)
- **lan** — bind `0.0.0.0` (LAN / Tailscale)
- **localhost** — bind `127.0.0.1` only (bring your own proxy)

## Auth

Device pairing (one-time QR / deep link) + optional TOTP. No paid license. Tokens are hashed under `~/.cursor-remote-lite/`.

## Persistence

`~/.cursor-remote-lite/state.json` keeps relay URL, last alert, watched windows, network mode. Devices, VAPID keys, Telegram topics live alongside.

## Packaging

Windows EXE/MSI, Linux `.deb`/tar.gz, Android APK, Cursor/VS Code `.vsix` — see GitHub Releases.

## Roadmap

1.8.0 implements [ROADMAP-1.8.md](ROADMAP-1.8.md) (quick prompts + notification actions, diff review, multi-device lock, Windows tray/autostart).  
1.8.1 adds clipboard bridge (phone ↔ Cursor) and a tablet landscape dashboard (window status strip + changed-files side panel).
