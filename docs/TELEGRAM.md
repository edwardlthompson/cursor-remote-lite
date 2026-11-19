# Telegram bridge (free)

Optional channel alongside the phone app. No license key.

## Setup

1. Message `@BotFather` → `/newbot` → copy the token.
2. Prefer a **supergroup with Topics enabled**; add the bot as admin with **Manage Topics**.
3. Set `TELEGRAM_BOT_TOKEN` in the environment (or write `botToken` into `~/.cursor-remote-lite/telegram.json`).
4. Start the relay (`npm run public` or the extension).
5. Send `/start` to the bot (in the group or DM). That stores `chatId`.

## Commands

| Command | Effect |
|---------|--------|
| `/start` | Link this chat |
| `/status` | Bridge + topic count |
| `/sync` | Create a forum topic for every open Cursor window |

## Behavior

- **Waiting** alerts include **Approve / Skip / Stop** (headless CDP clicks).
- In a **forum** group, each Cursor window gets its own topic; alerts and replies stay in that thread.
- If the chat is not a forum (or the bot lacks rights), the bridge uses a flat chat automatically.
- Plain text in a topic is sent as a prompt to that window; in a flat chat it targets the last alert window (else the first open window).

## Disable

```bash
npm run telegram -- disable
```
