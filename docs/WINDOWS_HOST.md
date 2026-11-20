# Windows host (console-free)

## Packaged (recommended)

| Artifact | Subsystem | Console |
|----------|-----------|---------|
| `CursorRemote.exe` / MSI | WinForms tray (`OutputType=WinExe`) | None after start |
| First-run extract | Temporary `AllocConsole` | Freed before tray runs |
| Child `node.exe` | `CreateNoWindow` + `win-run.mjs --hidden` | Hidden |
| Cloudflare tunnel | `windowsHide` on spawn | Hidden |

Payload lives under `%LOCALAPPDATA%\CursorRemoteLite`. Logs: `%USERPROFILE%\.cursor-remote-lite\relay.log`.

## From source

| Script | Console |
|--------|---------|
| `npm run win:hidden` | Quiet (tray-equivalent) |
| `npm run win` / `npm run public` | Foreground — intentional for debugging |

Do not expect `npm run public` to be console-free; use the EXE or `win:hidden` instead.
