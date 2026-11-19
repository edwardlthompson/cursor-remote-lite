#!/usr/bin/env node
// Optional Telegram bridge (free): waiting/done alerts, inline Approve/Skip/Stop, prompts → CDP.
// Config: ~/.cursor-remote-lite/telegram.json or TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID.
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

function tokenOf() {
  return process.env.TELEGRAM_BOT_TOKEN || readTelegramConfig().botToken || '';
}

function chatOf() {
  return process.env.TELEGRAM_CHAT_ID || readTelegramConfig().chatId || '';
}

async function api(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

function escapeMd(s) {
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, ch => `\\${ch}`);
}

function waitingKeyboard(winId) {
  // callback_data max 64 bytes
  const id = String(winId || '').slice(0, 40);
  return {
    inline_keyboard: [[
      { text: 'Approve', callback_data: `ok:${id}` },
      { text: 'Skip', callback_data: `no:${id}` },
      { text: 'Stop', callback_data: `stop:${id}` },
    ]],
  };
}

export async function telegramNotify(event) {
  if (!telegramEnabled()) return false;
  const token = tokenOf();
  const chatId = chatOf();
  if (!token || !chatId) return false;
  const title = event.title || 'Cursor Remote';
  const body = event.body || '';
  const win = event.win;
  const text = `*${escapeMd(title)}*\n${escapeMd(body)}${win ? `\n\`${escapeMd(String(win))}\`` : ''}`;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'MarkdownV2',
    disable_web_page_preview: true,
  };
  if (event.kind === 'waiting' && win) payload.reply_markup = waitingKeyboard(win);
  try {
    await api(token, 'sendMessage', payload);
    return true;
  } catch (e) {
    console.log(`!! Telegram notify failed: ${e.message}`);
    return false;
  }
}

/**
 * @param {{
 *   onPrompt?: (p: { chatId: number|string, text: string }) => Promise<void>,
 *   onAction?: (p: { chatId: number|string, action: 'approve'|'reject'|'stop', winId: string }) => Promise<string|void>,
 * }} hooks
 */
export function startTelegramBot(hooks = {}) {
  if (!telegramEnabled()) return () => {};
  const token = tokenOf();
  if (!token) return () => {};

  let offset = 0;
  let stopped = false;

  const reply = (chatId, text) => api(token, 'sendMessage', { chat_id: chatId, text }).catch(() => {});

  const tick = async () => {
    if (stopped) return;
    try {
      const updates = await api(token, 'getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query'],
      });
      for (const u of updates) {
        offset = u.update_id + 1;

        if (u.callback_query) {
          const cq = u.callback_query;
          const chatId = cq.message?.chat?.id;
          const data = String(cq.data || '');
          const m = /^(ok|no|stop):(.+)$/.exec(data);
          try {
            await api(token, 'answerCallbackQuery', { callback_query_id: cq.id });
          } catch { /* */ }
          if (!m || !chatId) continue;
          const action = m[1] === 'ok' ? 'approve' : m[1] === 'no' ? 'reject' : 'stop';
          const winId = m[2];
          if (typeof hooks.onAction !== 'function') {
            await reply(chatId, 'Relay has no CDP action hook yet.');
            continue;
          }
          try {
            const msg = await hooks.onAction({ chatId, action, winId });
            await reply(chatId, msg || `Done: ${action}`);
            try {
              await api(token, 'editMessageReplyMarkup', {
                chat_id: chatId,
                message_id: cq.message.message_id,
                reply_markup: { inline_keyboard: [] },
              });
            } catch { /* */ }
          } catch (e) {
            await reply(chatId, `Failed (${action}): ${e.message}`);
          }
          continue;
        }

        const msg = u.message;
        if (!msg?.chat) continue;
        const chatId = msg.chat.id;
        const text = String(msg.text || '').trim();
        if (!text) continue;

        if (text === '/start' || text.startsWith('/register')) {
          writeTelegramConfig({ ...readTelegramConfig(), enabled: true, botToken: token, chatId });
          await reply(chatId,
            'Cursor Remote Lite linked.\n\n'
            + '• Waiting alerts include Approve / Skip / Stop buttons\n'
            + '• Plain text is sent as a prompt to Cursor\n'
            + '• /status — bridge status\n'
            + 'Free forever — no license key.');
          console.log(`[telegram] Linked chat ${chatId}`);
          continue;
        }

        if (text === '/status') {
          const cfg = readTelegramConfig();
          await reply(chatId, `enabled=${telegramEnabled()} chat=${cfg.chatId || chatId} token=${token ? 'yes' : 'no'}`);
          continue;
        }

        if (text.startsWith('/')) {
          await reply(chatId, 'Commands: /start /status — or send a normal message to prompt the Agent.');
          continue;
        }

        if (typeof hooks.onPrompt === 'function') {
          try {
            const result = await hooks.onPrompt({ chatId, text });
            await reply(chatId, typeof result === 'string' ? result : 'Sent to Cursor.');
          } catch (e) {
            await reply(chatId, `Could not send to Cursor: ${e.message}`);
          }
        }
      }
    } catch (e) {
      if (!/timed out/i.test(e.message || '')) console.log(`!! Telegram poll: ${e.message}`);
    }
    if (!stopped) setTimeout(tick, 400);
  };
  tick();
  console.log('[telegram] Bot polling started (send /start; waiting alerts get Approve/Skip/Stop)');
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
