import test from 'node:test';
import assert from 'node:assert/strict';

// Lightweight regressions for chat/extract helpers that used to break on Agents UI changes.
// Keep these free of a live Cursor — pure string/DOM-shape checks.

test('pairing deep link keeps query ampersands when quoted for adb shell', () => {
  const uri = 'cursorremote://pair?app=https://example.github.io/app/&d=abc.def';
  const quoted = `'${uri.replace(/'/g, `'\\''`)}'`;
  const remote = `am start -a android.intent.action.VIEW -d ${quoted}`;
  assert.match(remote, /app=https:\/\/example\.github\.io\/app\/&d=abc\.def/);
  assert.equal(remote.includes('&d=abc.def'), true);
});

test('agents history pick forces refresh markers exist in server source', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(src, /composer-react-virtual-plane-row/);
  assert.match(src, /ensureAgentSidebar|agentSidebarChats|data-flat-index/);
});

test('status endpoint and network modes are wired', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(src, /\/api\/status/);
  assert.match(src, /NETWORK_MODE/);
  assert.match(src, /--localhost|CR_NETWORK/);
});

test('telegram and watcher persistence hooks exist', async () => {
  const fs = await import('node:fs');
  const notify = fs.readFileSync(new URL('../notify.mjs', import.meta.url), 'utf8');
  const tg = fs.readFileSync(new URL('../telegram.mjs', import.meta.url), 'utf8');
  assert.match(notify, /telegramNotify/);
  assert.match(notify, /lastAlert/);
  assert.match(notify, /watchedWindows/);
  assert.match(tg, /startTelegramBot/);
});
