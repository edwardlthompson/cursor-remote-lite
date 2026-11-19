#!/usr/bin/env node
// Optional Telegram bridge (free): Agent waiting/done alerts + /start chat linking.
// Config: ~/.cursor-remote-lite/telegram.json or TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID env.
//   npm run telegram
//   npm run telegram -- enable|disable|set-chat <id>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './auth.mjs';

const FILE = path.join(DATA_DIR, 'telegram.json');

export function readTelegramConfig() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}

export function writeTelegramConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

export function telegramEnabled() {
  const cfg = readTelegramConfig();
  const token = process.env.TELEGRAM_BOT_TOKEN || cfg.botToken;
  return Boolean(cfg.enabled !== false && token);
}

async function api(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

function escapeMd(s) {
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, ch => `\\${ch}`);
}

export async function telegramNotify({ title, body, win }) {
  if (!telegramEnabled()) return false;
  const cfg = readTelegramConfig();
  const token = process.env.TELEGRAM_BOT_TOKEN || cfg.botToken;
  const chatId = process.env.TELEGRAM_CHAT_ID || cfg.chatId;
  if (!token || !chatId) return false;
  const text = `*${escapeMd(title)}*\n${escapeMd(body || '')}${win ? `\n\`${escapeMd(String(win))}\`` : ''}`;
  try {
    await api(token, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });
    return true;
  } catch (e) {
    console.log(`!! Telegram notify failed: ${e.message}`);
    return false;
  }
}

export function startTelegramBot({ onPrompt } = {}) {
  if (!telegramEnabled()) return () => {};
  const cfg = readTelegramConfig();
  const token = process.env.TELEGRAM_BOT_TOKEN || cfg.botToken;
  if (!token) return () => {};

  let offset = 0;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const updates = await api(token, 'getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.chat) continue;
        const chatId = msg.chat.id;
        const text = String(msg.text || '').trim();
        if (text === '/start' || text.startsWith('/register')) {
          writeTelegramConfig({ ...readTelegramConfig(), enabled: true, botToken: token, chatId });
          await api(token, 'sendMessage', {
            chat_id: chatId,
            text: 'Cursor Remote Lite linked this chat. You will get Agent waiting/done alerts here.',
          });
          console.log(`[telegram] Linked chat ${chatId}`);
          continue;
        }
        if (text && typeof onPrompt === 'function') {
          try {
            await onPrompt({ chatId, text });
          } catch (e) {
            await api(token, 'sendMessage', { chat_id: chatId, text: `Could not send to Cursor: ${e.message}` });
          }
        }
      }
    } catch (e) {
      if (!/timed out/i.test(e.message || '')) console.log(`!! Telegram poll: ${e.message}`);
    }
    if (!stopped) setTimeout(tick, 500);
  };
  tick();
  console.log('[telegram] Bot polling started (send /start to the bot to link a chat)');
  return () => { stopped = true; };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const [cmd, arg] = process.argv.slice(2);
  const cfg = readTelegramConfig();
  if (cmd === 'set-chat' && arg) {
    writeTelegramConfig({ ...cfg, enabled: true, chatId: arg, botToken: process.env.TELEGRAM_BOT_TOKEN || cfg.botToken });
    console.log(`Saved chat id ${arg}`);
  } else if (cmd === 'enable') {
    writeTelegramConfig({ ...cfg, enabled: true });
    console.log('Telegram bridge enabled.');
  } else if (cmd === 'disable') {
    writeTelegramConfig({ ...cfg, enabled: false });
    console.log('Telegram bridge disabled.');
  } else {
    console.log('Telegram bridge (free, optional)');
    console.log(`  enabled: ${telegramEnabled()}`);
    console.log(`  token:   ${(process.env.TELEGRAM_BOT_TOKEN || cfg.botToken) ? '(set)' : '(missing — set TELEGRAM_BOT_TOKEN)'}`);
    console.log(`  chatId:  ${process.env.TELEGRAM_CHAT_ID || cfg.chatId || '(send /start to the bot)'}`);
    console.log('\nCommands: npm run telegram -- enable|disable|set-chat <id>');
  }
}
