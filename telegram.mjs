#!/usr/bin/env node
// Optional Telegram bridge (free):
//   - waiting/done alerts with Approve / Skip / Stop
//   - plain-text prompts → CDP
//   - forum topics per Cursor window (when the linked chat is a forum)
// Config: ~/.cursor-remote-lite/telegram.json or TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
//   npm run telegram
//   npm run telegram -- enable|disable|set-chat <id>|sync
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

function topicName(title, winId) {
  const base = String(title || winId || 'Cursor').replace(/[\n\r]/g, ' ').trim() || 'Cursor';
  return base.slice(0, 120);
}

function waitingKeyboard(winId) {
  const id = String(winId || '').slice(0, 40);
  return {
    inline_keyboard: [[
      { text: 'Approve', callback_data: `ok:${id}` },
      { text: 'Skip', callback_data: `no:${id}` },
      { text: 'Stop', callback_data: `stop:${id}` },
    ]],
  };
}

/** Ensure a forum topic exists for this Cursor window; returns message_thread_id or null. */
export async function ensureWindowTopic(winId, title) {
  if (!telegramEnabled() || !winId) return null;
  const token = tokenOf();
  const chatId = chatOf();
  if (!token || !chatId) return null;

  const cfg = readTelegramConfig();
  if (cfg.forum === false) return null;
  const topics = { ...(cfg.topics || {}) };
  if (topics[winId]?.threadId) return topics[winId].threadId;

  try {
    const topic = await api(token, 'createForumTopic', {
      chat_id: chatId,
      name: topicName(title, winId),
    });
    topics[winId] = {
      threadId: topic.message_thread_id,
      title: topicName(title, winId),
      updatedAt: Date.now(),
    };
    writeTelegramConfig({ ...cfg, forum: true, topics });
    console.log(`[telegram] Topic "${topics[winId].title}" → thread ${topic.message_thread_id}`);
    return topic.message_thread_id;
  } catch (e) {
    // Not a forum chat, or bot lacks manage_topics — stay flat.
    if (/forum|topic|THREAD|CHAT_NOT_MODIFIED|not enough rights/i.test(e.message || '')) {
      writeTelegramConfig({ ...cfg, forum: false });
      console.log(`[telegram] Forum topics unavailable (${e.message}); using flat chat`);
      return null;
    }
    console.log(`!! Telegram createForumTopic: ${e.message}`);
    return null;
  }
}

export async function syncWindowTopics(windows = []) {
  const out = [];
  for (const w of windows) {
    const threadId = await ensureWindowTopic(w.id, w.title);
    out.push({ id: w.id, title: w.title, threadId });
  }
  return out;
}

export function winIdForThread(threadId) {
  if (threadId == null) return null;
  const topics = readTelegramConfig().topics || {};
  for (const [winId, meta] of Object.entries(topics)) {
    if (Number(meta.threadId) === Number(threadId)) return winId;
  }
  return null;
}

export async function telegramNotify(event) {
  if (!telegramEnabled()) return false;
  const token = tokenOf();
  const chatId = chatOf();
  if (!token || !chatId) return false;

  const title = event.title || 'Cursor Remote';
  const body = event.body || '';
  const win = event.win;
  const windowTitle = event.windowTitle || '';
  const text = `*${escapeMd(title)}*\n${escapeMd(body)}${win ? `\n\`${escapeMd(String(win))}\`` : ''}`;

  let threadId = null;
  if (win) threadId = await ensureWindowTopic(win, windowTitle || title);

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'MarkdownV2',
    disable_web_page_preview: true,
  };
  if (threadId) payload.message_thread_id = threadId;
  if (event.kind === 'waiting' && win) payload.reply_markup = waitingKeyboard(win);

  try {
    await api(token, 'sendMessage', payload);
    return true;
  } catch (e) {
    // Retry without thread if topic went stale.
    if (threadId && /thread|TOPIC/i.test(e.message || '')) {
      try {
        const cfg = readTelegramConfig();
        const topics = { ...(cfg.topics || {}) };
        delete topics[win];
        writeTelegramConfig({ ...cfg, topics });
        delete payload.message_thread_id;
        await api(token, 'sendMessage', payload);
        return true;
      } catch (e2) {
        console.log(`!! Telegram notify failed: ${e2.message}`);
        return false;
      }
    }
    console.log(`!! Telegram notify failed: ${e.message}`);
    return false;
  }
}

/**
 * @param {{
 *   onPrompt?: (p: { chatId: any, text: string, winId?: string|null, threadId?: number|null }) => Promise<string|void>,
 *   onAction?: (p: { chatId: any, action: 'approve'|'reject'|'stop', winId: string }) => Promise<string|void>,
 *   listWindows?: () => Promise<{id:string,title:string}[]>,
 * }} hooks
 */
export function startTelegramBot(hooks = {}) {
  if (!telegramEnabled()) return () => {};
  const token = tokenOf();
  if (!token) return () => {};

  let offset = 0;
  let stopped = false;
  const reply = (chatId, text, threadId) => api(token, 'sendMessage', {
    chat_id: chatId,
    text,
    ...(threadId ? { message_thread_id: threadId } : {}),
  }).catch(() => {});

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
          try { await api(token, 'answerCallbackQuery', { callback_query_id: cq.id }); } catch { /* */ }
          if (!m || !chatId) continue;
          const action = m[1] === 'ok' ? 'approve' : m[1] === 'no' ? 'reject' : 'stop';
          const winId = m[2];
          if (typeof hooks.onAction !== 'function') {
            await reply(chatId, 'Relay has no CDP action hook yet.', cq.message?.message_thread_id);
            continue;
          }
          try {
            const msg = await hooks.onAction({ chatId, action, winId });
            await reply(chatId, msg || `Done: ${action}`, cq.message?.message_thread_id);
            try {
              await api(token, 'editMessageReplyMarkup', {
                chat_id: chatId,
                message_id: cq.message.message_id,
                reply_markup: { inline_keyboard: [] },
              });
            } catch { /* */ }
          } catch (e) {
            await reply(chatId, `Failed (${action}): ${e.message}`, cq.message?.message_thread_id);
          }
          continue;
        }

        const msg = u.message;
        if (!msg?.chat) continue;
        const chatId = msg.chat.id;
        const threadId = msg.message_thread_id ?? null;
        const text = String(msg.text || '').trim();
        if (!text) continue;

        if (text === '/start' || text.startsWith('/register')) {
          writeTelegramConfig({ ...readTelegramConfig(), enabled: true, botToken: token, chatId });
          await reply(chatId,
            'Cursor Remote Lite linked.\n\n'
            + '• Waiting alerts: Approve / Skip / Stop\n'
            + '• Plain text → prompt Cursor\n'
            + '• In a forum group, each Cursor window gets its own topic (/sync)\n'
            + '• /status /sync\n'
            + 'Free forever — no license key.',
            threadId);
          console.log(`[telegram] Linked chat ${chatId}`);
          continue;
        }

        if (text === '/status') {
          const cfg = readTelegramConfig();
          const n = Object.keys(cfg.topics || {}).length;
          await reply(chatId,
            `enabled=${telegramEnabled()} forum=${cfg.forum !== false} topics=${n} chat=${cfg.chatId || chatId}`,
            threadId);
          continue;
        }

        if (text === '/sync') {
          if (typeof hooks.listWindows !== 'function') {
            await reply(chatId, 'Window list unavailable.', threadId);
            continue;
          }
          try {
            const wins = await hooks.listWindows();
            const synced = await syncWindowTopics(wins);
            const lines = synced.map(s => `${s.title || s.id}: ${s.threadId ?? '(flat chat)'}`);
            await reply(chatId, lines.length ? `Synced topics:\n${lines.join('\n')}` : 'No Cursor windows open.', threadId);
          } catch (e) {
            await reply(chatId, `Sync failed: ${e.message}`, threadId);
          }
          continue;
        }

        if (text.startsWith('/')) {
          await reply(chatId, 'Commands: /start /status /sync — or send a normal message to prompt the Agent.', threadId);
          continue;
        }

        if (typeof hooks.onPrompt === 'function') {
          try {
            const winId = winIdForThread(threadId);
            const result = await hooks.onPrompt({ chatId, text, winId, threadId });
            await reply(chatId, typeof result === 'string' ? result : 'Sent to Cursor.', threadId);
          } catch (e) {
            await reply(chatId, `Could not send to Cursor: ${e.message}`, threadId);
          }
        }
      }
    } catch (e) {
      if (!/timed out/i.test(e.message || '')) console.log(`!! Telegram poll: ${e.message}`);
    }
    if (!stopped) setTimeout(tick, 400);
  };
  tick();
  console.log('[telegram] Bot polling started (forum topics when available; /sync to map windows)');
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
    console.log(`  forum:   ${cfg.forum === false ? 'off/unavailable' : 'auto'}`);
    console.log(`  topics:  ${Object.keys(cfg.topics || {}).length}`);
    console.log('\nCommands: npm run telegram -- enable|disable|set-chat <id>');
  }
}
