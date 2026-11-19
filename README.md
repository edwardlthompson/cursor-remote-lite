**English** | [中文](README.zh.md)

# Cursor Remote Lite

**Leave your laptop behind and keep working.** Your computer stays on at home or at the office; with your **phone or tablet** you keep driving Cursor: give the Agent tasks, get notified when it finishes, answer questions, approve commands, review diffs, and keep or undo changed files — in local and SSH remote windows alike.

**Free, MIT, self-hosted.** No license key, no cloud Agent relay. Works on Android (native APK, no Google services required), iPhone (Add to Home Screen), Windows / Linux / macOS for the PC side, plus optional Telegram and a Cursor/VS Code extension.

> Fork of [Suchenl/cursor-remote-lite](https://github.com/Suchenl/cursor-remote-lite) (itself inspired by [len5ky/CursorRemote](https://github.com/len5ky/CursorRemote)). This fork stays free and adds tray packaging, tablet dashboard, clipboard bridge, multi-device lock, and richer alerts.

<p align="center"><img src="docs/en/quickstart.gif" width="300" alt="Demo: preview a file, switch windows, adjust model parameters, approve a command, queue a message while the Agent runs, handle changed files"></p>

<p align="center"><sub>Demo: tap a file name to preview it → switch to an SSH window → raise the model's reasoning effort → approve the test run → expand the running subagents → a message sent while the Agent is busy is queued and goes out when the turn ends → keep / undo changed files one by one (undo asks first) (demo data)</sub></p>

## Screenshots

| Chat | File preview | Switch window | Pick model |
|:-:|:-:|:-:|:-:|
| <img src="docs/en/ui-chat.png" width="190" alt="Chat"> | <img src="docs/en/ui-file.png" width="190" alt="File preview"> | <img src="docs/en/ui-windows.png" width="190" alt="Switch window"> | <img src="docs/en/ui-model.png" width="190" alt="Pick model"> |
| **Model parameters** | **Running: subagents + queue** | **Changed files** | **Confirm risky actions** |
| <img src="docs/en/ui-params.png" width="190" alt="Model parameters"> | <img src="docs/en/ui-running.png" width="190" alt="Running: subagents and queued messages"> | <img src="docs/en/ui-changes.png" width="190" alt="Changed files"> | <img src="docs/en/ui-confirm.png" width="190" alt="Confirmation"> |

## Why I built this

### A typical day

Before leaving in the morning, you ask Cursor's Agent to fix a bug in a project that lives on your company's GPU server (an SSH remote window). Then you commute, sit in meetings, grab lunch, or travel for two days, and the laptop stays behind.

Meanwhile the Agent finishes a turn and waits for you to check it; stops to wait for you to tap "Run"; or asks you a question like "When a session expires, should we return 401 or renew it?". You also think of the next thing you want it to do.

**What you need isn't "a quick remote peek". It's being able to keep working without your computer**: give tasks, answer questions, approve commands, see which files changed, and decide what to keep or undo. And the work has to happen in your own environment: your local code and data, your configured SSH servers, your installed dependencies.

### What existing options can do, and where they fall short

- **Cursor's official mobile app** (Cursor for iOS + Remote Control): iPhone / iPad only (iOS 26+), with no native Android app yet; requires a paid plan; Remote Control only works with the Agents window, and the Agent's reasoning loop moves to Cursor's cloud. Conversations already running in regular editor windows or SSH remote windows can't be controlled.
- **[len5ky/CursorRemote](https://github.com/len5ky/CursorRemote)**: same idea (controls the local Cursor through its debugging port), but requires a $7.99/month license, and the code is source-available rather than open source; for access from outside your network you have to set up Tailscale or a Telegram bot yourself.
- **Remote desktop** (Sunlogin, ToDesk, RustDesk, Chrome Remote Desktop): can control everything, but it means driving a shrunken desktop on your phone; reading Cursor's chat panel, hitting tiny buttons and typing are all painful, it uses a lot of data, and nothing tells you when the Agent finishes or needs you.

### What this project does

A tiny relay on your computer drives the real Cursor running there, and your phone/tablet gets a mobile UI:

- Read the Agent conversation like a chat app; messages sent while it's busy are queued automatically.
- **Heads-up notifications with sound** when a turn finishes or when Run/Allow is waiting — Approve / Skip / Stop / Continue / Reply from the notification.
- Review **git diffs**, Keep / Undo per file; paste phone clipboard into Cursor or pull a selection / code block back.
- **Tablet landscape dashboard**: **Chat | Files | Screen** — in landscape, chat and the Files pane sit side-by-side (diffs inline); status strip for every window (idle / running / waiting).
- Every window works: local, SSH remote, Agents; switch mode, model and reasoning effort anytime.
- Optional **Telegram** (forum topics per window) and a free **Cursor extension** for setup/status.
- Your code and chats stay on your computer; the phone reaches them over a Cloudflare tunnel (HTTPS), LAN, or localhost. Works on Android and iPhone, including networks in mainland China.

### Why support both Android and iPhone

The official app is iPhone-only, but people's phones are far from all iPhones:

| Region | iOS | Android | Period |
|---|---|---|---|
| United States | 60.7% | 39.3% | August 2026 |
| Europe | 39.5% | 60.4% | July 2026 |
| Worldwide | ~28% | ~72% | 2026 |
| Mainland China | Minority | Majority, and many Huawei, Xiaomi, OPPO, etc. phones have no Google services | — |

Data from [StatCounter](https://gs.statcounter.com/os-market-share/mobile/), which measures each OS's share of traffic across roughly 1.5 million websites. It reflects "phones actually in use", not sales. iPhone users browse more, so iOS's share is slightly inflated; treat the exact numbers as rough, but the conclusion is clear: **iPhone is slightly ahead in the US, Android leads in Europe and worldwide, and in China most phones are Android without Google services**.

So this project provides both: an Android app that installs without Google services, and a full-screen "Add to Home Screen" app on iPhone (no App Store listing needed, so it works in Europe too).

## How it compares

| | **This fork (Cursor Remote Lite)** | Cursor official iOS app | len5ky/CursorRemote | Remote desktop |
|---|---|---|---|---|
| Price | **Free forever** | Paid Cursor plan | $7.99/month | Free / paid |
| License | **MIT open source** | Closed | Source-available | — |
| Android | **Native APK** (no Google services) | ❌ | Browser / Telegram | Vendor app |
| iPhone | Add to Home Screen (PWA) | Native (iOS 26+) | Browser / Telegram | Vendor app |
| Windows it controls | **All**: local, SSH, Agents | Agents only (Remote Control) | Mostly local | Whole desktop |
| Where code / chats live | **Only on your PC** (tunnel to your phone) | Agent loop often in Cursor cloud | Your PC + LAN / Tailscale | Vendor servers |
| Away-from-home access | Built-in Cloudflare tunnel + fixed Pages address | Built in | DIY Tailscale / Telegram | Built in |
| Phone UX | Chat + screen + **diffs** + clipboard + **tablet dashboard** | Native Agents UI | Chat UI | Tiny desktop |
| Done / waiting alerts | **Android heads-up + sound**; Web Push; Telegram actions | ✅ | Telegram | ❌ |
| Multi-device (phone + tablet) | **Control lock** per window | — | — | Shared desktop |
| PC packaging | **Win tray EXE/MSI**, Linux deb, macOS service, Cursor VSIX | — | — | — |
| Telegram | Optional, free, forum topics / window | — | Optional | — |
| Computer must stay awake | Yes | Cloud Agents: no; Remote Control: yes | Yes | Yes |

**Limitations** (stated up front):

- Relies on Cursor’s UI via CDP — a major Cursor redesign may need a relay update.
- macOS still has the nicest launchd install; Windows uses the **system-tray EXE** (Start with Windows) instead of a classic service.
- Cloudflare free quick tunnels can briefly disconnect and reconnect.

## Features

### Core remote control
- **Chat mode**: Agent conversations as a chat app (bubbles, tool cards, thinking); approval buttons appear on the phone when Cursor waits.
- **File preview**: tap a blue file name or 📄 tool card for a full-screen preview (SSH files via passwordless `ssh` from your PC).
- **Screen mode**: live view of the chat panel or whole window; tap, scroll, zoom, common keys.
- **Multiple windows**: switch local / SSH / Agents from the title control.
- **Modes / models / history**: Agent / Plan / Ask, model picker, parameters (context, reasoning, Fast, MAX), History, New chat.
- **Agent questions**: questionnaire cards (multiple choice / free text) with Skip / Submit; notifications include the question.
- **Queue & sub-agents**: queue while busy (edit / send now / delete); list and stop sub-agents; stop the main Agent with confirmation.
- **Changed files**: line add/del counts, Keep / Undo (with confirm on Undo), Keep All / Undo All when Cursor offers them.
- **Images**: attach a photo/screenshot into Cursor’s composer (compressed on device).
- **Voice input** (opt-in): Android system recognizer or browser speech API.
- **English / 中文**: UI + notification language under **⋯ → 语言 / Language**.

### Away-faster (this fork)
- **Notifications + sound**: Android heads-up channels for **Finished** and **Needs your OK**, with Continue / Reply / Approve / Skip / Stop actions; Web Push and Telegram too. Finished alerts fire even if that window is open on the phone.
- **Quick prompts**: chips above the composer (Continue, Fix tests, …); long-press to delete, `+` to add; stored on the device.
- **Diff review**: tap a changed file for a unified git diff, then Keep / Undo / prev-next.
- **Clipboard bridge**: paste phone clipboard → Cursor composer; pull selection or last code block → phone.
- **Multi-device lock**: phone + tablet won’t double-Approve; banner + **Take control** (90s idle TTL).
- **Tablet landscape dual pane** (≥900px): **Files** tab between Chat and Screen; chat + changed-files/diff side-by-side, plus window status strip.
- **Windows tray**: `CursorRemote.exe` / MSI runs in the system tray with Start with Windows, keep-awake, ADB pair, Quit (stops relay).
- **Telegram** (optional): forum topic per Cursor window (`/sync`); waiting/done inline actions. See [docs/TELEGRAM.md](docs/TELEGRAM.md).
- **Cursor / VS Code extension**: setup panel, status, network modes (tunnel / lan / localhost). See [docs/EXTENSION.md](docs/EXTENSION.md).

### Trust & access
- **Device pairing**: one-time QR / deep link; optional TOTP 2FA; hashed tokens only on the PC.
- **Fixed address**: your own GitHub Pages app + encrypted `url.json` — tunnel URL can change without re-pairing.
- **ADB auto-pair**: EXE/deb can install the APK and open the pairing deep link when a device is connected.

## How it works

```
Phone app (GitHub Pages) ──HTTPS/WebSocket──> Cloudflare tunnel ──> relay on your computer (Node) ──CDP──> Cursor
```

(Phone app on GitHub Pages → Cloudflare tunnel → relay (Node) on your computer → Cursor.)

Cursor is built on Electron. When started with `--remote-debugging-port`, the relay uses the Chrome DevTools Protocol to read chat content, capture the screen, and simulate clicks and keyboard input.

## Requirements

- **PC**: Windows, Linux, or macOS with **Node.js 22+**
- **Away-from-home**: [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (bundled in Win/Linux packages)
- **Fixed phone URL**: [GitHub CLI](https://cli.github.com/) (`gh`) logged in, for Pages setup
- **Easiest path**: download the prebuilt **Windows EXE/MSI**, **Linux .deb**, and **Android APK** from [Releases](https://github.com/edwardlthompson/cursor-remote-lite/releases/latest) instead of running from source

## Quick start (5 minutes)

**Step 1: Install on your computer**

```bash
git clone https://github.com/edwardlthompson/cursor-remote-lite.git
cd cursor-remote-lite
npm install
npm run setup        # create the phone app repo, enable start at login, optionally enable 2FA
./start-cursor.sh    # restart Cursor with the debugging port (quits the current Cursor first)
```

**Windows (automated):** from an external PowerShell window (not Cursor's terminal):

```powershell
npm install
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
# or non-interactive setup only: npm run setup:auto
powershell -ExecutionPolicy Bypass -File .\start-cursor.ps1
npm run public
```

`npm run setup` / `setup:auto` creates a public repository under **your own** GitHub account (named `cursor-remote-app` by default) and uses GitHub Pages to host the phone app and your computer's encrypted address. Everyone uses their own; it has nothing to do with the author or other users.

**Step 2: Pair your phone**

```bash
npm run pair
```

A QR code appears in the terminal (valid for 10 minutes, single use). Scan it with your phone's camera or browser to open it; there's no password to type.
If you can't scan it, send the link shown below the QR code to your phone and open it (or paste it into the app's input box).

<p align="center"><img src="docs/en/ui-pair.png" width="220" alt="Screen shown before pairing"></p>

**Step 3: Packages (recommended instead of babysitting a terminal)**

| Platform | Download |
|---|---|
| **Windows** | [CursorRemote.exe](https://github.com/edwardlthompson/cursor-remote-lite/releases/latest/download/CursorRemote.exe) / [CursorRemote.msi](https://github.com/edwardlthompson/cursor-remote-lite/releases/latest/download/CursorRemote.msi) — **system tray**, Start with Windows, keep-awake, ADB auto-pair |
| **Linux** | [CursorRemote-linux-x64.deb](https://github.com/edwardlthompson/cursor-remote-lite/releases/latest/download/CursorRemote-linux-x64.deb) or [tar.gz](https://github.com/edwardlthompson/cursor-remote-lite/releases/latest/download/CursorRemote-1.8.2-linux-x64.tar.gz) → `cursor-remote` |
| **Android** | [CursorRemote.apk](https://github.com/edwardlthompson/cursor-remote-lite/releases/latest/download/CursorRemote.apk) — no Google services required (Huawei OK). HarmonyOS NEXT needs Zhuoyitong before APKs. |
| **iPhone** | Open the Pages URL in Safari → Share → **Add to Home Screen** |
| **Cursor extension** | [cursor-remote-lite.vsix](https://github.com/edwardlthompson/cursor-remote-lite/releases/latest/download/cursor-remote-lite.vsix) |
| **Telegram** (optional) | `TELEGRAM_BOT_TOKEN` + `/start`; forum `/sync` for per-window topics — [docs/TELEGRAM.md](docs/TELEGRAM.md) |

If an Android phone is on USB/Wi‑Fi ADB and the APK sits next to the EXE/deb, first run can **install + open pairing** automatically.

**Step 4: Start using it**

- The top-left shows the current window; tap it to switch windows (local / SSH / Agents).
- Send messages from the input box at the bottom; use `Agent ▾` / `Auto ▾` to switch mode and model; "History" opens earlier conversations and "＋ New" starts a new one.
- When the Agent is waiting for your approval (running a command, accepting changes), the buttons show up right in the conversation.
- Tap a blue file name or a card marked 📄 to preview a file; press Back to close it.
- "Screen" in the top-right switches to the live view, where you can tap anything in the Cursor UI.
- "⋯ → Enable notifications" in the top-right makes your phone alert you when the Agent finishes or needs approval (see "Notifications" below).

From now on, Cursor must always be started with the debugging port; just launch it with `./start-cursor.sh`.

## Notifications

**Goal:** when the Agent finishes a turn (or waits for Run/Allow), your phone shows a heads-up Android notification and plays a sound — similar to Cursor’s desktop popup + chime.

### Turn it on (Android app)

1. Open **Cursor Remote** → **⋯ → Turn on notifications** (allow the system permission if asked).
2. Tap **⋯ → Send a test notification**. You should get a heads-up banner **and** a sound.
3. Leave a quiet “Cursor Remote is listening…” notification in the shade (required so Android keeps the connection alive).
4. **Samsung / Xiaomi / Huawei / OPPO:** allow the app to run in the background (unrestricted battery; “Auto-run” / “App launch” → manage manually → allow).
5. In **Settings → Apps → Cursor Remote → Notifications**, confirm **Agent finished** and **Agent needs your OK** are on, sound is on, and importance is High / Alerting (not Silent).

We use the **system notification sound** (not Cursor’s proprietary desktop chime — that file isn’t redistributable). Pick any tone you like under those two channels.

### When alerts fire

| Event | What you get |
|---|---|
| **Finished** | Notification + sound whenever a turn ends (includes the start of the reply). Fires even if that window is open on the phone. |
| **Waiting** | Notification + sound after ~10s on Run / Allow / Accept (auto-run flashes don’t count). Suppressed only for the window you’re actively viewing. |

| Phone | How notifications arrive | Things to note |
|---|---|---|
| Android app | Persistent SSE connection to your computer (no Google services required) | Keep background unrestricted; test with “Send a test notification” |
| iPhone | System push (Web Push) | Add to Home Screen; open from the icon; iOS 16.4+ |
| Desktop / Android browser | Browser push | Allow notifications in the browser |

Notifications are sent by your computer: the Android app connects straight to it; iPhone/browsers go through Apple/Google push, with end-to-end encrypted payloads.

## Keeping your computer online (preventing sleep)

The relay runs on your computer, so **once your computer sleeps, your phone can't connect**.

| | Screen locked | Display off | Sleep / lid closed |
|---|---|---|---|
| Does the phone still work? | ✅ Yes | ✅ Yes (screen mode falls back to periodic screenshots, a bit choppy) | ❌ No |

So there's only one thing to do: **allow the display to turn off and the screen to lock, but don't let the system sleep**.

### macOS

**Laptops (no sleep while plugged in)**: System Settings → Battery → Options → turn on "Prevent automatic sleeping on power adapter when the display is off".
Or use the command line (affects only the plugged-in state; `-c` = charger):

```bash
sudo pmset -c sleep 0          # never sleep while plugged in
sudo pmset -c displaysleep 10  # display still turns off after 10 minutes (saves power, doesn't affect use)
pmset -g | grep -E " sleep|displaysleep"   # show current settings
```

**Desktops (Mac mini / iMac / Studio)**: System Settings → Energy → turn on "Prevent automatic sleeping when the display is off".

**Just stay awake temporarily** (e.g. letting the Agent run a long task before you head out):

```bash
caffeinate -s    # prevent sleep while plugged in; press Ctrl+C to restore
```

**Closing the lid**: a MacBook always sleeps when the lid is closed (unless it has an external display + power + keyboard). If you want to use it remotely, don't close the lid; turn the brightness all the way down and lock the screen instead.
Forcing it with `sudo pmset -a disablesleep 1` is not recommended: it will overheat if you put it in a bag.

### Windows

Settings → System → Power & battery → Screen and sleep: set "When plugged in, put my device to sleep after" to **Never**; you can keep "Turn off my screen" (e.g. 10 minutes).
Or use an administrator PowerShell:

```powershell
powercfg /change standby-timeout-ac 0     # never sleep while plugged in
powercfg /change monitor-timeout-ac 10    # turn off the display after 10 minutes
powercfg /change hibernate-timeout-ac 0   # never hibernate while plugged in
# Don't sleep when the laptop lid is closed (while plugged in):
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT
```

**Preferred:** install **CursorRemote.exe** / MSI and use the tray (Start with Windows). Pair with `npm run pair` or tray → Pair over ADB.

**From source** (PowerShell outside Cursor’s terminal, which dies when Cursor restarts):

1. `powershell -ExecutionPolicy Bypass -File .\start-cursor.ps1` — restarts Cursor with the debug port.
2. `npm run public` — or rely on the tray host after a packaged install.

### Trade-offs

- **Power use**: a laptop idling with the display off draws about 3–8 W, under 0.2 kWh per day; a desktop draws 30–100 W, 1–2 kWh per day.
- **Battery**: keeping a laptop plugged in at full charge for long periods speeds up battery wear. macOS's "Optimized Battery Charging" and Windows vendors' "battery protection / 80% charge limit" help; turning them on is recommended.
- **Security**: a computer that's always on can always be controlled by paired phones. Keep it locked (locking doesn't affect use), and remove devices you no longer use under "⋯ → Paired devices".

### What happens if you don't set this up

- After your computer sleeps, the phone shows "Computer offline" and you can't do anything; **any task the Agent is running also pauses** until someone wakes the computer.
- After waking, the service recovers automatically. The tunnel address changes, but the new address is published automatically and the phone reconnects within about a minute, **no re-pairing needed**.

## Security

- **Pairing**: the link generated by `npm run pair` contains a random key and a one-time pairing code; it expires after 10 minutes and is invalidated after use. After pairing, the phone receives a device token, and the computer stores only its hash.
- **Nothing on GitHub to crack**: `url.json` (your computer's address) in the Pages repository is encrypted with a random 256-bit key. That key is passed to the phone only through the pairing link and is never uploaded. There's no password, so there's no offline password brute-forcing either.
- **Two-factor verification (optional)**: `npm run 2fa` binds Google Authenticator / Microsoft Authenticator / 1Password, etc. Once enabled, pairing a new device requires a 6-digit code; you can also require re-verification every N days (default 30; 0 means only verify at pairing). Even if a pairing link leaks, it can't be used without the code from your phone.
- **Managing devices**: view and remove devices on your phone under "⋯ → Paired devices", or on your computer with `npm run devices`. A removed device is disconnected immediately.
- Debugging port 9222 listens only on localhost; in public mode the relay also listens only on `127.0.0.1`, so it can only be reached from outside through the tunnel.
- Repeated failed pairing attempts trigger a temporary lockout.
- A paired device has full control over your Cursor, which is equivalent to being able to run commands on your computer. **Don't post pairing links in group chats or anywhere public.**

## Common commands

| Command | What it does |
|---|---|
| `npm run setup` | Setup wizard (can be re-run) |
| `npm run pair` | Pair a new device (shows a QR code) |
| `npm run devices` | List paired devices; `npm run devices remove <id>` removes one |
| `npm run 2fa` | Enable / re-bind Authenticator 2FA; `npm run 2fa off` disables it; `npm run 2fa status` shows status |
| `npm run public` | Run in the foreground (public access + fixed address) |
| `npm start` | Run in the foreground (LAN only) |
| `./service.sh status / logs / uninstall` | Background service status / logs / uninstall |
| `npm run reset` | Clear all pairings, 2FA and configuration (you'll need to pair again afterwards) |

## FAQ

**The phone shows "Not connected to Cursor"**: Cursor wasn't started with the debugging port; run `./start-cursor.sh` (on Windows, `start-cursor.ps1`).

**The phone shows "Computer offline"**: the computer is asleep / shut down, or the service just restarted (the new address takes effect in about a minute, and the app retries automatically). See "Preventing sleep" above.

**Got a new phone / cleared browser data**: run `npm run pair` on your computer to pair again, and delete the old device under "Paired devices".

**Does it cost anything? Does it use up any free quotas?** No. At runtime it uses only three things:
- Cloudflare quick tunnels: free, no sign-up required.
- GitHub Pages: free for public repositories. Your computer publishes its address once per restart (one commit); Pages recommends no more than 10 builds per hour, and going over just means changes take effect a bit later.
- GitHub API: 5,000 requests per hour; only a handful are actually used.

GitHub Actions is only used when this fork publishes a new release; nothing runs on your account for day-to-day use.

**Not receiving notifications**: first use "Send a test notification" from the menu. If the test notification doesn't arrive: on Android, check the system notification permission and background activity permission; on iPhone, make sure you opened the app from the home screen icon. If the test notification arrives but Agent alerts don't: your computer may be asleep, or Cursor wasn't started with `./start-cursor.sh`.

**Doesn't work on a company network**: Cloudflare tunnels use port 443, which usually works; if even `trycloudflare.com` is blocked, you can only use `npm start` on the same LAN.

**SSH remote window doesn't show up**: tap the window name in the top-left to open the window list; the list refreshes every time you open it.

**Tapping a file says it can't be found**: the file may have been deleted or moved; for files in SSH windows, your computer needs passwordless `ssh` to that machine.

## License

MIT. Copyright notice for the original upstream author is retained in [LICENSE](LICENSE). This fork is maintained at [edwardlthompson/cursor-remote-lite](https://github.com/edwardlthompson/cursor-remote-lite).
