# Remote Windows + Linux control app — architecture plan

> GAP **P8**. Plan only — no implementation in this doc.

## Goal

A packaged **desktop remote** for Cursor Remote Lite on Windows and Linux that is not “another Electron IDE”, but a thin control surface for the same relay the phone/tablet already uses: chat, approvals, Dual pane, diffs, pairing.

## Options

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| **A. Tauri 2** | Small binaries, Rust host, web UI reuse from `app/` | Learning curve; WebView quirks | **Preferred** |
| **B. Electron** | Fast to ship; same Chromium as Pages | Large install; overlap with Cursor | Fallback |
| **C. Native** (WinUI / GTK) | Native look | Two UIs; slow; no shared Dual pane | Reject for v1 |

## Recommended shape (Tauri)

```
┌─────────────────────────────────────────┐
│  Desktop shell (Tauri)                  │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ System tray │  │ WebView → app/   │  │
│  │ + deep link │  │ (same Pages UI)  │  │
│  └──────┬──────┘  └────────┬─────────┘  │
└─────────┼──────────────────┼────────────┘
          │                  │
          ▼                  ▼
   local Node relay     Cloudflare / LAN
   (existing win-run /  encrypted url.json
    linux-run)          + device token
```

1. **Reuse `app/`** — load the GitHub Pages URL or a bundled copy; do not fork a second chat UI.
2. **Host process** — call into existing `win-run.mjs` / `linux-run.mjs` (or spawn packaged payload) rather than reimplementing CDP.
3. **Tray** — Windows already has WinForms tray; Linux gets a Tauri tray that mirrors Start-with-session + quit.
4. **Auth** — same pairing deep link / device token; desktop is just another paired “device” with a control lock slot.
5. **Updates** — GitHub Releases (same channel as EXE/deb); no store requirement for v1.

## Non-goals (v1)

- Replacing Cursor itself or shipping an Agents cloud relay.
- macOS menu-bar app (launchd path already exists; separate gap if needed).
- Rewriting the Android WebView shell.

## Phased delivery

| Phase | Deliverable | Gate |
|-------|-------------|------|
| 0 | This plan + ADR stub | Review |
| 1 | Tauri scaffold loading Pages `app/` against local relay | `npm test` + manual pair |
| 2 | Tray parity with `CursorRemote.exe` (autostart, log, ADB pair hook) | Windows + Linux smoke |
| 3 | Signed installers on `release.yml` | Tag release |

## Decision

Proceed with **Option A (Tauri)** when P8 is unparked for coding. Keep WinForms EXE until Tauri tray reaches parity, then deprecate the C# host.
